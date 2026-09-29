import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createChallenge, pbkdf2, solveChallenge } from "altcha/lib";
import registerKatalog from "../../src/endpoints/katalog/index.js";
import { LOI_MAX_PER_WINDOW, ipHashOf } from "../../src/endpoints/katalog/service.js";
import { createRequire } from "node:module";
import { buatKota, buatProduk, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");

const ENV = { SECRET: "unit-test-directus-secret" };
const CAPTCHA_SECRET_LABEL = "diskuk-auth-captcha-v1";
const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

/** Menyelesaikan challenge dengan kunci yang sama dengan lib/captcha.js. */
async function solvedCaptcha(env = ENV) {
  const secret = crypto.createHmac("sha256", env.SECRET).update(CAPTCHA_SECRET_LABEL).digest("hex");
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

async function siapkan(t, { statusKurasi = "tayang" } = {}) {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const usaha = await buatUsaha(db, { nama: "Keripik Siti", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const produk = await buatProduk(db, { usahaId: usaha.id, nama: "Keripik", statusKurasi });
  const { call } = mountEndpoint(registerKatalog, { database: db, env: ENV });
  const badan = async (lebih = {}) => ({
    produk: produk.id,
    nama: "Pembeli",
    email: "beli@contoh.id",
    pesan: "Minat",
    clientUuid: crypto.randomUUID(),
    persetujuanKontak: true,
    captcha: await solvedCaptcha(),
    ...lebih,
  });
  const kirim = (body, ip = "10.0.0.7") => call("POST", "/loi", { accountability: null, body, ip });
  return { db, usaha, produk, call, badan, kirim };
}

const kode = (hasil) => hasil.res.body.errors[0].extensions.code;
const hitung = async (db) => Number((await db("produk_loi").count("* as n").first()).n);

test("LOI valid menyimpan satu surat dengan persetujuan dan hash IP berkunci, tanpa IP mentah", { skip: pgSkipReason() }, async (t) => {
  const { db, produk, badan, kirim } = await siapkan(t);
  const body = await badan({
    instansi: "PT Contoh",
    telepon: "081234567890",
    jumlah: "1.000 pcs",
    pesan: "Kami tertarik.",
    nama: "Pembeli Grosir",
  });
  const hasil = await kirim(body);
  assert.equal(hasil.res.statusCode, 201, JSON.stringify(hasil.res.body));
  assert.deepEqual(hasil.res.body.data, { diterima: true, duplikat: false });
  const surat = await db("produk_loi").where({ produk: produk.id }).first();
  assert.equal(surat.nama, "Pembeli Grosir");
  assert.equal(surat.instansi, "PT Contoh");
  assert.equal(surat.telepon, "081234567890");
  assert.equal(surat.jumlah, "1.000 pcs");
  assert.equal(surat.persetujuan_kontak, true);
  assert.equal(surat.idempotency_key, body.clientUuid);
  assert.match(surat.ip_hash, /^[0-9a-f]{64}$/);
  assert.equal(surat.ip_hash, ipHashOf({ ip: "10.0.0.7" }, ENV));
  assert.ok(!JSON.stringify(surat).includes("10.0.0.7"));
});

test("retry dengan kunci yang sama dijawab 'sudah diterima' tanpa memakai captcha lagi", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t);
  const body = await badan();
  assert.equal((await kirim(body)).res.statusCode, 201);
  // Captcha lama sudah terpakai; retry tidak boleh sampai ke langkah itu.
  const retry = await kirim(body);
  assert.equal(retry.res.statusCode, 200);
  assert.deepEqual(retry.res.body.data, { diterima: true, duplikat: true });
  assert.equal(await hitung(db), 1);
  assert.equal(Number((await db("auth_captcha_used").count("* as n").first()).n), 1);
});

test("surat identik (email + pesan) dalam 24 jam dianggap duplikat walau kuncinya baru", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t);
  assert.equal((await kirim(await badan())).res.statusCode, 201);
  const lagi = await kirim(await badan());
  assert.equal(lagi.res.statusCode, 200);
  assert.equal(lagi.res.body.data.duplikat, true);
  assert.equal(await hitung(db), 1);
});

