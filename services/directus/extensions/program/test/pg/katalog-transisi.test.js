import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import registerKatalog from "../../src/endpoints/katalog/index.js";
import { KURASI_FOLDER_ID } from "../../src/endpoints/katalog/service.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatFile, buatKota, buatProduk, buatUsaha, buatUser, pasangFoto } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const kode = (hasil) => hasil.res.body.errors[0].extensions.code;

async function siapkan(t) {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const usaha = await buatUsaha(db, { nama: "Keripik Siti", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const kurator = await buatUser(db, { appRole: "provinsi" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const { call } = mountEndpoint(registerKatalog, { database: db });
  const produk = (statusKurasi) => buatProduk(db, { usahaId: usaha.id, nama: `Produk ${statusKurasi}`, statusKurasi });
  const kurasi = (id, keputusan, catatan = null) =>
    call("POST", `/produk/${id}/kurasi`, { accountability: akun(kurator.id), body: { keputusan, catatan } });
  const patchLoi = (id, status, pemanggil = kurator.id) =>
    call("PATCH", `/loi/${id}`, { accountability: akun(pemanggil), body: { status } });
  const baris = async (id) => db("produk").where({ id }).first();
  return { db, usaha, kurator, owner, produk, kurasi, patchLoi, baris };
}

test("kurasi ditolak → tayang dibalas 409 dan foto tetap di folder kurasi", { skip: pgSkipReason() }, async (t) => {
  const { db, owner, produk, kurasi, baris } = await siapkan(t);
  const item = await produk("ditolak");
  const foto = await buatFile(db, { folder: KURASI_FOLDER_ID, uploadedBy: owner.id });
  await pasangFoto(db, { produkId: item.id, fileId: foto.id });

  const hasil = await kurasi(item.id, "tayang");
  assert.equal(hasil.res.statusCode, 409, JSON.stringify(hasil.res.body));
  assert.equal(kode(hasil), "TRANSISI_KURASI_TIDAK_VALID");
  assert.equal((await baris(item.id)).status_kurasi, "ditolak");
  // Foto hanya dipindah setelah update berhasil (R3).
  assert.equal((await db("directus_files").where({ id: foto.id }).first()).folder, KURASI_FOLDER_ID);
});

test("kurasi tayang → tayang dibalas 409 tanpa menyentuh dikurasi_at", { skip: pgSkipReason() }, async (t) => {
  const { db, produk, kurasi, baris } = await siapkan(t);
  const item = await produk("tayang");
  await db("produk").where({ id: item.id }).update({ dikurasi_at: new Date("2026-09-01T00:00:00Z") });

  const hasil = await kurasi(item.id, "tayang");
  assert.equal(hasil.res.statusCode, 409, JSON.stringify(hasil.res.body));
  assert.equal(kode(hasil), "TRANSISI_KURASI_TIDAK_VALID");
  const setelah = await baris(item.id);
  assert.equal(setelah.status_kurasi, "tayang");
  assert.equal(setelah.dikurasi_at.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("kurasi tayang → rekomendasi_marketplace dan rekomendasi → ditolak diterima", { skip: pgSkipReason() }, async (t) => {
  const { produk, kurasi, baris } = await siapkan(t);
  const tayang = await produk("tayang");
  const hasil = await kurasi(tayang.id, "rekomendasi_marketplace");
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.statusKurasi, "rekomendasi_marketplace");

  const turun = await kurasi(tayang.id, "ditolak", "Foto buram");
  assert.equal(turun.res.statusCode, 200, JSON.stringify(turun.res.body));
  const setelah = await baris(tayang.id);
  assert.equal(setelah.status_kurasi, "ditolak");
  assert.equal(setelah.catatan_kurasi, "Foto buram");
  assert.ok(setelah.dikurasi_at instanceof Date);
});

test("dua keputusan tayang paralel pada produk menunggu menghasilkan [200, 409] (R3)", { skip: pgSkipReason() }, async (t) => {
  const { db, produk, kurasi } = await siapkan(t);
  const item = await produk("menunggu");

  const [a, b] = await Promise.all([kurasi(item.id, "tayang"), kurasi(item.id, "tayang")]);
  assert.deepEqual([a.res.statusCode, b.res.statusCode].sort(), [200, 409]);
  assert.equal((await db("produk").where({ id: item.id }).first()).status_kurasi, "tayang");
  const gagal = [a, b].find((hasil) => hasil.res.statusCode === 409);
  assert.equal(kode(gagal), "TRANSISI_KURASI_TIDAK_VALID");
});

test("LOI: baru → ditindaklanjuti → ditutup, dan transisi lain ditolak", { skip: pgSkipReason() }, async (t) => {
  const { db, owner, produk, patchLoi } = await siapkan(t);
  const item = await produk("tayang");
  const [loi] = await db("produk_loi")
    .insert({ produk: item.id, nama: "Pembeli", email: "beli@contoh.id", pesan: "Minat" })
    .returning("id");

  const status = async () => (await db("produk_loi").where({ id: loi.id }).first()).status;
  const maju = await patchLoi(loi.id, "ditindaklanjuti");
  assert.equal(maju.res.statusCode, 200, JSON.stringify(maju.res.body));
  assert.deepEqual(maju.res.body.data, { id: loi.id, status: "ditindaklanjuti" });

  const ulang = await patchLoi(loi.id, "ditindaklanjuti");
  assert.equal(ulang.res.statusCode, 409, JSON.stringify(ulang.res.body));
  assert.equal(kode(ulang), "TRANSISI_LOI_TIDAK_VALID");
  assert.equal(await status(), "ditindaklanjuti");

  assert.equal((await patchLoi(loi.id, "ditutup")).res.statusCode, 200);
  const setelahTutup = await patchLoi(loi.id, "ditindaklanjuti");
  assert.equal(setelahTutup.res.statusCode, 409);
  assert.equal(kode(setelahTutup), "TRANSISI_LOI_TIDAK_VALID");
  assert.equal(await status(), "ditutup");

  const asing = await patchLoi(crypto.randomUUID(), "ditutup");
  assert.equal(asing.res.statusCode, 404, JSON.stringify(asing.res.body));
  assert.equal(kode(asing), "LOI_NOT_FOUND");

  // Status tujuan di luar daftar ditolak sebelum menyentuh database.
  const salahStatus = await patchLoi(loi.id, "baru");
  assert.equal(salahStatus.res.statusCode, 400);
  assert.equal(kode(salahStatus), "INVALID_PAYLOAD");

  // UMKM bukan kurator: gate peran adapter menolak sebelum use case.
  const pemilik = await patchLoi(loi.id, "ditutup", owner.id);
  assert.equal(pemilik.nextError?.statusCode ?? pemilik.res.statusCode, 403);
});

test("dua PATCH tutup paralel pada LOI baru menghasilkan [200, 409] (R3)", { skip: pgSkipReason() }, async (t) => {
  const { db, produk, patchLoi } = await siapkan(t);
  const item = await produk("tayang");
  const [loi] = await db("produk_loi")
    .insert({ produk: item.id, nama: "Pembeli", email: "beli@contoh.id", pesan: "Minat" })
    .returning("id");

  const [a, b] = await Promise.all([patchLoi(loi.id, "ditutup"), patchLoi(loi.id, "ditutup")]);
  assert.deepEqual([a.res.statusCode, b.res.statusCode].sort(), [200, 409]);
  assert.equal((await db("produk_loi").where({ id: loi.id }).first()).status, "ditutup");
  const gagal = [a, b].find((hasil) => hasil.res.statusCode === 409);
  assert.equal(kode(gagal), "TRANSISI_LOI_TIDAK_VALID");
});

test("GET /loi tidak mengirim kontak pengirim yang tidak menyetujui kontak", { skip: pgSkipReason() }, async (t) => {
  const { db, kurator, owner, produk } = await siapkan(t);
  const item = await produk("tayang");
  await db("produk_loi").insert([
    { produk: item.id, nama: "Tanpa izin", email: "diam@contoh.id", telepon: "081200000001", pesan: "Lama", persetujuan_kontak: false },
    { produk: item.id, nama: "Dengan izin", email: "boleh@contoh.id", telepon: "081200000002", pesan: "Baru", persetujuan_kontak: true },
  ]);
  const { call } = mountEndpoint(registerKatalog, { database: db });
  for (const pemanggil of [kurator.id, owner.id]) {
    const hasil = await call("GET", "/loi", { accountability: akun(pemanggil) });
    assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
    const kontak = Object.fromEntries(hasil.res.body.data.map((loi) => [loi.nama, [loi.email, loi.telepon]]));
    assert.deepEqual(kontak["Tanpa izin"], [null, null]);
    assert.deepEqual(kontak["Dengan izin"], ["boleh@contoh.id", "081200000002"]);
  }
});
