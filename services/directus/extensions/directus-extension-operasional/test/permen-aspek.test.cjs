"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getAspekPerkembangan } = require("../src/permen-aspek.js");

test("lima aspek menghitung ya atas seluruh UMKM dalam filter dan memisahkan data kosong", async () => {
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
    ya: 20, tidak: 10, diketahui: 30, belumAdaData: 70, total: 100, persentase: 20,
  });
  assert.equal(result.data.aspek[0].indikator[0].persentase, 80);
  assert.equal(result.data.definisiVersi, "indikator-operasional-v3");
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
    ya: 4, tidak: 0, diketahui: 4, belumAdaData: 6, total: 10, persentase: 40,
  });
  const sdm = manajemen.indikator.find((i) => i.id === "peningkatan_kapasitas_sdm");
  assert.equal(sdm.ya, 4);
  assert.equal(result.data.aspek.length, 5, "struktur lima aspek R01 tidak berubah");
  assert.ok(calls[0].sql.includes("kegiatan_sertifikat_dampak"));
  assert.ok(calls[0].sql.includes("d.aktif = TRUE"));
});

test("hasil per filter wilayah disimpan: query berat tidak diulang, filter lain dan kegagalan tidak ikut tersimpan", async () => {
  let calls = 0;
  let gagal = true;
  const database = { raw: async () => {
    calls += 1;
    if (gagal) throw new Error("timeout");
    return { rows: [{ total: 7 }] };
  } };
  await assert.rejects(getAspekPerkembangan(database, {}, { role: "provinsi" }), /timeout/);
  gagal = false;
  const [a, b] = await Promise.all([
    getAspekPerkembangan(database, {}, { role: "provinsi" }),
    getAspekPerkembangan(database, {}, { role: "provinsi" }),
  ]);
  assert.equal(calls, 2, "kegagalan tidak disimpan; dua permintaan bersamaan berbagi satu query");
  assert.equal(a.data.totalUsaha, 7);
  assert.equal(b.data.totalUsaha, 7);
  await getAspekPerkembangan(database, { kota: "3" }, { role: "provinsi" });
  assert.equal(calls, 3, "filter berbeda = query sendiri");
  await getAspekPerkembangan(database, {}, { role: "provinsi" });
  assert.equal(calls, 3);
});

test("thenable knex dijalankan sekali walau hasil cache dipakai berulang", async () => {
  let eksekusi = 0;
  // Meniru knex.raw: query berjalan setiap kali `.then` dipanggil.
  const database = { raw: () => ({ then: (ok, gagal) => { eksekusi += 1; return Promise.resolve({ rows: [{ total: 1 }] }).then(ok, gagal); } }) };
  await getAspekPerkembangan(database, { kota: "4" }, { role: "provinsi" });
  await getAspekPerkembangan(database, { kota: "4" }, { role: "provinsi" });
  assert.equal(eksekusi, 1);
});

test("total nol menghasilkan persentase null", async () => {
  const database = { raw: async () => ({ rows: [{ total: 0 }] }) };
  const result = await getAspekPerkembangan(database, {}, { role: "provinsi" });
  const indikator = result.data.aspek.flatMap((aspek) => aspek.indikator);
  assert.ok(indikator.length > 0);
  for (const item of indikator) {
    assert.equal(item.total, 0);
    assert.equal(item.persentase, null);
  }
});
