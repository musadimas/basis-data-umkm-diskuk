import assert from "node:assert/strict";
import test from "node:test";
import registerKpi from "../../src/endpoints/kpi/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatKota, buatPeserta, buatUsaha, buatUser, jumatTerakhir, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const laporan = (clientUuid) => ({
  mingguKe: 1,
  realisasiOmzet: 150_000,
  jumlahTransaksi: 4,
  kendala: null,
  clientUuid,
  bukti: [],
  dibuatPada: jumatTerakhir(),
});

async function siapkanPeserta(db, { namaUsaha = "Usaha Uji" } = {}) {
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: namaUsaha, kotaId: 7 });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const peserta = await buatPeserta(db, { usahaId: usaha.id });
  return { usaha, owner, peserta };
}

test("submit paralel dengan clientUuid sama menghasilkan satu 201 dan sisanya 200", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { owner, peserta } = await siapkanPeserta(db);
  const { call } = mountEndpoint(registerKpi, { database: db });
  const clientUuid = uuid();
  const kirim = () =>
    call("POST", `/peserta/${peserta.id}/laporan`, {
      accountability: akun(owner.id),
      body: laporan(clientUuid),
    });

  const hasil = await Promise.all(Array.from({ length: 5 }, () => kirim()));
  const kode = hasil.map((item) => item.res.statusCode).sort((x, y) => x - y);
  assert.deepEqual(kode, [200, 200, 200, 200, 201], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal((await db("kpi_laporan").where({ client_uuid: clientUuid })).length, 1);
});

test("replay clientUuid diperiksa setelah scope dan tetap idempoten", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const A = await siapkanPeserta(db, { namaUsaha: "Usaha A" });
  const B = await siapkanPeserta(db, { namaUsaha: "Usaha B" });
  const { call } = mountEndpoint(registerKpi, { database: db });
  const clientUuid = uuid();
  const kirim = (peserta, owner) =>
    call("POST", `/peserta/${peserta.id}/laporan`, {
      accountability: akun(owner.id),
      body: laporan(clientUuid),
    });

  const pertama = await kirim(A.peserta, A.owner);
  assert.equal(pertama.res.statusCode, 201, JSON.stringify(pertama.res.body));

  // Pemilik yang sama mengirim ulang: replay 200, tetap satu baris.
  const ulang = await kirim(A.peserta, A.owner);
  assert.equal(ulang.res.statusCode, 200, JSON.stringify(ulang.res.body));
  assert.equal((await db("kpi_laporan").where({ client_uuid: clientUuid })).length, 1);

  // UMKM lain me-replay clientUuid milik peserta A: scope diperiksa lebih dulu → 404.
  const asing = await kirim(A.peserta, B.owner);
  assert.equal(asing.res.statusCode, 404, JSON.stringify(asing.res.body));
  assert.equal(asing.res.body.errors[0].extensions.code, "PESERTA_NOT_FOUND");
});
