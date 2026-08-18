#!/bin/sh
set -eu
[ "${CONFIRM_OBJECT_RESTORE:-}" = isolated-test ] || { echo '{"status":"blocked","reason":"confirmation_required"}' >&2; exit 2; }
: "${OBJECT_RESTORE_BUCKET:?OBJECT_RESTORE_BUCKET is required}"; : "${OBJECT_SOURCE_PREFIX:?OBJECT_SOURCE_PREFIX is required}"; : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"; : "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"; : "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
case "$OBJECT_RESTORE_BUCKET" in production|directus|"${DIRECTUS_BUCKET:-__none__}") echo '{"status":"blocked","reason":"production_bucket_refused"}' >&2; exit 2;; esac
case "$OBJECT_RESTORE_BUCKET" in *existing*) echo '{"status":"blocked","reason":"target_must_be_new"}' >&2; exit 2;; esac
mc alias set restore "$BACKUP_S3_ENDPOINT" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" >/dev/null
mc mb --ignore-existing "restore/$OBJECT_RESTORE_BUCKET" >/dev/null
mc mirror "restore/$OBJECT_SOURCE_PREFIX" "restore/$OBJECT_RESTORE_BUCKET" >/dev/null
echo '{"status":"completed","operation":"object_restore","target":"isolated"}'
