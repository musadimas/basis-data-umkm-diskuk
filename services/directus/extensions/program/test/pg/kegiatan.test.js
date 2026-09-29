import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createChallenge, pbkdf2, solveChallenge } from "altcha/lib";
import registerKegiatan from "../../src/endpoints/kegiatan/index.js";
import registerNotifikasiHook from "../../src/hooks/notifikasi.js";
import {
  batalkanPengingat,
  detailKegiatan,
  lihatPengingat,
  listKegiatan,
  jadwalkanPengingatJatuhTempo,
  optInPengingat,
} from "../../src/endpoints/kegiatan/service.js";
import { buatPengingat, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { buatOutbox } from "../../src/lib/outbox/index.js";
import { mountEndpoint } from "../helpers.js";

const skip = { skip: pgSkipReason() };
const now = new Date("2026-09-27T03:00:00Z");
const TEST_ENV = { SECRET: "unit-test-directus-secret" };
const TOKEN_ASING = "9b222222-2222-4222-8222-000000000002";
const HARI = 864e5;

/** Solves a freshly issued ALTCHA challenge the way the browser widget does. */
async function solvedCaptcha(env = TEST_ENV) {
  const secret = crypto.createHmac("sha256", String(env.SECRET)).update("diskuk-auth-captcha-v1").digest("hex");
  const challenge = await createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 10,
    deriveKey: pbkdf2.deriveKey,
    hmacSignatureSecret: secret,
    expiresAt: new Date(Date.now() + 300_000),
  });
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
}

/** Kegiatan terbit dengan kolom publik lengkap; `over` memakai nama kolom tabel. */
async function buatAgenda(db, over = {}) {
  const row = {
    id: uuid(),
    judul: "Pelatihan Pemasaran Digital",
    ringkasan: "Kelas daring",
    kategori: "pelatihan",
    penyelenggara: "Dinas KUMKM Kabupaten Subang",
    kota_nama: "Kabupaten Subang",
    metode: "daring",
    ramah_disabilitas: true,
    tanggal_mulai: new Date("2026-10-10T02:00:00Z"),
    tanggal_selesai: new Date("2026-10-12T09:00:00Z"),
    batas_registrasi: new Date("2026-10-08T09:00:00Z"),
    lokasi: "Gedung Sate",
    link: "https://diskuk.example.invalid/streaming",
    kuota: 50,
    terisi: 10,
    syarat_nib: true,
    registration_url: "https://daftar.example.invalid/form",
    dokumen_url: "http://dokumen.example.invalid/panduan",
    status_publikasi: "terbit",
    ...over,
  };
  await db("kegiatan").insert(row);
  return row;
}

const jatuhTempo = new Date("2026-09-27T02:00:00Z");
const buatDue = (db, kegiatanId, over = {}) => buatPengingat(db, { kegiatanId, jadwalKirim: jatuhTempo, ...over });
const logger = { warn() {}, info() {}, error() {} };
const outboxUji = (db) => buatOutbox({ database: db, logger, adapters: [] });
const hitung = async (db, tabel) => Number((await db(tabel).count({ n: "*" }).first()).n);

// ── List dan detail ────────────────────────────────────────────────────────

