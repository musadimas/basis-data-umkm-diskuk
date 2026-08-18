# Phase 5 — API privat Analitik dan query AST tervalidasi

## Objective, dependencies, observable result

- **Dependency:** Phase 4 has an active reconciled generation and proven worker gates.
- **Objective:** publish a stable authenticated server contract before frontend expansion.
- **Observable result:** Application User can request metadata/templates/status/query/records; anonymous/wrong role fail; all query identifiers resolve through active registry; semantics and error envelope match schemaVersion 1.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-5-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `docker/Dockerfile.directus` |
| create | `services/directus/extensions/directus-extension-analitik/package.json` |
| create | `services/directus/extensions/directus-extension-analitik/src/index.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/errors.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/meta.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/metadata.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/templates.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/query-compiler.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/query-service.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/records-service.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/status-service.js` |
| create | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| create | `services/directus/extensions/directus-extension-analitik/test/query-compiler.test.cjs` |
| create | `services/directus/extensions/directus-extension-analitik/test/integration.test.cjs` |
| create | `services/directus/extensions/directus-extension-analitik/src/oas.yaml` |

## Exact symbols and search anchors

- Shared `requireDashboardAccountability`, schema/registry/masking constants, active pointer/read model.
- Existing endpoint shape and test router doubles in both current extensions.
- `docs/analytics/api-contract.md` sections Authentication, Common metadata, Error envelope, Metadata, Templates, Query, Records, Status, Query budget.
- `docs/analytics/domain-model.md` metric dictionary, cardinality, privacy glossary.

```bash
rg -n '^### .*(GET|POST) /panel/analitik|^## (3|4|5|6|7|8|12|14|15)\.' docs/analytics/api-contract.md
rg -n 'COUNT DISTINCT usaha.id|Share UMKM|Cardinality guard' docs/analytics/domain-model.md
rg -n 'requireDashboardAccountability' services/directus/extensions/shared/auth.cjs
```

## Current contract and final desired contract

### Current

There is an active internal model but no HTTP interface. Client cannot discover approved fields or issue a bounded query.

### Final

- Extension ID `analitik`, built from source in Docker and documented by private OAS.
- Routes: `GET /metadata`, `GET /metadata/options`, `GET /templates`, `GET /status`, `POST /query`, `POST /records`.
- Every route runs role accountability before DB. Mutations also pass Nitro same-origin control. Request receives/returns correlation ID; logs contain no body.
- Metadata returns active fields plus safe label/status for discovered/quarantined catalog entries. `id` is immutable registry UUID; `key` is stable semantic name. Physical collection/column/expression, masking implementation, and restricted details are omitted.
- `metadata/options` takes active registry `fieldId`, optional parent registry/value ID, search prefix ≤100 chars, cursor, limit ≤100. It never accepts physical column name. Geography uses safe reference IDs/labels/parent; city option includes authoritative `kota.kode` and simplified GeoJSON with 6 decimal precision. KBLI has sector/division/full-code hierarchy.
- Templates are versioned. Default is current distribution by city. Workforce is `enabled:false`; financial templates enabled only when registry active.
- Query request: schemaVersion 1, one active metric, one groupBy, optional distinct breakdown, filters, optional `share_of_filtered_total`, limit 1–20, includeOthers. Maximum 8 filters; maximum 2 dimensions; no repeated field with conflicting role.
- Compiler converts registry expression enum to server-owned quoted SQL fragments. Values are bound. Operator allowlist is type-specific. Query runs in a transaction with `SET LOCAL TRANSACTION READ ONLY`, `statement_timeout=4500ms`, `lock_timeout=500ms`.
- `jumlah_umkm` always uses `COUNT(DISTINCT usaha_id)`. Share denominator is matched filtered total. Null/unmapped appears as explicit group and coverage. Top 20 plus deterministic Others conserve total.
- Group response contains metric definition and ordered groups with key/label/value/share/breakdown. Histogram response contains exactly 20 equal-width bins plus count/coverage/min/max/median/average; it is available only for activated financial fields. No SUM.
- Query rate baseline 30/min/user and two concurrent queries/user in the current single Directus instance; overload returns 429 sanitized envelope. Scale-out limiter is roadmap.
- API keeps a bounded five-minute in-memory latency/status histogram and upserts aggregate p50/p95/p99, request count, 4xx/5xx/timeout counts to `analitik_health(component_status=analytics_api)` every 30 seconds. No user ID, filter, path parameter, or payload is stored; process restart resets the window explicitly.
- Request abort rolls back/ignores response; database statement cannot outlive 4.5s. Stale late response carries its request correlation and UI later ignores it.
- Records uses keyset cursor signed by server, page size 1–100, stable sort field + `usaha_id`, active/exportable requested fields only. It returns opaque `id`, safe values, total estimate/matched, and next cursor. Raw/masked owner identifiers are excluded from record list.
- Status is `current | processing | stale_last_good`, dataAsOf UTC, localized message source value, no queue metrics.
- Common metadata emits schemaVersion, dataAsOf UTC, generatedAt UTC, status, source label, normalized filters, population, matched, coverage, warnings. Last-good returns 200 + warning. No active generation returns 503 generic processing state.
- Error codes/HTTP match conceptual contract: 401, 403, field 400, unavailable 409, complexity/export 422, timeout 504; add rate limit 429 and no-active 503 without internal detail.

