"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("../src/binaan-service.js");

const PEND = { userId: "pend-1", role: "pendamping" };
const PEND_LAIN = { userId: "pend-2", role: "pendamping" };
const TALENTA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const LAPORAN_ID = "eeeeeeee-eeee-4eee-8eee-000000000001";

function binaanRow(over = {}) {
  return {
    talenta_id: TALENTA_ID,
    status: "accelerator",
    pendamping: "pend-1",
    batch: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    target_mingguan_override: null,
    rekomendasi_pitching: false,
    rekomendasi_oleh: null,
    rekomendasi_pada: null,
    usaha_id: "d0000000-0000-4000-8000-000000000001",
    usaha_nama: "Wawan Leathercraft",
    omzet_tahunan: "780000000",
    pemilik_nama: "Wawan Setiawan",
    kota_nama: "KABUPATEN SUBANG",
    kota_id: 1,
    batch_nama: "Batch 1",
    batch_tahap: "accelerator",
    batch_tanggal_mulai: "2026-09-28",
    batch_jumlah_minggu: 12,
    batch_faktor: "1.20",
    ...over,
  };
}

function dbBinaan({ rows = [binaanRow()], laporan = [], laporanDetail = null, statusMinggu = null } = {}) {
  return {
    raw: async (sql, params) => {
      if (sql.includes("FROM talenta t") && sql.includes("t.pendamping = ?")) {
        return { rows };
      }
      if (sql.includes("FROM talenta t") && sql.includes("WHERE t.id = ?")) {
        const hit = rows.find((r) => String(r.talenta_id) === String(params[0]));
        return { rows: hit ? [hit] : [] };
      }
      if (sql.includes("FROM talenta_laporan_mingguan WHERE talenta = ? ORDER BY")) {
        return { rows: laporan };
      }
      if (sql.includes("SELECT status FROM talenta_laporan_mingguan WHERE talenta")) {
        return { rows: statusMinggu ? [statusMinggu] : [] };
      }
      if (sql.includes("FROM talenta_laporan_mingguan WHERE talenta = ? AND status")) {
        return { rows: laporan };
      }
      if (sql.includes("FROM talenta_laporan_mingguan WHERE talenta = ? AND minggu_ke")) {
        return { rows: laporan.length > 0 ? [{ id: LAPORAN_ID }] : [] };
      }
      if (sql.includes("SELECT id FROM talenta_laporan_mingguan WHERE talenta")) {
        return { rows: laporan.length > 0 ? [{ id: LAPORAN_ID }] : [] };
      }
      if (sql.includes("FROM talenta_laporan_mingguan l JOIN talenta t") && sql.includes("WHERE l.id")) {
        if (!laporanDetail) return { rows: [] };
        return { rows: [laporanDetail] };
      }
      if (sql.includes("SELECT l.id, l.status, t.pendamping")) {
        if (!laporanDetail) return { rows: [] };
        return { rows: [{ id: LAPORAN_ID, status: laporanDetail.status ?? "menunggu", pendamping: laporanDetail.pendamping ?? "pend-1" }] };
      }
      return { rows: [] };
    },
    transaction: async (fn) => fn({ raw: async () => ({ rows: [] }) }),
  };
}

const EMPAT = [1, 2, 3, 4].map((m) => ({
  id: `l-${m}`, minggu_ke: m, omzet: "19000000", jumlah_transaksi: 10, target: "18000000",
  bukti: null, catatan_kendala: null, status: "disetujui", catatan_pendamping: null,
  dikirim_pada: new Date("2026-10-02T05:00:00Z").toISOString(), diverifikasi_oleh: "pend-1",
  diverifikasi_pada: new Date("2026-10-03T05:00:00Z").toISOString(),
}));

test("listBinaan: hanya milik pendamping; pendamping lain kosong", async () => {
  const db = dbBinaan({});
  const out = await service.listBinaan(db, PEND, new Date("2026-10-02T05:00:00Z"));
  assert.equal(out.data.length, 1);
  assert.equal(out.data[0].usaha.nama, "Wawan Leathercraft");
  const dbLain = dbBinaan({ rows: [] });
  const kosong = await service.listBinaan(dbLain, PEND_LAIN, new Date("2026-10-02T05:00:00Z"));
  assert.equal(kosong.data.length, 0);
});