test("daftar publik hanya membaca baris terbit, menyaring di server dan menghitung kelompok", skip, async (t) => {
  const { db } = await withDatabase(t);
  const a = await buatAgenda(db);
  const b = await buatAgenda(db, {
    judul: "Pameran Kriya", kategori: "pameran", metode: "luring", ramah_disabilitas: false, penyelenggara: "Mitra Kampus",
    tanggal_mulai: new Date("2026-10-20T02:00:00Z"), tanggal_selesai: new Date("2026-10-21T02:00:00Z"), kuota: 10, terisi: 10,
  });
  await buatAgenda(db, { judul: "Draft", status_publikasi: "draft" });
  await buatAgenda(db, { judul: "Dibatalkan", status_publikasi: "dibatalkan" });
  const berjalan = await buatAgenda(db, { judul: "Sedang Berjalan", tanggal_mulai: new Date("2026-09-26T02:00:00Z"), tanggal_selesai: new Date("2026-09-28T02:00:00Z"), batas_registrasi: null });
  const selesai = await buatAgenda(db, { judul: "Sudah Lewat", tanggal_mulai: new Date("2026-08-01T02:00:00Z"), tanggal_selesai: new Date("2026-08-02T02:00:00Z"), batas_registrasi: null });

  const semua = await listKegiatan(db, {}, now);
  assert.deepEqual(semua.data.map((item) => item.id), [selesai.id, berjalan.id, a.id, b.id], "urut tanggal_mulai; draft dan dibatalkan tidak tampil");
  assert.deepEqual(semua.meta.kelompok, { berjalan: 1, pendaftaran: 1, segera: 1, selesai: 1 });
  assert.equal(semua.meta.jumlah, 4);
  assert.equal(semua.meta.terpotong, false);
  assert.equal(semua.meta.serverNow, now.toISOString());
  assert.equal(semua.meta.opsi.penyelenggara.filter((value) => value.startsWith("Dinas KUMKM ")).length, 27);
  assert.ok(semua.meta.opsi.penyelenggara.includes("Mitra Kampus"), "penyelenggara dari DB ikut ditawarkan");
  assert.deepEqual(semua.meta.opsi.kategori.map((item) => item.value), ["pelatihan", "sertifikasi", "pameran", "akselerasi", "literasi_digital"]);

  const dto = semua.data.find((item) => item.id === a.id);
  assert.equal(dto.registrationUrl, "https://daftar.example.invalid/form");
  assert.equal(dto.dokumenUrl, null, "tautan http:// tidak dipublikasikan");
  assert.equal(dto.syarat.nib, true);
  assert.equal(dto.statusLabel, "Pendaftaran Dibuka");

  const disaring = await listKegiatan(db, { kategori: "pelatihan", ramah: "1", metode: "daring" }, now);
  assert.deepEqual(disaring.data.map((item) => item.id).sort(), [a.id, berjalan.id, selesai.id].sort());
  const penyelenggara = await listKegiatan(db, { penyelenggara: "Mitra Kampus" }, now);
  assert.deepEqual(penyelenggara.data.map((item) => item.id), [b.id]);
  const status = await listKegiatan(db, { status: "selesai" }, now);
  assert.deepEqual(status.data.map((item) => item.id), [selesai.id]);
  assert.deepEqual(status.meta.kelompok, { berjalan: 0, pendaftaran: 0, segera: 0, selesai: 1 });
});

test("jendela bulan mengikuti kalender WIB pada batas bulan", skip, async (t) => {
  const { db } = await withDatabase(t);
  // 31 Okt 20:00 UTC = 1 Nov 03:00 WIB: milik November.
  const november = await buatAgenda(db, { judul: "Awal November", tanggal_mulai: new Date("2026-10-31T20:00:00Z"), tanggal_selesai: new Date("2026-10-31T22:00:00Z") });
  const oktober = await buatAgenda(db, { judul: "Akhir Oktober", tanggal_mulai: new Date("2026-10-31T10:00:00Z"), tanggal_selesai: new Date("2026-10-31T12:00:00Z") });
  assert.deepEqual((await listKegiatan(db, { bulan: "11", tahun: "2026" }, now)).data.map((item) => item.id), [november.id]);
  assert.deepEqual((await listKegiatan(db, { bulan: "10", tahun: "2026" }, now)).data.map((item) => item.id), [oktober.id]);
});

test("detail menjawab 404 untuk draft, dibatalkan atau id tak dikenal", skip, async (t) => {
  const { db } = await withDatabase(t);
  const terbit = await buatAgenda(db);
  const draft = await buatAgenda(db, { status_publikasi: "draft" });
  const batal = await buatAgenda(db, { status_publikasi: "dibatalkan" });
  assert.equal((await detailKegiatan(db, terbit.id, now)).data.judul, "Pelatihan Pemasaran Digital");
  for (const id of [draft.id, batal.id, uuid()]) {
    await assert.rejects(detailKegiatan(db, id, now), (error) => error.statusCode === 404 && error.code === "KEGIATAN_NOT_FOUND");
  }
});

// ── Opt-in pengingat ───────────────────────────────────────────────────────

