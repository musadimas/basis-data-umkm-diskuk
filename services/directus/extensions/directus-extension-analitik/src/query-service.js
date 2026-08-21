const { AnalyticsApiError } = require("./errors.js");
const { baseMeta } = require("./meta.js");
const { compileQuery } = require("./query-compiler.js");
const { resolveAnalyticsSourceCached } = require("./source-service.js");
const { QUERY_BUDGET } = require("../../../analytics-shared/contracts.cjs");
const { loadRegistryCached, __resetRuntimeCachesForTests } = require("./runtime-cache.js");

// In-process per-user rate + concurrency guard (single Directus instance per plan)
// 30 req/min/user, 2 concurrent queries/user
const rateWindowMs = 60_000;
const maxPerMinute = 30;
const maxConcurrent = 2;
const rateMap = new Map(); // user -> { count, windowStart }
const concurrencyMap = new Map(); // user -> current

function checkRateLimit(user) {
  if (!user) return;
  const now = Date.now();
  const entry = rateMap.get(user);
  if (!entry || now - entry.windowStart >= rateWindowMs) {
    rateMap.set(user, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= maxPerMinute) {
    throw new AnalyticsApiError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi dalam satu menit.");
  }
  entry.count += 1;
}

function enterConcurrency(user) {
  if (!user) return () => {};
  const cur = concurrencyMap.get(user) || 0;
  if (cur >= maxConcurrent) {
    throw new AnalyticsApiError(429, "CONCURRENCY_LIMITED", "Terlalu banyak query bersamaan. Coba lagi.");
  }
  concurrencyMap.set(user, cur + 1);
  let released = false;
  return () => {
    if (released) return; released = true;
    const after = (concurrencyMap.get(user) || 1) - 1;
    if (after <= 0) concurrencyMap.delete(user);
    else concurrencyMap.set(user, after);
  };
}

// For tests: reset limiters and runtime caches
function __resetBudgetForTests() { rateMap.clear(); concurrencyMap.clear(); __resetRuntimeCachesForTests(); }

async function activeGeneration(database) {
  const result = await database.raw(`SELECT g.id,g.status,g.data_as_of,g.reconciled_at FROM analitik_active_generation p JOIN analitik_generation g ON g.id=p.active_generation_id WHERE p.id=1`);
  return (result.rows ?? result[0] ?? [])[0];
}

function rowKey(row) { return `${row.group_key}|${row.breakdown_key ?? ""}`; }

async function querySnapshot(database, source, plan) {
  if (
    source.kind !== "snapshot"
    || plan.breakdown
    || plan.normalized.filters.length
  ) return null;

  const population = source.population;
  let rows;
  let unknown;
  if (["kota_id", "kota_kode", "kota_nama"].includes(plan.semantic)) {
    const codeResult = await database.raw("SELECT id::text AS id,kode,nama FROM kota");
    const references = new Map((codeResult.rows ?? []).map((row) => [String(row.id), row]));
    rows = source.regions.map((region) => ({
      key: plan.semantic === "kota_id"
        ? String(region.id)
        : plan.semantic === "kota_kode"
          ? (references.get(String(region.id))?.kode || "unknown")
          : (region.name || references.get(String(region.id))?.nama || "Tidak diketahui"),
      label: region.name || references.get(String(region.id))?.nama || "Tidak diketahui",
      value: Number(region.value || 0),
    }));
    unknown = source.regions.filter((region) => String(region.id) === "unknown" || region.name === "Tidak diketahui").reduce((sum, region) => sum + Number(region.value || 0), 0);
  } else if (plan.semantic === "skala_dilaporkan") {
    rows = [["micro", "Mikro", source.scales.mikro], ["small", "Kecil", source.scales.kecil], ["medium", "Menengah", source.scales.menengah]]
      .map(([key, label, value]) => ({ key, label, value: Number(value || 0) }))
      .filter((row) => row.value > 0);
    unknown = Math.max(0, population - rows.reduce((sum, row) => sum + row.value, 0));
    if (unknown) rows.push({ key: "unknown", label: "Tidak diketahui", value: unknown });
  } else return null;
  rows.sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));
  const overflow = rows.length > plan.limit ? rows.slice(plan.limit) : [];
  rows = rows.slice(0, plan.limit);
  const overflowValue = overflow.reduce((sum, row) => sum + row.value, 0);
  const groups = rows.map((row) => ({ ...row, share: population ? Number((row.value * 100 / population).toFixed(1)) : 0 }));
  if (overflowValue && plan.includeOthers) groups.push({ key: "others", label: "Lainnya", value: overflowValue, share: population ? Number((overflowValue * 100 / population).toFixed(1)) : 0 });
  return {
    meta: baseMeta({ dataAsOf: source.dataAsOf, status: source.status, population, matched: population, coverage: { matched: population, total: population, unknown }, warnings: source.warnings }),
    data: {
      metric: { key: plan.metricKey, label: plan.metric.label, aggregation: "count_distinct" },
      groups,
      normalizedFilters: plan.normalized,
      conservedTotal: groups.reduce((sum, group) => sum + group.value, 0) === population,
    },
  };
}

