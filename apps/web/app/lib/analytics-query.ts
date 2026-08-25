import type {
  AnalysisConfig,
  AnalyticsFilter,
  AnalyticsVisual,
} from "~/types/analytics";

const ALLOWED_VISUALS = new Set<AnalyticsVisual>([
  "kpi",
  "bar",
  "stacked",
  "donut",
  "histogram",
  "choropleth",
  "table",
]);
const ALLOWED_OPERATORS = new Set<AnalyticsFilter["operator"]>([
  "eq",
  "neq",
  "in",
  "contains",
  "starts_with",
]);
const SAFE_TOKEN = /^[a-z][a-z0-9_]{0,63}$/i;
const SAFE_CURSOR = /^[A-Za-z0-9._~%-]{1,512}$/;
const FORBIDDEN_IDENTIFIER =
  /(nik|phone|telepon|birth|password|token|cookie|record|uuid|secret|address|domisili)/i;
const FORBIDDEN_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set([
  "metric",
  "groupBy",
  "breakdown",
  "visual",
  "others",
  "filter",
  "sort",
  "page",
  "cursor",
]);

/**
 * Jumlah grup maksimum yang diminta dari server. Harus <= QUERY_BUDGET.maxGroups
 * (contracts.cjs). Agregasi SQL menghitung semua grup apapun LIMIT-nya, jadi
 * meminta semua baris hanya memperbesar payload secukupnya; pemangkasan visual
 * (top-N chart) tetap dilakukan di klien.
 */
export const REQUESTED_GROUPS = 2000;

function safeIdentifier(value: string | null | undefined): value is string {
  return (
    value != null && SAFE_TOKEN.test(value) && !FORBIDDEN_IDENTIFIER.test(value)
  );
}
function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 0 || code === 10 || code === 13;
  });
}

function safeFilterValue(value: string): boolean {
  return (
    value.length <= 100 &&
    !hasControlCharacters(value) &&
    !FORBIDDEN_IDENTIFIER.test(value) &&
    !FORBIDDEN_UUID.test(value) &&
    !/^\d{16}$/.test(value) &&
    !/^(?:\+62|62|08)\d{8,13}$/.test(value)
  );
}
function safeCursor(value: string | null | undefined): value is string {
  return (
    value != null &&
    SAFE_CURSOR.test(value) &&
    !FORBIDDEN_IDENTIFIER.test(value)
  );
}

export const defaultAnalysis: AnalysisConfig = {
  schemaVersion: 1,
  metric: "jumlah_umkm",
  groupBy: "kota_nama",
  breakdown: null,
  filters: [],
  visual: "bar",
  includeOthers: true,
  shareOfFilteredTotal: true,
};

export function serializeAnalysisUrl(config: AnalysisConfig) {
  const params = new URLSearchParams();
  if (safeIdentifier(config.metric)) params.set("metric", config.metric);
  if (safeIdentifier(config.groupBy)) params.set("groupBy", config.groupBy);
  if (config.breakdown && safeIdentifier(config.breakdown))
    params.set("breakdown", config.breakdown);
  if (ALLOWED_VISUALS.has(config.visual) && config.visual !== "bar")
    params.set("visual", config.visual);
  if (config.includeOthers === false) params.set("others", "0");
  if (config.sort === "nama" || config.sort === "id")
    params.set("sort", config.sort);
  if (
    Number.isInteger(config.page) &&
    config.page! >= 1 &&
    config.page! <= 1000
  )
    params.set("page", String(config.page));
  if (config.cursor && safeCursor(config.cursor))
    params.set("cursor", config.cursor);
  for (const filter of config.filters || []) {
    if (
      !safeIdentifier(filter.fieldId) ||
      !ALLOWED_OPERATORS.has(filter.operator)
    )
      continue;
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (!values.length || values.some((value) => !safeFilterValue(value)))
      continue;
    const value = values.join(",");
    // URLSearchParams performs the final URL escaping. The delimiter is only
    // interpreted before decoding, so a value cannot become a new field.
    params.append(
      "filter",
      `${filter.fieldId}~${filter.operator}~${encodeURIComponent(value)}`,
    );
  }
  return params.toString();
}

function isQueryString(
  value: string | Record<string, string | string[] | undefined>,
): value is string {
  return typeof value === "string";
}

function asParams(
  input:
    | string
    | URLSearchParams
    | Record<string, string | string[] | undefined>,
) {
  if (input instanceof URLSearchParams) return input;
  if (isQueryString(input))
    return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  }
  return params;
}

