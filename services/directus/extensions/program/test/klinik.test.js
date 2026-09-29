import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../src/endpoints/klinik/index.js";
import { kunciPesan, normalisasiTelepon, nomorTiket, pesanPembatalan, pesanStatusBerubah, pesanTiket, sniffType, tanggalTidakValid } from "../src/endpoints/klinik/rules.js";
import { mountEndpoint } from "./helpers.js";

const env = { SECRET: "unit-test-secret", OPERASIONAL_INTERNAL_SECRET: "receipt-secret" };
const FILE = "11111111-2222-4333-8444-555555555555";

test("bookable dates are weekdays from tomorrow to 30 days ahead, in Jakarta time", () => {
  const now = new Date("2026-09-25T18:00:00Z"); // Saturday 26 Sep 01:00 WIB
  assert.equal(tanggalTidakValid("2026-09-26", now), "TANGGAL_DI_LUAR_RENTANG");
  assert.equal(tanggalTidakValid("2026-09-27", now), "TANGGAL_AKHIR_PEKAN");
  assert.equal(tanggalTidakValid("2026-09-28", now), null);
  assert.equal(tanggalTidakValid("2026-10-26", now), null);
  assert.equal(tanggalTidakValid("2026-10-27", now), "TANGGAL_DI_LUAR_RENTANG");
  assert.equal(tanggalTidakValid("2026-02-30", now), "TANGGAL_TIDAK_VALID");
  assert.equal(tanggalTidakValid("besok", now), "TANGGAL_TIDAK_VALID");
});

test("ticket numbers use the Jakarta month and never truncate the counter", () => {
  assert.equal(nomorTiket(7, new Date("2026-09-30T18:00:00Z")), "KLN-2026-10-0007");
  assert.equal(nomorTiket(123456, new Date("2026-09-01T00:00:00Z")), "KLN-2026-09-123456");
});

