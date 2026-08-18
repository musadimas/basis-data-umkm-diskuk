#!/bin/sh
set -eu

SOURCE_URL="https://geoservices.big.go.id/rbi/rest/services/Hosted/Wilayah_Administrasi_Kabupaten__Kota/FeatureServer/0/query"
HOST_FILE="$(mktemp /tmp/jawa-barat-big.XXXXXX.geojson)"
CONTAINER_FILE="/tmp/jawa-barat-big.geojson"
trap 'rm -f "$HOST_FILE"' EXIT

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

docker cp "$HOST_FILE" "diskuk-postgis-1:$CONTAINER_FILE"
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

COMMIT;
SQL

echo "Imported and validated 27 Jawa Barat kabupaten/kota geometries from BIG."
