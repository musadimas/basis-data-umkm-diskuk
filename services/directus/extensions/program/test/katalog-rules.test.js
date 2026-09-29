import assert from "node:assert/strict";
import test from "node:test";
import {
  KURASI_STATUS,
  LOI_DUPLIKAT_JAM,
  STATUS_TAYANG,
  hargaRange,
  loiDuplikat,
  validasiKurasi,
} from "../src/endpoints/katalog/rules.js";
import { toProduk } from "../src/endpoints/katalog/service.js";

test("validasiKurasi menerima keputusan yang dikenal dan menormalkan catatan", () => {
  assert.deepEqual(validasiKurasi({ keputusan: "tayang", catatan: "  rapi  " }), { keputusan: "tayang", catatan: "rapi" });
  assert.deepEqual(validasiKurasi({ keputusan: "rekomendasi_marketplace" }), { keputusan: "rekomendasi_marketplace", catatan: null });
});

test("validasiKurasi menolak keputusan asing dan penolakan tanpa catatan", () => {
  assert.throws(() => validasiKurasi({ keputusan: "menunggu" }), (error) => error.statusCode === 400);
  assert.throws(() => validasiKurasi({}), (error) => error.statusCode === 400);
  assert.throws(
    () => validasiKurasi({ keputusan: "ditolak", catatan: "   " }),
    (error) => error.statusCode === 400 && error.code === "CATATAN_WAJIB",
  );
  assert.equal(validasiKurasi({ keputusan: "ditolak", catatan: "foto buram" }).catatan, "foto buram");
});

test("status kurasi: hanya tayang dan rekomendasi_marketplace yang tayang", () => {
  assert.deepEqual(KURASI_STATUS, ["menunggu", "tayang", "rekomendasi_marketplace", "ditolak"]);
  assert.deepEqual(STATUS_TAYANG, ["tayang", "rekomendasi_marketplace"]);
});

test("hargaRange: satu harga, rentang, dan kosong", () => {
  assert.equal(hargaRange(15000, 12000), "Rp 12.000 - Rp 15.000");
  assert.equal(hargaRange(15000, null), "Rp 15.000");
  assert.equal(hargaRange(null, null), null);
  assert.equal(hargaRange("9000", "9000"), "Rp 9.000");
});

test("DTO produk membawa hargaLabel dari server", () => {
  assert.equal(toProduk({ id: "p", harga_retail: "15000", harga_grosir: "12000" }).hargaLabel, "Rp 12.000 - Rp 15.000");
  assert.equal(toProduk({ id: "p" }).hargaLabel, null);
});

test("loiDuplikat: kunci klien atau isi sama dalam 24 jam, selalu per produk", () => {
  const now = Date.parse("2026-09-29T10:00:00Z");
  const jam = (n) => new Date(now - n * 3_600_000).toISOString();
  const surat = { produk: "p1", clientUuid: "k1", email: "a@x.id", pesan: "Minat", dateCreated: jam(1) };
  const baru = { produk: "p1", clientUuid: "k2", email: "a@x.id", pesan: "Minat" };
  assert.equal(LOI_DUPLIKAT_JAM, 24);
  assert.equal(loiDuplikat([surat], { ...baru, clientUuid: "k1" }, now), true);
  assert.equal(loiDuplikat([surat], baru, now), true);
  assert.equal(loiDuplikat([surat], { ...baru, produk: "p2" }, now), false);
  assert.equal(loiDuplikat([surat], { ...baru, produk: "p2", clientUuid: "k1" }, now), false);
  assert.equal(loiDuplikat([{ ...surat, dateCreated: jam(25) }], baru, now), false);
  assert.equal(loiDuplikat([{ ...surat, dateCreated: jam(25) }], { ...baru, clientUuid: "k1" }, now), true);
});
