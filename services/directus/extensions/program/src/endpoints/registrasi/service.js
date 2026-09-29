// Registration service (R03/N7-01...N7-02). Session-only prefill: never a NIK/NIB oracle.
import { requireCaptcha } from "../../lib/captcha.js";
import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { flag, objectBody, optionalText, uuidParam } from "../../lib/validate.js";
import { normalisasiTeleponSeluler } from "../../lib/validate.js";
import { hashPayload, sign, verify } from "../passport/signing.js";
import { hitungSkor, RUBRIK_VERSI } from "../talent/scoring.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { butuhPakta, cekEligibilitas, epassPayload, layakSertifikat, persenHadir, sertifikatKode } from "./rules.js";
import { renderXlsx } from "./xlsx.js";
const handle = (logger, res, fn) => fn().catch((error) => sendError(res, logger, error));
const iso = (v) => {
  if (v === null || v === undefined) return null;
  const t = v instanceof Date ? v : new Date(v);
  return Number.isFinite(t.getTime()) ? t.toISOString() : null;
};
const num = (v) => (v === null || v === undefined ? null : Number(v));
async function muatUsahaRingkas(database, usahaId) {
  const u = rows(await database.raw(`SELECT u.id, u.nama, u.nib, u.skala, t.kota_nama AS kota, t.kota_id FROM usaha u LEFT JOIN usaha_tabular t ON t.id = u.id WHERE u.id = ?`, [usahaId]))[0];
  if (!u) throw new ProgramError(404, "USAHA_NOT_FOUND", "The business was not found.");
  return { id: u.id, nama: u.nama, nib: u.nib, skala: u.skala, kota: u.kota, kotaId: u.kota_id };
}
/** kabkota may only touch registrations of businesses in its own city; other cities look like 404. */
async function cakupanUsaha(db, pemanggil, usahaId) {
  if (pemanggil?.admin || pemanggil?.peran !== "kabkota") return;
  if (pemanggil.kotaId == null) throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Wilayah belum ditetapkan.");
  const t = rows(await db.raw(`SELECT kota_id FROM usaha_tabular WHERE id = ?`, [usahaId]))[0];
  if (!t || Number(t.kota_id) !== Number(pemanggil.kotaId)) throw new ProgramError(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran tidak ditemukan.");
}
function toPendaftaran(row) {
  return { id: row.id, kegiatan: row.kegiatan, usaha: row.usaha, status: row.status, skorTalent: num(row.skor_talent), skorRubrik: row.skor_rubrik ?? null, administrasiLolos: Boolean(row.administrasi_lolos), alasan: row.alasan ?? null, epassToken: row.epass_token ?? null, tugasSelesai: Boolean(row.tugas_selesai), diputuskanPada: iso(row.diputuskan_pada), dateCreated: iso(row.date_created) };
}
export const prefillRegistrasi = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    if (!pemanggil?.usahaId) throw new ProgramError(403, "USAHA_BELUM_TERHUBUNG", "Akun belum terhubung ke usaha.");
    const full = await loadUsahaSummary(database, pemanggil.usahaId);
    const kontak = rows(await database.raw(`SELECT NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') AS nama, email FROM directus_users WHERE id = ?`, [pemanggil.id]))[0];
    let whatsapp = null;
    const w = rows(await database.raw(`SELECT nomor_whatsapp FROM usaha WHERE id = ?`, [pemanggil.usahaId]))[0];
    whatsapp = normalisasiTeleponSeluler(w?.nomor_whatsapp) ?? null;
    noStore(res);
    res.json({ data: { usaha: { id: full.id, nama: full.nama, skala: full.skala, kodeKbli: full.kodeKbli, kota: full.kota, sumber: "sidt" }, kontak: { nama: kontak?.nama ?? null, email: kontak?.email ?? null, whatsapp }, aksesibilitas: { butuhDisabilitas: false } } });
  });