async function queryGenerationAggregate(database, source, plan) {
  if (
    source.kind !== "generation"
    || plan.breakdown
    || plan.normalized.filters.length
    || !["kota_id", "kota_kode", "kota_nama", "skala_dilaporkan"].includes(plan.semantic)
  ) return null;

  const column = plan.semantic === "skala_dilaporkan" ? "skala" : "kota_id";
  // ponytail: scan the existing compact dimension index; materialize per-generation aggregates if it outgrows the synchronous budget.
  const result = await withBudgetTransaction(database, (trx) => trx.raw(`
    WITH totals AS (
      SELECT ${column} AS dimension_value, COUNT(*)::bigint AS value
      FROM analitik_usaha_current
      WHERE generation_id=?
      GROUP BY ${column}
    ), archived AS (
      SELECT ${column} AS dimension_value, COUNT(*)::bigint AS value
      FROM analitik_usaha_current
      WHERE generation_id=? AND status='archived'
      GROUP BY ${column}
    )
    SELECT totals.dimension_value, (totals.value-COALESCE(archived.value,0))::integer AS value
    FROM totals
    LEFT JOIN archived ON archived.dimension_value IS NOT DISTINCT FROM totals.dimension_value
    WHERE totals.value>COALESCE(archived.value,0)
  `, [source.generationId, source.generationId]));
  const rows = result.rows ?? [];
  const population = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const aggregateSource = { ...source, kind: "snapshot", population, regions: [], scales: {} };
  if (column === "kota_id") {
    aggregateSource.regions = rows.map((row) => ({ id: row.dimension_value ?? "unknown", value: row.value }));
  } else {
    const values = new Map(rows.map((row) => [String(row.dimension_value ?? "unknown"), Number(row.value || 0)]));
    aggregateSource.scales = { mikro: values.get("micro") || 0, kecil: values.get("small") || 0, menengah: values.get("medium") || 0 };
  }
  return querySnapshot(database, aggregateSource, plan);
}

// Shared shaping for generation-model responses (single-scan path and the
// per-generation rollup fast path below).
function finalizeGenerationGroups({ rows, plan, source, matched, population }) {
  const overflow = rows.length > plan.limit ? rows.slice(plan.limit) : [];
  const limited = rows.slice(0, plan.limit);
  const overflowValue = overflow.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const groups = limited.map((row) => {
    const group = {
      key: String(row.group_key),
      label: row.group_label || "Tidak diketahui",
      value: Number(row.value || 0),
      share: matched ? Number((Number(row.value || 0) * 100 / matched).toFixed(1)) : 0,
    };
    if (plan.breakdown) group.breakdown = { key: String(row.breakdown_key), label: row.breakdown_label || "Tidak diketahui" };
    return group;
  });
  if (overflowValue && plan.includeOthers) groups.push({ key: "others", label: "Lainnya", value: overflowValue, share: matched ? Number((overflowValue * 100 / matched).toFixed(1)) : 0 });
  const unknown = groups.filter((group) => group.key === "unknown" || group.label === "Tidak diketahui" || group.label === "Tidak ada kode" || group.label === "Tidak terpetakan").reduce((sum, group) => sum + group.value, 0);
  return {
    meta: baseMeta({ dataAsOf: source.dataAsOf, status: source.status, population, matched, coverage: { matched, total: population, unknown }, warnings: source.warnings }),
    data: {
      metric: { key: plan.metricKey, label: plan.metric.label, aggregation: "count_distinct" },
      groups,
      normalizedFilters: plan.normalized,
      conservedTotal: groups.reduce((sum, group) => sum + group.value, 0) === matched,
    },
  };
}

