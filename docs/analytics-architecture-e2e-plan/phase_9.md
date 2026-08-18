# Phase 9 — Reliability, PITR, benchmark, dan bukti rilis

## Objective, dependencies, observable result

- **Dependencies:** Phases 1–8 integrated and proven in an ephemeral stack.
- **Objective:** close operational, performance, privacy, visual, backup/restore, and deployment claims with measurable evidence.
- **Observable result:** watchdog/degraded mode works, logs are bounded and sanitized, WAL/base backups restore to an isolated target, SLOs pass at representative volume, visual/accessibility flows pass, and production anonymous probes prove the private cutover.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-9-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `.env.example` |
| modify | `docker-compose.yml` |
| modify | `docker/Dockerfile.postgis` |
| create | `docker/wal-g-backup.sh` |
| create | `docker/restore-pitr.sh` |
| create | `docker/object-storage-backup.sh` |
| create | `docker/object-storage-restore.sh` |
| create | `scripts/benchmark-analytics.mjs` |
| create | `scripts/verify-analytics-release.mjs` |
| create | `scripts/scan-analytics-leaks.py` |
| modify | `docs/analytics/operations-runbook.md` |
| create | `docs/analytics/release-runbook.md` |
| modify | `apps/web/package.json` |
| modify | `apps/web/playwright.config.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/reliability.spec.ts` |
| create | `apps/web/tests/e2e/visual-regression.spec.ts` |

## Exact symbols and search anchors

- `docker/Dockerfile.postgis`, PostgreSQL 15/PostGIS base and init scripts.
- Compose service health checks, volumes, logging, analytics-worker, storage credentials.
- Directus watchdog, worker heartbeat/health, and API user-facing status from prior phases.
- `docs/analytics/operations-runbook.md` thresholds, degraded modes, RTO/RPO, rebuild, backup/restore, deployment checklist.
- All Playwright flows and package scripts created earlier.

```bash
rg -n '^## (8|9|10|11|12|13|14|15|16|17|18)\.' docs/analytics/operations-runbook.md
rg -n 'analytics-worker|healthcheck|logging:|postgis:' docker-compose.yml
rg -n 'FROM postgis' docker/Dockerfile.postgis
```

## Current contract and final desired contract

### Current

Integrated features exist but production reliability claims remain unmeasured. PostgreSQL has only a data volume, Compose lacks bounded logging/PITR automation, and there is no consolidated release/benchmark/leak proof.

### Final

- PostgreSQL image installs WAL-G v3.0.8 for target architecture and verifies the official release SHA256 before installation. No unpinned latest download.
- Production config uses off-host encrypted S3-compatible `WALG_S3_PREFIX`; credentials exist only in secret environment. Same-host MinIO is forbidden for disaster proof.
- PostgreSQL enables `archive_mode=on`, `wal_level=replica`, `archive_timeout=60s`, WAL-G `archive_command`, and restore command. Daily base backup job verifies `wal-g backup-list` and writes sanitized health status. WAL archive failure opens a critical incident.
- `wal-g-backup.sh` refuses missing/off-host config, uses lock to prevent concurrent base backups, emits structured safe result, and never prints environment. `object-storage-backup.sh` uses a separate backup credential to copy Directus-managed private objects to a versioned encrypted off-host prefix without deleting source/destination history. `object-storage-restore.sh` refuses the production bucket and restores only to a new isolated bucket after `CONFIRM_OBJECT_RESTORE=isolated-test`.
- `restore-pitr.sh` accepts a new empty target directory and RFC3339 target time from environment, refuses source/production data directory, requires `CONFIRM_PITR_RESTORE=isolated-test`, restores base backup/WAL, starts an isolated nonpublic PostgreSQL, then runs migrations/readiness/rebuild/reconcile. It never overwrites running source.
- Directus runs `LOG_STYLE=raw` and worker/API custom events are JSON sanitized. Compose uses Docker `local` logging driver and capacity options for every service. Measured representative daily compressed volume ×30 plus 25% margin must be below configured capacity; otherwise release blocks and capacity values increase without changing retention claim.
- Audit/job cleanup retains Directus CRUD/login/config/export for one year, operational jobs/health detail 30 days, reconciliation sufficient for restore review. Cleanup is bounded and never deletes open incidents, active/previous generations, or unexpired exports.
- `benchmark-analytics.mjs` reads base URL and session cookie from environment only, never argv/log; runs canonical golden queries/profiles with bounded concurrency, outputs aggregate p50/p95/p99/error/timeout/freshness only, and exits nonzero on p95/error thresholds.
- `verify-analytics-release.mjs` probes anonymous redirect/401, authenticated allowed paths, wrong-role 403, current status, source/model invariants, export private/expiry, cookie/cache headers, and port expectations. It redacts cookies/URLs.
- `scan-analytics-leaks.py` scans test canary response/HTML/export/log/job/health artifacts plus source tree for PEM-shaped or credential-pattern additions. It uses canaries, not production NIK/phone values, and rejects any raw match.
- Release/operations runbooks contain exact commands, owners, rollback, evidence fields, incident procedures, accepted monitoring blind spot, and explicit statements that target RTO is not end-to-end guaranteed without external monitor.
- Visual regression covers named desktop/tablet/mobile flows and intentional deltas. Screenshot approval never substitutes semantic/assertion tests.