export const daftarKegiatan = ({ database, logger, env }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const kegiatanId = uuidParam(req.params?.id, "INVALID_KEGIATAN_ID");
    const body = objectBody(req);
    if (!pemanggil?.usahaId) throw new ProgramError(403, "USAHA_BELUM_TERHUBUNG", "Akun belum terhubung ke usaha.");
    const butuhDisabilitas = flag(body, "butuhDisabilitas");
    const kebutuhan = body.kebutuhanAksesibilitas === undefined || body.kebutuhanAksesibilitas === null ? null : String(body.kebutuhanAksesibilitas).slice(0, 500);
    if (butuhDisabilitas && (!kebutuhan || !kebutuhan.trim())) throw new ProgramError(400, "AKSESIBILITAS_WAJIB", "Kebutuhan aksesibilitas wajib diisi.");
    if (body.consent !== true) throw new ProgramError(400, "CONSENT_WAJIB", "Persetujuan wajib dicentang.");
    const pakta = body.paktaIntegritas === true;
    await requireCaptcha(database, env, body.captcha);
    const dibuat = await database.transaction(async (trx) => {
      const locked = rows(await trx.raw(`SELECT id, judul, pendaftaran_internal, butuh_pakta_integritas, jumlah_sesi, butuh_tugas, kuota, terisi, syarat_skala, syarat_wilayah, syarat_nib, status_publikasi, batas_registrasi FROM kegiatan WHERE id = ? FOR UPDATE`, [kegiatanId]))[0];
      if (!locked) throw new ProgramError(404, "KEGIATAN_NOT_FOUND", "The event was not found.");
      if (!locked.pendaftaran_internal) throw new ProgramError(409, "PENDAFTARAN_EKSTERNAL", "Kegiatan memakai pendaftaran eksternal resmi.");
      if (locked.status_publikasi === "dibatalkan") throw new ProgramError(409, "KEGIATAN_DIBATALKAN", "Kegiatan dibatalkan.");
      if (locked.batas_registrasi && new Date(locked.batas_registrasi) < new Date()) throw new ProgramError(409, "PENDAFTARAN_DITUTUP", "Masa pendaftaran lewat.");
      butuhPakta(locked, pakta);
      const usaha = await muatUsahaRingkas(trx, pemanggil.usahaId);
      const elig = cekEligibilitas(locked, usaha);
      if (!elig.boleh) throw new ProgramError(422, "TIDAK_ELIGIBLE", "Usaha tidak memenuhi syarat: " + elig.alasan);
      const ada = rows(await trx.raw(`SELECT id, status FROM kegiatan_pendaftaran WHERE kegiatan = ? AND usaha = ? AND status IN ('menunggu','diterima','daftar_tunggu')`, [kegiatanId, pemanggil.usahaId]))[0];
      if (ada) throw new ProgramError(409, "SUDAH_TERDAFTAR", "Usaha sudah terdaftar aktif.");
      let diterima = 0;
      if (locked.kuota !== null && locked.kuota !== undefined) {
        const hit = rows(await trx.raw(`SELECT COUNT(*)::integer AS n FROM kegiatan_pendaftaran WHERE kegiatan = ? AND status IN ('menunggu','diterima')`, [kegiatanId]))[0];
        diterima = Number(hit?.n ?? 0);
      }
      let status = "menunggu";
      if (locked.kuota !== null && locked.kuota !== undefined && diterima >= Number(locked.kuota)) status = "daftar_tunggu";
      const baris = rows(await trx.raw(`INSERT INTO kegiatan_pendaftaran (kegiatan, usaha, pendaftar, status, butuh_disabilitas, kebutuhan_aksesibilitas, pakta_integritas, consent) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) RETURNING *`, [kegiatanId, pemanggil.usahaId, pemanggil.id, status, butuhDisabilitas, butuhDisabilitas ? kebutuhan.trim() : null, pakta]))[0];
      return baris;
    });
    noStore(res);
    res.status(201).json({ data: toPendaftaran(dibuat) });
  });
