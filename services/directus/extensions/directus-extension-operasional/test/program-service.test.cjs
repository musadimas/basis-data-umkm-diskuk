"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("../src/program-service.js");

const PROV = { userId: "prov-1", role: "provinsi" };
const UMKM = { userId: "u-umkm", role: "umkm", usahaId: "d0000000-0000-4000-8000-000000000001" };
const BATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const TALENTA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const BUKTI_ID = "cccccccc-cccc-4ccc-8ccc-000000000001";
const CLIENT_ID = "d1000000-0000-4000-8000-000000000001";

// Jumat 2026-10-02 12:00 WIB; batch mulai Senin 2026-09-28 (minggu ke-1 = 28 Sep–4 Okt).
const JUMAT = new Date("2026-10-02T05:00:00Z");
const SABTU = new Date("2026-10-03T05:00:00Z");
const KAMIS = new Date("2026-10-01T05:00:00Z");

function dbLaporan({ talentaRow, idemRow = null, existingWeek = null, insertRow = null, updateRow = null, berkasOk = true } = {}) {
  const calls = [];
  const fallbackTalenta =
    talentaRow ??
    ({
      id: TALENTA_ID,
      status: "accelerator",
      batch: BATCH_ID,
      batch_kode: "ACC-2026-B1",
      batch_nama: "Batch 1",
      batch_tahap: "accelerator",
      batch_tanggal_mulai: "2026-09-28",
      batch_jumlah_minggu: 12,
      batch_faktor_target: "1.20",
      usaha_nama: "Wawan Leathercraft",
      usaha_nib: "9900000000001",
      usaha_skala: "small",
      usaha_omzet: "780000000",
      pemilik_nama: "Wawan Setiawan",
      target_mingguan_override: null,
      pendamping: null,
    });
  return {
    calls,
    database: {
      raw: async (sql, params) => {
        calls.push(sql);
        if (sql.includes("FROM talenta t") && sql.includes("t.usaha")) {
          return { rows: [fallbackTalenta] };
        }
        if (sql.includes("FROM talenta_laporan_mingguan WHERE talenta = ? AND client_uuid")) {
          return { rows: idemRow ? [idemRow] : [] };
        }
        if (sql.includes("SELECT id, status FROM talenta_laporan_mingguan WHERE talenta")) {
          return { rows: existingWeek ? [existingWeek] : [] };
        }
        if (sql.includes("INSERT INTO talenta_laporan_mingguan")) {
          if (insertRow) return { rows: [insertRow] };
          return {
            rows: [
              {
                id: "eeeeeeee-eeee-4eee-8eee-000000000001",
                minggu_ke: 1,
                omzet: "19000000",
                jumlah_transaksi: 10,
                target: "18000000",
                bukti: BUKTI_ID,
                status: "menunggu",
                catatan_pendamping: null,
                dikirim_pada: JUMAT.toISOString(),
                diverifikasi_pada: null,
                provenance: "online",
              },
            ],
          };
        }
        if (sql.includes("UPDATE talenta_laporan_mingguan") && sql.includes("SET omzet")) {
          return { rows: [updateRow ?? { id: "eeeeeeee-eeee-4eee-8eee-000000000001", minggu_ke: 1, omzet: "19000000", jumlah_transaksi: 10, target: "18000000", bukti: BUKTI_ID, status: "menunggu", catatan_pendamping: null, dikirim_pada: JUMAT.toISOString(), diverifikasi_pada: null, provenance: "online" }] };
        }
        if (sql.includes("FROM directus_files")) {
          if (!berkasOk) return { rows: [] };
          return { rows: [{ id: BUKTI_ID, folder: "fa57be17-82ba-480c-b77c-536d42a124d4", uploaded_by: UMKM.userId }] };
        }
        return { rows: [] };
      },
      transaction: async (fn) => fn({
        raw: async (sql, params) => {
          calls.push(sql);
          if (sql.includes("SELECT id, status FROM talenta_laporan_mingguan WHERE talenta")) {
            return { rows: existingWeek ? [existingWeek] : [] };
          }
          if (sql.includes("INSERT INTO talenta_laporan_mingguan")) {
            if (insertRow === "DUPLICATE") {
              const e = new Error("duplicate");
              e.code = "23505";
              throw e;
            }
            return {
              rows: [
                insertRow ?? {
                  id: "eeeeeeee-eeee-4eee-8eee-000000000001",
                  minggu_ke: 1,
                  omzet: "19000000",
                  jumlah_transaksi: 10,
                  target: "18000000",
                  bukti: BUKTI_ID,
                  status: "menunggu",
                  catatan_pendamping: null,
                  dikirim_pada: JUMAT.toISOString(),
                  diverifikasi_pada: null,
                  provenance: "online",
                },
              ],
            };
          }
          if (sql.includes("UPDATE talenta_laporan_mingguan") && sql.includes("SET omzet")) {
            return { rows: [updateRow ?? { id: "eeeeeeee-eeee-4eee-8eee-000000000001", minggu_ke: 1, omzet: "19000000", jumlah_transaksi: 10, target: "18000000", bukti: BUKTI_ID, status: "menunggu", catatan_pendamping: null, dikirim_pada: JUMAT.toISOString(), diverifikasi_pada: null, provenance: "online" }] };
          }
          return { rows: [] };
        },
      }),
    },
  };
}

