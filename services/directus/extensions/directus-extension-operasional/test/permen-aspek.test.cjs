"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getAspekPerkembangan } = require("../src/permen-aspek.js");

test("lima aspek menghitung ya dari data diketahui dan memisahkan data kosong", async () => {
  const calls = [];
  const database = { raw: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ total: 100, nib_ya: 80, nib_tidak: 0, npwp_usaha_ya: 20, npwp_usaha_tidak: 10 }] };
  } };
  const result = await getAspekPerkembangan(database, { kota: "9" }, { role: "provinsi" });
  assert.equal(result.data.aspek.length, 5);
  assert.deepEqual(calls[0].params, [9]);
  assert.match(calls[0].sql, /t\.kota_id = \?/);
  assert.match(calls[0].sql, /LEFT JOIN usaha_atribut_jabar/);
  assert.deepEqual(result.data.aspek[0].indikator[1], {
    id: "npwp_usaha", label: "NPWP usaha", sumber: "usaha_atribut_jabar.npwp_usaha",
    ya: 20, tidak: 10, diketahui: 30, belumAdaData: 70, persentase: 66.7,
  });
  assert.equal(result.data.kepatuhanRegulasi, false);
});

test("kabkota memaksa kota_scope walau query meminta kota lain", async () => {
  const calls = [];
  const database = { raw: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ total: 0 }] }; } };
  await getAspekPerkembangan(database, { kota: "99", kecamatan: "13" }, { role: "kabkota", kotaId: 5 });
  assert.deepEqual(calls[0].params, [5, 13]);
  await assert.rejects(
    getAspekPerkembangan(database, { kota: "1 OR TRUE" }, { role: "provinsi" }),
    (error) => error.statusCode === 400 && error.code === "WILAYAH_TIDAK_VALID",
  );
});

// ── R03: dua indikator dampak IP-UMKM dari sertifikat aktif (additif) ──
test("indikator dampak IP-UMKM membaca sertifikat aktif; tanpa sertifikat = belum ada data", async () => {
  const calls = [];
  const database = { raw: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ total: 10, bukti_pelatihan_manajemen_ya: 4, bukti_pelatihan_manajemen_tidak: 0, peningkatan_kapasitas_sdm_ya: 4, peningkatan_kapasitas_sdm_tidak: 0 }] };
  } };
  const result = await getAspekPerkembangan(database, {}, { role: "provinsi" });
  const manajemen = result.data.aspek.find((a) => a.id === "manajemen");
  assert.equal(manajemen.indikator.length, 4);
  const pelatihan = manajemen.indikator.find((i) => i.id === "bukti_pelatihan_manajemen");
  assert.deepEqual(pelatihan, {
    id: "bukti_pelatihan_manajemen", label: "Bukti pelatihan manajemen", sumber: "kegiatan_sertifikat_dampak.atribut",
    ya: 4, tidak: 0, diketahui: 4, belumAdaData: 6, persentase: 100,
  });
  const sdm = manajemen.indikator.find((i) => i.id === "peningkatan_kapasitas_sdm");
  assert.equal(sdm.ya, 4);
  assert.equal(result.data.aspek.length, 5, "struktur lima aspek R01 tidak berubah");
  assert.ok(calls[0].sql.includes("kegiatan_sertifikat_dampak"));
  assert.ok(calls[0].sql.includes("d.aktif = TRUE"));
});