export const pendaftaranSaya = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const kegiatanId = uuidParam(req.params?.id, "INVALID_KEGIATAN_ID");
    if (!pemanggil?.usahaId) throw new ProgramError(403, "USAHA_BELUM_TERHUBUNG", "Akun belum terhubung ke usaha.");
    const row = rows(await database.raw(`SELECT * FROM kegiatan_pendaftaran WHERE kegiatan = ? AND usaha = ? ORDER BY date_created DESC LIMIT 1`, [kegiatanId, pemanggil.usahaId]))[0];
    if (!row) throw new ProgramError(404, "PENDAFTARAN_NOT_FOUND", "Belum ada pendaftaran.");
    noStore(res);
    res.json({ data: toPendaftaran(row) });
  });
async function skorServer(database, usahaId) {
  const legal = await loadLegalitas(database, usahaId);
  const full = await loadUsahaSummary(database, usahaId);
  const kesiapan = {};
  for (const item of legal) kesiapan[item.jenis] = item.status === 'terbit' ? 'terbit' : 'dalam_proses';
  const skor = hitungSkor({ omzetTahunan: full.omzetTahunan, kapasitasProduksi: 1, literasiQris: false, literasiPembukuanDigital: false, suratKomitmen: false, nib: Boolean(full.nib), legalitas: kesiapan, tenagaKerja: full.tenagaKerja });
  return { nilai: skor.total, rubrik: RUBRIK_VERSI };
}
export const listPendaftar = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const kegiatanId = uuidParam(req.params?.id, "INVALID_KEGIATAN_ID");
    const status = req.query?.status ? String(req.query.status) : null;
    const kondisi = status ? "AND p.status = ?" : "";
    const params = status ? [kegiatanId, status] : [kegiatanId];
    let scope = { sql: "TRUE", bindings: [] };
    if (!pemanggil?.admin && pemanggil?.peran === "kabkota") {
      if (pemanggil.kotaId == null) throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Wilayah belum ditetapkan.");
      scope = { sql: "EXISTS (SELECT 1 FROM usaha_tabular t WHERE t.id = p.usaha AND t.kota_id = ?)", bindings: [pemanggil.kotaId] };
    }
    const items = rows(await database.raw(`SELECT p.*, u.nama AS usaha_nama, u.skala AS usaha_skala, t.kota_nama AS usaha_kota, s.id AS sertifikat_id, s.kode AS sertifikat_kode FROM kegiatan_pendaftaran p JOIN usaha u ON u.id = p.usaha LEFT JOIN usaha_tabular t ON t.id = p.usaha LEFT JOIN kegiatan_sertifikat s ON s.pendaftaran = p.id AND s.status = 'aktif' WHERE p.kegiatan = ? ${kondisi} AND (${scope.sql}) ORDER BY p.date_created LIMIT 200`, [...params, ...scope.bindings]));
    noStore(res);
    res.json({ data: items.map((r) => ({ ...toPendaftaran(r), usahaNama: r.usaha_nama, usahaSkala: r.usaha_skala, usahaKota: r.usaha_kota, sertifikatId: r.sertifikat_id ?? null, sertifikatKode: r.sertifikat_kode ?? null })) });
  });
