# Phase 4 — Worker terpisah, projection, shadow generation, dan rekonsiliasi

## Objective, dependencies, observable result

- **Dependency:** Phase 3 database contract `proven`.
- **Objective:** implement the isolated process that consumes durable jobs, projects safe current rows, rebuilds candidates, reconciles, promotes atomically, and emits internal health.
- **Observable result:** one source mutation becomes visible in active read model within 60 seconds; worker kill/replay is idempotent; a bad candidate never replaces last-good; heavy publish endpoints only enqueue work.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-4-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `docker-compose.yml` |
| create | `docker/Dockerfile.analytics-worker` |
| create | `scripts/enqueue-analytics-rebuild.sql` |
| create | `services/analytics-worker/package.json` |
| create | `services/analytics-worker/pnpm-lock.yaml` |
| create | `services/analytics-worker/src/config.js` |
| create | `services/analytics-worker/src/db.js` |
| create | `services/analytics-worker/src/logger.js` |
| create | `services/analytics-worker/src/queue.js` |
| create | `services/analytics-worker/src/projector.js` |
| create | `services/analytics-worker/src/rebuild.js` |
| create | `services/analytics-worker/src/registry.js` |
| create | `services/analytics-worker/src/reconcile.js` |
| create | `services/analytics-worker/src/watchdog.js` |
| create | `services/analytics-worker/src/index.js` |
| create | `services/analytics-worker/test/fixtures.js` |
| create | `services/analytics-worker/test/worker.test.js` |
| modify | `services/directus/extensions/directus-extension-tabular/src/index.js` |
| modify | `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` |
| modify | `scripts/ingest-sidt.py` |
| modify | `docker/Dockerfile.directus` |
| create | `services/directus/extensions/directus-extension-analytics-watchdog/package.json` |
| create | `services/directus/extensions/directus-extension-analytics-watchdog/src/index.js` |
| create | `services/directus/extensions/directus-extension-analytics-watchdog/test/index.test.cjs` |

## Exact symbols and search anchors

- Phase 3 tables/functions and `analytics-shared/contracts.cjs`, `privacy.cjs`.
- `directus-extension-tabular/src/index.js::router.post("/publish")` synchronous `publishSql()` call.
- `scripts/ingest-sidt.py::REFRESH_DASHBOARD_SQL` and final “Publishing dashboard snapshots” block.
- `docker-compose.yml` service patterns, health checks, networks, credentials.
- `operations-runbook.md` sections Claim query, Idempotency, Rebuild, Reconciliation, Watchdog, Retry.

```bash
rg -n 'router\.post\("/publish"|publishSql' services/directus/extensions/directus-extension-tabular/src/index.js
rg -n 'REFRESH_DASHBOARD_SQL|Publishing dashboard snapshots' scripts/ingest-sidt.py
rg -n 'FOR UPDATE SKIP LOCKED|atomic active-pointer|Retry eksponensial|Watchdog' docs/analytics/operations-runbook.md
```

## Current contract and final desired contract

### Current

Jobs/triggers exist after Phase 3, but no consumer or active generation. `/tabular/publish` still executes a heavy SQL rebuild in Directus. Ingest still invokes the legacy snapshot refresh directly.

### Final

- Node 22 ESM worker with `pg`; no Directus human token. Database credential is worker-specific. Compose supplies CPU/memory limits, health check, stop grace, and no host port.
- Poll interval 1 second, claim batch 25, worker concurrency 2, lease 120 seconds. Claim transaction uses `FOR UPDATE SKIP LOCKED`, marks processing, commits immediately, then performs work.
- Retry delay is 10s, 30s, 2m, 5m, 15m plus bounded jitter; max 5. Exhaustion marks dead and upserts one sanitized incident. Poison job does not block other IDs.
- SIGTERM stops claims and lets current transaction finish within grace; unfinished lease is reclaimable. Reclaim requires expired lease and increments attempts once.
- `project_record_change` reads one current source graph with left joins, applies shared privacy before persistence, and upserts/deletes only that usaha row in active generation in one transaction. Duplicate/out-of-order jobs compare source hash/time and converge to latest state.
- Shared-dimension and bulk jobs become `rebuild_current_model`. A PostgreSQL advisory lock permits one rebuild. Candidate captures source/outbox high-water, backfills in keyset batches of 50,000, builds indexes, replays tail until caught up, reconciles, then switches active/previous pointer atomically.
- Reconciliation proves source total, geography, scale, KBLI mapped/unmapped subtype, archive, no raw-PII columns, registry source coverage. Any diff marks candidate failed and retains active.
- Previous generation is last-good. Cleanup keeps active+previous and only deletes older generations after 24 hours and no job/checkpoint reference.
- Registry sync runs at startup and every 60 seconds; raw/Directus field changes become discovered/quarantined/tombstoned without breaking other fields. Activation remains an explicit metadata action after projection/index/benchmark.
- Worker emits heartbeat on startup and every 30 seconds. A separate Directus scheduled hook checks heartbeat, oldest job, stuck leases, freshness, and latest reconciliation every 30 seconds; this hook can detect a dead worker while Directus/PostgreSQL live, dedupes/resolves incidents, reclaims safe expired leases, and enqueues daily reconciliation. Its daily bounded cleanup removes completed ordinary jobs/component detail older than 30 days and Directus activity older than one year while preserving open incidents, reconciliation required by retained generations, export audits, active/previous generation references, and unexpired artifacts. It exposes no technical detail to user API.
- Structured JSON logs include timestamp, level, service, event, job type/id, correlation, attempt, duration, error code; sanitizer strips values/bodies/stack/credentials/PII.
- `/tabular/publish` validates admin then inserts a rebuild job and returns `202 {data:{jobId,status:"queued"}}`. It never reads/executes publish SQL. Ingest enqueues the same coalesced rebuild after successful batches; its legacy compatibility refresh remains a separately named opt-in command and is not part of analytics freshness.