test("attachments are recognised by content, not by name", () => {
  assert.equal(sniffType(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffType(Buffer.from("<html><script>")), null);
});

test("WhatsApp numbers are normalised to the wa.me form, others are refused", () => {
  assert.equal(normalisasiTelepon("0812-3456-7890"), "6281234567890");
  assert.equal(normalisasiTelepon("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalisasiTelepon("6281234567890"), "6281234567890");
  assert.equal(normalisasiTelepon("021-555"), null);
  assert.equal(normalisasiTelepon("81234"), null);
  assert.equal(normalisasiTelepon(null), null);
});

test("WhatsApp messages carry the ticket facts and no personal identifiers", () => {
  const tiket = { id: FILE, nomor: "KLN-2026-09-0007", poli_nama: "Legalitas & Standardisasi Produk", jadwal_tanggal: "2026-09-28", jadwal_slot: "09:00", moda: "daring" };
  const dibuat = pesanTiket(tiket);
  assert.equal(dibuat.template, "klinik_tiket_dibuat");
  assert.deepEqual(dibuat.payload.params, { nomor: "KLN-2026-09-0007", poli: "Legalitas & Standardisasi Produk", tanggal: "2026-09-28", slot: "09:00", moda: "daring (video call)" });
  assert.match(dibuat.payload.text, /KLN-2026-09-0007/);
  const berubah = pesanStatusBerubah(tiket, "dijadwalkan");
  assert.equal(berubah.template, "klinik_status_berubah");
  assert.match(berubah.payload.text, /jadwal ditetapkan/);
  assert.doesNotMatch(berubah.payload.text, /\b08\d{8,}/);
});

test("pembatalan memakai template status berubah dan teks pembatalan, bukan tiket diterima (B14)", () => {
  const batal = pesanPembatalan({ id: FILE, nomor: "KLN-2026-09-0007" });
  assert.equal(batal.template, "klinik_status_berubah");
  assert.deepEqual(batal.payload.params, { nomor: "KLN-2026-09-0007", status: "batal", label: "dibatalkan" });
  assert.match(batal.payload.text, /dibatalkan/);
  assert.doesNotMatch(batal.payload.text, /sudah kami terima/);
});

test("kunci pesan: satu per tiket, jenis, status tujuan dan versi (B15)", () => {
  assert.equal(kunciPesan(FILE, "tiket_dibuat"), `tiket_dibuat:${FILE}`);
  assert.equal(kunciPesan(FILE, "status_berubah", "dijadwalkan"), `status_berubah:${FILE}:dijadwalkan`);
  assert.notEqual(kunciPesan(FILE, "status_berubah", "dijadwalkan"), kunciPesan(FILE, "status_berubah", "selesai"));
  assert.notEqual(kunciPesan(FILE, "pembatalan", "batal", "v1"), kunciPesan(FILE, "pembatalan", "batal", "v2"));
});

test("there is no public NIB/NIK lookup left to act as an identity oracle", async () => {
  const { routes } = mountEndpoint(registerKlinik, { env });
  assert.equal(routes.some((route) => /lookup|nib|nik/i.test(route.path)), false);
  assert.deepEqual(
    routes.map(({ method, path }) => `${method} ${path}`),
    [
      "GET /poli",
      "GET /prefill",
      "GET /slot",
      "POST /tiket",
      "POST /tiket/lacak",
      "GET /tiket",
      "PATCH /tiket/:id",
      "GET /lampiran/:fileId",
      "POST /notifikasi/receipt",
    ],
  );
});

test("only the kanban, prefill and attachment routes require a session", async () => {
  const { call, routes } = mountEndpoint(registerKlinik, { env });
  const publik = new Set(["POST /tiket", "POST /tiket/lacak", "POST /notifikasi/receipt", "GET /poli", "GET /slot"]);
  for (const { method, path } of routes) {
    if (publik.has(`${method} ${path}`)) continue;
    const { nextError, res } = await call(method, path.replace(/:\w+/g, FILE), { accountability: null });
    const status = nextError?.statusCode ?? res.statusCode;
    assert.equal(status, 401, `${method} ${path}`);
  }
});

test("public inputs are validated before the captcha or any query", async () => {
  const { call, queries } = mountEndpoint(registerKlinik, { env });
  let { res } = await call("POST", "/tiket/lacak", { accountability: null, body: { nomor: "bukan-nomor", whatsapp: "081234567890" } });
  assert.equal(res.statusCode, 404);
  // A well-formed number still needs a solved captcha, so read-back cannot be used as an oracle.
  ({ res } = await call("POST", "/tiket/lacak", { accountability: null, body: { nomor: "KLN-2026-09-0007", whatsapp: "081234567890" } }));
  assert.equal(res.body.errors[0].extensions.code, "CAPTCHA_INVALID");
  ({ res } = await call("POST", "/tiket/lacak", { accountability: null, body: {} }));
  assert.equal(res.statusCode, 404);
  ({ res } = await call("GET", "/slot", { accountability: null, query: { poli: "1", tanggal: "kemarin" } }));
  assert.equal(res.body.errors[0].extensions.code, "TANGGAL_TIDAK_VALID");
  ({ res } = await call("POST", "/tiket", { accountability: null, headers: { "content-type": "application/json" } }));
  assert.equal(res.statusCode, 400);
  assert.equal(queries.length, 0);
});

test("the receipt callback refuses a missing or wrong shared secret", async () => {
  const { call } = mountEndpoint(registerKlinik, { env });
  let { res } = await call("POST", "/notifikasi/receipt", { headers: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.errors[0].extensions.code, "FORBIDDEN");
  ({ res } = await call("POST", "/notifikasi/receipt", { headers: { "x-diskuk-secret": "salah" } }));
  assert.equal(res.statusCode, 401);
});

test("semua route klinik bertanda terjaga/publik dengan peran yang tepat (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const { routes } = mountEndpoint(registerKlinik, { env });
  assert.equal(routes.length, 9);
  const ekspektasi = [
    ["GET", "/poli", "publik", []],
    ["GET", "/prefill", "terjaga", ["kabkota", "pendamping", "provinsi", "umkm"]],
    ["GET", "/slot", "publik", []],
    ["POST", "/tiket", "publik", []],
    ["POST", "/tiket/lacak", "publik", []],
    ["GET", "/tiket", "terjaga", ["kabkota", "pendamping", "provinsi"]],
    ["PATCH", "/tiket/:id", "terjaga", ["kabkota", "pendamping", "provinsi"]],
    ["GET", "/lampiran/:fileId", "terjaga", ["kabkota", "pendamping", "provinsi", "umkm"]],
    ["POST", "/notifikasi/receipt", "publik", []],
  ];
  for (const [method, path, jenis, peran] of ekspektasi) {
    const route = routes.find((r) => r.method === method && r.path === path);
    assert.ok(route, `${method} ${path} terdaftar`);
    const tanda = cakupan.tandaCakupan(route.handler);
    assert.equal(tanda?.jenis, jenis, `${method} ${path}`);
    assert.deepEqual([...(tanda.peran ?? [])].sort(), peran, `${method} ${path}`);
  }
});
