// Per-record refresh for the legacy `usaha_tabular` snapshot (Phase Y02).
// The full-rebuild INSERT in rebuild.js and the per-record refresh here share
// one SQL builder so Tabular/Spasial stay consistent after data-lapangan edits.

export const LEGACY_TABULAR_COLUMNS = [
  "id",
  "nama",
  "skala",
  "produk_utama",
  "kegiatan_utama",
  "kode_kbli",
  "kategori_kbli",
  "deskripsi_kbli",
  "kota_id",
  "kota_nama",
  "kecamatan_id",
  "kecamatan_nama",
  "kelurahan_id",
  "kelurahan_nama",
  "tenaga_kerja_laki_laki",
  "tenaga_kerja_perempuan",
  "latitude",
  "longitude",
];

export function legacyTabularInsertSql(extraWhere = "") {
  return `
    INSERT INTO usaha_tabular (
      id, nama, skala, produk_utama, kegiatan_utama,
      kode_kbli, kategori_kbli, deskripsi_kbli,
      kota_id, kota_nama, kecamatan_id, kecamatan_nama, kelurahan_id, kelurahan_nama,
      tenaga_kerja_laki_laki, tenaga_kerja_perempuan,
      latitude, longitude
    )
    SELECT
      u.id,
      u.nama,
      u.skala,
      u.produk_utama,
      u.kegiatan_utama,
      kk.kode,
      kk.kategori,
      kk.deskripsi,
      ko.id,
      COALESCE(ko.nama, 'Tidak diketahui'),
      kc.id,
      COALESCE(kc.nama, 'Tidak diketahui'),
      kl.id,
      COALESCE(kl.nama, 'Tidak diketahui'),
      COALESCE(stk.dibayar_laki_laki, 0) +
        COALESCE(stk.tidak_dibayar_laki_laki, 0) +
        COALESCE(stk.disabilitas_dibayar_laki_laki, 0) +
        COALESCE(stk.disabilitas_tidak_dibayar_laki_laki, 0),
      COALESCE(stk.dibayar_perempuan, 0) +
        COALESCE(stk.tidak_dibayar_perempuan, 0) +
        COALESCE(stk.disabilitas_dibayar_perempuan, 0) +
        COALESCE(stk.disabilitas_tidak_dibayar_perempuan, 0),
      u.latitude,
      u.longitude
    FROM usaha u
    LEFT JOIN alamat a ON a.id = u.alamat
    LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
    LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
    LEFT JOIN kota ko ON ko.id = kc.kota
    LEFT JOIN provinsi p ON p.id = ko.provinsi
    LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
    LEFT JOIN statistik_tenaga_kerja stk ON stk.usaha = u.id
    WHERE u.status = 'active' AND (p.id IS NULL OR LOWER(p.nama) = 'jawa barat')${extraWhere}
  `;
}

export async function refreshLegacyTabularRow(client, usahaId) {
  await client.query(`DELETE FROM usaha_tabular WHERE id = $1`, [usahaId]);
  await client.query(legacyTabularInsertSql(" AND u.id = $1"), [usahaId]);
}
