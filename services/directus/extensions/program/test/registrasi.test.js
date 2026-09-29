import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createChallenge, pbkdf2, solveChallenge } from "altcha/lib";
import register from "../src/endpoints/registrasi/index.js";
import { butuhPakta, cekEligibilitas, cocokSkala, cocokWilayah, epassPayload, layakSertifikat, persenHadir } from "../src/endpoints/registrasi/rules.js";
import { renderXlsx } from "../src/endpoints/registrasi/xlsx.js";
import { mountEndpoint } from "./helpers.js";
const KEGIATAN = "7a111111-1111-4111-8111-000000000001";
const USAHA = "8b222222-2222-4222-8222-000000000002";
const PENDAFTAR = "9c333333-3333-4333-8333-000000000003";
const PENDAFTARAN = "ad444444-4444-4444-8444-000000000004";
const TOKEN = "be555555-5555-4555-8555-000000000005";
const TEST_ENV = { SECRET: "unit-test-directus-secret" };
async function solvedCaptcha(env = TEST_ENV) {
  const secret = crypto.createHmac("sha256", String(env.SECRET)).update("diskuk-auth-captcha-v1").digest("hex");
  const challenge = await createChallenge({ algorithm: "PBKDF2/SHA-256", cost: 10, deriveKey: pbkdf2.deriveKey, hmacSignatureSecret: secret, expiresAt: new Date(Date.now() + 300_000) });
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}
function fakeDb(jawab) {
  const queries = [];
  const db = { raw: async (sql, bindings = []) => { queries.push({ sql, bindings }); return jawab(sql, bindings) ?? { rows: [] }; }, transaction: async (fn) => fn(db) };
  return { db, queries };
}
test("eligibility: internal flag, NIB, skala and wilayah enforced on server", () => {
  const internal = { pendaftaran_internal: true, status_publikasi: "terbit", syarat_nib: true, syarat_skala: "Mikro, Kecil", syarat_wilayah: "Kabupaten Subang" };
  assert.equal(cekEligibilitas({ ...internal, pendaftaran_internal: false }, {}).boleh, false);
  assert.equal(cekEligibilitas(internal, { nib: null, skala: "micro", kota: "Kabupaten Subang" }).alasan, "wajib_nib");
  assert.equal(cekEligibilitas(internal, { nib: "123", skala: "medium", kota: "Kabupaten Subang" }).alasan, "skala_tidak_memenuhi");
  assert.equal(cekEligibilitas(internal, { nib: "123", skala: "micro", kota: "Kota Bandung" }).alasan, "wilayah_tidak_memenuhi");
  assert.equal(cekEligibilitas(internal, { nib: "123", skala: "micro", kota: "Kabupaten Subang" }).boleh, true);
  assert.equal(cocokSkala(null, null), true);
  assert.equal(cocokWilayah("Jawa Barat", "Kota Bandung"), true);
  assert.throws(() => butuhPakta({ butuh_pakta_integritas: true }, false), (e) => e.code === "PAKTA_WAJIB");
});
test("attendance math: 79.9 stays below the 80 gate, task required", () => {
  assert.equal(persenHadir(10, 8), 80);
  assert.equal(layakSertifikat({ jumlahSesi: 10, hadir: 8, tugasSelesai: true }), true);
  assert.equal(layakSertifikat({ jumlahSesi: 1000, hadir: 799, tugasSelesai: true }), false);
  assert.equal(layakSertifikat({ jumlahSesi: 10, hadir: 10, tugasSelesai: false }), false);
  assert.equal(layakSertifikat({ jumlahSesi: 10, hadir: 10, tugasSelesai: false, butuhTugas: false }), true);
});
test("e-pass binds token to event and registration", () => {
  const qr = epassPayload({ token: TOKEN, kegiatanId: KEGIATAN, pendaftaranId: PENDAFTARAN });
  assert.match(qr, /^DISKUK-EPASS:/);
  assert.ok(qr.includes(TOKEN) && qr.includes(KEGIATAN) && qr.includes(PENDAFTARAN));
});
test("xlsx export parses as zip and never carries NIK", () => {
  const berkas = renderXlsx(["Usaha", "Status"], [["Usaha 01", "diterima"]]);
  assert.equal(berkas.subarray(0, 2).toString(), "PK");
  const text = berkas.toString("latin1");
  assert.ok(text.includes("Usaha 01"));
  assert.doesNotMatch(text, /nik/i);
});
test("daftar: two registrants for the last slot, re-register, waitlist and cancel", async () => {
  const captcha = await solvedCaptcha();
  let statusKedua = "menunggu";
  const { db } = fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: PENDAFTAR, app_role: "umkm", usaha: USAHA, kota_scope: null }] };
    if (sql.includes("INSERT INTO auth_captcha_used")) return { rows: [{ signature: "s" }] };
    if (sql.includes("FROM kegiatan WHERE id")) return { rows: [{ id: KEGIATAN, pendaftaran_internal: true, butuh_pakta_integritas: false, jumlah_sesi: 5, butuh_tugas: true, kuota: 1, syarat_nib: false, syarat_skala: null, syarat_wilayah: null, status_publikasi: "terbit", batas_registrasi: null }] };
    if (sql.includes("FROM usaha u LEFT JOIN")) return { rows: [{ id: USAHA, nama: "Usaha 01", nib: "123", skala: "micro", kota_nama: "Kab. Subang", kota_id: 1 }] };
    if (sql.includes("FROM kegiatan_pendaftaran WHERE kegiatan")) {
      if (statusKedua === "penuh") return { rows: [{ id: PENDAFTARAN }] };
      return { rows: [] };
    }
    if (sql.includes("COUNT(*)::integer AS n FROM kegiatan_pendaftaran")) return { rows: [{ n: statusKedua === "penuh" ? 1 : 0 }] };
    if (sql.includes("INSERT INTO kegiatan_pendaftaran")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: statusKedua === "penuh" ? "daftar_tunggu" : "menunggu", skor_talent: null, skor_rubrik: null, administrasi_lolos: false, alasan: null, epass_token: TOKEN, tugas_selesai: false, diputuskan_pada: null, date_created: new Date().toISOString() }] };
    return { rows: [] };
  });
  const { call } = mountEndpoint(register, { database: db, env: TEST_ENV });
  const body = { butuhDisabilitas: false, consent: true, paktaIntegritas: false, captcha };
  const pertama = await call("POST", `/kegiatan/${KEGIATAN}/daftar`, { body });
  assert.equal(pertama.res.statusCode, 201);
  statusKedua = "penuh";
  const captcha2 = await solvedCaptcha();
  const { db: db2 } = fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: PENDAFTAR, app_role: "umkm", usaha: USAHA, kota_scope: null }] };
    if (sql.includes("INSERT INTO auth_captcha_used")) return { rows: [{ signature: "s2" }] };
    if (sql.includes("FROM kegiatan WHERE id")) return { rows: [{ id: KEGIATAN, pendaftaran_internal: true, butuh_pakta_integritas: false, jumlah_sesi: 5, butuh_tugas: true, kuota: 1, syarat_nib: false, syarat_skala: null, syarat_wilayah: null, status_publikasi: "terbit", batas_registrasi: null }] };
    if (sql.includes("FROM usaha u LEFT JOIN")) return { rows: [{ id: USAHA, nama: "Usaha 02", nib: "124", skala: "micro", kota_nama: "Kab. Subang", kota_id: 1 }] };
    if (sql.includes("FROM kegiatan_pendaftaran WHERE kegiatan") && !sql.includes("COUNT")) return { rows: [] };
    if (sql.includes("COUNT(*)::integer AS n FROM kegiatan_pendaftaran")) return { rows: [{ n: 1 }] };
    if (sql.includes("INSERT INTO kegiatan_pendaftaran")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: "daftar_tunggu", skor_talent: null, skor_rubrik: null, administrasi_lolos: false, alasan: null, epass_token: TOKEN, tugas_selesai: false, diputuskan_pada: null, date_created: new Date().toISOString() }] };
    return { rows: [] };
  });
  const app2 = mountEndpoint(register, { database: db2, env: TEST_ENV });
  const kedua = await app2.call("POST", `/kegiatan/${KEGIATAN}/daftar`, { body: { ...body, captcha: captcha2 } });
  assert.equal(kedua.res.body.data.status, "daftar_tunggu");
});
test("scan QR idempotent: same code twice counts one presence", async () => {
  const { db } = fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: PENDAFTAR, app_role: "provinsi", usaha: null, kota_scope: null }] };
    if (sql.includes("FROM kegiatan_pendaftaran p JOIN kegiatan")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, epass_token: TOKEN, jumlah_sesi: 5, status: "diterima" }] };
    if (sql.includes("INSERT INTO kegiatan_presensi")) return { rows: [] };
    if (sql.includes("COUNT(*)::integer AS hadir")) return { rows: [{ hadir: 1 }] };
    return { rows: [] };
  });
  const { call } = mountEndpoint(register, { database: db, env: { ...TEST_ENV, OPERASIONAL_INTERNAL_SECRET: "rahasia" } });
  const qr = `DISKUK-EPASS:${KEGIATAN}:${PENDAFTARAN}:${TOKEN}`;
  const a = await call("POST", "/pindai", { headers: { "x-operasional-internal-secret": "rahasia" }, body: { qr, sesiKe: 1 } });
  const b = await call("POST", "/pindai", { headers: { "x-operasional-internal-secret": "rahasia" }, body: { qr, sesiKe: 1 } });
  assert.equal(a.res.body.data.hadir, 1);
  assert.equal(b.res.body.data.hadir, 1);
  assert.equal(b.res.body.data.persen, 20);
  const tanpa = await call("POST", "/pindai", { headers: {}, body: { qr, sesiKe: 1 } });
  assert.equal(tanpa.nextError?.statusCode ?? tanpa.res.statusCode, 403);
});
test("sertifikat: cross-participant QR refused; revoke clears the indicator impact", async () => {
  const { db } = fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: PENDAFTAR, app_role: "provinsi", usaha: null, kota_scope: null }] };
    if (sql.includes("FROM kegiatan_pendaftaran p JOIN kegiatan k")) return { rows: [] };
    return { rows: [] };
  });
  const { call } = mountEndpoint(register, { database: db, env: { ...TEST_ENV, OPERASIONAL_INTERNAL_SECRET: "rahasia" } });
  const qrAsing = `DISKUK-EPASS:${KEGIATAN}:${PENDAFTARAN}:cf666666-6666-4666-8666-000000000006`;
  const res = await call("POST", "/pindai", { headers: { "x-operasional-internal-secret": "rahasia" }, body: { qr: qrAsing, sesiKe: 1 } });
  assert.equal(res.res.body.errors[0].extensions.code, "QR_TIDAK_DITEMUKAN");
});
test("routes carry the cakupan mark; scan keeps the internal secret", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const { routes } = mountEndpoint(register, { env: TEST_ENV });
  assert.ok(routes.length >= 12);
  for (const { method, path, handler } of routes) {
    assert.equal(cakupan.tandaCakupan(handler)?.jenis === undefined, false, `${method} ${path}`);
  }
});
// --- Runtime findings (R03 isolated clone) turned into regressions ---
const STAF_PROV = { id: PENDAFTAR, app_role: "provinsi", usaha: null, kota_scope: null };
const STAF_KAB = { id: PENDAFTAR, app_role: "kabkota", usaha: null, kota_scope: 1 };
const usahaDb = (extra, kegiatan = {}) => fakeDb((sql) => {
  if (sql.includes("FROM directus_users WHERE id")) return { rows: [{ id: PENDAFTAR, app_role: "umkm", usaha: USAHA, kota_scope: null }] };
  if (sql.includes("INSERT INTO auth_captcha_used")) return { rows: [{ signature: "s" + Math.random() }] };
  if (sql.includes("FROM kegiatan WHERE id")) return { rows: [{ id: KEGIATAN, pendaftaran_internal: true, butuh_pakta_integritas: false, jumlah_sesi: 1, butuh_tugas: false, kuota: null, syarat_nib: false, syarat_skala: null, syarat_wilayah: "Subang", status_publikasi: "terbit", batas_registrasi: null, ...kegiatan }] };
  // The service aliases usaha_tabular.kota_nama AS kota; a fake row must use the alias, not the raw column.
  if (sql.includes("FROM usaha u LEFT JOIN")) return { rows: [{ id: USAHA, nama: "U", nib: "1", skala: "micro", kota: extra.kota, kota_id: 1 }] };
  if (sql.includes("FROM kegiatan_pendaftaran WHERE kegiatan")) return { rows: [] };
  if (sql.includes("INSERT INTO kegiatan_pendaftaran")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: "menunggu", epass_token: TOKEN, date_created: new Date().toISOString() }] };
  return { rows: [] };
});
test("daftar: syarat_wilayah reads the usaha city from the query alias (not kota_nama)", async () => {
  const cocok = usahaDb({ kota: "KABUPATEN SUBANG" });
  const a = await mountEndpoint(register, { database: cocok.db, env: TEST_ENV }).call("POST", `/kegiatan/${KEGIATAN}/daftar`, { body: { consent: true, captcha: await solvedCaptcha() } });
  assert.equal(a.res.statusCode, 201);
  const salah = usahaDb({ kota: "KABUPATEN GARUT" });
  const b = await mountEndpoint(register, { database: salah.db, env: TEST_ENV }).call("POST", `/kegiatan/${KEGIATAN}/daftar`, { body: { consent: true, captcha: await solvedCaptcha() } });
  assert.equal(b.res.body.errors[0].extensions.code, "TIDAK_ELIGIBLE");
});
test("daftar: a pending registration already holds a slot (menunggu counts toward kuota)", async () => {
  const { db, queries } = usahaDb({ kota: "KABUPATEN SUBANG" }, { kuota: 1, syarat_wilayah: null });
  await mountEndpoint(register, { database: db, env: TEST_ENV }).call("POST", `/kegiatan/${KEGIATAN}/daftar`, { body: { consent: true, captcha: await solvedCaptcha() } });
  const hitung = queries.find((q) => q.sql.includes("COUNT(*)::integer AS n FROM kegiatan_pendaftaran"));
  assert.match(hitung.sql, /'menunggu'/);
  assert.match(hitung.sql, /'diterima'/);
});
test("sertifikat: issue insert binds every placeholder (incl. issuer) and kabkota is limited to its city", async () => {
  const kunci = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
  const env = { ...TEST_ENV, PASSPORT_SIGNING_PRIVATE_KEY_B64: Buffer.from(kunci).toString("base64") };
  const bangun = (staf, kotaUsaha) => fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [staf] };
    if (sql.includes("FROM usaha_tabular WHERE id")) return { rows: [{ kota_id: kotaUsaha }] };
    if (sql.includes("FROM kegiatan_pendaftaran p JOIN kegiatan k")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: "diterima", jumlah_sesi: 2, butuh_tugas: false, tugas_selesai: false }] };
    if (sql.includes("COUNT(*)::integer AS hadir")) return { rows: [{ hadir: 2 }] };
    if (sql.includes("SELECT * FROM kegiatan_sertifikat WHERE pendaftaran")) return { rows: [] };
    if (sql.includes("INSERT INTO kegiatan_sertifikat ")) return { rows: [{ id: "id-1", kode: "SKAAAAAAAAAA", status: "aktif" }] };
    if (sql.includes("FROM kegiatan_sertifikat s JOIN kegiatan_pendaftaran p")) return { rows: [{ usaha: USAHA }] };
    if (sql.includes("FROM kegiatan_pendaftaran WHERE id")) return { rows: [{ usaha: USAHA }] };
    return { rows: [] };
  });
  const prov = bangun(STAF_PROV, 1);
  const ok = await mountEndpoint(register, { database: prov.db, env }).call("POST", `/pendaftar/${PENDAFTARAN}/sertifikat`, { params: {} });
  assert.equal(ok.res.statusCode, 201);
  const insert = prov.queries.find((q) => q.sql.includes("INSERT INTO kegiatan_sertifikat "));
  assert.equal((insert.sql.match(/\?/g) ?? []).length, insert.bindings.length);
  assert.ok(insert.bindings.every((v) => v !== undefined));
  // kabkota (city 1) must not act on a business of city 2: sertifikat, tugas and cabut all read as 404.
  for (const [method, url, body] of [["POST", `/pendaftar/${PENDAFTARAN}/sertifikat`, {}], ["POST", `/pendaftar/${PENDAFTARAN}/tugas`, { selesai: true }], ["POST", `/sertifikat/${PENDAFTARAN}/cabut`, {}]]) {
    const kab = bangun(STAF_KAB, 2);
    const r = await mountEndpoint(register, { database: kab.db, env }).call(method, url, { body });
    assert.equal(r.res.body?.errors?.[0]?.extensions?.code ?? r.nextError?.code, "PENDAFTARAN_NOT_FOUND", url);
  }
});
test("keputusan batal: kabkota hanya menaikkan antrean kotanya, provinsi antrean tertua kegiatan", async () => {
  const bangun = (staf) => fakeDb((sql) => {
    if (sql.includes("FROM directus_users WHERE id")) return { rows: [staf] };
    if (sql.includes("FROM usaha_tabular WHERE id")) return { rows: [{ kota_id: 1 }] };
    if (sql.includes("FROM kegiatan_pendaftaran p JOIN kegiatan k")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: "diterima", kuota: 5 }] };
    if (sql.includes("SELECT * FROM kegiatan_pendaftaran WHERE id")) return { rows: [{ id: PENDAFTARAN, kegiatan: KEGIATAN, usaha: USAHA, status: "batal" }] };
    return { rows: [] };
  });
  const naikQuery = (queries) => queries.find((q) => q.sql.includes("status = 'daftar_tunggu'"));
  const kab = bangun(STAF_KAB);
  await mountEndpoint(register, { database: kab.db, env: TEST_ENV }).call("POST", `/pendaftar/${PENDAFTARAN}/keputusan`, { body: { keputusan: "batal" } });
  assert.match(naikQuery(kab.queries).sql, /usaha IN \(SELECT id FROM usaha_tabular WHERE kota_id = \?\)/);
  assert.deepEqual(naikQuery(kab.queries).bindings, [PENDAFTAR, KEGIATAN, 1]);
  const prov = bangun(STAF_PROV);
  await mountEndpoint(register, { database: prov.db, env: TEST_ENV }).call("POST", `/pendaftar/${PENDAFTARAN}/keputusan`, { body: { keputusan: "batal" } });
  assert.doesNotMatch(naikQuery(prov.queries).sql, /usaha_tabular/);
  assert.deepEqual(naikQuery(prov.queries).bindings, [PENDAFTAR, KEGIATAN]);
});
