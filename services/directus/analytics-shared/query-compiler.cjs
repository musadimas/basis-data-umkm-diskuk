"use strict";

/**
 * Kandidat 03 langkah 1: definisi dimensi kanonik untuk compiler analitik.
 *
 * Satu-satunya sumber `key`/`label` dimensi (dipakai GROUP BY agregat) beserta
 * metadata filter (`filter`/`filterType`) yang membuat kesetaraan ID geografis
 * tetap sargable (`a.kota_id = ?::integer`, bukan `COALESCE(...)=...`).
 * Router (`query-compiler.js`) mengimpor dari sini; worker (`exporter.js`) dan
 * rollup (`rebuild.js`, `query-service.js`) menyusul di langkah berikutnya.
 */
const DIMENSIONS = Object.freeze({
  kota_id: {
    key: "COALESCE(a.kota_id::text,'unknown')",
    label: "COALESCE(a.kota_nama,'Tidak diketahui')",
    filter: "a.kota_id",
    filterType: "integer",
    type: "text",
  },
  kota_kode: {
    key: "COALESCE(a.kota_kode,'unknown')",
    label: "COALESCE(a.kota_nama,'Tidak diketahui')",
    type: "text",
  },
  kota_nama: {
    key: "COALESCE(a.kota_nama,'Tidak diketahui')",
    label: "COALESCE(a.kota_nama,'Tidak diketahui')",
    type: "text",
  },
  kecamatan_id: {
    key: "COALESCE(a.kecamatan_id::text,'unknown')",
    label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')",
    filter: "a.kecamatan_id",
    filterType: "integer",
    type: "text",
  },
  kecamatan_nama: {
    key: "COALESCE(a.kecamatan_nama,'Tidak diketahui')",
    label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')",
    filter: "a.kecamatan_nama",
    type: "text",
  },
  kelurahan_id: {
    key: "COALESCE(a.kelurahan_id::text,'unknown')",
    label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')",
    filter: "a.kelurahan_id",
    filterType: "integer",
    type: "text",
  },
  kelurahan_nama: {
    key: "COALESCE(a.kelurahan_nama,'Tidak diketahui')",
    label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')",
    type: "text",
  },
  sektor_kbli: {
    key: "COALESCE(a.sektor_kbli,'unknown')",
    label: "COALESCE(a.sektor_kbli,'Tidak diketahui')",
    type: "text",
  },
  kbli_kode: {
    key: "COALESCE(a.kode_kbli,'unknown')",
    label: "COALESCE(a.kode_kbli,'Tidak diketahui')",
    type: "text",
  },
  skala_dilaporkan: {
    key: "COALESCE(a.skala,'unknown')",
    label:
      "CASE a.skala WHEN 'micro' THEN 'Mikro' WHEN 'small' THEN 'Kecil' WHEN 'medium' THEN 'Menengah' ELSE 'Tidak diketahui' END",
    type: "text",
  },
  status_hukum: {
    key: "COALESCE(a.status_hukum,'unknown')",
    label: "COALESCE(a.status_hukum,'Tidak diketahui')",
    type: "text",
  },
  status_usaha: {
    key: "COALESCE(a.status,'unknown')",
    label:
      "CASE a.status WHEN 'active' THEN 'Aktif' WHEN 'archived' THEN 'Diarsipkan' ELSE 'Tidak diketahui' END",
    type: "text",
  },
  quality_geography: {
    key: "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'unknown' ELSE 'mapped' END",
    label:
      "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'Tidak diketahui' ELSE 'Terpetakan' END",
    type: "text",
  },
  quality_kbli: {
    key: "CASE WHEN a.kode_kbli IS NULL THEN 'missing' WHEN a.sektor_kbli IS NULL THEN 'unmapped' ELSE 'mapped' END",
    label:
      "CASE WHEN a.kode_kbli IS NULL THEN 'Tidak ada kode' WHEN a.sektor_kbli IS NULL THEN 'Tidak terpetakan' ELSE 'Terpetakan' END",
    type: "text",
  },
});

/**
 * Kandidat 03 langkah 2e: definisi metrik kanonik (sumber tunggal SQL agregat).
 * Penamaan kanonik mengikuti router (`eligibleSql`/`missingSql`/
 * `needsVerificationSql`); worker memetakan ke nama pendeknya di seam.
 */
