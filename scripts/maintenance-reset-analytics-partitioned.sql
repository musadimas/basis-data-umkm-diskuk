\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE analitik_active_generation IN ACCESS EXCLUSIVE MODE;
LOCK TABLE analitik_generation IN ACCESS EXCLUSIVE MODE;
LOCK TABLE analitik_dim_aggregate IN ACCESS EXCLUSIVE MODE;
LOCK TABLE analitik_usaha_current IN ACCESS EXCLUSIVE MODE;

-- The projection and generation metadata are rebuildable. Canonical UMKM
-- tables (usaha, pelaku_usaha, alamat, and references) are not modified.
UPDATE analitik_active_generation
SET active_generation_id=NULL, previous_generation_id=NULL, updated_at=NOW()
WHERE id=1;

DROP TABLE analitik_usaha_current;
DELETE FROM analitik_generation;

CREATE TABLE analitik_usaha_current (
  generation_id UUID NOT NULL REFERENCES analitik_generation(id) ON DELETE CASCADE, usaha_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','archived')), nama TEXT NOT NULL, kegiatan_utama TEXT, produk_utama TEXT,
  status_hukum TEXT, skala TEXT, kota_id INTEGER, kota_kode TEXT, kota_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
  kecamatan_id INTEGER, kecamatan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui', kelurahan_id INTEGER, kelurahan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
  kode_kbli TEXT, kategori_kbli TEXT, sektor_kbli CHAR(1), omzet_tahunan BIGINT, total_aset BIGINT,
  omzet_quality TEXT NOT NULL DEFAULT 'missing' CHECK (omzet_quality IN ('reported','missing','needs_verification')),
  aset_quality TEXT NOT NULL DEFAULT 'missing' CHECK (aset_quality IN ('reported','missing','needs_verification')),
  masked_nik TEXT, masked_phone TEXT, owner_name TEXT, age_band TEXT,
  business_address TEXT, latitude NUMERIC(10,8), longitude NUMERIC(11,8), extra_fields JSONB NOT NULL DEFAULT '{}',
  source_hash CHAR(64), source_updated_at TIMESTAMPTZ, projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (generation_id, usaha_id)
) PARTITION BY LIST (generation_id);

-- Generation-local indexes omit generation_id because partition pruning has
-- already selected exactly one physical table.
CREATE INDEX idx_analitik_current_city ON analitik_usaha_current(kota_id);
CREATE INDEX idx_analitik_current_sector ON analitik_usaha_current(sektor_kbli);
CREATE INDEX idx_analitik_current_scale ON analitik_usaha_current(skala);
CREATE INDEX idx_analitik_current_status ON analitik_usaha_current(status);
CREATE INDEX idx_analitik_current_kecamatan ON analitik_usaha_current(kecamatan_id);
CREATE INDEX idx_analitik_current_kelurahan ON analitik_usaha_current(kelurahan_id);
CREATE INDEX idx_analitik_current_kbli ON analitik_usaha_current(kode_kbli);
CREATE INDEX idx_analitik_current_status_hukum ON analitik_usaha_current(status_hukum);
CREATE INDEX idx_analitik_current_nama ON analitik_usaha_current(nama,usaha_id);
CREATE INDEX idx_analitik_current_kecamatan_name_group ON analitik_usaha_current(generation_id,status,kecamatan_nama) INCLUDE (skala,kode_kbli);
CREATE INDEX idx_analitik_current_skala_geo ON analitik_usaha_current(generation_id,skala,status) INCLUDE (kota_id,kota_nama,kecamatan_id,kecamatan_nama);

DROP INDEX IF EXISTS idx_usaha_tabular_filter_kecamatan;
DROP INDEX IF EXISTS idx_usaha_tabular_filter_kelurahan;
DROP INDEX IF EXISTS idx_usaha_tabular_geo_kbli;

COMMIT;