export const putuskanPendaftar = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const pendaftaranId = uuidParam(req.params?.pendaftaranId, "INVALID_PENDAFTARAN_ID");
    const body = objectBody(req);
    const keputusan = String(body.keputusan ?? "");
    if (!["diterima", "ditolak", "daftar_tunggu", "batal"].includes(keputusan)) throw new ProgramError(400, "INVALID_PAYLOAD", "Keputusan tidak valid.");
    const alasan = optionalText(body, "alasan", 2000);
    const hasil = await database.transaction(async (trx) => {
      const cur = rows(await trx.raw(`SELECT p.*, k.kuota, k.judul, k.tanggal_mulai, k.lokasi, k.link, k.metode FROM kegiatan_pendaftaran p JOIN kegiatan k ON k.id = p.kegiatan WHERE p.id = ? FOR UPDATE`, [pendaftaranId]))[0];
      if (!cur) throw new ProgramError(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran tidak ditemukan.");
      if (!pemanggil?.admin && pemanggil?.peran === "kabkota" && pemanggil.kotaId != null) {
        const t = rows(await trx.raw(`SELECT kota_id FROM usaha_tabular WHERE id = ?`, [cur.usaha]))[0];
        if (!t || Number(t.kota_id) !== Number(pemanggil.kotaId)) throw new ProgramError(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran tidak ditemukan.");
      }
      if (cur.status === keputusan) return { row: cur, naik: null };
      if (keputusan === "diterima" && cur.status !== "diterima") {
        const sk = await skorServer(trx, cur.usaha);
        await trx.raw(`UPDATE kegiatan_pendaftaran SET skor_talent = ?, skor_rubrik = ? WHERE id = ?`, [sk.nilai, sk.rubrik, pendaftaranId]);
        cur.skor_talent = sk.nilai; cur.skor_rubrik = sk.rubrik;
        if (cur.kuota !== null && cur.kuota !== undefined) {
          const hit = rows(await trx.raw(`SELECT COUNT(*)::integer AS n FROM kegiatan_pendaftaran WHERE kegiatan = ? AND status = 'diterima' AND id <> ?`, [cur.kegiatan, pendaftaranId]))[0];
          if (Number(hit?.n ?? 0) >= Number(cur.kuota)) throw new ProgramError(409, "KUOTA_PENUH", "Kuota penuh.");
        }
      }
      await trx.raw(`UPDATE kegiatan_pendaftaran SET status = ?, alasan = ?, administrasi_lolos = ?, diputuskan_oleh = ?, diputuskan_pada = NOW(), date_updated = NOW() WHERE id = ?`, [keputusan, alasan, keputusan === "diterima", pemanggil.id, pendaftaranId]);
      await trx.raw(`INSERT INTO kegiatan_keputusan_audit (pendaftaran, status_dari, status_ke, skor_talent, skor_rubrik, alasan, diputuskan_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)`, [pendaftaranId, cur.status, keputusan, cur.skor_talent ?? null, cur.skor_rubrik ?? null, alasan, pemanggil.id]);
      let naik = null;
      if ((cur.status === "diterima" || cur.status === "menunggu") && (keputusan === "batal" || keputusan === "ditolak")) {
        // Admin kabkota hanya menaikkan antrean kotanya sendiri; provinsi menaikkan antrean tertua kegiatan.
        const sekota = !pemanggil?.admin && pemanggil?.peran === "kabkota" && pemanggil.kotaId != null;
        const batasKota = sekota ? " AND usaha IN (SELECT id FROM usaha_tabular WHERE kota_id = ?)" : "";
        naik = rows(await trx.raw(`UPDATE kegiatan_pendaftaran SET status = 'diterima', diputuskan_oleh = ?, diputuskan_pada = NOW(), date_updated = NOW() WHERE id = (SELECT id FROM kegiatan_pendaftaran WHERE kegiatan = ? AND status = 'daftar_tunggu'${batasKota} ORDER BY date_created LIMIT 1) RETURNING *`, sekota ? [pemanggil.id, cur.kegiatan, pemanggil.kotaId] : [pemanggil.id, cur.kegiatan]))[0] ?? null;
        if (naik) await trx.raw(`INSERT INTO kegiatan_keputusan_audit (pendaftaran, status_dari, status_ke, diputuskan_oleh) VALUES (?, 'daftar_tunggu', 'diterima', ?)`, [naik.id, pemanggil.id]);
      }
      const row = rows(await trx.raw(`SELECT * FROM kegiatan_pendaftaran WHERE id = ?`, [pendaftaranId]))[0];
      return { row, naik: naik ? toPendaftaran(naik) : null };
    });
    noStore(res);
    res.json({ data: { ...toPendaftaran(hasil.row), daftarTungguNaik: hasil.naik } });
  });
