import privacy from "../../../../analytics-shared/privacy.cjs";
import { ProgramError, rows } from "./utils/http.js";

const { maskNik } = privacy;

/**
 * SIDT identity of one business for the programme screens, with the owner's NIK masked
 * (ADR-004). Throws 404 when the business does not exist.
 */
export async function loadUsahaSummary(database, usahaId) {
  const result = await database.raw(
    `SELECT u.id, u.nama, u.nib, u.skala, u.kegiatan_utama, u.produk_utama,
            u.omzet_tahunan, u.total_aset, u.talent_status, u.talent_batch,
            u.pdn_terverifikasi, u.ramah_disabilitas,
            kk.kode AS kode_kbli, t.kota_nama, t.kecamatan_nama,
            COALESCE(t.tenaga_kerja_laki_laki, 0) + COALESCE(t.tenaga_kerja_perempuan, 0) AS tenaga_kerja,
            p.nama_lengkap, p.nik
       FROM usaha u
       JOIN pelaku_usaha p ON p.id = u.pelaku_usaha
       LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
       LEFT JOIN usaha_tabular t ON t.id = u.id
      WHERE u.id = ?`,
    [usahaId],
  );
  const row = rows(result)[0];
  if (!row) throw new ProgramError(404, "USAHA_NOT_FOUND", "The business was not found.");
  return {
    id: row.id,
    nama: row.nama,
    nib: row.nib,
    skala: row.skala,
    kodeKbli: row.kode_kbli,
    kegiatanUtama: row.kegiatan_utama,
    produkUtama: row.produk_utama,
    omzetTahunan: row.omzet_tahunan === null ? null : Number(row.omzet_tahunan),
    totalAset: row.total_aset === null ? null : Number(row.total_aset),
    kota: row.kota_nama,
    kecamatan: row.kecamatan_nama,
    tenagaKerja: Number(row.tenaga_kerja) || 0,
    talentStatus: row.talent_status,
    talentBatch: row.talent_batch,
    pdnTerverifikasi: Boolean(row.pdn_terverifikasi),
    ramahDisabilitas: Boolean(row.ramah_disabilitas),
    pemilik: { nama: row.nama_lengkap, nikMasked: maskNik(row.nik) },
  };
}

/**
 * Certificates of one business. A permit whose berlaku_hingga has passed is reported as
 * kedaluwarsa even if nobody has updated its status.
 */
export async function loadLegalitas(database, usahaId) {
  const result = await database.raw(
    `SELECT l.id, l.jenis, l.nomor,
            CASE WHEN l.status = 'terbit' AND l.berlaku_hingga < CURRENT_DATE THEN 'kedaluwarsa' ELSE l.status END AS status,
            l.berlaku_hingga AS "berlakuHingga", l.berkas
       FROM usaha_legalitas l
      WHERE l.usaha = ?
      ORDER BY l.jenis, l.berlaku_hingga DESC NULLS LAST`,
    [usahaId],
  );
  return rows(result);
}
