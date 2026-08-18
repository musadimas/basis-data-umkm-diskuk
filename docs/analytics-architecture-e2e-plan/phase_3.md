# Phase 3 — Kontrak persistence Analitik, registry, outbox, health, dan permission

## Objective, dependencies, observable result

- **Dependency:** Phase 2 deterministic dan ephemeral data gates pass.
- **Objective:** create the durable database and Directus metadata contract required by worker/API without exposing an analytics canvas.
- **Observable result:** migrations create constrained internal collections, generation/read-model tables, transactional capture triggers, seeded registry entries, and least-privilege Items permissions; rollback is proven on an empty ephemeral database.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-3-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `services/directus/package.json` |
| create | `services/directus/analytics-shared/contracts.cjs` |
| create | `services/directus/analytics-shared/privacy.cjs` |
| create | `services/directus/migrations/20260819C-create-analytics-foundation.js` |
| create | `services/directus/migrations/20260819D-seed-analytics-registry.js` |
| create | `services/directus/test/analytics-foundation.contract.test.mjs` |

## Exact symbols and search anchors

- Directus metadata insertion patterns in `20250801A-create-reference-tables.js::up/down` and `20250801C-create-businesses.js::up/down`.
- Actual fields `usaha.status_hukum`, `usaha.skala`, `pelaku_usaha.birth_date`, and `statistik_tenaga_kerja.usaha`.
- Directus 11.17.4 tables `directus_collections`, `directus_fields`, `directus_relations`, `directus_policies`, `directus_access`, `directus_permissions`.
- Phase 1 role/policy IDs and `extensions/shared/auth.cjs`.
- Phase 2 bulk flag/call in `scripts/ingest-sidt-batch-end.sql`; do not edit that file here.

```bash
rg -n 'directus_(collections|fields|relations)' services/directus/migrations/20250801A-create-reference-tables.js
rg -n 'status_hukum|skala' services/directus/migrations/20250801C-create-businesses.js
rg -n 'birth_date' services/directus/migrations/20250801B-create-entrepreneurs.js
rg -n 'analytics_bulk_ingest|enqueue_bulk_rebuild' scripts/ingest-sidt-batch-end.sql
```

## Current contract and final desired contract

### Current

No analytics persistence, queue, generation, registry, saved view, health lifecycle, or permission-as-code exists.

### Final schema

- `analitik_field`: immutable UUID and semantic ID; source collection/field; label/description/group/order; semantic role/type/status; privacy/masking/null policy; aggregation/capability flags; server-owned source-expression key; projection/index state; aliases; schema version; sanitized error metadata; lifecycle timestamps. Only `active` and projected/indexed rows are queryable.
- `analitik_view`: UUID, owner, name, schema version, config JSONB, dates; case-insensitive name unique per owner. Config rejects notes, result rows, credentials, record UUID filters, and PII keys.
- `analitik_job`: UUID plus monotonic `sequence BIGSERIAL`; job/dedupe/entity fields; sanitized request only for exports/rebuild; status/priority/attempt max 5/availability/lease/checkpoint/high-water/correlation/error/hash; owner/schema/masking/export metadata. Partial unique index coalesces live dedupe keys. There is no raw source payload column.
- `analitik_health`: one table with constrained `component_status | incident | reconciliation`; component upsert key and heartbeat/last-success/queue-age/freshness/API p50-p95-p99/request-error-timeout aggregate fields, open-incident fingerprint dedupe, append-only reconciliation checks.
- `analitik_generation`: candidate/active/previous/failed status, schema/registry/masking versions, source/outbox high-water, row count, data-as-of, build/reconcile timestamps, sanitized error.
- `analitik_active_generation`: singleton ID 1 with active and previous generation.
- `analitik_usaha_current`: generation + usaha PK; archive status; safe business fields; explicit geography/KBLI/scale unknowns; financial quality; masked NIK/phone, owner name, age band; exact business coordinates; safe `extra_fields`; source/projection timestamps. It excludes birth date, private domicile, raw PII, and source photo URL.
- `analitik_kbli_sector`: 21 versioned sector ranges from current SQL and `kategori.md`.
- Capture functions use `SECURITY DEFINER`, fixed `search_path`, safe IDs, and transaction-local bulk setting. Business dependencies enqueue record projection; shared geography/KBLI enqueue one rebuild. Bulk ingest suppresses per-row jobs and enqueues one rebuild in the same transaction.
- Periodic registry sync detects raw schema changes. Rename requires explicit alias preserving registry UUID; otherwise old tombstone plus new discovery.
- Initial active registry: count, geography, KBLI, reported scale, quality, safe record/profile fields. NIK/phone are masked profile-only. Owner domicile, file/HTML, and workforce are quarantined. Financial fields activate only after fixed Phase 2 thresholds.
- Role permissions add owner-scoped `analitik_view`, approved `usaha` read/update including status, no hard delete, no raw `pelaku_usaha`, and no Application User access to operational collections. Directus Activity/Revisions is operations/admin-only; approved business/status audit is retained one year, while raw owner-PII edit/versioning is outside scope and therefore never added to Application User permissions.