const bodyJumat = {
  clientUuid: CLIENT_ID,
  mingguKe: 1,
  omzet: 19000000,
  jumlahTransaksi: 10,
  buktiFileId: BUKTI_ID,
  catatanKendala: null,
  dikirimPada: JUMAT.toISOString(),
};

test("kirimLaporan Jumat online → 201 + provenance online", async () => {
  const { database } = dbLaporan({});
  const out = await service.kirimLaporan(database, bodyJumat, UMKM, JUMAT);
  assert.equal(out.data.status, "menunggu");
  assert.equal(out.data.provenance, "online");
});

test("kirimLaporan Kamis → 422 BUKAN_JUMAT (M5-03)", async () => {
  const { database } = dbLaporan({});
  await assert.rejects(
    () => service.kirimLaporan(database, { ...bodyJumat, dikirimPada: KAMIS.toISOString() }, UMKM, KAMIS),
    (e) => e.statusCode === 422 && e.code === "BUKAN_JUMAT",
  );
});

test("replay offline Jumat disinkron Sabtu → sah + provenance offline-replay (M5-02)", async () => {
  const { database } = dbLaporan({
    insertRow: {
      id: "eeeeeeee-eeee-4eee-8eee-000000000001",
      minggu_ke: 1,
      omzet: "19000000",
      jumlah_transaksi: 10,
      target: "18000000",
      bukti: BUKTI_ID,
      status: "menunggu",
      catatan_pendamping: null,
      dikirim_pada: JUMAT.toISOString(),
      diverifikasi_pada: null,
      provenance: "offline-replay",
    },
  });
  const out = await service.kirimLaporan(database, bodyJumat, UMKM, SABTU);
  assert.equal(out.data.provenance, "offline-replay");
});

test("client_uuid ulang → idempoten tanpa insert kedua", async () => {
  const idemRow = {
    id: "eeeeeeee-eeee-4eee-8eee-000000000001",
    minggu_ke: 1,
    omzet: "19000000",
    jumlah_transaksi: 10,
    target: "18000000",
    bukti: BUKTI_ID,
    status: "menunggu",
    catatan_pendamping: null,
    dikirim_pada: JUMAT.toISOString(),
    diverifikasi_pada: null,
    provenance: "online",
  };
  const { database, calls } = dbLaporan({ idemRow });
  const out = await service.kirimLaporan(database, bodyJumat, UMKM, JUMAT);
  assert.equal(out.meta.idempoten, true);
  assert.ok(!calls.some((s) => s.includes("INSERT INTO talenta_laporan_mingguan")));
});

test("minggu duplikat menunggu/disetujui → 409; ditolak → UPDATE 200 revisi sama", async () => {
  const men = dbLaporan({ existingWeek: { id: "eeeeeeee-eeee-4eee-8eee-000000000001", status: "menunggu" } });
  await assert.rejects(
    () => service.kirimLaporan(men.database, { ...bodyJumat, clientUuid: "d1000000-0000-4000-8000-000000000002" }, UMKM, JUMAT),
    (e) => e.statusCode === 409 && e.code === "WEEK_ALREADY_REPORTED",
  );
  const tol = dbLaporan({ existingWeek: { id: "eeeeeeee-eeee-4eee-8eee-000000000001", status: "ditolak" } });
  const out = await service.kirimLaporan(
    tol.database,
    { ...bodyJumat, clientUuid: "d1000000-0000-4000-8000-000000000003" },
    UMKM,
    JUMAT,
  );
  assert.equal(out.data.status, "menunggu");
});

