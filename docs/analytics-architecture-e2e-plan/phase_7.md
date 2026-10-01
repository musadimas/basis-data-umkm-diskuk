# Phase 7 — Profil UMKM, masking server-side, dan archive/restore

## Objective, dependencies, observable result

- **Dependencies:** Phase 5 API and Phase 6 return-state/records contract proven.
- **Objective:** complete aggregate-to-record drill-down with a privacy-minimized semantic profile and explicit archive lifecycle.
- **Observable result:** user opens `/dashboard/umkm/:id`, sees safe business/owner sections and exact business location, archives/restores by permission, navigates previous/next, and returns to the exact analysis state.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-7-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `services/directus/extensions/directus-extension-analitik/src/index.js` |
| create | `services/directus/extensions/directus-extension-analitik/src/profile-service.js` |
| modify | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| modify | `apps/web/app/types/analytics.ts` |
| create | `apps/web/app/composables/useUmkmProfile.ts` |
| modify | `apps/web/app/components/analytics/AnalyticsRecordTable.vue` |
| create | `apps/web/app/components/umkm/UmkmProfileHero.vue` |
| create | `apps/web/app/components/umkm/UmkmProfileSection.vue` |
| create | `apps/web/app/components/umkm/UmkmProfileActions.vue` |
| create | `apps/web/app/pages/(private)/dashboard/umkm/[id].vue` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/umkm-profile.spec.ts` |

## Exact symbols and search anchors

- `analytics-shared/privacy.cjs` mask/age/quality functions and `analitik_usaha_current` safe columns.
- Phase 5 `index.js` route registration/error/meta patterns.
- Phase 6 `AnalyticsRecordTable.vue` and `useAnalysisState` return context.
- `docs/analytics/api-contract.md::GET /panel/analitik/umkm/:id`.
- `docs/analytics/ux-spec.md::Profil UMKM`, Privacy, Navigation/actions.
- Directus Phase 3 `usaha` field-level read/update/status permission.

```bash
rg -n 'Profil UMKM|NIK:|Telepon:|Domisili pribadi|Archive/Restore' docs/analytics/product-spec.md docs/analytics/ux-spec.md
rg -n 'GET /panel/analitik/umkm/:id|qualityStatus|canArchive' docs/analytics/api-contract.md
```

## Current contract and final desired contract

### Current

Record list has no target profile route. Raw source contains PII/financial/location data, while active read model contains only approved transforms.

### Final

- `GET /analitik/umkm/:id` validates UUID, role, active/archived scope, and returns semantic sections only. 404 does not distinguish absent vs unauthorized.
- Response meta follows schemaVersion 1 and UTC timestamp rules. Data contains opaque ID, title, badges, safe hero, sections/fields, and actions.
- Section order: Ringkasan, Usaha, Lokasi Usaha, Finansial, Tenaga Kerja, Pelaku Usaha, Kualitas dan Asal Data, Informasi Tambahan. Workforce section displays “Belum tersedia” while feature disabled; it never shows the unvalidated sum.
- NIK valid 16 digits displays exactly `************1234`; invalid/non-16 NIK displays `Tersimpan — disembunyikan` without suffix. Valid phone normalized to Indonesian `08` and 10–15 digits displays `08******1234`; other phone displays `Tersimpan — disembunyikan`. Raw values never leave source.
- Birth date is not persisted in read model. Worker computes age band at projection using the `dataAsOf` calendar date in Asia/Jakarta: `18–24`, `25–34`, `35–44`, `45–54`, `55–64`, `65+`; under 18/future/invalid is `Perlu verifikasi`, missing is `Belum tersedia`.
- Owner domicile is absent. Owner name is allowed. Business address/coordinates are allowed only here and authenticated Spasial; canvas remains aggregate.
- Financial exact values display only with quality `reported | missing | needs_verification`, Rupiah formatting, and “dilaporkan” wording.
- Source `foto` URL is quarantined and never serialized; hero uses fallback. A future Directus-managed file can activate through registry after private asset tests.
- Safe dynamic scalar fields render by allowlisted type; unknown/HTML/file/quarantined types fail closed and escaped. Empty fields remain visible as “Belum tersedia”.
- Actions: Edit deep-links to same-origin Directus Admin content route for approved usaha fields; Archive/Restore PATCHes only `status` through Directus Items API; copy internal authenticated link; PDF is Phase 8; previous/next uses the original safe records result.
- Archive is optimistic only after PATCH success; UI shows processing until worker projection ≤60s. Archived badge/action flips after status refresh. Hard delete is absent.
- Return context is stored in `history.state` and a short-lived session-memory key, never in a profile query containing record list IDs. Browser back restores config/page/sort/scroll; direct profile link returns to default Analitik.

## Ordered edits

1. Add profile service using only active-generation safe columns and registry-approved extra fields. Assemble semantic DTO on server; no client masking.
2. Register profile route with standard auth/meta/errors, generic 404, and sanitized logs.
3. Extend types and add `useUmkmProfile` for fetch, archive/restore, previous/next, return state, stale status.
4. Build profile hero, section renderer, and action bar. Do not create a universal schema renderer beyond the profile metadata contract.
5. Add profile page with accessible landmarks, URL fragments for sections, keyboard focus, mobile stacked sections, map plus text address alternative, fallback image.
6. Link Analytics record rows and preserve return state. Disable previous/next at boundaries.
7. Add API canary scans and Playwright active/archived/missing/invalid/dynamic/return flows.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Active, archived, unknown UUID, malformed UUID, wrong role, expired session.
- Valid/invalid/short NIK and phone; missing/future/underage birth date; missing owner.
- Complete/missing/negative/outlier financials; null exact coordinates; invalid dynamic HTML/file URL.
- Archive then worker pending, projected archived, restore, stale concurrent update, permission revoked, API failure.
- Previous/first/last/next with records list changed after navigation; stale neighbor becomes 404 without losing analysis return.
- Direct link vs link from analysis; reload profile; browser back; copy link.
- Screen reader field label/status/value; map has textual location; image fallback has useful alt.
- Browser timezone independence for age band and data timestamp.

## Validation commands

```bash
(cd services/directus/extensions/directus-extension-analitik && pnpm run build && pnpm test)
node --check services/directus/extensions/directus-extension-analitik/src/profile-service.js
(cd apps/web && pnpm run typecheck)
(cd apps/web && pnpm exec playwright test tests/e2e/umkm-profile.spec.ts)
(cd apps/web && pnpm run build)
```

Expected: exit 0; API tests recursively scan canary response/log DTO; browser tests cover active/archive/restore/return/previous-next/responsive/accessibility.

Actual stack:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-profile-e2e up -d --build postgis pgbouncer minio minioclient directus analytics-worker web
(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 pnpm exec playwright test tests/e2e/umkm-profile.spec.ts)
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-profile-e2e down -v
```

