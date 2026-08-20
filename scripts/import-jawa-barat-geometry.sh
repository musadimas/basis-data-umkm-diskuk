#!/bin/sh
set -eu

SOURCE_URL="https://geoservices.big.go.id/rbi/rest/services/Hosted/Wilayah_Administrasi_Kabupaten__Kota/FeatureServer/0/query"
VILLAGE_ARCHIVE_URL="https://warga.web.id/files/indonesia/provinces.geojson.tgz"
HOST_FILE="$(mktemp /tmp/jawa-barat-big.XXXXXX.geojson)"
VILLAGE_ARCHIVE="$(mktemp /tmp/jawa-barat-villages.XXXXXX.tgz)"
VILLAGE_FILE="$(mktemp /tmp/jawa-barat-villages.XXXXXX.geojson)"
CONTAINER_FILE="/tmp/jawa-barat-big.geojson"
CONTAINER_VILLAGE_FILE="/tmp/jawa-barat-villages.geojson"
trap 'rm -f "$HOST_FILE" "$VILLAGE_ARCHIVE" "$VILLAGE_FILE"' EXIT

curl --fail --silent --show-error --location --retry 3 --get "$SOURCE_URL" \
  --data-urlencode "where=wadmpr='Jawa Barat'" \
  --data-urlencode "outFields=namobj,wadmkk,wadmpr,kdpkab,tipadm" \
  --data-urlencode "returnGeometry=true" \
  --data-urlencode "outSR=4326" \
  --data-urlencode "maxAllowableOffset=0.001" \
  --data-urlencode "geometryPrecision=6" \
  --data-urlencode "orderByFields=namobj" \
  --data-urlencode "f=geojson" \
  --output "$HOST_FILE"

curl --fail --silent --show-error --location --retry 3 \
  "$VILLAGE_ARCHIVE_URL" --output "$VILLAGE_ARCHIVE"
tar -xOzf "$VILLAGE_ARCHIVE" 32_jawa_barat.geojson > "$VILLAGE_FILE"

docker cp "$HOST_FILE" "diskuk-postgis-1:$CONTAINER_FILE"
docker cp "$VILLAGE_FILE" "diskuk-postgis-1:$CONTAINER_VILLAGE_FILE"
docker compose exec -T postgis chmod 0644 "$CONTAINER_FILE" "$CONTAINER_VILLAGE_FILE"
docker compose exec -T postgis sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
BEGIN;
SET LOCAL diskuk.analytics_bulk_ingest = 'on';

WITH feature AS (
  SELECT value AS item
  FROM jsonb_array_elements((pg_read_file('/tmp/jawa-barat-big.geojson')::jsonb)->'features')
), source AS (
  SELECT
    item->'properties'->>'kdpkab' AS code,
    item->'properties'->>'namobj' AS name,
    (item->'properties'->>'tipadm')::integer AS admin_type,
    ST_Multi(ST_CollectionExtract(ST_MakeValid(
      ST_SetSRID(ST_GeomFromGeoJSON(item->'geometry'), 4326)
    ), 3))::geometry(MultiPolygon, 4326) AS geom
  FROM feature
), matched AS (
  SELECT k.id, s.code, s.geom
  FROM kota k
  JOIN provinsi p ON p.id = k.provinsi
  JOIN source s
    ON regexp_replace(upper(k.nama), '^(KAB\.?|KOTA)\s+', '') = upper(regexp_replace(s.name, '^Kota\s+', '', 'i'))
   AND (
     (upper(k.nama) LIKE 'KOTA %' AND s.admin_type = 5)
     OR (upper(k.nama) LIKE 'KAB.%' AND s.admin_type = 4)
   )
  WHERE lower(p.nama) = 'jawa barat'
)
UPDATE kota k
SET kode = matched.code,
    geom = matched.geom,
    coordinate = ST_PointOnSurface(matched.geom)
FROM matched
WHERE k.id = matched.id;

DO $$
DECLARE ready integer;
BEGIN
  SELECT count(*) INTO ready
  FROM kota k JOIN provinsi p ON p.id = k.provinsi
  WHERE lower(p.nama) = 'jawa barat'
    AND lower(k.nama) <> 'tidak diketahui'
    AND nullif(btrim(k.kode), '') IS NOT NULL
    AND k.geom IS NOT NULL
    AND ST_IsValid(k.geom);
  IF ready <> 27 THEN
    RAISE EXCEPTION 'BIG geometry import incomplete: expected 27, got %', ready;
  END IF;
END $$;

CREATE TEMP TABLE jabar_source_boundary ON COMMIT DROP AS
SELECT
  item->'properties'->>'code' AS code,
  item->'properties'->>'name' AS name,
  left(item->'properties'->>'code', 8) AS kec_code,
  left(item->'properties'->>'code', 5) AS city_code,
  ST_Multi(ST_CollectionExtract(ST_MakeValid(
    ST_SetSRID(ST_GeomFromGeoJSON(item->'geometry'), 4326)
  ), 3))::geometry(MultiPolygon, 4326) AS geom
