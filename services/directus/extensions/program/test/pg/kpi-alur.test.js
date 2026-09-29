import assert from "node:assert/strict";
import test from "node:test";
import registerKpi from "../../src/endpoints/kpi/index.js";
import { createKpi } from "../../src/endpoints/kpi/service.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { APPLICATION_ROLE_ID } = require("../../../../analytics-shared/cakupan.cjs");
import { buatKota, buatPeserta, buatUsaha, buatUser, jumatTerakhir, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";
import { mountEndpoint } from "../helpers.js";

const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });
const isi = (mingguKe, patch = {}) => ({
  mingguKe,
  realisasiOmzet: 150_000,
  jumlahTransaksi: 4,
  kendala: null,
  clientUuid: uuid(),
  bukti: [],
  dibuatPada: jumatTerakhir(),
  ...patch,
});
const kode = (hasil) => hasil.res.body?.errors?.[0]?.extensions?.code;

async function siapkan(db, { nama = "Usaha KPI", tanggalMulai } = {}) {
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama, kotaId: 7 });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const pendamping = await buatUser(db, { appRole: "pendamping" });
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const peserta = await buatPeserta(db, { usahaId: usaha.id, pendampingId: pendamping.id, tanggalMulai });
  return { usaha, owner, pendamping, provinsi, peserta };
}

test("kirim laporan: 201 lalu replay 200; minggu ganda 409", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { owner, peserta } = await siapkan(db);
  const { call } = mountEndpoint(registerKpi, { database: db });
  const kirim = (body) => call("POST", `/peserta/${peserta.id}/laporan`, { accountability: akun(owner.id), body });

  const body = isi(1);
  const baru = await kirim(body);
  assert.equal(baru.res.statusCode, 201, JSON.stringify(baru.res.body));
  assert.equal(baru.res.body.data.status, "menunggu");
  assert.equal(baru.res.body.data.target, 4);

  const ulang = await kirim(body);
  assert.equal(ulang.res.statusCode, 200);
  assert.equal(ulang.res.body.data.id, baru.res.body.data.id);

  const ganda = await kirim(isi(1));
  assert.equal(ganda.res.statusCode, 409);
  assert.equal(kode(ganda), "LAPORAN_SUDAH_ADA");
  assert.equal((await db("kpi_laporan")).length, 1);
});

test("minggu yang belum mulai atau melewati jumlah_minggu ditolak 400", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const akan = await siapkan(db, { nama: "Usaha Akan", tanggalMulai: "2099-01-05" });
  const { call } = mountEndpoint(registerKpi, { database: db });

  const belum = await call("POST", `/peserta/${akan.peserta.id}/laporan`, { accountability: akun(akan.owner.id), body: isi(1) });
  assert.equal(belum.res.statusCode, 400);
  assert.equal(kode(belum), "MINGGU_TIDAK_VALID");

  const lampau = await siapkan(db, { nama: "Usaha Lampau", tanggalMulai: "2026-01-05" });
  const lewat = await call("POST", `/peserta/${lampau.peserta.id}/laporan`, { accountability: akun(lampau.owner.id), body: isi(13) });
  assert.equal(lewat.res.statusCode, 400);
  assert.equal(kode(lewat), "MINGGU_TIDAK_VALID");
  assert.equal((await db("kpi_laporan")).length, 0);
});

test("use case memakai jam yang diinjeksi untuk minggu berjalan", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  // Program mulai Jumat 4 Sep; 16:00 UTC 3 Sep masih Kamis WIB, 17:30 UTC sudah Jumat WIB.
  const { owner, peserta } = await siapkan(db, { tanggalMulai: "2026-09-04" });
  const pemanggil = { id: owner.id, admin: false, peran: "umkm", usahaId: owner.usahaId, kotaId: null };
  const sebelum = createKpi({ db, clock: () => new Date("2026-09-03T16:00:00Z") });
  await assert.rejects(sebelum.kirimLaporan(pemanggil, peserta.id, isi(1, { dibuatPada: null })), { statusCode: 400, code: "MINGGU_TIDAK_VALID" });
  const sesudah = createKpi({ db, clock: () => new Date("2026-09-03T17:30:00Z") });
  const hasil = await sesudah.kirimLaporan(pemanggil, peserta.id, isi(1, { dibuatPada: null }));
  assert.equal(hasil.hasil, "dibuat");
});

test("clientUuid milik peserta lain menghasilkan 409 CLIENT_UUID_CONFLICT", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const A = await siapkan(db, { nama: "Usaha A" });
  const B = await siapkan(db, { nama: "Usaha B" });
  const { call } = mountEndpoint(registerKpi, { database: db });
  const clientUuid = uuid();

  const a = await call("POST", `/peserta/${A.peserta.id}/laporan`, { accountability: akun(A.owner.id), body: isi(1, { clientUuid }) });
  assert.equal(a.res.statusCode, 201);
  const b = await call("POST", `/peserta/${B.peserta.id}/laporan`, { accountability: akun(B.owner.id), body: isi(1, { clientUuid }) });
  assert.equal(b.res.statusCode, 409, JSON.stringify(b.res.body));
  assert.equal(kode(b), "CLIENT_UUID_CONFLICT");
  assert.equal((await db("kpi_laporan")).length, 1);
});

