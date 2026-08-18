# Phase 8 — Saved analysis dan ekspor privat terversi

## Objective, dependencies, observable result

- **Dependencies:** Phase 4 worker, Phase 5 API, Phase 6 canvas, Phase 7 profile proven.
- **Objective:** persist owner-scoped analysis configuration and produce audited, masked, expiring artifacts without freezing analytical results.
- **Observable result:** user saves/renames/deletes/reopens an analysis against current data; aggregate CSV completes synchronously; detail CSV/PNG/PDF/profile PDF run as isolated jobs; download is private and expires within 24 hours.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-8-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `services/analytics-worker/package.json` |
| modify | `services/analytics-worker/pnpm-lock.yaml` |
| modify | `services/analytics-worker/src/index.js` |
| modify | `services/analytics-worker/src/queue.js` |
| create | `services/analytics-worker/src/exporter.js` |
| create | `services/analytics-worker/src/export-renderer.js` |
| create | `services/analytics-worker/src/storage.js` |
| modify | `services/analytics-worker/test/worker.test.js` |
| modify | `services/directus/extensions/directus-extension-analitik/package.json` |
| modify | `services/directus/extensions/directus-extension-analitik/src/index.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/exports-service.js` |
| modify | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| modify | `apps/web/app/types/analytics.ts` |
| create | `apps/web/app/composables/useSavedAnalyses.ts` |
| create | `apps/web/app/composables/useAnalyticsExports.ts` |
| create | `apps/web/app/components/analytics/SaveAnalysisDialog.vue` |
| create | `apps/web/app/components/analytics/SavedAnalysisMenu.vue` |
| create | `apps/web/app/components/analytics/ExportDialog.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/analitik.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/umkm/[id].vue` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/saved-export.spec.ts` |
| create | `services/directus/extensions/directus-extension-analitik/pnpm-lock.yaml` |

## Exact symbols and search anchors

- Phase 3 `analitik_view` owner/config constraints and export fields in `analitik_job`.
- Phase 4 queue retry/lease/dead isolation.
- Phase 5 query compiler/query service and route/error patterns.
- Phase 6 applied analysis state; Phase 7 profile action.
- `api-contract.md` Saved analysis and Export; `ux-spec.md` Saved analysis and Export UX.

```bash
rg -n '^## (10|11)\.|analitik_view|detail_csv|50\.000|24 jam' docs/analytics/api-contract.md
rg -n '^## (12|13)\.|50\.000|Menunggu|Diproses|Selesai|Gagal' docs/analytics/ux-spec.md
```

## Current contract and final desired contract

### Current

No saved UI/export API/job renderer. Legacy Tabular browser loops up to 50,000 rows but lacks audit, timestamp, masking/version, private expiry, and explicit over-limit error.

### Final saved analysis

- Browser uses Directus Items API on `analitik_view`; DB/permission owns user, case-insensitive name, config schemaVersion 1, and forbidden-key scan.
- Saved value contains metric/group/breakdown/filters/visual only. No result, snapshot, notes, conclusion, shortlist, token, record UUID, pagination cursor, or scroll.
- Open always validates/migrates config and re-runs current query. Rename/delete are owner-scoped. Break-glass admin can inspect only for recovery; another user receives 404/403 without ID enumeration.
- Removed/type-changed fields become unavailable placeholders/warning; valid remaining config stays. No public share token; internal URL still requires login.

### Final export

- `POST /exports` validates the same analysis AST, owner, fields, locale `id-ID`, timezone `Asia/Jakarta`, schema/masking version, and estimated record count.
- `aggregate_csv` runs synchronously on already bounded aggregate query, inserts a completed audit job, uploads an encrypted object, and returns HTTP 200 with status completed/private download URL.
- `detail_csv`, `aggregate_png`, `aggregate_pdf`, and `profile_pdf` insert a queued job and return 202. Detail estimate >50,000 returns 422 before queue. Actual emitted count is rechecked and job fails closed if it exceeds cap.
- Worker streams detail rows by signed keyset cursor into CSV; it never holds 50k DTOs at once. CSV injection cells starting `= + - @` are prefixed with apostrophe. UTF-8 BOM and Indonesian headers are explicit.
- Renderer produces deterministic SVG from semantic groups, converts PNG via pinned Sharp, and builds PDF via pinned PDFKit. It includes title, metric definition, dataAsOf/generatedAt, filter labels, denominator, coverage/warnings, source, masking version, and equivalent data table. It contains no worker internals.
- Profile PDF uses semantic DTO/masking, never edit/raw source.
- Worker object prefix is owner/job UUID, random object key; private analytics storage user has prefix-only rights and SSE enabled. Directus/API has read/delete rights for that prefix, not MinIO root.
- Status route `GET /exports/:jobId` exposes `queued | processing | completed | failed | expired`, safe timestamps/count/error, and only the owner. No lease/retry/worker fields.
- Download route is same-origin, still requires session/owner, and validates HMAC-SHA256 job/owner/expiry signature. Signature lifetime ≤24h, is not a Directus token, is redacted from logs/referrer, and cannot outlive object expiry. API streams object with attachment/no-store headers.
- Worker cleanup deletes expired objects and marks jobs expired; export audit rows remain one year, then bounded cleanup deletes them. Retry never creates two user-visible artifacts; object key is idempotent per job.
- Audit record retains owner, type, schema/masking version, dataAsOf, filter hash/config, row count, created/completed/download expiry for one year; no raw PII.

## Ordered edits

1. Add worker export/storage/render modules and pinned dependencies; extend queue dispatch/cleanup without weakening projection concurrency. Export concurrency is 1 so it cannot starve projection.
2. Add extension export service/routes for submit/status/download, query AST reuse, count cap, HMAC, S3 streaming, audit and error envelopes.
3. Add saved/exports composables. Saved Items calls use Directus session; export calls use custom API and safe polling with stop on terminal/expired.
4. Build Save dialog, Saved menu, Export dialog. UI shows estimated count, filters, format, masking, limit, expiry before submit and Indonesian statuses only.
5. Wire applied canvas and profile PDF actions. Aggregate CSV never uses the legacy Tabular browser loop.
6. Expand fixtures and tests for owner isolation, schema migration warning, each format, retry/dead, expiry, audit, CSV formula injection, PII canaries, and UI nonblocking behavior.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Save new/duplicate-case name/rename/delete; another owner; admin recovery; field renamed/deleted/type changed; config version mismatch.
- Open saved after current generation changes; values update and no frozen result exists.
- Aggregate empty/one/20+Others; detail 49,999/50,000/50,001 estimated and actual; cursor row changes during export pinned to captured generation.
- CSV fields with commas/newline/quotes/formula prefixes/Unicode; missing values; invalid dynamic field.
- PNG/PDF render long Indonesian labels, unknown bucket, coverage warning, no map geometry.
- Worker death mid-stream/upload/status; duplicate retry; S3 unavailable; object uploaded before DB ack; cleanup orphan.
- Wrong owner, expired signature, tampered signature/job/owner/expiry, logged query redaction, logout before download.
- Raw PII canary in source/profile; output contains only approved masked semantic values.

## Validation commands

```bash
(cd services/analytics-worker && pnpm install --frozen-lockfile && pnpm test)
(cd services/directus/extensions/directus-extension-analitik && pnpm install --frozen-lockfile && pnpm run build && pnpm test)
node --check services/analytics-worker/src/exporter.js
node --check services/analytics-worker/src/export-renderer.js
node --check services/analytics-worker/src/storage.js
node --check services/directus/extensions/directus-extension-analitik/src/exports-service.js
(cd apps/web && pnpm run typecheck)
(cd apps/web && pnpm exec playwright test tests/e2e/saved-export.spec.ts)
```

Expected: exit 0; artifact tests parse CSV, PNG signature/dimensions, and PDF text; tests do not assert only file existence.

Actual S3/worker/browser gate:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-export-e2e up -d --build postgis pgbouncer minio minioclient directus analytics-worker web
ANALYTICS_INTEGRATION=1 ANALYTICS_TEST_DATABASE_URL="$ANALYTICS_TEST_DATABASE_URL" node --test services/analytics-worker/test/worker.test.js
(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 pnpm exec playwright test tests/e2e/saved-export.spec.ts)
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-export-e2e down -v
```

