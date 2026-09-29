import { AnalyticsApiError } from "./errors.js";
import { baseMeta } from "./meta.js";
import { queryAnalytics, activeGeneration } from "./query-service.js";
import { compileFiltersOnly, compileQuery } from "./query-compiler.js";
import contracts from "../../../../../analytics-shared/contracts.cjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const { assertSafeAnalysisConfig, QUERY_BUDGET, MASKING_VERSION, SCHEMA_VERSION, } = contracts;

const TYPES = new Set([
  "aggregate_csv",
  "detail_csv",
  "aggregate_png",
  "aggregate_pdf",
  "aggregate_pptx",
  "profile_pdf",
]);
const AGGREGATE_RENDER_TYPES = new Set([
  "aggregate_png",
  "aggregate_pdf",
  "aggregate_pptx",
]);
const artifacts = new Map(); // Development fallback; the file store is the restart-safe path.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secret() {
  const value =
    process.env.DIRECTUS_SECRET ||
    process.env.SECRET || // compose meneruskan DIRECTUS_SECRET sebagai SECRET ke container Directus
    process.env.NUXT_SESSION_POLICY_SECRET;
  if (!value && process.env.NODE_ENV === "production")
    throw new Error("DIRECTUS_SECRET is required for export signatures");
  return value || "analytics-development-secret";
}
function signDownload(jobId, owner, expires) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${jobId}.${owner}.${expires}`)
    .digest("base64url");
}
function verifyDownload(jobId, owner, expires, signature) {
  const expiry = Number(expires);
  if (
    !Number.isSafeInteger(expiry) ||
    expiry <= Date.now() ||
    expiry > Date.now() + 24 * 60 * 60 * 1000 + 60_000 ||
    !signature
  )
    return false;
  const expected = signDownload(jobId, owner, expiry);
  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csvFor(result) {
  const rows = result?.data?.groups || [];
  const metricLabel = result?.data?.metric?.label || "Jumlah UMKM";
  return Buffer.from(
    "\ufeff" +
      ["Kelompok", metricLabel, "Bagian dari total terfilter"]
        .map(csvCell)
        .join(",") +
      "\r\n" +
      rows
        .map(
          (row) =>
            [row.label, row.value, `${row.share || 0}%`]
              .map(csvCell)
              .join(",") + "\r\n",
        )
        .join(""),
  );
}
function extension(type) {
  return type.endsWith("csv")
    ? "csv"
    : type.endsWith("png")
      ? "png"
      : type.endsWith("pptx")
        ? "pptx"
        : "pdf";
}
function contentType(type) {
  return type.endsWith("csv")
    ? "text/csv; charset=utf-8"
    : type.endsWith("png")
      ? "image/png"
      : type.endsWith("pptx")
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/pdf";
}
function safePart(value) {
  return (
    String(value || "system")
      .replace(/[^a-z0-9_-]/gi, "")
      .slice(0, 80) || "system"
  );
}
function artifactKey(owner, jobId, type) {
  return `exports/${safePart(owner)}/${jobId}.${extension(type)}`;
}
function artifactRoot() {
  return process.env.ANALYTICS_EXPORT_DIR || "/tmp/diskuk-analytics-exports";
}
function artifactPath(key) {
  const normalized = String(key).replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "..")
  )
    throw new AnalyticsApiError(500, "EXPORT_STORAGE_ERROR");
  return path.join(artifactRoot(), normalized);
}
async function writeArtifact(key, body) {
  const file = artifactPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  artifacts.set(key, { body, contentType: "application/octet-stream" });
}
async function readArtifact(key) {
  try {
    return await fs.readFile(artifactPath(key));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return artifacts.get(key)?.body || null;
  }
}
function parseRequest(value) {
  return typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      })()
    : value || {};
}

async function registry(database) {
  const result = await database.raw(
    "SELECT id,semantic_id,lifecycle_status FROM analitik_field",
  );
  return result.rows ?? result[0] ?? [];
}
async function estimateDetail(database, config, operator) {
  const generation = await activeGeneration(database);
  if (!generation) throw new AnalyticsApiError(503, "NO_ACTIVE_GENERATION");
  const filters = compileFiltersOnly(
    {
      ...config,
      groupBy: config.groupBy || "kota_nama",
      metric: "jumlah_umkm",
      schemaVersion: SCHEMA_VERSION,
    },
    await registry(database),
    operator,
  );
  const result = await database.raw(
    `SELECT COUNT(*)::integer AS count FROM analitik_usaha_current a WHERE a.generation_id=? AND ${filters.whereSql}`,
    [generation.id, ...filters.params],
  );
  return {
    count: Number((result.rows ?? result[0] ?? [])[0]?.count || 0),
    generationId: generation.id,
  };
}
async function insertJob(
  database,
  { owner, type, status = "queued", request = {} },
) {
  const result = await database.raw(
    `INSERT INTO analitik_job(job_type,dedupe_key,status,owner,request,schema_version,masking_version,export_type,max_attempts) VALUES ('export',?,?,?,?,?,?,?,5) RETURNING id`,
    [
      `export:${owner}:${crypto.randomUUID()}`,
      status,
      owner,
      JSON.stringify(request),
      SCHEMA_VERSION,
      MASKING_VERSION,
      type,
    ],
  );
  return (result.rows ?? result[0] ?? [])[0]?.id || crypto.randomUUID();
}
async function updateRequest(database, id, request, status) {
  await database.raw(
    "UPDATE analitik_job SET request=?,status=?,updated_at=NOW() WHERE id=?",
    [JSON.stringify(request), status, id],
  );
}

async function submitExport(database, request, owner, operator) {
  const type = request?.exportType || request?.type;
  if (!TYPES.has(type)) throw new AnalyticsApiError(400, "EXPORT_TYPE_INVALID");
  // Snapshot scope pemanggil ikut disimpan; unduhan membandingkannya lagi (B36).
  const permissionScope = request?.permissionScope;
  // Judul dokumen dari pemanggil; worker merender PDF/PNG dengan judul ini (B26).
  const title = typeof request?.title === "string" ? request.title.trim().slice(0, 120) : "";
  const judul = title ? { title } : {};
  const config = assertSafeAnalysisConfig({
    ...request?.config,
    schemaVersion: request?.config?.schemaVersion || SCHEMA_VERSION,
  });
  const ownerId = String(owner || "");
  if (!ownerId) throw new AnalyticsApiError(401, "UNAUTHENTICATED");
  if (type === "profile_pdf" && !UUID.test(String(request?.profileId || "")))
    throw new AnalyticsApiError(400, "PROFILE_ID_INVALID");
  if (AGGREGATE_RENDER_TYPES.has(type)) {
    // Worker mengompilasi ulang config klien ini dengan operator dari snapshot
    // `permissionScope` (K14); validasi di sini memakai compiler yang sama supaya
    // config yang tak bisa dikompilasi gagal 4xx sebelum job dibuat (B02).
    compileQuery(config, await registry(database), operator);
  }

  if (type === "detail_csv") {
    const estimate = await estimateDetail(database, config, operator);
    if (estimate.count > QUERY_BUDGET.detailExportRows)
      throw new AnalyticsApiError(422, "EXPORT_LIMIT");
    const jobId = await insertJob(database, {
      owner: ownerId,
      type,
      request: {
        config,
        // `rowEstimate`, bukan `estimatedRows`: trigger `analitik_job` menolak kunci ber-`rows`.
        rowEstimate: estimate.count,
        generationId: estimate.generationId,
        permissionScope,
        ...judul,
      },
    });
    return {
      __status: 202,
      body: {
        meta: baseMeta({
          status: "processing",
          population: estimate.count,
          matched: estimate.count,
          coverage: { matched: estimate.count, total: estimate.count },
          warnings: [],
        }),
        data: { jobId, status: "queued", type, estimatedRows: estimate.count },
      },
    };
  }

  if (type === "aggregate_csv") {
    let jobId;
    try {
      const result = await queryAnalytics(database, config, { operator });
      jobId = await insertJob(database, {
        owner: ownerId,
        type,
        status: "processing",
        request: { config, permissionScope, ...judul },
      });
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const key = artifactKey(ownerId, jobId, type);
      await writeArtifact(key, csvFor(result));
      await updateRequest(
        database,
        jobId,
        {
          config,
          permissionScope,
          ...judul,
          artifact: {
            key,
            contentType: contentType(type),
            rowCount: result.data.groups.length,
            expiresAt: new Date(expiresAt).toISOString(),
          },
        },
        "completed",
      );
      const sig = signDownload(jobId, ownerId, expiresAt);
      return {
        body: {
          meta: result.meta,
          data: {
            jobId,
            status: "completed",
            type,
            rowCount: result.data.groups.length,
            expiresAt: new Date(expiresAt).toISOString(),
            downloadUrl: `/panel/v1/analytics/analysis/exports/${jobId}/download?expires=${expiresAt}&sig=${sig}`,
          },
        },
      };
    } catch (error) {
      if (jobId)
        await updateRequest(
          database,
          jobId,
          { config, permissionScope, ...judul, error: "Ekspor gagal" },
          "dead",
        ).catch(() => {});
      throw error instanceof AnalyticsApiError
        ? error
        : new AnalyticsApiError(500, "EXPORT_FAILED");
    }
  }

  const requestPayload = { config, permissionScope, ...judul };
  if (type === "profile_pdf")
    requestPayload.profileId = String(request.profileId);
  const jobId = await insertJob(database, {
    owner: ownerId,
    type,
    request: requestPayload,
  });
  return {
    __status: 202,
    body: {
      meta: baseMeta({ status: "processing", warnings: [] }),
      data: { jobId, status: "queued", type },
    },
  };
}

async function getExportStatus(database, jobId, owner, isAdmin = false) {
  const result = await database.raw(
    `SELECT id,owner,status,export_type,request,created_at,updated_at,error_code FROM analitik_job WHERE id=? ${isAdmin ? "" : "AND owner=?"} AND job_type='export'`,
    isAdmin ? [jobId] : [jobId, owner],
  );
  const row = (result.rows ?? result[0] ?? [])[0];
  if (!row) throw new AnalyticsApiError(404, "EXPORT_NOT_FOUND");
  const request = parseRequest(row.request);
  const artifact = request.artifact;
  const expiresAt = artifact?.expiresAt || null;
  const expired =
    row.status === "expired" ||
    (expiresAt && new Date(expiresAt).getTime() <= Date.now());
  const status = expired
    ? "expired"
    : row.status === "dead"
      ? "failed"
      : row.status;
  const downloadUrl =
    status === "completed" && artifact?.key && expiresAt
      ? `/panel/v1/analytics/analysis/exports/${row.id}/download?expires=${Date.parse(expiresAt)}&sig=${signDownload(row.id, String(row.owner), Date.parse(expiresAt))}`
      : undefined;
  return {
    meta: baseMeta({
      status: expired ? "stale_last_good" : "current",
      warnings: [],
    }),
    data: {
      jobId: row.id,
      type: row.export_type,
      status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rowCount: artifact?.rowCount ?? null,
      error: row.error_code ? "Ekspor gagal. Silakan coba lagi." : null,
      expiresAt,
      downloadUrl,
    },
  };
}

async function downloadExport(
  database,
  jobId,
  owner,
  query,
  res,
  isAdmin = false,
  permissionScope,
) {
  const result = await database.raw(
    `SELECT id,owner,status,export_type,request FROM analitik_job WHERE id=? ${isAdmin ? "" : "AND owner=?"} AND job_type='export'`,
    isAdmin ? [jobId] : [jobId, owner],
  );
  const row = (result.rows ?? result[0] ?? [])[0];
  if (!row) throw new AnalyticsApiError(404, "EXPORT_NOT_FOUND");
  const request = parseRequest(row.request);
  // Fail-closed: scope disimpan saat submit, dan unduhan menolak bila peran/wilayah pemanggil
  // sudah berbeda (B36) — termasuk job lama yang belum punya snapshot.
  if (request.permissionScope !== permissionScope)
    throw new AnalyticsApiError(403, "DOWNLOAD_FORBIDDEN");
  const artifact = request.artifact;
  if (
    row.status !== "completed" ||
    !artifact ||
    !verifyDownload(jobId, String(row.owner), query?.expires, query?.sig)
  )
    throw new AnalyticsApiError(
      row.status === "expired" ? 410 : 403,
      row.status === "expired" ? "EXPORT_EXPIRED" : "DOWNLOAD_FORBIDDEN",
    );
  if (new Date(artifact.expiresAt).getTime() <= Date.now())
    throw new AnalyticsApiError(410, "EXPORT_EXPIRED");
  const body = await readArtifact(artifact.key);
  if (!body) throw new AnalyticsApiError(410, "EXPORT_EXPIRED");
  res.setHeader?.("Cache-Control", "private, no-store");
  res.setHeader?.(
    "Content-Type",
    artifact.contentType || contentType(row.export_type),
  );
  res.setHeader?.(
    "Content-Disposition",
    `attachment; filename="analitik-${jobId}.${extension(row.export_type)}"`,
  );
  res.end(body);
}

export { TYPES, artifacts, signDownload, verifyDownload, submitExport, getExportStatus, downloadExport, csvFor, estimateDetail, artifactKey };