const METRICS = Object.freeze({
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
    needsVerificationSql:
      "COUNT(*) FILTER (WHERE a.omzet_quality='needs_verification')",
    label: "Total omzet tahunan dilaporkan",
    aggregation: "sum",
    unit: "IDR",
  },
  total_aset: {
    sql: "COALESCE(SUM(a.total_aset) FILTER (WHERE a.aset_quality='reported'),0)",
    eligibleSql: "COUNT(*) FILTER (WHERE a.aset_quality='reported')",
    missingSql: "COUNT(*) FILTER (WHERE a.aset_quality='missing')",
    needsVerificationSql:
      "COUNT(*) FILTER (WHERE a.aset_quality='needs_verification')",
    label: "Total aset dilaporkan",
    aggregation: "sum",
    unit: "IDR",
  },
});

/**
 * Kandidat 03 langkah 3f: inti compile analitik (sumber tunggal untuk router
 * dan worker). CJS tanpa dependensi npm; hanya memakai kontrak sekandung
 * (budget + versi skema) supaya batas tidak ditulis ulang di tiap pemanggil.
 *
 * - `compileAggregate(config, { registry, operator })` → plan agregat.
 * - `compileFilters(config, { registry, operator })` → { whereSql, params }
 *   untuk `detail_csv` dan estimasi.
 * - `aggregateSql(plan, { fromSql, whereSql, params, placeholder })` →
 *   satu scan (`SUM() OVER ()`, bentuk query-service) dengan placeholder
 *   `"?"` (router/knex) atau `"$n"` (worker/pg).
 * - `parameterize(sql, startIndex)` mengubah `?` menjadi `$n` berurutan.
 *
 * Invarian (dipegang di sini, bukan di pemanggil):
 * - `operator` wajib. `undefined`/`null` → `{ status: 400, code:
 *   "OPERATOR_REQUIRED" }`; tidak ada default provinsi.
 * - Untuk kabkota: filter kota klien (kunci mentah di `KOTA_FIELDS`) dibuang,
 *   budget dihitung atas sisa filter klien, lalu satu filter `kota_id` milik
 *   wilayah operator disisipkan. Kabkota tanpa kota → 403 `KOTA_NOT_ASSIGNED`.
 * - Tidak ada pemotongan diam-diam: pelanggaran budget → 422
 *   `QUERY_COMPLEXITY`.
 * - Error berbentuk `Object.assign(new Error(code), { status, code })`;
 *   adapter router memetakannya ke `AnalyticsApiError`, worker ke
 *   `error_code` job (`INVALID_ANALYSIS_CONFIG`).
 */
const { QUERY_BUDGET, SCHEMA_VERSION } = require("./contracts.cjs");

const KOTA_FIELDS = Object.freeze(new Set(["kota_id", "kota_kode", "kota_nama"]));

function gagal(status, code) {
  return Object.assign(new Error(code), { status, code });
}

function registryField(registry, id) {
  const field = registry.find((row) => row.id === id || row.semantic_id === id);
  if (!field) throw gagal(400, "FIELD_UNKNOWN");
  if (field.lifecycle_status !== "active") throw gagal(409, "FIELD_UNAVAILABLE");
  return field;
}

function fieldKey(registry, id) {
  return registryField(registry, id).semantic_id;
}

function integerFilterValue(value) {
  const text = String(value);
  if (!/^(0|[1-9][0-9]*)$/.test(text)) throw gagal(400, "FILTER_VALUE_INVALID");
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed > 2147483647)
    throw gagal(400, "FILTER_VALUE_INVALID");
  return parsed;
}

function integerFilterExpression(expression, op, value, params) {
  if (op === "in") {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100)
      throw gagal(400, "FILTER_VALUE_INVALID");
    const includesUnknown = value.some((item) => item === "unknown");
    const values = value.filter((item) => item !== "unknown").map(integerFilterValue);
    if (!values.length) return `${expression} IS NULL`;
    params.push(values);
    const indexedMatch = `${expression} = ANY(?::integer[])`;
    return includesUnknown ? `(${indexedMatch} OR ${expression} IS NULL)` : indexedMatch;
  }
  if (!["eq", "neq"].includes(op)) throw gagal(400, "OPERATOR_NOT_ALLOWED");
  if (Array.isArray(value) || value === undefined || value === null)
    throw gagal(400, "FILTER_VALUE_INVALID");
  if (value === "unknown") return `${expression} IS ${op === "neq" ? "NOT " : ""}NULL`;
  params.push(integerFilterValue(value));
  return `${expression} ${op === "neq" ? "<>" : "="} ?::integer`;
}

