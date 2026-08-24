const { QUERY_BUDGET, SCHEMA_VERSION, EXPRESSION_KEYS } = require("../../../analytics-shared/contracts.cjs");
const { AnalyticsApiError } = require("./errors.js");
const DIMENSIONS = Object.freeze({
  kota_id: { key: "COALESCE(a.kota_id::text,'unknown')", label: "COALESCE(a.kota_nama,'Tidak diketahui')", filter: "a.kota_id", filterType: "integer", type: "text" }, kota_kode: { key: "COALESCE(a.kota_kode,'unknown')", label: "COALESCE(a.kota_nama,'Tidak diketahui')", type: "text" }, kota_nama: { key: "COALESCE(a.kota_nama,'Tidak diketahui')", label: "COALESCE(a.kota_nama,'Tidak diketahui')", type: "text" },
  kecamatan_id: { key: "COALESCE(a.kecamatan_id::text,'unknown')", label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')", filter: "a.kecamatan_id", filterType: "integer", type: "text" }, kecamatan_nama: { key: "COALESCE(a.kecamatan_nama,'Tidak diketahui')", label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')", filter: "a.kecamatan_nama", type: "text" },
  kelurahan_id: { key: "COALESCE(a.kelurahan_id::text,'unknown')", label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')", filter: "a.kelurahan_id", filterType: "integer", type: "text" }, kelurahan_nama: { key: "COALESCE(a.kelurahan_nama,'Tidak diketahui')", label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')", type: "text" },
  sektor_kbli: { key: "COALESCE(a.sektor_kbli,'unknown')", label: "COALESCE(a.sektor_kbli,'Tidak diketahui')", type: "text" }, kbli_kode: { key: "COALESCE(a.kode_kbli,'unknown')", label: "COALESCE(a.kode_kbli,'Tidak diketahui')", type: "text" }, skala_dilaporkan: { key: "COALESCE(a.skala,'unknown')", label: "CASE a.skala WHEN 'micro' THEN 'Mikro' WHEN 'small' THEN 'Kecil' WHEN 'medium' THEN 'Menengah' ELSE 'Tidak diketahui' END", type: "text" }, status_hukum: { key: "COALESCE(a.status_hukum,'unknown')", label: "COALESCE(a.status_hukum,'Tidak diketahui')", type: "text" }, status_usaha: { key: "COALESCE(a.status,'unknown')", label: "CASE a.status WHEN 'active' THEN 'Aktif' WHEN 'archived' THEN 'Diarsipkan' ELSE 'Tidak diketahui' END", type: "text" }, quality_geography: { key: "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'unknown' ELSE 'mapped' END", label: "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'Tidak diketahui' ELSE 'Terpetakan' END", type: "text" }, quality_kbli: { key: "CASE WHEN a.kode_kbli IS NULL THEN 'missing' WHEN a.sektor_kbli IS NULL THEN 'unmapped' ELSE 'mapped' END", label: "CASE WHEN a.kode_kbli IS NULL THEN 'Tidak ada kode' WHEN a.sektor_kbli IS NULL THEN 'Tidak terpetakan' ELSE 'Terpetakan' END", type: "text" },
});
const METRIC = Object.freeze({
  jumlah_umkm: {
    sql: "COUNT(*)",
    eligibleSql: "COUNT(*)",
    missingSql: "0::bigint",
    needsVerificationSql: "0::bigint",
    label: "Jumlah UMKM",
    aggregation: "count_distinct",
    unit: "usaha",
  },
  omzet_tahunan: {
    sql: "COALESCE(SUM(a.omzet_tahunan) FILTER (WHERE a.omzet_quality='reported'),0)",
    eligibleSql: "COUNT(*) FILTER (WHERE a.omzet_quality='reported')",
    missingSql: "COUNT(*) FILTER (WHERE a.omzet_quality='missing')",
    needsVerificationSql: "COUNT(*) FILTER (WHERE a.omzet_quality='needs_verification')",
    label: "Total omzet tahunan dilaporkan",
    aggregation: "sum",
    unit: "IDR",
  },
  total_aset: {
    sql: "COALESCE(SUM(a.total_aset) FILTER (WHERE a.aset_quality='reported'),0)",
    eligibleSql: "COUNT(*) FILTER (WHERE a.aset_quality='reported')",
    missingSql: "COUNT(*) FILTER (WHERE a.aset_quality='missing')",
    needsVerificationSql: "COUNT(*) FILTER (WHERE a.aset_quality='needs_verification')",
    label: "Total aset dilaporkan",
    aggregation: "sum",
    unit: "IDR",
  },
});
function registryField(registry, id) { const field=registry.find((row)=>row.id===id || row.semantic_id===id); if (!field) throw new AnalyticsApiError(400,"FIELD_UNKNOWN"); if (field.lifecycle_status !== "active") throw new AnalyticsApiError(409,"FIELD_UNAVAILABLE"); return field; }
function fieldKey(registry, id) { return registryField(registry,id).semantic_id; }
function integerFilterValue(value) {
  const text = String(value);
  if (!/^(0|[1-9][0-9]*)$/.test(text)) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID");
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed > 2147483647) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID");
  return parsed;
}

function integerFilterExpression(expression, op, value, params) {
  if (op === "in") {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID");
    const includesUnknown = value.some((item) => item === "unknown");
    const values = value.filter((item) => item !== "unknown").map(integerFilterValue);
    if (!values.length) return `${expression} IS NULL`;
    params.push(values);
    const indexedMatch = `${expression} = ANY(?::integer[])`;
    return includesUnknown ? `(${indexedMatch} OR ${expression} IS NULL)` : indexedMatch;
  }
  if (!["eq","neq"].includes(op)) throw new AnalyticsApiError(400,"OPERATOR_NOT_ALLOWED");
  if (Array.isArray(value) || value === undefined || value === null) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID");
  if (value === "unknown") return `${expression} IS ${op === "neq" ? "NOT " : ""}NULL`;
  params.push(integerFilterValue(value));
  return `${expression} ${op === "neq" ? "<>" : "="} ?::integer`;
}

