-- Hapus semua data dummy menu Program yang dibuat scripts/seed-dummy-program.sql. Aman dijalankan
-- berulang; data asli tidak tersentuh karena setiap akar baris dicari lewat penanda dummy_.
-- Akun dummy_* TIDAK dihapus di sini (lihat scripts/seed-dummy-operasional.mjs cleanup).
--
-- Pemakaian: psql -v ON_ERROR_STOP=1 -f scripts/cleanup-dummy-program.sql
\set ON_ERROR_STOP on
BEGIN;
-- Sama seperti seed: jangan biarkan trigger pelaku_usaha/alamat mengantrekan rebuild penuh.
SET LOCAL diskuk.analytics_bulk_ingest = 'on';

CREATE TEMP TABLE dm_hapus ON COMMIT DROP AS
SELECT id AS usaha, pelaku_usaha AS pelaku, alamat FROM usaha WHERE sumber_id LIKE 'dummy\_prog\_%';

-- Tiket (usaha di-SET NULL, bukan cascade) dan konsultan dummy; audit, CSAT, outcome ikut cascade.
DELETE FROM konsultasi_tiket WHERE nomor LIKE 'dummy\_%' OR usaha IN (SELECT usaha FROM dm_hapus);
DELETE FROM klinik_konsultan WHERE nama LIKE 'dummy\_%';
-- Kegiatan dummy; pendaftaran, presensi, sertifikat, dampak, dan audit keputusan ikut cascade.
DELETE FROM kegiatan WHERE judul LIKE 'dummy\_%';
DELETE FROM talent_berita_acara WHERE nomor LIKE 'dummy\_%';
-- Log akses investor tidak punya ON DELETE CASCADE ke usaha.
DELETE FROM investor_akses_audit WHERE usaha IN (SELECT usaha FROM dm_hapus);
-- Pengajuan, peserta + KPI, produk + LoI, passport, profil investor, atribut, legalitas ikut cascade.
DELETE FROM usaha WHERE id IN (SELECT usaha FROM dm_hapus);
DELETE FROM pelaku_usaha WHERE nik LIKE 'dummy\_pu\_%';
DELETE FROM alamat WHERE alamat_jalan LIKE 'dummy\_%' OR id IN (SELECT alamat FROM dm_hapus);

-- Buang baris usaha dummy dari read model analitik (projector menghapus bila sumbernya hilang).
SELECT COUNT(*) AS proyeksi_hapus_diantrekan
  FROM (SELECT analitik_enqueue_job('project_record_change', 'project_record:' || usaha::text, usaha) FROM dm_hapus) q;

COMMIT;
