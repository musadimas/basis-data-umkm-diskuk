import { routeGuard } from "../../lib/utils/auth.js";
import { OperatorError, resolveOperator } from "../../lib/utils/operator.js";
import { correlation } from "./meta.js";
import { AnalyticsApiError, sendError } from "./errors.js";
import { assertUsahaInScope, permissionScopeOf, scopeAnalysisRequest, } from "./scope.js";
import { getMetadata, getOptions } from "./metadata.js";
import { listTemplates } from "./templates.js";
import { getStatus } from "./status-service.js";
import { queryAnalytics } from "./query-service.js";
import { listRecords } from "./records-service.js";
import { getProfile, UUID } from "./profile-service.js";
import { submitExport, getExportStatus, downloadExport, } from "./exports-service.js";
const signals = { requests: 0, errors: 0, timeouts: 0, durations: [] };
/**
 * Error resolver/guard wilayah harus AnalyticsApiError: `sanitizedError` di errors.js
 * hanya mempertahankan tipe itu, tipe lain diratakan menjadi 500.
 */
async function resolveScopedOperator(database, accountability) {
  try {
    return await resolveOperator(database, accountability);
  } catch (error) {
    if (error instanceof OperatorError) {
      throw new AnalyticsApiError(error.statusCode, error.code, error.message);
    }
    throw error;
  }
}
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
    wrap(req, res, next, async () =>
      getOptions(
        database,
        req.query || {},
        await resolveScopedOperator(database, req.accountability),
      ),
    ),
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
    wrap(req, res, next, async () => {
      const operator = await resolveScopedOperator(database, req.accountability);
      return queryAnalytics(database, scopeAnalysisRequest(jsonBody(req), operator), {
        user: req.accountability?.user,
        permissionScope: permissionScopeOf(operator),
      });
    }),
  );
  router.post("/records", (req, res, next) =>
    wrap(req, res, next, async () => {
      const operator = await resolveScopedOperator(database, req.accountability);
      return listRecords(database, scopeAnalysisRequest(jsonBody(req), operator), {
        user: req.accountability?.user,
      });
    }),
  );
  router.get("/umkm/:id", (req, res, next) =>
    wrap(req, res, next, async () => {
      const id = req.params?.id;
      // Id tidak valid ditolak lebih dulu supaya tidak ada akses database sama sekali.
      if (!UUID.test(String(id ?? ""))) {
        throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
      }
      const operator = await resolveScopedOperator(database, req.accountability);
      await assertUsahaInScope(database, id, operator);
      return getProfile(database, id, operator);
    }),
  );
  router.post("/exports", (req, res, next) =>
    wrap(req, res, next, async () => {
      const operator = await resolveScopedOperator(database, req.accountability);
      const body = jsonBody(req);
      // Config ekspor tidak boleh menyebut kota lain; profile_pdf juga dibatasi wilayahnya.
      if ((body.exportType ?? body.type) === "profile_pdf") {
        await assertUsahaInScope(database, body.profileId, operator);
      }
      return submitExport(
        database,
        { ...body, config: scopeAnalysisRequest(body.config ?? {}, operator) },
        req.accountability.user,
      );
    }),
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
