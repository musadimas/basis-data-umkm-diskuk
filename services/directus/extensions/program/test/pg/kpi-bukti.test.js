import assert from "node:assert/strict";
import test from "node:test";
import registerKpi from "../../src/endpoints/kpi/index.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatFile, buatKota, buatPeserta, buatUsaha, buatUser, jumatTerakhir, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const laporan = (clientUuid, bukti) => ({
  mingguKe: 1,
  realisasiOmzet: 150_000,
  jumlahTransaksi: 4,
  kendala: null,
  clientUuid,
  bukti,
  dibuatPada: jumatTerakhir(),
});

async function siapkan(db) {
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Usaha Bukti", kotaId: 7 });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const lain = await buatUser(db, { appRole: "provinsi" });
  const peserta = await buatPeserta(db, { usahaId: usaha.id });
  return { usaha, owner, lain, peserta };
}

test("bukti KPI harus gambar milik pemanggil sendiri (B32)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { owner, lain, peserta } = await siapkan(db);
  const { call } = mountEndpoint(registerKpi, { database: db });
  const kirim = (body) =>
    call("POST", `/peserta/${peserta.id}/laporan`, { accountability: akun(owner.id), body });

  const fileOrangLain = await buatFile(db, { uploadedBy: lain.id, type: "image/png" });
  const filePdf = await buatFile(db, { uploadedBy: owner.id, type: "application/pdf" });
  const fileHilang = uuid();
  const fileSah = await buatFile(db, { uploadedBy: owner.id, type: "image/jpeg" });

  for (const [nama, fileId] of [["milik akun lain", fileOrangLain.id], ["bukan gambar", filePdf.id], ["tidak ada", fileHilang]]) {
    const { res } = await kirim(laporan(uuid(), [fileId]));
    assert.equal(res.statusCode, 400, `${nama}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.errors[0].extensions.code, "BUKTI_TIDAK_VALID", nama);
  }
  assert.equal(await db("kpi_laporan").count("* as jumlah").first().then((row) => Number(row.jumlah)), 0);

  const clientUuid = uuid();
  const sah = await kirim(laporan(clientUuid, [fileSah.id]));
  assert.equal(sah.res.statusCode, 201, JSON.stringify(sah.res.body));
  const bukti = await db("kpi_laporan_bukti").where({ directus_files_id: fileSah.id });
  assert.equal(bukti.length, 1);
});
