#!/bin/sh
set -eu

# Bangun arsip PMTiles titik UMKM (pre-clustered) dari snapshot `usaha_tabular`,
# unggah ke MinIO, dan daftarkan metadata tileset pada `infografis_snapshot`.
#
# Jalankan dari root repositori lokal setelah ingest SIDT + publish snapshot:
#   sh scripts/build-spatial-tiles.sh
#
# Data dibaca dari stack staging melalui SSH, Tippecanoe berjalan di Docker
# lokal, lalu arsip diunggah ke MinIO staging tanpa menyalin kredensial ke lokal.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_TARGET="${SSH_TARGET:-fuad}"
REMOTE_ROOT="${REMOTE_ROOT:-/root/basis-data-umkm-diskuk}"
TIPPECANOE_BIN="${TIPPECANOE_BIN:-tippecanoe}"
TIPPECANOE_DECODE_BIN="${TIPPECANOE_DECODE_BIN:-tippecanoe-decode}"
JQ_BIN="${JQ_BIN:-jq}"
MC_IMAGE="minio/mc:RELEASE.2024-11-21T17-21-54Z"
TILE_PREFIX="spatial-tiles"
CLUSTER_DISTANCE="${CLUSTER_DISTANCE:-40}"

WORKDIR="$(mktemp -d /tmp/spatial-tiles.XXXXXX)"
REMOTE_ARCHIVE=""
cleanup() {
  rm -rf "$WORKDIR"
  case "$REMOTE_ARCHIVE" in
    /tmp/umkm-points.*.pmtiles) ssh "$SSH_TARGET" "rm -f '$REMOTE_ARCHIVE'" >/dev/null 2>&1 || true ;;
  esac
}
trap cleanup EXIT
NDJSON="$WORKDIR/umkm-points.ndjson"
ARCHIVE="$WORKDIR/umkm-points.pmtiles"

log() { printf '\033[1;36m[spatial-tiles]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[spatial-tiles]\033[0m %s\n' "$*" >&2; exit 1; }

command -v "$TIPPECANOE_BIN" >/dev/null 2>&1 || die "tippecanoe is not installed locally"
command -v "$TIPPECANOE_DECODE_BIN" >/dev/null 2>&1 || die "tippecanoe-decode is not installed locally"
command -v "$JQ_BIN" >/dev/null 2>&1 || die "jq is not installed locally"

# 1) Stream feature GeoJSON per baris (NDJSON) dari snapshot berkoordinat.
#    Skala dipetakan ke nilai union frontend (mikro/kecil/menengah) agar filter
#    setFilter cocok tanpa translasi di browser. Batas koordinat mengikuti
#    sanity check import geometri (kotak Jawa Barat).
log "streaming geocoded rows from $SSH_TARGET:$REMOTE_ROOT"
SNAPSHOT_STATE="$(ssh "$SSH_TARGET" "cd '$REMOTE_ROOT' && docker compose exec -T postgis sh -lc 'psql -Atq -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -c \"SELECT g.active_generation_id || '\''|'\'' || EXTRACT(EPOCH FROM s.refreshed_at) FROM analitik_active_generation g CROSS JOIN infografis_snapshot s WHERE g.id = 1 AND s.id = 1\"'")"
GENERATION_ID="${SNAPSHOT_STATE%%|*}"
SNAPSHOT_EPOCH="${SNAPSHOT_STATE#*|}"
case "$GENERATION_ID" in
  ""|*[!0-9a-fA-F-]*) die "active analytics generation is unavailable or invalid" ;;
esac
[ "${#GENERATION_ID}" -eq 36 ] || die "active analytics generation is unavailable or invalid"
case "$SNAPSHOT_EPOCH" in
  ""|*[!0-9.]*) die "dashboard snapshot version is unavailable or invalid" ;;
esac
[ "$SNAPSHOT_EPOCH" != "$SNAPSHOT_STATE" ] || die "dashboard snapshot version is unavailable or invalid"

