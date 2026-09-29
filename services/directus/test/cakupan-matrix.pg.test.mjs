import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { buatKota, buatPeserta, buatTiket, buatUsaha, buatUser } from "../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../test-support/pg-harness.mjs";

const require = createRequire(import.meta.url);
const cakupan = require("../analytics-shared/cakupan.cjs");
const { muatPemanggil, pastikanUsaha, predikat } = cakupan;
const { APPLICATION_ROLE_ID } = require("../analytics-shared/contracts.cjs");

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

async function siapkanWilayah(db) {
  await buatKota(db, { id: 7, nama: "KABUPATEN UJI TUJUH" });
  await buatKota(db, { id: 9, nama: "KABUPATEN UJI SEMBILAN" });
  const usahaTujuh = await buatUsaha(db, { kotaId: 7, kotaNama: "KABUPATEN UJI TUJUH" });
  const usahaSembilan = await buatUsaha(db, { kotaId: 9, kotaNama: "KABUPATEN UJI SEMBILAN" });
  const usahaNull = await buatUsaha(db, { kotaId: null });
  return { usahaTujuh, usahaSembilan, usahaNull };
}

test("matriks muatPemanggil di Postgres ter-migrasi", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7 });
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const kabkota = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });
  const tanpaKota = await buatUser(db, { appRole: "kabkota", kotaScope: null });

  const dimuat = await muatPemanggil(db, akun(provinsi.id));
  assert.equal(dimuat.peran, "provinsi");
  assert.equal(dimuat.admin, false);

  const dimuatKota = await muatPemanggil(db, akun(kabkota.id));
  assert.equal(dimuatKota.peran, "kabkota");
  assert.equal(Number(dimuatKota.kotaId), 7);

  const dimuatTanpa = await muatPemanggil(db, akun(tanpaKota.id));
  assert.equal(dimuatTanpa.kotaId, null);

  const admin = await muatPemanggil(db, { user: "00000000-0000-4000-8000-ffffffffffff", admin: true });
  assert.equal(admin.peran, "provinsi");

  await assert.rejects(muatPemanggil(db, akun("11111111-1111-4111-8111-111111111111")), { status: 401 });

  const nullRole = await buatUser(db, { appRole: null });
  await assert.rejects(muatPemanggil(db, akun(nullRole.id)), { status: 403 });
});

test("matriks pastikanUsaha: kota null tidak pernah cocok", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { usahaTujuh, usahaSembilan, usahaNull } = await siapkanWilayah(db);
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const kabkota = await buatUser(db, { appRole: "kabkota", kotaScope: 7 });

  const pemanggilProvinsi = await muatPemanggil(db, akun(provinsi.id));
  const pemanggilKota = await muatPemanggil(db, akun(kabkota.id));

  await pastikanUsaha(db, pemanggilProvinsi, usahaTujuh.id);
  await pastikanUsaha(db, pemanggilProvinsi, usahaNull.id);
  await pastikanUsaha(db, pemanggilKota, usahaTujuh.id);
  await assert.rejects(pastikanUsaha(db, pemanggilKota, usahaSembilan.id), { status: 404 });
  await assert.rejects(pastikanUsaha(db, pemanggilKota, usahaNull.id), { status: 404 });
  await assert.rejects(pastikanUsaha(db, pemanggilKota, "55555555-5555-4555-8555-555555555555"), { status: 404 });
});

test("predikat SQL tereksekusi dan memfilter di database", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { usahaTujuh, usahaSembilan } = await siapkanWilayah(db);
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  const umkm = await buatUser(db, { appRole: "umkm", usahaId: usahaTujuh.id });
  const pesertaTujuh = await buatPeserta(db, { usahaId: usahaTujuh.id, pendampingId: pendamping.id });
  await buatPeserta(db, { usahaId: usahaSembilan.id });
  const tiket = await buatTiket(db, { usahaId: usahaTujuh.id, pendampingId: pendamping.id });

  const pemanggilPendamping = await muatPemanggil(db, akun(pendamping.id));
  const { sql, bindings } = predikat(pemanggilPendamping, "peserta", "p");
  const baris = await db.raw(`SELECT p.id FROM program_peserta p WHERE ${sql}`, bindings);
  assert.deepEqual(
    (baris.rows ?? baris).map((row) => String(row.id)).sort(),
    [String(pesertaTujuh.id)].sort(),
  );

  const pemanggilUmkm = await muatPemanggil(db, akun(umkm.id));
  const predikatTiket = predikat({ ...pemanggilUmkm, peran: "kabkota", kotaId: 7 }, "tiket", "t");
  const tiketBaris = await db.raw(`SELECT t.id FROM konsultasi_tiket t WHERE ${predikatTiket.sql}`, predikatTiket.bindings);
  assert.ok((tiketBaris.rows ?? tiketBaris).some((row) => String(row.id) === String(tiket.id)));

  const predikatModel = predikat({ ...pemanggilUmkm, peran: "kabkota", kotaId: 7 }, "readModel", "a");
  const modelBaris = await db.raw(
    `SELECT a.id FROM usaha_tabular a WHERE ${predikatModel.sql} AND a.id = ?`,
    [...predikatModel.bindings, usahaTujuh.id],
  );
  assert.equal((modelBaris.rows ?? modelBaris).length, 1);
});
