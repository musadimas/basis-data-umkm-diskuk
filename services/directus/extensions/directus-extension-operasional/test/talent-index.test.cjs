"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { RUBRIK_VERSI, hitungTalentIndex } = require("../src/talent-index.js");

test("rubrik versi = 1", () => {
  assert.equal(RUBRIK_VERSI, 1);
});

// Vektor A: usaha dummy 01 — semua kesiapan true, TK 7, kapasitas 1200 unit.
test("vektor A → 100/100/100/91 total 97.75 Direkomendasikan", () => {
  const out = hitungTalentIndex({
    omzetTahunan: 600_000_000,
    nibAda: true,
    totalTenagaKerja: 7,
    atribut: {
      npwp_usaha: true,
      sertifikat_halal: true,
      pirt_bpom: true,
      hki_merek: true,
      rekening_terpisah: true,
      sop_tertulis: true,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: true,
    },
    form: {
      kapasitasProduksiBulanan: 1200,
      kesiapanHalal: true,
      kesiapanPirtBpom: true,
      kesiapanHki: true,
      adopsiQris: true,
      pencatatanKeuanganDigital: true,
      suratKomitmenAda: true,
    },
  });
  assert.deepEqual(
    [out.finansial, out.pasar, out.legalitas, out.sdm, out.total],
    [100, 100, 100, 91, 97.75],
  );
  assert.equal(out.rekomendasi, "Direkomendasikan Masuk Talent Pool");
  assert.equal(out.rubrikVersi, 1);
});

// Vektor B: omzet 300jt, kur false, hki false, kapasitas 500, TK 10.
test("vektor B → 50/87.5/80/100 total 79.38", () => {
  const out = hitungTalentIndex({
    omzetTahunan: 300_000_000,
    nibAda: true,
    totalTenagaKerja: 10,
    atribut: {
      npwp_usaha: true,
      sertifikat_halal: true,
      pirt_bpom: true,
      hki_merek: false,
      rekening_terpisah: true,
      sop_tertulis: true,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: false,
    },
    form: {
      kapasitasProduksiBulanan: 500,
      kesiapanHalal: true,
      kesiapanPirtBpom: true,
      kesiapanHki: false,
      adopsiQris: true,
      pencatatanKeuanganDigital: true,
      suratKomitmenAda: true,
    },
  });
  assert.deepEqual(
    [out.finansial, out.pasar, out.legalitas, out.sdm, out.total],
    [50, 87.5, 80, 100, 79.38],
  );
  assert.equal(out.rekomendasi, "Direkomendasikan Masuk Talent Pool");
});

// Vektor C: semua null/0.
test("vektor C kosong → 0 Belum Direkomendasikan", () => {
  const out = hitungTalentIndex({
    omzetTahunan: null,
    nibAda: false,
    totalTenagaKerja: 0,
    atribut: {
      npwp_usaha: null,
      sertifikat_halal: null,
      pirt_bpom: null,
      hki_merek: null,
      rekening_terpisah: null,
      sop_tertulis: null,
      ecommerce: null,
      medsos_bisnis: null,
      akses_kur: null,
    },
    form: {
      kapasitasProduksiBulanan: 0,
      kesiapanHalal: false,
      kesiapanPirtBpom: false,
      kesiapanHki: false,
      adopsiQris: false,
      pencatatanKeuanganDigital: false,
      suratKomitmenAda: false,
    },
  });
  assert.deepEqual([out.finansial, out.pasar, out.legalitas, out.sdm, out.total], [0, 0, 0, 0, 0]);
  assert.equal(out.rekomendasi, "Belum Direkomendasikan");
});

test("batas 60 tepat → Dipertimbangkan; 75 tepat → Direkomendasikan", () => {
  // (100+100+20+20)/4 = 60 tepat.
  const at60 = hitungTalentIndex({
    omzetTahunan: 600_000_000,
    nibAda: true,
    totalTenagaKerja: 0,
    atribut: {
      npwp_usaha: false,
      sertifikat_halal: false,
      pirt_bpom: false,
      hki_merek: false,
      rekening_terpisah: true,
      sop_tertulis: false,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: true,
    },
    form: {
      pencatatanKeuanganDigital: true,
      kapasitasProduksiBulanan: 1000,
      adopsiQris: true,
      kesiapanHalal: false,
      kesiapanPirtBpom: false,
      kesiapanHki: false,
      suratKomitmenAda: false,
    },
  });
  assert.deepEqual([at60.finansial, at60.pasar, at60.legalitas, at60.sdm, at60.total], [100, 100, 20, 20, 60]);
  assert.equal(at60.rekomendasi, "Dipertimbangkan");

  // (100+100+100+0)/4 = 75 tepat.
  const at75 = hitungTalentIndex({
    omzetTahunan: 600_000_000,
    nibAda: true,
    totalTenagaKerja: 0,
    atribut: {
      npwp_usaha: true,
      sertifikat_halal: true,
      pirt_bpom: true,
      hki_merek: true,
      rekening_terpisah: false,
      sop_tertulis: false,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: true,
    },
    form: {
      pencatatanKeuanganDigital: true,
      kapasitasProduksiBulanan: 1000,
      adopsiQris: true,
      kesiapanHalal: false,
      kesiapanPirtBpom: false,
      kesiapanHki: false,
      suratKomitmenAda: false,
    },
  });
  assert.deepEqual([at75.finansial, at75.pasar, at75.legalitas, at75.sdm, at75.total], [100, 100, 100, 0, 75]);
  assert.equal(at75.rekomendasi, "Direkomendasikan Masuk Talent Pool");
});

