import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { buatOutbox } from "../../src/lib/outbox/index.js";
import { buatTiket } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const pesan = (tiket, kunci, tujuan = "6281200000001") => ({
  kunci,
  jenis: "tiket_dibuat",
  tujuan,
  template: "klinik_tiket_dibuat",
  pesan: { text: "halo", params: {} },
  consent: true,
  sumber: { tiket: tiket.id },
});

test("resi provider terlambat tidak mengubah pesan yang sudah batal/gagal", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const outbox = buatOutbox({ database: db });
  const tiket = await buatTiket(db, { consent: true });

  for (const [index, status] of ["batal", "gagal"].entries()) {
    const baris = await outbox.enqueue(db, pesan(tiket, `resi-terlambat:${index}`));
    const messageId = randomUUID();
    await db("notifikasi_outbox").where({ id: baris.id }).update({ status, provider_message_id: messageId });

    const hasil = await outbox.terapkanResi({ id: baris.id, providerMessageId: messageId, status: "delivered", receipt: { status: "delivered" } });
    assert.equal(hasil, null, `resi untuk ${status} tidak diterapkan`);
    const tetap = await db("notifikasi_outbox").where({ id: baris.id }).first("status");
    assert.equal(tetap.status, status);
  }
});

test("id dan messageId yang berbeda tidak mengubah satu pun pesan", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const outbox = buatOutbox({ database: db });
  const tiketA = await buatTiket(db, { consent: true, jadwalTanggal: "2026-12-02", jadwalSlot: "09:00" });
  const tiketB = await buatTiket(db, { consent: true, jadwalTanggal: "2026-12-02", jadwalSlot: "10:00" });
  const a = await outbox.enqueue(db, pesan(tiketA, "silang:a", "6281200000001"));
  const b = await outbox.enqueue(db, pesan(tiketB, "silang:b", "6281200000002"));
  const idA = randomUUID();
  const idB = randomUUID();
  await db("notifikasi_outbox").where({ id: a.id }).update({ status: "terkirim", provider_message_id: idA });
  await db("notifikasi_outbox").where({ id: b.id }).update({ status: "terkirim", provider_message_id: idB });

  const salah = await outbox.terapkanResi({ id: a.id, providerMessageId: idB, status: "delivered" });
  assert.equal(salah, null);
  const tetap = await db("notifikasi_outbox").whereIn("id", [a.id, b.id]).orderBy("id").select("status");
  assert.deepEqual(tetap.map((row) => row.status), ["terkirim", "terkirim"]);

  const benar = await outbox.terapkanResi({ id: a.id, providerMessageId: idA, status: "delivered" });
  assert.equal(benar.id, a.id);
  assert.equal(benar.status, "diterima");
});
