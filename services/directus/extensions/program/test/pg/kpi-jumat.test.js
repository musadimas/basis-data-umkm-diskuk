import assert from "node:assert/strict";
import test from "node:test";
import { createKpi } from "../../src/endpoints/kpi/service.js";
import { buatKota, buatPeserta, buatUsaha, buatUser, uuid } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

// M5-03: laporan baru hanya pada Jumat WIB; draf offline Jumat boleh tersinkron sesudahnya.
// Kalender Oktober 2026: Kamis 1, Jumat 2, Sabtu 3, Selasa 6, Jumat 9.
const WIB = (lokal) => new Date(`${lokal}+07:00`);
const isi = (mingguKe, patch = {}) => ({ mingguKe, realisasiOmzet: 150_000, jumlahTransaksi: 4, kendala: null, clientUuid: uuid(), bukti: [], ...patch });

async function siapkan(db) {
  await buatKota(db, { id: 7 });
  const usaha = await buatUsaha(db, { nama: "Usaha Jumat", kotaId: 7 });
  const owner = await buatUser(db, { appRole: "umkm", usahaId: usaha.id });
  const provinsi = await buatUser(db, { appRole: "provinsi" });
  const peserta = await buatPeserta(db, { usahaId: usaha.id, tanggalMulai: "2026-09-04" });
  const pemanggil = { id: owner.id, admin: false, peran: "umkm", usahaId: usaha.id, kotaId: null };
  const prov = { id: provinsi.id, admin: false, peran: "provinsi", usahaId: null, kotaId: null };
  return { peserta, pemanggil, prov };
}
const pada = (db, lokal) => createKpi({ db, clock: () => WIB(lokal) });

test("kirim langsung: Kamis ditolak 409, Jumat diterima; batas tengah malam WIB", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { peserta, pemanggil } = await siapkan(db);

  await assert.rejects(pada(db, "2026-10-01T23:59:00").kirimLaporan(pemanggil, peserta.id, isi(4)), { statusCode: 409, code: "BUKAN_HARI_LAPOR" });
  await assert.rejects(pada(db, "2026-10-03T00:00:00").kirimLaporan(pemanggil, peserta.id, isi(4)), { statusCode: 409, code: "BUKAN_HARI_LAPOR" });
  assert.equal((await db("kpi_laporan")).length, 0);

  const jumat = await pada(db, "2026-10-02T00:00:00").kirimLaporan(pemanggil, peserta.id, isi(4));
  assert.equal(jumat.hasil, "dibuat");
  assert.equal(jumat.laporan.dibuatPadaKlien, null, "kirim langsung tidak membawa jam perangkat");
  const akhir = await pada(db, "2026-10-02T23:59:59").kirimLaporan(pemanggil, peserta.id, isi(3));
  assert.equal(akhir.hasil, "dibuat");
});

test("draf offline Jumat tersinkron Sabtu: sah sekali, provenance tersimpan, replay Selasa 200", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { peserta, pemanggil } = await siapkan(db);
  const body = isi(5, { dibuatPada: "2026-10-02T15:00:00+07:00" });

  const sabtu = await pada(db, "2026-10-03T09:00:00").kirimLaporan(pemanggil, peserta.id, body);
  assert.equal(sabtu.hasil, "dibuat");
  const [baris] = await db("kpi_laporan").where({ client_uuid: body.clientUuid });
  assert.equal(new Date(baris.dibuat_pada_klien).toISOString(), "2026-10-02T08:00:00.000Z");
  assert.equal(new Date(sabtu.laporan.dibuatPadaKlien).toISOString(), "2026-10-02T08:00:00.000Z");

  const selasa = await pada(db, "2026-10-06T10:00:00").kirimLaporan(pemanggil, peserta.id, body);
  assert.equal(selasa.hasil, "diulang");
  assert.equal(selasa.laporan.id, sabtu.laporan.id);
  assert.equal((await db("kpi_laporan")).length, 1);
});

test("jam perangkat ditolak: bukan Jumat, masa depan, terlalu lama, atau bukan waktu", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { peserta, pemanggil } = await siapkan(db);
  const jumat = pada(db, "2026-10-09T10:00:00");

  // Draf Kamis yang baru tersinkron Jumat tetap bukan laporan Jumat.
  await assert.rejects(jumat.kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: "2026-10-08T20:00:00+07:00" })), { statusCode: 409, code: "BUKAN_HARI_LAPOR" });
  // Jam perangkat lebih dari 5 menit di depan server.
  await assert.rejects(jumat.kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: "2026-10-09T10:06:00+07:00" })), { statusCode: 400, code: "DIBUAT_PADA_TIDAK_VALID" });
  // Jumat lebih dari 7 hari lalu: tidak bisa dipakai untuk mengirim laporan telat di luar Jumat.
  await assert.rejects(
    pada(db, "2026-10-09T15:01:00").kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: "2026-10-02T15:00:00+07:00" })),
    { statusCode: 400, code: "DIBUAT_PADA_TIDAK_VALID" },
  );
  await assert.rejects(jumat.kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: "bukan-waktu" })), { statusCode: 400, code: "DIBUAT_PADA_TIDAK_VALID" });
  await assert.rejects(jumat.kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: 1_760_000_000_000 })), { statusCode: 400, code: "INVALID_PAYLOAD" });
  assert.equal((await db("kpi_laporan")).length, 0);

  // Selisih jam kecil (≤ 5 menit) dimaafkan.
  const miring = await jumat.kirimLaporan(pemanggil, peserta.id, isi(5, { dibuatPada: "2026-10-09T10:04:00+07:00" }));
  assert.equal(miring.hasil, "dibuat");
});

test("revisi laporan yang ditolak tidak terikat hari Jumat", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const { peserta, pemanggil, prov } = await siapkan(db);
  const awal = await pada(db, "2026-10-02T10:00:00").kirimLaporan(pemanggil, peserta.id, isi(4));
  await pada(db, "2026-10-05T10:00:00").reviewLaporan(prov, awal.laporan.id, { keputusan: "ditolak", catatan: "Foto bukti buram" });

  const selasa = await pada(db, "2026-10-06T10:00:00").kirimLaporan(pemanggil, peserta.id, isi(4, { realisasiOmzet: 175_000 }));
  assert.equal(selasa.hasil, "direvisi");
  assert.equal(selasa.laporan.id, awal.laporan.id);
  assert.equal(selasa.laporan.realisasiOmzet, 175_000);
  // Minggu lain yang belum pernah dikirim tetap butuh Jumat.
  await assert.rejects(pada(db, "2026-10-06T10:00:00").kirimLaporan(pemanggil, peserta.id, isi(5)), { statusCode: 409, code: "BUKAN_HARI_LAPOR" });
});
