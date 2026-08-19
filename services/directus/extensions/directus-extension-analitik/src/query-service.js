const { AnalyticsApiError } = require("./errors.js");
const { baseMeta } = require("./meta.js");
const { compileQuery } = require("./query-compiler.js");
const { resolveAnalyticsSource } = require("./source-service.js");

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
    const codeResult = await database.raw("SELECT id::text AS id,kode FROM kota WHERE kode IS NOT NULL");
    const codes = new Map((codeResult.rows ?? []).map((row) => [String(row.id), row.kode]));
    rows = source.regions.map((region) => ({
      key: plan.semantic === "kota_id"
        ? String(region.id)
        : plan.semantic === "kota_kode"
          ? (codes.get(String(region.id)) || "unknown")
          : (region.name || "Tidak diketahui"),
      label: region.name || "Tidak diketahui",
      value: Number(region.value || 0),
    }));
    unknown = source.regions.filter((region) => region.name === "Tidak diketahui").reduce((sum, region) => sum + Number(region.value || 0), 0);
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

async function queryAnalytics(database, request) {
  const source = await resolveAnalyticsSource(database);
  if (!source) throw new AnalyticsApiError(503, "NO_PUBLISHED_SNAPSHOT", "Data sedang disiapkan. Silakan coba lagi.");
  const registryResult = await database.raw(`SELECT id,semantic_id,lifecycle_status FROM analitik_field`);
  const registry = registryResult.rows ?? registryResult[0] ?? [];
  const plan = compileQuery(request, registry);
  const snapshotResponse = await querySnapshot(database, source, plan);
  if (snapshotResponse) return snapshotResponse;
  const scopedWhere = `${source.scopeSql} AND ${plan.whereSql}`;
  const params = [...source.scopeParams, ...plan.params];
  let rows;
  let matched;
  try {
    rows = (await database.raw(`SELECT ${plan.selectSql} FROM ${source.fromSql} WHERE ${scopedWhere} GROUP BY ${plan.groupBySql} ORDER BY value DESC, group_key ASC LIMIT ?`, [...params, plan.limit + 1])).rows ?? [];
    matched = Number(((await database.raw(`SELECT COUNT(DISTINCT a.usaha_id)::integer AS count FROM ${source.fromSql} WHERE ${scopedWhere}`, params)).rows ?? [])[0]?.count ?? 0);
  } catch (error) {
    if (error?.code === "57014" || error?.code === "55P03") throw new AnalyticsApiError(504, "QUERY_TIMEOUT");
    throw error;
  }
  let population;
  try {
    const populationResult = await database.raw(`SELECT COUNT(DISTINCT a.usaha_id)::integer AS count FROM ${source.fromSql} WHERE ${source.scopeSql} AND a.status='active'`, source.scopeParams);
    population = Number((populationResult.rows ?? [])[0]?.count ?? matched);
  } catch (error) {
    if (error?.code === "57014" || error?.code === "55P03") throw new AnalyticsApiError(504, "QUERY_TIMEOUT");
    throw error;
  }
  const overflow = rows.length > plan.limit ? rows.slice(plan.limit) : [];
  rows = rows.slice(0, plan.limit);
  const overflowValue = overflow.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const groups = rows.map((row) => ({
    key: row.group_key,
    label: row.group_label || "Tidak diketahui",
    value: Number(row.value || 0),
    share: matched ? Number((Number(row.value || 0) * 100 / matched).toFixed(1)) : 0,
    ...(plan.breakdown ? { breakdown: { key: row.breakdown_key, label: row.breakdown_label || "Tidak diketahui" } } : {}),
  }));
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

module.exports = { queryAnalytics, activeGeneration, rowKey };
