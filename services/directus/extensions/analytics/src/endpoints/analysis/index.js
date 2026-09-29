import cakupan from "../../../../../analytics-shared/cakupan.cjs";
import { OperatorError } from "../../lib/utils/operator.js";
import { correlation } from "./meta.js";
import { AnalyticsApiError, sendError } from "./errors.js";
import { assertUsahaInScope, permissionScopeOf, } from "./scope.js";
import { getMetadata, getOptions } from "./metadata.js";
import { listTemplates } from "./templates.js";
import { getStatus } from "./status-service.js";
import { queryAnalytics } from "./query-service.js";
import { listRecords } from "./records-service.js";
import { getProfile, UUID } from "./profile-service.js";
import { submitExport, getExportStatus, downloadExport, } from "./exports-service.js";

const { terjaga, publik } = cakupan;

// Seluruh bundel analytics hanya untuk dashboard provinsi/kabkota (DATA_ROLES);
// pendamping/umkm memakai endpoint operasional. Kandidat 01: gerbang peran di
// adapter, scope wilayah via compiler shared/assertUsahaInScope dari
// peran + kota pemanggil. GET /metadata, /templates, /status adalah
// pengecualian publik (DAFTAR_PUBLIK, data non-PII agregat).
const DATA = { peran: ["provinsi", "kabkota"] };

const signals = { requests: 0, errors: 0, timeouts: 0, durations: [] };

const operatorDariPemanggil = (pemanggil) => {
  if (
    pemanggil?.peran === "kabkota" &&
    pemanggil?.kotaId == null &&
    pemanggil?.admin !== true
  ) {
    throw new OperatorError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
  }
  return {
    userId: pemanggil?.id ?? null,
    role: pemanggil?.peran ?? null,
    kotaId: pemanggil?.kotaId ?? null,
    kotaNama: null,
    admin: pemanggil?.admin === true,
    usahaId: pemanggil?.usahaId ?? null,
  };
};

/**
 * Error resolver/guard wilayah harus AnalyticsApiError: `sanitizedError` di errors.js
 * hanya mempertahankan tipe itu, tipe lain diratakan menjadi 500.
 * Dipertahankan dari implementasi lama (yang memetakan resolveOperator);
 * kini sumbernya pemanggil dari adapter `terjaga`, bukan query operator.
 */
function resolveScopedOperator(pemanggil) {
  try {
    return operatorDariPemanggil(pemanggil);
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
// Kandidat 01: guard peran sudah di adapter `terjaga`/`publik` (muatPemanggil +
// wajibPeran, tanpa query tambahan di sini). Fungsi ini hanya mencatat sinyal,
// membungkus envelope, dan memetakan error config (B30) — jangan tambah gate di sini.
function wrap(req, res, task, next) {
  const requestId = correlation(req);
  const started = Date.now();
  signals.requests++;
  return Promise.resolve()
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
  // Config ekspor yang ditolak `assertSafeAnalysisConfig` adalah permintaan buruk, bukan
  // kegagalan server (B30): error itu membawa kode tetapi tidak membawa status HTTP.
  const safe = error?.statusCode
    ? error
    : error?.code === "INVALID_ANALYSIS_CONFIG"
      ? new AnalyticsApiError(400, "INVALID_ANALYSIS_CONFIG", error.message)
      : Object.assign(new Error("internal"), { statusCode: 500 });
  if (safe.statusCode) {
    sendError(res, safe, requestId);
  } else if (typeof next === "function") {
    next(error);
  } else {
    throw error;
  }
}
// Mounted by the bundle entry "v1/analytics/analysis" (see package.json).
export default function registerAnalysisRoutes(router, { database }) {
  router.get("/metadata", publik((ctx) => (req, res, next) =>
    wrap(req, res, () => getMetadata(ctx.database), next),
  )({ database }));
  router.get("/metadata/options", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, () =>
      getOptions(
        ctx.database,
        req.query || {},
        resolveScopedOperator(pemanggil),
      ),
    );
  })({ database }));
  router.get("/templates", publik(() => (req, res, next) =>
    wrap(req, res, () => ({
      schemaVersion: 1,
      templates: listTemplates(),
    }), next),
  )({ database }));
  router.get("/status", publik((ctx) => (req, res, next) =>
    wrap(req, res, () => getStatus(ctx.database), next),
  )({ database }));
  router.post("/query", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, () => {
      const operator = resolveScopedOperator(pemanggil);
      return queryAnalytics(ctx.database, jsonBody(req), {
        user: pemanggil.id,
        operator,
        permissionScope: permissionScopeOf(operator),
      });
    });
  })({ database }));
  router.post("/records", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, () => {
      const operator = resolveScopedOperator(pemanggil);
      return listRecords(ctx.database, jsonBody(req), {
        user: pemanggil.id,
        operator,
      });
    });
  })({ database }));
  router.get("/umkm/:id", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, async () => {
      const id = req.params?.id;
      // Id tidak valid ditolak lebih dulu supaya tidak ada akses database selain
      // lookup pemanggil milik adapter.
      if (!UUID.test(String(id ?? ""))) {
        throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
      }
      const operator = resolveScopedOperator(pemanggil);
      await assertUsahaInScope(ctx.database, id, operator);
      return getProfile(ctx.database, id, operator);
    });
  })({ database }));
  router.post("/exports", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, async () => {
      const operator = resolveScopedOperator(pemanggil);
      const body = jsonBody(req);
      // Config ekspor tidak boleh menyebut kota lain; profile_pdf juga dibatasi wilayahnya.
      if ((body.exportType ?? body.type) === "profile_pdf") {
        await assertUsahaInScope(ctx.database, body.profileId, operator);
      }
      return submitExport(
        ctx.database,
        {
          ...body,
          config: body.config ?? {},
          // Snapshot scope saat submit; unduhan menolak bila peran/wilayah pemanggil berubah (B36).
          permissionScope: permissionScopeOf(operator),
        },
        pemanggil.id,
        operator,
      );
    });
  })({ database }));
  router.get("/exports/:jobId", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    await wrap(req, res, () =>
      getExportStatus(
        ctx.database,
        req.params?.jobId,
        pemanggil.id,
        Boolean(pemanggil.admin),
      ),
    );
  })({ database }));
  router.get("/exports/:jobId/download", terjaga(DATA, (ctx) => async (req, res, pemanggil) => {
    const requestId = correlation(req);
    try {
      const operator = resolveScopedOperator(pemanggil);
      await downloadExport(
        ctx.database,
        req.params?.jobId,
        pemanggil.id,
        req.query || {},
        res,
        Boolean(pemanggil.admin),
        permissionScopeOf(operator),
      );
    } catch (error) {
      sendError(res, error, requestId);
    }
  })({ database }));
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