export const epassSaya = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const kegiatanId = uuidParam(req.params?.id, "INVALID_KEGIATAN_ID");
    if (!pemanggil?.usahaId) throw new ProgramError(403, "USAHA_BELUM_TERHUBUNG", "Akun belum terhubung ke usaha.");
    const row = rows(await database.raw(`SELECT p.*, k.judul, k.tanggal_mulai, k.lokasi, k.link, k.metode FROM kegiatan_pendaftaran p JOIN kegiatan k ON k.id = p.kegiatan WHERE p.kegiatan = ? AND p.usaha = ? AND p.status = 'diterima'`, [kegiatanId, pemanggil.usahaId]))[0];
    if (!row) throw new ProgramError(404, "EPASS_NOT_FOUND", "E-pass hanya untuk peserta diterima.");
    noStore(res);
    res.json({ data: { pendaftaran: row.id, qr: epassPayload({ token: row.epass_token, kegiatanId, pendaftaranId: row.id }), jadwal: iso(row.tanggal_mulai), lokasi: row.lokasi, tautan: row.link, metode: row.metode } });
  });
export const eksporPendaftar = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const kegiatanId = uuidParam(req.params?.id, "INVALID_KEGIATAN_ID");
    let scope = { sql: "TRUE", bindings: [] };
    if (!pemanggil?.admin && pemanggil?.peran === "kabkota") {
      if (pemanggil.kotaId == null) throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Wilayah belum ditetapkan.");
      scope = { sql: "EXISTS (SELECT 1 FROM usaha_tabular t WHERE t.id = p.usaha AND t.kota_id = ?)", bindings: [pemanggil.kotaId] };
    }
    const items = rows(await database.raw(`SELECT p.status, p.skor_talent, p.date_created, u.nama AS usaha_nama, u.skala AS usaha_skala, t.kota_nama AS usaha_kota FROM kegiatan_pendaftaran p JOIN usaha u ON u.id = p.usaha LEFT JOIN usaha_tabular t ON t.id = p.usaha WHERE p.kegiatan = ? AND (${scope.sql}) ORDER BY p.date_created LIMIT 2000`, [kegiatanId, ...scope.bindings]));
    const berkas = renderXlsx(["Usaha", "Skala", "Kota", "Status", "Skor Talent", "Didaftarkan"], items.map((r) => [r.usaha_nama ?? "", r.usaha_skala ?? "", r.usaha_kota ?? "", r.status ?? "", r.skor_talent ?? "", iso(r.date_created) ?? ""]));
    noStore(res);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pendaftar-${kegiatanId}.xlsx"`);
    res.end(berkas);
  });
