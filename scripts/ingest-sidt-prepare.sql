\set ON_ERROR_STOP on

-- Kunci ini membuat setiap batch aman dijalankan ulang. Semua data SIDT
-- memiliki id_data_badan_usaha yang unik dan tidak kosong.
CREATE UNIQUE INDEX IF NOT EXISTS ux_usaha_sumber_id
  ON usaha (sumber_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kota_provinsi_nama
  ON kota (provinsi, nama);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kecamatan_kota_nama
  ON kecamatan (kota, nama);

CREATE UNIQUE INDEX IF NOT EXISTS ux_kelurahan_kecamatan_nama
  ON kelurahan (kecamatan, nama);
