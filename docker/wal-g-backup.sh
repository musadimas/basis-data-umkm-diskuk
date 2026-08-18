#!/bin/sh
set -eu
: "${WALG_S3_PREFIX:?WALG_S3_PREFIX is required}"; : "${WALG_S3_REGION:?WALG_S3_REGION is required}"; : "${WALG_S3_ACCESS_KEY:?WALG_S3_ACCESS_KEY is required}"; : "${WALG_S3_SECRET_KEY:?WALG_S3_SECRET_KEY is required}"; : "${PGDATA:?PGDATA is required}"
case "$WALG_S3_PREFIX" in *localhost*|*127.0.0.1*|*minio*|*://diskuk/*) echo '{"status":"blocked","reason":"offhost_backup_required"}' >&2; exit 2;; esac
lock="${WALG_LOCK_FILE:-/tmp/wal-g-backup.lock}"; if ! (set -C; : >"$lock") 2>/dev/null; then echo '{"status":"busy"}'; exit 0; fi
trap 'rm -f "$lock"' EXIT
wal-g backup-push "$PGDATA" >/dev/null
wal-g backup-list >/dev/null
echo '{"status":"completed","operation":"base_backup"}'