function filterExpression(registry, filter, params) {
  const key = fieldKey(registry, filter.fieldId ?? filter.field);
  const dimension = DIMENSIONS[key];
  if (!dimension) throw gagal(400, "FILTER_NOT_ALLOWED");
  const expression = dimension.filter || dimension.key;
  const op = filter.operator || "eq";
  const value = filter.value;
  if (dimension.filterType === "integer")
    return integerFilterExpression(expression, op, value, params);
  if (op === "in") {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100)
      throw gagal(400, "FILTER_VALUE_INVALID");
    params.push(value);
    return `${expression} = ANY(?::text[])`;
  }
  if (!["eq", "neq", "contains", "starts_with"].includes(op))
    throw gagal(400, "OPERATOR_NOT_ALLOWED");
  if (Array.isArray(value) || value === undefined || value === null)
    throw gagal(400, "FILTER_VALUE_INVALID");
  params.push(
    op === "contains"
      ? `%${String(value).slice(0, 100)}%`
      : op === "starts_with"
        ? `${String(value).slice(0, 100)}%`
        : value,
  );
  if (op === "neq") return `${expression} <> ?`;
  if (op === "contains" || op === "starts_with") return `${expression} ILIKE ?`;
  return `${expression} = ?`;
}

function scopeKeyOf(operator) {
  if (operator?.admin === true) return "admin";
  if (operator?.role === "kabkota" && operator?.kotaId != null)
    return `kabkota:${operator.kotaId}`;
  return "provinsi";
}

// Scope wilayah di dalam compiler: kabkota membuang filter kota klien lalu
// mendapat satu filter kota paksa; peran lain (termasuk admin) diteruskan.
function terapkanScope(request, operator) {
  if (operator == null) throw gagal(400, "OPERATOR_REQUIRED");
  if (operator.role !== "kabkota") return request ?? {};
  if (operator.kotaId == null) throw gagal(403, "KOTA_NOT_ASSIGNED");
  const source = request ?? {};
  const filters = Array.isArray(source.filters) ? source.filters : [];
  const kept = filters.filter((filter) => {
    const key = filter?.fieldId ?? filter?.field;
    return !KOTA_FIELDS.has(key);
  });
  return {
    ...source,
    filters: [
      ...kept,
      { fieldId: "kota_id", operator: "eq", value: String(operator.kotaId) },
    ],
  };
}

function compileAggregate(request, { registry, operator } = {}) {
  const scoped = terapkanScope(request, operator);
  if (!scoped || scoped.schemaVersion !== SCHEMA_VERSION)
    throw gagal(400, "SCHEMA_VERSION_UNSUPPORTED");
  const metricKey =
    typeof scoped.metric === "string"
      ? scoped.metric
      : scoped.metric?.key || scoped.metric?.fieldId;
  const metric = METRICS[metricKey];
  if (!metric) throw gagal(400, "METRIC_NOT_ALLOWED");
  if (
    scoped.metric &&
    typeof scoped.metric === "object" &&
    scoped.metric.aggregation &&
    scoped.metric.aggregation !== metric.aggregation
  )
    throw gagal(400, "AGGREGATION_NOT_ALLOWED");
  const metricField = registryField(registry, metricKey);
  if (
    metricField.semantic_id !== metricKey ||
    (metricField.semantic_role && metricField.semantic_role !== "metric")
  )
    throw gagal(400, "METRIC_NOT_ALLOWED");
  const groupKey =
    typeof scoped.groupBy === "string"
      ? scoped.groupBy
      : scoped.groupBy?.key || scoped.groupBy?.fieldId;
  if (!groupKey) throw gagal(400, "DIMENSION_REQUIRED");
  const dimension = registryField(registry, groupKey);
  const semantic = dimension.semantic_id;
  if (!DIMENSIONS[semantic]) throw gagal(400, "DIMENSION_NOT_ALLOWED");
  const breakdownKey = scoped.breakdown
    ? typeof scoped.breakdown === "string"
      ? scoped.breakdown
      : scoped.breakdown.key || scoped.breakdown.fieldId
    : null;
  let breakdown = null;
  if (breakdownKey) {
    breakdown = registryField(registry, breakdownKey);
    if (!DIMENSIONS[breakdown.semantic_id] || breakdown.semantic_id === semantic)
      throw gagal(400, "BREAKDOWN_NOT_ALLOWED");
  }
  // Budget dihitung atas filter klien (scope kota sudah dibuang di atas dan
  // filter paksa belum disisipkan), sehingga filter kota paksa tidak memakan
  // jatah dan tidak bisa terpotong.
  const clientFilters = Array.isArray(request?.filters) ? request.filters : [];
  const scopedFilters = Array.isArray(scoped.filters) ? scoped.filters : [];
  const nonKotaFilters = clientFilters.filter((filter) => {
    const key = filter?.fieldId ?? filter?.field;
    return !KOTA_FIELDS.has(key);
  });
  if (
    (request?.filters != null && !Array.isArray(request.filters)) ||
    nonKotaFilters.length > QUERY_BUDGET.maxFilters
  )
    throw gagal(422, "QUERY_COMPLEXITY");
  const filterSemantics = scopedFilters.map((filter) =>
    fieldKey(registry, filter.fieldId ?? filter.field),
  );
  const params = [];
  const hasStatusFilter = filterSemantics.includes("status_usaha");
  const clauses = hasStatusFilter ? [] : ["a.status = 'active'"];
  for (const filter of scopedFilters) clauses.push(filterExpression(registry, filter, params));
  const rawLimit = Number(scoped.limit ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) throw gagal(422, "QUERY_COMPLEXITY");
  const limit = Math.min(rawLimit, QUERY_BUDGET.maxGroups);
  const dimensions = [
    DIMENSIONS[semantic],
    breakdown && DIMENSIONS[breakdown.semantic_id],
  ].filter(Boolean);
  if (dimensions.length > QUERY_BUDGET.maxDimensions)
    throw gagal(422, "QUERY_COMPLEXITY");
  const select = [
    `${dimensions[0].key} AS group_key`,
    `${dimensions[0].label} AS group_label`,
  ];
  if (breakdown)
    select.push(
      `${dimensions[1].key} AS breakdown_key`,
      `${dimensions[1].label} AS breakdown_label`,
    );
  const aggregateSelectSql = select.join(", ");
  select.push(`${metric.sql} AS value`);
  const groupBy = select
    .slice(0, breakdown ? 4 : 2)
    .map((_, i) => String(i + 1))
    .join(", ");
  return {
    metric,
    metricKey,
    semantic,
    breakdown: breakdown?.semantic_id || null,
    filterSemantics,
    whereSql: clauses.join(" AND "),
    params,
    selectSql: select.join(", "),
    aggregateSelectSql,
    groupBySql: groupBy,
    limit,
    includeOthers: scoped.includeOthers !== false,
    shareOfFilteredTotal: scoped.shareOfFilteredTotal === true,
    scopeKey: scopeKeyOf(operator),
    normalized: {
      schemaVersion: SCHEMA_VERSION,
      metric: metricKey,
      groupBy: semantic,
      breakdown: breakdown?.semantic_id || null,
      filters: scopedFilters,
      limit,
      includeOthers: scoped.includeOthers !== false,
    },
  };
}

