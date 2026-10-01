# Phase 2 — Kebenaran current-state sumber, archive, dan readiness data

## Objective, dependencies, observable result

- **Dependency:** Phase 1 `proven`.
- **Objective:** make `usaha` a truthful mutable current source before outbox/projection exists.
- **Observable result:** repeated SIDT import updates the same business and relations, no-change replay is idempotent, archive/restore is native Directus behavior, missing geography remains represented, source timestamps have explicit semantics, and workforce UI is default-off.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-2-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| create | `services/directus/migrations/20260819B-source-readiness.js` |
| modify | `scripts/ingest-sidt-batch-end.sql` |
| modify | `scripts/ingest-sidt-prepare.sql` |
| modify | `scripts/ingest-sidt.py` |
| modify | `scripts/refresh-dashboard-snapshots.sql` |
| create | `scripts/validate-analytics-readiness.sql` |
| create | `scripts/test_ingest_sidt.py` |
| modify | `apps/web/nuxt.config.ts` |
| modify | `apps/web/app/pages/(private)/dashboard/index.vue` |
| modify | `apps/web/app/types/infografis.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/source-readiness.spec.ts` |

`scripts/refresh-dashboard-snapshots.sql` already contains uncommitted coordinate work. Preserve `latitude`, `longitude`, and the untracked `20260818A-add-coordinates-to-usaha-tabular.js`; that migration is outside this phase and must not be edited.

## Exact symbols and search anchors

- `services/directus/migrations/20250801C-create-businesses.js::CREATE TABLE usaha`, Directus collection metadata.
- `services/directus/migrations/20260816B-create-usaha-tabular.js` non-null geography columns.
- `scripts/ingest-sidt-batch-end.sql::sidt_new`, `NOT EXISTS`, all `ON CONFLICT ... DO NOTHING`.
- `scripts/ingest-sidt-prepare.sql::ux_usaha_sumber_id`.
- `scripts/ingest-sidt.py::EXPECTED_COLUMNS`, `self_check`, `import_batch`.
- `scripts/refresh-dashboard-snapshots.sql::TRUNCATE`, source join chain, `sektor_definisi`, `workforce_numbers`.
- `apps/web/app/pages/(private)/dashboard/index.vue::genderData` and `DashboardChartGenderDistribution` render site.

```bash
rg -n 'NOT EXISTS|ON CONFLICT .* DO NOTHING|pulled_at|updated_at' scripts/ingest-sidt-batch-end.sql
rg -n 'JOIN (alamat|kelurahan|kecamatan|kota|provinsi)|workforce|TRUNCATE usaha_tabular' scripts/refresh-dashboard-snapshots.sql
rg -n 'genderData|GenderDistribution' 'apps/web/app/pages/(private)/dashboard/index.vue'
```

## Current contract and final desired contract

### Current

Only unseen `sumber_id` rows enter `sidt_new`; changed business, owner, address, KBLI, and workforce values are ignored. `usaha` lacks archive/source timestamps. Complete geography inner joins can silently drop future records. Workforce UI presents a semantically unvalidated total.

### Final

- `usaha.status TEXT NOT NULL DEFAULT 'active' CHECK IN ('active','archived')`; Directus metadata uses archive field `status`, archive value `archived`, unarchive value `active`, and app archive filter.
- Add `source_pulled_at`, `source_updated_at TIMESTAMPTZ`, and `source_hash CHAR(64)`. Input timestamp is accepted only when ISO 8601 carries `Z` or `±hh:mm`; PostgreSQL stores UTC. Invalid source time becomes NULL and is counted by readiness.
- `sumber_id` is required for SIDT-managed records and unique via existing index. Manually created records may retain NULL and are still counted by `usaha.id`.
- Rename staging concept to `sidt_stage`; include all nonblank source IDs. Allocate address ID as `COALESCE(existing_usaha.alamat, nextval(...))`; upsert that address rather than leak a new address per replay.
- Owner upsert chooses one deterministic row per NIK ordered by valid `source_updated_at DESC NULLS LAST, sumber_id`; update source fields only when distinct. Business upsert is keyed by `sumber_id`; workforce upsert by `usaha`; KBLI/geography references are idempotent.
- NIB collisions never fail a batch: only a normalized NIB unique inside staging and not owned by another source is set; collision becomes NULL and increments readiness quality count.
- Update precedence is valid `source_updated_at`, then valid `source_pulled_at`, then current ingest transaction time. Incoming invalid/NULL time never replaces a row that has a newer valid source time; when both source times are absent, the later successful ingest is current. No-op replay is detected by `source_hash`, uses `WHERE target IS DISTINCT FROM excluded`, and does not bump `date_updated`.
- Absence from a batch does not archive. Only explicit Archive/Restore mutates status.
- Legacy snapshots default to active records, use left joins and `Tidak diketahui` labels, permit nullable geography IDs in `usaha_tabular`, and prove source-scope equality. Existing spatial coordinates remain.
- Workforce payload may remain for legacy wire compatibility, but `enableWorkforce` defaults false and no UI/template exposes it. Feature enabling requires external semantic evidence plus a later plan amendment.
- Readiness output contains aggregates only: active/archived totals; source-vs-snapshot; null/unmapped geography by level; scale; KBLI missing/nonnumeric/range/mapping gap; source timestamp validity; NIB/source-key quality; financial coverage/range; workforce presence. It never selects record values.