// Dimensions pre-aggregated per generation by the analytics worker into
// analitik_dim_aggregate. Serves unfiltered single-dimension GROUP BYs from a
// bounded indexed lookup instead of scanning the fact table; expressions are
// kept aligned with DIMENSIONS in query-compiler.js (see DIM_AGGREGATE_SQL).
const ROLLUP_DIMENSIONS = new Set([
  "kota_id", "kota_kode", "kota_nama", "kecamatan_id", "kecamatan_nama",
  "kelurahan_id", "kelurahan_nama", "sektor_kbli", "kbli_kode",
  "skala_dilaporkan", "status_hukum", "status_usaha", "quality_geography", "quality_kbli",
]);

async function queryGenerationRollup(database, source, plan) {
  if (source.kind !== "generation" || plan.breakdown || plan.normalized.filters.length) return null;
  if (!ROLLUP_DIMENSIONS.has(plan.semantic)) return null;
  let rows;
  try {
    const result = await withBudgetTransaction(database, (trx) => trx.raw(
      // Default scope is active-only: subtract archived counts exactly like
      // the live aggregate path does.
      `SELECT dimension_value,label,SUM(CASE WHEN status='archived' THEN 0 ELSE value END)::bigint AS value FROM analitik_dim_aggregate WHERE generation_id=? AND dimension=? GROUP BY dimension_value,label`,
      [source.generationId, plan.semantic]));
    rows = result.rows ?? [];
  } catch (error) {
    if (error?.code === "57014" || error?.code === "55P03") throw new AnalyticsApiError(504, "QUERY_TIMEOUT", "Query melebihi batas waktu. Coba filter yang lebih spesifik.");
    if (error?.code === "42P01") return null; // rollup table not migrated yet – fall through
    throw error;
  }
  if (!rows.length) return null; // generation predates rollup population – fall through
  const groups = rows.map((row) => ({ group_key: row.dimension_value, group_label: row.label, value: Number(row.value || 0) }));
  const matched = groups.reduce((sum, group) => sum + group.value, 0);
  const population = source.activeRowCount != null ? source.activeRowCount : matched;
  return finalizeGenerationGroups({ rows: groups, plan, source, matched, population });
}

async function withBudgetTransaction(database, fn) {
  if (typeof database.transaction === "function") {
    return database.transaction(async (trx) => {
      // Fail-closed: if budget cannot be enforced, abort the request rather than run unbounded
      await trx.raw(`SET LOCAL statement_timeout = '${QUERY_BUDGET.statementTimeoutMs}ms'`);
      await trx.raw(`SET LOCAL lock_timeout = '${QUERY_BUDGET.lockTimeoutMs}ms'`);
      await trx.raw(`SET TRANSACTION READ ONLY`);
      return fn(trx);
    });
  }
  // Fallback for test mocks without transaction support
  return fn(database);
}