## Ordered edits

1. Create worker package, lockfile, configuration validation, DB pool, structured logger, and graceful process entry.
2. Implement queue as the deep concurrency module: claim, heartbeat/lease extension, ack, retry/dead, reclaim, and manual replay contract.
3. Implement projector with fixed source query, privacy module, current-source version guard, and single-row transactional upsert/delete.
4. Implement rebuild with advisory lock, candidate row, keyset backfill, indexes, high-water tail replay, reconciliation call, promotion, and bounded cleanup.
5. Implement reconciliation returning named counts/diffs and writing reconciliation + incident lifecycle.
6. Implement registry sync and worker heartbeat. Create a separate Directus watchdog hook with schedule, health/incident lifecycle, lease/backlog/freshness/reconciliation checks, bounded retention cleanup, and unit tests; one malformed field records a sanitized error and processing continues.
7. Add worker Compose service/image and build the watchdog hook from source in the Directus image. Copy only worker package plus shared contracts; install frozen lockfile; run as non-root.
8. Replace synchronous Tabular publish with enqueue-only while preserving dirty spatial/filter changes and security checks. Change ingest’s normal completion to enqueue rebuild without passing credentials in argv.
9. Add an explicit operator SQL enqueue script; it inserts one safe rebuild job and prints only job ID/status.
10. Add pure unit tests and actual PostgreSQL integration mode with seeded sanitized source graphs.

## Mixed, negative, boundary, lifecycle, and failure cases

- Create/update/archive/restore/delete one usaha; owner/address/KBLI/workforce changes; shared location rename.
- Duplicate, coalesced, older, out-of-order events; no-op source update; rollback event absent.
- Worker death after claim, mid-query, after projection before ack, after promotion before ack.
- Lease clock boundary and two competing worker processes.
- Backfill with concurrent source commits before/after high-water; tail continually advances until bounded catch-up then promotion transaction.
- Null/broken geography; multiplicative fixture; manual source with NULL `sumber_id`; masked PII canaries.
- Reconciliation diff, disk error, statement timeout, dead job, recovery/resolution, poison isolation.
- Schema create/rename alias/type/delete and raw DDL reconciliation.
- Active generation absent returns processing; candidate failure with previous active returns stale-last-good.

## Validation commands

```bash
(cd services/analytics-worker && pnpm install --frozen-lockfile)
(cd services/analytics-worker && pnpm test)
node --check services/analytics-worker/src/index.js
node --check services/analytics-worker/src/queue.js
node --check services/analytics-worker/src/projector.js
node --check services/analytics-worker/src/rebuild.js
node --check services/analytics-worker/src/reconcile.js
(cd services/directus/extensions/directus-extension-tabular && pnpm run build && pnpm test)
(cd services/directus/extensions/directus-extension-analytics-watchdog && pnpm run build && pnpm test)
python3 scripts/ingest-sidt.py --self-check
docker compose --env-file .env.example config --quiet
```

Expected: exit 0; tests include claim concurrency, retry schedule, dead/replay, idempotent projection, privacy, rebuild/tail/promote, reconciliation block, registry isolation, watchdog dedupe.

Actual PostgreSQL/worker gate:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-worker-e2e up -d --build postgis pgbouncer minio minioclient directus analytics-worker
ANALYTICS_INTEGRATION=1 ANALYTICS_TEST_DATABASE_URL="$ANALYTICS_TEST_DATABASE_URL"   node --test services/analytics-worker/test/worker.test.js
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-worker-e2e down -v
```

Expected: exit 0 and real SQL tests prove same-commit capture, two-worker SKIP LOCKED, kill/reclaim, duplicate/out-of-order convergence, concurrent candidate replay, failed promotion LKG, and health lifecycle.

## Runtime/worker proof and unproven boundary

On representative volume, capture timestamps source commit and active visibility for at least 100 mixed mutations; p95 and max must be ≤60s. Measure candidate disk, WAL, duration, CRUD lock wait, and tail size. Small fixture proof is necessary but not representative performance proof.

## No-advance condition

Unit and actual PostgreSQL worker gates pass; initial candidate promotes with zero diff; kill/replay and failed reconciliation retain LKG; synchronous Directus publish is gone. Phase 5 must have one active generation.

## Required failure probes

- SIGKILL worker at four lifecycle points; restart must converge once.
- Run two workers; each job claimed once per lease.
- Inject duplicate and older event; final row equals newest source.
- Force one reconciliation diff; active pointer unchanged.
- Put raw canary PII in source; job/log/health remain free of raw value and read model stores only allowed transform.
- Make one registry field malformed; other fields and heartbeat continue.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-4-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 4
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback stops the worker and restores enqueue callers; never delete jobs/generations during rollback. Active/previous data remains. Handoff to Phase 5 includes schema/masking version, active generation ID, freshness metrics, and registry catalog.
