"use strict";

// Y03 — batch program, keanggotaan peserta-pendamping, target KPI, laporan Jumat.
// Kontrak: minggu program dari tanggal_mulai, batas jumlah_minggu (default 12).
// Laporan baru valid hanya bila waktu penciptaan (dikirimPada) jatuh pada
// Jumat WIB; replay offline Jumat setelah Jumat sah dengan provenance
// "offline-replay" (maks 7 hari). Satu laporan aktif per peserta/minggu;
// revisi karena penolakan memakai record yang sama.

const { OperasionalError, validationFailed } = require("./errors.js");
const { assertBerkasMilik } = require("./berkas-service.js");
const {
  tanggalJakarta,
  mingguKe,
  targetMingguan,
  isJumatJakarta,
  klasifikasiKirim,
} = require("./program-week.js");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];

const TAHAP_BATCH = ["talent_lab", "accelerator"];
const STATUS_PESERTA = ["scouting", "talent_lab", "accelerator", "champion"];

function requireProvinsi(operator) {
  if (!operator || operator.role !== "provinsi") {
    throw new OperasionalError(403, "FORBIDDEN", "Hanya admin provinsi.");
  }
}

function requireDataRole(operator) {
  if (!operator || !["provinsi", "kabkota"].includes(operator.role)) {
    throw new OperasionalError(403, "FORBIDDEN", "Akses ditolak.");
  }
}

function requireUmkm(operator) {
  if (!operator || operator.role !== "umkm" || !operator.usahaId) {
    throw new OperasionalError(403, "FORBIDDEN", "Hanya akun UMKM.");
  }
}

function parseTanggalMulaiStrict(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return value;
}

async function talentaAktifUntukUsaha(database, usahaId) {
  const res = await database.raw(
    `SELECT t.id, t.status, t.batch, t.pendamping, t.target_mingguan_override,
            t.rekomendasi_pitching,
            b.kode AS batch_kode, b.nama AS batch_nama, b.tahap AS batch_tahap,
            to_char(b.tanggal_mulai,'YYYY-MM-DD') AS batch_tanggal_mulai,
            b.jumlah_minggu AS batch_jumlah_minggu, b.faktor_target AS batch_faktor_target,
            u.nama AS usaha_nama, u.nib AS usaha_nib, u.skala AS usaha_skala,
            u.omzet_tahunan AS usaha_omzet,
            pu.nama_lengkap AS pemilik_nama,
            pg.first_name AS pendamping_fn, pg.last_name AS pendamping_ln, pg.email AS pendamping_email
     FROM talenta t
     JOIN usaha u ON u.id = t.usaha
     LEFT JOIN program_batch b ON b.id = t.batch
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     LEFT JOIN directus_users pg ON pg.id = t.pendamping
     WHERE t.usaha = ? AND t.status <> 'ditolak'
     LIMIT 1`,
    [usahaId],
  );
  return rowsOf(res)[0] ?? null;
}

async function listBatch(database, operator) {
  requireDataRole(operator);
  const res = await database.raw(
    `SELECT b.id, b.kode, b.nama, b.tahap,
            to_char(b.tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
            b.jumlah_minggu, b.faktor_target,
            (SELECT COUNT(*)::integer FROM talenta t WHERE t.batch = b.id AND t.status <> 'ditolak') AS jumlah_peserta
     FROM program_batch b ORDER BY b.tanggal_mulai DESC, b.kode ASC`,
  );
  return {
    data: rowsOf(res).map((r) => ({
      id: r.id,
      kode: r.kode,
      nama: r.nama,
      tahap: r.tahap,
      tanggalMulai: r.tanggal_mulai,
      jumlahMinggu: Number(r.jumlah_minggu),
      faktorTarget: Number(r.faktor_target),
      jumlahPeserta: Number(r.jumlah_peserta ?? 0),
    })),
  };
}