function filterExpression(registry, filter, params) {
  const key=fieldKey(registry,filter.fieldId ?? filter.field);
  const dimension=DIMENSIONS[key];
  if (!dimension) throw new AnalyticsApiError(400,"FILTER_NOT_ALLOWED");
  const expression=dimension.filter || dimension.key;
  const op=filter.operator || "eq";
  const value=filter.value;
  if (dimension.filterType === "integer") return integerFilterExpression(expression, op, value, params);
  if (op === "in") { if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID"); params.push(value); return `${expression} = ANY(?::text[])`; }
  if (!["eq","neq","contains","starts_with"].includes(op)) throw new AnalyticsApiError(400,"OPERATOR_NOT_ALLOWED");
  if (Array.isArray(value) || value === undefined || value === null) throw new AnalyticsApiError(400,"FILTER_VALUE_INVALID");
  params.push(op === "contains" ? `%${String(value).slice(0,100)}%` : op === "starts_with" ? `${String(value).slice(0,100)}%` : value);
  if (op === "neq") return `${expression} <> ?`;
  if (op === "contains" || op === "starts_with") return `${expression} ILIKE ?`;
  return `${expression} = ?`;
}
function compileQuery(request, registry) {
  if (!request || request.schemaVersion !== SCHEMA_VERSION) throw new AnalyticsApiError(400,"SCHEMA_VERSION_UNSUPPORTED");
  const metricKey=typeof request.metric === "string" ? request.metric : request.metric?.key || request.metric?.fieldId;
  const metric=METRIC[metricKey];
  if (!metric) throw new AnalyticsApiError(400,"METRIC_NOT_ALLOWED");
  if (request.metric && typeof request.metric === "object" && request.metric.aggregation && request.metric.aggregation !== metric.aggregation) throw new AnalyticsApiError(400,"AGGREGATION_NOT_ALLOWED");
  const metricField=registryField(registry,metricKey);
  if (metricField.semantic_id !== metricKey || (metricField.semantic_role && metricField.semantic_role !== "metric")) throw new AnalyticsApiError(400,"METRIC_NOT_ALLOWED");
  const groupKey=typeof request.groupBy === "string" ? request.groupBy : request.groupBy?.key || request.groupBy?.fieldId;
  if (!groupKey) throw new AnalyticsApiError(400,"DIMENSION_REQUIRED");
  const dimension=registryField(registry,groupKey);
  const semantic=dimension.semantic_id;
  if (!DIMENSIONS[semantic]) throw new AnalyticsApiError(400,"DIMENSION_NOT_ALLOWED");
  const breakdownKey=request.breakdown ? (typeof request.breakdown === "string" ? request.breakdown : request.breakdown.key || request.breakdown.fieldId) : null;
  let breakdown=null;
  if (breakdownKey) { breakdown=registryField(registry,breakdownKey); if (!DIMENSIONS[breakdown.semantic_id] || breakdown.semantic_id===semantic) throw new AnalyticsApiError(400,"BREAKDOWN_NOT_ALLOWED"); }
  const filters=request.filters || [];
  if (!Array.isArray(filters) || filters.length > QUERY_BUDGET.maxFilters) throw new AnalyticsApiError(422,"QUERY_COMPLEXITY");
  const filterSemantics=filters.map((filter)=>fieldKey(registry,filter.fieldId ?? filter.field));
  const params=[];
  const hasStatusFilter=filterSemantics.includes("status_usaha");
  const clauses=hasStatusFilter ? [] : ["a.status = 'active'"];
  for (const filter of filters) clauses.push(filterExpression(registry,filter,params));
  const rawLimit=Number(request.limit ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) throw new AnalyticsApiError(422,"QUERY_COMPLEXITY");
  const limit=Math.min(rawLimit,QUERY_BUDGET.maxGroups);
  const dimensions=[DIMENSIONS[semantic],breakdown && DIMENSIONS[breakdown.semantic_id]].filter(Boolean);
  if (dimensions.length > QUERY_BUDGET.maxDimensions) throw new AnalyticsApiError(422,"QUERY_COMPLEXITY");
  const select=[`${dimensions[0].key} AS group_key`,`${dimensions[0].label} AS group_label`];
  if (breakdown) select.push(`${dimensions[1].key} AS breakdown_key`,`${dimensions[1].label} AS breakdown_label`);
  const aggregateSelectSql=select.join(", ");
  select.push(`${metric.sql} AS value`);
  const groupBy=select.slice(0,breakdown?4:2).map((_,i)=>String(i+1)).join(", ");
  return { metric, metricKey, semantic, breakdown: breakdown?.semantic_id || null, filterSemantics, whereSql: clauses.join(" AND "), params, selectSql: select.join(", "), aggregateSelectSql, groupBySql: groupBy, limit, includeOthers: request.includeOthers !== false, shareOfFilteredTotal: request.shareOfFilteredTotal === true, normalized: { schemaVersion: SCHEMA_VERSION, metric: metricKey, groupBy: semantic, breakdown: breakdown?.semantic_id || null, filters, limit, includeOthers: request.includeOthers !== false } };
}
function compileFiltersOnly(request, registry) { const compiled=compileQuery({ ...request, groupBy: request.groupBy || "kota_nama" }, registry); return { whereSql: compiled.whereSql, params: compiled.params }; }
module.exports = { DIMENSIONS, METRIC, compileQuery, compileFiltersOnly, registryField, EXPRESSION_KEYS };
