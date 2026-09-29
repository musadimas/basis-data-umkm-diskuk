#!/usr/bin/env bash
# Template database Postgres ter-migrasi untuk tes (Gelombang 1, Kandidat 04).
#
# Idempoten: setiap kali dijalankan, template dibangun ulang dari nol sehingga selalu
# mencerminkan folder migrations di working tree. Harness (test-support/pg-harness.mjs)
# memeriksa hash isi folder ini lewat COMMENT database; bila berbeda, tes menolak jalan
# dengan pesan "jalankan scripts/test-db-template.sh".
#
# Pemakaian:
#   bash scripts/test-db-template.sh
#   DISKUK_TEST_PG_URL="postgres://<DB_USER>:<DB_PASSWORD>@127.0.0.1:15432/postgres" \
#     node --test services/directus/extensions/program/test/pg/smoke.test.js
#
# Override (opsional): DISKUK_TEST_COMPOSE_PROJECT, DISKUK_TEST_ENV_FILE,
# DISKUK_TEST_OVERRIDE_FILE, DISKUK_TEST_TEMPLATE_DB.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${DISKUK_TEST_COMPOSE_PROJECT:-diskuk-operasional-e2e}"
ENV_FILE="${DISKUK_TEST_ENV_FILE:-/tmp/operasional-e2e.env}"
OVERRIDE_FILE="${DISKUK_TEST_OVERRIDE_FILE:-/tmp/operasional-e2e.override.yml}"
TEMPLATE_DB="${DISKUK_TEST_TEMPLATE_DB:-diskuk_test_template}"
MIGRATIONS_DIR="$ROOT/services/directus/migrations"
SPATIAL_SQL="$ROOT/services/storage/pg/init-scripts/01-create-spatial-schema.sql"

[ -f "$ENV_FILE" ] || { echo "env file tidak ditemukan: $ENV_FILE (set DISKUK_TEST_ENV_FILE)" >&2; exit 1; }
[ -d "$MIGRATIONS_DIR" ] || { echo "folder migrations tidak ditemukan: $MIGRATIONS_DIR" >&2; exit 1; }

COMPOSE_FILES=(-f "$ROOT/docker-compose.yml")
[ -f "$OVERRIDE_FILE" ] && COMPOSE_FILES+=(-f "$OVERRIDE_FILE")

compose() { docker compose -p "$PROJECT" "${COMPOSE_FILES[@]}" --env-file "$ENV_FILE" "$@"; }

if [ -z "$(compose ps -q postgis)" ]; then
  echo "service postgis belum jalan di project $PROJECT; jalankan stack disposable dulu" >&2
  exit 1
fi

hash_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | awk '{print $1}'; else shasum -a 256 | awk '{print $1}'; fi
}
MIGRATION_HASH="$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.js' | LC_ALL=C sort | while IFS= read -r file; do cat "$file"; done | hash_sha256)"
[ -n "$MIGRATION_HASH" ] || { echo "hash migrations kosong" >&2; exit 1; }

# psql dijalankan di dalam container postgis supaya kredensial tidak perlu dikutip ulang di host.
psql_db() {
  local db="$1"; shift
  compose exec -T postgis sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$0" "$@"' "$db" "$@"
}

echo "==> membuat ulang database template $TEMPLATE_DB (hash migrations $MIGRATION_HASH)"
# Database yang ditandai IS_TEMPLATE tidak boleh di-drop langsung; lepas flag dulu.
if [ "$(psql_db postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TEMPLATE_DB'")" = "1" ]; then
  psql_db postgres -c "ALTER DATABASE \"$TEMPLATE_DB\" WITH IS_TEMPLATE false ALLOW_CONNECTIONS true" >/dev/null
fi
psql_db postgres -c "DROP DATABASE IF EXISTS \"$TEMPLATE_DB\" WITH (FORCE)" >/dev/null
psql_db postgres -c "CREATE DATABASE \"$TEMPLATE_DB\"" >/dev/null
psql_db "$TEMPLATE_DB" -f - < "$SPATIAL_SQL" >/dev/null

echo "==> install + migrate Directus di $TEMPLATE_DB lewat image directus (DB_HOST=postgis)"
compose run --rm --no-deps \
  --entrypoint sh \
  -v "$MIGRATIONS_DIR:/directus/migrations:ro" \
  -e DB_HOST=postgis -e DB_DATABASE="$TEMPLATE_DB" \
  directus -c "npx directus database install && npx directus database migrate:latest"

echo "==> menandai template (IS_TEMPLATE, ALLOW_CONNECTIONS false) + hash"
psql_db postgres -c "ALTER DATABASE \"$TEMPLATE_DB\" WITH IS_TEMPLATE true ALLOW_CONNECTIONS false"
psql_db postgres -c "COMMENT ON DATABASE \"$TEMPLATE_DB\" IS '$MIGRATION_HASH'"

echo "==> selesai. Contoh perintah tes:"
echo "    DISKUK_TEST_PG_URL='postgres://<DB_USER>:<DB_PASSWORD>@127.0.0.1:15432/postgres' node --test services/directus/extensions/program/test/pg/smoke.test.js"
