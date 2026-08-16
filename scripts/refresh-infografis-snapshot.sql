\set ON_ERROR_STOP on
BEGIN;
SET LOCAL max_parallel_workers_per_gather = 0;

WITH usaha_jawa_barat AS MATERIALIZED (
  SELECT
    usaha.id,
    usaha.skala,
    usaha.klasifikasi,
    kota.id::text AS kota_id,
    kota.nama AS kota_nama,
    COALESCE(statistik_tenaga_kerja.dibayar_laki_laki, 0) +
      COALESCE(statistik_tenaga_kerja.tidak_dibayar_laki_laki, 0) +
      COALESCE(statistik_tenaga_kerja.disabilitas_dibayar_laki_laki, 0) +
      COALESCE(statistik_tenaga_kerja.disabilitas_tidak_dibayar_laki_laki, 0) AS male,
    COALESCE(statistik_tenaga_kerja.dibayar_perempuan, 0) +
      COALESCE(statistik_tenaga_kerja.tidak_dibayar_perempuan, 0) +
      COALESCE(statistik_tenaga_kerja.disabilitas_dibayar_perempuan, 0) +
      COALESCE(statistik_tenaga_kerja.disabilitas_tidak_dibayar_perempuan, 0) AS female
  FROM usaha
  JOIN alamat ON alamat.id = usaha.alamat
  JOIN kelurahan ON kelurahan.id = alamat.kelurahan
  JOIN kecamatan ON kecamatan.id = kelurahan.kecamatan
  JOIN kota ON kota.id = kecamatan.kota
  JOIN provinsi ON provinsi.id = kota.provinsi
  LEFT JOIN statistik_tenaga_kerja ON statistik_tenaga_kerja.usaha = usaha.id
  WHERE LOWER(provinsi.nama) = 'jawa barat'
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
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'value', value) ORDER BY value DESC, name ASC), '[]'::jsonb) AS value
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
    sektor_definisi.kode,
    sektor_definisi.nama,
    COUNT(usaha_jawa_barat.id)::integer AS total,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'micro')::integer AS mikro,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'small')::integer AS kecil,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'medium')::integer AS menengah
  FROM sektor_definisi
  LEFT JOIN klasifikasi_usaha ON (
    CASE
      WHEN klasifikasi_usaha.kode ~ '^[0-9]{2,5}$' THEN LEFT(klasifikasi_usaha.kode, 2)::integer
    END
  ) BETWEEN sektor_definisi.divisi_awal AND sektor_definisi.divisi_akhir
  LEFT JOIN usaha_jawa_barat ON usaha_jawa_barat.klasifikasi = klasifikasi_usaha.id
  GROUP BY sektor_definisi.kode, sektor_definisi.nama
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
    jsonb_build_object('code', kode, 'name', nama, 'total', total, 'mikro', mikro, 'kecil', kecil, 'menengah', menengah, 'percentage', percentage)
    ORDER BY total DESC, kode ASC
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
    klasifikasi_usaha.kode AS code,
    klasifikasi_usaha.kategori AS name,
    klasifikasi_usaha.deskripsi AS description,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'micro')::integer AS mikro,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'small')::integer AS kecil,
    COUNT(*) FILTER (WHERE usaha_jawa_barat.skala = 'medium')::integer AS menengah
  FROM klasifikasi_usaha
  JOIN usaha_jawa_barat ON usaha_jawa_barat.klasifikasi = klasifikasi_usaha.id
  GROUP BY klasifikasi_usaha.id, klasifikasi_usaha.kode, klasifikasi_usaha.kategori, klasifikasi_usaha.deskripsi
),
kbli AS (
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'description', description, 'total', total, 'mikro', mikro, 'kecil', kecil, 'menengah', menengah) ORDER BY total DESC, code ASC), '[]'::jsonb) AS all_rows,
    COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'description', description, 'total', total, 'mikro', mikro, 'kecil', kecil, 'menengah', menengah) ORDER BY total DESC, code ASC) FILTER (WHERE rank <= 5), '[]'::jsonb) AS top_rows
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

COMMIT;
