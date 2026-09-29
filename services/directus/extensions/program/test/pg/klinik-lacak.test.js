import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createChallenge, pbkdf2, solveChallenge } from "altcha/lib";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { buatTiket } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const ENV = { SECRET: "pg-test-directus-secret" };

/** Solves a freshly issued ALTCHA challenge the way the browser widget does. */
async function captchaSah() {
  const secret = crypto.createHmac("sha256", ENV.SECRET).update("diskuk-auth-captcha-v1").digest("hex");
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

const kodeError = (res) => res.body?.errors?.[0]?.extensions?.code;

test("lacak tiket: nomor + telepon cocok mengembalikan DTO publik tanpa data sensitif", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, {
    nomor: "KLN-2026-09-0001",
    namaUsaha: "Usaha Lacak",
    namaKontak: "Rahasia Kontak",
    whatsapp: "6281234567890",
    jadwalTanggal: "2026-12-01",
    jadwalSlot: "10:00",
  });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: ENV });

  // Format telepon lokal (0812...) dan huruf kecil pada nomor harus dinormalisasi.
  const { res } = await call("POST", "/tiket/lacak", {
    accountability: null,
    body: { nomor: tiket.nomor.toLowerCase(), whatsapp: "0812-3456-7890", captcha: await captchaSah() },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const dto = res.body.data;
  assert.equal(dto.nomor, tiket.nomor);
  assert.equal(dto.namaUsaha, "Usaha Lacak");
  assert.equal(dto.status, "masuk");
  assert.equal(dto.moda, "daring");
  assert.equal(dto.tanggal, "2026-12-01");
  assert.equal(dto.slot, "10:00");
  assert.equal(typeof dto.poli, "string");
  // Belum ada notifikasi: status "batal" beserta labelnya.
  assert.deepEqual(dto.notifikasi, { status: "batal", label: "Tidak dikirim" });
  // Data sensitif tidak boleh bocor.
  const json = JSON.stringify(res.body);
  for (const rahasia of ["Rahasia Kontak", "6281234567890", "Tiket uji harness"]) {
    assert.equal(json.includes(rahasia), false, `bocor: ${rahasia}`);
  }
  for (const kunci of ["id", "whatsapp", "email", "namaKontak", "diagnosis", "actionPlan", "catatan", "linkMeet", "riwayat"]) {
    assert.equal(kunci in dto, false, `kunci bocor: ${kunci}`);
  }
});

test("lacak tiket: nomor tidak ada atau telepon tidak cocok memberi 404 yang sama", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, { nomor: "KLN-2026-09-0002", whatsapp: "6281234567890" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: ENV });
  const lacak = async (body) =>
    (await call("POST", "/tiket/lacak", { accountability: null, body: { ...body, captcha: await captchaSah() } })).res;

  const tidakAda = await lacak({ nomor: "KLN-2026-09-9999", whatsapp: "6281234567890" });
  const teleponSalah = await lacak({ nomor: tiket.nomor, whatsapp: "6289999999999" });
  const teleponKosong = await lacak({ nomor: tiket.nomor, whatsapp: "" });
  for (const res of [tidakAda, teleponSalah, teleponKosong]) {
    assert.equal(res.statusCode, 404, JSON.stringify(res.body));
  }
  // Tidak boleh menjadi oracle: respons identik untuk nomor salah dan telepon salah.
  assert.deepEqual(tidakAda.body, teleponSalah.body);
});

test("lacak tiket: captcha palsu atau replay ditolak CAPTCHA_INVALID", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, { nomor: "KLN-2026-09-0003", whatsapp: "6281234567890" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: ENV });
  const body = (captcha) => ({ nomor: tiket.nomor, whatsapp: "6281234567890", captcha });

  const palsu = await call("POST", "/tiket/lacak", { accountability: null, body: body("bogus") });
  assert.equal(palsu.res.statusCode, 400);
  assert.equal(kodeError(palsu.res), "CAPTCHA_INVALID");

  const captcha = await captchaSah();
  const pertama = await call("POST", "/tiket/lacak", { accountability: null, body: body(captcha) });
  assert.equal(pertama.res.statusCode, 200, JSON.stringify(pertama.res.body));
  const ulang = await call("POST", "/tiket/lacak", { accountability: null, body: body(captcha) });
  assert.equal(ulang.res.statusCode, 400);
  assert.equal(kodeError(ulang.res), "CAPTCHA_INVALID");

  // Captcha dikonsumsi tepat sekali di auth_captcha_used.
  const terpakai = await db.raw("SELECT count(*)::int AS n FROM auth_captcha_used");
  assert.equal((terpakai.rows ?? terpakai)[0].n, 1);
});
