BEGIN;
SET LOCAL max_parallel_workers_per_gather = 0;

-- ponytail: full refresh locks public reads; use versioned shadow tables if publish downtime matters.
TRUNCATE usaha_tabular;

INSERT INTO usaha_tabular (
  id, nama, skala, produk_utama, kegiatan_utama,
  kode_kbli, kategori_kbli, deskripsi_kbli,
  kota_id, kota_nama, kecamatan_id, kecamatan_nama, kelurahan_id, kelurahan_nama,
  tenaga_kerja_laki_laki, tenaga_kerja_perempuan
)
SELECT
  u.id,
  u.nama,
  u.skala,
  u.produk_utama,
  u.kegiatan_utama,
  kk.kode,
  kk.kategori,
  kk.deskripsi,
  ko.id,
  ko.nama,
  kc.id,
  kc.nama,
  kl.id,
  kl.nama,
  COALESCE(stk.dibayar_laki_laki, 0) +
    COALESCE(stk.tidak_dibayar_laki_laki, 0) +
    COALESCE(stk.disabilitas_dibayar_laki_laki, 0) +
    COALESCE(stk.disabilitas_tidak_dibayar_laki_laki, 0),
  COALESCE(stk.dibayar_perempuan, 0) +
    COALESCE(stk.tidak_dibayar_perempuan, 0) +
    COALESCE(stk.disabilitas_dibayar_perempuan, 0) +
    COALESCE(stk.disabilitas_tidak_dibayar_perempuan, 0)
FROM usaha u
JOIN alamat a ON a.id = u.alamat
JOIN kelurahan kl ON kl.id = a.kelurahan
JOIN kecamatan kc ON kc.id = kl.kecamatan
JOIN kota ko ON ko.id = kc.kota
JOIN provinsi p ON p.id = ko.provinsi
LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
LEFT JOIN statistik_tenaga_kerja stk ON stk.usaha = u.id
WHERE LOWER(p.nama) = 'jawa barat';

