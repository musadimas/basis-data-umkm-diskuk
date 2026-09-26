export const RETRY_DELAYS_SECONDS = Object.freeze([10, 30, 120, 300, 900]);
export const NON_RETRYABLE_ERROR_CODES = Object.freeze(
  new Set(["53100", "ENOSPC"]),
);
export function isNonRetryableError(error) {
  return NON_RETRYABLE_ERROR_CODES.has(String(error?.code || ""));
}
export function retryDelaySeconds(attempt, random = Math.random()) {
  const base =
    RETRY_DELAYS_SECONDS[
      Math.max(0, Math.min(attempt - 1, RETRY_DELAYS_SECONDS.length - 1))
    ];
  return base + Math.floor(Math.max(0, Math.min(0.25, random)) * base);
}
export class JobQueue {
  constructor(
    pool,
    {
      leaseSeconds = 120,
      batchSize = 25,
      workerId = `worker-${process.pid}`,
    } = {},
  ) {
    this.pool = pool;
    this.leaseSeconds = leaseSeconds;
    this.batchSize = batchSize;
    this.workerId = workerId;
  }
  async reclaimExpired(client = this.pool) {
    const retry = await client.query(
      `UPDATE analitik_job SET status='retry', lease_until=NULL, lease_owner=NULL, available_at=NOW(), updated_at=NOW() WHERE status='processing' AND lease_until < NOW() AND attempts < max_attempts RETURNING id`,
    );
    await client.query(
      `UPDATE analitik_job SET status='dead', lease_until=NULL, lease_owner=NULL, error_code='LEASE_EXHAUSTED', error_message='Job lease expired too many times', updated_at=NOW() WHERE status='processing' AND lease_until < NOW() AND attempts >= max_attempts`,
    );
    return retry.rowCount;
  }
  async claim(limit = this.batchSize) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.reclaimExpired(client);
      const result = await client.query(
        `WITH picked AS (SELECT id FROM analitik_job WHERE status IN ('queued','retry') AND available_at <= NOW() AND attempts < max_attempts ORDER BY priority DESC, sequence FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE analitik_job j SET status='processing', lease_until=NOW()+make_interval(secs=>$2), lease_owner=$3, attempts=j.attempts+1, updated_at=NOW() FROM picked WHERE j.id=picked.id RETURNING j.*`,
        [
          Math.max(
            1,
            Math.min(this.batchSize, Number(limit) || this.batchSize),
          ),
          this.leaseSeconds,
          this.workerId,
        ],
      );
      await client.query("COMMIT");
      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async release(jobIds) {
    const ids = (Array.isArray(jobIds) ? jobIds : []).filter((id) => id != null);
    if (!ids.length) return 0;
    const result = await this.pool.query(
      `UPDATE analitik_job SET status='queued', lease_until=NULL, lease_owner=NULL, attempts=GREATEST(attempts-1,0), updated_at=NOW() WHERE id = ANY($1::uuid[]) AND status='processing' AND lease_owner=$2`,
      [ids, this.workerId],
    );
    return result.rowCount;
  }
  async heartbeat(jobId) {
    await this.pool.query(
      `UPDATE analitik_job SET lease_until=NOW()+make_interval(secs=>$2), updated_at=NOW() WHERE id=$1 AND status='processing' AND lease_owner=$3`,
      [jobId, this.leaseSeconds, this.workerId],
    );
  }
  async complete(jobId) {
    await this.pool.query(
      `UPDATE analitik_job SET status='completed', lease_until=NULL, lease_owner=NULL, error_code=NULL, error_message=NULL, updated_at=NOW() WHERE id=$1 AND lease_owner=$2`,
      [jobId, this.workerId],
    );
  }
  async fail(job, error, logger) {
    const attempts = Number(job.attempts || 1);
    const message = String(error?.code || "JOB_FAILED").slice(0, 80);
    if (
      isNonRetryableError(error) ||
      attempts >= Number(job.max_attempts || 5)
    ) {
      await this.pool.query(
        `UPDATE analitik_job SET status='dead', lease_until=NULL, lease_owner=NULL, error_code=$2, error_message='Job failed; see sanitized incident', updated_at=NOW() WHERE id=$1`,
        [job.id, message],
      );
      await this.pool.query(
        `INSERT INTO analitik_health(health_kind,component,status,fingerprint,error_code,error_message) VALUES ('incident','analytics-worker','open',$1,$2,'Worker job exhausted') ON CONFLICT DO NOTHING`,
        [`job:${job.job_type}:${message}`, message],
      );
      logger.error("job_dead", {
        jobType: job.job_type,
        jobId: job.id,
        attempt: attempts,
        errorCode: message,
      });
      return "dead";
    }
    const delay = retryDelaySeconds(attempts);
    await this.pool.query(
      `UPDATE analitik_job SET status='retry', lease_until=NULL, lease_owner=NULL, available_at=NOW()+make_interval(secs=>$2), error_code=$3, error_message='Retry scheduled', updated_at=NOW() WHERE id=$1`,
      [job.id, delay, message],
    );
    logger.warn("job_retry", {
      jobType: job.job_type,
      jobId: job.id,
      attempt: attempts,
      delaySeconds: delay,
      errorCode: message,
    });
    return "retry";
  }
}