test("captcha yang sudah dipakai ditolak walau kunci dan isi surat baru", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t);
  const captcha = await solvedCaptcha();
  assert.equal((await kirim(await badan({ captcha }))).res.statusCode, 201);
  const ulang = await kirim(await badan({ captcha, email: "lain@contoh.id", pesan: "Lain" }));
  assert.equal(ulang.res.statusCode, 400);
  assert.equal(kode(ulang), "CAPTCHA_INVALID");
  assert.equal(await hitung(db), 1);
});

test("captcha palsu atau kosong ditolak dan tidak ada yang tertulis", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t);
  for (const captcha of ["bogus", undefined]) {
    const hasil = await kirim(await badan({ captcha }));
    assert.equal(kode(hasil), "CAPTCHA_INVALID");
  }
  assert.equal(await hitung(db), 0);
});

test("produk yang belum tayang tidak menerima surat (404)", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t, { statusKurasi: "menunggu" });
  const hasil = await kirim(await badan());
  assert.equal(hasil.res.statusCode, 404);
  assert.equal(kode(hasil), "PRODUK_NOT_FOUND");
  assert.equal(await hitung(db), 0);
});

test("terlalu banyak surat dari satu alamat dalam jendela dijawab 429", { skip: pgSkipReason() }, async (t) => {
  const { db, produk, badan, kirim } = await siapkan(t);
  const ipHash = ipHashOf({ ip: "10.0.0.7" }, ENV);
  for (let i = 0; i < LOI_MAX_PER_WINDOW; i += 1) {
    await db("produk_loi").insert({
      produk: produk.id,
      nama: `Pembeli ${i}`,
      email: `p${i}@contoh.id`,
      pesan: `Pesan ${i}`,
      persetujuan_kontak: true,
      ip_hash: ipHash,
    });
  }
  const hasil = await kirim(await badan());
  assert.equal(hasil.res.statusCode, 429);
  assert.equal(kode(hasil), "TERLALU_BANYAK_PERMINTAAN");
  assert.equal(await hitung(db), LOI_MAX_PER_WINDOW);
  // Alamat lain tidak terpengaruh.
  assert.equal((await kirim(await badan(), "10.0.0.8")).res.statusCode, 201);
});

test("dua LOI paralel dengan clientUuid sama menyimpan tepat satu surat (201 + 200)", { skip: pgSkipReason() }, async (t) => {
  const { db, badan, kirim } = await siapkan(t);
  const kunci = crypto.randomUUID();
  // Dua captcha berbeda, kunci sama: keduanya lolos idempotensi dan captcha, unique parsial menengahi.
  const [a, b] = await Promise.all([
    kirim(await badan({ clientUuid: kunci, pesan: "Pesan A" })),
    kirim(await badan({ clientUuid: kunci, pesan: "Pesan B" })),
  ]);
  assert.deepEqual([a.res.statusCode, b.res.statusCode].sort(), [200, 201]);
  assert.equal(await hitung(db), 1);
  const duplikat = [a, b].find((hasil) => hasil.res.statusCode === 200);
  assert.equal(duplikat.res.body.data.duplikat, true);
});

test("daftar LOI: kurator melihat semua, pemilik hanya produknya, pihak lain 403", { skip: pgSkipReason() }, async (t) => {
  const { db, usaha, produk, call, badan, kirim } = await siapkan(t);
  const usahaLain = await buatUsaha(db, { nama: "Batik Lain", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  const produkLain = await buatProduk(db, { usahaId: usahaLain.id, nama: "Batik", statusKurasi: "tayang" });
  assert.equal((await kirim(await badan())).res.statusCode, 201);
  assert.equal((await kirim(await badan({ produk: produkLain.id, email: "b@contoh.id" }))).res.statusCode, 201);

  const kurator = await buatUser(db, { appRole: "provinsi" });
  const semua = await call("GET", "/loi", { accountability: akun(kurator.id) });
  assert.equal(semua.res.statusCode, 200);
  assert.equal(semua.res.body.data.length, 2);

  const pemilik = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const miliknya = await call("GET", "/loi", { accountability: akun(pemilik.id) });
  assert.equal(miliknya.res.statusCode, 200);
  assert.deepEqual(miliknya.res.body.data.map((surat) => surat.produk), [produk.id]);

  const asing = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });
  const ditolak = await call("GET", "/loi", { accountability: akun(asing.id) });
  // Kabkota tidak lolos gate peran adapter (diteruskan ke next, bukan res).
  assert.equal(ditolak.nextError?.statusCode ?? ditolak.res.statusCode, 403);
});
