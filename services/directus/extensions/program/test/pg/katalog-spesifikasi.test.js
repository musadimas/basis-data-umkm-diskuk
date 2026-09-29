import assert from "node:assert/strict";
import test from "node:test";
import registerKatalog from "../../src/endpoints/katalog/index.js";
import { buatKota, buatLegalitas, buatProduk, buatUsaha } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

test("lembar spesifikasi publik untuk produk tayang memuat data usaha dan tanpa kontak pemilik", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 3, nama: "KOTA BANDUNG" });
  const usaha = await buatUsaha(db, { nama: "Keripik Siti", kotaId: 3, kotaNama: "KOTA BANDUNG", nib: "1234567890123" });
  await buatLegalitas(db, { usahaId: usaha.id, jenis: "halal", nomor: "ID3210000123456", status: "terbit" });
  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Keripik Singkong Balado", statusKurasi: "tayang" });
  await db("produk").where({ id: produk.id }).update({ kbli: "10794", harga_retail: 15000, harga_grosir: 12000, moq: 50, berat: "250 g" });

  const { call } = mountEndpoint(registerKatalog, { database: db, env: {} });
  const { res } = await call("GET", `/produk/${produk.id}/pdf`, { accountability: null });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Content-Disposition"], /spesifikasi-keripik-singkong-balado\.pdf/);
  const pdf = Buffer.from(res.body).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  for (const teks of [
    "Keripik Singkong Balado",
    "NIB: 1234567890123",
    `Wilayah: ${(await db("produk").where({ id: produk.id }).first()).usaha_kota_nama ?? "Belum tersedia"}`,
    "KBLI: 10794",
    "Berat bersih: 250 g",
    "Stok: Belum tersedia",
    "Kapasitas pesanan besar: Belum tersedia",
  ]) {
    assert.ok(pdf.includes(teks), `PDF harus memuat "${teks}"`);
  }
});

test("lembar spesifikasi tidak dibuat untuk produk belum tayang atau tidak ada", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const usaha = await buatUsaha(db, { nama: "Usaha Uji" });
  const menunggu = await buatProduk(db, { usahaId: usaha.id, statusKurasi: "menunggu" });
  const ditolak = await buatProduk(db, { usahaId: usaha.id, statusKurasi: "ditolak" });
  const { call } = mountEndpoint(registerKatalog, { database: db, env: {} });
  for (const id of [menunggu.id, ditolak.id, "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11"]) {
    const { res } = await call("GET", `/produk/${id}/pdf`, { accountability: null });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.errors[0].extensions.code, "PRODUK_NOT_FOUND");
  }
});