# Baca snapshot dashboard yang sama dengan endpoint tabular/spasial. Snapshot
# version dan generation id di atas mencegah hasil build lama didaftarkan bila
# publikasi baru atau refresh snapshot legacy terjadi selama proses berlangsung.
ssh "$SSH_TARGET" "cd '$REMOTE_ROOT' && docker compose exec -T postgis sh -lc 'psql -q -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1'" <<'SQL' > "$NDJSON"
COPY (
SELECT jsonb_build_object(
  'type', 'Feature',
  'properties', jsonb_build_object(
    'id', t.id,
    'nama', t.nama,
    'skala', CASE t.skala
      WHEN 'small' THEN 'kecil'
      WHEN 'medium' THEN 'menengah'
      ELSE 'mikro'
    END,
    'produk', COALESCE(t.produk_utama, ''),
    'kota', COALESCE(t.kota_nama, ''),
    'kecamatan', COALESCE(t.kecamatan_nama, '')
  ),
  'geometry', jsonb_build_object(
    'type', 'Point',
    'coordinates', jsonb_build_array(t.longitude::float8, t.latitude::float8)
  )
)
FROM usaha_tabular t
WHERE t.latitude IS NOT NULL AND t.longitude IS NOT NULL
  AND t.longitude BETWEEN 106 AND 110
  AND t.latitude BETWEEN -9 AND -5
) TO STDOUT WITH (FORMAT CSV, DELIMITER E'\t', QUOTE E'\x01', ESCAPE E'\x01');
SQL

POINT_COUNT="$(wc -l < "$NDJSON" | tr -d ' ')"
[ "$POINT_COUNT" -gt 0 ] || die "no geocoded rows found; refusing to publish an empty tileset"
log "exported $POINT_COUNT features"

# 2) Bangun arsip PMTiles dengan klaster build-time (tippecanoe --cluster-distance).
#    Fitur hasil merge membawa atribut `point_count` berisi jumlah anggota klaster.
log "building pmtiles archive with $TIPPECANOE_BIN"
"$TIPPECANOE_BIN" \
  -o "$ARCHIVE" \
  --layer=umkm \
  --minimum-zoom=3 --maximum-zoom=14 \
  --drop-rate=1 \
  --cluster-distance="$CLUSTER_DISTANCE" \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --force "$NDJSON"
[ -s "$ARCHIVE" ] || die "tippecanoe did not produce an archive"

# Verifikasi seluruh titik masih terwakili pada zoom minimum. Pemeriksaan lama
# hanya mencari string `point_count`, yang juga muncul di metadata walaupun
# fitur sebenarnya sudah dibuang oleh rate dropping.
DECODED_MIN_ZOOM="$WORKDIR/min-zoom.json"
log "verifying low-zoom point coverage"
"$TIPPECANOE_DECODE_BIN" -Z 3 -z 3 "$ARCHIVE" > "$DECODED_MIN_ZOOM"
DECODED_POINT_COUNT="$("$JQ_BIN" -er '
  [.. | objects
    | select(.type == "Feature" and .geometry.type? == "Point")
    | ((.properties.point_count // 1) | tonumber)]
  | add // 0
' "$DECODED_MIN_ZOOM")" || die "unable to count low-zoom PMTiles features"
case "$DECODED_POINT_COUNT" in
  ''|*[!0-9]*) die "invalid low-zoom point count: $DECODED_POINT_COUNT" ;;
esac
[ "$DECODED_POINT_COUNT" -eq "$POINT_COUNT" ] \
  || die "low zoom represents $DECODED_POINT_COUNT of $POINT_COUNT points; refusing to publish"
log "verified all $POINT_COUNT points at minimum zoom"

# 3) Unggah ke MinIO dengan key content-addressed. Dua build hanya memakai key
#    yang sama bila generation dan byte arsipnya sama, sehingga concurrent build
#    tidak dapat menimpa metadata yang sudah menunjuk ke byte berbeda.
if command -v sha256sum >/dev/null 2>&1; then
  ARCHIVE_SHA="$(sha256sum "$ARCHIVE")"
  ARCHIVE_SHA="${ARCHIVE_SHA%% *}"
elif command -v shasum >/dev/null 2>&1; then
  ARCHIVE_SHA="$(shasum -a 256 "$ARCHIVE")"
  ARCHIVE_SHA="${ARCHIVE_SHA%% *}"
else
  die "sha256sum or shasum is required to create an immutable archive key"
fi
case "$ARCHIVE_SHA" in
  ""|*[!0-9a-fA-F]*) die "unable to calculate archive SHA-256" ;;
esac
[ "${#ARCHIVE_SHA}" -eq 64 ] || die "unable to calculate archive SHA-256"

UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
VERSIONED_KEY="$TILE_PREFIX/umkm-points-$GENERATION_ID-$ARCHIVE_SHA.pmtiles"

REMOTE_ARCHIVE="$(ssh "$SSH_TARGET" 'mktemp /tmp/umkm-points.XXXXXX.pmtiles')"
case "$REMOTE_ARCHIVE" in
  /tmp/umkm-points.*.pmtiles) ;;
  *) die "unexpected remote temporary path: $REMOTE_ARCHIVE" ;;