WITH usaha_jawa_barat AS MATERIALIZED (
  SELECT
    id,
    skala,
    kode_kbli,
    kategori_kbli,
    deskripsi_kbli,
    kota_id::text AS kota_id,
    kota_nama,
    tenaga_kerja_laki_laki AS male,
    tenaga_kerja_perempuan AS female
  FROM usaha_tabular
),
scale AS (
  SELECT jsonb_build_object(
    'total', COUNT(*)::integer,
    'mikro', COUNT(*) FILTER (WHERE skala = 'micro')::integer,
    'kecil', COUNT(*) FILTER (WHERE skala = 'small')::integer,
    'menengah', COUNT(*) FILTER (WHERE skala = 'medium')::integer
  ) AS value
  FROM usaha_jawa_barat
),
regions AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'name', name, 'value', value)
    ORDER BY value DESC, name ASC
  ), '[]'::jsonb) AS value
  FROM (
    SELECT kota_id AS id, kota_nama AS name, COUNT(*)::integer AS value
    FROM usaha_jawa_barat
    GROUP BY kota_id, kota_nama
  ) AS grouped
),
sektor_definisi(kode, nama, divisi_awal, divisi_akhir) AS (
  VALUES
    ('A', 'Pertanian, Kehutanan, dan Perikanan', 1, 3),
    ('B', 'Pertambangan dan Penggalian', 5, 9),
    ('C', 'Industri Pengolahan (Manufaktur/Kerajinan)', 10, 33),
    ('D', 'Pengadaan Listrik, Gas, Uap/Air Panas, dan Udara Dingin', 35, 35),
    ('E', 'Pengelolaan Air, Limbah, Sampah, dan Aktivitas Remediasi', 36, 39),
    ('F', 'Konstruksi', 41, 43),
    ('G', 'Perdagangan Besar dan Eceran; Reparasi Kendaraan', 45, 47),
    ('H', 'Pengangkutan dan Pergudangan', 49, 53),
    ('I', 'Penyediaan Akomodasi dan Makan Minum', 55, 56),
    ('J', 'Informasi dan Komunikasi', 58, 63),
    ('K', 'Aktivitas Keuangan dan Asuransi', 64, 66),
    ('L', 'Real Estat', 68, 68),
    ('M', 'Aktivitas Profesional, Ilmiah, dan Teknis', 69, 75),
    ('N', 'Aktivitas Penyewaan, Ketenagakerjaan, Agen Perjalanan, dan Penunjang Usaha', 77, 82),
    ('O', 'Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib', 84, 84),
    ('P', 'Pendidikan', 85, 85),
    ('Q', 'Aktivitas Kesehatan Manusia dan Aktivitas Sosial', 86, 88),
    ('R', 'Kesenian, Hiburan, dan Rekreasi', 90, 93),
    ('S', 'Aktivitas Jasa Lainnya', 94, 96),
    ('T', 'Aktivitas Rumah Tangga sebagai Pemberi Kerja; Aktivitas yang Menghasilkan Barang dan Jasa oleh Rumah Tangga untuk Kebutuhan Sendiri', 97, 98),
    ('U', 'Aktivitas Badan Internasional dan Badan Ekstra Internasional Lainnya', 99, 99)
),
sektor_rows AS (
  SELECT
    sd.kode,
    sd.nama,
    COUNT(u.id)::integer AS total,
    COUNT(*) FILTER (WHERE u.skala = 'micro')::integer AS mikro,
    COUNT(*) FILTER (WHERE u.skala = 'small')::integer AS kecil,
    COUNT(*) FILTER (WHERE u.skala = 'medium')::integer AS menengah
  FROM sektor_definisi sd
  LEFT JOIN usaha_jawa_barat u ON (
    CASE WHEN u.kode_kbli ~ '^[0-9]{2,5}$' THEN LEFT(u.kode_kbli, 2)::integer END
  ) BETWEEN sd.divisi_awal AND sd.divisi_akhir
  GROUP BY sd.kode, sd.nama
),
sector_coverage AS (
  SELECT jsonb_build_object(
    'mapped', COALESCE(SUM(total), 0)::integer,
    'unclassified', ((SELECT COUNT(*) FROM usaha_jawa_barat) - COALESCE(SUM(total), 0))::integer
  ) AS value
  FROM sektor_rows
),
sectors AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'code', kode, 'name', nama, 'total', total,
      'mikro', mikro, 'kecil', kecil, 'menengah', menengah,
      'percentage', percentage
    ) ORDER BY total DESC, kode ASC
  ), '[]'::jsonb) AS value
  FROM (
    SELECT
      kode,
      nama,
      total,
      mikro,
      kecil,
      menengah,
      COALESCE(ROUND(total * 100.0 / NULLIF(MAX(total) OVER (), 0), 1), 0) AS percentage
    FROM sektor_rows
  ) AS normalized
),
kbli_rows AS (
  SELECT
    kode_kbli AS code,
    kategori_kbli AS name,
    deskripsi_kbli AS description,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE skala = 'micro')::integer AS mikro,
    COUNT(*) FILTER (WHERE skala = 'small')::integer AS kecil,
    COUNT(*) FILTER (WHERE skala = 'medium')::integer AS menengah
  FROM usaha_jawa_barat
  WHERE kode_kbli IS NOT NULL
  GROUP BY kode_kbli, kategori_kbli, deskripsi_kbli
),
kbli AS (
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code, 'name', name, 'description', description, 'total', total,
        'mikro', mikro, 'kecil', kecil, 'menengah', menengah
      ) ORDER BY total DESC, code ASC
    ), '[]'::jsonb) AS all_rows,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code, 'name', name, 'description', description, 'total', total,
        'mikro', mikro, 'kecil', kecil, 'menengah', menengah
      ) ORDER BY total DESC, code ASC
    ) FILTER (WHERE rank <= 5), '[]'::jsonb) AS top_rows
  FROM (
    SELECT *, row_number() OVER (ORDER BY total DESC, code ASC) AS rank
    FROM kbli_rows
  ) AS ranked
),
workforce_numbers AS (
  SELECT COALESCE(SUM(male), 0)::bigint AS male, COALESCE(SUM(female), 0)::bigint AS female
  FROM usaha_jawa_barat
),
workforce AS (
  SELECT jsonb_build_object(
    'male', male,
    'female', female,
    'total', male + female,
    'malePercentage', COALESCE(ROUND(male * 100.0 / NULLIF(male + female, 0), 1), 0),
    'femalePercentage', COALESCE(ROUND(female * 100.0 / NULLIF(male + female, 0), 1), 0)
  ) AS value
  FROM workforce_numbers
)
INSERT INTO infografis_snapshot (id, payload, refreshed_at)
SELECT 1, jsonb_build_object(
  'scales', scale.value,
  'regions', regions.value,
  'sectors', sectors.value,
  'sectorCoverage', sector_coverage.value,
  'topKbli', kbli.top_rows,
  'kbli', kbli.all_rows,
  'workforce', workforce.value
), NOW()
FROM scale, regions, sectors, sector_coverage, kbli, workforce
ON CONFLICT (id) DO UPDATE
SET payload = EXCLUDED.payload, refreshed_at = EXCLUDED.refreshed_at;

DO $$
DECLARE
  infographic_total integer;
  tabular_total integer;
  sector_total integer;
  unclassified_total integer;
  sector_count integer;
BEGIN
  SELECT
    (payload -> 'scales' ->> 'total')::integer,
    COALESCE((
      SELECT SUM((item ->> 'total')::integer)
      FROM jsonb_array_elements(COALESCE(payload -> 'sectors', '[]'::jsonb)) AS item
    ), 0)::integer,
    COALESCE((payload -> 'sectorCoverage' ->> 'unclassified')::integer, 0),
    jsonb_array_length(COALESCE(payload -> 'sectors', '[]'::jsonb))
  INTO infographic_total, sector_total, unclassified_total, sector_count
  FROM infografis_snapshot
  WHERE id = 1;

  SELECT COUNT(*)::integer INTO tabular_total FROM usaha_tabular;

  IF infographic_total IS NULL OR infographic_total <> tabular_total THEN
    RAISE EXCEPTION 'dashboard snapshot total mismatch: infographic %, tabular %', infographic_total, tabular_total;
  END IF;

  IF sector_count <> 21 OR sector_total + unclassified_total <> tabular_total THEN
    RAISE EXCEPTION 'dashboard snapshot sector mismatch: sectors %, unclassified %, tabular %', sector_total, unclassified_total, tabular_total;
  END IF;
END $$;

COMMIT;