export const pindaiHadir = ({ database, logger }) => (req, res) =>
  handle(logger, res, async () => {
    const body = objectBody(req);
    const qr = String(body.qr ?? "");
    const sesiKe = Number(body.sesiKe);
    if (!/^DISKUK-EPASS:[0-9a-f-]{36}:[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(qr)) throw new ProgramError(400, "QR_TIDAK_VALID", "QR tidak valid.");
    if (!Number.isInteger(sesiKe) || sesiKe < 1 || sesiKe > 60) throw new ProgramError(400, "INVALID_PAYLOAD", "Sesi tidak valid.");
    const parts = qr.split(":");
    const kegiatanId = parts[1]; const pendaftaranId = parts[2]; const token = parts[3];
    const hasil = await database.transaction(async (trx) => {
      const cur = rows(await trx.raw(`SELECT p.*, k.jumlah_sesi FROM kegiatan_pendaftaran p JOIN kegiatan k ON k.id = p.kegiatan WHERE p.id = ? AND p.kegiatan = ? AND p.epass_token = ?::uuid AND p.status = 'diterima'`, [pendaftaranId, kegiatanId, token]))[0];
      if (!cur) throw new ProgramError(404, "QR_TIDAK_DITEMUKAN", "QR tidak ditemukan untuk peserta ini.");
      if (sesiKe > Number(cur.jumlah_sesi)) throw new ProgramError(400, "SESI_TIDAK_VALID", "Sesi di luar jumlah sesi.");
      await trx.raw(`INSERT INTO kegiatan_presensi (pendaftaran, sesi_ke, hadir, dipindai_oleh) VALUES (?, ?, TRUE, ?) ON CONFLICT (pendaftaran, sesi_ke) DO UPDATE SET hadir = TRUE, dipindai_pada = NOW()`, [pendaftaranId, sesiKe, body.petugas ?? null]);
      const hit = rows(await trx.raw(`SELECT COUNT(*)::integer AS hadir FROM kegiatan_presensi WHERE pendaftaran = ? AND hadir = TRUE`, [pendaftaranId]))[0];
      return { hadir: Number(hit?.hadir ?? 0), jumlahSesi: Number(cur.jumlah_sesi), persen: persenHadir(cur.jumlah_sesi, Number(hit?.hadir ?? 0)) };
    });
    noStore(res);
    res.json({ data: hasil });
  });
export const nilaiTugas = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const pendaftaranId = uuidParam(req.params?.pendaftaranId, "INVALID_PENDAFTARAN_ID");
    const body = objectBody(req);
    if (body.selesai !== true && body.selesai !== false) throw new ProgramError(400, "INVALID_PAYLOAD", "Status tugas wajib diisi.");
    const cur = rows(await database.raw(`SELECT usaha FROM kegiatan_pendaftaran WHERE id = ? AND status = 'diterima'`, [pendaftaranId]))[0];
    if (!cur) throw new ProgramError(404, "PENDAFTARAN_NOT_FOUND", "Pendaftaran diterima tidak ditemukan.");
    await cakupanUsaha(database, pemanggil, cur.usaha);
    await database.raw(`UPDATE kegiatan_pendaftaran SET tugas_selesai = ?, tugas_dinilai_oleh = ?, tugas_dinilai_pada = NOW(), date_updated = NOW() WHERE id = ? AND status = 'diterima'`, [body.selesai, pemanggil.id, pendaftaranId]);
    noStore(res);
    res.json({ data: { id: pendaftaranId, tugasSelesai: body.selesai } });
  });
function sertifikatPayload({ kode, kegiatanId, pendaftaranId, usahaId }) {
  return { versi: 1, kode, kegiatan: kegiatanId, pendaftaran: pendaftaranId, usaha: usahaId, atribut: "bukti_pelatihan_manajemen", capaian: "peningkatan_kapasitas_sdm" };
}
export const terbitkanSertifikat = ({ database, logger, env }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const pendaftaranId = uuidParam(req.params?.pendaftaranId, "INVALID_PENDAFTARAN_ID");
    const hasil = await database.transaction(async (trx) => {
      const cur = rows(await trx.raw(`SELECT p.*, k.judul, k.jumlah_sesi, k.butuh_tugas FROM kegiatan_pendaftaran p JOIN kegiatan k ON k.id = p.kegiatan WHERE p.id = ? FOR UPDATE`, [pendaftaranId]))[0];
      if (cur) await cakupanUsaha(trx, pemanggil, cur.usaha);
      if (!cur || cur.status !== "diterima") throw new ProgramError(409, "BELUM_LAYAK", "Hanya peserta diterima.");
      const hit = rows(await trx.raw(`SELECT COUNT(*)::integer AS hadir FROM kegiatan_presensi WHERE pendaftaran = ? AND hadir = TRUE`, [pendaftaranId]))[0];
      const hadir = Number(hit?.hadir ?? 0);
      const persen = persenHadir(cur.jumlah_sesi, hadir);
      const layak = layakSertifikat({ jumlahSesi: cur.jumlah_sesi, hadir, tugasSelesai: cur.tugas_selesai, butuhTugas: cur.butuh_tugas });
      if (!layak) throw new ProgramError(409, "BELUM_LAYAK", "Butuh >=80% hadir dan tugas selesai.");
      const lama = rows(await trx.raw(`SELECT * FROM kegiatan_sertifikat WHERE pendaftaran = ? AND status = 'aktif'`, [pendaftaranId]))[0];
      if (lama) return { row: lama, duplikat: true };
      const kode = sertifikatKode();
      const payload = sertifikatPayload({ kode, kegiatanId: cur.kegiatan, pendaftaranId, usahaId: cur.usaha });
      const hash = hashPayload(payload);
      const { kid, signature } = sign(env, kode, hash);
      const row = rows(await trx.raw(`INSERT INTO kegiatan_sertifikat (pendaftaran, kode, payload_hash, signature, kid, diterbitkan_oleh, sumber_indikator, versi_indikator) VALUES (?, ?, ?, ?, ?, ?, 'kegiatan_sertifikat', 1) RETURNING *`, [pendaftaranId, kode, hash, signature, kid, pemanggil.id]))[0];
      await trx.raw(`INSERT INTO kegiatan_sertifikat_dampak (sertifikat, usaha, atribut, capaian, aktif, sumber, versi) VALUES (?, ?, 'bukti_pelatihan_manajemen', 'peningkatan_kapasitas_sdm', TRUE, 'kegiatan_sertifikat', 1) ON CONFLICT (sertifikat) DO UPDATE SET aktif = TRUE, diperbarui_pada = NOW()`, [row.id, cur.usaha]);
      return { row, duplikat: false, hadir, persen };
    });
    noStore(res);
    res.status(hasil.duplikat ? 200 : 201).json({ data: { id: hasil.row.id, kode: hasil.row.kode, status: hasil.row.status, duplikat: hasil.duplikat } });
  });