## Ordered edits

1. Pin/install/verify WAL-G in PostGIS image and add safe database, object-storage backup, and restore scripts.
2. Extend Compose with WAL archive/base-backup environment, off-host backup service/profile, all-service local logging limits, health checks, and resource budgets. No public new port.
3. Implement benchmark, release verifier, and canary leak scanner with machine-readable JSON summary and nonzero threshold exits.
4. Update operations runbook from target-only wording by adding exact implemented command paths and evidence status fields; do not mark runtime claims proven before receipts. Add release runbook for deployment/rollback/PITR drill.
5. Add package scripts and final reliability/visual Playwright suites; expand fixture for worker down, stale LKG, incident recovery, timeout, expiry.
6. Run full static/unit/integration/browser matrix first; then representative load, disk/log capacity, worker kill, candidate failure, export failure, and PITR isolated drill.
7. After explicit confirmation, rotate keys, deploy, run production anonymous/authenticated probes, verify only 80/443 public, and attach external receipts outside the repository. Do not place secrets in evidence.

## Mixed, negative, boundary, lifecycle, and failure cases

- Worker down, stuck lease, queue >60s/>5m, dead job/replay, API timeout/error >5%, reconciliation diff/recovery, total DB/Directus outage accepted blind spot.
- Active LKG while candidate/projector fails; no raw source browser fallback.
- WAL archive healthy/failing/credential revoked/network unavailable; base backup overlap; corrupt/incomplete object; restore before/after target time.
- RPO target with last archived transaction; RTO worker/API/full platform measured separately.
- Log burst, disk near budget, canary credential/PII/error stack, signed URL redaction, retention cleanup boundary.
- Common/high-cardinality/empty/stale queries and 100 mixed source changes under representative load.
- Desktop/tablet/mobile, 200% zoom, keyboard, reduced motion, both browser timezones, screenshots for all intentional states.
- Anonymous production page/API/docs/assets; wrong role; revoked session; open redirect; CSRF; IDOR; cache crossover.

## Validation commands

Full deterministic source gate:

```bash
python3 -m py_compile docs/analytics-architecture-e2e-plan/scope_guard.py scripts/scan-analytics-leaks.py
sh -n docker/wal-g-backup.sh docker/object-storage-backup.sh docker/object-storage-restore.sh docker/restore-pitr.sh
python3 -m unittest -v scripts/test_ingest_sidt.py
(cd services/directus && pnpm test)
(cd services/directus/extensions/directus-extension-infografis && pnpm run build && pnpm test)
(cd services/directus/extensions/directus-extension-tabular && pnpm run build && pnpm test)
(cd services/directus/extensions/directus-extension-analitik && pnpm install --frozen-lockfile && pnpm run build && pnpm test)
(cd services/directus/extensions/docs && pnpm run build)
(cd services/analytics-worker && pnpm install --frozen-lockfile && pnpm test)
(cd apps/web && pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run test:unit && pnpm run build)
(cd apps/web && pnpm exec playwright test)
docker compose --env-file .env.example config --quiet
docker compose --env-file .env.example build postgis directus analytics-worker web
python3 scripts/scan-analytics-leaks.py --fixture-root apps/web/test-results
```

