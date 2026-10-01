import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import register from "../../src/endpoints/executive/index.js";
import { buatKota, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const kode = (hasil) => hasil.res.body.errors[0].extensions.code;

/** Empat profil + satu kurator: satu baris per status presedensi (BUG-016..018). */
async function siapkan(t) {
  const { db } = await withDatabase(t);
  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const kurator = await buatUser(db, { appRole: "provinsi" });
  const usaha = {
    menunggu: await buatUsaha(db, { nama: "Keripik Menunggu", kotaId: 7, kotaNama: "KABUPATEN SUBANG" }),
    disetujui: await buatUsaha(db, { nama: "Batik Disetujui", kotaId: 7, kotaNama: "KABUPATEN SUBANG" }),
    belum: await buatUsaha(db, { nama: "Kopi Belum Setuju", kotaId: 7, kotaNama: "KABUPATEN SUBANG" }),
    dicabut: await buatUsaha(db, { nama: "Tas Dicabut", kotaId: 7, kotaNama: "KABUPATEN SUBANG" }),
  };
  const taruh = (usahaId, jenama, kolom, dateUpdated) => db("investor_profil").insert({
    usaha: usahaId, jenama, skema: ["kur"], kebutuhan_modal: 1_000_000, ...kolom, date_updated: dateUpdated,
  });
  await taruh(usaha.menunggu.id, "Keripik Menunggu", {
    disetujui_berbagi_oleh: kurator.id, disetujui_berbagi_pada: "2026-09-20T02:00:00Z",
  }, "2026-09-20T02:00:00Z");
  await taruh(usaha.disetujui.id, "Batik Disetujui", {
    disetujui_berbagi_oleh: kurator.id, disetujui_berbagi_pada: "2026-09-21T02:00:00Z",
    disetujui_kurator_oleh: kurator.id, disetujui_kurator_pada: "2026-09-22T02:00:00Z",
  }, "2026-09-22T02:00:00Z");
  await taruh(usaha.belum.id, "Kopi Belum Setuju", {}, "2026-09-23T02:00:00Z");
  await taruh(usaha.dicabut.id, "Tas Dicabut", {
    disetujui_berbagi_oleh: kurator.id, disetujui_berbagi_pada: "2026-09-24T02:00:00Z",
    kurator_dicabut_oleh: kurator.id, kurator_dicabut_pada: "2026-09-25T02:00:00Z",
  }, "2026-09-25T02:00:00Z");
  const { call } = mountEndpoint(register, { database: db });
  return { db, call, kurator, usaha };
}

test("kurasi investor: daftar berstatus server dengan counts tanpa filter dan satu query per tab", { skip: pgSkipReason() }, async (t) => {
  const { call, kurator } = await siapkan(t);
  const daftar = await call("GET", "/investor/kurasi", { accountability: akun(kurator.id) });
  assert.equal(daftar.res.statusCode, 200, JSON.stringify(daftar.res.body));
  assert.deepEqual(daftar.res.body.data.meta.counts, { menunggu: 1, disetujui: 1, belum_disetujui: 1, dicabut: 1 });
  assert.deepEqual(daftar.res.body.data.items.map((item) => item.status), ["dicabut", "belum_disetujui", "disetujui", "menunggu"]);

  const hanya = await call("GET", "/investor/kurasi", { accountability: akun(kurator.id), query: { status: "dicabut" } });
  assert.equal(hanya.res.statusCode, 200);
  assert.equal(hanya.res.body.data.items.length, 1);
  assert.equal(hanya.res.body.data.items[0].jenama, "Tas Dicabut");
  assert.equal(hanya.res.body.data.items[0].status, "dicabut");
  assert.deepEqual(hanya.res.body.data.meta.counts, { menunggu: 1, disetujui: 1, belum_disetujui: 1, dicabut: 1 });
});

test("kurasi investor: setujui ulang profil disetujui ditolak 409 dan tidak mengubah waktu persetujuan", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator, usaha } = await siapkan(t);
  const sebelum = await db("investor_profil").where({ usaha: usaha.disetujui.id }).first();
  const hasil = await call("POST", `/investor/profil/${usaha.disetujui.id}/kurasi`, {
    accountability: akun(kurator.id), body: { setuju: true },
  });
  assert.equal(hasil.res.statusCode, 409, JSON.stringify(hasil.res.body));
  assert.equal(kode(hasil), "STATUS_BERUBAH");
  const sesudah = await db("investor_profil").where({ usaha: usaha.disetujui.id }).first();
  assert.deepEqual(sesudah.disetujui_kurator_pada, sebelum.disetujui_kurator_pada);
});

test("kurasi investor: cabut profil menunggu ditolak 409", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator, usaha } = await siapkan(t);
  const hasil = await call("POST", `/investor/profil/${usaha.menunggu.id}/kurasi`, {
    accountability: akun(kurator.id), body: { setuju: false },
  });
  assert.equal(hasil.res.statusCode, 409, JSON.stringify(hasil.res.body));
  assert.equal(kode(hasil), "STATUS_BERUBAH");
  const baris = await db("investor_profil").where({ usaha: usaha.menunggu.id }).first();
  assert.equal(baris.kurator_dicabut_pada, null);
  assert.equal(baris.disetujui_kurator_pada, null);
});

