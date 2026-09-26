"use strict";

// Talent Index v1 — rubrik deterministik 4 aspek × 25%.
// Ledger: legacy/main_plan.md § "Talent Index v1".
// null diperlakukan sebagai false/0 (data hilang → aspek terkait 0).

const RUBRIK_VERSI = 1;

const OMZET_ACUAN = 600_000_000;
const KAPASITAS_ACUAN = 1000;
const TENAGA_KERJA_ACUAN = 10;

function bool(value) {
  return value === true;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function rekomendasiOf(total) {
  if (total >= 75) return "Direkomendasikan Masuk Talent Pool";
  if (total >= 60) return "Dipertimbangkan";
  return "Belum Direkomendasikan";
}

function hitungTalentIndex(input = {}) {
  const atribut = input.atribut ?? {};
  const form = input.form ?? {};
  const omzet = Number(input.omzetTahunan);
  const omzetRatio = Number.isFinite(omzet) && omzet > 0 ? Math.min(omzet / OMZET_ACUAN, 1) : 0;

  const finansial =
    70 * omzetRatio +
    15 * (bool(form.pencatatanKeuanganDigital) ? 1 : 0) +
    15 * (bool(atribut.akses_kur) ? 1 : 0);

  const kapasitas = Number(form.kapasitasProduksiBulanan);
  const kapasitasRatio =
    Number.isFinite(kapasitas) && kapasitas > 0 ? Math.min(kapasitas / KAPASITAS_ACUAN, 1) : 0;
  const pasar =
    25 * (bool(atribut.ecommerce) ? 1 : 0) +
    25 * (bool(atribut.medsos_bisnis) ? 1 : 0) +
    25 * (bool(form.adopsiQris) ? 1 : 0) +
    25 * kapasitasRatio;

  const legalitas =
    20 * (input.nibAda === true || bool(input.nibAda) ? 1 : 0) +
    20 * (bool(atribut.npwp_usaha) ? 1 : 0) +
    20 * (bool(form.kesiapanHalal) || bool(atribut.sertifikat_halal) ? 1 : 0) +
    20 * (bool(form.kesiapanPirtBpom) || bool(atribut.pirt_bpom) ? 1 : 0) +
    20 * (bool(form.kesiapanHki) || bool(atribut.hki_merek) ? 1 : 0);

  const tk = Number(input.totalTenagaKerja);
  const tkRatio = Number.isFinite(tk) && tk > 0 ? Math.min(tk / TENAGA_KERJA_ACUAN, 1) : 0;
  const sdm =
    30 * tkRatio +
    20 * (bool(atribut.rekening_terpisah) ? 1 : 0) +
    20 * (bool(atribut.sop_tertulis) ? 1 : 0) +
    30 * (bool(form.suratKomitmenAda) ? 1 : 0);

  const out = {
    finansial: round2(finansial),
    pasar: round2(pasar),
    legalitas: round2(legalitas),
    sdm: round2(sdm),
    total: 0,
    rekomendasi: "",
    rubrikVersi: RUBRIK_VERSI,
  };
  out.total = round2((out.finansial + out.pasar + out.legalitas + out.sdm) / 4);
  out.rekomendasi = rekomendasiOf(out.total);
  return out;
}

module.exports = { RUBRIK_VERSI, hitungTalentIndex, rekomendasiOf };