Expected: every command exits 0. Leak scanner reports zero raw canary/credential/PEM-shaped additions.

Representative authenticated benchmark:

```bash
ANALYTICS_BASE_URL="$ANALYTICS_BASE_URL" ANALYTICS_SESSION_COOKIE="$ANALYTICS_SESSION_COOKIE"   node scripts/benchmark-analytics.mjs --output /tmp/analytics-benchmark.json
```

Expected: exit 0; common analysis p95 ≤3s, profile/drill p95 ≤5s, error rate ≤1%, no timeout; cookie is never printed.

Isolated PITR drill, only after explicit confirmation and nonproduction target:

```bash
CONFIRM_PITR_RESTORE=isolated-test PITR_TARGET_TIME="$PITR_TARGET_TIME" PITR_TARGET_DIR="$PITR_TARGET_DIR"   docker/restore-pitr.sh
```

Expected: exit 0; restored DB timestamp is at/before requested target and within 15 minutes of selected source event; post-restore migration, replay, rebuild, reconcile pass; measured full recovery ≤4h. Target dir must be new and isolated.

Object-storage backup/isolated restore:

```bash
docker/object-storage-backup.sh
CONFIRM_OBJECT_RESTORE=isolated-test OBJECT_RESTORE_BUCKET="$OBJECT_RESTORE_BUCKET" docker/object-storage-restore.sh
```

Expected: exit 0; manifest count/checksum matches in a new isolated bucket; production/source buckets remain untouched.

Production verification, only after deployment confirmation:

```bash
ANALYTICS_BASE_URL="$ANALYTICS_BASE_URL" ANALYTICS_SESSION_COOKIE="$ANALYTICS_SESSION_COOKIE" ANALYTICS_WRONG_ROLE_COOKIE="$ANALYTICS_WRONG_ROLE_COOKIE"   node scripts/verify-analytics-release.mjs
```

Expected: exit 0; anonymous UI redirects, private API/docs/assets return 401, wrong role 403, authenticated journeys pass, only 80/443 public, invariants zero diff.

## Runtime/provider/deployment proof and unproven boundary

A local Compose run cannot prove off-host durability, firewall/DNS, key rotation, or production volume. Those remain `blocked` until user-confirmed provider/deployment receipts. Internal watchdog cannot detect Directus/PostgreSQL total outage; record this accepted gap and do not state end-to-end RTO guaranteed.

## No-advance condition

This is final. Completion requires all deterministic gates plus representative benchmark, 100-change freshness sample, kill/LKG/reconcile drills, 30-day log capacity calculation, encrypted off-host backup proof, isolated PITR restore/RPO/RTO, production auth/port/cache probes, key rotation/history receipt, and approved visual/accessibility evidence. Any missing runtime boundary means overall verdict is not complete.

## Required failure probes

- Revoke WAL credential; archive health becomes critical without leaking credential.
- Restore database to nonempty/source path and object storage to production/existing bucket; scripts refuse before writes.
- Create reconciliation diff; candidate remains inactive and UI serves stale LKG.
- Kill worker and API separately; measure recovery and preserve CRUD/LKG behavior.
- Inject credential/PII/signed URL/stack canaries into failure paths; leak scanner fails on violation and passes after sanitation.
- Exceed configured log budget; release blocks rather than silently shortening retention.
- Anonymous production request every private surface; none return private payload/200 content.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-9-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 9
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Application rollback restores the previous compatible images and active generation pointer while retaining source/jobs/audit. Database restore is never the first rollback. Final handoff lists each requirement as proven, blocked, not runtime-proven, or not applicable with command/evidence references.