test("talenta bukan accelerator → 409; dikirimPada masa depan → 400", async () => {
  const bukan = dbLaporan({
    talentaRow: {
      id: TALENTA_ID, status: "scouting", batch: null, batch_tanggal_mulai: null,
      batch_jumlah_minggu: null, batch_faktor_target: null, usaha_nama: "X",
      usaha_omzet: null, target_mingguan_override: null,
    },
  });
  await assert.rejects(
    () => service.kirimLaporan(bukan.database, bodyJumat, UMKM, JUMAT),
    (e) => e.statusCode === 409 && e.code === "PROGRAM_BELUM_AKTIF",
  );
  const { database } = dbLaporan({});
  await assert.rejects(
    () =>
      service.kirimLaporan(
        database,
        { ...bodyJumat, dikirimPada: new Date(JUMAT.getTime() + 60 * 60 * 1000).toISOString() },
        UMKM,
        JUMAT,
      ),
    (e) => e.statusCode === 400,
  );
});

test("createBatch: validasi + duplikat 409; kabkota POST → 403", async () => {
  const dbOk = {
    raw: async (sql) => {
      if (sql.includes("INSERT INTO program_batch")) return { rows: [{ id: BATCH_ID }] };
      if (sql.includes("FROM program_batch WHERE id")) {
        return { rows: [{ id: BATCH_ID, kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggal_mulai: "2026-09-28", jumlah_minggu: 12, faktor_target: "1.20" }] };
      }
      return { rows: [] };
    },
    transaction: async (fn) => fn({ raw: async (sql) => {
      if (sql.includes("INSERT INTO program_batch")) return { rows: [{ id: BATCH_ID }] };
      return { rows: [] };
    } }),
  };
  const out = await service.createBatch(dbOk, { kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggalMulai: "2026-09-28" }, PROV);
  assert.equal(out.data.kode, "ACC-2026-B1");
  await assert.rejects(
    () => service.createBatch(dbOk, { kode: "x", nama: "B", tahap: "accelerator", tanggalMulai: "2026-09-28" }, PROV),
    (e) => e.statusCode === 400,
  );
  await assert.rejects(
    () => service.createBatch(dbOk, { kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggalMulai: "2026-09-28" }, { userId: "k", role: "kabkota" }),
    (e) => e.statusCode === 403,
  );
  const dbDup = {
    raw: async () => ({ rows: [] }),
    transaction: async (fn) => fn({ raw: async () => { const e = new Error("dup"); e.code = "23505"; throw e; } }),
  };
  await assert.rejects(
    () => service.createBatch(dbDup, { kode: "ACC-2026-B1", nama: "Batch 1", tahap: "accelerator", tanggalMulai: "2026-09-28" }, PROV),
    (e) => e.statusCode === 409 && e.code === "KODE_SUDAH_ADA",
  );
});

test("ubahTahap: talent_lab→accelerator tanpa pendamping → 400; champion tanpa rekomendasi → 409", async () => {
  const db = (status, extra = {}) => ({
    raw: async (sql, params) => {
      if (sql.includes("FROM talenta WHERE id")) {
        return { rows: [{ id: TALENTA_ID, status, batch: null, pendamping: null, target_mingguan_override: null, rekomendasi_pitching: false, ...extra }] };
      }
      if (sql.includes("FROM program_batch")) return { rows: [{ id: BATCH_ID, tahap: "accelerator" }] };
      if (sql.includes("FROM directus_users")) return { rows: [{ id: "pend-1" }] };
      return { rows: [] };
    },
    transaction: async (fn) => fn({ raw: async () => ({ rows: [] }) }),
  });
  await assert.rejects(
    () => service.ubahTahap(db("talent_lab"), TALENTA_ID, { tahap: "accelerator", batchId: BATCH_ID }, PROV),
    (e) => e.statusCode === 400,
  );
  await assert.rejects(
    () => service.ubahTahap(db("accelerator"), TALENTA_ID, { tahap: "champion" }, PROV),
    (e) => e.statusCode === 409 && e.code === "REKOMENDASI_DIPERLUKAN",
  );
});
