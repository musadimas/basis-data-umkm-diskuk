# Phase 6 — Canvas Analitik yang dapat diakses dan stateful

## Objective, dependencies, observable result

- **Dependency:** Phase 5 schemaVersion 1 fixtures and actual API integration are frozen/proven.
- **Objective:** deliver the single-canvas analyst journey without duplicating server semantics in components.
- **Observable result:** authenticated user opens the default city distribution, changes draft controls, applies once, cross-filters or drills explicitly, sees denominator/coverage/freshness, switches compatible visuals/table, opens records, and restores state through URL/back/forward.

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-6-before.json
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| create | `apps/web/app/types/analytics.ts` |
| create | `apps/web/app/lib/analytics-query.ts` |
| create | `apps/web/app/lib/analytics-format.ts` |
| create | `apps/web/app/composables/useAnalyticsCatalog.ts` |
| create | `apps/web/app/composables/useAnalysisState.ts` |
| create | `apps/web/app/composables/useAnalyticsQuery.ts` |
| create | `apps/web/app/components/analytics/AnalyticsHeader.vue` |
| create | `apps/web/app/components/analytics/TemplatePicker.vue` |
| create | `apps/web/app/components/analytics/QueryBuilder.vue` |
| create | `apps/web/app/components/analytics/FilterChips.vue` |
| create | `apps/web/app/components/analytics/MetricSummary.vue` |
| create | `apps/web/app/components/analytics/InsightPanel.vue` |
| create | `apps/web/app/components/analytics/AnalyticsVisual.client.vue` |
| create | `apps/web/app/components/analytics/AnalyticsDataTable.vue` |
| create | `apps/web/app/components/analytics/AnalyticsRecordTable.vue` |
| create | `apps/web/app/components/analytics/AnalyticsState.vue` |
| create | `apps/web/app/pages/(private)/dashboard/analitik.vue` |
| create | `apps/web/tests/unit/analytics-query.test.ts` |
| create | `apps/web/tests/unit/analytics-format.test.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/analytics-canvas.spec.ts` |
| modify | `apps/web/app/pages/(private)/dashboard/index.vue` |
| modify | `apps/web/app/components/dashboard/map/Infographic.vue` |
| modify | `apps/web/app/components/dashboard/chart/TopCategories.vue` |
| modify | `apps/web/app/components/dashboard/chart/ClusterBar.vue` |

## Exact symbols and search anchors

- Existing navigation object in `constants/NAVIGATION.ts`.
- Draft/applied pattern and cascading options in current `dashboard/tabular.vue`; reuse behavior, not page-specific code.
- Existing UI primitives: select, sheet, dialog, card, badge, skeleton, button, input, scroll-area.
- Existing Unovis dependencies and MapLibre package; do not add another chart/map library. Existing `DashboardMapInfographic`, `TopCategories`, and `ClusterBar` contain hard-coded/fixed-scale or legacy-share behavior and are explicit migration consumers in this phase.
- `docs/analytics/ux-spec.md` Canvas, Query builder, Filter, Visual, Interaction, Error, Responsive, Accessibility sections.

```bash
rg -n 'const filters = reactive|const appliedFilters|applyFilters|watch\(' 'apps/web/app/pages/(private)/dashboard/tabular.vue'
rg -n '"@unovis/(vue|ts)"|"maplibre-gl"' apps/web/package.json
rg -n '^## (4|5|6|7|8|9|10|14|15|16)\.' docs/analytics/ux-spec.md
```

## Current contract and final desired contract

### Current

No Analitik route/nav/types/components. Existing Tabular has a useful local apply pattern but no URL restore, semantic metadata, cancellation, cross-filter/drill distinction, coverage, or current-state insights.

### Final

- Sidebar order is Infografis, Analitik, Data Tabular, Peta Spasial. Page route is `/dashboard/analitik` with dashboard layout and global auth.
- `analytics.ts` mirrors schemaVersion 1 exactly. Components receive semantic view models, not raw API/Directus fields.
- `analytics-query.ts` owns allowlisted URL serialization/parsing/canonicalization. Allowed keys contain registry IDs, safe reference IDs/codes, aggregation, visual, sort/page/cursor. NIK, phone, record UUID, free text, raw labels, token, and unknown keys are rejected. Invalid URL falls back to default and shows a nontechnical warning.
- `analytics-format.ts` owns Indonesian numbers/currency/percent and absolute UTC-to-Asia/Jakarta time. No component constructs locale formats independently.
- `useAnalyticsCatalog` fetches metadata/templates/options and invalidates on schema version. `useAnalysisState` owns draft/applied config, safe URL, breadcrumbs, filter chips, visual compatibility, return context. `useAnalyticsQuery` owns AbortController, stale-response suppression, query/records, and LKG retention.
- Existing Infografis map stops using hard-coded composite regions/counts and consumes the same authoritative city geometry/key contract; its region action opens Analitik with a safe filter. Top-KBLI scale becomes data-derived with keyboard/table semantics; sector bars display filtered-total share, not largest-sector index.
- Initial applied config is “Sebaran UMKM Saat Ini”: count by city, no breakdown/filter, bar or choropleth when authoritative geometry gate is true. Default query runs once after catalog; control changes remain local until **Terapkan**.
- Layout follows the UX sequence. Mobile builder is a focus-trapped Sheet and restores focus; desktop/tablet uses grid controls.
- Filters are searchable/cascading. Parent change removes only incompatible children. Every chip has a human label from catalog and individual remove button.
- Cross-filter selection updates a chip and requires explicit Apply for a new server query. **Drill down** is a separate button that changes hierarchy and breadcrumb. Chart click alone never drills.
- Supported visuals: KPI, bar, stacked/grouped bar, donut for part-to-whole ≤6, 20-bin histogram for active numeric distribution, authoritative choropleth, table. No line chart. Incompatible visual controls are disabled with reason.
- Every visual exposes the same data via a visible **Lihat tabel**, persistent screen-reader summary, unit/denominator/coverage, and keyboard-accessible selection. Choropleth has a region list/table alternative; unknown bucket is table-only.
- Insight panel is deterministic from current response: highest concentration, largest current-snapshot difference, missing/unmapped warnings, IQR outliers when numeric. It states formula, denominator, filter, coverage, and **Lihat bukti** focus link. No causal/trend language.
- Existing visible LKG remains while refetching. Loading, empty, partial, invalid query, unavailable field, stale, general failure use exact Indonesian copy from UX spec and no backend jargon.
- Records table uses cursor pagination, safe sort, profile link, and records count. Analysis route/page/sort/cursor/scroll anchor is saved in history state for Phase 7 return.
- Display date test is independent of browser timezone and always WIB.