test("dua peserta berbeda mengirim clientUuid sama paralel: satu 201, satu 409, satu baris", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const A = await siapkan(db, { nama: "Usaha A" });
  const B = await siapkan(db, { nama: "Usaha B" });
  const { call } = mountEndpoint(registerKpi, { database: db });
  const clientUuid = uuid();
  const kirim = (P) => call("POST", `/peserta/${P.peserta.id}/laporan`, { accountability: akun(P.owner.id), body: isi(1, { clientUuid }) });

  const hasil = await Promise.all([kirim(A), kirim(B)]);
  const status = hasil.map((item) => item.res.statusCode).sort();
  assert.deepEqual(status, [201, 409], JSON.stringify(hasil.map((item) => item.res.body)));
  assert.equal((await db("kpi_laporan").where({ client_uuid: clientUuid })).length, 1);
});

test("review: setuju, sudah direview 409, tolak wajib catatan, lalu revisi di tempat", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { owner, pendamping, provinsi, peserta } = await siapkan(db);
  const lain = await buatUser(db, { appRole: "pendamping" });
  const { call } = mountEndpoint(registerKpi, { database: db });
  const kirim = (body) => call("POST", `/peserta/${peserta.id}/laporan`, { accountability: akun(owner.id), body });
  const review = (id, by, body) => call("POST", `/laporan/${id}/review`, { accountability: akun(by.id), body });

  const satu = (await kirim(isi(1))).res.body.data;
  const dua = (await kirim(isi(2))).res.body.data;

  const asing = await review(satu.id, lain, { keputusan: "disetujui" });
  assert.equal(asing.res.statusCode, 404, "pendamping lain tidak melihat peserta");
  const umkm = await review(satu.id, owner, { keputusan: "disetujui" });
  assert.equal(umkm.nextError?.statusCode, 403, "UMKM tidak boleh me-review");

  const setuju = await review(satu.id, pendamping, { keputusan: "disetujui" });
  assert.equal(setuju.res.statusCode, 200, JSON.stringify(setuju.res.body));
  assert.equal(setuju.res.body.data.status, "disetujui");
  const dua2 = await review(satu.id, provinsi, { keputusan: "ditolak", catatan: "x" });
  assert.equal(dua2.res.statusCode, 409);
  assert.equal(kode(dua2), "LAPORAN_SUDAH_DIREVIEW");

  const tanpaCatatan = await review(dua.id, provinsi, { keputusan: "ditolak" });
  assert.equal(kode(tanpaCatatan), "CATATAN_WAJIB");
  const tolak = await review(dua.id, provinsi, { keputusan: "ditolak", catatan: "Bukti kurang jelas" });
  assert.equal(tolak.res.statusCode, 200);
  assert.equal(tolak.res.body.data.catatanPendamping, "Bukti kurang jelas");

  const revisi = await kirim(isi(2, { realisasiOmzet: 200_000 }));
  assert.equal(revisi.res.statusCode, 200, JSON.stringify(revisi.res.body));
  assert.equal(revisi.res.body.data.id, dua.id);
  assert.equal(revisi.res.body.data.status, "menunggu");
  assert.equal(revisi.res.body.data.realisasiOmzet, 200_000);
  assert.equal((await db("kpi_laporan").where({ peserta: peserta.id })).length, 2);
});

test("pitching menolak 409 sebelum 4 minggu berturut-turut, lalu menyala", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { owner, pendamping, peserta } = await siapkan(db);
  const { call } = mountEndpoint(registerKpi, { database: db });
  const setPitching = (rekomendasi) =>
    call("PATCH", `/peserta/${peserta.id}/pitching`, { accountability: akun(pendamping.id), body: { rekomendasi } });

  for (let minggu = 1; minggu <= 4; minggu += 1) {
    const kirim = await call("POST", `/peserta/${peserta.id}/laporan`, { accountability: akun(owner.id), body: isi(minggu) });
    assert.equal(kirim.res.statusCode, 201);
    if (minggu === 4) break;
    await call("POST", `/laporan/${kirim.res.body.data.id}/review`, {
      accountability: akun(pendamping.id),
      body: { keputusan: "disetujui" },
    });
  }
  const belum = await setPitching(true);
  assert.equal(belum.res.statusCode, 409);
  assert.equal(kode(belum), "PITCHING_BELUM_MEMENUHI");

  const menunggu = await db("kpi_laporan").where({ peserta: peserta.id, minggu_ke: 4 }).first();
  await call("POST", `/laporan/${menunggu.id}/review`, { accountability: akun(pendamping.id), body: { keputusan: "disetujui" } });
  const nyala = await setPitching(true);
  assert.equal(nyala.res.statusCode, 200, JSON.stringify(nyala.res.body));
  assert.equal(nyala.res.body.data.rekomendasiPitching, true);

  const mati = await setPitching(false);
  assert.equal(mati.res.body.data.rekomendasiPitching, false);
});
