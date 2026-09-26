# Phase 13 — Pencarian global Tabular (trigram), popup titik peta diperkaya, dan basemap satelit

## Objective, dependencies, observable result

- **Dependency:** Phase 6 (status talenta), Phase 4 (atribut Jabar, `assertUsahaAccess`).
- **Objective:** kotak pencarian global di Tabular (NIK 16 digit/NIB 13 digit exact; nama usaha/pemilik "mengandung" min. 3 karakter) dengan dukungan `pg_trgm` + skrip index GIN `CONCURRENTLY`; popup titik UMKM memuat pemilik, skala, KBLI 5 digit & kegiatan, omzet tahunan, badge sertifikasi, status talenta, tautan "Buka Profil Lengkap"; saklar basemap "Citra Satelit" (Esri World Imagery).
- **Observable result:** mengetik "leather" menampilkan "Wawan Leathercraft"; mengetik `9900000000001` menampilkan satu baris; klik titik Wawan di peta menampilkan "Status Talenta: Accelerator — Batch 1" dan badge "Halal Terverifikasi"; saklar "Citra Satelit" mengganti basemap.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-13-before.json
mkdir -p /tmp/operasional-evidence/phase-13
(cd apps/web && pnpm exec playwright test tests/e2e/spasial.spec.ts --project=chromium)
```

Salin screenshot hasil run di atas sebagai `/tmp/operasional-evidence/phase-13/map-before.png` sebelum edit.

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926I-enable-pg-trgm.js` |
| create | `scripts/create-operasional-search-indexes.sql` |
| modify | `services/directus/extensions/shared/tabular-filter.cjs` |
| modify | `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` |
| modify | `services/directus/extensions/directus-extension-operasional/src/usaha-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| modify | `services/directus/extensions/directus-extension-operasional/test/usaha-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `docs/operasional/dummy-data-runbook.md` |
| modify | `apps/web/app/components/dashboard/TabularData.vue` |
| modify | `apps/web/app/components/dashboard/map/Choropleth.client.vue` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/tabular-search-peta.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/shared/tabular-filter.cjs::buildTabularFilter` (`push(...)` per kolom; return `{ where, params, hasFilters }`)
- `services/directus/extensions/directus-extension-tabular/src/index.js` route `/` (menangani `error.statusCode === 400` → `next(error)`)
- `apps/web/app/components/dashboard/TabularData.vue` `rowsQuery` (baris `kota: appliedFilters.kabupatenKota …`), `useFetch<TabularRowsResponse>("/panel/tabular/", { query: rowsQuery, lazy: true })`
- `apps/web/app/components/dashboard/map/Choropleth.client.vue::onPointClick`, `pointsFeatureCollection` (properti `id`), blok style `sources: { osm: … }`, grup saklar `role="switch"` ("Wilayah", "Titik UMKM")
- `scripts/build-spatial-tiles.sh` (properti tile `'id', t.id` — popup berfungsi juga pada mode PMTiles)

```bash
rg -n "const buildTabularFilter|push\(\"t.kode_kbli\"" services/directus/extensions/shared/tabular-filter.cjs
rg -n 'error.statusCode === 400' services/directus/extensions/directus-extension-tabular/src/index.js
rg -n 'useFetch<TabularRowsResponse>\("/panel/tabular/"' apps/web/app/components/dashboard/TabularData.vue
rg -n "function onPointClick|tile.openstreetmap.org|role=\"switch\"" apps/web/app/components/dashboard/map/Choropleth.client.vue
rg -n "'id', t.id" scripts/build-spatial-tiles.sh
```

## Current contract and final desired contract

### Current

Tabular tanpa parameter pencarian; popup titik statis dari properti fitur; basemap tunggal OSM.

### Final

- Migrasi `20260926I`: `CREATE EXTENSION IF NOT EXISTS pg_trgm` (tanpa index; aman saat boot); `down`: no-op dengan komentar (ekstensi dapat dipakai objek lain).
- `scripts/create-operasional-search-indexes.sql` (di luar transaksi, satu statement per baris):
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usaha_nama_trgm ON usaha USING gin (nama gin_trgm_ops);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pelaku_usaha_nama_trgm ON pelaku_usaha USING gin (nama_lengkap gin_trgm_ops);
  ```
  Header komentar: hanya untuk disposable stack atau maintenance window dengan konfirmasi pengguna; tanpa index, pencarian nama tetap benar tetapi dapat mengenai timeout baca existing (`QUERY_TIMEOUT`).