test("opt-in memvalidasi tujuan sebelum captcha: captcha tidak terpakai, tidak ada baris", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  await assert.rejects(
    optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@", captcha: "bogus" }, now, outboxUji(db)),
    (error) => error.code === "TUJUAN_TIDAK_VALID",
  );
  await assert.rejects(
    optInPengingat(db, TEST_ENV, event.id, { kanal: "telegram", tujuan: "0812", captcha: "bogus" }, now, outboxUji(db)),
    (error) => error.code === "INVALID_PAYLOAD",
  );
  await assert.rejects(
    optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha: "bogus" }, now, outboxUji(db)),
    (error) => error.code === "CAPTCHA_INVALID",
  );
  assert.equal(await hitung(db, "kegiatan_pengingat"), 0);
  assert.equal(await hitung(db, "auth_captcha_used"), 0);
});

test("opt-in menyimpan satu pengingat dengan tujuan tersamar dan token pembatalan", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const hasil = await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "Wawan@Gmail.com", captcha: await solvedCaptcha() }, now, outboxUji(db));

  const row = await db("kegiatan_pengingat").first();
  assert.deepEqual(hasil.data, {
    id: row.id,
    kegiatan: { id: event.id, judul: "Pelatihan Pemasaran Digital" },
    kanal: "email",
    tujuanMasked: "w***@gmail.com",
    jadwalKirim: "2026-10-09T02:00:00.000Z",
    status: "menunggu",
    batalToken: row.token,
  });
  assert.equal(row.tujuan, "wawan@gmail.com");
  assert.equal(row.alasan, null);
});

test("opt-in ulang memakai ON CONFLICT: satu baris, token sama, langganan dibuka lagi dengan jadwal baru", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const pertama = await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha: await solvedCaptcha() }, now, outboxUji(db));
  await db("kegiatan_pengingat").where({ id: pertama.data.id }).update({ status: "dibatalkan", alasan: "pengguna", dibatalkan_at: new Date() });

  const kedua = await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "WAWAN@gmail.com", jadwalKirim: "2026-10-09T01:00:00Z", captcha: await solvedCaptcha() }, now, outboxUji(db));
  assert.equal(kedua.data.id, pertama.data.id);
  assert.equal(kedua.data.batalToken, pertama.data.batalToken);
  assert.equal(kedua.data.jadwalKirim, "2026-10-09T01:00:00.000Z");
  const semua = await db("kegiatan_pengingat");
  assert.equal(semua.length, 1);
  assert.equal(semua[0].status, "menunggu");
  assert.equal(semua[0].alasan, null);
  assert.equal(semua[0].dibatalkan_at, null);
});

test("dua opt-in paralel untuk tujuan yang sama menghasilkan satu baris", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const [x, y] = await Promise.all([
    solvedCaptcha().then((captcha) => optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha }, now, outboxUji(db))),
    solvedCaptcha().then((captcha) => optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha }, now, outboxUji(db))),
  ]);
  assert.equal(x.data.id, y.data.id);
  assert.equal(x.data.batalToken, y.data.batalToken);
  assert.equal(await hitung(db, "kegiatan_pengingat"), 1);
});

test("captcha yang sama tidak bisa dipakai dua kali", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const captcha = await solvedCaptcha();
  await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha }, now, outboxUji(db));
  await assert.rejects(
    optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "lain@gmail.com", captcha }, now, outboxUji(db)),
    (error) => error.code === "CAPTCHA_INVALID",
  );
  assert.equal(await hitung(db, "kegiatan_pengingat"), 1);
});

test("opt-in WhatsApp tanpa gateway dilaporkan menunggu_gateway tetapi disimpan sebagai menunggu", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const tanpa = await optInPengingat(db, TEST_ENV, event.id, { kanal: "whatsapp", tujuan: "081234567890", captcha: await solvedCaptcha() }, now, outboxUji(db));
  assert.equal(tanpa.data.status, "menunggu_gateway");
  assert.equal(tanpa.data.tujuanMasked, "62812****890");
  assert.equal((await db("kegiatan_pengingat").where({ id: tanpa.data.id }).first()).status, "menunggu", "kosakata tersimpan tetap menunggu | dijadwalkan | dibatalkan");

  const siap = await optInPengingat(db, { ...TEST_ENV, WHATSAPP_GATEWAY_URL: "https://wa.example.invalid/send" }, event.id, { kanal: "whatsapp", tujuan: "081234567891", captcha: await solvedCaptcha() }, now, outboxUji(db));
  assert.equal(siap.data.status, "menunggu");
});