function compileFilters(request, { registry, operator } = {}) {
  const compiled = compileAggregate(
    { ...request, groupBy: request?.groupBy || "kota_nama" },
    { registry, operator },
  );
  return { whereSql: compiled.whereSql, params: compiled.params };
}

// `?` menjadi `$n` berurutan mulai dari startIndex (worker menaruh
// `generation_id=$1` di depan, jadi mulai dari 2).
function parameterize(sql, startIndex = 1) {
  let index = startIndex;
  return String(sql).replace(/\?/g, () => `$${index++}`);
}

// Satu scan agregat_router: nilai grup + cakupan finansial + total window
// dalam sekali jalan (bentuk query-service; worker menyusun bentuknya sendiri
// dari bagian plan yang sama di langkah 3h).
function aggregateSql(plan, { fromSql, whereSql, params = [], placeholder = "?" } = {}) {
  const orderSql = plan.breakdown
    ? "value DESC, group_key ASC, breakdown_key ASC"
    : "value DESC, group_key ASC";
  let sql = `
        SELECT group_key, group_label${plan.breakdown ? ", breakdown_key, breakdown_label" : ""}, value, eligible::integer AS eligible, matched::integer AS matched, missing::integer AS missing, needs_verification::integer AS needs_verification, metric_total FROM (
          SELECT ${plan.aggregateSelectSql}, ${plan.metric.sql} AS value,
            ${plan.metric.eligibleSql} AS eligible,
            SUM(${plan.metric.eligibleSql}) OVER ()::bigint AS matched,
            SUM(${plan.metric.missingSql}) OVER ()::bigint AS missing,
            SUM(${plan.metric.needsVerificationSql}) OVER ()::bigint AS needs_verification,
            SUM(${plan.metric.sql}) OVER () AS metric_total
          FROM ${fromSql} WHERE ${whereSql}
          GROUP BY ${plan.groupBySql}
        ) g
        WHERE eligible > 0 OR matched = 0
        ORDER BY ${orderSql}
        LIMIT ?
      `;
  let outParams = [...params, plan.limit + 1];
  if (placeholder === "$n") {
    let index = 1;
    sql = sql.replace(/\?/g, () => `$${index++}`);
  }
  return { sql, params: outParams };
}

module.exports = {
  DIMENSIONS,
  METRICS,
  KOTA_FIELDS,
  compileAggregate,
  compileFilters,
  aggregateSql,
  parameterize,
};
