import assert from "node:assert/strict";
import test from "node:test";
import { RUBRIK_VERSI, WEIGHTS, hitungSkor, mergeLegalitas, rekomendasiOf } from "../src/endpoints/talent/scoring.js";

const empty = {
  omzetTahunan: null,
  kapasitasProduksi: null,
  literasiQris: false,
  literasiPembukuanDigital: false,
  suratKomitmen: false,
  nib: false,
  legalitas: {},
  tenagaKerja: 0,
};

test("the four weights are 25% each and sum to 1", () => {
  assert.deepEqual(Object.values(WEIGHTS), [0.25, 0.25, 0.25, 0.25]);
});

test("rekomendasi thresholds match domain rules (>=75 recommended, >=60 considered, else not recommended)", () => {
  assert.equal(rekomendasiOf(0), "Belum Direkomendasikan");
  assert.equal(rekomendasiOf(59.99), "Belum Direkomendasikan");
  assert.equal(rekomendasiOf(60), "Dipertimbangkan");
  assert.equal(rekomendasiOf(74.99), "Dipertimbangkan");
  assert.equal(rekomendasiOf(75), "Direkomendasikan Masuk Talent Pool");
  assert.equal(rekomendasiOf(100), "Direkomendasikan Masuk Talent Pool");
});

test("an empty submission scores zero and is tagged with the placeholder rubric", () => {
  assert.deepEqual(hitungSkor(empty), {
    finansial: 0,
    pasar: 0,
    legalitas: 0,
    sdm: 0,
    total: 0,
    rekomendasi: "Belum Direkomendasikan",
    rubrikVersi: RUBRIK_VERSI,
  });
  assert.equal(RUBRIK_VERSI, "placeholder-v0");
});

test("a complete submission scores 100 on every dimension", () => {
  const skor = hitungSkor({
    omzetTahunan: 5_000_000_000,
    kapasitasProduksi: 1000,
    literasiQris: true,
    literasiPembukuanDigital: true,
    suratKomitmen: true,
    nib: true,
    legalitas: { halal: "terbit", pirt: "terbit", bpom: "terbit" },
    tenagaKerja: 12,
  });
  assert.deepEqual([skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.total], [100, 100, 100, 100, 100]);
  assert.equal(skor.rekomendasi, "Direkomendasikan Masuk Talent Pool");
});

test("turnover tiers, certificate credit and workforce are capped as documented", () => {
  const skor = hitungSkor({
    ...empty,
    omzetTahunan: 100_000_000, // tier 50 → 35
    literasiQris: true, // 50
    nib: true, // 40
    legalitas: { halal: "terbit", pirt: "dalam_proses" }, // 20 + 10
    tenagaKerja: 3, // 30
  });
  assert.equal(skor.finansial, 35);
  assert.equal(skor.pasar, 50);
  assert.equal(skor.legalitas, 70);
  assert.equal(skor.sdm, 30);
  assert.equal(skor.total, 46.25);
});

test("garbage inputs never produce NaN or out-of-range scores", () => {
  const skor = hitungSkor({ ...empty, omzetTahunan: "abc", kapasitasProduksi: -5, tenagaKerja: "x", legalitas: { foo: "terbit" } });
  for (const value of [skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.total]) {
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
  }
});

test("verified certificates and self-declared readiness merge to the best status per jenis", () => {
  const merged = mergeLegalitas(
    [
      { jenis: "halal", status: "dalam_proses" },
      { jenis: "pirt", status: "kedaluwarsa" },
    ],
    { halal: "terbit", bpom: "dalam_proses", sni: "belum", bogus: "terbit" },
  );
  assert.deepEqual(merged, { halal: "terbit", bpom: "dalam_proses" });
});
