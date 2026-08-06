#!/bin/sh
set -e

# ----------------------------
# Directus init & migrate script (wait for spatial schema)
# ----------------------------

# Default values, can override with env
DB_HOST=${DB_HOST}       # Use env or default
DB_PORT=${DB_PORT}
DB_DATABASE=${DB_DATABASE}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Wait until PostgreSQL is ready
until RESULT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_DATABASE" -c "\q" 2>&1); do
  echo "Postgres is unavailable - sleeping 2s..."
  echo "Last error: $RESULT"
  sleep 2
done
echo "PostgreSQL is up - checking for spatial schema..."

# Poll until spatial schema exists
while true; do
  SCHEMA_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_DATABASE -tAc \
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name='spatial';")
  
  if [ "$SCHEMA_EXISTS" = "spatial" ]; then
    echo "Spatial schema exists."
    break
  else
    echo "Spatial schema not found - waiting 2s..."
    sleep 2
  fi
done

# Check if Directus is already installed (tables exist)
TABLE_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -p $DB_PORT -d $DB_DATABASE -tAc \
  "SELECT to_regclass('public.directus_users');")

if [ "$TABLE_EXISTS" = "directus_users" ]; then
  echo "Directus already installed, skipping install..."
else
  echo "Running database install..."
  npx directus database install
fi

echo "Running database migrations to latest..."
npx directus database migrate:latest

echo "Directus init/migrate complete."

# Start Directus
exec npx directus start