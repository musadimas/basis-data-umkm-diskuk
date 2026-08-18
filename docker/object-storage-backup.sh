#!/bin/sh
set -eu
: "${DIRECTUS_OBJECT_SOURCE:?DIRECTUS_OBJECT_SOURCE is required}"; : "${BACKUP_OBJECT_PREFIX:?BACKUP_OBJECT_PREFIX is required}"; : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"; : "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"; : "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
case "$BACKUP_S3_ENDPOINT" in *localhost*|*127.0.0.1*|*minio*) echo '{"status":"blocked","reason":"offhost_backup_required"}' >&2; exit 2;; esac
mc alias set backup "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" >/dev/null
mc mirror --overwrite "$DIRECTUS_OBJECT_SOURCE" "backup/$BACKUP_OBJECT_PREFIX" >/dev/null
echo '{"status":"completed","operation":"object_backup"}'