async function createBatch(database, body = {}, operator) {
  requireProvinsi(operator);
  const fields = {};
  const kode = typeof body.kode === "string" ? body.kode.trim() : "";
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(kode)) fields.kode = "Kode 3–40 karakter (huruf/angka/_/-)";
  const nama = typeof body.nama === "string" ? body.nama.trim() : "";
  if (!nama || nama.length > 120) fields.nama = "Nama 1–120 karakter";
  if (!TAHAP_BATCH.includes(body.tahap)) fields.tahap = "Tahap harus talent_lab atau accelerator";
  const tanggalMulai = parseTanggalMulaiStrict(body.tanggalMulai);
  if (!tanggalMulai) fields.tanggalMulai = "Tanggal mulai YYYY-MM-DD valid";
  let jumlahMinggu = body.jumlahMinggu ?? 12;
  jumlahMinggu = Number(jumlahMinggu);
  if (!Number.isInteger(jumlahMinggu) || jumlahMinggu < 1 || jumlahMinggu > 52) {
    fields.jumlahMinggu = "Jumlah minggu 1–52";
  }
  let faktorTarget = body.faktorTarget ?? 1.2;
  faktorTarget = Number(faktorTarget);
  if (!Number.isFinite(faktorTarget) || faktorTarget < 0.1 || faktorTarget > 5) {
    fields.faktorTarget = "Faktor target 0,1–5";
  }
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  const run = async (trx) => {
    try {
      const ins = await trx.raw(
        `INSERT INTO program_batch (kode, nama, tahap, tanggal_mulai, jumlah_minggu, faktor_target, dibuat_oleh)
         VALUES (?, ?, ?, ?::date, ?, ?, ?) RETURNING id`,
        [kode, nama, body.tahap, tanggalMulai, jumlahMinggu, faktorTarget, operator.userId ?? null],
      );
      return rowsOf(ins)[0]?.id;
    } catch (error) {
      if (String(error?.code) === "23505") {
        throw new OperasionalError(409, "KODE_SUDAH_ADA", "Kode batch sudah dipakai.");
      }
      throw error;
    }
  };
  let id;
  if (typeof database.transaction === "function") id = await database.transaction(run);
  else id = await run(database);
  const cek = await database.raw(
    `SELECT id, kode, nama, tahap, to_char(tanggal_mulai,'YYYY-MM-DD') AS tanggal_mulai,
            jumlah_minggu, faktor_target FROM program_batch WHERE id = ? LIMIT 1`,
    [id],
  );
  const r = rowsOf(cek)[0];
  return {
    data: {
      id: r.id,
      kode: r.kode,
      nama: r.nama,
      tahap: r.tahap,
      tanggalMulai: r.tanggal_mulai,
      jumlahMinggu: Number(r.jumlah_minggu),
      faktorTarget: Number(r.faktor_target),
    },
  };
}

async function listPendamping(database, operator) {
  requireProvinsi(operator);
  const res = await database.raw(
    `SELECT u.id, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS nama, u.email
     FROM directus_users u
     WHERE u.app_role = ? AND u.status = 'active' ORDER BY nama ASC`,
    ["pendamping"],
  );
  return {
    data: rowsOf(res).map((r) => ({
      id: r.id,
      nama: (r.nama || "").trim() || r.email,
      email: r.email,
    })),
  };
}

