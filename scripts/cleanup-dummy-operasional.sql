-- Cleanup data dummy dashboard operasional (fase Y01). HANYA stack disposable.
-- Jalankan SEBELUM: node scripts/seed-dummy-operasional.mjs cleanup
-- Urutan penting: lepas penugasan → hapus domain dummy → hapus wilayah/klasifikasi dummy.
BEGIN;

-- Lepaskan penugasan akun dummy agar FK tidak menghalangi.
UPDATE directus_users SET usaha = NULL, kota_scope = NULL WHERE email LIKE 'dummy\_%';

-- Fase berikutnya menambah DELETE tabel domainnya di bagian ini (sebelum delete usaha).

-- Y02: atribut ikut cascade dari usaha di bawah.
DELETE FROM directus_files WHERE filename_download LIKE 'dummy\_%';

-- Kumpulkan alamat dummy (via pelaku_usaha dummy) ke temp table.
CREATE TEMP TABLE dummy_alamat_ids AS
  SELECT alamat AS id FROM pelaku_usaha WHERE nik LIKE 'dummy\_%' AND alamat IS NOT NULL;

DELETE FROM usaha WHERE sumber_id LIKE 'dummy\_%';
DELETE FROM statistik_tenaga_kerja WHERE usaha NOT IN (SELECT id FROM usaha);
DELETE FROM pelaku_usaha WHERE nik LIKE 'dummy\_%';
DELETE FROM alamat WHERE id IN (SELECT id FROM dummy_alamat_ids);

DELETE FROM kelurahan WHERE kode LIKE 'dummy\_%';
DELETE FROM kecamatan WHERE kode LIKE 'dummy\_%';
DELETE FROM kota WHERE kode LIKE 'dummy\_%';
DELETE FROM provinsi WHERE kode LIKE 'dummy\_%';

DELETE FROM klasifikasi_usaha WHERE deskripsi LIKE 'dummy\_%'
  AND NOT EXISTS (SELECT 1 FROM usaha u WHERE u.klasifikasi = klasifikasi_usaha.id);

-- Bangun ulang read model tanpa baris dummy.
SELECT analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL);

COMMIT;