- `tabular-filter.cjs`:
  - `searchClause(q)` → `null` bila `q` kosong; trim, maks. 100 char; `/^\d{16}$/` → `t.id IN (SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nik = ?)`; `/^\d{13}$/` → `t.id IN (SELECT id FROM usaha WHERE nib = ?)`; panjang ≥3 → `t.id IN (SELECT id FROM usaha WHERE nama ILIKE ? ESCAPE '\\' UNION SELECT u.id FROM usaha u JOIN pelaku_usaha pu ON pu.id = u.pelaku_usaha WHERE pu.nama_lengkap ILIKE ? ESCAPE '\\')` dengan pola `%<q ter-escape %,_,\>%` (dua binding); selain itu melempar error `{ statusCode: 400, code: "Q_TOO_SHORT", message: "Kata kunci minimal 3 karakter" }`.
  - `buildTabularFilter` menambahkan klausa `searchClause(query.q)` (bila ada) ke `clauses`/`params` → `hasFilters` true (tidak memakai fast path snapshot).
- Operasional `usaha-service.js::getUsahaRingkas(database, id, operator)` (DATA_ROLES, `assertUsahaAccess`) → `{ data: { id, nama, pemilik, skala, kodeKbli, deskripsiKbli, omzetTahunan, sertifikasi: { halal, pirtBpom, hkiMerek } (boolean|null dari atribut), talenta: { status, batch } | null (talenta aktif non-`ditolak`), profilPath: "/dashboard/umkm/<id>" } }`; route `GET /usaha/:id/ringkas`.
- Web:
  - `TabularData.vue`: di atas panel filter, form pencarian `role="search"`: `UiInput type="search"` `aria-label="Cari NIK, NIB, nama usaha, atau nama pemilik"` placeholder "Cari NIK (16 digit), NIB (13 digit), nama usaha, atau nama pemilik", tombol "Cari" dan "Hapus"; validasi klien: kosong → hapus pencarian; bukan 13/16 digit dan <3 karakter → teks "Kata kunci minimal 3 karakter" tanpa request; `appliedSearch` masuk `rowsQuery.q` dan ekspor CSV (`q` ikut body POST export); pencarian baru mengembalikan halaman ke 1 dan menghapus cursor; keadaan kosong → "Tidak ada UMKM yang cocok dengan pencarian.".
  - `Choropleth.client.vue`:
    - `onPointClick`: buat popup awal (nama + skala dari properti, baris "Memuat detail…"), `const token = ++popupToken`; `$fetch("/panel/operasional/usaha/<id>/ringkas")`; bila `token !== popupToken` abaikan; sukses → ganti konten (DOM API + `textContent`): judul nama; "Pemilik: {pemilik}"; badge skala; "KBLI {kodeKbli} – {deskripsiKbli}"; "Omzet Tahunan: {formatAnalyticsCurrency}" atau "Omzet belum dilaporkan"; badge hijau untuk sertifikasi true ("Halal Terverifikasi", "PIRT/BPOM", "Hak Merek"); "Status Talenta: {label TALENTA_STATUS} — {batch}" atau "Belum masuk Talent Pool"; tautan "Buka Profil Lengkap" (`href = profilPath`, klik → `event.preventDefault(); navigateTo(profilPath)`); gagal → "Detail usaha belum dapat dimuat." (popup tetap menampilkan data dasar).
    - Style: tambah source raster `esri` (`tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]`, `tileSize: 256`, `maxzoom: 19`, `attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"`) dan layer `{ id: "esri", type: "raster", source: "esri", layout: { visibility: "none" } }` setelah layer `osm`.
    - Saklar ketiga pada grup saklar existing (pola `role="switch"` identik): label "Citra Satelit", state lokal `satellite` (default false); toggle → `setLayoutProperty("esri","visibility", satellite ? "visible" : "none")` dan `setLayoutProperty("osm","visibility", satellite ? "none" : "visible")`.
  - `types/operasional.ts` tambah `UsahaRingkas`.
- Runbook `docs/operasional/dummy-data-runbook.md` tambah bagian "Index pencarian" (perintah `psql -f scripts/create-operasional-search-indexes.sql` untuk disposable stack; production hanya dengan konfirmasi + maintenance window).

## Ordered edits

