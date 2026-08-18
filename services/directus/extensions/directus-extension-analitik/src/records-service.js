const crypto = require("node:crypto");
const { AnalyticsApiError } = require("./errors.js");
const { baseMeta } = require("./meta.js");
const { compileFiltersOnly } = require("./query-compiler.js");
const { resolveAnalyticsSource } = require("./source-service.js");

function secret() { return process.env.DIRECTUS_SECRET || process.env.NUXT_SESSION_POLICY_SECRET || "analytics-development-secret"; }
function signCursor(payload) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url"); return `${body}.${sig}`; }
function decodeCursor(value) {
  if (!value) return null;
  const parts = String(value).split(".");
  const [body, sig] = parts;
  if (parts.length !== 2 || !body || !sig) throw new AnalyticsApiError(400, "CURSOR_INVALID");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new AnalyticsApiError(400, "CURSOR_INVALID");
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new AnalyticsApiError(400, "CURSOR_INVALID"); }
}

async function listRecords(database, request) {
  const registry = (await database.raw(`SELECT id,semantic_id,lifecycle_status FROM analitik_field`)).rows ?? [];
  const source = await resolveAnalyticsSource(database);
  if (!source) throw new AnalyticsApiError(503, "NO_PUBLISHED_SNAPSHOT", "Data sedang disiapkan. Silakan coba lagi.");
  const rawPageSize = Number(request.pageSize ?? 20);
  if (!Number.isInteger(rawPageSize) || rawPageSize < 1) throw new AnalyticsApiError(422, "QUERY_COMPLEXITY");
  const pageSize = Math.min(rawPageSize, 100);
  const cursor = decodeCursor(request.cursor);
  const filters = compileFiltersOnly({ schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: request.filters || [] }, registry);
  const sort = request.sort === "nama" ? "a.nama" : "a.usaha_id";
  const cursorClause = cursor ? (sort === "a.nama" ? "AND (a.nama,a.usaha_id) > (?,?)" : "AND a.usaha_id > ?") : "";
  const cursorParams = cursor ? (sort === "a.nama" ? [cursor.name, cursor.id] : [cursor.id]) : [];
  const result = await database.raw(`SELECT a.usaha_id AS id,a.nama,a.skala,a.kota_nama AS kota,a.kecamatan_nama AS kecamatan,a.kode_kbli AS kbli,a.kategori_kbli AS kategori,a.status FROM ${source.fromSql} WHERE ${source.scopeSql} AND ${filters.whereSql} ${cursorClause} ORDER BY ${sort} ASC,a.usaha_id ASC LIMIT ?`, [...source.scopeParams, ...filters.params, ...cursorParams, pageSize + 1]);
  const rows = result.rows ?? [];
  const hasNext = rows.length > pageSize;
  const visible = rows.slice(0, pageSize).map((row) => ({ id: row.id, nama: row.nama, skala: row.skala || "unknown", kota: row.kota || "Tidak diketahui", kecamatan: row.kecamatan || "Tidak diketahui", kbli: row.kbli || "Tidak diketahui", kategori: row.kategori || "Tidak diketahui", status: row.status }));
  const last = visible.at(-1);
  return {
    meta: baseMeta({ dataAsOf: source.dataAsOf, status: source.status, population: visible.length, matched: visible.length, warnings: source.warnings }),
    data: { records: visible, nextCursor: hasNext && last ? signCursor(sort === "a.nama" ? { name: last.nama, id: last.id } : { id: last.id }) : null },
  };
}

module.exports = { listRecords, signCursor, decodeCursor };
