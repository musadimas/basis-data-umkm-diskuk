#!/bin/sh
set -eu
[ "${CONFIRM_PITR_RESTORE:-}" = isolated-test ] || { echo '{"status":"blocked","reason":"confirmation_required"}' >&2; exit 2; }
: "${PITR_TARGET_TIME:?PITR_TARGET_TIME is required}"; : "${PITR_TARGET_DIR:?PITR_TARGET_DIR is required}"; : "${WALG_S3_PREFIX:?WALG_S3_PREFIX is required}"; : "${WALG_S3_ACCESS_KEY:?WALG_S3_ACCESS_KEY is required}"; : "${WALG_S3_SECRET_KEY:?WALG_S3_SECRET_KEY is required}"
printf '%s' "$PITR_TARGET_TIME" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' || { echo '{"status":"blocked","reason":"rfc3339_required"}' >&2; exit 2; }
case "$PITR_TARGET_DIR" in "${PGDATA:-/var/lib/postgresql/data}"|"${PGDATA:-/var/lib/postgresql/data}"/*) echo '{"status":"blocked","reason":"source_directory_refused"}' >&2; exit 2;; esac
[ ! -e "$PITR_TARGET_DIR" ] || { echo '{"status":"blocked","reason":"target_must_be_new"}' >&2; exit 2; }
mkdir -p "$PITR_TARGET_DIR"; chmod 700 "$PITR_TARGET_DIR"
WALG_TARGET_USER_DATA="$PITR_TARGET_DIR" wal-g backup-fetch "$PITR_TARGET_DIR" LATEST >/dev/null
cat >"$PITR_TARGET_DIR/recovery.signal" <<'EOF'
# isolated PITR marker; operator starts this cluster on a private socket
EOF
printf '{"status":"restored_to_isolated_target","target_time":"%s"}\n' "$PITR_TARGET_TIME"
