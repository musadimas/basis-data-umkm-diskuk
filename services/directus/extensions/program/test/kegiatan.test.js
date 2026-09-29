import assert from "node:assert/strict";
import test from "node:test";
import registerKegiatan from "../src/endpoints/kegiatan/index.js";
import { pesanPengingat } from "../src/endpoints/kegiatan/pesan.js";
import {
  jadwalPengingat,
  kelompokStatus,
  maskTujuan,
  normalisasiTujuan,
  parseJadwalKirim,
  parseQueryKegiatan,
  rentangWindow,
  sisaKuota,
  statusKegiatan,
  tautanAman,
} from "../src/endpoints/kegiatan/rules.js";
import { KABUPATEN_KOTA_JABAR, gabungkanPenyelenggara, opsiPenyelenggaraTetap } from "../src/lib/wilayah.js";

const TOKEN = "9b222222-2222-4222-8222-000000000002";
const now = new Date("2026-09-27T03:00:00Z");

// ── Pure rules ─────────────────────────────────────────────────────────────

test("the temporal status follows the dates, the deadline and the quota", () => {
  const base = { tanggalMulai: "2026-10-10T02:00:00Z", tanggalSelesai: "2026-10-12T09:00:00Z", batasRegistrasi: null, kuota: null, terisi: 0 };
  assert.equal(statusKegiatan(base, new Date("2026-10-01T00:00:00Z")), "pendaftaran");
  assert.equal(statusKegiatan({ ...base, batasRegistrasi: "2026-09-30T00:00:00Z" }, new Date("2026-10-01T00:00:00Z")), "segera");
  assert.equal(statusKegiatan({ ...base, kuota: 30, terisi: 30 }, new Date("2026-10-01T00:00:00Z")), "segera");
  assert.equal(statusKegiatan(base, new Date("2026-10-11T00:00:00Z")), "berjalan");
  assert.equal(statusKegiatan(base, new Date("2026-10-13T00:00:00Z")), "selesai");
  assert.equal(sisaKuota({ kuota: 30, terisi: 28 }), 2);
  assert.equal(sisaKuota({ kuota: 30, terisi: 31 }), 0);
  assert.equal(sisaKuota({ kuota: null, terisi: 4 }), null);
});

test("only absolute https links are published", () => {
  assert.equal(tautanAman("https://diskuk.jabarprov.go.id/daftar"), "https://diskuk.jabarprov.go.id/daftar");
  for (const value of ["http://diskuk.jabarprov.go.id", "javascript:alert(1)", "data:text/html,x", "bukan-url", "", null, "  "]) {
    assert.equal(tautanAman(value), null, `${value} must not be published`);
  }
  assert.equal(tautanAman(`https://x.invalid/${"a".repeat(600)}`), null);
});

test("reminder targets are normalised, refused when invalid and shown masked", () => {
  assert.equal(normalisasiTujuan("email", "  Wawan@Gmail.com "), "wawan@gmail.com");
  assert.equal(normalisasiTujuan("whatsapp", "0812-3456-789"), "628123456789");
  assert.equal(normalisasiTujuan("whatsapp", "628123456789"), "628123456789");
  assert.equal(normalisasiTujuan("whatsapp", "+62 812 3456 789"), "628123456789");
  for (const [kanal, tujuan] of [["email", "wawan@"], ["email", "a@b"], ["whatsapp", "12345"], ["whatsapp", "0812"], ["whatsapp", "abc"]]) {
    assert.throws(() => normalisasiTujuan(kanal, tujuan), (error) => error.code === "TUJUAN_TIDAK_VALID");
  }
  assert.equal(maskTujuan("email", "wawan@gmail.com"), "w***@gmail.com");
  assert.equal(maskTujuan("whatsapp", "628123456789"), "62812****789");
});

test("the default reminder is one day before the event, never in the past", () => {
  assert.equal(jadwalPengingat("2026-10-10T02:00:00Z", now).toISOString(), "2026-10-09T02:00:00.000Z");
  assert.equal(jadwalPengingat("2026-09-27T06:00:00Z", now).toISOString(), now.toISOString());
});

test("a requested schedule must be in the future and before the event ends", () => {
  const event = { tanggalMulai: "2026-10-10T02:00:00Z", tanggalSelesai: "2026-10-12T09:00:00Z" };
  assert.equal(parseJadwalKirim("2026-10-09T01:00:00Z", event, now).toISOString(), "2026-10-09T01:00:00.000Z");
  assert.throws(() => parseJadwalKirim("2026-09-01T00:00:00Z", event, now), (error) => error.code === "INVALID_PAYLOAD");
  assert.throws(() => parseJadwalKirim("2026-11-01T00:00:00Z", event, now), (error) => error.code === "INVALID_PAYLOAD");
  assert.throws(() => parseJadwalKirim("besok", event, now), (error) => error.code === "INVALID_PAYLOAD");
});