## Ordered edits

1. Add nav entry and exact TypeScript contract.
2. Implement pure query URL and format modules with unit tests before Vue components.
3. Implement three composables as deep state/data seams; components do not call `$fetch` directly.
4. Build header/freshness, template picker, query builder, chips, metric/insight, state panel, visual, data table, and records table.
5. Implement visual compatibility and interaction once in `AnalyticsVisual.client.vue`; use Unovis/MapLibre and metadata geometry. Keep equivalent table outside chart client boundary for SSR/accessibility.
6. Assemble page in specified order. Desktop/tablet/mobile layouts use existing design system; no new generic universal dashboard abstraction.
7. Replace the existing Infografis hard-coded map with metadata geometry + real region values, wire region/sector/KBLI actions to safe Analitik configs, and remove fixed axis/legacy share labels while preserving overall page layout.
8. Expand deterministic Directus fixture for every API state and add Playwright golden flows plus unit tests.
9. Capture named before/after screenshots in Playwright artifacts; preserve existing pages except the intentional sidebar row.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Default, custom, saved-compatible URL; unknown/removed field in URL; parent filter invalidates child.
- Rapid two Applies; first response arrives last and is ignored. Abort while old LKG remains.
- Zero/one/6/7/20/21 groups; negative values disable donut; histogram active/inactive.
- Mapped/unmapped, empty, partial, stale LKG, processing without data, 401 session expiry, 403 role, 409 field, 422 complexity, 504 timeout.
- Keyboard only controls/chart/table/map; reduced motion; focus trap/return; non-color selected state.
- Desktop 1440×900, tablet 1024×768, mobile 390×844; long Indonesian labels and 200% zoom.
- Browser timezone UTC and America/Los_Angeles display identical WIB.
- Back/forward and reload restore applied config but not an unapplied draft. No record UUID or PII in URL.

## Validation commands

```bash
(cd apps/web && pnpm run typecheck)
(cd apps/web && pnpm run test:unit -- tests/unit/analytics-query.test.ts tests/unit/analytics-format.test.ts)
(cd apps/web && pnpm exec playwright test tests/e2e/analytics-canvas.spec.ts)
(cd apps/web && pnpm run build)
```

Expected: exit 0; Playwright exercises desktop/tablet/mobile, keyboard, both browser timezones, state/error matrix, URL/back-forward, and screenshots.

Actual API browser run:

```bash
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-canvas-e2e up -d --build postgis pgbouncer minio minioclient directus analytics-worker web
(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 pnpm exec playwright test tests/e2e/analytics-canvas.spec.ts)
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-canvas-e2e down -v
```

Expected: exit 0 and real session/API/read-model journey works.

## Runtime/browser proof and unproven boundary

Automated task flows must be followed by the actual analyst performing the nine golden tasks with a stopwatch; each analytical question must be answered in ≤3 minutes. Automated E2E does not prove human task time. WCAG proof includes axe scan, keyboard transcript, screen-reader summary inspection, and contrast evidence.

## No-advance condition

Typecheck, unit, mock Playwright, actual-stack Playwright, responsive screenshots, keyboard/accessibility, and URL state gates pass. No fabricated map, line chart, workforce template, or unsafe URL appears.

## Required failure probes

- Delay first Apply beyond second; old response never replaces latest.
- Remove a registry field used in URL; page preserves other config and warns.
- Return partial KBLI coverage; denominator and unmapped warning remain visible.
- Disable geometry readiness; page uses bar/table and does not render mock map.
- Force 401 during refetch; private cache clears and route redirects.
- Inspect URL/history/SSR HTML for PII canaries; none occur.
- Feed changed region totals and sector ordering to Infografis; map/bar labels follow data, no hard-coded count/fixed axis/largest-sector percentage survives.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-6-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 6
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback removes only the Analitik nav/page bundle; private API/worker remain. Never route users to public legacy data as fallback. Handoff to Phase 7 provides applied-state return contract, records cursor, profile link shape, and screenshots.
