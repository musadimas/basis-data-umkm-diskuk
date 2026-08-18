
\set ON_ERROR_STOP on
WITH source_scope AS MATERIALIZED (
  SELECT u.id, u.status, u.skala, u.sumber_id, u.nib, u.source_pulled_at, u.source_updated_at,
         u.omzet_tahunan, u.total_aset, u.alamat, u.klasifikasi,
         p.id AS provinsi_id, ko.id AS kota_id, kc.id AS kecamatan_id, kl.id AS kelurahan_id,
         kk.kode AS kode_kbli
  FROM usaha u
  LEFT JOIN alamat a ON a.id = u.alamat
  LEFT JOIN kelurahan kl ON kl.id = a.kelurahan
  LEFT JOIN kecamatan kc ON kc.id = kl.kecamatan
  LEFT JOIN kota ko ON ko.id = kc.kota
  LEFT JOIN provinsi p ON p.id = ko.provinsi
  LEFT JOIN klasifikasi_usaha kk ON kk.id = u.klasifikasi
  WHERE p.id IS NULL OR lower(p.nama) = 'jawa barat'
),
sector_def(kode, lo, hi) AS (VALUES
 ('A',1,3),('B',5,9),('C',10,33),('D',35,35),('E',36,39),('F',41,43),('G',45,47),
 ('H',49,53),('I',55,56),('J',58,63),('K',64,66),('L',68,68),('M',69,75),('N',77,82),
 ('O',84,84),('P',85,85),('Q',86,88),('R',90,93),('S',94,96),('T',97,98),('U',99,99)
),
classified AS (
  SELECT s.id, sd.kode
  FROM source_scope s LEFT JOIN sector_def sd ON s.kode_kbli ~ '^[0-9]{2,5}$' AND left(s.kode_kbli,2)::integer BETWEEN sd.lo AND sd.hi
),
geometry AS (
  SELECT count(*) FILTER (WHERE lower(p.nama)='jawa barat') AS city_count,
         count(*) FILTER (WHERE lower(p.nama)='jawa barat' AND nullif(btrim(k.kode),'') IS NOT NULL AND k.geom IS NOT NULL) AS city_geometry_ready
  FROM kota k JOIN provinsi p ON p.id=k.provinsi
),
counts AS (
  SELECT
    count(*) FILTER (WHERE status='active')::integer AS active_source,
    count(*) FILTER (WHERE status='archived')::integer AS archived_source,
    count(*) FILTER (WHERE status='active' AND sumber_id IS NULL)::integer AS manual_source,
    count(*) FILTER (WHERE status='active' AND source_pulled_at IS NULL AND source_updated_at IS NULL)::integer AS source_time_missing_or_invalid,
    count(*) FILTER (WHERE status='active' AND kota_id IS NULL)::integer AS unknown_city,
    count(*) FILTER (WHERE status='active' AND kecamatan_id IS NULL)::integer AS unknown_district,
    count(*) FILTER (WHERE status='active' AND kelurahan_id IS NULL)::integer AS unknown_village,
    count(*) FILTER (WHERE status='active' AND skala IS NULL)::integer AS scale_unknown,
    count(*) FILTER (WHERE status='active' AND kode_kbli IS NULL)::integer AS kbli_missing,
    count(*) FILTER (WHERE status='active' AND kode_kbli !~ '^[0-9]{2,5}$')::integer AS kbli_nonnumeric_or_length,
    count(*) FILTER (WHERE status='active' AND kode_kbli ~ '^[0-9]{2,5}$' AND NOT EXISTS (SELECT 1 FROM sector_def sd WHERE left(kode_kbli,2)::integer BETWEEN sd.lo AND sd.hi))::integer AS kbli_out_of_range,
    count(*) FILTER (WHERE status='active' AND omzet_tahunan IS NOT NULL)::integer AS financial_omzet_reported,
    count(*) FILTER (WHERE status='active' AND total_aset IS NOT NULL)::integer AS financial_asset_reported,
    count(*) FILTER (WHERE status='active' AND omzet_tahunan < 0)::integer AS financial_omzet_invalid,
    count(*) FILTER (WHERE status='active' AND total_aset < 0)::integer AS financial_asset_invalid
  FROM source_scope
),
snapshot AS (
  SELECT count(*) FILTER (WHERE u.status='active')::integer AS active_snapshot
  FROM usaha_tabular t JOIN usaha u ON u.id=t.id
),
sector_counts AS (
  SELECT count(*) FILTER (WHERE s.status='active' AND c.kode IS NOT NULL)::integer AS mapped,
         count(*) FILTER (WHERE s.status='active' AND c.kode IS NULL)::integer AS unmapped
  FROM source_scope s JOIN classified c ON c.id=s.id
),
summary AS (
  SELECT jsonb_build_object(
    'activeSource', c.active_source, 'archivedSource', c.archived_source, 'manualSource', c.manual_source,
    'activeSnapshot', sn.active_snapshot, 'sourceTimeMissingOrInvalid', c.source_time_missing_or_invalid,
    'geography', jsonb_build_object('unknownCity',c.unknown_city,'unknownDistrict',c.unknown_district,'unknownVillage',c.unknown_village),
    'scale', jsonb_build_object('unknown',c.scale_unknown),
    'kbli', jsonb_build_object('missing',c.kbli_missing,'nonnumericOrLength',c.kbli_nonnumeric_or_length,'outOfRange',c.kbli_out_of_range,'mapped',sc.mapped,'unmapped',sc.unmapped),
    'financial', jsonb_build_object('omzetReported',c.financial_omzet_reported,'assetReported',c.financial_asset_reported,'omzetInvalid',c.financial_omzet_invalid,'assetInvalid',c.financial_asset_invalid),
    'authoritativeGeometry', jsonb_build_object('regions',g.city_count,'complete',g.city_geometry_ready),
    'workforcePresent', EXISTS (SELECT 1 FROM statistik_tenaga_kerja),
    'financialReady', c.financial_omzet_invalid=0 AND c.financial_asset_invalid=0 AND GREATEST(c.financial_omzet_reported,c.financial_asset_reported) >= CEIL(c.active_source*0.8)
  ) AS report,
  (c.active_source = sn.active_snapshot
   AND g.city_count = 27 AND g.city_geometry_ready = 27
   AND c.active_source = sc.mapped + sc.unmapped
   AND c.active_source = (c.active_source-c.scale_unknown) + c.scale_unknown) AS ready
  FROM counts c CROSS JOIN snapshot sn CROSS JOIN sector_counts sc CROSS JOIN geometry g
)
SELECT report, ready FROM summary;
