import assert from "node:assert/strict";
import test from "node:test";
import registerKlinik from "../../src/endpoints/klinik/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatKota, buatTiket, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

async function versiTiket(db, id) {
  const result = await db.raw(
    `SELECT to_char(date_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS versi,
            status
       FROM konsultasi_tiket WHERE id = ?`,
    [id],
  );
  return (result.rows ?? result)[0];
}

test("PATCH tanpa versi ditolak 400 dan tiket tidak berubah (B24)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const staff = await buatUser(db, { appRole: "provinsi" });
  const tiket = await buatTiket(db, { namaUsaha: "Usaha Versi", namaKontak: "Wawan" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: {} });
  const sebelum = await versiTiket(db, tiket.id);

  const { res } = await call("PATCH", `/tiket/${tiket.id}`, {
    accountability: akun(staff.id),
    body: { status: "dijadwalkan" },
  });
  assert.equal(res.statusCode, 400, JSON.stringify(res.body));
  assert.equal(res.body.errors[0].extensions.code, "INVALID_PAYLOAD");

  const sesudah = await versiTiket(db, tiket.id);
  assert.equal(sesudah.status, "masuk");
  assert.equal(sesudah.versi, sebelum.versi);
  const audit = await db("konsultasi_tiket_audit").where({ tiket: tiket.id });
  assert.equal(audit.length, 0);
});

test("DTO tiket petugas membawa transisi dan statusLabel dari server (SQL nyata)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  await buatKota(db, { id: 3201 });
  await buatKota(db, { id: 3273 });
  const kabkota = await buatUser(db, { appRole: "kabkota", kotaScope: 3201 });
  const tiket = await buatTiket(db, { namaUsaha: "Usaha DTO", namaKontak: "Dodi", jadwalSlot: "09:00" });
  const usahaKota = await buatUsaha(db, { kotaId: 3201 });
  const usahaLain = await buatUsaha(db, { kotaId: 3273 });
  const tiketKota = await buatTiket(db, { usahaId: usahaKota.id, jadwalSlot: "10:00" });
  const tiketLain = await buatTiket(db, { usahaId: usahaLain.id, jadwalSlot: "11:00" });
  const { call } = mountEndpoint(registerKlinik, { database: db, env: {} });
  const daftar = async (user) => (await call("GET", "/tiket", { accountability: akun(user.id) })).res;

  const punyaProvinsi = (await daftar(provinsi)).body.data.find((item) => item.id === tiket.id);
  assert.deepEqual(punyaProvinsi.transisi, ["dijadwalkan", "batal"]);
  assert.equal(punyaProvinsi.statusLabel, "Tiket Masuk");
  assert.equal("kotaId" in punyaProvinsi, false);

  // Kolam tanpa penugasan: pendamping hanya boleh mengklaim dulu, jadi belum ada transisi.
  const punyaPendamping = (await daftar(pendamping)).body.data.find((item) => item.id === tiket.id);
  assert.deepEqual(punyaPendamping.transisi, []);

  // Kab/kota melihat tiket usaha di kotanya saja; usaha ketikan tangan bukan milik kota mana pun.
  const punyaKab = (await daftar(kabkota)).body.data;
  assert.deepEqual(punyaKab.map((item) => item.id), [tiketKota.id]);
  assert.deepEqual(punyaKab[0].transisi, ["dijadwalkan", "batal"]);
  assert.equal(punyaKab.some((item) => item.id === tiketLain.id), false);
});
