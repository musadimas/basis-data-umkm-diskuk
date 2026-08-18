const integer = (env, name, fallback, min, max) => { const value = Number.parseInt(env[name] ?? String(fallback), 10); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`); return value; };
export function loadConfig(env = process.env) {
  const databaseUrl = env.ANALYTICS_DATABASE_URL || env.DATABASE_URL;
  if (!databaseUrl) throw new Error("ANALYTICS_DATABASE_URL is required");
  return Object.freeze({ databaseUrl, pollMs: integer(env,"ANALYTICS_WORKER_POLL_MS", 1000, 100, 30_000), batchSize: integer(env,"ANALYTICS_WORKER_BATCH_SIZE", 25, 1, 100), concurrency: integer(env,"ANALYTICS_WORKER_CONCURRENCY", 2, 1, 8), leaseSeconds: integer(env,"ANALYTICS_WORKER_LEASE_SECONDS", 120, 30, 900), heartbeatSeconds: integer(env,"ANALYTICS_WORKER_HEARTBEAT_SECONDS", 30, 5, 120), maxBackfillBatch: integer(env,"ANALYTICS_WORKER_BACKFILL_BATCH", 50_000, 100, 50_000), serviceName: env.ANALYTICS_WORKER_SERVICE_NAME || "analytics-worker" });
}
export const config = () => loadConfig();
