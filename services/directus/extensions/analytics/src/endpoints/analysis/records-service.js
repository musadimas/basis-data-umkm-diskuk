import { withBudgetTransaction } from "./query-budget.js";
import { AnalyticsApiError } from "./errors.js";
import { baseMeta } from "./meta.js";
import { compileFiltersOnly } from "./query-compiler.js";
import { resolveAnalyticsSourceCached } from "./source-service.js";
import { loadRegistryCached, __resetRuntimeCachesForTests, } from "./runtime-cache.js";
import crypto from "node:crypto";
const rateWindowMs = 60_000;
const maxPerMinute = 30;
const maxConcurrent = 2;
const rateMap = new Map();
const concurrencyMap = new Map();

function checkRateLimit(user) {
  if (!user) return;
  const now = Date.now();
  const entry = rateMap.get(user);
  if (!entry || now - entry.windowStart >= rateWindowMs) {
    rateMap.set(user, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= maxPerMinute)
    throw new AnalyticsApiError(429, "RATE_LIMITED");
  entry.count += 1;
}
function enterConcurrency(user) {
  if (!user) return () => {};
  const cur = concurrencyMap.get(user) || 0;
  if (cur >= maxConcurrent)
    throw new AnalyticsApiError(429, "CONCURRENCY_LIMITED");
  concurrencyMap.set(user, cur + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const after = (concurrencyMap.get(user) || 1) - 1;
    if (after <= 0) concurrencyMap.delete(user);
    else concurrencyMap.set(user, after);
  };
}
function __resetBudgetForTests() {
  rateMap.clear();
  concurrencyMap.clear();
  __resetRuntimeCachesForTests();
}

function secret() {
  return (
    process.env.DIRECTUS_SECRET ||
    process.env.NUXT_SESSION_POLICY_SECRET ||
    "analytics-development-secret"
  );
}
function signCursor(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}
function decodeCursor(value) {
  if (!value) return null;
  const parts = String(value).split(".");
  const [body, sig] = parts;
  if (parts.length !== 2 || !body || !sig)
    throw new AnalyticsApiError(400, "CURSOR_INVALID");
  const expected = crypto
    .createHmac("sha256", secret())
    .update(body)
    .digest("base64url");
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    throw new AnalyticsApiError(400, "CURSOR_INVALID");
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new AnalyticsApiError(400, "CURSOR_INVALID");
  }
}

async function listRecords(database, request, opts = {}) {
  const user = opts.user || request?.user || null;
  if (user) checkRateLimit(String(user));
  const release = enterConcurrency(user ? String(user) : null);
  try {
    const registry = await loadRegistryCached(database);
    const source = await resolveAnalyticsSourceCached(database);
    if (!source)
      throw new AnalyticsApiError(
        503,
        "NO_PUBLISHED_SNAPSHOT",
        "Data sedang disiapkan. Silakan coba lagi.",
      );
    const rawPageSize = Number(request.pageSize ?? 20);
    if (!Number.isInteger(rawPageSize) || rawPageSize < 1)
      throw new AnalyticsApiError(422, "QUERY_COMPLEXITY");
    const pageSize = Math.min(rawPageSize, 100);
    const cursor = decodeCursor(request.cursor);
    const filters = compileFiltersOnly(
      {
        schemaVersion: 1,
        metric: "jumlah_umkm",
        groupBy: "kota_nama",
        filters: request.filters || [],
      },
      registry,
    );
    const sort = request.sort === "nama" ? "a.nama" : "a.usaha_id";
    const cursorClause = cursor
      ? sort === "a.nama"
        ? "AND (a.nama,a.usaha_id) > (?,?)"
        : "AND a.usaha_id > ?"
      : "";
    const cursorParams = cursor
      ? sort === "a.nama"
        ? [cursor.name, cursor.id]
        : [cursor.id]
      : [];
    let rows;
    try {
      const result = await withBudgetTransaction(database, (trx) =>
        trx.raw(
          `SELECT a.usaha_id AS id,a.nama,a.skala,a.kota_nama AS kota,a.kecamatan_nama AS kecamatan,a.kode_kbli AS kbli,a.kategori_kbli AS kategori,a.status FROM ${source.fromSql} WHERE ${source.scopeSql} AND ${filters.whereSql} ${cursorClause} ORDER BY ${sort} ASC,a.usaha_id ASC LIMIT ?`,
          [
            ...source.scopeParams,
            ...filters.params,
            ...cursorParams,
            pageSize + 1,
          ],
        ),
      );
      rows = result.rows ?? [];
    } catch (error) {
      if (error?.code === "57014" || error?.code === "55P03")
        throw new AnalyticsApiError(504, "QUERY_TIMEOUT");
      throw error;
    }
    const hasNext = rows.length > pageSize;
    const visible = rows
      .slice(0, pageSize)
      .map((row) => ({
        id: row.id,
        nama: row.nama,
        skala: row.skala || "unknown",
        kota: row.kota || "Tidak diketahui",
        kecamatan: row.kecamatan || "Tidak diketahui",
        kbli: row.kbli || "Tidak diketahui",
        kategori: row.kategori || "Tidak diketahui",
        status: row.status,
      }));
    const last = visible.at(-1);
    return {
      meta: baseMeta({
        dataAsOf: source.dataAsOf,
        status: source.status,
        population: visible.length,
        matched: visible.length,
        warnings: source.warnings,
      }),
      data: {
        records: visible,
        nextCursor:
          hasNext && last
            ? signCursor(
                sort === "a.nama"
                  ? { name: last.nama, id: last.id }
                  : { id: last.id },
              )
            : null,
      },
    };
  } finally {
    release();
  }
}

export { listRecords, signCursor, decodeCursor, __resetBudgetForTests };