export interface ParsedAnalysisUrl {
  config: AnalysisConfig;
  warning: boolean;
}

export function parseAnalysisUrl(
  input:
    | string
    | URLSearchParams
    | Record<string, string | string[] | undefined>,
): ParsedAnalysisUrl {
  const params = asParams(input);
  let warning = false;
  const config: AnalysisConfig = { ...defaultAnalysis, filters: [] };
  for (const key of params.keys()) if (!ALLOWED_KEYS.has(key)) warning = true;

  const metric = params.get("metric");
  const groupBy = params.get("groupBy");
  const breakdown = params.get("breakdown");
  const visual = params.get("visual");
  if (metric && safeIdentifier(metric)) config.metric = metric;
  else if (metric) warning = true;
  if (groupBy && safeIdentifier(groupBy)) config.groupBy = groupBy;
  else if (groupBy) warning = true;
  if (breakdown) {
    if (safeIdentifier(breakdown)) config.breakdown = breakdown;
    else warning = true;
  }
  if (visual) {
    // SAFETY: ALLOWED_VISUALS.has() just verified the raw parameter is one of the known AnalyticsVisual values.
    const parsedVisual = ALLOWED_VISUALS.has(visual as AnalyticsVisual)
      ? (visual as AnalyticsVisual)
      : null;
    if (parsedVisual) config.visual = parsedVisual;
    else warning = true;
  }
  if (params.get("others") === "0") config.includeOthers = false;
  if (
    params.has("others") &&
    params.get("others") !== "0" &&
    params.get("others") !== "1"
  )
    warning = true;
  const sort = params.get("sort");
  if (sort === "nama" || sort === "id") config.sort = sort;
  else if (sort) warning = true;
  const page = params.get("page");
  if (page) {
    const parsed = Number(page);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000)
      config.page = parsed;
    else warning = true;
  }
  const cursor = params.get("cursor");
  if (cursor) {
    if (safeCursor(cursor)) config.cursor = cursor;
    else warning = true;
  }
  for (const raw of params.getAll("filter")) {
    const parts = raw.split("~");
    const fieldId = parts.shift();
    const operator = parts.shift();
    const encoded = parts.join("~");
    let value: string;
    try {
      value = decodeURIComponent(encoded);
    } catch {
      warning = true;
      continue;
    }
    // SAFETY: ALLOWED_OPERATORS.has() just verified the raw operator is one of the known AnalyticsFilter operators.
    if (
      !fieldId ||
      !operator ||
      !safeIdentifier(fieldId) ||
      !ALLOWED_OPERATORS.has(operator as AnalyticsFilter["operator"]) ||
      !safeFilterValue(value)
    ) {
      warning = true;
      continue;
    }
    const values = operator === "in" ? value.split(",") : [value];
    if (!values.length || values.some((item) => !safeFilterValue(item))) {
      warning = true;
      continue;
    }
    // SAFETY: the operator was verified against ALLOWED_OPERATORS above before reaching this push.
    config.filters.push({
      fieldId,
      operator: operator as AnalyticsFilter["operator"],
      value: operator === "in" ? values : value,
    });
  }
  return { config, warning };
}

export function canonicalizeAnalysisUrl(config: AnalysisConfig) {
  const serialized = serializeAnalysisUrl(config);
  return serialized ? `?${serialized}` : "";
}

// Canonical cache keys for the analytics API responses. Only inputs that
// change the server response participate: visual/page/cursor never alter the
// aggregate payload, and filter/value order is irrelevant to SQL semantics,
// so reordering must not invalidate the cache.
function canonicalFilterEntries(filters: AnalyticsFilter[] | undefined) {
  return (filters ?? [])
    .map(
      (filter) =>
        [
          filter.fieldId,
          filter.operator,
          Array.isArray(filter.value) ? [...filter.value].sort() : filter.value,
        ] as const,
    )
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
}

export function canonicalAggregateKey(config: AnalysisConfig): string {
  return JSON.stringify({
    schemaVersion: config.schemaVersion,
    metric: config.metric,
    groupBy: config.groupBy,
    breakdown: config.breakdown ?? null,
    filters: canonicalFilterEntries(config.filters),
    includeOthers: config.includeOthers !== false,
  });
}

export function canonicalRecordsKey(config: AnalysisConfig): string {
  return JSON.stringify({
    schemaVersion: config.schemaVersion,
    filters: canonicalFilterEntries(config.filters),
    sort: config.sort === "nama" ? "nama" : "id",
  });
}