## Ordered edits

1. Add shared `contracts.cjs` with schema version 1, enums, budgets, masking version 1, and 21 KBLI definitions. Add pure `privacy.cjs` normalization/masking/age-band/quality helpers.
2. Create foundation migration in dependency order: sector reference, fields/views/jobs/health, generation/read model/pointer, constraints/indexes, trigger functions/triggers, Directus metadata, role permissions.
3. Use analytics-owned trigger names and safe replacement. Never alter unrelated source constraints.
4. Seed registry in a separate idempotent migration. Store an enum expression key, never arbitrary SQL.
5. Seed one `rebuild_current_model` job only when no active generation exists. Migration never backfills synchronously.
6. Add Directus test script and contract/integration test for every table, constraint, trigger, privacy exclusion, role filter, seed lifecycle, and down order.
7. Down refuses while analytics data exists outside explicit ephemeral tests and removes analytics-owned objects in reverse order only.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- INSERT/UPDATE/DELETE, archive/restore, owner/address/workforce dependencies, shared dimensions, bulk flag, rollback.
- Duplicate mutation coalescing and a new job after earlier completion.
- Invalid job/health/registry/generation status and attempt >5 constraint failures.
- Registry text/number/identifier/file/HTML/geometry/M2O/O2M defaults fail closed.
- View ownership across Application User, other user, and admin.
- Raw PII canaries rejected from safe job request/health helper.
- Active pointer cannot reference candidate/failed/unreconciled generation.

## Validation commands

```bash
node --check services/directus/migrations/20260819C-create-analytics-foundation.js
node --check services/directus/migrations/20260819D-seed-analytics-registry.js
node --check services/directus/analytics-shared/contracts.cjs
node --check services/directus/analytics-shared/privacy.cjs
(cd services/directus && pnpm test)
```

Expected: exit 0 with named contract tests for schema, triggers, permissions, privacy, seed, and down order.

Ephemeral migration integration:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-schema-e2e up -d --build postgis pgbouncer minio minioclient directus
ANALYTICS_TEST_DATABASE_URL="$ANALYTICS_TEST_DATABASE_URL" node --test services/directus/test/analytics-foundation.contract.test.mjs
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-schema-e2e exec -T directus npx directus database migrate:down
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-schema-e2e exec -T directus npx directus database migrate:down
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-schema-e2e exec -T directus npx directus database migrate:latest
ANALYTICS_TEST_DATABASE_URL="$ANALYTICS_TEST_DATABASE_URL" node --test services/directus/test/analytics-foundation.contract.test.mjs
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-schema-e2e down -v
```

Expected: exit 0; real catalog/constraints/triggers pass, down removes only two empty analytics migrations, and up recreates them.

## Runtime/migration proof and unproven boundary

Same-commit capture, rollback-no-job, trigger coverage, role filters, and absence of raw PII columns require actual PostgreSQL. Production migration remains `not runtime-proven` pending confirmation. No active generation exists yet.

## No-advance condition

Static, contract, and PostgreSQL up/down/up gates pass; rollback and bulk-coalescing probes pass; Application User sees only approved fields/actions.

## Required failure probes

- Roll back source mutation after trigger; job count stays unchanged.
- Insert duplicate live dedupe key; it coalesces.
- Insert invalid health subtype fields; database rejects.
- Supply registry expression outside enum; seed/helper rejects.
- Query raw `pelaku_usaha.nik` as Application User; Directus returns 403.
- Promote unreconciled generation; database rejects.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-3-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 3
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback is destructive only for empty ephemeral analytics tables. A deployed rollback stops worker/API but retains schema. Handoff to Phase 4 includes schema version 1, job contract, trigger names, registry state, and role IDs.