test("vektor seed Y02 (omzet/TK seed Y01) cocok dengan literal seed SQL", () => {
  // Omzet/TK dari seed-dummy-operasional.sql Y01; atribut/form dari legacy/phase_6.md.
  const rows = [
    {
      omzet: 780_000_000, tk: 7,
      atribut: { npwp_usaha: true, sertifikat_halal: true, pirt_bpom: true, hki_merek: true, rekening_terpisah: true, sop_tertulis: true, ecommerce: true, medsos_bisnis: true, akses_kur: true },
      form: { kapasitasProduksiBulanan: 1200, kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: true, adopsiQris: true, pencatatanKeuanganDigital: true, suratKomitmenAda: true },
      expect: [100, 100, 100, 91, 97.75],
    },
    {
      omzet: 420_000_000, tk: 6,
      atribut: { npwp_usaha: true, sertifikat_halal: true, pirt_bpom: true, hki_merek: false, rekening_terpisah: true, sop_tertulis: false, ecommerce: true, medsos_bisnis: true, akses_kur: true },
      form: { kapasitasProduksiBulanan: 3000, kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: false, adopsiQris: true, pencatatanKeuanganDigital: false, suratKomitmenAda: true },
      expect: [64, 100, 80, 68, 78],
    },
    {
      omzet: 950_000_000, tk: 8,
      atribut: { npwp_usaha: true, sertifikat_halal: true, pirt_bpom: true, hki_merek: true, rekening_terpisah: true, sop_tertulis: true, ecommerce: true, medsos_bisnis: true, akses_kur: false },
      form: { kapasitasProduksiBulanan: 800, kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: true, adopsiQris: true, pencatatanKeuanganDigital: true, suratKomitmenAda: true },
      expect: [85, 95, 100, 94, 93.5],
    },
    {
      omzet: 300_000_000, tk: 6,
      atribut: { npwp_usaha: false, sertifikat_halal: false, pirt_bpom: false, hki_merek: true, rekening_terpisah: false, sop_tertulis: false, ecommerce: true, medsos_bisnis: true, akses_kur: false },
      form: { kapasitasProduksiBulanan: 150, kesiapanHalal: false, kesiapanPirtBpom: false, kesiapanHki: true, adopsiQris: true, pencatatanKeuanganDigital: false, suratKomitmenAda: true },
      expect: [35, 78.75, 40, 48, 50.44],
    },
    {
      omzet: 240_000_000, tk: 4,
      atribut: { npwp_usaha: true, sertifikat_halal: true, pirt_bpom: true, hki_merek: false, rekening_terpisah: true, sop_tertulis: true, ecommerce: true, medsos_bisnis: true, akses_kur: false },
      form: { kapasitasProduksiBulanan: 600, kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: false, adopsiQris: true, pencatatanKeuanganDigital: true, suratKomitmenAda: true },
      expect: [43, 90, 80, 82, 73.75],
    },
    {
      omzet: 150_000_000, tk: 4,
      atribut: { npwp_usaha: false, sertifikat_halal: false, pirt_bpom: false, hki_merek: false, rekening_terpisah: false, sop_tertulis: false, ecommerce: false, medsos_bisnis: true, akses_kur: false },
      form: { kapasitasProduksiBulanan: 100, kesiapanHalal: false, kesiapanPirtBpom: false, kesiapanHki: false, adopsiQris: false, pencatatanKeuanganDigital: false, suratKomitmenAda: false },
      expect: [17.5, 27.5, 20, 12, 19.25],
    },
    {
      omzet: 360_000_000, tk: 4,
      atribut: { npwp_usaha: true, sertifikat_halal: true, pirt_bpom: true, hki_merek: true, rekening_terpisah: true, sop_tertulis: true, ecommerce: true, medsos_bisnis: true, akses_kur: true },
      form: { kapasitasProduksiBulanan: 900, kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: true, adopsiQris: true, pencatatanKeuanganDigital: true, suratKomitmenAda: true },
      expect: [72, 97.5, 100, 82, 87.88],
    },
  ];
  for (const [i, row] of rows.entries()) {
    const out = hitungTalentIndex({
      omzetTahunan: row.omzet,
      nibAda: true,
      totalTenagaKerja: row.tk,
      atribut: row.atribut,
      form: row.form,
    });
    assert.deepEqual(
      [out.finansial, out.pasar, out.legalitas, out.sdm, out.total],
      row.expect,
      `seed 0${i + 1}`,
    );
  }
});
test("deterministik: input sama → output sama", () => {
  const input = {
    omzetTahunan: 123_456_789,
    nibAda: true,
    totalTenagaKerja: 3,
    atribut: { npwp_usaha: true, ecommerce: true },
    form: { kapasitasProduksiBulanan: 333, adopsiQris: true, suratKomitmenAda: true },
  };
  assert.deepEqual(hitungTalentIndex(input), hitungTalentIndex(input));
});

test("kesiapan form dapat menggantikan sertifikat atribut (OR)", () => {
  const base = {
    omzetTahunan: 0,
    nibAda: false,
    totalTenagaKerja: 0,
    atribut: { npwp_usaha: false, sertifikat_halal: false, pirt_bpom: false, hki_merek: false },
    form: { kesiapanHalal: true, kesiapanPirtBpom: true, kesiapanHki: true },
  };
  assert.equal(hitungTalentIndex(base).legalitas, 60);
});
