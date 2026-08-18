
\set ON_ERROR_STOP on
CREATE UNIQUE INDEX IF NOT EXISTS ux_usaha_sumber_id
  ON usaha (sumber_id) WHERE sumber_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_kota_provinsi_nama ON kota (provinsi, nama);
CREATE UNIQUE INDEX IF NOT EXISTS ux_kecamatan_kota_nama ON kecamatan (kota, nama);
CREATE UNIQUE INDEX IF NOT EXISTS ux_kelurahan_kecamatan_nama ON kelurahan (kecamatan, nama);