test("month windows follow the WIB calendar across the year boundary", () => {
  const bulan = rentangWindow({ bulan: 1, tahun: 2027 }, now);
  assert.equal(bulan.dari.toISOString(), "2026-12-31T17:00:00.000Z");
  assert.equal(bulan.sampai.toISOString(), "2027-01-31T17:00:00.000Z");
  const agenda = rentangWindow({}, now);
  assert.equal(agenda.dari.toISOString(), "2026-06-29T03:00:00.000Z");
  assert.equal(agenda.sampai.toISOString(), "2027-09-28T03:00:00.000Z");
});

test("list queries refuse unknown filter values instead of silently ignoring them", () => {
  assert.deepEqual(parseQueryKegiatan({ kategori: "pameran,sertifikasi", ramah: "1" }), {
    bulan: null, tahun: null, kategori: ["pameran", "sertifikasi"], penyelenggara: [], metode: null, ramah: true, status: [],
  });
  for (const query of [{ kategori: "rapat" }, { metode: "daring2" }, { status: "draft" }, { bulan: "13", tahun: "2026" }, { bulan: "1" }]) {
    assert.throws(() => parseQueryKegiatan(query), (error) => error.code === "INVALID_PAYLOAD");
  }
});

test("status groups count the filtered rows", () => {
  const kelompok = kelompokStatus([
    { status: "berjalan" },
    { status: "pendaftaran" },
    { status: "pendaftaran" },
    { status: "selesai" },
  ]);
  assert.deepEqual(kelompok, { berjalan: 1, pendaftaran: 2, segera: 0, selesai: 1 });
});

test("the 27 dinas plus province, kementerian and mitra are always offered", () => {
  const tetap = opsiPenyelenggaraTetap();
  assert.equal(KABUPATEN_KOTA_JABAR.length, 27);
  assert.equal(new Set(KABUPATEN_KOTA_JABAR).size, 27);
  assert.equal(tetap.filter((value) => value.startsWith("Dinas KUMKM ")).length, 27);
  assert.ok(tetap.includes("Dinas KUKM Provinsi Jawa Barat"));
  const gabungan = gabungkanPenyelenggara(tetap, ["Mitra Kampus", "Dinas KUMKM Kota Bandung"]);
  assert.equal(gabungan.length, 31);
  assert.ok(gabungan.includes("Mitra Kampus"));
});

// List, detail, opt-in, pembatalan, penjadwalan dan rute HTTP diuji terhadap Postgres nyata:
// test/pg/kegiatan.test.js, test/pg/pengingat-kegiatan.test.js dan test/pg/outbox.test.js.

// ── Pesan pengingat ────────────────────────────────────────────────────────
// Penjadwalan dan pengiriman diuji di Postgres nyata: test/pg/pengingat-kegiatan.test.js (Tes 8)
// dan test/pg/outbox.test.js. Di sini hanya template murni.

const pengingatRow = (over = {}) => ({
  token: TOKEN,
  judul: "Pelatihan Pemasaran Digital",
  tanggal_mulai: new Date("2026-10-10T02:00:00Z"),
  lokasi: "Gedung Sate",
  metode: "daring",
  ...over,
});

test("the reminder message carries the unsubscribe link and a flat gateway payload", () => {
  const pesan = pesanPengingat(pengingatRow(), { PUBLIC_URL: "http://127.0.0.1:8055/" });
  assert.match(pesan.subject, /Pelatihan Pemasaran Digital/);
  assert.match(pesan.text, /http:\/\/127\.0\.0\.1:8055\/v1\/program\/kegiatan\/pengingat\/9b222222/);
  assert.match(pesan.html, /href="http:\/\/127\.0\.0\.1:8055\/v1\/program\/kegiatan\/pengingat\/9b222222/);
  assert.deepEqual(pesan.params, { judul: "Pelatihan Pemasaran Digital", subjek: pesan.subject, waktu: pesan.params.waktu, tempat: "Gedung Sate", metode: "daring" });
});

test("a reminder can never carry markup into the reminder email or accept it as a target", () => {
  for (const tujuan of ["a@<img/src=x/onerror=alert(1)>.com", '"><svg/onload=alert(1)>@x.com', "a@x.com<b>"]) {
    assert.throws(() => normalisasiTujuan("email", tujuan), (error) => error.code === "TUJUAN_TIDAK_VALID", tujuan);
  }

  // Event text written by staff is escaped in the HTML mail too.
  const pesan = pesanPengingat(pengingatRow({ judul: "Bazar <script>alert(1)</script>", lokasi: "Gedung <b>Sate</b>" }), {});
  assert.doesNotMatch(pesan.html, /<script>|<b>Sate/);
  assert.match(pesan.html, /Bazar &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("semua route kegiatan bertanda publik (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const { mountEndpoint } = await import("./helpers.js");
  const { routes } = mountEndpoint(registerKegiatan, { env: { SECRET: "s", OPERASIONAL_INTERNAL_SECRET: "rahasia" } });
  assert.equal(routes.length, 6);
  for (const { method, path, handler } of routes) {
    assert.equal(cakupan.tandaCakupan(handler)?.jenis, "publik", `${method} ${path}`);
  }
});
