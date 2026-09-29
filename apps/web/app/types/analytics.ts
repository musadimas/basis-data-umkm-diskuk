export const ANALYTICS_SCHEMA_VERSION = 1 as const;
export type AnalyticsStatus = "current" | "processing" | "stale_last_good";
export type AnalyticsVisual =
  | "kpi"
  | "bar"
  | "stacked"
  | "donut"
  | "histogram"
  | "choropleth"
  | "table";
export interface AnalyticsField {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  group: string;
  order: number;
  role: string;
  type: string;
  status: string;
  privacy: string;
  capabilities: string[];
  schemaVersion: number;
}
export interface AnalyticsCatalog {
  schemaVersion: number;
  fields: AnalyticsField[];
  warnings: string[];
}
export interface AnalyticsFilter {
  fieldId: string;
  operator: "eq" | "neq" | "in" | "contains" | "starts_with";
  value: string | string[];
}
export interface AnalysisConfig {
  schemaVersion: 1;
  metric: string;
  groupBy: string;
  breakdown?: string | null;
  filters: AnalyticsFilter[];
  visual: AnalyticsVisual;
  includeOthers?: boolean;
  shareOfFilteredTotal?: boolean;
  sort?: "nama" | "id";
  page?: number;
  cursor?: string;
}
export interface AnalyticsMeta {
  schemaVersion: number;
  dataAsOf: string | null;
  generatedAt: string;
  status: AnalyticsStatus;
  source: string;
  population: number;
  matched: number;
  coverage: {
    matched: number;
    total: number;
    unknown?: number;
    missing?: number;
    needsVerification?: number;
  };
  warnings: string[];
  maskingVersion?: number;
}
export interface AnalyticsGroup {
  key: string;
  label: string;
  value: number;
  share: number;
  breakdown?: { key: string; label: string };
}
export interface AnalyticsMetric {
  key: string;
  label: string;
  aggregation: string;
  unit: "usaha" | "IDR";
}
export interface AnalyticsQueryResponse {
  meta: AnalyticsMeta;
  data: {
    metric: AnalyticsMetric;
    total: number;
    groups: AnalyticsGroup[];
    normalizedFilters?: unknown;
    conservedTotal?: boolean;
  };
}
export interface AnalyticsRecord {
  id: string;
  nama: string;
  skala: string;
  kota: string;
  kecamatan: string;
  kbli: string;
  kategori: string;
  status: string;
}
export interface AnalyticsRecordsResponse {
  meta: AnalyticsMeta;
  data: { records: AnalyticsRecord[]; nextCursor: string | null };
}
export interface AnalyticsTemplate {
  id: string;
  version: number;
  label: string;
  description: string;
  config: Partial<AnalysisConfig>;
  workforce: { enabled: boolean };
  financial: { enabled: boolean };
}

export interface AnalyticsProfileField {
  fieldId: string;
  label: string;
  value: unknown;
  displayValue: string;
  qualityStatus: "reported" | "missing" | "needs_verification";
  dataType: string;
}
export interface AnalyticsProfileSection {
  id: string;
  label: string;
  fields: AnalyticsProfileField[];
}
export interface AnalyticsProfile {
  meta: AnalyticsMeta;
  data: {
    id: string;
    title: string;
    badges: string[];
    hero: { name: string; location: string; image: string | null };
    sections: AnalyticsProfileSection[];
    actions: {
      canEdit: boolean;
      canArchive: boolean;
      canRestore: boolean;
      editPath: string;
    };
    maskingVersion: number;
  };
}

export interface SavedAnalysis {
  id: string;
  name: string;
  schema_version: number;
  config: AnalysisConfig;
  date_created?: string;
  date_updated?: string;
}
export type AnalyticsExportType =
  | "aggregate_csv"
  | "detail_csv"
  | "aggregate_png"
  | "aggregate_pdf"
  | "aggregate_pptx"
  | "passport_pdf"
  | "katalog_pdf"
  | "profile_pdf";
export interface AnalyticsExportStatus {
  meta: AnalyticsMeta;
  data: {
    jobId: string;
    type: AnalyticsExportType;
    status: "queued" | "processing" | "completed" | "failed" | "expired";
    estimatedRows?: number;
    rowCount?: number | null;
    expiresAt?: string | null;
    downloadUrl?: string;
    error?: string | null;
  };
}
