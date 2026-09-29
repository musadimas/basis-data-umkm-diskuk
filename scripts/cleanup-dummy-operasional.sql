-- Cleanup data dummy dashboard operasional (fase Y01). HANYA stack disposable.
-- Jalankan SEBELUM: node scripts/seed-dummy-operasional.mjs cleanup
-- Urutan penting: lepas penugasan → hapus domain dummy → hapus wilayah/klasifikasi dummy.
BEGIN;

-- Lepaskan penugasan akun dummy agar FK tidak menghalangi.
UPDATE directus_users SET usaha = NULL, kota_scope = NULL WHERE email LIKE 'dummy\_%';

-- Fase berikutnya menambah DELETE tabel domainnya di bagian ini (sebelum delete usaha).

-- Y08/Y09/R04: tiket klinik milik usaha atau pemohon dummy. FK usaha/pemohon hanya SET NULL,
-- jadi tanpa ini tiketnya tertinggal; lampiran, audit, notifikasi, CSAT, dan outcome ikut cascade.
DELETE FROM konsultasi_tiket
 WHERE usaha IN (SELECT id FROM usaha WHERE sumber_id LIKE 'dummy\_%')
    OR pemohon IN (SELECT id FROM directus_users WHERE email LIKE 'dummy\_%');
-- R04: konsultan yang ditautkan ke akun dummy (tabel ada sejak 20260929C).
DO $$
BEGIN
  IF to_regclass('klinik_konsultan') IS NOT NULL THEN
    DELETE FROM klinik_konsultan WHERE pendamping IN (SELECT id FROM directus_users WHERE email LIKE 'dummy\_%');
  END IF;
END $$;
-- directus_files.modified_by tidak punya ON DELETE: lepaskan jejak ubah akun dummy pada berkas
-- milik orang lain supaya akun dummy bisa dihapus. Berkas UNGGAHAN akun dummy dihapus oleh
-- `seed-dummy-operasional.mjs cleanup` lewat API (objek storage ikut terhapus).
UPDATE directus_files SET modified_by = NULL
 WHERE modified_by IN (SELECT id FROM directus_users WHERE email LIKE 'dummy\_%');

-- Y07: agenda dummy dan opt-in pengingatnya (cascade dari kegiatan_pengingat → kegiatan).
DELETE FROM kegiatan_pengingat WHERE kegiatan IN (
  'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000004',
  'f1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000006'
);
DELETE FROM kegiatan WHERE id::text LIKE 'f1000000-0000-4000-8000-%';

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
