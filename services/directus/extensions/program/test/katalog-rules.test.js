import assert from "node:assert/strict";
import test from "node:test";
import {
  KURASI_ASAL,
  KURASI_STATUS,
  LOI_ASAL,
  LOI_DUPLIKAT_JAM,
  LOI_STATUS,
  STATUS_TAYANG,
  hargaRange,
  loiDuplikat,
  transisiKurasiSah,
  transisiLoiSah,
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

test("transisi kurasi: tayang hanya dari menunggu; rekomendasi dari menunggu/tayang; tolak dari semua kecuali ditolak", () => {
  const matriks = {
    menunggu: { tayang: true, rekomendasi_marketplace: true, ditolak: true },
    tayang: { tayang: false, rekomendasi_marketplace: true, ditolak: true },
    rekomendasi_marketplace: { tayang: false, rekomendasi_marketplace: false, ditolak: true },
    ditolak: { tayang: false, rekomendasi_marketplace: false, ditolak: false },
  };
  assert.deepEqual(Object.keys(KURASI_ASAL), Object.keys(matriks.ditolak));
  for (const [asal, keputusan] of Object.entries(matriks)) {
    for (const [tujuan, sah] of Object.entries(keputusan)) {
      assert.equal(transisiKurasiSah(asal, tujuan), sah, `${asal} → ${tujuan}`);
    }
  }
});

test("transisi LOI: ditutup final, baru → ditindaklanjuti → ditutup", () => {
  const matriks = {
    baru: { ditindaklanjuti: true, ditutup: true },
    ditindaklanjuti: { ditindaklanjuti: false, ditutup: true },
    ditutup: { ditindaklanjuti: false, ditutup: false },
  };
  assert.deepEqual(LOI_STATUS, ["baru", "ditindaklanjuti", "ditutup"]);
  assert.deepEqual(Object.keys(LOI_ASAL), Object.keys(matriks.baru), "kolom LOI_ASAL tidak sesuai matriks");
  for (const [asal, tujuan] of Object.entries(matriks)) {
    for (const [target, sah] of Object.entries(tujuan)) {
      assert.equal(transisiLoiSah(asal, target), sah, `${asal} → ${target}`);
    }
  }
  assert.equal(transisiLoiSah("baru", "baru"), false);
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
