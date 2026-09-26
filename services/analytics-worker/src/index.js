import { loadConfig } from "./config.js";
import { createPool, withTransaction } from "./db.js";
import { JobQueue } from "./queue.js";
import { JobPoller } from "./poller.js";
import { projectRecord } from "./projector.js";
import {
  rebuildCurrentModel,
  activateFinancialMetrics,
  reconcileActiveGeneration,
  cleanupOldGenerations,
} from "./rebuild.js";
import { syncRegistry } from "./registry.js";
import { createLogger } from "./logger.js";
import { emitHeartbeat, inspectHealth } from "./watchdog.js";
import { processExport, cleanupExpiredExports } from "./exporter.js";
import { createObjectStore } from "./storage.js";
const config = loadConfig();
const objectStore = createObjectStore();
const logger = createLogger(config.serviceName);
const pool = createPool(config.databaseUrl);
const queue = new JobQueue(pool, {
  leaseSeconds: config.leaseSeconds,
  batchSize: config.batchSize,
});
let stopping = false;
async function handle(job) {
  const leaseTimer = setInterval(
    () => queue.heartbeat(job.id).catch(() => {}),
    Math.max(10_000, Math.floor((config.leaseSeconds * 1000) / 3)),
  );
  try {
    if (job.job_type === "project_record_change")
      await withTransaction(pool, (client) => projectRecord(client, job));
    else if (
      job.job_type === "reconcile" &&
      job.request?.reason === "activate_financial_metrics"
    )
      await activateFinancialMetrics(pool, { logger });
    else if (job.job_type === "reconcile")
      await reconcileActiveGeneration(pool, { logger });
    else if (job.job_type === "rebuild_current_model")
      await rebuildCurrentModel(pool, {
        logger,
        batchSize: config.maxBackfillBatch,
      });
    else if (job.job_type === "registry_sync") await syncRegistry(pool, logger);
    else if (job.job_type === "export")
      await withTransaction(pool, (client) =>
        processExport(client, job, { store: objectStore }),
      );
    await queue.complete(job.id);
  } catch (error) {
    await queue.fail(job, error, logger);
  } finally {
    clearInterval(leaseTimer);
  }
}
const poller = new JobPoller({
  queue,
  concurrency: config.concurrency,
  pollMs: config.pollMs,
  handle,
  logger,
});
await emitHeartbeat(pool, { service: config.serviceName });
await syncRegistry(pool, logger).catch((error) =>
  logger.error("registry_sync_failed", {
    errorCode: error.code || "REGISTRY_FAILED",
  }),
);
await cleanupOldGenerations(pool, { retentionHours: 0 }).catch((error) =>
  logger.error("generation_cleanup_failed", {
    errorCode: error.code || "CLEANUP_FAILED",
  }),
);
const heartbeatTimer = setInterval(
  () => emitHeartbeat(pool, { service: config.serviceName }).catch(() => {}),
  config.heartbeatSeconds * 1000,
);
const healthTimer = setInterval(
  () => inspectHealth(pool, { service: config.serviceName }).catch(() => {}),
  30_000,
);
const exportCleanupTimer = setInterval(
  () => cleanupExpiredExports(pool, { store: objectStore }).catch(() => {}),
  60 * 60 * 1000,
);
const generationCleanupTimer = setInterval(
  () =>
    cleanupOldGenerations(pool).catch((error) =>
      logger.error("generation_cleanup_failed", {
        errorCode: error.code || "CLEANUP_FAILED",
      }),
    ),
  24 * 60 * 60 * 1000,
);
poller.start();
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  clearInterval(healthTimer);
  clearInterval(exportCleanupTimer);
  clearInterval(generationCleanupTimer);
  logger.info("shutdown_requested", { signal });
  const remaining = await poller.stop(110_000);
  await pool.end();
  process.exit(remaining ? 1 : 0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
