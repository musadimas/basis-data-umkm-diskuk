\timing on
CREATE INDEX CONCURRENTLY idx_usaha_pelaku_usaha ON usaha (pelaku_usaha);
ANALYZE usaha;
\echo '### C. WITH trigram + idx_usaha_pelaku_usaha (owner arm)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE (t.nama ILIKE '%lestari 1234%' OR t.produk_utama ILIKE '%lestari 1234%' OR t.kegiatan_utama ILIKE '%lestari 1234%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%lestari 1234%')));
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE t.kota_id = 1 AND (t.nama ILIKE '%keripik sumedang%' OR t.produk_utama ILIKE '%keripik sumedang%' OR t.kegiatan_utama ILIKE '%keripik sumedang%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%keripik sumedang%')));
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) SELECT COUNT(*) FROM usaha_tabular t WHERE (t.nama ILIKE '%zzzzqx%' OR t.produk_utama ILIKE '%zzzzqx%' OR t.kegiatan_utama ILIKE '%zzzzqx%' OR t.id = ANY(ARRAY(SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE '%zzzzqx%')));
