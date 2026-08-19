#!/usr/bin/env bash
set -euo pipefail

# dev:direct — run Directus locally against the prod Postgres over an autossh
# tunnel, plus the Nuxt dev server wired to it.
#
# Usage: pnpm dev:direct            (SSH host defaults to "fuad", see SSH config)
#        SSH_TARGET=server pnpm dev:direct
#
# Prod DB credentials are read from fuad's compose .env at runtime and stay in
# this shell; they are never written to disk or echoed to the terminal.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_TARGET="${SSH_TARGET:-fuad}"
REMOTE_PROJECT_DIR='/root/basis-data-umkm-diskuk'
REMOTE_ENV="$REMOTE_PROJECT_DIR/.env"
REMOTE_DB_HOST=127.0.0.1
REMOTE_DB_PORT=5432
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5433}"
DIRECTUS_PORT="${DIRECTUS_PORT:-8055}"
WEB_PORT="${WEB_PORT:-3000}"

DIRECTUS_DIR="$ROOT/services/directus"
WEB_DIR="$ROOT/apps/web"

log() { printf '\033[1;36m[dev:direct]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[dev:direct]\033[0m %s\n' "$*" >&2; exit 1; }

command -v autossh >/dev/null 2>&1 ||
  die "autossh is required; install it first (macOS: brew install autossh)"

cleanup() {
  log "shutting down..."
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "${DIRECTUS_PID:-}" ]] && kill "$DIRECTUS_PID" 2>/dev/null || true
  [[ -n "${TUNNEL_PID:-}" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for_port() {
  local port="$1" name="$2" pid="$3"
  for _ in $(seq 1 180); do
    if (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; then return 0; fi
    kill -0 "$pid" 2>/dev/null || die "$name exited while starting; check the output above"
    sleep 1
  done
  die "$name did not listen on port $port within 180s"
}

# 1) Resilient SSH tunnel to prod postgis (publishes on 127.0.0.1:5432 on fuad)
log "opening resilient SSH tunnel to $SSH_TARGET ($REMOTE_DB_HOST:$REMOTE_DB_PORT -> 127.0.0.1:$LOCAL_DB_PORT)"
AUTOSSH_GATETIME=0 autossh -M 0 -N \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -L "$LOCAL_DB_PORT:$REMOTE_DB_HOST:$REMOTE_DB_PORT" "$SSH_TARGET" &
TUNNEL_PID=$!

wait_for_port "$LOCAL_DB_PORT" "SSH tunnel" "$TUNNEL_PID"

# 2) Prod credentials from the remote .env (single-line dotenv values; never echoed)
eval "$(ssh "$SSH_TARGET" "grep -E '^(DB_DATABASE|DB_USER|DB_PASSWORD|DIRECTUS_SECRET|DIRECTUS_SESSION_COOKIE_NAME)=' '$REMOTE_ENV'")"
: "${DB_DATABASE:?missing DB_DATABASE in $REMOTE_ENV}"
: "${DB_USER:?missing DB_USER}"
: "${DB_PASSWORD:?missing DB_PASSWORD}"
: "${DIRECTUS_SECRET:?missing DIRECTUS_SECRET}"

# 3) Directus against the tunneled prod DB, local file storage
log "starting Directus on 127.0.0.1:$DIRECTUS_PORT (db $DB_DATABASE via tunnel)"
mkdir -p "$DIRECTUS_DIR/uploads"
(
  cd "$DIRECTUS_DIR"
  export DB_CLIENT=pg
  export DB_HOST=127.0.0.1
  export DB_PORT="$LOCAL_DB_PORT"
  export DB_DATABASE DB_USER DB_PASSWORD
  export SECRET="$DIRECTUS_SECRET"
  export STORAGE_LOCATIONS=local
  export PUBLIC_URL="http://127.0.0.1:$DIRECTUS_PORT"
  export SESSION_COOKIE_NAME="${DIRECTUS_SESSION_COOKIE_NAME:-diskuk_session}"
  export SESSION_COOKIE_SAME_SITE=lax
  export SESSION_COOKIE_SECURE=false
  export WEBSOCKETS_ENABLED=false
  export EXTENSIONS_PATH="$DIRECTUS_DIR/extensions"
  export ANALYTICS_EXPORT_DIR="${TMPDIR:-/tmp}/diskuk-analytics-exports"
  pnpm dev
) &
DIRECTUS_PID=$!
wait_for_port "$DIRECTUS_PORT" "Directus" "$DIRECTUS_PID"

# 4) Nuxt dev server proxying /panel -> local Directus
log "starting Nuxt on http://localhost:$WEB_PORT"
(
  cd "$WEB_DIR"
  export NUXT_DIRECTUS_INTERNAL_URL="http://127.0.0.1:$DIRECTUS_PORT"
  export NUXT_SESSION_POLICY_SECRET="$DIRECTUS_SECRET"
  export SESSION_COOKIE_SECURE=false
  export NUXT_PUBLIC_PANEL_URL=/panel
  pnpm dev --port "$WEB_PORT" --host 127.0.0.1
) &
WEB_PID=$!
wait_for_port "$WEB_PORT" "Nuxt" "$WEB_PID"

log "ready: web http://localhost:$WEB_PORT | directus http://127.0.0.1:$DIRECTUS_PORT | db tunnel 127.0.0.1:$LOCAL_DB_PORT"
log "press Ctrl-C to stop everything (tunnel, Directus, Nuxt)"
wait
