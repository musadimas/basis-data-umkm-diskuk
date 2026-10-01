import assert from "node:assert/strict";
import test from "node:test";
import { modelBeritaAcara, namaBerkasBa, tanggalBa } from "../src/endpoints/talent/berita-acara-pdf.js";
import dokumen from "../../../analytics-shared/dokumen.cjs";

const { renderDokumen } = dokumen;

test("namaBerkasBa: nomor BA menjadi nama berkas aman", () => {
  assert.equal(namaBerkasBa("BA-TS/2026/0001"), "BA-TS-2026-0001.pdf");
  assert.equal(namaBerkasBa("dummy_BA-TS/2026/0002"), "dummy_BA-TS-2026-0002.pdf");
  assert.equal(namaBerkasBa('a"b\r\nc'), "a-b-c.pdf");
  assert.equal(namaBerkasBa("///"), "berita-acara.pdf");
});

test("tanggalBa: tanggal DATE diformat tetap di UTC (id-ID)", () => {
  assert.equal(tanggalBa("2026-09-30"), "30 September 2026");
});

test("modelBeritaAcara: keterangan, daftar usaha, dan keterangan penilaian", () => {
  const ba = { nomor: "BA-TS/2026/0001", tanggal: "2026-09-30", catatan: "batch 1", penyetuju: null };
  const items = [
    { nama: "Usaha Bandung", nib: "111", kota_nama: "KOTA BANDUNG", skor_total: 68.75, rubrik_versi: "placeholder-v0" },
    { nama: "Usaha Subang", nib: null, kota_nama: "KABUPATEN SUBANG", skor_total: null, rubrik_versi: "placeholder-v0" },
  ];
  const model = modelBeritaAcara(ba, items);
  assert.equal(model.judul, "Berita Acara Kurasi Talent Scouting");
  assert.equal(model.subjudul, "Nomor BA-TS/2026/0001");
  assert.deepEqual(model.bagian[0].baris, [
    "Nomor: BA-TS/2026/0001",
    "Tanggal: 30 September 2026",
    "Disetujui oleh: -",
    "Jumlah usaha: 2",
    "Catatan: batch 1",
  ]);
  assert.equal(model.bagian[1].baris[1], "2. Usaha Subang - NIB - - KABUPATEN SUBANG - Talent Index -");
  assert.ok(model.bagian[2].baris.some((baris) => baris.includes("rubrik sementara")));
  assert.equal(model.meta.sumber, "Kurasi Talent Scouting");
  assert.match(model.meta.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(model.qr, null);
});

test("modelBeritaAcara: tanpa usaha terhubung memberi baris fallback dan tanpa catatan rubrik", () => {
  const model = modelBeritaAcara({ nomor: "BA-TS/2026/0009", tanggal: "2026-10-01", catatan: null, penyetuju: "Ani" }, []);
  assert.deepEqual(model.bagian[1].baris, ["Tidak ada pengajuan yang terhubung."]);
  assert.ok(!model.bagian[2].baris.some((baris) => baris.includes("rubrik sementara")));
});

test("renderDokumen(modelBeritaAcara(...)) menghasilkan PDF-1.4 yang memuat nomor dan usaha", () => {
  const ba = { nomor: "BA-TS/2026/0001", tanggal: "2026-09-30", catatan: null, penyetuju: "Ani" };
  const items = [{ nama: "Usaha Subang", nib: "123", kota_nama: "KABUPATEN SUBANG", skor_total: 80, rubrik_versi: "v1" }];
  const pdf = renderDokumen(modelBeritaAcara(ba, items)).toString("latin1");
  assert.equal(pdf.slice(0, 8), "%PDF-1.4");
  assert.match(pdf, /BA-TS\/2026\/0001/);
  assert.match(pdf, /Usaha Subang/);
});