## Ordered edits

1. Add forward-only source-readiness migration: source columns, archive check/index, Directus field/collection metadata, nullable snapshot geography IDs, and indexes on active/geography/timestamps. Down removes only new metadata/columns after an explicit empty-dependent-data check in ephemeral tests.
2. Refactor staging SQL to include existing rows and retain parsed source timestamps/hash. Do not change CSV header order.
3. Implement deterministic upserts in dependency order: province/city/district/village, classification, address, owner, business, workforce. Use explicit column lists and `IS DISTINCT FROM` guards.
4. Preserve existing status on source upsert; new rows are active. Never hard-delete or archive based on batch absence.
5. Change legacy refresh source join to left joins with unknown labels and compare active source count directly. Keep dirty coordinate projection. Heavy truncate remains temporary and is removed by Phase 4.
6. Extend Python self-check and add `unittest` fixtures for first import, changed replay, no-op replay, invalid timestamp, NIB collision, missing geography, archive preservation, and partial batch absence.
7. Add read-only readiness SQL with one summary result set and a final boolean `ready`; financial gate fields are explicit.
8. Add public runtime config flag default false; hide workforce panel and avoid reserving an empty visual gap. Keep type optional so legacy payload cannot crash the page.
9. Extend browser fixture/test to prove workforce absent, scale label says `skala yang dilaporkan`, and freshness uses WIB.

## Mixed, negative, boundary, lifecycle, and failure cases

- Existing vs new `sumber_id`; NULL/manual source ID; blank source ID rejected from staging.
- Same NIK shared by several businesses; changed NIK moves ownership without exposing PII in output; stale owner row is not deleted automatically.
- Address present/missing/changed; broken kelurahan chain still yields unknown bucket.
- NIB duplicated within batch, colliding with another source, or blank.
- Valid `Z`, positive/negative offsets, timestamp without offset, impossible date, source update older than stored update. Older source update does not overwrite newer current state; equal source update time uses later valid pulled time, then current ingest order; equal hash remains a no-op.
- Archive survives SIDT replay; restore becomes visible after explicit action; hard delete remains forbidden to Application User.
- Import transaction rollback leaves no partial dimension/source change.
- `mapped + all unmapped subtypes = total`; scale plus unknown equals total.
- Workforce values remain persisted as reported source fields but are not summed into a new official metric.

## Validation commands

```bash
node --check services/directus/migrations/20260819B-source-readiness.js
python3 -m py_compile scripts/ingest-sidt.py scripts/test_ingest_sidt.py
python3 -m unittest -v scripts/test_ingest_sidt.py
python3 scripts/ingest-sidt.py --self-check
(cd apps/web && pnpm run typecheck)
(cd apps/web && pnpm exec playwright test tests/e2e/source-readiness.spec.ts)
```

Expected: exit 0; unittest names cover update, idempotency, archive preservation, timestamp offsets, NIB collision, and missing geography.

Ephemeral PostgreSQL integration, against Phase 1 project or a new isolated project:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-source-e2e up -d --build postgis pgbouncer minio minioclient directus
ANALYTICS_TEST_DATABASE_URL="$ANALYTICS_TEST_DATABASE_URL" python3 -m unittest -v scripts/test_ingest_sidt.py
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-source-e2e down -v
```

Expected: test transaction proves first import, changed replay, no-op replay, archive/restore, and rollback with actual PostgreSQL; exit 0.

Readiness on deployment is read-only and requires user confirmation:

```bash
psql "$ANALYTICS_READONLY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/validate-analytics-readiness.sql
```

Expected: exit 0, final `ready` true for count/geography/KBLI/scale/archive/source-key gates. Financial gate is reported separately and only controls financial registry activation.

## Runtime/browser/migration proof and unproven boundary

Required: migration up/down/up on an ephemeral database; import of a two-row sanitized fixture twice with changed data; Directus Archive/Restore; readiness against representative data; browser workforce absence. Production aggregates remain `not runtime-proven` until the read-only command runs. No production write is part of this phase without confirmation.

## No-advance condition

All source unit/integration gates pass, the ephemeral migration round-trip preserves preexisting rows, and readiness contract produces conserved buckets. Workforce flag is false. Phase 3 may start with production readiness `not runtime-proven`, but no candidate generation or release can be promoted until production readiness becomes `proven`.

## Required failure probes

- Remove the explicit offset from a fixture timestamp; it must become invalid/NULL, not local-time parsed.
- Force an exception after owner upsert; all source/dimension changes roll back.
- Replay an archived source row; status must remain archived.
- Break one geography relation; total remains conserved in unknown.
- Supply duplicate NIB for two source IDs; batch succeeds, collision count increments.
- Supply an older source update; current newer state remains.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-2-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 2
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback the forward migration only in ephemeral environments after Phase 3 has no dependent tables. Production rollback uses the prior application while retaining new nullable/archive columns. Handoff passes exact source/archive/time contracts to Phase 3.