async function queryAnalytics(database, request, opts = {}) {
  const user = opts.user || request?.user || null;
  // Rate + concurrency guards (in-process, per plan single instance without Redis)
  if (user) {
    checkRateLimit(String(user));
  }
  const releaseConcurrency = enterConcurrency(user ? String(user) : null);
  try {
    const source = await resolveAnalyticsSourceCached(database);
    if (!source) throw new AnalyticsApiError(503, "NO_PUBLISHED_SNAPSHOT", "Data sedang disiapkan. Silakan coba lagi.");
    const registry = await loadRegistryCached(database);
    const plan = compileQuery(request, registry);
    const snapshotResponse = await querySnapshot(database, source, plan) ?? await queryGenerationRollup(database, source, plan) ?? await queryGenerationAggregate(database, source, plan);
    if (snapshotResponse) return snapshotResponse;
    const scopedWhere = `${source.scopeSql} AND ${plan.whereSql}`;
    const params = [...source.scopeParams, ...plan.params];

    let rows;
    let matched;
    try {
      // Single scan serves both the GROUP BY and the exact matched total:
      // SUM(COUNT(*)) OVER () folds COUNT(*) across every group of the same
      // WHERE pass, halving fact-table I/O versus the previous two statements.
      // COUNT(*) is safe for the generation model (PK guarantees 1 row per usaha).
      const orderSql = plan.breakdown ? "value DESC, group_key ASC, breakdown_key ASC" : "value DESC, group_key ASC";
      rows = (await withBudgetTransaction(database, async (trx) => (await trx.raw(`
        SELECT group_key, group_label${plan.breakdown ? ", breakdown_key, breakdown_label" : ""}, value::integer AS value, matched::integer AS matched FROM (
          SELECT ${plan.aggregateSelectSql}, COUNT(*)::bigint AS value, SUM(COUNT(*)) OVER ()::bigint AS matched
          FROM ${source.fromSql} WHERE ${scopedWhere}
          GROUP BY ${plan.groupBySql}
        ) g
        ORDER BY ${orderSql}
        LIMIT ?
      `, [...params, plan.limit + 1])).rows ?? []));
      matched = Number(rows[0]?.matched ?? 0);
    } catch (error) {
      if (error?.code === "57014" || error?.code === "55P03" || error instanceof AnalyticsApiError && error.code === "QUERY_TIMEOUT") throw new AnalyticsApiError(504, "QUERY_TIMEOUT", "Query melebihi batas waktu. Coba filter yang lebih spesifik.");
      if (error instanceof AnalyticsApiError) throw error;
      if (error?.statusCode === 429) throw error;
      throw error;
    }

    // Population uses generation active/archived counts when available – fail to extra COUNT if not
    // Resolve status filter via registry (fieldId may be UUID)
    function isStatusField(fieldId) {
      const reg = registry.find((r) => r.id === fieldId || r.semantic_id === fieldId);
      return reg?.semantic_id === "status_usaha";
    }
    const statusFilter = plan.normalized.filters.find((f) => isStatusField(f.fieldId ?? f.field));
    let population;
    const hasStatusFilter = Boolean(statusFilter);
    if (!hasStatusFilter) {
      // Default query is active only
      if (source.activeRowCount != null) {
        population = source.activeRowCount;
      } else if (source.rowCount != null) {
        // Legacy schema without active count – need accurate COUNT to avoid archived bias
        try {
          const popRes = await withBudgetTransaction(database, (trx) => trx.raw(`SELECT COUNT(*)::integer AS count FROM ${source.fromSql} WHERE ${source.scopeSql} AND a.status='active'`, source.scopeParams));
          population = Number((popRes.rows ?? [])[0]?.count ?? matched);
        } catch (error) {
          if (error?.code === "57014" || error?.code === "55P03") throw new AnalyticsApiError(504, "QUERY_TIMEOUT");
          throw error;
        }
      } else {
        population = matched;
      }
    } else {
      // Explicit status filter – use per-status generation stat when possible
      const val = statusFilter.value;
      const op = statusFilter.operator || "eq";
      if (op === "eq" && val === "active" && source.activeRowCount != null) {
        population = source.activeRowCount;
      } else if (op === "eq" && val === "archived" && source.archivedRowCount != null) {
        population = source.archivedRowCount;
      } else if (op === "in" && Array.isArray(val) && val.length === 1 && source.activeRowCount != null) {
        if (val[0] === "active") population = source.activeRowCount;
        else if (val[0] === "archived") population = source.archivedRowCount;
        else population = source.rowCount ?? matched;
      } else {
        // Fallback: count with same status filter but no other filters for population total
        // For correctness when archived rows exist and filter is not simple eq, run scoped count
        try {
          // Use the compiled whereSql that already includes status filter, but population should be total for that status
          // So we run COUNT with scopeSql + status clause alone, not full whereSql with other filters
          let statusClause = "a.status='active'";
          if (op === "eq" && typeof val === "string") statusClause = `a.status='${String(val).replace(/'/g, "''")}'`;
          else if (op === "neq" && typeof val === "string") statusClause = `a.status<>'${String(val).replace(/'/g, "''")}'`;
          else statusClause = plan.whereSql; // fallback to full filter (conservative)
          const popRes = await withBudgetTransaction(database, (trx) => trx.raw(`SELECT COUNT(*)::integer AS count FROM ${source.fromSql} WHERE ${source.scopeSql} AND ${statusClause}`, source.scopeParams));
          population = Number((popRes.rows ?? [])[0]?.count ?? matched);
        } catch (error) {
          if (error?.code === "57014" || error?.code === "55P03") throw new AnalyticsApiError(504, "QUERY_TIMEOUT");
          throw error;
        }
      }
    }

    return finalizeGenerationGroups({ rows, plan, source, matched, population });
  } finally {
    releaseConcurrency();
  }
}

module.exports = { queryAnalytics, activeGeneration, rowKey, __resetBudgetForTests, checkRateLimit, enterConcurrency };
