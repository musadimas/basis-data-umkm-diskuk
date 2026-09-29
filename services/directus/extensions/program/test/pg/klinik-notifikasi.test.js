import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatTiket, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

async function versiTiket(db, id) {
  const result = await db.raw(
    `SELECT to_char(date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi
       FROM konsultasi_tiket WHERE id = ?`,
    [id],
  );
  return (result.rows ?? result)[0].versi;
}

test("Tes 9: pembatalan memakai template status berubah (B14) dan tiap versi dapat pesannya sendiri (B15)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const staff = await buatUser(db, { appRole: "provinsi" });
  const tiket = await buatTiket(db, { consent: true, namaUsaha: "Usaha Klinik", namaKontak: "Wawan" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: {} });
  const patch = (body) =>
    call("PATCH", `/tiket/${tiket.id}`, { accountability: akun(staff.id), body });

  const batal1 = await patch({ status: "batal", versi: await versiTiket(db, tiket.id) });
  assert.equal(batal1.res.statusCode, 200, JSON.stringify(batal1.res.body));

  const dijadwalkan = await patch({ status: "dijadwalkan", versi: batal1.res.body.data.versi });
  assert.equal(dijadwalkan.res.statusCode, 200, JSON.stringify(dijadwalkan.res.body));

  // Transisi batal → dijadwalkan → batal: pembatalan kedua harus dapat pesan barunya sendiri.
  const batal2 = await patch({ status: "batal", versi: dijadwalkan.res.body.data.versi });
  assert.equal(batal2.res.statusCode, 200, JSON.stringify(batal2.res.body));

  const hasil = await db.raw(
    "SELECT jenis, template, payload->>'text' AS text FROM notifikasi_outbox WHERE tiket = ? ORDER BY date_created, jenis",
    [tiket.id],
  );
  const pesan = hasil.rows ?? hasil;
  const pembatalan = pesan.filter((item) => item.jenis === "pembatalan");
  assert.equal(pembatalan.length, 2, JSON.stringify(pesan));
  for (const item of pembatalan) {
    assert.notEqual(item.template, "klinik_tiket_dibuat", "pembatalan tidak boleh memakai template tiket dibuat");
    assert.equal(item.template, "klinik_status_berubah");
    assert.match(item.text, /dibatalkan/i);
  }
  assert.equal(pesan.filter((item) => item.jenis === "status_berubah").length, 1);
});

test("resi provider lewat route klinik menerapkan outbox dan tetap menolak rahasia salah", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, { consent: true, namaUsaha: "Usaha Klinik", namaKontak: "Wawan" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: { OPERASIONAL_INTERNAL_SECRET: "rahasia-resi" } });
  const [dibuat] = (
    await db.raw(
      `INSERT INTO notifikasi_outbox (tiket, jenis, tujuan, consent, template, payload, idempotency_key, status, provider_message_id)
       VALUES (?, 'tiket_dibuat', '6281200000001', TRUE, 'klinik_tiket_dibuat', '{}'::jsonb, ?, 'terkirim', 'wamid-route')
       RETURNING id`,
      [tiket.id, `tiket_dibuat:${tiket.id}`],
    )
  ).rows;

  const ditolak = await call("POST", "/notifikasi/receipt", { headers: { "x-diskuk-secret": "salah" }, body: { messageId: "wamid-route", status: "delivered" } });
  assert.equal(ditolak.res.statusCode, 401);
  assert.equal((await db("notifikasi_outbox").where({ id: dibuat.id }).first("status")).status, "terkirim");

  const ok = await call("POST", "/notifikasi/receipt", { headers: { "x-diskuk-secret": "rahasia-resi" }, body: { messageId: "wamid-route", status: "delivered" } });
  assert.equal(ok.res.statusCode, 200);
  assert.deepEqual(ok.res.body.data, { diterapkan: true, status: "diterima" });
  assert.equal((await db("notifikasi_outbox").where({ id: dibuat.id }).first("status")).status, "diterima");
});

test("kanban memuat pesan outbox terbaru tiket dengan labelnya", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const staff = await buatUser(db, { appRole: "provinsi" });
  const tiket = await buatTiket(db, { consent: true, namaUsaha: "Usaha Klinik", namaKontak: "Wawan" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: {} });
  const ubah = await call("PATCH", `/tiket/${tiket.id}`, {
    accountability: akun(staff.id),
    body: { status: "dijadwalkan", versi: await versiTiket(db, tiket.id) },
  });
  assert.equal(ubah.res.statusCode, 200, JSON.stringify(ubah.res.body));
  const daftar = await call("GET", "/tiket", { accountability: akun(staff.id) });
  const baris = daftar.res.body.data.find((item) => item.id === tiket.id);
  assert.equal(baris.notifikasi.jenis, "status_berubah");
  assert.equal(baris.notifikasi.status, "pending");
  assert.equal(baris.notifikasi.label, "Menunggu dikirim");
});
