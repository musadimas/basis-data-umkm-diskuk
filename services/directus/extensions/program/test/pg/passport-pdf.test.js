import assert from "node:assert/strict";
import test from "node:test";
import registerPassport from "../../src/endpoints/passport/index.js";
import { buatProduk } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, buatPengajuan, envPassport, siapkanTalent } from "./talent-support.mjs";

/** Usaha Subang layak terbit; `terbit` menerbitkan passport lewat endpoint sungguhan. */
async function siap(t, { terbit = true, skor = { finansial: 80, pasar: 85, legalitas: 90, sdm: 75 } } = {}) {
  const { db } = await withDatabase(t);
  const dunia = await siapkanTalent(db);
  await buatPengajuan(db, { usahaId: dunia.subang.id, status: "disetujui", skor });
  await db("usaha").where({ id: dunia.subang.id }).update({ talent_status: "talent_pool" });
  await buatProduk(db, { usahaId: dunia.subang.id, nama: "Jaket Kulit Garut Super", statusKurasi: "tayang" });
  const { call } = mountEndpoint(registerPassport, { database: db, env: envPassport() });
  let kodePassport = null;
  if (terbit) {
    const hasil = await call("POST", "/", { accountability: akun(dunia.provinsi.id), body: { usaha: dunia.subang.id } });
    assert.equal(hasil.res.statusCode, 201, JSON.stringify(hasil.res.body));
    kodePassport = hasil.res.body.data.kode;
  }
  return { db, call, kodePassport, ...dunia };
}

const unduh = (call, jenis, pemanggil, usahaId) =>
  call("GET", `/pdf/${jenis}`, { accountability: akun(pemanggil.id), query: { usaha: usahaId } });
const teks = (hasil) => hasil.res.body.toString("latin1");

test("Executive Summary: PDF-1.4 dengan QR, kode passport, dan skor 4 pilar (B27)", { skip: pgSkipReason() }, async (t) => {
  const { call, kodePassport, subang, provinsi } = await siap(t, { skor: { finansial: 100, pasar: 100, legalitas: 100, sdm: 100 } });
  const hasil = await unduh(call, "summary", provinsi, subang.id);
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.headers["Content-Type"], "application/pdf");
  assert.ok(hasil.res.headers["Content-Disposition"].includes(`executive-summary-${kodePassport}.pdf`));

  const raw = teks(hasil);
  assert.equal(raw.slice(0, 8), "%PDF-1.4");
  assert.match(raw, /Executive Summary & Business Scorecard/);
  assert.match(raw, /Usaha Subang/);
  assert.match(raw, /\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s+re/); // operator QR vektor
  // Rata-rata 4 pilar = 100; kinerja program (0) tidak ikut. Kurung di-escape di content stream.
  assert.match(raw, /Skor Rata-rata Talent Index \\\(4 pilar\\\): 100\/100/);
  assert.match(raw, /Rekomendasi Tingkat: Siap Naik Kelas/);
  assert.match(raw, /Diterbitkan Pada: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/); // ISO, bukan Date.toString() (pg mengembalikan Date)
  assert.doesNotMatch(raw, /Siap Akselerasi/);
  assert.match(raw, /Kinerja Program/);
});

test("Katalog Ekspor Resmi: memuat produk tayang", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kodePassport, subang, provinsi } = await siap(t);
  await buatProduk(db, { usahaId: subang.id, nama: "Produk Belum Tayang", statusKurasi: "menunggu" });
  const hasil = await unduh(call, "katalog", provinsi, subang.id);
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.ok(hasil.res.headers["Content-Disposition"].includes(`katalog-ekspor-${kodePassport}.pdf`));
  const raw = teks(hasil);
  assert.equal(raw.slice(0, 8), "%PDF-1.4");
  assert.match(raw, /Katalog Ekspor Resmi/);
  assert.match(raw, /Jaket Kulit Garut Super/);
  assert.doesNotMatch(raw, /Produk Belum Tayang/);
});

test("tanpa passport aktif: ringkasan dan katalog menyatakan Belum diterbitkan, tanpa QR (B27)", { skip: pgSkipReason() }, async (t) => {
  const { call, subang, provinsi } = await siap(t, { terbit: false });
  const ringkasan = await unduh(call, "summary", provinsi, subang.id);
  assert.equal(ringkasan.res.statusCode, 200, JSON.stringify(ringkasan.res.body));
  const raw = teks(ringkasan);
  assert.match(raw, /Status Passport: Belum diterbitkan/);
  assert.match(raw, /Kode Talent Passport: Belum diterbitkan/);
  assert.match(raw, /Tautan Verifikasi: Belum diterbitkan/);
  assert.doesNotMatch(raw, /passport\/DRAFT/);
  assert.doesNotMatch(raw, /\d+\.\d+ \d+\.\d+ \d+\.\d+ \d+\.\d+ re/, "tanpa passport tidak ada QR");
  assert.ok(ringkasan.res.headers["Content-Disposition"].includes("executive-summary-draft.pdf"));

  const katalog = await unduh(call, "katalog", provinsi, subang.id);
  const rawKatalog = teks(katalog);
  assert.match(rawKatalog, /Status Passport: Belum diterbitkan/);
  assert.doesNotMatch(rawKatalog, /Aktif \(DRAFT\)/);
  assert.ok(katalog.res.headers["Content-Disposition"].includes("katalog-ekspor-draft.pdf"));
});

test("scope PDF: kabkota kota lain 404 (K1), kabkota sekota dan umkm sendiri boleh, tanpa parameter 400", { skip: pgSkipReason() }, async (t) => {
  const { call, subang, bandung, kabkotaSubang, umkm, provinsi } = await siap(t);
  const luar = await unduh(call, "summary", kabkotaSubang, bandung.id);
  assert.equal(luar.res.statusCode, 404);
  assert.equal(luar.res.body.errors[0].extensions.code, "NOT_FOUND");
  assert.equal((await unduh(call, "summary", kabkotaSubang, subang.id)).res.statusCode, 200);

  // UMKM tanpa parameter memakai usahanya sendiri.
  const sendiri = await call("GET", "/pdf/katalog", { accountability: akun(umkm.id) });
  assert.equal(sendiri.res.statusCode, 200);
  assert.equal((await unduh(call, "summary", umkm, bandung.id)).res.statusCode, 404);

  const tanpa = await call("GET", "/pdf/summary", { accountability: akun(provinsi.id) });
  assert.equal(tanpa.res.statusCode, 400);
  assert.equal(tanpa.res.body.errors[0].extensions.code, "USAHA_ID_REQUIRED");
});
