"use strict";

const { maskNik } = require("../../../analytics-shared/privacy.cjs");
const { OperasionalError, validationFailed } = require("./errors.js");
const { hitungTalentIndex, RUBRIK_VERSI } = require("./talent-index.js");
const { assertUsahaAccess } = require("./usaha-service.js");
const { assertBerkasMilik } = require("./berkas-service.js");

const TALENTA_STATUS = ["diajukan", "dinilai", "scouting", "talent_lab", "accelerator", "champion", "ditolak"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowsOf = (result) => result?.rows ?? result?.[0] ?? result ?? [];

function requireDataRole(operator) {
  if (!operator || !["provinsi", "kabkota"].includes(operator.role)) {
    throw new OperasionalError(403, "FORBIDDEN", "Akses ditolak.");
  }
}

function requireProvinsi(operator) {
  if (!operator || operator.role !== "provinsi") {
    throw new OperasionalError(403, "FORBIDDEN", "Hanya admin provinsi.");
  }
}

function jakartaDateString(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validateTalentaForm(form = {}) {
  const fields = {};
  const clean = {};
  const kap = Number(form.kapasitasProduksiBulanan);
  if (!Number.isFinite(kap) || kap < 0 || kap > 1_000_000_000) {
    fields.kapasitasProduksiBulanan = "Kapasitas 0 sampai 1.000.000.000";
  } else {
    clean.kapasitasProduksiBulanan = kap;
  }
  if (!["unit", "kg"].includes(form.satuanKapasitas)) {
    fields.satuanKapasitas = "Satuan harus unit atau kg";
  } else {
    clean.satuanKapasitas = form.satuanKapasitas;
  }
  for (const key of ["kesiapanHalal", "kesiapanPirtBpom", "kesiapanHki", "adopsiQris", "pencatatanKeuanganDigital"]) {
    if (typeof form[key] !== "boolean") fields[key] = "Nilai harus Ya/Tidak";
    else clean[key] = form[key];
  }
  if (form.suratKomitmenFileId !== undefined && form.suratKomitmenFileId !== null) {
    if (!UUID_PATTERN.test(String(form.suratKomitmenFileId))) {
      fields.suratKomitmenFileId = "Berkas tidak valid";
    } else {
      clean.suratKomitmenFileId = String(form.suratKomitmenFileId);
    }
  } else {
    clean.suratKomitmenFileId = null;
  }
  return { fields, clean };
}

async function loadSkorInput(database, usahaId) {
  const uRes = await database.raw(
    `SELECT u.id, u.nama, u.nib, u.omzet_tahunan,
            a.alamat_jalan, kl.nama AS kelurahan_nama, kc.nama AS kecamatan_nama, ko.nama AS kota_nama,
            pu.nik AS pelaku_nik
     FROM usaha u
     LEFT JOIN alamat a ON a.id = u.alamat
     LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
     LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
     LEFT JOIN kota ko ON ko.id = kc.kota
     LEFT JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha
     WHERE u.id = ? LIMIT 1`,
    [usahaId],
  );
  const u = rowsOf(uRes)[0] ?? {};
  const tkRes = await database.raw(
    `SELECT COALESCE(dibayar_laki_laki,0)+COALESCE(dibayar_perempuan,0)+COALESCE(disabilitas_dibayar_laki_laki,0)+COALESCE(disabilitas_dibayar_perempuan,0)+COALESCE(tidak_dibayar_laki_laki,0)+COALESCE(tidak_dibayar_perempuan,0)+COALESCE(disabilitas_tidak_dibayar_laki_laki,0)+COALESCE(disabilitas_tidak_dibayar_perempuan,0) AS total
     FROM statistik_tenaga_kerja WHERE usaha = ? LIMIT 1`,
    [usahaId],
  );
  const totalTenagaKerja = Number(rowsOf(tkRes)[0]?.total ?? 0);
  const atRes = await database.raw(
    `SELECT npwp_usaha, sertifikat_halal, pirt_bpom, hki_merek, rekening_terpisah, sop_tertulis, ecommerce, medsos_bisnis, akses_kur
     FROM usaha_atribut_jabar WHERE usaha = ? LIMIT 1`,
    [usahaId],
  );
  const at = rowsOf(atRes)[0] ?? {};
  return { usaha: u, totalTenagaKerja, atribut: at };
}

function skorDariInput(loaded, form) {
  return hitungTalentIndex({
    omzetTahunan: loaded.usaha.omzet_tahunan == null ? null : Number(loaded.usaha.omzet_tahunan),
    nibAda: Boolean(loaded.usaha.nib),
    totalTenagaKerja: loaded.totalTenagaKerja,
    atribut: {
      npwp_usaha: loaded.atribut.npwp_usaha,
      sertifikat_halal: loaded.atribut.sertifikat_halal,
      pirt_bpom: loaded.atribut.pirt_bpom,
      hki_merek: loaded.atribut.hki_merek,
      rekening_terpisah: loaded.atribut.rekening_terpisah,
      sop_tertulis: loaded.atribut.sop_tertulis,
      ecommerce: loaded.atribut.ecommerce,
      medsos_bisnis: loaded.atribut.medsos_bisnis,
      akses_kur: loaded.atribut.akses_kur,
    },
    form: {
      kapasitasProduksiBulanan: form.kapasitasProduksiBulanan,
      kesiapanHalal: form.kesiapanHalal,
      kesiapanPirtBpom: form.kesiapanPirtBpom,
      kesiapanHki: form.kesiapanHki,
      adopsiQris: form.adopsiQris,
      pencatatanKeuanganDigital: form.pencatatanKeuanganDigital,
      suratKomitmenAda: Boolean(form.suratKomitmenFileId),
    },
  });
}

async function talentaAktif(database, usahaId) {
  const res = await database.raw(
    `SELECT id, status FROM talenta WHERE usaha = ? AND status <> 'ditolak' LIMIT 1`,
    [usahaId],
  );
  const row = rowsOf(res)[0];
  return row ? { id: row.id, status: row.status } : null;
}

async function getPrefill(database, usahaId, operator) {
  requireDataRole(operator);
  const akses = await assertUsahaAccess(database, usahaId, operator);
  const loaded = await loadSkorInput(database, usahaId);
  const u = loaded.usaha;
  const alamat = [u.alamat_jalan, u.kelurahan_nama, u.kecamatan_nama, u.kota_nama]
    .filter(Boolean)
    .join(", ");
  const aktif = await talentaAktif(database, usahaId);
  return {
    data: {
      usaha: {
        id: akses.id,
        nama: u.nama ?? akses.nama,
        nib: u.nib ?? null,
        nikTersamar: maskNik(u.pelaku_nik),
        omzetTahunan: u.omzet_tahunan == null ? null : Number(u.omzet_tahunan),
        alamat: alamat || null,
        kota: u.kota_nama ?? akses.kotaNama,
      },
      talentaAktif: aktif,
    },
  };
}

async function hitungSkor(database, body = {}, operator) {
  requireDataRole(operator);
  const { fields, clean } = validateTalentaForm(body.form ?? {});
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  if (!UUID_PATTERN.test(String(body.usahaId || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Data usaha tidak ditemukan atau di luar wilayah Anda.");
  }
  await assertUsahaAccess(database, body.usahaId, operator);
  const loaded = await loadSkorInput(database, body.usahaId);
  return { data: skorDariInput(loaded, clean) };
}

function mapDetailRow(row) {
  return {
    id: row.id,
    usaha: { id: row.usaha, nama: row.usaha_nama ?? row.usaha },
    kota: { id: row.kota, nama: row.kota_nama ?? null },
    status: row.status,
    form: {
      kapasitasProduksiBulanan: Number(row.kapasitas_produksi_bulanan),
      satuanKapasitas: row.satuan_kapasitas,
      kesiapanHalal: Boolean(row.kesiapan_halal),
      kesiapanPirtBpom: Boolean(row.kesiapan_pirt_bpom),
      kesiapanHki: Boolean(row.kesiapan_hki),
      adopsiQris: Boolean(row.adopsi_qris),
      pencatatanKeuanganDigital: Boolean(row.pencatatan_keuangan_digital),
    },
    skor: {
      finansial: Number(row.skor_finansial),
      pasar: Number(row.skor_pasar),
      legalitas: Number(row.skor_legalitas),
      sdm: Number(row.skor_sdm),
      total: Number(row.skor_total),
    },
    rubrikVersi: Number(row.rubrik_versi ?? RUBRIK_VERSI),
    rekomendasi: row.rekomendasi,
    suratKomitmen: row.surat_komitmen
      ? { id: row.surat_komitmen, nama: row.surat_nama ?? "Surat komitmen" }
      : null,
    diajukanOleh: row.diajukan_oleh ?? null,
    diajukanPada: row.date_created ? new Date(row.date_created).toISOString() : null,
    dinominasikanOleh: row.dinominasikan_oleh ?? null,
    dinominasikanPada: row.dinominasikan_pada ? new Date(row.dinominasikan_pada).toISOString() : null,
    alasanPenolakan: row.alasan_penolakan ?? null,
    beritaAcara: row.berita_acara ? { id: row.berita_acara, nomor: row.ba_nomor ?? null } : null,
  };
}

const DETAIL_SELECT = `
  t.*, ko.nama AS kota_nama, u.nama AS usaha_nama,
  ba.nomor AS ba_nomor, f.filename_download AS surat_nama
  FROM talenta t
  LEFT JOIN kota ko ON ko.id = t.kota
  LEFT JOIN usaha u ON u.id = t.usaha
  LEFT JOIN talenta_berita_acara ba ON ba.id = t.berita_acara
  LEFT JOIN directus_files f ON f.id = t.surat_komitmen`;

async function assertTalentaAccess(database, id, operator) {
  requireDataRole(operator);
  if (!UUID_PATTERN.test(String(id || ""))) {
    throw new OperasionalError(404, "NOT_FOUND", "Talenta tidak ditemukan.");
  }
  const res = await database.raw(`SELECT ${DETAIL_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  const row = rowsOf(res)[0];
  if (!row) throw new OperasionalError(404, "NOT_FOUND", "Talenta tidak ditemukan.");
  if (operator.role === "kabkota" && Number(row.kota) !== Number(operator.kotaId)) {
    throw new OperasionalError(404, "NOT_FOUND", "Talenta tidak ditemukan.");
  }
  return row;
}

async function ajukan(database, body = {}, operator) {
  requireDataRole(operator);
  const { fields, clean } = validateTalentaForm(body.form ?? {});
  if (!UUID_PATTERN.test(String(body.usahaId || ""))) fields.usahaId = "Usaha tidak valid";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  const akses = await assertUsahaAccess(database, body.usahaId, operator);
  if (clean.suratKomitmenFileId) {
    await assertBerkasMilik(database, clean.suratKomitmenFileId, operator);
  }
  const aktif = await talentaAktif(database, body.usahaId);
  if (aktif) throw new OperasionalError(409, "TALENTA_SUDAH_ADA", "Usaha ini sudah memiliki pengajuan talenta aktif.");
  const loaded = await loadSkorInput(database, body.usahaId);
  const skor = skorDariInput(loaded, clean);
  const run = async (trx) => {
    const ins = await trx.raw(
      `INSERT INTO talenta (usaha, kota, status, kapasitas_produksi_bulanan, satuan_kapasitas,
        kesiapan_halal, kesiapan_pirt_bpom, kesiapan_hki, adopsi_qris, pencatatan_keuangan_digital,
        surat_komitmen, skor_finansial, skor_pasar, skor_legalitas, skor_sdm, skor_total,
        rubrik_versi, rekomendasi, diajukan_oleh)
       VALUES (?, ?, 'diajukan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        body.usahaId, akses.kotaId, clean.kapasitasProduksiBulanan, clean.satuanKapasitas,
        clean.kesiapanHalal, clean.kesiapanPirtBpom, clean.kesiapanHki,
        clean.adopsiQris, clean.pencatatanKeuanganDigital, clean.suratKomitmenFileId,
        skor.finansial, skor.pasar, skor.legalitas, skor.sdm, skor.total,
        skor.rubrikVersi, skor.rekomendasi, operator.userId,
      ],
    );
    return rowsOf(ins)[0]?.id;
  };
  let id;
  if (typeof database.transaction === "function") {
    id = await database.transaction(run);
  } else {
    id = await run(database);
  }
  const row = await assertTalentaAccess(database, id, operator);
  return { data: { ...mapDetailRow(row), riwayat: [{ tahap: "diajukan", oleh: operator.userId, pada: new Date().toISOString() }] } };
}

async function listTalenta(database, query = {}, operator) {
  requireDataRole(operator);
  const status = query.status;
  if (status !== undefined && !TALENTA_STATUS.includes(status)) {
    throw validationFailed({ status: "Status tidak dikenal" });
  }
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? query.page_size ?? 25);
  if (!Number.isInteger(page) || page < 1) throw validationFailed({ page: "Halaman minimal 1" });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationFailed({ pageSize: "Ukuran halaman 1–100" });
  }
  const where = [];
  const params = [];
  if (status) {
    where.push(`t.status = ?`);
    params.push(status);
  }
  if (operator.role === "kabkota") {
    where.push(`t.kota = ?`);
    params.push(operator.kotaId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRes = await database.raw(`SELECT COUNT(*)::integer AS total FROM talenta t ${whereSql}`, params);
  const total = Number(rowsOf(countRes)[0]?.total ?? 0);
  const listRes = await database.raw(
    `SELECT t.id, t.usaha, u.nama AS usaha_nama, t.kota, ko.nama AS kota_nama, t.status,
            t.skor_total, t.rekomendasi, t.date_created, t.berita_acara, ba.nomor AS ba_nomor
     FROM talenta t
     LEFT JOIN usaha u ON u.id = t.usaha
     LEFT JOIN kota ko ON ko.id = t.kota
     LEFT JOIN talenta_berita_acara ba ON ba.id = t.berita_acara
     ${whereSql} ORDER BY t.date_created DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    data: rowsOf(listRes).map((r) => ({
      id: r.id,
      usaha: { id: r.usaha, nama: r.usaha_nama ?? r.usaha },
      kota: { id: r.kota, nama: r.kota_nama ?? null },
      status: r.status,
      skorTotal: Number(r.skor_total),
      rekomendasi: r.rekomendasi,
      diajukanPada: r.date_created ? new Date(r.date_created).toISOString() : null,
      beritaAcara: r.berita_acara ? { id: r.berita_acara, nomor: r.ba_nomor ?? null } : null,
    })),
    meta: { total, page, pageSize },
  };
}

async function getTalenta(database, id, operator) {
  const row = await assertTalentaAccess(database, id, operator);
  const riwayat = [];
  riwayat.push({ tahap: "diajukan", oleh: row.diajukan_oleh ?? null, pada: row.date_created ? new Date(row.date_created).toISOString() : null });
  if (row.dinominasikan_pada) {
    riwayat.push({ tahap: "dinilai", oleh: row.dinominasikan_oleh ?? null, pada: new Date(row.dinominasikan_pada).toISOString() });
  }
  if (row.status === "ditolak") {
    riwayat.push({ tahap: "ditolak", oleh: row.ditolak_oleh ?? null, pada: row.ditolak_pada ? new Date(row.ditolak_pada).toISOString() : null });
  }
  if (row.status === "scouting") {
    riwayat.push({ tahap: "scouting", oleh: row.dinominasikan_oleh ?? null, pada: row.dinominasikan_pada ? new Date(row.dinominasikan_pada).toISOString() : null });
  }
  return {
    data: {
      ...mapDetailRow(row),
      riwayat,
      beritaAcara: row.berita_acara
        ? { id: row.berita_acara, nomor: row.ba_nomor ?? null }
        : null,
    },
  };
}

async function nominasi(database, id, operator) {
  requireProvinsi(operator);
  const row = await assertTalentaAccess(database, id, operator);
  if (row.status !== "diajukan") {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Hanya status diajukan yang dapat dinominasikan.");
  }
  const run = async (trx) => {
    await trx.raw(
      `UPDATE talenta SET status = 'dinilai', dinominasikan_oleh = ?, dinominasikan_pada = NOW(), date_updated = NOW() WHERE id = ?`,
      [operator.userId, id],
    );
  };
  if (typeof database.transaction === "function") await database.transaction(run);
  else await run(database);
  return getTalenta(database, id, operator);
}

async function tolak(database, id, body = {}, operator) {
  requireProvinsi(operator);
  const alasan = typeof body.alasan === "string" ? body.alasan.trim() : "";
  if (alasan.length < 5 || alasan.length > 1000) {
    throw validationFailed({ alasan: "Alasan 5–1000 karakter" });
  }
  const row = await assertTalentaAccess(database, id, operator);
  if (!["diajukan", "dinilai"].includes(row.status)) {
    throw new OperasionalError(409, "INVALID_TRANSITION", "Status tidak dapat ditolak.");
  }
  const run = async (trx) => {
    await trx.raw(
      `UPDATE talenta SET status = 'ditolak', alasan_penolakan = ?, ditolak_oleh = ?, ditolak_pada = NOW(), date_updated = NOW() WHERE id = ?`,
      [alasan, operator.userId, id],
    );
  };
  if (typeof database.transaction === "function") await database.transaction(run);
  else await run(database);
  return getTalenta(database, id, operator);
}

async function terbitkanBeritaAcara(database, body = {}, operator, now = new Date()) {
  requireProvinsi(operator);
  const ids = Array.isArray(body.talentaIds) ? [...new Set(body.talentaIds.map(String))] : [];
  if (ids.length < 1 || ids.length > 100 || ids.some((v) => !UUID_PATTERN.test(v))) {
    throw validationFailed({ talentaIds: "Daftar talenta 1–100 UUID unik" });
  }
  const catatan = body.catatan ?? null;
  if (catatan !== null && (typeof catatan !== "string" || catatan.length > 2000)) {
    throw validationFailed({ catatan: "Catatan maksimal 2000 karakter" });
  }
  const tanggal = jakartaDateString(now);
  const tahun = tanggal.slice(0, 4);
  const run = async (trx) => {
    await trx.raw(`LOCK TABLE talenta_berita_acara IN SHARE ROW EXCLUSIVE MODE`);
    const cek = await trx.raw(`SELECT id, status FROM talenta WHERE id = ANY(?)`, [ids]);
    const found = new Map(rowsOf(cek).map((r) => [String(r.id), r.status]));
    const invalid = ids.filter((v) => found.get(v) !== "dinilai");
    if (invalid.length > 0 || found.size !== ids.length) {
      const error = new OperasionalError(409, "INVALID_TRANSITION", "Hanya status dinilai yang dapat diterbitkan.");
      error.extensions = { code: "INVALID_TRANSITION", status: 409, ids: invalid };
      throw error;
    }
    const seqRes = await trx.raw(
      `SELECT COUNT(*)::integer AS n FROM talenta_berita_acara WHERE nomor LIKE ?`,
      [`BA-TS/${tahun}/%`],
    );
    const seq = Number(rowsOf(seqRes)[0]?.n ?? 0) + 1;
    const nomor = `BA-TS/${tahun}/${String(seq).padStart(4, "0")}`;
    const baRes = await trx.raw(
      `INSERT INTO talenta_berita_acara (nomor, tanggal, catatan, diterbitkan_oleh) VALUES (?, ?, ?, ?) RETURNING id`,
      [nomor, tanggal, catatan, operator.userId],
    );
    const baId = rowsOf(baRes)[0]?.id;
    await trx.raw(`UPDATE talenta SET status = 'scouting', berita_acara = ?, date_updated = NOW() WHERE id = ANY(?)`, [baId, ids]);
    return { id: baId, nomor, tanggal, jumlah: ids.length };
  };
  let out;
  if (typeof database.transaction === "function") out = await database.transaction(run);
  else out = await run(database);
  return { data: out };
}

async function listBeritaAcara(database, operator) {
  requireProvinsi(operator);
  const res = await database.raw(
    `SELECT ba.id, ba.nomor, to_char(ba.tanggal,'YYYY-MM-DD') AS tanggal, ba.catatan,
            ba.date_created, u.email AS penerbit_email,
            (SELECT COUNT(*)::integer FROM talenta t WHERE t.berita_acara = ba.id) AS jumlah
     FROM talenta_berita_acara ba
     LEFT JOIN directus_users u ON u.id = ba.diterbitkan_oleh
     ORDER BY ba.date_created DESC`,
  );
  return {
    data: rowsOf(res).map((r) => ({
      id: r.id,
      nomor: r.nomor,
      tanggal: r.tanggal,
      catatan: r.catatan ?? null,
      jumlahTalenta: Number(r.jumlah ?? 0),
      diterbitkanOleh: r.penerbit_email ?? null,
    })),
  };
}

module.exports = {
  TALENTA_STATUS,
  getPrefill,
  hitungSkor,
  ajukan,
  listTalenta,
  getTalenta,
  nominasi,
  tolak,
  terbitkanBeritaAcara,
  listBeritaAcara,
  jakartaDateString,
};