1. Migrasi `20260926I` + kontrak test (memuat `CREATE EXTENSION IF NOT EXISTS pg_trgm`, tidak memuat `CREATE INDEX`); buat skrip index.
2. `tabular-filter.cjs` + tabular test: NIK 16 digit → binding NIK dan subquery `pelaku_usaha`; NIB → subquery `usaha`; "lea" → dua binding `%lea%`; input `50%_` → pola ter-escape `%50\%\_%`; "ab" → 400 `Q_TOO_SHORT`; kabkota + q → klausa kota tetap ada; `q` tidak mengaktifkan fast path snapshot.
3. `usaha-service.js::getUsahaRingkas` + route + test (kabkota usaha kota lain → 404; usaha tanpa atribut → sertifikasi null; talenta `ditolak` diabaikan).
4. Web `TabularData.vue`, `Choropleth.client.vue`, tipe.
5. Mock fixture: `/panel/tabular/` dengan `q` → memfilter baris mock berdasarkan nama mengandung q (case-insensitive) dan `q=9900000000001` → 1 baris "Wawan Leathercraft"; route `/panel/operasional/usaha/:id/ringkas` (pemilik "Wawan Setiawan", KBLI 15121, omzet 780000000, halal true, pirt true, hki true, talenta accelerator Batch 1).
6. `tabular-search-peta.spec.ts`: provinsi tabular — ketik "ab" → pesan validasi tanpa request; "leather" → request `q=leather` dan sel "Wawan Leathercraft"; NIB → 1 baris; screenshot `tabular-search.png`. Peta spasial (`installMockDirectus({ authenticated: true, renderMap: true })`): saklar "Citra Satelit" `aria-checked` berubah true → false; screenshot `map-satellite.png` (bukti UI saklar; tile eksternal tidak dijamin termuat di CI). Popup tidak diklik di Playwright mock (MapLibre butuh WebGL; pola `spasial.spec.ts` tidak mengassert kanvas); kontrak data popup diuji lewat `page.request.get("/panel/operasional/usaha/<id>/ringkas")` terhadap mock, dan render popup diverifikasi manual pada runtime proof.
7. `operasional.directus.spec.ts`: provinsi tabular cari "leather" → "Wawan Leathercraft"; cari `9900000000001` → 1 baris; kabkota cari "Kopi" → 0 baris (Kopi Gunung Garut di luar Subang); provinsi `page.request.get("/panel/operasional/usaha/d0000000-0000-4000-8000-000000000001/ringkas")` → `talenta.status === "accelerator"` dan `sertifikasi.halal === true`. Render popup di peta diverifikasi manual (runtime proof).

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- NIK 16 digit yang tidak ada → 0 baris, tanpa membocorkan informasi.
- Pencarian + filter skala/kota bersamaan → AND.
- Karakter `%`/`_` di kata kunci diperlakukan literal.
- Tanpa index trigram (production belum dijalankan) → query benar tetapi bisa `QUERY_TIMEOUT` → UI existing menampilkan error timeout.
- Klik titik cepat berulang → hanya respons terakhir yang dirender (token).
- Titik dari PMTiles (provinsi) → `id` tersedia → popup kaya; kabkota (GeoJSON) sama.
- Basemap satelit gagal dimuat (jaringan) → peta tetap berfungsi dengan layer data; saklar dapat dikembalikan ke Street.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-tabular test
pnpm --dir services/directus/extensions/directus-extension-infografis test
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/components/dashboard/TabularData.vue app/components/dashboard/map/Choropleth.client.vue app/types/operasional.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; screenshot `tabular-search.png`, `map-satellite.png`.

## Runtime/browser proof and unproven boundary

Disposable stack + seed; jalankan skrip index:

```bash
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_DATABASE" < scripts/create-operasional-search-indexes.sql
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%' ORDER BY 1"
```

Expected: `idx_pelaku_usaha_nama_trgm`, `idx_usaha_nama_trgm`. Lalu jalankan `operasional.directus.spec.ts` dan verifikasi manual di browser (headed) `/dashboard/spasial` sebagai provinsi: klik titik Wawan → popup memuat pemilik, KBLI 15121, omzet, badge "Halal Terverifikasi", "Status Talenta: Accelerator — Batch 1", tautan profil berfungsi; saklar "Citra Satelit" menampilkan citra; simpan `map-popup.png` ke `/tmp/operasional-evidence/phase-13/`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: rencana query trigram pada 5,4 juta baris, render popup nyata (WebGL), ketersediaan tile Esri.

## No-advance condition

Jangan lanjut bila pencarian kabkota mengembalikan usaha di luar wilayahnya atau input pencarian tidak di-escape.

## Required failure probes

- Unit: `q = "ab"` → 400.
- Unit: kabkota + `q` → klausa kota tetap diterapkan.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-13-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 13
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; index trigram (bila dibuat) dihapus manual dengan dua statement `DROP INDEX CONCURRENTLY IF EXISTS idx_usaha_nama_trgm;` dan `DROP INDEX CONCURRENTLY IF EXISTS idx_pelaku_usaha_nama_trgm;` (dengan konfirmasi di environment bersama). Handoff ke Phase 14.
