import assert from "node:assert/strict";
import test from "node:test";
import registerKatalog from "../../src/endpoints/katalog/index.js";
import { KATALOG_FOLDER_ID, KURASI_FOLDER_ID } from "../../src/endpoints/katalog/service.js";
import { createRequire } from "node:module";
import { createDirectusFakes } from "../../../../test-support/directus-fakes.mjs";
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

const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const kode = (hasil) => hasil.res.body.errors[0].extensions.code;

async function siapkan(t) {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const usaha = await buatUsaha(db, { nama: "Keripik Siti", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const kurator = await buatUser(db, { appRole: "provinsi" });
  const fakes = createDirectusFakes({ db });
  const { call } = mountEndpoint(registerKatalog, {
    database: db,
    env: {},
    context: { services: fakes.services, getSchema: fakes.getSchema },
  });
  return { db, usaha, owner, kurator, fakes, call };
}

const foto = (db, owner, lebih = {}) =>
  buatFile(db, { folder: KURASI_FOLDER_ID, uploadedBy: owner.id, type: "image/png", filesize: 2048, ...lebih });
const hitungProduk = async (db, usahaId) => Number((await db("produk").where({ usaha: usahaId }).count("* as n").first()).n);

test("foto produk harus di folder kurasi dan milik pengunggah", { skip: pgSkipReason() }, async (t) => {
  const { db, usaha, owner, call } = await siapkan(t);
  const badan = (fotoId) => ({ usaha: usaha.id, nama: "Keripik", foto: [fotoId] });

  // Foto ada di folder PUBLIK: bukan foto unggahan formulir → 400.
  const dipublik = await foto(db, owner, { folder: KATALOG_FOLDER_ID });
  const ditolak = await call("POST", "/produk", { accountability: akun(owner.id), body: badan(dipublik.id) });
  assert.equal(ditolak.res.statusCode, 400);
  assert.equal(kode(ditolak), "FOTO_TIDAK_VALID");

  // Foto di folder kurasi tetapi milik akun lain → 403 dan tidak ada produk yang tertulis.
  const lain = await buatUser(db, { appRole: "pendamping" });
  const milikLain = await foto(db, lain);
  const silang = await call("POST", "/produk", { accountability: akun(owner.id), body: badan(milikLain.id) });
  assert.equal(silang.res.statusCode, 403);
  assert.equal(kode(silang), "FORBIDDEN");
  assert.equal(await hitungProduk(db, usaha.id), 0);

  // Foto sendiri di folder kurasi diterima.
  const milikSendiri = await foto(db, owner);
  const dibuat = await call("POST", "/produk", { accountability: akun(owner.id), body: badan(milikSendiri.id) });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
  assert.deepEqual(dibuat.res.body.data.foto, [milikSendiri.id]);
  assert.equal(dibuat.res.body.data.statusKurasi, "menunggu");
});

test("unggahan foto dibatasi ke raster di bawah 5 MB oleh server", { skip: pgSkipReason() }, async (t) => {
  const { db, usaha, owner, call } = await siapkan(t);
  // Proxy menyajikan `type` yang dideklarasikan di origin Directus, jadi SVG/PDF berarti XSS tersimpan.
  for (const berkas of [
    { type: "image/svg+xml", filesize: 2048 },
    { type: "application/pdf", filesize: 2048 },
    { type: null, filesize: 2048 },
    { type: "image/png", filesize: 6 * 1024 * 1024 },
    { type: "image/png", filesize: null },
  ]) {
    const file = await foto(db, owner, berkas);
    const hasil = await call("POST", "/produk", {
      accountability: akun(owner.id),
      body: { usaha: usaha.id, nama: "Keripik", foto: [file.id] },
    });
    assert.equal(hasil.res.statusCode, 400, JSON.stringify(berkas));
    assert.equal(kode(hasil), "FOTO_TIDAK_VALID");
  }
  assert.equal(await hitungProduk(db, usaha.id), 0, "tidak boleh ada produk tertulis");

  // Raster tepat di batas 5 MB masih diterima.
  const batas = await foto(db, owner, { type: "image/webp", filesize: 5 * 1024 * 1024 });
  const dibuat = await call("POST", "/produk", {
    accountability: akun(owner.id),
    body: { usaha: usaha.id, nama: "Keripik", foto: [batas.id] },
  });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
});

test("kurasi memindahkan foto: tayang → folder publik, ditolak → folder kurasi", { skip: pgSkipReason() }, async (t) => {
  const { db, usaha, owner, kurator, call } = await siapkan(t);
  const produk = await buatProduk(db, { usahaId: usaha.id, statusKurasi: "menunggu" });
  const file = await foto(db, owner);
  await pasangFoto(db, { produkId: produk.id, fileId: file.id });
  const folderFoto = async () => (await db("directus_files").where({ id: file.id }).first()).folder;

  const tayang = await call("POST", `/produk/${produk.id}/kurasi`, {
    accountability: akun(kurator.id),
    body: { keputusan: "tayang" },
  });
  assert.equal(tayang.res.statusCode, 200, JSON.stringify(tayang.res.body));
  assert.equal(tayang.res.body.data.statusKurasi, "tayang");
  assert.equal(await folderFoto(), KATALOG_FOLDER_ID);

  const ditolak = await call("POST", `/produk/${produk.id}/kurasi`, {
    accountability: akun(kurator.id),
    body: { keputusan: "ditolak", catatan: "Foto tidak jelas." },
  });
  assert.equal(ditolak.res.statusCode, 200);
  assert.equal(ditolak.res.body.data.catatanKurasi, "Foto tidak jelas.");
  assert.equal(await folderFoto(), KURASI_FOLDER_ID);

  // `ditolak` final bagi kurator sejak phase 9 (`KURASI_ASAL.rekomendasi_marketplace = [menunggu, tayang]`);
  // produk kembali ke antrean hanya lewat edit pemilik, jadi keputusan ini dibalas 409 tanpa memindah foto.
  const rekomendasi = await call("POST", `/produk/${produk.id}/kurasi`, {
    accountability: akun(kurator.id),
    body: { keputusan: "rekomendasi_marketplace" },
  });
  assert.equal(rekomendasi.res.statusCode, 409);
  assert.equal(kode(rekomendasi), "TRANSISI_KURASI_TIDAK_VALID");
  assert.equal(await folderFoto(), KURASI_FOLDER_ID);

  // Hanya kurator yang boleh memutuskan; penolakan wajib bercatatan; produk tak dikenal 404.
  const olehPemilik = await call("POST", `/produk/${produk.id}/kurasi`, { accountability: akun(owner.id), body: { keputusan: "tayang" } });
  assert.equal(olehPemilik.nextError?.statusCode ?? olehPemilik.res.statusCode, 403);
  const tanpaCatatan = await call("POST", `/produk/${produk.id}/kurasi`, { accountability: akun(kurator.id), body: { keputusan: "ditolak" } });
  assert.equal(kode(tanpaCatatan), "CATATAN_WAJIB");
  const tidakAda = await call("POST", "/produk/5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11/kurasi", {
    accountability: akun(kurator.id),
    body: { keputusan: "tayang" },
  });
  assert.equal(tidakAda.res.statusCode, 404);
  assert.equal(kode(tidakAda), "PRODUK_NOT_FOUND");
  assert.equal(await folderFoto(), KURASI_FOLDER_ID, "keputusan yang gagal tidak memindahkan foto");
});

test("uji_lab diterima dan disimpan bersama produk", { skip: pgSkipReason() }, async (t) => {
  const { db, usaha, owner, call } = await siapkan(t);
  const dibuat = await call("POST", "/produk", {
    accountability: akun(owner.id),
    body: { usaha: usaha.id, nama: "Keripik", ujiLab: "Uji mikrobiologi labkes 2026: aman", foto: [] },
  });
  assert.equal(dibuat.res.statusCode, 201, JSON.stringify(dibuat.res.body));
  assert.equal((await db("produk").where({ id: dibuat.res.body.data.id }).first()).uji_lab, "Uji mikrobiologi labkes 2026: aman");
});

test("proxy foto melayani kurator dan pemilik, tidak pernah pihak lain", { skip: pgSkipReason() }, async (t) => {
  const { db, owner, kurator, fakes, call } = await siapkan(t);
  const file = await foto(db, owner);
  fakes.files.set(file.id, Buffer.from("png-bytes"));

  // Kurator membaca foto di folder kurasi; header memakai `type` (bukan `mimetype`) + nosniff.
  const dilayani = await call("GET", `/foto/${file.id}`, { accountability: akun(kurator.id) });
  assert.equal(dilayani.res.statusCode, 200, JSON.stringify(dilayani.res.body));
  assert.equal(dilayani.res.headers["Content-Type"], "image/png");
  assert.equal(dilayani.res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(dilayani.res.headers["Cache-Control"], "private, no-store");

  // Berkas tanpa tipe dilayani sebagai byte opak, tidak ditebak.
  const tanpaTipe = await foto(db, owner, { type: null });
  const generik = await call("GET", `/foto/${tanpaTipe.id}`, { accountability: akun(kurator.id) });
  assert.equal(generik.res.statusCode, 200);
  assert.equal(generik.res.headers["Content-Type"], "application/octet-stream");
  assert.equal(generik.res.headers["X-Content-Type-Options"], "nosniff");

  // Pemilik membaca fotonya sendiri; pemilik lain ditolak; folder di luar media produk ditolak.
  assert.equal((await call("GET", `/foto/${file.id}`, { accountability: akun(owner.id) })).res.statusCode, 200);
  const usahaLain = await buatUsaha(db, { nama: "Usaha Lain" });
  const lain = await buatUser(db, { appRole: "umkm", usahaId: usahaLain.id });
  const ditolak = await call("GET", `/foto/${file.id}`, { accountability: akun(lain.id) });
  assert.equal(ditolak.res.statusCode, 403);
  const diLuar = await buatFile(db, { folder: null, uploadedBy: owner.id, type: "image/png" });
  const luar = await call("GET", `/foto/${diLuar.id}`, { accountability: akun(owner.id) });
  assert.equal(luar.res.statusCode, 403);
  const hilang = await call("GET", "/foto/5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11", { accountability: akun(owner.id) });
  assert.equal(hilang.res.statusCode, 404);
  assert.equal(kode(hilang), "FOTO_TIDAK_DITEMUKAN");
});