test("opt-in ditolak untuk kegiatan selesai (409) atau tidak terbit (404) tanpa memakai captcha", skip, async (t) => {
  const { db } = await withDatabase(t);
  const lewat = await buatAgenda(db, { tanggal_mulai: new Date("2026-08-01T02:00:00Z"), tanggal_selesai: new Date("2026-08-02T02:00:00Z") });
  const batal = await buatAgenda(db, { status_publikasi: "dibatalkan" });
  const body = { kanal: "email", tujuan: "wawan@gmail.com", captcha: await solvedCaptcha() };
  await assert.rejects(optInPengingat(db, TEST_ENV, lewat.id, body, now, outboxUji(db)), (error) => error.statusCode === 409 && error.code === "KEGIATAN_SELESAI");
  await assert.rejects(optInPengingat(db, TEST_ENV, batal.id, body, now, outboxUji(db)), (error) => error.statusCode === 404 && error.code === "KEGIATAN_NOT_FOUND");
  await assert.rejects(optInPengingat(db, TEST_ENV, uuid(), body, now, outboxUji(db)), (error) => error.code === "KEGIATAN_NOT_FOUND");
  assert.equal(await hitung(db, "auth_captcha_used"), 0, "captcha masih sah untuk percobaan berikutnya");
});

// ── Pembatalan ─────────────────────────────────────────────────────────────

test("pembatalan lewat token idempoten dan tidak membocorkan pengingat lain", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const dibuat = await buatDue(db, event.id, { tujuan: "wawan@gmail.com", tujuanMasked: "w***@gmail.com" });
  const lain = await buatDue(db, event.id, { tujuan: "lain@gmail.com" });
  const { token } = await db("kegiatan_pengingat").where({ id: dibuat.id }).first();

  assert.equal((await lihatPengingat(db, token)).data.status, "menunggu");
  const pertama = await batalkanPengingat(db, token, outboxUji(db));
  assert.deepEqual(pertama.data, { kanal: "email", tujuanMasked: "w***@gmail.com", status: "dibatalkan", sudah: false });
  const kedua = await batalkanPengingat(db, token, outboxUji(db));
  assert.deepEqual(kedua.data, { kanal: "email", tujuanMasked: "w***@gmail.com", status: "dibatalkan", sudah: true });

  const row = await db("kegiatan_pengingat").where({ id: dibuat.id }).first();
  assert.equal(row.alasan, "pengguna");
  assert.ok(row.dibatalkan_at);
  assert.equal((await db("kegiatan_pengingat").where({ id: lain.id }).first()).status, "menunggu");

  await assert.rejects(batalkanPengingat(db, TOKEN_ASING, outboxUji(db)), (error) => error.statusCode === 404 && error.code === "TOKEN_TIDAK_DITEMUKAN");
  await assert.rejects(batalkanPengingat(db, "bukan-token", outboxUji(db)), (error) => error.code === "INVALID_PAYLOAD");
  await assert.rejects(lihatPengingat(db, TOKEN_ASING), (error) => error.code === "TOKEN_TIDAK_DITEMUKAN");
});

// ── Penjadwalan pengingat (sisi kegiatan dari job; pengiriman ada di test/pg/outbox*.test.js) ──

test("dua penjadwal paralel membagi langganan jatuh tempo tanpa menggandakan pesan (SKIP LOCKED)", skip, async (t) => {
  const { db } = await withDatabase(t);
  const outbox = outboxUji(db);
  const event = await buatAgenda(db);
  const dibuat = [];
  for (let i = 0; i < 8; i++) dibuat.push(await buatDue(db, event.id, { tujuan: `u${i}@contoh.test` }));

  const [x, y] = await Promise.all([
    jadwalkanPengingatJatuhTempo({ database: db, outbox, env: {}, now }),
    jadwalkanPengingatJatuhTempo({ database: db, outbox, env: {}, now }),
  ]);
  assert.equal(x.dijadwalkan + y.dijadwalkan, 8);
  const antrean = await db("notifikasi_outbox").orderBy("pengingat");
  assert.deepEqual(antrean.map((row) => row.pengingat).sort(), dibuat.map((p) => p.id).sort(), "satu pesan per langganan");
  assert.equal((await db("kegiatan_pengingat").where({ status: "dijadwalkan" })).length, 8);
});