FROM jsonb_array_elements(
  (pg_read_file('/tmp/jawa-barat-villages.geojson')::jsonb)->'features'
) item;

CREATE INDEX jabar_source_boundary_geom_idx ON jabar_source_boundary USING gist(geom);
CREATE INDEX jabar_source_boundary_kec_idx ON jabar_source_boundary(kec_code);
ANALYZE jabar_source_boundary;

DO $$
DECLARE
  villages integer;
  districts integer;
  cities integer;
BEGIN
  SELECT count(*), count(DISTINCT kec_code), count(DISTINCT city_code)
  INTO villages, districts, cities
  FROM jabar_source_boundary
  WHERE code ~ '^32[.][0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
    AND geom IS NOT NULL AND NOT ST_IsEmpty(geom) AND ST_IsValid(geom);

  IF villages < 5900 OR districts <> 627 OR cities <> 27 THEN
    RAISE EXCEPTION 'Village boundary source incomplete: villages %, districts %, cities %',
      villages, districts, cities;
  END IF;
END $$;

CREATE TEMP TABLE jabar_kecamatan_match ON COMMIT DROP AS
WITH db_kecamatan AS (
  SELECT kc.id, kc.kota, count(kl.id)::integer AS village_count
  FROM kecamatan kc
  JOIN kota ko ON ko.id = kc.kota
  JOIN provinsi p ON p.id = ko.provinsi
  LEFT JOIN kelurahan kl ON kl.kecamatan = kc.id
  WHERE lower(p.nama) = 'jawa barat'
    AND ko.kode IS NOT NULL
    AND lower(kc.nama) <> 'tidak diketahui'
  GROUP BY kc.id, kc.kota
), source_kecamatan AS (
  SELECT kec_code, city_code, count(*)::integer AS village_count
  FROM jabar_source_boundary
  GROUP BY kec_code, city_code
), candidates AS (
  SELECT
    db.id AS db_id,
    source.kec_code,
    db.village_count AS db_count,
    source.village_count AS source_count,
    count(*) FILTER (WHERE boundary.code IS NOT NULL)::integer AS shared
  FROM db_kecamatan db
  JOIN kota ko ON ko.id = db.kota
  JOIN source_kecamatan source ON source.city_code = ko.kode
  LEFT JOIN kelurahan kl ON kl.kecamatan = db.id
  LEFT JOIN jabar_source_boundary boundary
    ON boundary.kec_code = source.kec_code
   AND regexp_replace(lower(kl.nama), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(boundary.name), '[^a-z0-9]', '', 'g')
  GROUP BY db.id, source.kec_code, db.village_count, source.village_count
), ranked AS (
  SELECT *,
    row_number() OVER (PARTITION BY db_id ORDER BY shared DESC, kec_code) AS db_rank,
    row_number() OVER (PARTITION BY kec_code ORDER BY shared DESC, db_id) AS source_rank
  FROM candidates
)
SELECT db_id, kec_code
FROM ranked
WHERE db_rank = 1 AND source_rank = 1
  AND shared >= 2
  AND shared * 2 >= least(db_count, source_count);

CREATE UNIQUE INDEX jabar_kecamatan_match_db_idx ON jabar_kecamatan_match(db_id);
CREATE UNIQUE INDEX jabar_kecamatan_match_source_idx ON jabar_kecamatan_match(kec_code);

CREATE TEMP TABLE jabar_kelurahan_exact ON COMMIT DROP AS
SELECT kl.id AS db_id, boundary.code, boundary.geom
FROM kelurahan kl
JOIN jabar_kecamatan_match match ON match.db_id = kl.kecamatan
JOIN jabar_source_boundary boundary ON boundary.kec_code = match.kec_code
WHERE regexp_replace(lower(kl.nama), '[^a-z0-9]', '', 'g')
    = regexp_replace(lower(boundary.name), '[^a-z0-9]', '', 'g');

CREATE UNIQUE INDEX jabar_kelurahan_exact_db_idx ON jabar_kelurahan_exact(db_id);
CREATE UNIQUE INDEX jabar_kelurahan_exact_source_idx ON jabar_kelurahan_exact(code);

