import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { buatTiket, buatUser, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun } from "./klinik-support.js";

const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;
const hitung = async (db, tabel, where = {}) => Number((await db(tabel).where(where).count("* as n").first()).n);

async function versiTiket(db, id) {
  const result = await db.raw(
    `SELECT to_char(date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi FROM konsultasi_tiket WHERE id = ?`,
    [id],
  );
  return (result.rows ?? result)[0].versi;
}

const pasang = (db) => mountEndpoint(registerKlinik, { database: db, env: {} }).call;

test("PATCH pendamping lain ditolak 403 tanpa menyentuh baris; kolam hanya boleh diklaim", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  const lain = await buatUser(db, { appRole: "pendamping" });
  const milikLain = await buatTiket(db, { pendampingId: lain.id, jadwalSlot: "09:00" });
  const kolam = await buatTiket(db, { jadwalSlot: "10:30" });

  const ditolak = await call("PATCH", `/tiket/${milikLain.id}`, {
    accountability: akun(pendamping.id),
    body: { status: "dijadwalkan", versi: await versiTiket(db, milikLain.id) },
  });
  // Di luar kanban pendamping ini: tiket milik pendamping lain tidak tampil, tetapi PATCH sampai ke aturan penugasan.
  assert.equal(ditolak.res.statusCode, 403, JSON.stringify(ditolak.res.body));
  assert.equal(kode(ditolak), "BUKAN_PENUGASAN_ANDA");
  assert.equal((await db("konsultasi_tiket").where({ id: milikLain.id }).first()).status, "masuk");
  assert.equal(await hitung(db, "konsultasi_tiket_audit"), 0);

  const langsungJadwal = await call("PATCH", `/tiket/${kolam.id}`, {
    accountability: akun(pendamping.id),
    body: { status: "dijadwalkan", versi: await versiTiket(db, kolam.id) },
  });
  assert.equal(kode(langsungJadwal), "BUKAN_PENUGASAN_ANDA", "kolam: penulisan pertama harus klaim");

  const klaim = await call("PATCH", `/tiket/${kolam.id}`, {
    accountability: akun(pendamping.id),
    body: { pendamping: pendamping.id, versi: await versiTiket(db, kolam.id) },
  });
  assert.equal(klaim.res.statusCode, 200, JSON.stringify(klaim.res.body));
  assert.equal(klaim.res.body.data.pendamping, pendamping.id);
  const audit = await db("konsultasi_tiket_audit").where({ tiket: kolam.id });
  assert.deepEqual(audit.map((baris) => baris.aksi), ["penugasan"]);
});

test("versi basi dan lompatan status ditolak 409 sebelum ada tulisan", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const staf = await buatUser(db, { appRole: "provinsi" });
  const tiket = await buatTiket(db);
  const versi = await versiTiket(db, tiket.id);
  const patch = (body) => call("PATCH", `/tiket/${tiket.id}`, { accountability: akun(staf.id), body });

  const basi = await patch({ status: "dijadwalkan", versi: "2026-09-27T10:00:00.000000Z" });
  assert.equal(basi.res.statusCode, 409);
  assert.equal(kode(basi), "TIKET_BERUBAH");
  const lompat = await patch({ status: "selesai", versi });
  assert.equal(lompat.res.statusCode, 409);
  assert.equal(kode(lompat), "TRANSISI_TIDAK_VALID");
  const tidakAda = await call("PATCH", `/tiket/${uuid()}`, { accountability: akun(staf.id), body: { status: "dijadwalkan", versi } });
  assert.equal(tidakAda.res.statusCode, 404);
  assert.equal(kode(tidakAda), "TIKET_TIDAK_DITEMUKAN");

  assert.equal((await db("konsultasi_tiket").where({ id: tiket.id }).first()).status, "masuk");
  assert.equal(await versiTiket(db, tiket.id), versi);
  assert.equal(await hitung(db, "konsultasi_tiket_audit"), 0);
});

test("transisi yang diterima menulis baris, audit per jenis perubahan, dan satu pesan outbox", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const call = pasang(db);
  const staf = await buatUser(db, { appRole: "provinsi" });
  await db("directus_users").where({ id: staf.id }).update({ first_name: "Analis", last_name: "Provinsi" });
  const tiket = await buatTiket(db, { consent: true });
  const patch = async (body) => call("PATCH", `/tiket/${tiket.id}`, { accountability: akun(staf.id), body: { versi: await versiTiket(db, tiket.id), ...body } });

  const hasil = await patch({ status: "dijadwalkan", catatan: "Dijadwalkan dengan pendamping legalitas" });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.equal(hasil.res.body.data.status, "dijadwalkan");
  assert.equal(hasil.res.body.data.catatan, "Dijadwalkan dengan pendamping legalitas");

  const audit = await db("konsultasi_tiket_audit").where({ tiket: tiket.id }).orderBy("aksi");
  assert.deepEqual(audit.map((baris) => baris.aksi), ["catatan", "transisi"]);
  const transisi = audit.find((baris) => baris.aksi === "transisi");
  assert.equal(transisi.status_dari, "masuk");
  assert.equal(transisi.status_ke, "dijadwalkan");
  assert.equal(transisi.aktor, staf.id);
  assert.equal(transisi.aktor_nama, "Analis Provinsi");
  assert.equal((await db("notifikasi_outbox").where({ tiket: tiket.id })).length, 1);

  // Mengirim status yang sama bukan transisi: hanya catatan yang tercatat, tidak ada pesan kedua.
  const sama = await patch({ status: "dijadwalkan", catatan: "Sudah dikonfirmasi lewat telepon" });
  assert.equal(sama.res.statusCode, 200, JSON.stringify(sama.res.body));
  const semuaAudit = await db("konsultasi_tiket_audit").where({ tiket: tiket.id });
  assert.equal(semuaAudit.filter((baris) => baris.aksi === "transisi").length, 1);
  assert.equal(semuaAudit.filter((baris) => baris.aksi === "catatan").length, 2);
  assert.equal(await hitung(db, "notifikasi_outbox", { tiket: tiket.id }), 1);
});

test("rollback nyata: audit yang gagal membatalkan UPDATE dan pesan outbox (bug 5)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { call, logs } = mountEndpoint(registerKlinik, { database: db, env: {} });
  const staf = await buatUser(db, { appRole: "provinsi" });
  const tiket = await buatTiket(db, { consent: true });
  const versi = await versiTiket(db, tiket.id);
  await db.raw(`
    CREATE FUNCTION uji_tolak_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit sengaja gagal'; END $$;
    CREATE TRIGGER uji_tolak_audit BEFORE INSERT ON konsultasi_tiket_audit
      FOR EACH ROW EXECUTE FUNCTION uji_tolak_audit();
  `);

  const hasil = await call("PATCH", `/tiket/${tiket.id}`, {
    accountability: akun(staf.id),
    body: { status: "dijadwalkan", catatan: "tidak boleh tersimpan", versi },
  });
  assert.equal(hasil.res.statusCode, 500);
  assert.equal(kode(hasil), "INTERNAL_SERVER_ERROR");
  assert.equal(logs.length, 1, "kegagalan dicatat sekali di log");

  const sesudah = await db("konsultasi_tiket").where({ id: tiket.id }).first();
  assert.equal(sesudah.status, "masuk");
  assert.equal(sesudah.catatan, null);
  assert.equal(await versiTiket(db, tiket.id), versi, "versi tidak bergerak");
  assert.equal(await hitung(db, "notifikasi_outbox", { tiket: tiket.id }), 0);
});