test("kurasi investor: cabut profil disetujui menyimpan aktor dan memindahkannya ke tab dicabut", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator, usaha } = await siapkan(t);
  const hasil = await call("POST", `/investor/profil/${usaha.disetujui.id}/kurasi`, {
    accountability: akun(kurator.id), body: { setuju: false },
  });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  assert.deepEqual(hasil.res.body.data, { disetujui: false });
  const baris = await db("investor_profil").where({ usaha: usaha.disetujui.id }).first();
  assert.equal(baris.kurator_dicabut_oleh, kurator.id);
  assert.equal(baris.disetujui_kurator_pada, null);
  assert.notEqual(baris.kurator_dicabut_pada, null);

  const daftar = await call("GET", "/investor/kurasi", { accountability: akun(kurator.id), query: { status: "dicabut" } });
  const item = daftar.res.body.data.items.find((row) => row.id === usaha.disetujui.id);
  assert.equal(item.status, "dicabut");
  assert.deepEqual(daftar.res.body.data.meta.counts, { menunggu: 1, disetujui: 0, belum_disetujui: 1, dicabut: 2 });
});

test("kurasi investor: setujui profil yang dicabut kurator mengosongkan jejak cabut", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator, usaha } = await siapkan(t);
  const hasil = await call("POST", `/investor/profil/${usaha.dicabut.id}/kurasi`, {
    accountability: akun(kurator.id), body: { setuju: true },
  });
  assert.equal(hasil.res.statusCode, 200, JSON.stringify(hasil.res.body));
  const baris = await db("investor_profil").where({ usaha: usaha.dicabut.id }).first();
  assert.equal(baris.kurator_dicabut_pada, null);
  assert.equal(baris.kurator_dicabut_oleh, null);
  assert.notEqual(baris.disetujui_kurator_pada, null);

  const daftar = await call("GET", "/investor/kurasi", { accountability: akun(kurator.id), query: { status: "disetujui" } });
  assert.equal(daftar.res.body.data.items.some((row) => row.id === usaha.dicabut.id), true);
});

test("kurasi investor: profil tanpa persetujuan usaha ditolak 404", { skip: pgSkipReason() }, async (t) => {
  const { call, kurator, usaha } = await siapkan(t);
  const hasil = await call("POST", `/investor/profil/${usaha.belum.id}/kurasi`, {
    accountability: akun(kurator.id), body: { setuju: true },
  });
  assert.equal(hasil.res.statusCode, 404, JSON.stringify(hasil.res.body));
  assert.equal(kode(hasil), "NOT_FOUND");
});

test("kurasi investor: dua keputusan paralel menghasilkan tepat satu 200 (R2)", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator } = await siapkan(t);
  const baru = await buatUsaha(db, { nama: "Bambu Menunggu", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });
  await db("investor_profil").insert({
    usaha: baru.id, jenama: "Bambu Menunggu", skema: ["kur"], kebutuhan_modal: 2_000_000,
    disetujui_berbagi_oleh: kurator.id, disetujui_berbagi_pada: "2026-09-26T02:00:00Z",
    date_updated: "2026-09-26T02:00:00Z",
  });
  const klik = () => call("POST", `/investor/profil/${baru.id}/kurasi`, { accountability: akun(kurator.id), body: { setuju: true } });

  const hasil = await Promise.all([klik(), klik()]);
  assert.deepEqual(hasil.map((item) => item.res.statusCode).sort(), [200, 409], JSON.stringify(hasil.map((item) => item.res.body)));
  const baris = await db("investor_profil").where({ usaha: baru.id }).first();
  assert.equal(baris.disetujui_kurator_oleh, kurator.id);
  assert.notEqual(baris.disetujui_kurator_pada, null);
});

test("kurasi investor: UMKM yang mengedit profil mengembalikan status ke menunggu dan menghapus jejak cabut", { skip: pgSkipReason() }, async (t) => {
  const { db, call, kurator, usaha } = await siapkan(t);
  const pemilik = await buatUser(db, { appRole: "umkm", usahaId: usaha.dicabut.id });
  const simpan = await call("POST", "/investor/profil", {
    accountability: akun(pemilik.id),
    body: { jenama: "Tas Dicabut Baru", skema: ["kur"], kebutuhanModal: 1_500_000, setuju: true },
  });
  assert.equal(simpan.res.statusCode, 200, JSON.stringify(simpan.res.body));
  const baris = await db("investor_profil").where({ usaha: usaha.dicabut.id }).first();
  assert.equal(baris.kurator_dicabut_pada, null);
  assert.equal(baris.kurator_dicabut_oleh, null);
  assert.equal(baris.disetujui_kurator_pada, null);

  const daftar = await call("GET", "/investor/kurasi", { accountability: akun(kurator.id) });
  const item = daftar.res.body.data.items.find((row) => row.id === usaha.dicabut.id);
  assert.equal(item.status, "menunggu");
});
