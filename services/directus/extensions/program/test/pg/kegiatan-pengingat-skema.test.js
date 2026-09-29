import assert from "node:assert/strict";
import test from "node:test";
import * as migrasi from "../../../../migrations/20260929B-kegiatan-pengingat-drop-kolom-lama.js";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const KOLOM_LAMA = ["percobaan", "provider_id", "dikirim_at"];

async function kolom(db) {
  const hasil = await db.raw(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'kegiatan_pengingat'`,
  );
  return hasil.rows.map((row) => row.column_name);
}

async function fieldDirectus(db) {
  const hasil = await db.raw(
    `SELECT field FROM directus_fields WHERE collection = 'kegiatan_pengingat' AND field = ANY(?)`,
    [KOLOM_LAMA],
  );
  return hasil.rows.map((row) => row.field);
}

test("kegiatan_pengingat tidak lagi menyimpan kolom kirim lama; up/down/up utuh", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);

  const sesudahUp = await kolom(db);
  for (const nama of KOLOM_LAMA) assert.ok(!sesudahUp.includes(nama), `${nama} sudah dibuang`);
  for (const nama of ["alasan", "dibatalkan_at", "token", "status", "jadwal_kirim"]) {
    assert.ok(sesudahUp.includes(nama), `${nama} tetap dipakai langganan`);
  }
  assert.deepEqual(await fieldDirectus(db), [], "metadata field Directus ikut dibuang");

  await migrasi.down(db);
  assert.deepEqual((await kolom(db)).filter((nama) => KOLOM_LAMA.includes(nama)).sort(), [...KOLOM_LAMA].sort());
  assert.deepEqual((await fieldDirectus(db)).sort(), [...KOLOM_LAMA].sort());

  await migrasi.up(db);
  assert.deepEqual((await kolom(db)).filter((nama) => KOLOM_LAMA.includes(nama)), []);
  assert.deepEqual(await fieldDirectus(db), []);
});
