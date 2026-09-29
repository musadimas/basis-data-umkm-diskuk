# basis-data-umkm-diskuk

Basis data UMKM DisKUK Jawa Barat: aplikasi web privat (Nuxt), API Directus dengan
extension domain, read model analitik, dan worker terpisah untuk proyeksi/rebuild.

## Peta paket

| Paket | Isi |
| --- | --- |
| `apps/web` | Nuxt 4 — panel privat `/panel/*`, dashboard publik, proxy session Directus |
| `services/directus` | Directus + extension bundles: `analytics` (`/v1/analytics`: analysis, infographic, tabular, watchdog), `authentication` (`/v1/auth` + auth guards), `program` (`/v1/program`: talent, kpi, katalog, passport, klinik, kegiatan, registrasi, fasilitasi, peta, executive), `directus-extension-operasional` (`/operasional`), `shared/` auth |
| `services/analytics-worker` | Worker proyeksi/rebuild/reconcile/export read model analitik (process terpisah) |
| `services/caddy`, `services/storage` | Reverse proxy dan object storage (MinIO) |
| `docker/`, `docker-compose.yml` | PostGIS, PgBouncer, Redis, MinIO, Directus, web, worker |
| `docs/` | Kontrak domain analitik, ADR (`docs/architecture/decisions`), audit arsitektur |
| `scripts/` | Ingest SIDT, refresh snapshot, tileset spasial, benchmark analitik |

## Alur data singkat

CRUD/ingest → outbox `analitik_job` (trigger, same-transaction) → analytics worker
(claim `SKIP LOCKED` + lease) → read model `analitik_usaha_current` per generasi →
reconcile → atomic promotion + refresh snapshot legacy. API privat dibungkus session
policy same-origin di web sebelum menyentuh Directus.

## Perintah

Dari root (pnpm):

```bash
pnpm install                     # siapkan dependency
pnpm dev:direct                  # dev lokal: Directus + web via tunnel
pnpm lint:oxlint                 # lint seluruh repo (0 warning, 0 error)
```

Test per paket:

```bash
pnpm --dir apps/web test:unit                    # unit web (vitest)
pnpm --dir apps/web typecheck                    # vue-tsc
pnpm --dir apps/web build                        # build produksi web
pnpm --dir apps/web test:e2e --project=chromium  # Playwright, mock Directus
pnpm --dir services/directus/extensions/analytics test
pnpm --dir services/directus/extensions/authentication test
pnpm --dir services/directus test                # kontrak foundation
pnpm --dir services/analytics-worker test
```

Integrasi analitik bersifat opt-in terhadap stack disposable — tanpa env, suite
melaporkan `skipped` eksplisit, bukan pass palsu:

```bash
ANALYTICS_INTEGRATION_BASE_URL=http://127.0.0.1:8055 \
ANALYTICS_INTEGRATION_EMAIL=... ANALYTICS_INTEGRATION_PASSWORD=... \
pnpm --dir services/directus/extensions/analytics test
```

Worker mengharuskan `ANALYTICS_DATABASE_URL` dedicated (lihat `services/analytics-worker/src/config.js`).

## Dashboard operasional (rencana E2E Y/R)

Rencana, urutan phase, dan verdict per requirement ada di
`docs/dashboard-operasional-e2e-plan/main_plan.md`; status gate akhir di
`docs/dashboard-operasional-e2e-plan/stage_2/receipt_R05_acceptance.md` (saat ini `blocked`).
Tes Postgres nyata untuk extension `program` (`pnpm --dir services/directus/extensions/program test:pg`)
membutuhkan `DISKUK_TEST_PG_URL` dan template dari `scripts/test-db-template.sh` pada stack disposable.
Data dummy hanya untuk stack disposable: `docs/operasional/dummy-data-runbook.md`.

## Batas bukti

Unit/contract test dan build lokal membuktikan bentuk (SQL shape, kontrak response,
lifecycle worker), bukan SLO produksi. Pengukuran EXPLAIN/load/disposable stack,
deployment, dan restore mengikuti `docs/analytics/release-runbook.md`. Status
keputusan arsitektur dicatat pada header tiap ADR.