export const cabutSertifikat = ({ database, logger }) => (req, res, pemanggil) =>
  handle(logger, res, async () => {
    const sertifikatId = uuidParam(req.params?.sertifikatId, "INVALID_SERTIFIKAT_ID");
    const hasil = await database.transaction(async (trx) => {
      const asal = rows(await trx.raw(`SELECT p.usaha FROM kegiatan_sertifikat s JOIN kegiatan_pendaftaran p ON p.id = s.pendaftaran WHERE s.id = ?`, [sertifikatId]))[0];
      if (asal) await cakupanUsaha(trx, pemanggil, asal.usaha);
      const row = rows(await trx.raw(`UPDATE kegiatan_sertifikat SET status = 'dicabut', dicabut_pada = NOW() WHERE id = ? AND status = 'aktif' RETURNING *`, [sertifikatId]))[0];
      if (!row) throw new ProgramError(404, "SERTIFIKAT_NOT_FOUND", "Sertifikat aktif tidak ditemukan.");
      await trx.raw(`UPDATE kegiatan_sertifikat_dampak SET aktif = FALSE, diperbarui_pada = NOW() WHERE sertifikat = ?`, [sertifikatId]);
      return row;
    });
    noStore(res);
    res.json({ data: { id: hasil.id, kode: hasil.kode, status: hasil.status } });
  });
export const verifikasiSertifikat = ({ database, logger, env }) => (req, res) =>
  handle(logger, res, async () => {
    const kode = String(req.params?.kode ?? "").toUpperCase();
    if (!/^SK[A-Z2-9]{10}$/.test(kode)) throw new ProgramError(404, "SERTIFIKAT_NOT_FOUND", "Sertifikat tidak ditemukan.");
    const row = rows(await database.raw(`SELECT s.*, p.kegiatan, p.usaha FROM kegiatan_sertifikat s JOIN kegiatan_pendaftaran p ON p.id = s.pendaftaran WHERE s.kode = ?`, [kode]))[0];
    if (!row) throw new ProgramError(404, "SERTIFIKAT_NOT_FOUND", "Sertifikat tidak ditemukan.");
    if (row.status !== "aktif") { noStore(res); res.json({ data: { kode, valid: false, status: "dicabut", dicabutPada: iso(row.dicabut_pada) } }); return; }
    const payload = sertifikatPayload({ kode, kegiatanId: row.kegiatan, pendaftaranId: row.pendaftaran, usahaId: row.usaha });
    const valid = hashPayload(payload) === row.payload_hash && verify(env, { kode, payload, payload_hash: row.payload_hash, signature: row.signature, kid: row.kid });
    noStore(res);
    res.json({ data: { kode, valid, status: valid ? "aktif" : "tidak_valid", usaha: row.usaha, kegiatan: row.kegiatan } });
  });
