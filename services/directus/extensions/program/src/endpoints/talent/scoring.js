/**
 * Talent Index: four dimensions of 0–100, weighted 25% each (Brief Fitur, Modul 4).
 *
 * PLACEHOLDER RUBRIC. The brief does not define how raw inputs map to each sub-score; the real
 * rubric must come from DISKUK or the BI methodology document. Every score stored with this
 * rubric carries RUBRIK_VERSI so it can be recomputed once the real one arrives.
 */
export const RUBRIK_VERSI = "placeholder-v0";

export const WEIGHTS = Object.freeze({ finansial: 0.25, pasar: 0.25, legalitas: 0.25, sdm: 0.25 });

export const JENIS_LEGALITAS = Object.freeze(["halal", "pirt", "bpom", "hki", "sni", "umku"]);

const round2 = (value) => Math.round(value * 100) / 100;
const clamp = (value) => Math.min(100, Math.max(0, value));

/** Annual turnover tiers in rupiah; 2 miliar is the micro ceiling of PP 7/2021. */
function omzetTier(omzet) {
  const value = Number(omzet);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 50_000_000) return 25;
  if (value < 300_000_000) return 50;
  if (value < 2_000_000_000) return 75;
  return 100;
}

/**
 * @param {object} input
 * @param {number|null} input.omzetTahunan
 * @param {number|null} input.kapasitasProduksi
 * @param {boolean} input.literasiQris
 * @param {boolean} input.literasiPembukuanDigital
 * @param {boolean} input.suratKomitmen      commitment letter uploaded
 * @param {boolean} input.nib                business has an NIB
 * @param {Record<string, string>} input.legalitas  best status per jenis: "terbit" | "dalam_proses"
 * @param {number} input.tenagaKerja
 */
export function hitungSkor(input) {
  const finansial = clamp(0.7 * omzetTier(input.omzetTahunan) + (input.literasiPembukuanDigital ? 30 : 0));

  const pasar = clamp((input.literasiQris ? 50 : 0) + (Number(input.kapasitasProduksi) > 0 ? 50 : 0));

  let sertifikat = 0;
  for (const jenis of JENIS_LEGALITAS) {
    const status = input.legalitas?.[jenis];
    if (status === "terbit") sertifikat += 20;
    else if (status === "dalam_proses") sertifikat += 10;
  }
  const legalitas = clamp((input.nib ? 40 : 0) + Math.min(60, sertifikat));

  const tenagaKerja = Math.max(0, Number(input.tenagaKerja) || 0);
  const sdm = clamp((input.suratKomitmen ? 50 : 0) + Math.min(50, tenagaKerja * 10));

  const total = WEIGHTS.finansial * finansial + WEIGHTS.pasar * pasar + WEIGHTS.legalitas * legalitas + WEIGHTS.sdm * sdm;
  return {
    finansial: round2(finansial),
    pasar: round2(pasar),
    legalitas: round2(legalitas),
    sdm: round2(sdm),
    total: round2(total),
    rubrikVersi: RUBRIK_VERSI,
  };
}

/**
 * Best known status per jenis: a verified certificate (usaha_legalitas) beats the applicant's
 * self-declared readiness, and "terbit" beats "dalam_proses".
 */
export function mergeLegalitas(certificates, kesiapan) {
  const rank = { terbit: 2, dalam_proses: 1 };
  const merged = {};
  const consider = (jenis, status) => {
    if (!JENIS_LEGALITAS.includes(jenis) || !rank[status]) return;
    if ((rank[merged[jenis]] ?? 0) < rank[status]) merged[jenis] = status;
  };
  for (const item of certificates ?? []) consider(item.jenis, item.status);
  for (const [jenis, status] of Object.entries(kesiapan ?? {})) consider(jenis, status);
  return merged;
}
