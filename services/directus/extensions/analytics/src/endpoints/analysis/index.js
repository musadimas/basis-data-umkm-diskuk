import { routeGuard } from "../../lib/utils/auth.js";
import { correlation } from "./meta.js";
import { sendError } from "./errors.js";
import { getMetadata, getOptions } from "./metadata.js";
import { listTemplates } from "./templates.js";
import { getStatus } from "./status-service.js";
import { queryAnalytics } from "./query-service.js";
import { listRecords } from "./records-service.js";
import { getProfile } from "./profile-service.js";
import { submitExport, getExportStatus, downloadExport, } from "./exports-service.js";
const signals = { requests: 0, errors: 0, timeouts: 0, durations: [] };
function jsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}
/**
 * Response envelope: `data` is always the whole payload and `meta` travels inside it
 * (`{ meta, data: {...} }` -> `{ data: { ...data, meta } }`). The Directus SDK unwraps the
 * top-level `data` key, so anything left beside it would be lost to SDK clients.
 */
function envelope(payload) {
  if (!payload || typeof payload !== "object" || !("meta" in payload) || !("data" in payload)) return payload;
  const { data, meta, ...rest } = payload;
  const inner = data && typeof data === "object" && !Array.isArray(data) ? { ...data, meta } : { items: data, meta };
  return { ...rest, data: inner };
}
function finish(res, payload, requestId, status = 200) {
  res.setHeader?.("Cache-Control", "private, no-store");
  res.setHeader?.("X-Request-Id", requestId);
  res.status(status).json(envelope(payload));
}
function wrap(req, res, next, task) {
  if (!routeGuard(req, next)) return;
  const requestId = correlation(req);
  const started = Date.now();
  signals.requests++;
  Promise.resolve()
    .then(task)
    .then((result) => {
      signals.durations.push(Date.now() - started);
      if (signals.durations.length > 300) signals.durations.shift();
      const payload = result?.body ?? result;
      finish(res, payload, requestId, result?.__status || 200);
    })
    .catch((error) => {
      signals.errors++;
      if (error?.code === "57014") signals.timeouts++;
      finishError(res, error, requestId, next);
    });
}
function finishError(res, error, requestId, next) {
  const safe = error?.statusCode
    ? error
    : Object.assign(new Error("internal"), { statusCode: 500 });
  if (safe.statusCode) {
    sendError(res, safe, requestId);
  } else next(error);
}
// Mounted by the bundle entry "v1/analytics/analysis" (see package.json).
export default function registerAnalysisRoutes(router, { database }) {
  router.get("/metadata", (req, res, next) =>
    wrap(req, res, next, () => getMetadata(database)),
  );
  router.get("/metadata/options", (req, res, next) =>
    wrap(req, res, next, () => getOptions(database, req.query || {})),
  );
  router.get("/templates", (req, res, next) =>
    wrap(req, res, next, () => ({
      schemaVersion: 1,
      templates: listTemplates(),
    })),
  );
  router.get("/status", (req, res, next) =>
    wrap(req, res, next, () => getStatus(database)),
  );
  router.post("/query", (req, res, next) =>
    wrap(req, res, next, () =>
      queryAnalytics(database, jsonBody(req), {
        user: req.accountability?.user,
        permissionScope: req.accountability?.admin
          ? "admin"
          : req.accountability?.role,
      }),
    ),
  );
  router.post("/records", (req, res, next) =>
    wrap(req, res, next, () =>
      listRecords(database, jsonBody(req), {
        user: req.accountability?.user,
      }),
    ),
  );
  router.get("/umkm/:id", (req, res, next) =>
    wrap(req, res, next, () => getProfile(database, req.params?.id)),
  );
  router.post("/exports", (req, res, next) =>
    wrap(req, res, next, () =>
      submitExport(database, jsonBody(req), req.accountability.user),
    ),
  );
  router.get("/exports/:jobId", (req, res, next) =>
    wrap(req, res, next, () =>
      getExportStatus(
        database,
        req.params?.jobId,
        req.accountability.user,
        Boolean(req.accountability.admin),
      ),
    ),
  );
  router.get("/exports/:jobId/download", (req, res, next) => {
    if (!routeGuard(req, next)) return;
    const requestId = correlation(req);
    Promise.resolve(
      downloadExport(
        database,
        req.params?.jobId,
        req.accountability.user,
        req.query || {},
        res,
        Boolean(req.accountability.admin),
      ),
    ).catch((error) => sendError(res, error, requestId));
  });
  return {
    signals,
    flushSignals: async () => {
      if (!signals.requests) return;
      const values = [...signals.durations].sort((a, b) => a - b);
      const percentile = (p) =>
        values[Math.min(values.length - 1, Math.floor(values.length * p))] ||
        0;
      await database.raw(
        `INSERT INTO analitik_health(health_kind,component,status,api_p50_ms,api_p95_ms,api_p99_ms,request_count,error_count,timeout_count,updated_at) VALUES ('component_status','analytics_api','healthy',?,?,?,?,?, ?,NOW()) ON CONFLICT(health_kind,component) WHERE health_kind='component_status' DO UPDATE SET api_p50_ms=EXCLUDED.api_p50_ms,api_p95_ms=EXCLUDED.api_p95_ms,api_p99_ms=EXCLUDED.api_p99_ms,request_count=EXCLUDED.request_count,error_count=EXCLUDED.error_count,timeout_count=EXCLUDED.timeout_count,updated_at=NOW()`,
        [
          percentile(0.5),
          percentile(0.95),
          percentile(0.99),
          signals.requests,
          signals.errors,
          signals.timeouts,
        ],
      );
      signals.requests = 0;
      signals.errors = 0;
      signals.timeouts = 0;
      signals.durations = [];
    },
  };
}
