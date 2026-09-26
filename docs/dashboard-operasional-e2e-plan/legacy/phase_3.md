# Phase 3 — Scoping wilayah Admin Kab/Kota di seluruh endpoint data

## Objective, dependencies, observable result

- **Dependency:** Phase 1 (`resolveOperator`, `requireRole`), Phase 2 (web role/route).
- **Objective:** Admin Kab/Kota dapat memakai Infografis, Analitik, Tabular, Spasial, dan profil UMKM, tetapi setiap endpoint memaksa filter `kota = operator.kotaId` server-side; PMTiles provinsi ditolak (fallback GeoJSON terfilter); UI mengunci filter kab/kota.
- **Observable result:** akun `dummy_admin.subang@…` hanya melihat usaha Kabupaten Subang di semua halaman data; permintaan dengan `kota` lain tetap mengembalikan data Subang; profil usaha di luar Subang → 404.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-3-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926B-kabkota-analytics-access.js` |
| modify | `services/directus/extensions/shared/operator.cjs` |
| modify | `services/directus/extensions/directus-extension-tabular/src/index.js` |
| modify | `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` |
| modify | `services/directus/extensions/directus-extension-infografis/src/index.js` |
| modify | `services/directus/extensions/directus-extension-infografis/test/index.test.cjs` |
| create | `services/directus/extensions/directus-extension-analitik/src/scope.js` |
| modify | `services/directus/extensions/directus-extension-analitik/src/index.js` |
| modify | `services/directus/extensions/directus-extension-analitik/src/metadata.js` |
| modify | `services/directus/extensions/directus-extension-analitik/src/profile-service.js` |
| modify | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| create | `services/directus/extensions/directus-extension-analitik/test/scope.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `apps/web/app/constants/ROLES.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| modify | `apps/web/app/composables/useTabularFilters.ts` |
| modify | `apps/web/app/pages/(private)/dashboard/index.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/spasial.vue` |
| modify | `apps/web/app/components/dashboard/TabularData.vue` |
| modify | `apps/web/tests/unit/roles.test.ts` |
| modify | `apps/web/tests/e2e/roles.spec.ts` |
| create | `apps/web/tests/e2e/kabkota-scope.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/directus-extension-tabular/src/index.js`: route `/status`, `/options`, `/kelurahan`, `/`, `/export` (POST, GET), `/export/:jobId`, `/export/:jobId/download`, `/spasial/authorize`, `/spasial/tileset`, `/spasial`; `buildTabularFilter(q)` pada setiap route data.
- `services/directus/extensions/directus-extension-infografis/src/index.js::readPayload`, `readMapPayload`, `attachAuthoritativeGeometry`, route `/` dan `/map`.
- `services/directus/extensions/directus-extension-analitik/src/index.js::wrap`, route `/metadata/options`, `/query`, `/records`, `/umkm/:id`, `/exports`, `/exports/:jobId`, `/exports/:jobId/download`.
- `services/directus/extensions/directus-extension-analitik/src/metadata.js::getOptions` (cabang `kota_nama|kota_kode`, `kecamatan_*`, `kelurahan_*`).
- `services/directus/extensions/directus-extension-analitik/src/profile-service.js::getProfile` (`actions.canEdit/canArchive/canRestore/editPath`).
- `services/directus/extensions/directus-extension-analitik/src/query-service.js::queryAnalytics` (`opts.permissionScope`).
- `apps/web/app/composables/useTabularFilters.ts::defaultTabularFilters`, `useTabularFilters`.
- `apps/web/app/pages/(private)/dashboard/index.vue::defaultFilters`, `canMapGoBack`, `mapBack`, `<UiSelect v-model="filters.kabupatenKota">`.
- `apps/web/app/pages/(private)/dashboard/spasial.vue` `<UiSelect v-model="filters.kabupatenKota">`.
- `apps/web/app/components/dashboard/TabularData.vue::defaultFilters`, `<UiSelect v-model="filters.kabupatenKota" :disabled=`.

```bash
rg -n 'router\.(get|post)\("' services/directus/extensions/directus-extension-tabular/src/index.js
rg -n "buildTabularFilter\(" services/directus/extensions/directus-extension-tabular/src/index.js services/directus/extensions/directus-extension-infografis/src/index.js
rg -n "function wrap|routeGuard\(req, next\)" services/directus/extensions/directus-extension-analitik/src/index.js
rg -n 'semantic_id === "kota_nama"|semantic_id === "kecamatan_id"|semantic_id === "kelurahan_id"' services/directus/extensions/directus-extension-analitik/src/metadata.js
rg -n "canEdit: true|canArchive|editPath" services/directus/extensions/directus-extension-analitik/src/profile-service.js
rg -n 'v-model="filters.kabupatenKota"' "apps/web/app/pages/(private)/dashboard/index.vue" "apps/web/app/pages/(private)/dashboard/spasial.vue" apps/web/app/components/dashboard/TabularData.vue
rg -n "const canMapGoBack|function mapBack" "apps/web/app/pages/(private)/dashboard/index.vue"
```

## Current contract and final desired contract

### Current

Semua endpoint data hanya untuk provinsi/admin (default `roles` Phase 1); kabkota 403; tidak ada scoping.

### Final

- `operator.cjs` tambah:
  - `scopeTabularQuery(query, operator)` → untuk kabkota mengembalikan salinan `query` dengan `kota: String(operator.kotaId)` (menimpa nilai klien); role lain mengembalikan `query ?? {}` apa adanya.
  - `scopeTabularOptions(options, operator)` → untuk kabkota `{ ...options, kota: options.kota.filter(k => Number(k.id) === operator.kotaId), kecamatan: options.kecamatan.filter(k => Number(k.kotaId) === operator.kotaId) }`; role lain apa adanya.
  - `DATA_ROLES = ["provinsi", "kabkota"]`.
- Tabular (semua route data memakai `routeGuard(req, next, { roles: DATA_ROLES })`, lalu `const operator = await resolveOperator(database, req.accountability)` dan `scopeTabularQuery`):
  - `/options` → `scopeTabularOptions`.
  - `/kelurahan` → untuk kabkota, query kelurahan menambahkan `AND EXISTS (SELECT 1 FROM kecamatan kc WHERE kc.id = kelurahan.kecamatan AND kc.kota = ?)`; kecamatan di luar kota → `data: []`.
  - `/`, `/spasial`, `POST /export`, `GET /export` → filter hasil `scopeTabularQuery` (untuk POST export, gabungan `{...req.query, ...body}` di-scope setelah digabung).
  - `/export/:jobId`, `/export/:jobId/download` → roles `DATA_ROLES` (ownership existing tetap).
  - `/spasial/tileset` → kabkota `{ data: null }` (frontend otomatis fallback GeoJSON).
  - `/spasial/authorize` dan `/status` → tetap default (provinsi saja; kabkota 403).
  - `/publish` → tetap `adminOnly`.
- Infografis `/` dan `/map`: roles `DATA_ROLES`; `readPayload`/`readMapPayload`/`attachAuthoritativeGeometry` menerima query hasil `scopeTabularQuery` (kabkota tidak pernah memakai fast path snapshot provinsi karena `hasFilters` true).
- Analitik:
  - `scope.js`: `KOTA_FIELDS = new Set(["kota_id","kota_kode","kota_nama"])`; `scopeAnalysisRequest(request, operator)` → kabkota: buang filter dengan `fieldId|field` di `KOTA_FIELDS`, tambahkan `{ fieldId: "kota_id", operator: "eq", value: String(operator.kotaId) }`; role lain apa adanya; `permissionScopeOf(operator)` → `"kabkota:" + kotaId` atau `"provinsi"`; `assertUsahaInScope(database, usahaId, operator)` → kabkota: `SELECT 1 FROM analitik_usaha_current c JOIN analitik_active_generation p ON p.id=1 AND p.active_generation_id=c.generation_id WHERE c.usaha_id=? AND c.kota_id=?`; tidak ada → `AnalyticsApiError(404, "PROFILE_NOT_FOUND")`.
  - `index.js`: `wrap(req, res, next, task, roles = DATA_ROLES)` memanggil `routeGuard(req, next, { roles })`; task menerima `operator` hasil `resolveOperator`. `/metadata/options` → `getOptions(database, query, operator)`; `/query` → `queryAnalytics(database, scopeAnalysisRequest(body, operator), { user, permissionScope: permissionScopeOf(operator) })`; `/records` → `listRecords(database, scopeAnalysisRequest(body, operator), …)`; `/umkm/:id` → `getProfile(database, id, operator)`; `/exports` → body dengan `config: scopeAnalysisRequest(body.config ?? {}, operator)`; bila `type|exportType === "profile_pdf"` → `assertUsahaInScope(database, body.profileId, operator)` sebelum submit; `/exports/:jobId` dan download → roles `DATA_ROLES`. `/metadata`, `/templates`, `/status` → roles `DATA_ROLES`.
  - `metadata.js::getOptions(database, query, operator)`: kabkota + field `kota_nama|kota_kode` → `[{ id: String(operator.kotaId), label: operator.kotaNama }]`; `kecamatan_*` → paksa `parentId = operator.kotaId` (abaikan parent klien); `kelurahan_*` → tambahkan `AND kc.kota = ?` (binding `operator.kotaId`) di samping scope parent.
  - `profile-service.js::getProfile(database, id, operator)`: SELECT tambah `c.kota_id`; kabkota dengan `kota_id !== operator.kotaId` → 404 `PROFILE_NOT_FOUND`; `actions.canEdit = operator.role === "provinsi"`, `canArchive = operator.role === "provinsi" && status === "active"`, `canRestore = operator.role === "provinsi" && status === "archived"` (`editPath` tetap).
- Migrasi `20260926B-kabkota-analytics-access.js`: salin empat permission `analitik_view` (read/create/update/delete owner-only, fields identik dengan `20260819C`) untuk policy kabkota `542bb438-226b-49b6-8792-bcfc614560a5` (`WHERE NOT EXISTS`); `down` menghapusnya.
- Web:
  - `ROLE_ROUTES.kabkota` = `/dashboard`, `/dashboard/analitik`, `/dashboard/tabular`, `/dashboard/spasial`, `/dashboard/umkm`, `/dashboard/akun`; `ROLE_HOME.kabkota = "/dashboard"`; tambah `lockedKotaId(user: OperatorProfile | null): string | null` (kabkota dengan kota → `String(kota.id)`, selain itu null).
  - `NAVIGATION_LINKS.kabkota = [{ title: "dashboard", items: [ { id: "infografis", label: "Dasbor Kewilayahan", to: "/dashboard", icon: ChartColumnDecreasing }, { id: "analitik", label: "Analitik", to: "/dashboard/analitik", icon: ChartColumnDecreasing }, { id: "tabular", label: "Data Lapangan", to: "/dashboard/tabular", icon: Table }, { id: "spasial", label: "Peta Spasial UMKM", to: "/dashboard/spasial", icon: Map } ] }, { title: "akun", items: [<item akun existing>] }]`.
  - `useTabularFilters`: default `kabupatenKota = lockedKotaId(auth.user.value) ?? "semua"` untuk state awal dan reset; kembalikan `lockedKota` (computed).
  - `index.vue`, `TabularData.vue`: `defaultFilters()` memakai `lockedKotaId(...) ?? "semua"`; select kab/kota `:disabled` ditambah `|| Boolean(lockedKota)`.
  - `index.vue`: `canMapGoBack` false bila `lockedKota` dan `mapKota === lockedKota && mapKecamatan === "semua" && mapKelurahan === "semua"`; cabang terakhir `mapBack` mengisi `mapKota.value = lockedKota.value ?? "semua"`.
  - `spasial.vue`: select kab/kota `:disabled="Boolean(lockedKota)"` (dari `useTabularFilters`); `canMapGoBack` existing sudah membandingkan dengan filter terapan (terkunci) sehingga tidak berubah.

## Ordered edits

1. `operator.cjs`: `scopeTabularQuery`, `scopeTabularOptions`, `DATA_ROLES`.
2. Tabular `src/index.js` sesuai §Final; import `resolveOperator`, `scopeTabularQuery`, `scopeTabularOptions`, `DATA_ROLES` dari `../../shared/operator.cjs`. Handler yang kini `await resolveOperator` harus tetap dalam `try` yang meneruskan error ke `next(error)`; `DashboardAuthError` sudah membawa `statusCode`.
3. Catatan stub: untuk provinsi `resolveOperator` tidak menyentuh DB (short-circuit Phase 1), sehingga test provinsi existing tidak perlu diubah; test kabkota wajib men-stub query operator. Tabular test: stub `database.raw` untuk query operator (`FROM directus_users u`) mengembalikan baris kabkota `{ id: "test-user", kota: 7, kota_nama: "KABUPATEN SUBANG", usaha: null }`; tambahkan test: (a) kabkota `GET /?kota=99` → SQL rows memakai binding `"7"` bukan `"99"`; (b) kabkota `/spasial/tileset` → `data: null`; (c) kabkota `/spasial/authorize` → 403; (d) kabkota `/options` hanya kota 7 dan kecamatan `kotaId` 7; (e) kabkota tanpa kota → 403 `KOTA_NOT_ASSIGNED`; (f) provinsi `GET /?kota=99` tetap binding `"99"`. Ubah test kabkota Phase 1 (`GET /` → 403) menjadi assert 200 dengan scoping.
4. Infografis `src/index.js` + test: kabkota `/` dengan `kota=99` → query memakai `7`; kabkota tanpa kota → 403.
5. Analitik `scope.js`, `index.js`, `metadata.js`, `profile-service.js` sesuai §Final; `test/scope.test.cjs` (unit murni: filter kota klien dibuang, satu filter `kota_id` ditambahkan, request provinsi tidak berubah, `permissionScopeOf`); `test/index.test.cjs` tambah: kabkota `/query` meneruskan filter `kota_id` ke `queryAnalytics` (stub DB/registry sesuai pola test existing), kabkota `/umkm/:id` kota lain → 404, kabkota `/exports` `profile_pdf` kota lain → 404, pendamping `/query` → 403.
6. Migrasi `20260926B` + perluas `operasional-schema.contract.test.mjs` (assert policy kabkota memiliki 4 permission `analitik_view`).
7. Web sesuai §Final; perbarui `roles.test.ts` (kabkota boleh `/dashboard/analitik`, beranda `/dashboard`) dan kasus (d) `roles.spec.ts` (kabkota kini mendarat di `/dashboard`, screenshot `dashboard-header-kabkota.png` tetap).
8. `kabkota-scope.spec.ts` (mock, `installMockDirectus(page, { authenticated: true, role: "kabkota" })`): login `returnTo=/dashboard` → `/dashboard`; request `/panel/infografis/` memuat `kota=1`; select "Kabupaten/Kota" disabled dan menampilkan "Kabupaten Bogor"; sidebar berisi "Dasbor Kewilayahan", "Data Lapangan"; `/dashboard/tabular` select kota disabled; screenshot `infografis-kabkota.png`.
9. `operasional.directus.spec.ts` (real API): ubah ekspektasi beranda kabkota Phase 2 (`/dashboard/akun`) menjadi `/dashboard`; `page.request.get("/panel/tabular/?kota=<id kota lain dari /panel/tabular/options provinsi>")` saat login kabkota → setiap baris `kota` mengandung "SUBANG"; `page.request.get("/panel/tabular/spasial/authorize")` → 403.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Kabkota mengirim `kota` lain, `kecamatan` dari kota lain, atau filter analitik `kota_nama` lain → hasil tetap hanya kota sendiri (kecamatan asing → hasil kosong).
- Kabkota dengan 8 filter analitik + filter kota → filter kota klien dibuang dulu sehingga budget tidak bertambah; 8 filter non-kota + injeksi → 9 → 400 existing (diterima).
- Cache agregat: key berbeda per `permissionScope` kabkota:<id>; provinsi tidak pernah menerima cache kabkota.
- Ekspor lama milik user tetap bisa diunduh (ownership); kabkota tidak dapat mengunduh ekspor user lain.
- Admin break-glass → provinsi (tanpa scoping).
- Pendamping/umkm ke endpoint data → 403.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-tabular test
pnpm --dir services/directus/extensions/directus-extension-infografis test
pnpm --dir services/directus/extensions/directus-extension-analitik test
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/constants/ROLES.ts app/constants/NAVIGATION.ts app/composables/useTabularFilters.ts "app/pages/(private)/dashboard/index.vue" "app/pages/(private)/dashboard/spasial.vue" app/components/dashboard/TabularData.vue)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; tabular/infografis/analitik jumlah pass = baseline + test baru, 0 fail; seluruh Playwright chromium pass.

## Runtime/API proof and unproven boundary

Disposable stack + seed (Phase 1) setelah rebuild analitik selesai (`SELECT status FROM analitik_job WHERE dedupe_key='rebuild_current_model' ORDER BY created_at DESC LIMIT 1` = `completed`), lalu jalankan `operasional.directus.spec.ts` (perintah main plan §7) dan:

```bash
curl -s -c /tmp/kab.cookies -H 'content-type: application/json' -d "{\"email\":\"dummy_admin.subang@jabarprov.go.id\",\"password\":\"$DEMO_ACCOUNT_PASSWORD\",\"mode\":\"session\"}" http://127.0.0.1:8055/auth/login -o /dev/null
curl -s -b /tmp/kab.cookies "http://127.0.0.1:8055/tabular/?page_size=50" | python3 -c 'import json,sys; rows=json.load(sys.stdin)["data"]; print(len(rows), sorted({r["kota"] for r in rows}))'
curl -s -b /tmp/kab.cookies -H 'content-type: application/json' -d '{"schemaVersion":1,"metric":"jumlah_umkm","groupBy":"kota_nama","filters":[]}' http://127.0.0.1:8055/analitik/query | python3 -c 'import json,sys; print([g["label"] for g in json.load(sys.stdin)["data"]["groups"]])'
```

Expected: tabular hanya kota Subang (4 usaha dummy Subang); analitik hanya satu grup Subang. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: rencana query nyata dan waktu respons scoped di data 5,4 juta baris.

## No-advance condition

Jangan lanjut bila ada satu route data yang mengembalikan baris di luar kota kabkota pada test unit atau runtime.

## Required failure probes

- Kabkota `GET /tabular/?kota=<lain>` → hanya kota sendiri.
- Kabkota `/analitik/umkm/<usaha kota lain>` → 404.
- Kabkota `/tabular/spasial/authorize` → 403.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-3-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 3
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; migrasi `20260926B` `down` hanya menghapus permission kabkota. Handoff: `scopeTabularQuery`, `DATA_ROLES`, `assertUsahaInScope`, dan `lockedKotaId` dipakai phase berikut; endpoint baru `operasional` wajib memakai pola scoping yang sama.
