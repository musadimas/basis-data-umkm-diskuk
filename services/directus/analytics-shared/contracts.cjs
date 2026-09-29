"use strict";

const SCHEMA_VERSION = 1;
const MASKING_VERSION = 1;
const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const ANALYTICS_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
// maxGroups hanya membatasi jumlah baris hasil, bukan kerja agregasi: GROUP BY
// (dan tabel rollup analitik_dim_aggregate) sudah menghitung semua grup apapun
// LIMIT-nya, jadi batas ini murni menjaga ukuran payload — 2000 menutup semua
// kardinalitas dimensi terbesar (kelurahan Jabar ±1.600 baris).
const QUERY_BUDGET = Object.freeze({
  maxFilters: 8,
  maxDimensions: 2,
  maxGroups: 2000,
  maxDonutGroups: 6,
  recordsPageSize: 100,
  detailExportRows: 50000,
  statementTimeoutMs: 4500,
  lockTimeoutMs: 500,
});
const LIVE_JOB_STATUSES = Object.freeze(["queued", "processing", "retry"]);
const JOB_STATUSES = Object.freeze([
  ...LIVE_JOB_STATUSES,
  "completed",
  "dead",
  "cancelled",
  "expired",
]);
const GENERATION_STATUSES = Object.freeze([
  "candidate",
  "active",
  "previous",
  "failed",
]);
const FIELD_STATUSES = Object.freeze([
  "discovered",
  "quarantined",
  "active",
  "tombstoned",
]);
const EXPRESSION_KEYS = Object.freeze({
  count_distinct_usaha: "COUNT_DISTINCT_USAHA",
  kota_id: "KOTA_ID",
  kota_kode: "KOTA_KODE",
  kota_nama: "KOTA_NAMA",
  kecamatan_id: "KECAMATAN_ID",
  kecamatan_nama: "KECAMATAN_NAMA",
  kelurahan_id: "KELURAHAN_ID",
  kelurahan_nama: "KELURAHAN_NAMA",
  sektor_kbli: "SEKTOR_KBLI",
  kbli_kode: "KBLI_KODE",
  skala: "SKALA",
  status_hukum: "STATUS_HUKUM",
  status_usaha: "STATUS_USAHA",
  quality_geography: "QUALITY_GEOGRAPHY",
  quality_kbli: "QUALITY_KBLI",
  omzet_tahunan: "OMZET_TAHUNAN",
  total_aset: "TOTAL_ASET",
  usaha_id: "USAHA_ID",
  usaha_nama: "USAHA_NAMA",
  kegiatan_utama: "KEGIATAN_UTAMA",
  produk_utama: "PRODUK_UTAMA",
  owner_name: "OWNER_NAME",
  masked_nik: "MASKED_NIK",
  masked_phone: "MASKED_PHONE",
  age_band: "AGE_BAND",
  business_address: "BUSINESS_ADDRESS",
  latitude: "LATITUDE",
  longitude: "LONGITUDE",
});
const KBLI_SECTORS = Object.freeze([
  ["A", "Pertanian, Kehutanan, dan Perikanan", 1, 3],
  ["B", "Pertambangan dan Penggalian", 5, 9],
  ["C", "Industri Pengolahan (Manufaktur/Kerajinan)", 10, 33],
  ["D", "Pengadaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin", 35, 35],
  ["E", "Pengelolaan Air, Limbah, Sampah, dan Aktivitas Remediasi", 36, 39],
  ["F", "Konstruksi", 41, 43],
  ["G", "Perdagangan Besar dan Eceran; Reparasi Kendaraan", 45, 47],
  ["H", "Pengangkutan dan Pergudangan", 49, 53],
  ["I", "Penyediaan Akomodasi dan Makan Minum", 55, 56],
  ["J", "Informasi dan Komunikasi", 58, 63],
  ["K", "Aktivitas Keuangan dan Asuransi", 64, 66],
  ["L", "Real Estat", 68, 68],
  ["M", "Aktivitas Profesional, Ilmiah, dan Teknis", 69, 75],
  [
    "N",
    "Aktivitas Penyewaan, Ketenagakerjaan, Agen Perjalanan, dan Penunjang Usaha",
    77,
    82,
  ],
  [
    "O",
    "Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib",
    84,
    84,
  ],
  ["P", "Pendidikan", 85, 85],
  ["Q", "Aktivitas Kesehatan Manusia dan Aktivitas Sosial", 86, 88],
  ["R", "Kesenian, Hiburan, dan Rekreasi", 90, 93],
  ["S", "Aktivitas Jasa Lainnya", 94, 96],
  [
    "T",
    "Aktivitas Rumah Tangga sebagai Pemberi Kerja; Aktivitas yang Menghasilkan Barang dan Jasa oleh Rumah Tangga untuk Kebutuhan Sendiri",
    97,
    98,
  ],
  [
    "U",
    "Aktivitas Badan Internasional dan Badan Ekstra Internasional Lainnya",
    99,
    99,
  ],
]);
const FORBIDDEN_CONFIG_KEYS = new Set([
  "notes",
  "result",
  "results",
  "rows",
  "conclusion",
  "shortlist",
  "token",
  "password",
  "nik",
  "phone",
  "birth_date",
  "record_id",
  "recordId",
  "cursor",
  "scroll",
]);
const PII_KEY_RE =
  /(nik|phone|telepon|birth|password|secret|token|cookie|domisili|owner_address|signed_url)/i;
function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function sanitizeError(error) {
  return {
    code: error?.code || "INTERNAL_SERVER_ERROR",
    message: "Permintaan tidak dapat diproses.",
  };
}
function containsForbiddenConfig(value, path = "config") {
  if (Array.isArray(value))
    return value.some((item, index) =>
      containsForbiddenConfig(item, `${path}[${index}]`),
    );
  if (typeof value === "string")
    return (
      PII_KEY_RE.test(value) ||
      /^\d{16}$/.test(value) ||
      /^(?:\+62|62|08)\d{8,13}$/.test(value)
    );
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      FORBIDDEN_CONFIG_KEYS.has(key) ||
      PII_KEY_RE.test(key) ||
      containsForbiddenConfig(child, `${path}.${key}`),
  );
}
function assertSafeAnalysisConfig(config) {
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    containsForbiddenConfig(config)
  )
    throw Object.assign(new Error("Invalid analysis configuration"), {
      code: "INVALID_ANALYSIS_CONFIG",
    });
  const serialized = JSON.stringify(config);
  if (serialized.length > 64_000)
    throw Object.assign(new Error("Analysis configuration is too large"), {
      code: "INVALID_ANALYSIS_CONFIG",
    });
  return config;
}
module.exports = {
  SCHEMA_VERSION,
  MASKING_VERSION,
  APPLICATION_ROLE_ID,
  ANALYTICS_POLICY_ID,
  QUERY_BUDGET,
  LIVE_JOB_STATUSES,
  JOB_STATUSES,
  GENERATION_STATUSES,
  FIELD_STATUSES,
  EXPRESSION_KEYS,
  KBLI_SECTORS,
  FORBIDDEN_CONFIG_KEYS,
  assertEnum,
  sanitizeError,
  containsForbiddenConfig,
  assertSafeAnalysisConfig,
};