CREATE TEMP TABLE jabar_kelurahan_spatial ON COMMIT DROP AS
WITH unmatched AS (
  SELECT kl.id, match.kec_code
  FROM kelurahan kl
  JOIN jabar_kecamatan_match match ON match.db_id = kl.kecamatan
  LEFT JOIN jabar_kelurahan_exact exact ON exact.db_id = kl.id
  WHERE exact.db_id IS NULL AND lower(kl.nama) <> 'tidak diketahui'
), sampled AS (
  -- ponytail: cap typo verification at 200 points; raise only if the coverage guard starts failing.
  SELECT unmatched.id, unmatched.kec_code, point.longitude, point.latitude
  FROM unmatched
  CROSS JOIN LATERAL (
    SELECT u.longitude, u.latitude
    FROM alamat a
    JOIN usaha u ON u.alamat = a.id
    WHERE a.kelurahan = unmatched.id
      AND u.longitude BETWEEN 106 AND 110
      AND u.latitude BETWEEN -9 AND -5
    ORDER BY u.id
    LIMIT 200
  ) point
), totals AS (
  SELECT id, count(*)::integer AS total FROM sampled GROUP BY id
), hits AS (
  SELECT sample.id, boundary.code, count(*)::integer AS inside
  FROM sampled sample
  JOIN jabar_source_boundary boundary
    ON boundary.kec_code = sample.kec_code
   AND boundary.geom && ST_SetSRID(ST_Point(sample.longitude, sample.latitude), 4326)
   AND ST_Covers(boundary.geom, ST_SetSRID(ST_Point(sample.longitude, sample.latitude), 4326))
  LEFT JOIN jabar_kelurahan_exact exact ON exact.code = boundary.code
  WHERE exact.code IS NULL
  GROUP BY sample.id, boundary.code
), ranked AS (
  SELECT hits.*, totals.total,
    row_number() OVER (PARTITION BY hits.id ORDER BY hits.inside DESC, hits.code) AS db_rank,
    row_number() OVER (PARTITION BY hits.code ORDER BY hits.inside DESC, hits.id) AS source_rank,
    lead(hits.inside, 1, 0) OVER (
      PARTITION BY hits.id ORDER BY hits.inside DESC, hits.code
    ) AS second_inside
  FROM hits
  JOIN totals USING (id)
)
SELECT ranked.id AS db_id, ranked.code, boundary.geom
FROM ranked
JOIN jabar_source_boundary boundary ON boundary.code = ranked.code
WHERE ranked.db_rank = 1 AND ranked.source_rank = 1
  AND ranked.inside >= 5
  AND ranked.inside * 2 >= ranked.total
  AND ranked.inside >= ranked.second_inside * 2;

CREATE TEMP TABLE jabar_kelurahan_match ON COMMIT DROP AS
SELECT db_id, code, geom FROM jabar_kelurahan_exact
UNION ALL
SELECT db_id, code, geom FROM jabar_kelurahan_spatial;

WITH dissolved AS (
  SELECT
    match.db_id,
    match.kec_code,
    ST_Multi(ST_CollectionExtract(ST_MakeValid(
      ST_UnaryUnion(ST_Collect(boundary.geom))
    ), 3))::geometry(MultiPolygon, 4326) AS geom
  FROM jabar_kecamatan_match match
  JOIN jabar_source_boundary boundary ON boundary.kec_code = match.kec_code
  GROUP BY match.db_id, match.kec_code
)
UPDATE kecamatan
SET kode = dissolved.kec_code,
    geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(
      ST_SimplifyPreserveTopology(dissolved.geom, 0.0003)
    ), 3))::geometry(MultiPolygon, 4326),
    coordinate = ST_PointOnSurface(dissolved.geom)
FROM dissolved
WHERE kecamatan.id = dissolved.db_id;

UPDATE kelurahan
SET kode = match.code,
    geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(
      ST_SimplifyPreserveTopology(match.geom, 0.0001)
    ), 3))::geometry(MultiPolygon, 4326),
    coordinate = ST_PointOnSurface(match.geom)
FROM jabar_kelurahan_match match
WHERE kelurahan.id = match.db_id;

DO $$
DECLARE
  ready_kecamatan integer;
  ready_kelurahan integer;
  covered numeric;
BEGIN
  SELECT count(*) INTO ready_kecamatan FROM jabar_kecamatan_match;
  SELECT count(*) INTO ready_kelurahan FROM jabar_kelurahan_match;
  SELECT 100.0 * count(*) FILTER (WHERE match.db_id IS NOT NULL) / count(*)
  INTO covered
  FROM alamat a
  JOIN kelurahan kl ON kl.id = a.kelurahan
  JOIN kecamatan kc ON kc.id = kl.kecamatan
  JOIN kota ko ON ko.id = kc.kota
  JOIN provinsi p ON p.id = ko.provinsi
  LEFT JOIN jabar_kelurahan_match match ON match.db_id = kl.id
  WHERE lower(p.nama) = 'jawa barat';

  IF ready_kecamatan <> 627 OR ready_kelurahan < 5950 OR covered < 99.8 THEN
    RAISE EXCEPTION 'Lower boundary import incomplete: kecamatan %, kelurahan %, address coverage %% %',
      ready_kecamatan, ready_kelurahan, round(covered, 4);
  END IF;
END $$;

COMMIT;
SQL

echo "Imported 27 kabupaten/kota, 627 kecamatan, and at least 5,950 desa/kelurahan boundaries."