async function listPeserta(database, query = {}, operator) {
  requireDataRole(operator);
  const where = [`t.status = ANY(?)`];
  const params = [STATUS_PESERTA];
  if (operator.role === "kabkota") {
    where.push(`t.kota = ?`);
    params.push(operator.kotaId);
  }
  const res = await database.raw(
    `SELECT t.id AS talenta_id, u.id AS usaha_id, u.nama AS usaha_nama,
            t.kota AS kota_id, ko.nama AS kota_nama, t.status,
            t.batch, b.nama AS batch_nama, b.tahap AS batch_tahap,
            to_char(b.tanggal_mulai,'YYYY-MM-DD') AS batch_tanggal_mulai,
            b.jumlah_minggu AS batch_jumlah_minggu, b.faktor_target AS batch_faktor,
            t.pendamping, TRIM(COALESCE(pg.first_name,'') || ' ' || COALESCE(pg.last_name,'')) AS pendamping_nama,
            u.omzet_tahunan, t.target_mingguan_override, t.rekomendasi_pitching,
            l.minggu_ke AS lap_minggu, l.status AS lap_status
     FROM talenta t
     JOIN usaha u ON u.id = t.usaha
     LEFT JOIN kota ko ON ko.id = t.kota
     LEFT JOIN program_batch b ON b.id = t.batch
     LEFT JOIN directus_users pg ON pg.id = t.pendamping
     LEFT JOIN LATERAL (
       SELECT minggu_ke, status FROM talenta_laporan_mingguan
       WHERE talenta = t.id ORDER BY minggu_ke DESC LIMIT 1
     ) l ON true
     WHERE ${where.join(" AND ")}
     ORDER BY u.nama ASC`,
    params,
  );
  const now = new Date();
  return {
    data: rowsOf(res).map((r) => {
      const tanggalMulai = r.batch_tanggal_mulai ?? null;
      const jumlahMinggu = r.batch_jumlah_minggu == null ? null : Number(r.batch_jumlah_minggu);
      const berjalan = tanggalMulai && jumlahMinggu ? Math.min(mingguKe(tanggalMulai, now), jumlahMinggu) : 0;
      const target =
        r.target_mingguan_override !== null && r.target_mingguan_override !== undefined
          ? Number(r.target_mingguan_override)
          : targetMingguan(
              r.omzet_tahunan == null ? null : Number(r.omzet_tahunan),
              r.batch_faktor == null ? 1.2 : Number(r.batch_faktor),
              null,
            );
      return {
        talentaId: r.talenta_id,
        usaha: { id: r.usaha_id, nama: r.usaha_nama },
        kota: r.kota_nama ?? null,
        status: r.status,
        batch: r.batch ? { id: r.batch, nama: r.batch_nama, tahap: r.batch_tahap } : null,
        pendamping: r.pendamping ? { id: r.pendamping, nama: (r.pendamping_nama || "").trim() || null } : null,
        mingguBerjalan: berjalan,
        jumlahMinggu,
        targetMingguan: target,
        rekomendasiPitching: Boolean(r.rekomendasi_pitching),
        laporanTerakhir: r.lap_minggu == null ? null : { mingguKe: Number(r.lap_minggu), status: r.lap_status },
      };
    }),
  };
}

