"use strict";

const { OperasionalError } = require("./errors.js");

// These are descriptive SIDT/field indicators, not a legal-compliance verdict.
// The two IP-UMKM impact indicators (R03) come from issued e-certificates
// (kegiatan_sertifikat_dampak): absence means "belum ada data", never "tidak".
// Since R04 an attribute indicator is also "ya" when a verified clinic outcome
// (konsultasi_outcome, status terverifikasi) names that attribute; a revoked or
// still-pending outcome contributes nothing. Never overrides a field "ya" with "tidak".
const ASPEK = [
  { id: "legalitas", label: "Legalitas dan formalitas", indicators: [
    ["nib", "NIB tercatat", "usaha.nib"],
    ["npwp_usaha", "NPWP usaha", "usaha_atribut_jabar.npwp_usaha"],
    ["izin_edar", "Izin edar", "usaha_atribut_jabar.izin_edar"],
  ] },
  { id: "manajemen", label: "Manajemen dan tata kelola", indicators: [
    ["rekening_terpisah", "Rekening terpisah", "usaha_atribut_jabar.rekening_terpisah"],
    ["sop_tertulis", "SOP tertulis", "usaha_atribut_jabar.sop_tertulis"],
    ["bukti_pelatihan_manajemen", "Bukti pelatihan manajemen", "kegiatan_sertifikat_dampak.atribut"],
    ["peningkatan_kapasitas_sdm", "Peningkatan kapasitas SDM", "kegiatan_sertifikat_dampak.capaian"],
  ] },
  { id: "pemasaran", label: "Pemasaran dan digitalisasi", indicators: [
    ["ecommerce", "E-commerce", "usaha_atribut_jabar.ecommerce"],
    ["medsos_bisnis", "Media sosial bisnis", "usaha_atribut_jabar.medsos_bisnis"],
  ] },
  { id: "keuangan", label: "Keuangan dan akses pembiayaan", indicators: [
    ["pembukuan_digital", "Pembukuan digital", "usaha_atribut_jabar.pembukuan_digital"],
    ["akses_kur", "Akses KUR", "usaha_atribut_jabar.akses_kur"],
  ] },
  { id: "kemitraan", label: "Kemitraan dan jejaring", indicators: [
    ["rantai_pasok_industri", "Rantai pasok industri", "usaha_atribut_jabar.rantai_pasok_industri"],
    ["kontrak_offtaker", "Kontrak offtaker", "usaha_atribut_jabar.kontrak_offtaker"],
  ] },
];

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];
const parseId = (value) => {
  if (value === undefined || value === null || value === "semua" || value === "") return null;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new OperasionalError(400, "WILAYAH_TIDAK_VALID", "Filter wilayah tidak valid.");
  }
  return Number(value);
};

// Ekspresi non-default: NIB dari kolom usaha, dua indikator dampak IP-UMKM dari
// sertifikat aktif (dicabut ⇒ aktif = FALSE sehingga otomatis keluar dari hitungan).
const EKSPRESI = {
  nib: "CASE WHEN NULLIF(BTRIM(u.nib), '') IS NOT NULL THEN TRUE ELSE NULL END",
  bukti_pelatihan_manajemen: "CASE WHEN EXISTS (SELECT 1 FROM kegiatan_sertifikat_dampak d WHERE d.usaha = t.id AND d.aktif = TRUE AND d.atribut = 'bukti_pelatihan_manajemen') THEN TRUE ELSE NULL END",
  peningkatan_kapasitas_sdm: "CASE WHEN EXISTS (SELECT 1 FROM kegiatan_sertifikat_dampak d WHERE d.usaha = t.id AND d.aktif = TRUE AND d.capaian = 'peningkatan_kapasitas_sdm') THEN TRUE ELSE NULL END",
};

// Indikator yang bersumber dari kolom usaha_atribut_jabar (semua yang tidak punya ekspresi khusus).
const ATRIBUT_KEYS = ASPEK.flatMap((aspek) => aspek.indicators).map(([key]) => key).filter((key) => !EKSPRESI[key]);

// Satu agregat outcome klinik terverifikasi per usaha, di-join sekali (bukan EXISTS per baris per indikator).
const KLINIK_CTE = `klinik AS (
       SELECT o.usaha, ${ATRIBUT_KEYS.map((key) => `BOOL_OR(i.atribut = '${key}') AS ${key}`).join(", ")}
         FROM konsultasi_outcome o
         JOIN konsultasi_outcome_item i ON i.outcome = o.id
        WHERE o.status = 'terverifikasi'
        GROUP BY o.usaha
     )`;

function columnsForQuery() {
  return ASPEK.flatMap((aspek) => aspek.indicators).flatMap(([key]) => {
    const value = EKSPRESI[key] ?? `CASE WHEN a.${key} IS TRUE OR k.${key} IS TRUE THEN TRUE ELSE a.${key} END`;
    return [
      `COUNT(*) FILTER (WHERE (${value}) IS TRUE)::int AS ${key}_ya`,
      `COUNT(*) FILTER (WHERE (${value}) IS FALSE)::int AS ${key}_tidak`,
    ];
  });
}

async function getAspekPerkembangan(database, query, operator) {
  const kota = operator.role === "kabkota" ? parseId(operator.kotaId) : parseId(query.kota);
  if (operator.role === "kabkota" && kota === null) {
    throw new OperasionalError(403, "KOTA_NOT_ASSIGNED", "Wilayah akun belum ditetapkan.");
  }
  const kecamatan = parseId(query.kecamatan);
  const kelurahan = parseId(query.kelurahan);
  const clauses = [];
  const params = [];
  for (const [column, value] of [["t.kota_id", kota], ["t.kecamatan_id", kecamatan], ["t.kelurahan_id", kelurahan]]) {
    if (value !== null) {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }
  const result = await database.raw(
    `WITH ${KLINIK_CTE}
     SELECT COUNT(*)::int AS total, ${columnsForQuery().join(", ")}
     FROM usaha_tabular t
     LEFT JOIN usaha u ON u.id = t.id
     LEFT JOIN usaha_atribut_jabar a ON a.usaha = t.id
     LEFT JOIN klinik k ON k.usaha = t.id
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}`,
    params,
  );
  const counts = rowsOf(result)[0] ?? {};
  const total = Number(counts.total ?? 0);
  return { data: {
    totalUsaha: total,
    sumber: "Snapshot usaha_tabular, usaha, usaha_atribut_jabar, kegiatan_sertifikat_dampak (indikator dampak), dan konsultasi_outcome terverifikasi (hasil klinik)",
    definisiVersi: "indikator-operasional-v2",
    kepatuhanRegulasi: false,
    aspek: ASPEK.map((aspek) => ({
      id: aspek.id,
      label: aspek.label,
      indikator: aspek.indicators.map(([id, label, sumber]) => {
        const ya = Number(counts[`${id}_ya`] ?? 0);
        const tidak = Number(counts[`${id}_tidak`] ?? 0);
        const diketahui = ya + tidak;
        return {
          id, label, sumber, ya, tidak, diketahui,
          belumAdaData: Math.max(0, total - diketahui),
          persentase: diketahui ? Math.round((ya / diketahui) * 1000) / 10 : null,
        };
      }),
    })),
  } };
}

module.exports = { getAspekPerkembangan, ASPEK };
