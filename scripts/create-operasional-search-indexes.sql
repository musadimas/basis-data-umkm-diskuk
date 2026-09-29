-- Script: create-operasional-search-indexes.sql
-- DEPRECATED: index pencarian kini dibuat migrasi 20260928B-tabular-search-trgm.js
-- (satu index per kolom predikat, plus buang usaha.nama yang tidak terpakai). Jalankan
-- migrasi Directus, bukan script ini.
-- Purpose: GIN trigram indexes for fast global search on business and owner names.
-- WARNING: Run outside transaction blocks with CONCURRENTLY to avoid table locking.
-- Use on disposable environments or scheduled maintenance windows.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_nama_trgm ON usaha USING gin (nama gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pelaku_usaha_nama_trgm ON pelaku_usaha USING gin (nama_lengkap gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_tabular_nama_trgm ON usaha_tabular USING gin (nama gin_trgm_ops);
