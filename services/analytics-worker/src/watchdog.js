import { statfs } from "node:fs/promises";

export async function emitHeartbeat(pool, { service = "analytics-worker" } = {}) { await pool.query(`INSERT INTO analitik_health(health_kind,component,status,heartbeat_at,last_success_at,updated_at) VALUES ('component_status',$1,'healthy',NOW(),NOW(),NOW()) ON CONFLICT(health_kind,component) WHERE health_kind='component_status' DO UPDATE SET status='healthy',heartbeat_at=NOW(),last_success_at=NOW(),updated_at=NOW()`, [service]); }

// The 2026-08 disk-full incident (code 53100 "No space left on device") killed
// generation rebuilds and left the rollup cache stale, which degraded the
// analytics API into 504s. Guard the data directory so it cannot recur
// silently: report degraded below minFreePercent, critical below criticalPercent.
export async function inspectDiskUsage({ dataDir = "/var/lib/postgresql/data", minFreePercent = 15, criticalPercent = 5 } = {}) {
  const stats = await statfs(dataDir);
  const blockSize = Number(stats.bsize);
  const totalBytes = blockSize * Number(stats.blocks);
  const freeBytes = blockSize * Number(stats.bavail);
  const freePercent = totalBytes > 0 ? Number((freeBytes * 100 / totalBytes).toFixed(2)) : 0;
  const status = freePercent < criticalPercent ? "critical" : freePercent < minFreePercent ? "degraded" : "healthy";
  return { status, freePercent, freeGb: Math.round(freeBytes / 1e9 * 10) / 10 };
}

export async function inspectHealth(pool, { service = "analytics-worker" } = {}) {
  const backlog = await pool.query(`SELECT COALESCE(EXTRACT(EPOCH FROM (NOW()-MIN(available_at))),0)::integer AS age,COUNT(*)::integer AS count FROM analitik_job WHERE status IN ('queued','retry')`);
  const row = backlog.rows[0] || {};
  // The worker container shares the host filesystem with the Postgres data
  // directory via bind mount in dev; probing a path that may not exist inside
  // this container must fail open (skip the disk check) instead of crashing.
  let disk = null;
  try { disk = await inspectDiskUsage(); } catch { disk = null; }
  const queueStatus = Number(row.age) > 300 ? "degraded" : "healthy";
  const status = [queueStatus, disk?.status].filter(Boolean).includes("critical") ? "critical"
    : [queueStatus, disk?.status].filter(Boolean).includes("degraded") ? "degraded"
    : "healthy";
  await pool.query(`INSERT INTO analitik_health(health_kind,component,status,queue_age_seconds,check_data,updated_at) VALUES ('component_status',$1,$2,$3,$4::jsonb,NOW()) ON CONFLICT(health_kind,component) WHERE health_kind='component_status' DO UPDATE SET status=EXCLUDED.status,queue_age_seconds=EXCLUDED.queue_age_seconds,check_data=EXCLUDED.check_data,updated_at=NOW()`,
    [service, status, Number(row.age), JSON.stringify({ queued: Number(row.count), disk })]);
  return { status, age: Number(row.age), count: Number(row.count), disk };
}
