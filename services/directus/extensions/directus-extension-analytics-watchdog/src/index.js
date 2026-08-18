const { sanitizeError } = require("../../shared/auth.cjs")
module.exports = ({ schedule }, { database, logger }) => {
  const run = async () => {
    try {
      const health = await database.raw(`SELECT component,status,heartbeat_at,queue_age_seconds,(SELECT COALESCE(EXTRACT(EPOCH FROM (NOW()-MIN(available_at))),0)::integer FROM analitik_job WHERE status IN ('queued','retry')) AS oldest_job_age,(SELECT COUNT(*)::integer FROM analitik_job WHERE status='processing' AND lease_until < NOW()) AS expired_leases FROM analitik_health WHERE health_kind='component_status' ORDER BY updated_at DESC`)
      const rows = health.rows ?? health[0] ?? []
      const worker = rows.find((row) => row.component === "analytics-worker")
      const stale = !worker || !worker.heartbeat_at || Date.now() - new Date(worker.heartbeat_at).getTime() > 90_000
      const queueAge = Number(worker?.oldest_job_age || 0)
      const status = stale || queueAge > 300 ? "degraded" : "healthy"
      await database.raw(`UPDATE analitik_job SET status='retry',lease_until=NULL,lease_owner=NULL,available_at=NOW(),updated_at=NOW() WHERE status='processing' AND lease_until < NOW() AND attempts < max_attempts; UPDATE analitik_job SET status='dead',lease_until=NULL,lease_owner=NULL,error_code='LEASE_EXHAUSTED',error_message='Job lease expired too many times',updated_at=NOW() WHERE status='processing' AND lease_until < NOW() AND attempts >= max_attempts`)
      await database.raw(`INSERT INTO analitik_health(health_kind,component,status,queue_age_seconds,check_name,check_data,updated_at) VALUES ('component_status','watchdog',?,?,'worker_watchdog',?::jsonb,NOW()) ON CONFLICT(health_kind,component) WHERE health_kind='component_status' DO UPDATE SET status=EXCLUDED.status,queue_age_seconds=EXCLUDED.queue_age_seconds,check_data=EXCLUDED.check_data,updated_at=NOW()`, [status, queueAge, JSON.stringify({ stale, expiredLeases: Number(worker?.expired_leases || 0) })])
      if (status === "degraded") await database.raw(`INSERT INTO analitik_health(health_kind,component,status,fingerprint,error_code,error_message,updated_at) VALUES ('incident','analytics-worker','open','watchdog:degraded','WORKER_DEGRADED','Analytics worker health degraded',NOW()) ON CONFLICT(health_kind,component,fingerprint) WHERE health_kind='incident' AND status='open' DO UPDATE SET updated_at=NOW()`)
      else await database.raw(`UPDATE analitik_health SET status='resolved',updated_at=NOW() WHERE health_kind='incident' AND component='analytics-worker' AND fingerprint='watchdog:degraded' AND status='open'`)
      return { status, stale, queueAge }
    } catch (error) { logger.error(sanitizeError(error), "Analytics watchdog failed"); return { status: "critical" } }
  }
  const cleanup = async () => {
    try {
      await database.raw(`DELETE FROM analitik_job WHERE status IN ('completed','dead','cancelled') AND export_type IS NULL AND updated_at < NOW() - INTERVAL '30 days'; DELETE FROM analitik_health WHERE health_kind='component_status' AND updated_at < NOW() - INTERVAL '30 days' AND component NOT IN ('analytics-worker','watchdog'); DELETE FROM directus_activity WHERE timestamp < NOW() - INTERVAL '1 year'`)
      return { status: "completed" }
    } catch (error) { logger.error(sanitizeError(error), "Analytics retention cleanup failed"); return { status: "failed" } }
  }
  schedule("*/30 * * * * *", run)
  const reconcile = async () => { try { await database.raw(`SELECT analitik_enqueue_job('reconcile', 'daily_reconcile:' || CURRENT_DATE::text, NULL)`); return { status: "queued" } } catch (error) { logger.error(sanitizeError(error), "Daily reconciliation enqueue failed"); return { status: "failed" } } }
  schedule("0 0 * * *", cleanup)
  schedule("0 15 * * *", reconcile)
  return { run, cleanup, reconcile }
}
