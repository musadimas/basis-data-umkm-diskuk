\set ON_ERROR_STOP on
BEGIN;

TRUNCATE usaha_tabular;

INSERT INTO usaha_tabular (
  id, nama, skala, produk_utama, kegiatan_utama, kode_kbli, kategori_kbli,
  kota_id, kecamatan_id, kelurahan_id
)
SELECT
  u.id,
  u.nama,
  u.skala,
  u.produk_utama,
  u.kegiatan_utama,
  kk.kode,
  kk.kategori,
  ko.id,
  kc.id,
  kl.id
FROM usaha u
JOIN alamat a ON a.id = u.alamat
JOIN kelurahan kl ON kl.id = a.kelurahan
JOIN kecamatan kc ON kc.id = kl.kecamatan
JOIN kota ko ON ko.id = kc.kota
JOIN provinsi p ON p.id = ko.provinsi
LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
WHERE LOWER(p.nama) = 'jawa barat';

COMMIT;
\echo USAHA_TABULAR_REFRESHED