test("opt-in ulang membatalkan pesan pending langganan itu di outbox dalam transaksi yang sama", skip, async (t) => {
  const { db } = await withDatabase(t);
  const outbox = outboxUji(db);
  const event = await buatAgenda(db);
  const pertama = await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", jadwalKirim: "2026-09-27T03:30:00Z", captcha: await solvedCaptcha() }, now, outbox);
  const dijadwalkan = await jadwalkanPengingatJatuhTempo({ database: db, outbox, env: {}, now: new Date("2026-09-27T04:00:00Z") });
  assert.equal(dijadwalkan.dijadwalkan, 1);
  assert.equal((await db("notifikasi_outbox").first()).status, "pending");

  const kedua = await optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha: await solvedCaptcha() }, now, outbox);
  assert.equal(kedua.data.id, pertama.data.id);
  assert.equal((await db("notifikasi_outbox").first()).status, "batal", "pesan untuk jadwal lama tidak lagi terkirim");
  assert.equal((await db("kegiatan_pengingat").first()).status, "menunggu");
});

test("opt-in yang gagal menulis outbox membatalkan upsert langganan (rollback nyata)", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const outbox = { batalkan: async () => { throw new Error("outbox mati"); } };
  await assert.rejects(
    optInPengingat(db, TEST_ENV, event.id, { kanal: "email", tujuan: "wawan@gmail.com", captcha: await solvedCaptcha() }, now, outbox),
    /outbox mati/,
  );
  assert.equal(await hitung(db, "kegiatan_pengingat"), 0);
});

// ── Hook terjadwal ─────────────────────────────────────────────────────────

function pasangHook(context) {
  const jadwal = [];
  registerNotifikasiHook({ schedule: (cron, fn) => jadwal.push({ cron, fn }) }, context);
  return jadwal;
}

test("hook terjadwal menjadwalkan langganan jatuh tempo lalu mendispatch outbox lewat MailService", skip, async (t) => {
  const { db } = await withDatabase(t);
  // Hook memakai jam nyata, jadi kegiatannya dibuat relatif terhadap sekarang.
  const event = await buatAgenda(db, { tanggal_mulai: new Date(Date.now() + 5 * HARI), tanggal_selesai: new Date(Date.now() + 6 * HARI), batas_registrasi: null });
  const p = await buatDue(db, event.id, { tujuan: "wawan@gmail.com" });
  const surat = [];
  class MailService {
    async send(data) {
      surat.push(data);
      return { messageId: "<hook@diskuk>" };
    }
  }
  const info = [];
  const [tugas] = pasangHook({ database: db, env: {}, services: { MailService }, getSchema: async () => ({}), logger: { ...logger, info: (m) => info.push(m) } });
  assert.equal(tugas.cron, "0 * * * * *");
  await tugas.fn();
  assert.equal(surat.length, 1);
  assert.equal(surat[0].to, "wawan@gmail.com");
  assert.equal((await db("kegiatan_pengingat").where({ id: p.id }).first()).status, "dijadwalkan");
  assert.equal((await db("notifikasi_outbox").where({ pengingat: p.id }).first()).status, "diterima");
  assert.equal(info.length, 2, "satu log penjadwalan dan satu log outbox");
});

test("hook terjadwal mencatat kegagalan ke logger, diam bila tabel belum termigrasi, dan tidak melempar", skip, async () => {
  const galat = [];
  const log = { ...logger, error: (...args) => galat.push(args) };
  const dbRusak = { raw: async () => { throw new Error("db mati"); }, transaction: async () => { throw new Error("db mati"); } };
  await pasangHook({ database: dbRusak, env: {}, logger: log })[0].fn();
  assert.equal(galat.length, 2, "penjadwalan dan dispatch dicatat sendiri-sendiri");

  galat.length = 0;
  const tabelHilang = Object.assign(new Error("relation does not exist"), { code: "42P01" });
  const dbLama = { raw: async () => { throw tabelHilang; }, transaction: async () => { throw tabelHilang; } };
  await pasangHook({ database: dbLama, env: {}, logger: log })[0].fn();
  assert.equal(galat.length, 0);
});

// ── Rute HTTP (DB nyata) ───────────────────────────────────────────────────

