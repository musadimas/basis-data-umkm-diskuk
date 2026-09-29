import assert from "node:assert/strict";
import test from "node:test";
import registerKatalog from "../../src/endpoints/katalog/index.js";
import { KATALOG_FOLDER_ID, KURASI_FOLDER_ID } from "../../src/endpoints/katalog/service.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import {
  buatFile,
  buatKota,
  buatProduk,
  buatUsaha,
  buatUser,
  pasangFoto,
} from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

test("edit produk tayang memindahkan foto ke kurasi dan mengembalikan status ke menunggu", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const usaha = await buatUsaha(db, { nama: "Keripik Siti", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Keripik", statusKurasi: "tayang" });
  const foto = await buatFile(db, { folder: KATALOG_FOLDER_ID, uploadedBy: owner.id, type: "image/png", filesize: 2048 });
  await pasangFoto(db, { produkId: produk.id, fileId: foto.id });

  const { call } = mountEndpoint(registerKatalog, { database: db });
  const hasil = await call("PATCH", `/produk/${produk.id}`, {
    accountability: akun(owner.id),
    body: { nama: "Keripik Baru", foto: [foto.id] },
  });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal((await db("directus_files").where({ id: foto.id }).first()).folder, KURASI_FOLDER_ID);
  assert.equal((await db("produk").where({ id: produk.id }).first()).status_kurasi, "menunggu");

  // Edit yang gagal membatalkan semuanya: foto tetap di folder katalog, status tetap tayang.
  const produk2 = await buatProduk(db, { usahaId: usaha.id, nama: "Keripik 2", statusKurasi: "tayang" });
  const foto2 = await buatFile(db, { folder: KATALOG_FOLDER_ID, uploadedBy: owner.id, type: "image/png", filesize: 2048 });
  await pasangFoto(db, { produkId: produk2.id, fileId: foto2.id });
  const asing = await buatFile(db, {
    folder: KURASI_FOLDER_ID,
    uploadedBy: (await buatUser(db, { appRole: "pendamping" })).id,
    type: "image/png",
    filesize: 2048,
  });
  const gagal = await call("PATCH", `/produk/${produk2.id}`, {
    accountability: akun(owner.id),
    body: { nama: "Keripik 2 Baru", foto: [asing.id] },
  });
  assert.equal(gagal.res.statusCode, 403, JSON.stringify(gagal.res.body));
  assert.equal((await db("directus_files").where({ id: foto2.id }).first()).folder, KATALOG_FOLDER_ID);
  assert.equal((await db("produk").where({ id: produk2.id }).first()).status_kurasi, "tayang");
});

test("pemilik boleh memakai foto yang diunggah kurator untuk produknya sendiri", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 9, nama: "KOTA BANDUNG" });
  const usaha = await buatUsaha(db, { nama: "Batik Uji", kotaId: 9, kotaNama: "KOTA BANDUNG" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const kurator = await buatUser(db, { appRole: "provinsi" });
  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Batik", statusKurasi: "tayang" });
  const foto = await buatFile(db, { folder: KATALOG_FOLDER_ID, uploadedBy: kurator.id, type: "image/png", filesize: 2048 });
  await pasangFoto(db, { produkId: produk.id, fileId: foto.id });

  const { call } = mountEndpoint(registerKatalog, { database: db });
  const hasil = await call("PATCH", `/produk/${produk.id}`, {
    accountability: akun(owner.id),
    body: { nama: "Batik Baru", foto: [foto.id] },
  });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal((await db("directus_files").where({ id: foto.id }).first()).folder, KURASI_FOLDER_ID);
});

test("edit produk: 404 bila tidak ada, 403 untuk pemilik lain, 400 untuk foto tak valid dengan rollback", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 5, nama: "KOTA BEKASI" });
  const usaha = await buatUsaha(db, { nama: "Roti Uji", kotaId: 5, kotaNama: "KOTA BEKASI" });
  const usahaLain = await buatUsaha(db, { nama: "Roti Lain", kotaId: 5, kotaNama: "KOTA BEKASI" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const lain = await buatUser(db, { appRole: "umkm", usahaId: usahaLain.id });
  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Roti", statusKurasi: "tayang" });
  const foto = await buatFile(db, { folder: KATALOG_FOLDER_ID, uploadedBy: owner.id, type: "image/png", filesize: 2048 });
  await pasangFoto(db, { produkId: produk.id, fileId: foto.id });
  const { call } = mountEndpoint(registerKatalog, { database: db });
  const kode = (hasil) => hasil.res.body.errors[0].extensions.code;

  const tidakAda = await call("PATCH", "/produk/5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11", { accountability: akun(owner.id), body: { nama: "X" } });
  assert.equal(tidakAda.res.statusCode, 404);
  assert.equal(kode(tidakAda), "PRODUK_NOT_FOUND");

  const asing = await call("PATCH", `/produk/${produk.id}`, { accountability: akun(lain.id), body: { nama: "Curian" } });
  assert.equal(asing.res.statusCode, 403);
  assert.equal(kode(asing), "FORBIDDEN");

  // Foto SVG: ditolak 400, dan pemindahan folder foto lama ikut dibatalkan (produk tetap tayang).
  const svg = await buatFile(db, { folder: KURASI_FOLDER_ID, uploadedBy: owner.id, type: "image/svg+xml", filesize: 100 });
  const tidakValid = await call("PATCH", `/produk/${produk.id}`, { accountability: akun(owner.id), body: { nama: "Roti Baru", foto: [svg.id] } });
  assert.equal(tidakValid.res.statusCode, 400);
  assert.equal(kode(tidakValid), "FOTO_TIDAK_VALID");
  assert.equal((await db("directus_files").where({ id: foto.id }).first()).folder, KATALOG_FOLDER_ID);
  const baris = await db("produk").where({ id: produk.id }).first();
  assert.equal(baris.status_kurasi, "tayang");
  assert.equal(baris.nama, "Roti");
});