Expected: exit 0; object is inaccessible without authorized download, completed before expiry, denied after expiry, and removed by cleanup.

## Runtime/provider proof and unproven boundary

Ephemeral MinIO proves permission mechanics, not production off-host security. Production requires user-confirmed bucket/policy/encryption/lifecycle proof. Audit retention and object expiry must be sampled after 24 hours or with test clock. Export duration/S3 throughput is recorded without sensitive URL.

## No-advance condition

Saved owner/config tests, all artifact semantic parsers, actual S3 private/expiry, worker failure/retry, browser nonblocking/status, 50k cap, and PII scans pass. No browser-side legacy detail export remains on Analitik.

## Required failure probes

- Save forbidden keys/result/notes/record UUID through raw Items API; DB/API rejects.
- Open saved after field deletion; unaffected controls/results continue with warning.
- Request 50,001 detail rows; no job/object created.
- Kill worker after upload before ack; retry reuses/cleans idempotent key.
- Tamper or expire download signature; return 403/410 and no object bytes.
- Seed spreadsheet formula and raw PII; CSV neutralizes formula and contains no raw canary.
- Log capture must not contain signed URL, cookie, object credential, request body, NIK, or phone.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-8-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 8
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback disables export submit/download and saved UI; worker ignores new export jobs without deleting them. Existing objects expire naturally. Never make a bucket public as fallback. Handoff to Phase 9 includes artifact/audit/expiry metrics and integrated feature surface.