async function muatTalenta(database, talentaId) {
  if (!UUID_PATTERN.test(String(talentaId || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Talenta tidak ditemukan.");
  }
  const res = await database.raw(`SELECT * FROM talenta WHERE id = ? LIMIT 1`, [talentaId]);
  const row = rowsOf(res)[0];
  if (!row) throw new OperasionalError(404, "NOT_FOUND", "Talenta tidak ditemukan.");
  return row;
}

async function assertBatch(database, batchId, tahapWajib = null) {
  if (!UUID_PATTERN.test(String(batchId || ""))) {
    throw validationFailed({ batchId: "Batch tidak valid" });
  }
  const res = await database.raw(`SELECT id, tahap FROM program_batch WHERE id = ? LIMIT 1`, [batchId]);
  const row = rowsOf(res)[0];
  if (!row) throw validationFailed({ batchId: "Batch tidak ditemukan" });
  if (tahapWajib && row.tahap !== tahapWajib) {
    throw validationFailed({ batchId: `Batch harus tahap ${tahapWajib}` });
  }
  return row;
}

async function assertPendampingAktif(database, pendampingId) {
  if (!UUID_PATTERN.test(String(pendampingId || ""))) {
    throw validationFailed({ pendampingId: "Pendamping tidak valid" });
  }
  const res = await database.raw(
    `SELECT id FROM directus_users WHERE id = ? AND app_role = ? AND status = 'active' LIMIT 1`,
    [pendampingId, "pendamping"],
  );
  if (!rowsOf(res)[0]) throw validationFailed({ pendampingId: "Pendamping tidak aktif" });
}

function parseOverride(value) {
  if (value === undefined) return { ada: false, nilai: null };
  if (value === null) return { ada: true, nilai: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000_000) {
    throw validationFailed({ targetMingguanOverride: "Override 0–1.000.000.000.000" });
  }
  return { ada: true, nilai: n };
}

async function ubahTahap(database, talentaId, body = {}, operator) {
  requireProvinsi(operator);
  const tahap = body.tahap;
  if (!["talent_lab", "accelerator", "champion"].includes(tahap)) {
    throw validationFailed({ tahap: "Tahap tidak dikenal" });
  }
  const row = await muatTalenta(database, talentaId);
  const dari = row.status;
  const run = async (trx) => {
    if (dari === "scouting" && tahap === "talent_lab") {
      let batchId = row.batch;
      if (body.batchId !== undefined && body.batchId !== null) {
        await assertBatch(trx, body.batchId, "talent_lab");
        batchId = body.batchId;
      }
      await trx.raw(`UPDATE talenta SET status = 'talent_lab', batch = ?, date_updated = NOW() WHERE id = ?`, [
        batchId,
        talentaId,
      ]);
      return;
    }
    if (dari === "talent_lab" && tahap === "accelerator") {
      if (!body.batchId) throw validationFailed({ batchId: "Batch accelerator wajib" });
      if (!body.pendampingId) throw validationFailed({ pendampingId: "Pendamping wajib" });
      await assertBatch(trx, body.batchId, "accelerator");
      await assertPendampingAktif(trx, body.pendampingId);
      const ov = parseOverride(body.targetMingguanOverride);
      await trx.raw(
        `UPDATE talenta SET status = 'accelerator', batch = ?, pendamping = ?, target_mingguan_override = ?, date_updated = NOW() WHERE id = ?`,
        [body.batchId, body.pendampingId, ov.ada ? ov.nilai : row.target_mingguan_override, talentaId],
      );
      return;
    }
    if (dari === "accelerator" && tahap === "champion") {
      if (row.rekomendasi_pitching !== true) {
        throw new OperasionalError(409, "REKOMENDASI_DIPERLUKAN", "Rekomendasi pitching diperlukan sebelum Champion.");
      }
      await trx.raw(`UPDATE talenta SET status = 'champion', date_updated = NOW() WHERE id = ?`, [talentaId]);
      return;
    }
    throw new OperasionalError(409, "INVALID_TRANSITION", `Transisi ${dari} → ${tahap} tidak diizinkan.`);
  };
  if (typeof database.transaction === "function") await database.transaction(run);
  else await run(database);
  const sesudah = await muatTalenta(database, talentaId);
  return { data: { id: sesudah.id, status: sesudah.status, batch: sesudah.batch, pendamping: sesudah.pendamping } };
}

async function ubahProgram(database, talentaId, body = {}, operator) {
  requireProvinsi(operator);
  const row = await muatTalenta(database, talentaId);
  if (row.status !== "accelerator") {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Hanya peserta accelerator yang dapat diubah.");
  }
  if (body.pendampingId === undefined && body.targetMingguanOverride === undefined) {
    throw validationFailed({ pendampingId: "Minimal satu field diubah" });
  }
  const run = async (trx) => {
    let pendamping = row.pendamping;
    if (body.pendampingId !== undefined) {
      if (body.pendampingId === null) pendamping = null;
      else {
        await assertPendampingAktif(trx, body.pendampingId);
        pendamping = body.pendampingId;
      }
    }
    let override = row.target_mingguan_override;
    if (body.targetMingguanOverride !== undefined) {
      override = parseOverride(body.targetMingguanOverride).nilai;
    }
    await trx.raw(
      `UPDATE talenta SET pendamping = ?, target_mingguan_override = ?, date_updated = NOW() WHERE id = ?`,
      [pendamping, override, talentaId],
    );
  };
  if (typeof database.transaction === "function") await database.transaction(run);
  else await run(database);
  const sesudah = await muatTalenta(database, talentaId);
  return {
    data: { id: sesudah.id, pendamping: sesudah.pendamping, targetMingguanOverride: sesudah.target_mingguan_override },
  };
}

async function getUsahaSaya(database, operator, now = new Date()) {
  requireUmkm(operator);
  const t = await talentaAktifUntukUsaha(database, operator.usahaId);
  if (!t) {
    const uRes = await database.raw(
      `SELECT u.id, u.nama, u.nib, u.skala, u.omzet_tahunan, pu.nama_lengkap AS pemilik_nama
       FROM usaha u LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE u.id = ? LIMIT 1`,
      [operator.usahaId],
    );
    const u = rowsOf(uRes)[0] ?? {};
    return {
      data: {
        usaha: {
          id: operator.usahaId,
          nama: u.nama ?? operator.usahaNama,
          nib: u.nib ?? operator.usahaNib ?? null,
          kota: null,
          skala: u.skala ?? null,
          omzetTahunan: u.omzet_tahunan == null ? null : Number(u.omzet_tahunan),
        },
        pemilik: { nama: u.pemilik_nama ?? null },
        talenta: null,
      },
    };
  }
  const jumlahMinggu = t.batch_jumlah_minggu == null ? null : Number(t.batch_jumlah_minggu);
  const tanggalMulai = t.batch_tanggal_mulai ?? null;
  const mingguBerjalan =
    tanggalMulai && jumlahMinggu ? Math.min(mingguKe(tanggalMulai, now), jumlahMinggu) : 0;
  const target = targetMingguan(
    t.usaha_omzet == null ? null : Number(t.usaha_omzet),
    t.batch_faktor_target == null ? 1.2 : Number(t.batch_faktor_target),
    t.target_mingguan_override == null ? null : Number(t.target_mingguan_override),
  );
  let laporanMingguIni = null;
  if (t.batch && mingguBerjalan >= 1) {
    const lRes = await database.raw(
      `SELECT id, status FROM talenta_laporan_mingguan WHERE talenta = ? AND minggu_ke = ? LIMIT 1`,
      [t.id, mingguBerjalan],
    );
    const l = rowsOf(lRes)[0];
    if (l) laporanMingguIni = { id: l.id, status: l.status };
  }
  return {
    data: {
      usaha: {
        id: operator.usahaId,
        nama: t.usaha_nama,
        nib: t.usaha_nib ?? null,
        kota: null,
        skala: t.usaha_skala ?? null,
        omzetTahunan: t.usaha_omzet == null ? null : Number(t.usaha_omzet),
      },
      pemilik: { nama: t.pemilik_nama ?? null },
      talenta: {
        id: t.id,
        status: t.status,
        batch: t.batch
          ? {
              id: t.batch,
              kode: t.batch_kode,
              nama: t.batch_nama,
              tahap: t.batch_tahap,
              tanggalMulai,
              jumlahMinggu,
            }
          : null,
        pendamping:
          t.pendamping != null
            ? {
                id: t.pendamping,
                nama: [t.pendamping_fn, t.pendamping_ln].filter(Boolean).join(" ").trim() || t.pendamping_email,
              }
            : null,
        mingguBerjalan,
        targetMingguan: target,
        laporanMingguIni,
      },
    },
  };
}

async function listLaporanSaya(database, operator) {
  requireUmkm(operator);
  const t = await talentaAktifUntukUsaha(database, operator.usahaId);
  if (!t) return { data: [] };
  const res = await database.raw(
    `SELECT id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
            catatan_pendamping, dikirim_pada, diverifikasi_pada
     FROM talenta_laporan_mingguan WHERE talenta = ? ORDER BY minggu_ke DESC`,
    [t.id],
  );
  return {
    data: rowsOf(res).map((r) => ({
      id: r.id,
      mingguKe: Number(r.minggu_ke),
      omzet: Number(r.omzet),
      jumlahTransaksi: Number(r.jumlah_transaksi),
      target: r.target == null ? null : Number(r.target),
      status: r.status,
      catatanPendamping: r.catatan_pendamping ?? null,
      dikirimPada: r.dikirim_pada ? new Date(r.dikirim_pada).toISOString() : null,
      diverifikasiPada: r.diverifikasi_pada ? new Date(r.diverifikasi_pada).toISOString() : null,
      bukti: r.bukti ? { id: r.bukti } : null,
    })),
  };
}

function mapLaporanRow(r) {
  return {
    id: r.id,
    mingguKe: Number(r.minggu_ke),
    omzet: Number(r.omzet),
    jumlahTransaksi: Number(r.jumlah_transaksi),
    target: r.target == null ? null : Number(r.target),
    status: r.status,
    catatanPendamping: r.catatan_pendamping ?? null,
    dikirimPada: r.dikirim_pada ? new Date(r.dikirim_pada).toISOString() : null,
    diverifikasiPada: r.diverifikasi_pada ? new Date(r.diverifikasi_pada).toISOString() : null,
    bukti: r.bukti ? { id: r.bukti } : null,
    provenance: r.provenance ?? null,
  };
}

async function kirimLaporan(database, body = {}, operator, now = new Date()) {
  requireUmkm(operator);
  const serverNow = now instanceof Date ? now : new Date(now);
  const fields = {};
  if (!UUID_PATTERN.test(String(body.clientUuid || ""))) fields.clientUuid = "Idempotency key UUID wajib";
  const mingguKeBody = Number(body.mingguKe);
  if (!Number.isInteger(mingguKeBody) || mingguKeBody < 1 || mingguKeBody > 52) {
    fields.mingguKe = "Minggu 1–52";
  }
  const omzet = Number(body.omzet);
  if (!Number.isInteger(omzet) || omzet < 0 || omzet > 1_000_000_000_000) {
    fields.omzet = "Omzet 0–1.000.000.000.000";
  }
  const jumlahTransaksi = Number(body.jumlahTransaksi);
  if (!Number.isInteger(jumlahTransaksi) || jumlahTransaksi < 0 || jumlahTransaksi > 1_000_000) {
    fields.jumlahTransaksi = "Jumlah transaksi 0–1.000.000";
  }
  if (!UUID_PATTERN.test(String(body.buktiFileId || ""))) fields.buktiFileId = "Bukti wajib";
  let catatan = body.catatanKendala ?? null;
  if (catatan !== null && catatan !== undefined) {
    if (typeof catatan !== "string" || catatan.length > 1000) fields.catatanKendala = "Maksimal 1000 karakter";
    else if (catatan.trim() === "") catatan = null;
  } else {
    catatan = null;
  }
  const dikirimPada = body.dikirimPada ? new Date(body.dikirimPada) : null;
  if (!dikirimPada || Number.isNaN(dikirimPada.getTime())) fields.dikirimPada = "Waktu kirim ISO wajib";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);

  const t = await talentaAktifUntukUsaha(database, operator.usahaId);
  if (!t || t.status !== "accelerator" || !t.batch) {
    throw new OperasionalError(409, "PROGRAM_BELUM_AKTIF", "Usaha belum terdaftar pada Program Akselerasi Accelerator.");
  }
  const tanggalMulai = t.batch_tanggal_mulai;
  const jumlahMinggu = Number(t.batch_jumlah_minggu);
  if (!tanggalMulai || !Number.isFinite(jumlahMinggu)) {
    throw new OperasionalError(409, "PROGRAM_BELUM_AKTIF", "Batch belum dikonfigurasi.");
  }

  // 1) Idempoten: client_uuid sama untuk talenta ini → kembalikan baris itu.
  const idem = await database.raw(
    `SELECT id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
            catatan_pendamping, dikirim_pada, diverifikasi_pada, provenance
     FROM talenta_laporan_mingguan WHERE talenta = ? AND client_uuid = ? LIMIT 1`,
    [t.id, String(body.clientUuid)],
  );
  if (rowsOf(idem)[0]) return { data: mapLaporanRow(rowsOf(idem)[0]), meta: { idempoten: true } };

  // 2) Kontrak Jumat: waktu penciptaan harus Jumat WIB (online maupun replay).
  const klas = klasifikasiKirim({ serverNow, clientCreatedAt: dikirimPada });
  if (!klas.allowed) {
    if (klas.reason === "BUKAN_JUMAT") {
      throw new OperasionalError(
        422,
        "BUKAN_JUMAT",
        "Laporan hanya dapat dibuat pada hari Jumat (WIB). Laporan offline Jumat dapat disinkronkan setelah Jumat.",
      );
    }
    if (klas.reason === "WAKTU_MASA_DEPAN") {
      throw validationFailed({ dikirimPada: "Waktu kirim tidak boleh di masa depan" });
    }
    if (klas.reason === "REPLAY_KEDALUWARSA") {
      throw new OperasionalError(422, "REPLAY_KEDALUWARSA", "Sinkronisasi offline Jumat kedaluwarsa (maks 7 hari).");
    }
    throw validationFailed({ dikirimPada: "Waktu kirim tidak valid" });
  }

  // 3) Minggu harus cocok dengan minggu penciptaan + dalam batas program/server.
  const mingguKlien = mingguKe(tanggalMulai, dikirimPada);
  if (mingguKlien !== mingguKeBody) {
    throw validationFailed({ mingguKe: "Minggu tidak cocok dengan tanggal kirim (WIB)" });
  }
  const mingguServer = mingguKe(tanggalMulai, serverNow);
  const batas = Math.min(jumlahMinggu, Math.max(mingguServer, 0));
  if (mingguKeBody < 1 || mingguKeBody > jumlahMinggu || mingguKeBody > Math.max(batas, 0)) {
    throw validationFailed({ mingguKe: "Minggu di luar program berjalan" });
  }
  // Batas bawah tanggal mulai 00:00 WIB.
  const mulai00 = new Date(`${tanggalMulai}T00:00:00+07:00`);
  if (dikirimPada.getTime() < mulai00.getTime() - 5 * 60 * 1000) {
    throw validationFailed({ dikirimPada: "Waktu kirim sebelum program mulai" });
  }

  await assertBerkasMilik(database, String(body.buktiFileId), operator);

  const target = targetMingguan(
    t.usaha_omzet == null ? null : Number(t.usaha_omzet),
    t.batch_faktor_target == null ? 1.2 : Number(t.batch_faktor_target),
    t.target_mingguan_override == null ? null : Number(t.target_mingguan_override),
  );

  const run = async (trx) => {
    const ada = await trx.raw(
      `SELECT id, status FROM talenta_laporan_mingguan WHERE talenta = ? AND minggu_ke = ? LIMIT 1`,
      [t.id, mingguKeBody],
    );
    const existing = rowsOf(ada)[0];
    if (existing) {
      if (existing.status === "ditolak") {
        const upd = await trx.raw(
          `UPDATE talenta_laporan_mingguan
           SET omzet = ?, jumlah_transaksi = ?, target = ?, bukti = ?, catatan_kendala = ?,
               status = 'menunggu', catatan_pendamping = NULL, diverifikasi_oleh = NULL,
               diverifikasi_pada = NULL, client_uuid = ?, dikirim_pada = ?::timestamptz,
               provenance = ?, date_updated = NOW()
           WHERE id = ?
           RETURNING id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
                     catatan_pendamping, dikirim_pada, diverifikasi_pada, provenance`,
          [
            omzet,
            jumlahTransaksi,
            target,
            String(body.buktiFileId),
            catatan,
            String(body.clientUuid),
            dikirimPada.toISOString(),
            klas.provenance,
            existing.id,
          ],
        );
        return { row: rowsOf(upd)[0], created: false };
      }
      throw new OperasionalError(409, "WEEK_ALREADY_REPORTED", "Laporan minggu ini sudah dikirim.");
    }
    const ins = await trx.raw(
      `INSERT INTO talenta_laporan_mingguan
         (talenta, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala,
          status, client_uuid, dikirim_pada, provenance)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?::timestamptz, ?)
       RETURNING id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
                 catatan_pendamping, dikirim_pada, diverifikasi_pada, provenance`,
      [
        t.id,
        mingguKeBody,
        omzet,
        jumlahTransaksi,
        target,
        String(body.buktiFileId),
        catatan,
        String(body.clientUuid),
        dikirimPada.toISOString(),
        klas.provenance,
      ],
    );
    return { row: rowsOf(ins)[0], created: true };
  };

  let out;
  try {
    if (typeof database.transaction === "function") out = await database.transaction(run);
    else out = await run(database);
  } catch (error) {
    if (String(error?.code) === "23505") {
      // Balapan client_uuid / unique (talenta, minggu_ke): baca ulang sebagai idempoten.
      const again = await database.raw(
        `SELECT id, minggu_ke, omzet, jumlah_transaksi, target, bukti, catatan_kendala, status,
                catatan_pendamping, dikirim_pada, diverifikasi_pada, provenance
         FROM talenta_laporan_mingguan WHERE talenta = ? AND client_uuid = ? LIMIT 1`,
        [t.id, String(body.clientUuid)],
      );
      if (rowsOf(again)[0]) return { data: mapLaporanRow(rowsOf(again)[0]), meta: { idempoten: true } };
      throw new OperasionalError(409, "WEEK_ALREADY_REPORTED", "Laporan minggu ini sudah dikirim.");
    }
    throw error;
  }
  void isJumatJakarta;
  void tanggalJakarta;
  return { data: mapLaporanRow(out.row), meta: { idempoten: false } };
}

module.exports = {
  listBatch,
  createBatch,
  listPendamping,
  listPeserta,
  ubahTahap,
  ubahProgram,
  getUsahaSaya,
  listLaporanSaya,
  kirimLaporan,
};
