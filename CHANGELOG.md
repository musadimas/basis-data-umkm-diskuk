# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Docker infrastructure: `docker/` directory with Dockerfiles for all services (`postgis`, `minio`, `minioclient`, `directus`, `web`)
- `docker-compose.yml` — full stack with `postgis`, `pgbouncer`, `minio`, `minioclient`, `directus`, `web` services and `diskuk_net` network
- MinIO S3-compatible object storage with bucket auto-provisioning via `minioclient`
- pgbouncer connection pooler between `postgis` and `directus`
- `apps/web/.npmrc` with `shamefully-hoist` and `strict-peer-dependencies` for pnpm + Nuxt compatibility
- `@vueuse/core` dependency for SSR width support

### Changed
- Merged `directus.client.ts` and `directusWS.client.ts` into a single plugin providing both `$directus` and `$directusWS`
- Renamed plugins to follow Nuxt naming conventions: `useSSRWidth.ts` → `ssr-width.ts`, `vue-query.ts` → `query.ts`
- Directus storage switched from local filesystem to S3 (MinIO)
- `businesses.sumber_id` column renamed from `id_sumber` to `sumber_id` (id-as-suffix convention)

---

## 2026-08-06

### Added
- Nuxt 4 web application (`apps/web/`) with Vue 3 and TypeScript
- Directus SDK integration (`@directus/sdk`) with REST, session-based authentication, and WebSocket realtime support
- TanStack Query (`@tanstack/vue-query`) for data fetching, SSR hydration, and IndexedDB persistence
- shadcn-vue component library with Tailwind CSS v4
- `Button` UI component (shadcn)
- IndexedDB query persister (`apps/web/app/lib/idb.ts`) for offline-capable caching
- Unauthorized auth event handler with automatic redirect to `/sign-in`

### Changed
- All Directus migration table and column names translated from English to Bahasa Indonesia:
  - Tables: `provinces` → `provinsi`, `cities` → `kota`, `districts` → `kecamatan`, `sub_districts` → `kelurahan`, `business_classifications` → `klasifikasi_usaha`, `addresses` → `alamat`, `entrepreneurs` → `pelaku_usaha`, `businesses` → `usaha`, `workforce_stats` → `statistik_tenaga_kerja`, `data_sync_logs` → `log_sinkronisasi`
  - Columns: `name` → `nama`, `code` → `kode`, `full_name` → `nama_lengkap`, `gender` → `jenis_kelamin`, `education_level` → `tingkat_pendidikan`, `legal_status` → `status_hukum`, `scale` → `skala`, and others
  - Directus UI labels and dropdown choices translated to Bahasa Indonesia

---

## 2026-08-03

### Added
- Initial project structure
- Directus 11 service (`services/directus/`) with 6 database migrations for the UMKM dashboard schema:
  - `provinsi`, `kota`, `kecamatan`, `kelurahan` — Indonesian geographic hierarchy with PostGIS geometry
  - `klasifikasi_usaha` — KBLI business classification
  - `alamat` — address records with RT/RW
  - `pelaku_usaha` — entrepreneur/business owner records with NIK, education level, disability status
  - `usaha` — business records with KBLI classification, legal status, scale, and financial fields
  - `statistik_tenaga_kerja` — workforce statistics by gender and disability
  - `log_sinkronisasi` — data synchronisation logs
- `docker-compose.yml` with PostgreSQL + PostGIS and Directus 11
- `scripts/seed.mjs` — seed script for UMKM dashboard data
- `.gitignore`
- `README.md`