esac
log "uploading archive to $SSH_TARGET MinIO"
scp -q "$ARCHIVE" "$SSH_TARGET:$REMOTE_ARCHIVE"

# 4) Unggah dan daftarkan metadata di staging. Kredensial hanya dibaca oleh
#    shell remote dan diteruskan ke container mc di host tersebut.
ssh "$SSH_TARGET" sh -s -- \
  "$REMOTE_ROOT" "$REMOTE_ARCHIVE" "$VERSIONED_KEY" "$UPDATED_AT" "$POINT_COUNT" \
  "$MC_IMAGE" "$TILE_PREFIX" "$GENERATION_ID" "$SNAPSHOT_EPOCH" <<'REMOTE'
set -eu
REMOTE_ROOT="$1"
ARCHIVE="$2"
VERSIONED_KEY="$3"
UPDATED_AT="$4"
POINT_COUNT="$5"
MC_IMAGE="$6"
TILE_PREFIX="$7"
GENERATION_ID="$8"
SNAPSHOT_EPOCH="$9"

cd "$REMOTE_ROOT"
set -a
. ./.env
set +a
: "${ANALYTICS_EXPORT_BUCKET:?missing ANALYTICS_EXPORT_BUCKET in remote .env}"
: "${MINIO_ROOT_USER:?missing MINIO_ROOT_USER in remote .env}"
: "${MINIO_ROOT_PASSWORD:?missing MINIO_ROOT_PASSWORD in remote .env}"

docker run --rm --entrypoint=/bin/sh --network diskuk_net \
  -e MINIO_ROOT_USER -e MINIO_ROOT_PASSWORD \
  -e "BUCKET=$ANALYTICS_EXPORT_BUCKET" -e "VERSIONED_KEY=$VERSIONED_KEY" \
  -e "TILE_PREFIX=$TILE_PREFIX" \
  -v "$(dirname "$ARCHIVE"):/data:ro" "$MC_IMAGE" -c '
    set -eu
    mc alias set myminio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc cp --quiet "/data/'"$(basename "$ARCHIVE")"'" "myminio/$BUCKET/$VERSIONED_KEY"
    mc anonymous set download "myminio/$BUCKET/$TILE_PREFIX" >/dev/null
    # ponytail: versi arsip dibiarkan; tambahkan lifecycle bucket bila pertumbuhan storage terukur.
  '

TILE_URL="/tiles/${VERSIONED_KEY##*/}"
PUBLISHED_ID="$(docker compose exec -T postgis sh -lc 'psql -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<SQL
BEGIN;
SELECT g.active_generation_id AS locked_generation_id,
       EXTRACT(EPOCH FROM s.refreshed_at) AS locked_snapshot_epoch
FROM analitik_active_generation g
CROSS JOIN infografis_snapshot s
WHERE g.id = 1 AND s.id = 1
FOR SHARE OF g
FOR UPDATE OF s \gset

UPDATE infografis_snapshot
SET payload = jsonb_set(
  payload,
  '{spatialTiles}',
  jsonb_build_object(
    'url', '$TILE_URL',
    'updatedAt', '$UPDATED_AT',
    'pointCount', $POINT_COUNT::integer,
    'generationId', '$GENERATION_ID'
  ),
  true
)
WHERE id = 1
  AND :'locked_generation_id'::uuid = '$GENERATION_ID'::uuid
  AND :'locked_snapshot_epoch'::numeric = $SNAPSHOT_EPOCH::numeric
  AND EXTRACT(EPOCH FROM refreshed_at) = $SNAPSHOT_EPOCH::numeric
RETURNING id;
COMMIT;
SQL
)"
[ "$PUBLISHED_ID" = "1" ] || {
  printf '%s\n' "analytics generation or dashboard snapshot changed during tile build; archive was not registered" >&2
  exit 1
}
printf '%s\n' "$ANALYTICS_EXPORT_BUCKET"
REMOTE

log "done: $POINT_COUNT points in $VERSIONED_KEY (registered $UPDATED_AT)"