test("rute agenda tetap publik kecuali job yang memerlukan secret internal", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const { call } = mountEndpoint(registerKegiatan, { database: db, env: { SECRET: "s", OPERASIONAL_INTERNAL_SECRET: "rahasia" } });

  const daftar = await call("GET", "/", { accountability: null, query: {} });
  assert.equal(daftar.res.statusCode, 200);
  // meta ikut di dalam data supaya SDK Directus (yang membuka `data`) tidak kehilangannya.
  assert.equal(daftar.res.body.data.items.length, 1);
  assert.equal(daftar.res.body.data.items[0].id, event.id);
  assert.equal(daftar.res.body.data.meta.jumlah, 1);
  assert.equal(daftar.res.body.meta, undefined);

  const detail = await call("GET", `/${event.id}`, { accountability: null });
  assert.equal(detail.res.body.data.id, event.id);
  const salah = await call("GET", "/bukan-uuid", { accountability: null });
  assert.equal(salah.res.body.errors[0].extensions.code, "INVALID_KEGIATAN_ID");
  const tidakAda = await call("GET", `/${uuid()}`, { accountability: null });
  assert.equal(tidakAda.res.statusCode, 404);

  const tanpaSecret = await call("POST", "/pengingat/proses", { accountability: null, headers: {} });
  assert.equal(tanpaSecret.res.body.errors[0].extensions.code, "FORBIDDEN");
  const denganSecret = await call("POST", "/pengingat/proses", { accountability: null, headers: { "x-operasional-internal-secret": "rahasia" } });
  assert.equal(denganSecret.res.statusCode, 200);
  assert.deepEqual(denganSecret.res.body.data, { dijadwalkan: 0, dibatalkan: 0, kedaluwarsa: 0, terkirim: 0, gagal: 0, dilewati: 0 });
});

test("opt-in lewat rute menjawab 201; halaman token meminta konfirmasi lalu membatalkan", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db, { tanggal_mulai: new Date(Date.now() + 5 * HARI), tanggal_selesai: new Date(Date.now() + 6 * HARI), batas_registrasi: null });
  const { call } = mountEndpoint(registerKegiatan, { database: db, env: TEST_ENV });

  const dibuat = await call("POST", `/${event.id}/pengingat`, { accountability: null, body: { kanal: "email", tujuan: "wawan@gmail.com", captcha: await solvedCaptcha() } });
  assert.equal(dibuat.res.statusCode, 201);
  const token = dibuat.res.body.data.batalToken;

  const konfirmasi = await call("GET", `/pengingat/${token}`, { accountability: null, query: {} });
  assert.equal(konfirmasi.res.statusCode, 200);
  assert.match(konfirmasi.res.body, /Batalkan pengingat kegiatan\?/);
  assert.equal((await db("kegiatan_pengingat").first()).status, "menunggu", "GET pertama hanya meminta konfirmasi");

  const batal = await call("GET", `/pengingat/${token}`, { accountability: null, query: { konfirmasi: "1" } });
  assert.match(batal.res.body, /Pengingat dibatalkan/);
  assert.equal((await db("kegiatan_pengingat").first()).status, "dibatalkan");
  const lagi = await call("GET", `/pengingat/${token}`, { accountability: null, query: {} });
  assert.match(lagi.res.body, /sudah dibatalkan/);

  const asing = await call("GET", `/pengingat/${TOKEN_ASING}`, { accountability: null, query: {} });
  assert.equal(asing.res.statusCode, 404);
  const viaPost = await call("POST", "/pengingat/batal", { accountability: null, body: { token: TOKEN_ASING } });
  assert.equal(viaPost.res.body.errors[0].extensions.code, "TOKEN_TIDAK_DITEMUKAN");
});

test("baris lama yang berisi markup tetap ditampilkan sebagai teks di halaman pembatalan", skip, async (t) => {
  const { db } = await withDatabase(t);
  const event = await buatAgenda(db);
  const p = await buatDue(db, event.id, { tujuan: "lama@contoh.test", tujuanMasked: "a***@<img src=x onerror=alert(1)>.com" });
  const { token } = await db("kegiatan_pengingat").where({ id: p.id }).first();
  const { call } = mountEndpoint(registerKegiatan, { database: db, env: TEST_ENV });
  for (const query of [{}, { konfirmasi: "1" }]) {
    const { res } = await call("GET", `/pengingat/${token}`, { accountability: null, query });
    assert.equal(res.statusCode, 200);
    assert.doesNotMatch(res.body, /<img/);
    assert.match(res.body, /a\*\*\*@&lt;img src=x onerror=alert\(1\)&gt;\.com/);
  }
});
