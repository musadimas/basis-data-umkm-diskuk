import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { LAMPIRAN_FOLDER_ID } from "../../src/endpoints/klinik/service.js";
import { buatFile, buatKota, buatTiket, buatUsaha, buatUser, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";
import { akun, fakeDirectus } from "./klinik-support.js";

const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;

test("prefill hanya untuk akun yang login dan tidak membaca NIK; akun tak terbaca ditolak 401", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Leathercraft", kotaId: 7, kotaNama: "Kota Bandung" });
  await db("usaha").where({ id: usaha.id }).update({ nomor_whatsapp: "0812 3456 7890", skala: "micro" });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id, email: "wawan@example.test" });
  await db("directus_users").where({ id: owner.id }).update({ first_name: "Wawan", last_name: "Setiawan" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: {} });

  const anonim = await call("GET", "/prefill", { accountability: null });
  assert.equal(anonim.nextError?.statusCode ?? anonim.res.statusCode, 401);

  const jawab = await call("GET", "/prefill", { accountability: akun(owner.id) });
  assert.equal(jawab.res.statusCode, 200, JSON.stringify(jawab.res.body));
  assert.deepEqual(jawab.res.body.data.usaha, { nama: "Leathercraft", skala: "micro", kota: "Kota Bandung", kbli: null, sumber: "sidt" });
  assert.deepEqual(jawab.res.body.data.kontak, { nama: "Wawan Setiawan", email: "wawan@example.test", whatsapp: "6281234567890" });
  assert.doesNotMatch(JSON.stringify(jawab.res.body), /nik/i);

  const petugas = await buatUser(db, { appRole: "provinsi" });
  const tanpaUsaha = await call("GET", "/prefill", { accountability: akun(petugas.id) });
  assert.equal(tanpaUsaha.res.body.data.usaha, null);

  const hantu = await call("GET", "/tiket", { accountability: akun(uuid()) });
  assert.equal(hantu.nextError?.statusCode ?? hantu.res.statusCode, 401);
});

test("lampiran hanya terbuka untuk pemohon atau petugas yang cakupannya meliputi tiketnya", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  await buatKota(db, { id: 9 });
  const usahaPemohon = await buatUsaha(db, { nama: "Usaha Pemohon", kotaId: 9 });
  const pemohon = await buatUser(db, { appRole: "umkm", usahaId: usahaPemohon.id });
  const usahaLain = await buatUsaha(db, { nama: "Usaha Lain", kotaId: 7 });
  const orangLain = await buatUser(db, { appRole: "umkm", usahaId: usahaLain.id });
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  const kabkotaSendiri = await buatUser(db, { appRole: "kabkota", kotaScope: 9 });
  const kabkotaLain = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });

  const tiket = await buatTiket(db, { usahaId: usahaPemohon.id, pemohonId: pemohon.id });
  const berkas = await buatFile(db, { folder: LAMPIRAN_FOLDER_ID, type: "application/pdf", filename: "nib.pdf" });
  await db("konsultasi_tiket_lampiran").insert({ konsultasi_tiket_id: tiket.id, directus_files_id: berkas.id, sort: 1 });
  const bukanLampiran = await buatFile(db, { type: "application/pdf", filename: "lain.pdf" });

  const fakes = fakeDirectus(db);
  fakes.files.set(berkas.id, Buffer.from("%PDF-1.7 isi"));
  const { call } = mountEndpoint(registerKlinik, {
    database: db,
    env: {},
    context: { services: fakes.services, getSchema: fakes.getSchema },
  });
  const buka = (user, id = berkas.id) => call("GET", `/lampiran/${id}`, { accountability: akun(user.id) });

  const asing = await buka(orangLain);
  assert.equal(asing.res.statusCode, 404);
  assert.equal(kode(asing), "LAMPIRAN_TIDAK_DITEMUKAN");

  const bukanUuid = await call("GET", "/lampiran/bukan-uuid", { accountability: akun(pemohon.id) });
  assert.equal(bukanUuid.res.statusCode, 400);

  const punyaSendiri = await buka(pemohon);
  assert.equal(punyaSendiri.res.statusCode, 200);
  assert.equal(punyaSendiri.res.headers["Content-Type"], "application/pdf");
  assert.equal(punyaSendiri.res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(punyaSendiri.res.headers["Cache-Control"], "private, no-store");
  assert.match(punyaSendiri.res.headers["Content-Disposition"], /nib\.pdf/);

  // Tiket tanpa penugasan ada di kanban setiap pendamping (kolam triase).
  assert.equal((await buka(pendamping)).res.statusCode, 200);
  assert.equal((await buka(kabkotaSendiri)).res.statusCode, 200);
  assert.equal((await buka(kabkotaLain)).res.statusCode, 404);

  // Petugas pun tidak mendapat berkas yang bukan lampiran: endpoint ini bukan proxy directus_files.
  const proxy = await buka(pendamping, bukanLampiran.id);
  assert.equal(proxy.res.statusCode, 404);
  assert.equal(kode(proxy), "LAMPIRAN_TIDAK_DITEMUKAN");

  // Setelah ditugaskan ke pendamping lain, pendamping ini kehilangan akses.
  const lain = await buatUser(db, { appRole: "pendamping" });
  await db("konsultasi_tiket").where({ id: tiket.id }).update({ pendamping: lain.id });
  assert.equal((await buka(pendamping)).res.statusCode, 404);
  assert.equal((await buka(lain)).res.statusCode, 200);
});

test("resi dengan status yang tidak dikenal tidak menyentuh outbox", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const tiket = await buatTiket(db, { consent: true });
  const [pesan] = (
    await db.raw(
      `INSERT INTO notifikasi_outbox (tiket, jenis, tujuan, consent, template, payload, idempotency_key, status, provider_message_id)
       VALUES (?, 'tiket_dibuat', '6281200000001', TRUE, 'klinik_tiket_dibuat', '{}'::jsonb, ?, 'terkirim', 'wamid-x')
       RETURNING id`,
      [tiket.id, `tiket_dibuat:${tiket.id}`],
    )
  ).rows;
  const { call } = mountEndpoint(registerKlinik, { database: db, env: { OPERASIONAL_INTERNAL_SECRET: "rahasia-resi" } });

  const hasil = await call("POST", "/notifikasi/receipt", {
    headers: { "x-diskuk-secret": "rahasia-resi" },
    body: { id: pesan.id, status: "unknown-status" },
  });
  assert.equal(hasil.res.statusCode, 200);
  assert.deepEqual(hasil.res.body.data, { diterapkan: false, status: null });
  assert.equal((await db("notifikasi_outbox").where({ id: pesan.id }).first("status")).status, "terkirim");
});
