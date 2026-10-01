\timing on
\echo '### A. WITH trigram indexes (as created by migration 20260928B)'
\echo '--- rare term "gerabah lestari 1234" (count query)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE (t.nama ILIKE '%lestari 1234%' OR t.produk_utama ILIKE '%lestari 1234%' OR t.kegiatan_utama ILIKE '%lestari 1234%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%lestari 1234%')));
\echo '--- rows query, page 1, same term, ORDER BY nama,id LIMIT 21'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT t.id,t.nama FROM usaha_tabular t WHERE (t.nama ILIKE '%lestari 1234%' OR t.produk_utama ILIKE '%lestari 1234%' OR t.kegiatan_utama ILIKE '%lestari 1234%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%lestari 1234%'))) ORDER BY t.nama, t.id LIMIT 21 OFFSET 0;
\echo '--- search + kota filter (kabkota scope kota_id=1)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE t.kota_id = 1 AND (t.nama ILIKE '%keripik sumedang%' OR t.produk_utama ILIKE '%keripik sumedang%' OR t.kegiatan_utama ILIKE '%keripik sumedang%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%keripik sumedang%')));
\echo '--- empty result'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE (t.nama ILIKE '%zzzzqx%' OR t.produk_utama ILIKE '%zzzzqx%' OR t.kegiatan_utama ILIKE '%zzzzqx%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%zzzzqx%')));
\echo '### B. WITHOUT trigram indexes (dropped inside a rolled-back transaction, baseline)'
BEGIN;
DROP INDEX idx_usaha_tabular_nama_trgm; DROP INDEX idx_usaha_tabular_produk_trgm; DROP INDEX idx_usaha_tabular_kegiatan_trgm; DROP INDEX idx_pelaku_usaha_nama_trgm;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE (t.nama ILIKE '%lestari 1234%' OR t.produk_utama ILIKE '%lestari 1234%' OR t.kegiatan_utama ILIKE '%lestari 1234%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%lestari 1234%')));
ROLLBACK;