Expected: exit 0; actual Directus status PATCH emits outbox, worker projects within 60s, profile flips state.

## Runtime/browser proof and unproven boundary

Require p95 profile ≤5s on representative data, archive-to-visible ≤60s, actual Directus Admin edit link permission inspection, IDOR/wrong-role probes, and network/SSR/cache/log raw-PII canary scans. User confirmation is required before archive/restore on non-ephemeral data.

## No-advance condition

API/unit/browser/actual-stack gates pass; zero raw canary PII appears in response, DOM, URL, history, cache, log, job, or health; archive/restore and analysis return are proven.

## Required failure probes

- Seed exact canary NIK/phone/birth/private address; recursively scan every response/HTML/log/job/health/cache artifact for raw canary.
- Request valid record under wrong role and unknown record under correct role; external response class is non-enumerating.
- Race two status changes; final source status wins and projection remains idempotent.
- Break one dynamic field renderer; all other sections still render.
- Use malicious HTML/URL/file metadata; UI escapes/fails closed.
- Expire session while profile open; next action clears state and redirects without PII persistence.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-7-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 7
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback hides profile route/link and stops profile mutations; source archive status is not reversed automatically. API/worker stay private. Handoff to Phase 8 provides semantic profile DTO, masking version, actions, and PDF entry point.