## Ordered edits

1. Create extension package with deterministic copy build and build-before-test script. Add Docker clean install/build/copy.
2. Implement error/meta deep modules first: schema/version/time serialization, status resolution, sanitized errors/correlation.
3. Implement metadata/options/templates directly from registry and safe references. Validate all 27 city geometry/code rows before returning map rule.
4. Implement pure query compiler returning SQL + bound params + semantic result plan; never execute while compiling. Reject unknown lifecycle, capability, operator, aggregation, raw expressions, excessive complexity.
5. Implement query service with read-only transaction, budgets, total/coverage, group/breakdown/others/histogram, cancellation, and response metadata.
6. Implement records service with signed keyset cursor, stable sorting, allowed projections, and safe DTO. Add bounded five-minute API signal aggregation and health upsert for the Directus watchdog.
7. Register routes only in `index.js`; accountability and validation occur before service calls.
8. Add OAS for exact schemaVersion 1 shapes and private cookie auth. Docs extension must render it only after login.
9. Add router unit tests, compiler mutation tests, and actual endpoint integration tests against active fixture generation.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Anonymous, wrong role, Application User, admin; no DB call on denial.
- Empty filter, mixed mapped/unmapped, all-null field, no matches, one group, exactly 20, 21 with Others, tie ordering.
- City + scale breakdown; KBLI sector/division/full; archived include filter; relation multiplicity fixture.
- Raw SQL string in fieldId/operator/value; malicious registry metadata; reserved identifier; Unicode label; HTML text.
- Quarantined/discovered/deleted/type-changed field; schemaVersion mismatch; one bad field while another query works.
- High-cardinality field graph attempt; 9 filters; 3 dimensions; incompatible visual/aggregation; invalid cursor/signature.
- Concurrent third query, 31st minute request, statement/lock timeout, client abort, no active generation, stale previous active.
- UTC timestamps serialized with Z; invalid database date cannot produce a partial response.

## Validation commands

```bash
(cd services/directus/extensions/directus-extension-analitik && pnpm run build)
(cd services/directus/extensions/directus-extension-analitik && pnpm test)
node --check services/directus/extensions/directus-extension-analitik/src/query-compiler.js
node --check services/directus/extensions/directus-extension-analitik/src/query-service.js
docker compose --env-file .env.example build directus
```

Expected: exit 0; unit tests name auth matrix, compiler injection, distinct count, filtered share, coverage, others, histogram gate, cursor, timeout/LKG.

Actual API integration:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-api-e2e up -d --build postgis pgbouncer minio minioclient directus analytics-worker web
ANALYTICS_INTEGRATION_BASE_URL=http://127.0.0.1:3000   node --test services/directus/extensions/directus-extension-analitik/test/integration.test.cjs
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-api-e2e down -v
```

Expected: exit 0 against actual session cookies, Application/wrong role fixtures, active model, and PostgreSQL.

## Runtime/API proof and unproven boundary

Representative volume benchmark is required before release, not replaced by fixture tests. Capture p50/p95/p99, timeout/error rate, row estimates, and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` with values redacted. Common query p95 ≤3s and records/drill p95 ≤5s.

## No-advance condition

Clean image build, unit/contract, actual authenticated integration, full negative matrix, and active-generation query conservation pass. API response fixtures are frozen at schemaVersion 1 before Phase 6.

## Required failure probes

- Put SQL syntax in client fieldId and registry label; compiler rejects or treats label as data.
- Add multiplicative relation rows; count remains distinct usaha.
- Send 21 groups; top 20 + Others equals matched.
- Delete referenced field; return 409 warning without breaking metadata/other query.
- Hold DB lock beyond 500ms and run slow statement beyond 4.5s; return sanitized timeout.
- Kill worker and mark freshness stale; API returns LKG 200 with no queue internals.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-5-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 5
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback disables the new extension route/image only; keep worker and read model. Do not restore public endpoints. Handoff freezes metadata/query/record/status fixtures and error codes for Phase 6.
