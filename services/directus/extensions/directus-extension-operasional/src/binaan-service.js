"use strict";

// Y03 — dasbor pendamping: binaan aktif, antrean verifikasi tiga filter,
// pemeriksaan bukti + zoom, capaian vs target (aturan target nol),
// tolak/setujui atomik, tren per peserta (hanya terverifikasi),
// rekomendasi Champion/Investment Day setelah 4 pekan berturut-turut.

const { OperasionalError, validationFailed } = require("./errors.js");
const { mingguKe } = require("./program-week.js");
const { capaianPersen, layakRekomendasi } = require("./kpi-evaluasi.js");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];

function requirePendamping(operator) {
  if (!operator || operator.role !== "pendamping") {
    throw new OperasionalError(403, "FORBIDDEN", "Hanya pendamping.");
  }
}

async function muatBinaan(database, talentaId, operator, now = new Date()) {
  if (!UUID_PATTERN.test(String(talentaId || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Peserta binaan tidak ditemukan.");
  }
  const res = await database.raw(
    `SELECT t.id AS talenta_id, t.status, t.pendamping, t.batch,
            t.target_mingguan_override, t.rekomendasi_pitching,
            t.rekomendasi_oleh, t.rekomendasi_pada,
            u.id AS usaha_id, u.nama AS usaha_nama, u.omzet_tahunan,
            pu.nama_lengkap AS pemilik_nama,
            ko.nama AS kota_nama, t.kota AS kota_id,
            b.nama AS batch_nama, b.tahap AS batch_tahap,
            to_char(b.tanggal_mulai,'YYYY-MM-DD') AS batch_tanggal_mulai,
            b.jumlah_minggu AS batch_jumlah_minggu, b.faktor_target AS batch_faktor
     FROM talenta t
     JOIN usaha u ON u.id = t.usaha
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     LEFT JOIN kota ko ON ko.id = t.kota
     LEFT JOIN program_batch b ON b.id = t.batch
     WHERE t.id = ? AND t.status IN ('accelerator','champion')
     LIMIT 1`,
    [talentaId],
  );
  const r = rowsOf(res)[0];
  if (!r) throw new OperasionalError(404, "NOT_FOUND", "Peserta binaan tidak ditemukan.");
  if (operator?.role === "pendamping" && String(r.pendamping) !== String(operator.userId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Peserta binaan tidak ditemukan.");
  }
  if (operator?.role === "kabkota" && Number(r.kota_id) !== Number(operator.kotaId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Peserta binaan tidak ditemukan.");
  }
  if (operator && !["pendamping", "provinsi", "kabkota"].includes(operator.role)) {
    throw new OperasionalError(403, "FORBIDDEN", "Akses ditolak.");
  }
  return r;
}

async function laporanUntukTalenta(database, talentaId) {
  const res = await database.raw(
    `SELECT id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala,
            status, catatan_pendamping, dikirim_pada, diverifikasi_oleh, diverifikasi_pada
     FROM talenta_laporan_mingguan WHERE talenta = ? ORDER BY minggu_ke ASC`,
    [talentaId],
  );
  return rowsOf(res);
}

function targetBerjalan(row) {
  if (row.target_mingguan_override !== null && row.target_mingguan_override !== undefined) {
    return Number(row.target_mingguan_override);
  }
  if (row.omzet_tahunan === null || row.omzet_tahunan === undefined) return null;
  const faktor = row.batch_faktor == null ? 1.2 : Number(row.batch_faktor);
  return Math.round((Number(row.omzet_tahunan) / 52) * faktor);
}

async function listBinaan(database, operator, now = new Date()) {
  requirePendamping(operator);
  const res = await database.raw(
    `SELECT t.id AS talenta_id, u.id AS usaha_id, u.nama AS usaha_nama,
            pu.nama_lengkap AS pemilik_nama, ko.nama AS kota_nama,
            b.nama AS batch_nama, t.status,
            to_char(b.tanggal_mulai,'YYYY-MM-DD') AS batch_tanggal_mulai,
            b.jumlah_minggu AS batch_jumlah_minggu, b.faktor_target AS batch_faktor,
            u.omzet_tahunan, t.target_mingguan_override, t.rekomendasi_pitching
     FROM talenta t
     JOIN usaha u ON u.id = t.usaha
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     LEFT JOIN kota ko ON ko.id = t.kota
     LEFT JOIN program_batch b ON b.id = t.batch
     WHERE t.pendamping = ? AND t.status IN ('accelerator','champion')
     ORDER BY u.nama ASC`,
    [operator.userId],
  );
  const rows = rowsOf(res);
  const serverNow = now instanceof Date ? now : new Date(now);
  const out = [];
  for (const r of rows) {
    const jumlahMinggu = r.batch_jumlah_minggu == null ? null : Number(r.batch_jumlah_minggu);
    const berjalan =
      r.batch_tanggal_mulai && jumlahMinggu ? Math.min(mingguKe(r.batch_tanggal_mulai, serverNow), jumlahMinggu) : 0;
    const target = targetBerjalan(r);
    let statusMingguIni = "belum";
    if (berjalan >= 1) {
      const lRes = await database.raw(
        `SELECT status FROM talenta_laporan_mingguan WHERE talenta = ? AND minggu_ke = ? LIMIT 1`,
        [r.talenta_id, berjalan],
      );
      const l = rowsOf(lRes)[0];
      if (l) statusMingguIni = l.status;
    }
    const semua = await laporanUntukTalenta(database, r.talenta_id);
    const layak = layakRekomendasi(
      semua.map((l) => ({
        mingguKe: Number(l.minggu_ke),
        omzet: Number(l.omzet),
        target: l.target == null ? null : Number(l.target),
        status: l.status,
      })),
    );
    out.push({
      talentaId: r.talenta_id,
      usaha: { id: r.usaha_id, nama: r.usaha_nama },
      pemilik: r.pemilik_nama ?? null,
      kota: r.kota_nama ?? null,
      batch: r.batch_nama ? { nama: r.batch_nama } : null,
      status: r.status,
      mingguBerjalan: berjalan,
      jumlahMinggu,
      targetMingguan: target,
      statusMingguIni,
      rekomendasiPitching: Boolean(r.rekomendasi_pitching),
      layakRekomendasi: layak,
    });
  }
  return { data: out };
}

async function listAntrean(database, query = {}, operator, now = new Date()) {
  requirePendamping(operator);
  const status = query.status ?? "menunggu";
  if (!["menunggu", "disetujui", "belum"].includes(status)) {
    throw validationFailed({ status: "Status antrean menunggu/disetujui/belum" });
  }
  const serverNow = now instanceof Date ? now : new Date(now);
  // Muat binaan dulu agar minggu berjalan per peserta tepat.
  const binaan = await listBinaan(database, operator, serverNow);
  const items = [];
  for (const b of binaan.data) {
    if (status === "belum") {
      if (b.mingguBerjalan < 1) continue;
      const cek = await database.raw(
        `SELECT id FROM talenta_laporan_mingguan WHERE talenta = ? AND minggu_ke = ? LIMIT 1`,
        [b.talentaId, b.mingguBerjalan],
      );
      if (!rowsOf(cek)[0]) {
        items.push({ talentaId: b.talentaId, usaha: b.usaha, mingguKe: b.mingguBerjalan, status: "belum" });
      }
      continue;
    }
    const mingguFilter = status === "disetujui" ? b.mingguBerjalan : null;
    const sql =
      status === "disetujui"
        ? `SELECT id, minggu_ke, omzet, target, status, dikirim_pada
           FROM talenta_laporan_mingguan WHERE talenta = ? AND status = 'disetujui' AND minggu_ke = ? ORDER BY dikirim_pada ASC`
        : `SELECT id, minggu_ke, omzet, target, status, dikirim_pada
           FROM talenta_laporan_mingguan WHERE talenta = ? AND status = 'menunggu' ORDER BY dikirim_pada ASC`;
    const params = status === "disetujui" ? [b.talentaId, mingguFilter] : [b.talentaId];
    if (status === "disetujui" && !(mingguFilter >= 1)) continue;
    const res = await database.raw(sql, params);
    for (const l of rowsOf(res)) {
      items.push({
        laporanId: l.id,
        talentaId: b.talentaId,
        usaha: b.usaha,
        mingguKe: Number(l.minggu_ke),
        omzet: Number(l.omzet),
        target: l.target == null ? null : Number(l.target),
        capaianPersen: capaianPersen(Number(l.omzet), l.target == null ? null : Number(l.target)),
        dikirimPada: l.dikirim_pada ? new Date(l.dikirim_pada).toISOString() : null,
        status: l.status,
      });
    }
  }
  return { data: items };
}

async function getLaporan(database, laporanId, operator) {
  if (!UUID_PATTERN.test(String(laporanId || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  }
  const res = await database.raw(
    `SELECT l.id, l.talenta, l.minggu_ke, l.omzet, l.jumlah_transaksi, l.target, l.bukti,
            l.catatan_kendala, l.status, l.catatan_pendamping, l.dikirim_pada,
            l.diverifikasi_oleh, l.diverifikasi_pada,
            u.id AS usaha_id, u.nama AS usaha_nama, pu.nama_lengkap AS pemilik_nama,
            t.pendamping, t.kota AS kota_id, f.type AS bukti_tipe
     FROM talenta_laporan_mingguan l
     JOIN talenta t ON t.id = l.talenta
     JOIN usaha u ON u.id = t.usaha
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     LEFT JOIN directus_files f ON f.id = l.bukti
     WHERE l.id = ? LIMIT 1`,
    [laporanId],
  );
  const r = rowsOf(res)[0];
  if (!r) throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  if (operator?.role === "pendamping" && String(r.pendamping) !== String(operator.userId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  }
  if (operator?.role === "kabkota" && Number(r.kota_id) !== Number(operator.kotaId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  }
  if (operator?.role === "umkm" && String(r.usaha_id) !== String(operator.usahaId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  }
  if (!["pendamping", "provinsi", "kabkota", "umkm"].includes(operator?.role)) {
    throw new OperasionalError(403, "FORBIDDEN", "Akses ditolak.");
  }
  return {
    data: {
      laporanId: r.id,
      talentaId: r.talenta,
      usaha: { id: r.usaha_id, nama: r.usaha_nama },
      pemilik: r.pemilik_nama ?? null,
      mingguKe: Number(r.minggu_ke),
      omzet: Number(r.omzet),
      jumlahTransaksi: Number(r.jumlah_transaksi),
      target: r.target == null ? null : Number(r.target),
      capaianPersen: capaianPersen(Number(r.omzet), r.target == null ? null : Number(r.target)),
      catatanKendala: r.catatan_kendala ?? null,
      bukti: r.bukti ? { id: r.bukti, tipe: r.bukti_tipe ?? null } : null,
      status: r.status,
      catatanPendamping: r.catatan_pendamping ?? null,
      dikirimPada: r.dikirim_pada ? new Date(r.dikirim_pada).toISOString() : null,
      diverifikasiOleh: r.diverifikasi_oleh ?? null,
      diverifikasiPada: r.diverifikasi_pada ? new Date(r.diverifikasi_pada).toISOString() : null,
    },
  };
}

async function verifikasiLaporan(database, laporanId, body = {}, operator) {
  requirePendamping(operator);
  const keputusan = body.keputusan;
  if (!["disetujui", "ditolak"].includes(keputusan)) {
    throw validationFailed({ keputusan: "Keputusan disetujui/ditolak" });
  }
  const catatanRaw = body.catatan ?? null;
  const catatan = typeof catatanRaw === "string" ? catatanRaw.trim() : catatanRaw === null ? null : null;
  if (keputusan === "ditolak") {
    if (!catatan || catatan.length < 3 || catatan.length > 1000) {
      throw validationFailed({ catatan: "Catatan tolak 3–1000 karakter" });
    }
  } else if (catatan !== null && (typeof body.catatan !== "string" || body.catatan.length > 1000)) {
    throw validationFailed({ catatan: "Catatan maksimal 1000 karakter" });
  }
  const cek = await database.raw(
    `SELECT l.id, l.status, t.pendamping
     FROM talenta_laporan_mingguan l JOIN talenta t ON t.id = l.talenta
     WHERE l.id = ? LIMIT 1`,
    [laporanId],
  );
  const row = rowsOf(cek)[0];
  if (!row || String(row.pendamping) !== String(operator.userId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  }
  if (row.status !== "menunggu") {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Hanya laporan menunggu yang dapat diverifikasi.");
  }
  const run = async (trx) => {
    await trx.raw(
      `UPDATE talenta_laporan_mingguan
       SET status = ?, catatan_pendamping = ?, diverifikasi_oleh = ?, diverifikasi_pada = NOW(), date_updated = NOW()
       WHERE id = ? AND status = 'menunggu'`,
      [keputusan, keputusan === "ditolak" ? catatan : body.catatan ?? null, operator.userId, laporanId],
    );
  };
  if (typeof database.transaction === "function") await database.transaction(run);
  else await run(database);
  return getLaporan(database, laporanId, operator);
}

async function getBinaanDetail(database, talentaId, operator, now = new Date()) {
  const b = await muatBinaan(database, talentaId, operator, now);
  const serverNow = now instanceof Date ? now : new Date(now);
  const jumlahMinggu = b.batch_jumlah_minggu == null ? null : Number(b.batch_jumlah_minggu);
  const berjalan =
    b.batch_tanggal_mulai && jumlahMinggu ? Math.min(mingguKe(b.batch_tanggal_mulai, serverNow), jumlahMinggu) : 0;
  const targetSaatIni = targetBerjalan(b);
  const semua = await laporanUntukTalenta(database, talentaId);
  const peta = new Map(semua.map((l) => [Number(l.minggu_ke), l]));
  const tren = [];
  const maks = jumlahMinggu ?? Math.max(berjalan, ...[...peta.keys()], 0);
  for (let w = 1; w <= Math.max(maks, 0); w++) {
    const l = peta.get(w);
    if (l && l.status === "disetujui") {
      tren.push({
        mingguKe: w,
        target: l.target == null ? targetSaatIni : Number(l.target),
        realisasi: Number(l.omzet),
        status: l.status,
      });
    } else if (l) {
      tren.push({
        mingguKe: w,
        target: l.target == null ? targetSaatIni : Number(l.target),
        realisasi: null,
        status: l.status,
      });
    } else {
      tren.push({ mingguKe: w, target: targetSaatIni, realisasi: null, status: "belum" });
    }
  }
  // Tren grafik + pembacaan pimpinan HANYA memakai data terverifikasi
  // (realisasi non-null hanya untuk status disetujui — lihat loop di atas).
  const layak = layakRekomendasi(
    semua.map((l) => ({
      mingguKe: Number(l.minggu_ke),
      omzet: Number(l.omzet),
      target: l.target == null ? null : Number(l.target),
      status: l.status,
    })),
  );
  return {
    data: {
      talentaId: b.talenta_id,
      usaha: { id: b.usaha_id, nama: b.usaha_nama },
      pemilik: b.pemilik_nama ?? null,
      batch: b.batch ? { id: b.batch, nama: b.batch_nama, tahap: b.batch_tahap } : null,
      status: b.status,
      mingguBerjalan: berjalan,
      jumlahMinggu,
      targetMingguan: targetSaatIni,
      tren,
      laporan: semua.map((l) => ({
        id: l.id,
        mingguKe: Number(l.minggu_ke),
        omzet: Number(l.omzet),
        jumlahTransaksi: Number(l.jumlah_transaksi),
        target: l.target == null ? null : Number(l.target),
        capaianPersen: capaianPersen(Number(l.omzet), l.target == null ? null : Number(l.target)),
        status: l.status,
        catatanPendamping: l.catatan_pendamping ?? null,
        dikirimPada: l.dikirim_pada ? new Date(l.dikirim_pada).toISOString() : null,
        diverifikasiPada: l.diverifikasi_pada ? new Date(l.diverifikasi_pada).toISOString() : null,
      })),
      rekomendasiPitching: Boolean(b.rekomendasi_pitching),
      rekomendasiOleh: b.rekomendasi_oleh ?? null,
      rekomendasiPada: b.rekomendasi_pada ? new Date(b.rekomendasi_pada).toISOString() : null,
      layakRekomendasi: layak,
    },
  };
}

async function setRekomendasi(database, talentaId, body = {}, operator) {
  requirePendamping(operator);
  const aktif = body.aktif;
  if (typeof aktif !== "boolean") throw validationFailed({ aktif: "Aktif boolean wajib" });
  const b = await muatBinaan(database, talentaId, operator);
  if (String(b.pendamping) !== String(operator.userId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Peserta binaan tidak ditemukan.");
  }
  if (b.status === "champion" && aktif === false) {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Rekomendasi Champion tidak dapat dicabut.");
  }
  if (b.status !== "accelerator" && aktif === true) {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Hanya peserta accelerator yang dapat direkomendasikan.");
  }
  if (aktif === true) {
    const semua = await laporanUntukTalenta(database, talentaId);
    const layak = layakRekomendasi(
      semua.map((l) => ({
        mingguKe: Number(l.minggu_ke),
        omzet: Number(l.omzet),
        target: l.target == null ? null : Number(l.target),
        status: l.status,
      })),
    );
    if (!layak) {
      throw new OperasionalError(
        409,
        "BELUM_LAYAK_REKOMENDASI",
        "Aktif setelah 4 pekan berturut-turut mencapai target.",
      );
    }
    const run = async (trx) => {
      await trx.raw(
        `UPDATE talenta SET rekomendasi_pitching = TRUE, rekomendasi_oleh = ?, rekomendasi_pada = NOW(), date_updated = NOW() WHERE id = ?`,
        [operator.userId, talentaId],
      );
    };
    if (typeof database.transaction === "function") await database.transaction(run);
    else await run(database);
  } else {
    const run = async (trx) => {
      await trx.raw(
        `UPDATE talenta SET rekomendasi_pitching = FALSE, rekomendasi_oleh = NULL, rekomendasi_pada = NULL, date_updated = NOW() WHERE id = ?`,
        [talentaId],
      );
    };
    if (typeof database.transaction === "function") await database.transaction(run);
    else await run(database);
  }
  return getBinaanDetail(database, talentaId, operator);
}

module.exports = {
  listBinaan,
  listAntrean,
  getLaporan,
  verifikasiLaporan,
  getBinaanDetail,
  setRekomendasi,
};