test("listAntrean tiga filter: menunggu/disetujui/belum", async () => {
  const menunggu = [
    { id: LAPORAN_ID, minggu_ke: 1, omzet: "19000000", target: "18000000", status: "menunggu", dikirim_pada: new Date("2026-10-02T05:00:00Z").toISOString() },
  ];
  const db = dbBinaan({ laporan: menunggu, statusMinggu: null });
  const a = await service.listAntrean(db, { status: "menunggu" }, PEND, new Date("2026-10-02T05:00:00Z"));
  assert.equal(a.data.length, 1);
  assert.equal(a.data[0].capaianPersen, 105.6);
  const dbBelum = dbBinaan({ laporan: [], statusMinggu: null });
  const b = await service.listAntrean(dbBelum, { status: "belum" }, PEND, new Date("2026-10-02T05:00:00Z"));
  assert.equal(b.data.length, 1);
  assert.equal(b.data[0].status, "belum");
});

test("pendamping lain verifikasi/detail → 404; provinsi verifikasi → 403", async () => {
  const detail = {
    id: LAPORAN_ID, talenta: TALENTA_ID, minggu_ke: 1, omzet: "19000000", jumlah_transaksi: 10,
    target: "18000000", bukti: null, catatan_kendala: null, status: "menunggu",
    catatan_pendamping: null, dikirim_pada: new Date("2026-10-02T05:00:00Z").toISOString(),
    diverifikasi_oleh: null, diverifikasi_pada: null,
    usaha_id: "d0000000-0000-4000-8000-000000000001", usaha_nama: "Wawan", pemilik_nama: "Wawan",
    pendamping: "pend-1", kota_id: 1, bukti_tipe: "image/png",
  };
  const db = dbBinaan({ laporanDetail: detail });
  await assert.rejects(
    () => service.verifikasiLaporan(db, LAPORAN_ID, { keputusan: "disetujui" }, PEND_LAIN),
    (e) => e.statusCode === 404,
  );
  await assert.rejects(
    () => service.verifikasiLaporan(db, LAPORAN_ID, { keputusan: "disetujui" }, { userId: "p", role: "provinsi" }),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    () => service.getBinaanDetail(dbBinaan({ rows: [binaanRow({ kota_id: 99 })] }), TALENTA_ID, { userId: "k", role: "kabkota", kotaId: 1 }),
    (e) => e.statusCode === 404,
  );
});

test("verifikasi: tolak tanpa catatan → 400; dari disetujui → 409", async () => {
  const menunggu = {
    id: LAPORAN_ID, talenta: TALENTA_ID, minggu_ke: 1, omzet: "19000000", jumlah_transaksi: 10,
    target: "18000000", bukti: null, catatan_kendala: null, status: "menunggu",
    catatan_pendamping: null, dikirim_pada: new Date("2026-10-02T05:00:00Z").toISOString(),
    diverifikasi_oleh: null, diverifikasi_pada: null,
    usaha_id: "d0000000-0000-4000-8000-000000000001", usaha_nama: "Wawan", pemilik_nama: "Wawan",
    pendamping: "pend-1", kota_id: 1, bukti_tipe: "image/png",
  };
  const db = dbBinaan({ laporanDetail: menunggu });
  await assert.rejects(
    () => service.verifikasiLaporan(db, LAPORAN_ID, { keputusan: "ditolak", catatan: "" }, PEND),
    (e) => e.statusCode === 400,
  );
  const dbSudah = dbBinaan({ laporanDetail: { ...menunggu, status: "disetujui" } });
  await assert.rejects(
    () => service.verifikasiLaporan(dbSudah, LAPORAN_ID, { keputusan: "disetujui", catatan: "OK" }, PEND),
    (e) => e.statusCode === 409,
  );
});

test("rekomendasi: belum layak → 409; layak 4 pekan → boleh aktif", async () => {
  const tiga = EMPAT.slice(0, 3);
  const dbKurang = dbBinaan({ laporan: tiga });
  await assert.rejects(
    () => service.setRekomendasi(dbKurang, TALENTA_ID, { aktif: true }, PEND),
    (e) => e.statusCode === 409 && e.code === "BELUM_LAYAK_REKOMENDASI",
  );
  const dbLayak = dbBinaan({ laporan: EMPAT });
  const out = await service.setRekomendasi(dbLayak, TALENTA_ID, { aktif: true }, PEND);
  assert.ok(out.data.tren.length >= 4);
  assert.equal(out.data.layakRekomendasi, true);
});

test("getBinaanDetail tren hanya realisasi terverifikasi (ditolak → null)", async () => {
  const campur = [
    { ...EMPAT[0], status: "disetujui" },
    { ...EMPAT[1], minggu_ke: 2, status: "ditolak" },
  ];
  const db = dbBinaan({ laporan: campur });
  const out = await service.getBinaanDetail(db, TALENTA_ID, PEND, new Date("2026-10-02T05:00:00Z"));
  const m1 = out.data.tren.find((t) => t.mingguKe === 1);
  const m2 = out.data.tren.find((t) => t.mingguKe === 2);
  assert.equal(m1.realisasi, 19000000);
  assert.equal(m2.realisasi, null);
});
