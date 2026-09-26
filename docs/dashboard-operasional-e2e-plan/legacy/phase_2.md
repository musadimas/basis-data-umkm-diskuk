# Phase 2 — Identitas, login, dan navigasi per role (web)

## Objective, dependencies, observable result

- **Dependency:** Phase 1 (kontrak `GET /panel/operasional/me`, `POST /operasional/internal/resolve-nib`, akun dummy).
- **Objective:** web memakai role dari `/panel/operasional/me`; login email atau NIB; sign-in sesuai Modul 1 (fitur dummy berlabel); widget demo pengalih peran server-side; header profil kanan atas dengan badge warna role; menu, route guard, dan beranda per role; layout UMKM berbingkai ponsel; halaman akun (profil, ganti sandi, log aktivitas).
- **Observable result:** di Playwright mock, provinsi mendarat di `/dashboard` dengan menu existing; pendamping di `/dashboard/binaan`; UMKM di `/dashboard/usaha` di dalam frame ponsel; kabkota sementara di `/dashboard/akun` (dibuka penuh di Phase 3); akses URL di luar role dialihkan ke beranda role; login NIB dan demo switcher bekerja.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-2-before.json
mkdir -p /tmp/operasional-evidence/phase-2
(cd apps/web && pnpm exec playwright test tests/e2e/auth.spec.ts tests/e2e/spasial.spec.ts --project=chromium --project=mobile)
find apps/web/test-results -name '*.png' | head -20
```

Salin screenshot hasil run di atas ke `/tmp/operasional-evidence/phase-2/sign-in-before-<project>.png` dan `/tmp/operasional-evidence/phase-2/spasial-before.png` **sebelum** edit (bukti "before").

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `apps/web/app/constants/ROLES.ts` |
| create | `apps/web/app/types/operasional.ts` |
| create | `apps/web/app/layouts/umkm.vue` |
| create | `apps/web/app/components/nav/ProfileHeader.vue` |
| create | `apps/web/app/components/nav/RoleBadge.vue` |
| create | `apps/web/app/components/demo/DemoRoleSwitcher.vue` |
| create | `apps/web/app/pages/(private)/dashboard/akun.vue` |
| create | `apps/web/app/pages/(private)/dashboard/binaan/index.vue` |
| create | `apps/web/app/pages/(private)/dashboard/usaha/index.vue` |
| create | `apps/web/server/utils/directus-session-login.ts` |
| create | `apps/web/server/api/auth/login-nib.post.ts` |
| create | `apps/web/server/api/demo/switch.post.ts` |
| create | `apps/web/tests/unit/roles.test.ts` |
| create | `apps/web/tests/unit/directus-session-login.test.ts` |
| create | `apps/web/tests/e2e/roles.spec.ts` |
| create | `apps/web/tests/e2e/operasional.directus.spec.ts` |
| modify | `apps/web/nuxt.config.ts` |
| modify | `apps/web/playwright.config.ts` |
| modify | `apps/web/app/composables/useAuth.ts` |
| modify | `apps/web/app/middleware/auth.global.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| modify | `apps/web/app/constants/index.ts` |
| modify | `apps/web/app/components/nav/AppSidebar.vue` |
| modify | `apps/web/app/components/nav/Header.vue` |
| modify | `apps/web/app/layouts/dashboard.vue` |
| modify | `apps/web/app/components/auth/SignInForm.vue` |
| modify | `apps/web/app/pages/(auth)/sign-in.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/spasial.vue` |
| modify | `apps/web/server/utils/directus-proxy.ts` |
| modify | `apps/web/tests/unit/directus-proxy.test.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| modify | `apps/web/tests/fixtures/mock-directus-server.mjs` |
| modify | `apps/web/tests/e2e/auth.spec.ts` |
| modify | `apps/web/tests/e2e/auth.directus.spec.ts` |
| modify | `docker-compose.yml` |

`apps/web/app/components/nav/Header.vue` tidak dipakai di template mana pun (kode mati existing) tetapi ikut di-typecheck; hanya ubah akses field user (lihat edit 4).

## Exact symbols and search anchors

- `apps/web/app/composables/useAuth.ts::AuthUser`, `currentUser`, `login`, `logout`, `safeDashboardReturnTo`
- `apps/web/app/middleware/auth.global.ts` (default export)
- `apps/web/app/constants/NAVIGATION.ts::NAVIGATION_LINKS`
- `apps/web/app/components/nav/AppSidebar.vue` (`Object.entries(NAVIGATION_LINKS)`, `title === 'website'`)
- `apps/web/app/components/auth/SignInForm.vue::submit`, `showPassword`
- `apps/web/server/utils/directus-proxy.ts::proxyToDirectus`, `getSetCookies`, `sameOriginMutation`, `setJsonError`
- `apps/web/server/utils/session-policy.ts::setPolicyCookies`
- `apps/web/tests/fixtures/mock-directus.mjs::installMockDirectus`, `loginMock`
- `apps/web/tests/fixtures/mock-directus-server.mjs` (`/users/me`)
- `apps/web/app/pages/(private)/dashboard/spasial.vue` root `class="flex h-dvh flex-col gap-3"`

```bash
rg -n "export type AuthUser|async function currentUser|/panel/users/me" apps/web/app/composables/useAuth.ts
rg -n "Object.entries\(NAVIGATION_LINKS\)|title === 'website'" apps/web/app/components/nav/AppSidebar.vue
rg -n "first_name" apps/web/app apps/web/server
rg -n "function getSetCookies|export function sameOriginMutation|function setJsonError" apps/web/server/utils/directus-proxy.ts
rg -n 'class="flex h-dvh flex-col gap-3"' "apps/web/app/pages/(private)/dashboard/spasial.vue"
rg -n 'getByLabel\("Email"\)|name: "Masuk"' apps/web/tests
rg -n "NUXT_SESSION_POLICY_SECRET: sessionPolicySecret" apps/web/playwright.config.ts
```

## Current contract and final desired contract

### Current

- `useAuth.currentUser()` → `/panel/users/me` (`AuthUser` snake_case); middleware hanya autentikasi; menu statis; sign-in email-only; tidak ada header profil/demo switcher/layout UMKM.

### Final

- `apps/web/app/types/operasional.ts`:
  ```ts
  export type RoleKey = "provinsi" | "kabkota" | "pendamping" | "umkm";
  export interface OperatorProfile {
    id: string; email: string; firstName: string | null; lastName: string | null; avatar: string | null;
    role: RoleKey; roleLabel: string; instansi: string;
    kota: { id: number; nama: string } | null;
    usaha: { id: string; nama: string; nib: string | null } | null;
  }
  ```
- `apps/web/app/constants/ROLES.ts` mengekspor `ROLE_KEYS` (tuple 4 key), `ROLE_LABELS`, `ROLE_BADGE_CLASS` (`provinsi: "bg-blue-900 text-white"`, `kabkota: "bg-sky-400 text-sky-950"`, `pendamping: "bg-emerald-600 text-white"`, `umkm: "bg-amber-400 text-amber-950"`), `ROLE_HOME` (`provinsi: "/dashboard"`, `kabkota: "/dashboard/akun"`, `pendamping: "/dashboard/binaan"`, `umkm: "/dashboard/usaha"`), `ROLE_ROUTES` (provinsi: `/dashboard`, `/dashboard/analitik`, `/dashboard/tabular`, `/dashboard/spasial`, `/dashboard/umkm`, `/dashboard/akun`; kabkota: `/dashboard/akun`; pendamping: `/dashboard/binaan`, `/dashboard/akun`; umkm: `/dashboard/usaha`, `/dashboard/akun`), `DEMO_ACCOUNT_EMAILS` (email dummy Phase 1 per role), `isRoleKey(value): value is RoleKey`, `isRouteAllowed(role, path)`: entri `/dashboard` hanya cocok persis; entri lain cocok bila `path === entri` atau `path.startsWith(entri + "/")`.
- `useAuth`: `export type AuthUser = OperatorProfile`; `currentUser()` memanggil `/panel/operasional/me` (header cookie saat SSR seperti sekarang); tambah `loginWithNib(nib, password)` (POST `/api/auth/login-nib`, lalu `currentUser()`, throw bila null) dan `switchDemoRole(role)` (POST `/api/demo/switch` `{ role }` → `clearPrivateClientState(services.$queryClient)` → `window.location.assign(response.data.redirect)`).
- Middleware: setelah user terautentikasi, `if (!isRouteAllowed(user.role, to.path)) return navigateTo(ROLE_HOME[user.role])`.
- `NAVIGATION_LINKS: Record<RoleKey, { title: string; items: NavItem[] }[]>`; Phase 2 isi: provinsi `[{ title: "dashboard", items: <4 item existing> }]`; kabkota `[{ title: "akun", items: [{ id: "akun", label: "Akun Saya", to: "/dashboard/akun", icon: UserCog }] }]`; pendamping `[{ title: "pendampingan", items: [{ id: "binaan", label: "Dasbor Binaan Aktif", to: "/dashboard/binaan", icon: Users }] }]`; umkm `[{ title: "usaha", items: [{ id: "beranda", label: "Beranda", to: "/dashboard/usaha", icon: House }] }]`. Phase berikut menambah item ketika halamannya dibuat.
- Server Nuxt:
  - `directus-session-login.ts` mengekspor `directusTarget()` → `{ base, prefix }` (`prefix = "/panel"` bila `NUXT_DIRECTUS_PROXY_TARGET` di-set, selain itu `""`; `base` dari `NUXT_DIRECTUS_PROXY_TARGET` atau `NUXT_DIRECTUS_INTERNAL_URL` default `http://directus:8055`, tanpa slash akhir), `loginDirectusSession(event, email, password): Promise<boolean>` (POST `${base}${prefix}/auth/login` `{ email, password, mode: "session" }`, meneruskan header `x-forwarded-for` dan `user-agent`; `response.ok` → teruskan setiap `set-cookie` (`getSetCookies` dari `directus-proxy.ts`) via `appendResponseHeader`, panggil `setPolicyCookies(event)` bila `prefix === ""`, return true; 401/400 → false; lainnya → `createError({ statusCode: 502, statusMessage: "UPSTREAM_UNAVAILABLE" })`), `logoutDirectusSession(event)` (POST `${base}${prefix}/auth/logout` `{ mode: "session" }` dengan header `cookie` masuk; teruskan `set-cookie`; `clearPolicyCookies(event)`; abaikan error jaringan).
  - `api/auth/login-nib.post.ts`: `sameOriginMutation` gagal → 403; body `{ nib, password }`: `nib` `/^\d{13}$/`, `password` string 1–256 char, selain itu 400; secret `OPERASIONAL_INTERNAL_SECRET` <16 char → 503; POST `${base}${prefix}/operasional/internal/resolve-nib` header `x-operasional-internal-secret`; 404 → 401 `INVALID_CREDENTIALS`; non-ok lain → 502; lalu `loginDirectusSession`; false → 401 `INVALID_CREDENTIALS`; sukses `{ data: { ok: true } }`.
  - `api/demo/switch.post.ts`: `process.env.DEMO_MODE !== "true"` → 404; `sameOriginMutation` gagal → 403; `role` harus `isRoleKey`; `DEMO_ACCOUNT_PASSWORD` <12 char → 503; `logoutDirectusSession` lalu `loginDirectusSession(DEMO_ACCOUNT_EMAILS[role], password)`; false → 502 `DEMO_ACCOUNT_UNAVAILABLE`; sukses `{ data: { role, redirect: ROLE_HOME[role] } }`. Import konstanta dari `../../../app/constants/ROLES` (path relatif; file tanpa dependency Vue).
  - `directus-proxy.ts`: export `getSetCookies`; di awal `proxyToDirectus` setelah cek origin: `pathname.startsWith("/panel/operasional/internal/")` → `setJsonError(event, 404, "NOT_FOUND", requestId)` tanpa memanggil upstream.
- `nuxt.config.ts`: `runtimeConfig.public.demoMode: process.env.DEMO_MODE === "true"`.
- `docker-compose.yml` web env tambah `NUXT_PUBLIC_DEMO_MODE: ${DEMO_MODE:-false}` (override runtime config publik).
- `playwright.config.ts` webServer nuxt env tambah `DEMO_MODE: "true"`, `NUXT_PUBLIC_DEMO_MODE: "true"`, `DEMO_ACCOUNT_PASSWORD: "playwright-demo-password"`, `OPERASIONAL_INTERNAL_SECRET: "playwright-operasional-internal-secret"`; webServer mock-directus-server env `OPERASIONAL_INTERNAL_SECRET` yang sama.

## Ordered edits

1. Buat `types/operasional.ts` dan `constants/ROLES.ts` sesuai §Final; ekspor ROLES dari `constants/index.ts`.
2. Ubah `useAuth.ts` sesuai §Final (hapus tipe `AuthUser` lama; pertahankan `safeDashboardReturnTo`, `login`, `logout` apa adanya selain tipe).
3. Ubah `auth.global.ts` sesuai §Final (pakai `auth.user.value` bila status `authenticated`, selain itu `await auth.currentUser()`).
4. `AppSidebar.vue`: `displayName` = `[firstName, lastName].filter(Boolean).join(" ") || email || "Pengguna DisKUK"`; iterasi `NAVIGATION_LINKS[auth.user.value?.role ?? "provinsi"]` sebagai `section in sections` (`:title="section.title" :items="section.items"`); hapus filter `title === 'website'` (tidak lagi bermakna). `Header.vue`: ganti `first_name` → `firstName` (dua tempat displayName), tanpa perubahan lain.
5. `NAVIGATION.ts` sesuai §Final (ikon `UserCog`, `Users`, `House` dari `@lucide/vue`).
6. `RoleBadge.vue`: prop `role: RoleKey`; `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="ROLE_BADGE_CLASS[role]">{{ ROLE_LABELS[role] }}</span>`.
7. `ProfileHeader.vue`: `<header class="flex h-14 shrink-0 items-center justify-end gap-3 border-b bg-background px-4">`; tombol dropdown `aria-label="Menu profil"` berisi avatar (gambar `/panel/assets/<avatar>?width=64` bila ada, selain itu inisial), nama lengkap, `NavRoleBadge`, `instansi` (text-xs muted); item: "Pengaturan Akun & Keamanan" (`/dashboard/akun`), "Log Aktivitas Sesi (Audit Trail)" (`/dashboard/akun#aktivitas`), separator, "Keluar" (`auth.logout`).
8. `layouts/dashboard.vue`: render `<NavProfileHeader />` sebagai anak pertama `UiSidebarInset`; render `<DemoRoleSwitcher />` setelah `UiSidebarProvider` konten (di dalam root template).
9. `layouts/umkm.vue`: wrapper `min-h-svh bg-slate-100 md:flex md:items-center md:justify-center md:py-6`; frame `data-testid="umkm-frame"` `relative mx-auto flex min-h-svh w-full flex-col bg-background md:h-[844px] md:min-h-0 md:w-[390px] md:overflow-hidden md:rounded-[2.5rem] md:border-8 md:border-slate-900 md:shadow-2xl`; header frame: nama usaha (`auth.user.usaha?.nama`), `NavRoleBadge`, tombol menu `aria-label="Menu profil"` (akun, keluar); `<main class="flex-1 overflow-y-auto p-4"><slot /></main>`; `<nav aria-label="Navigasi UMKM">` grid kolom sesuai jumlah item `NAVIGATION_LINKS.umkm[0].items` (ikon + label, item aktif `text-amber-700`); `<DemoRoleSwitcher />`.
10. `DemoRoleSwitcher.vue`: tidak dirender bila `useRuntimeConfig().public.demoMode !== true`; `fixed bottom-4 right-4 z-50`; tombol pill `aria-expanded` bertuliskan "Mode Pengujian Prototipe: Pilih Peran Aktif"; panel berisi 4 tombol (label `ROLE_LABELS`, sub-teks `DEMO_ACCOUNT_EMAILS[role]`, penanda "Aktif" bila `auth.user.value?.role === role`); klik → `auth.switchDemoRole(role)`; sedang proses → tombol disabled + teks "Mengalihkan…"; gagal → `role="alert"` "Gagal beralih peran. Coba lagi.".
11. `SignInForm.vue`:
    - Header: logo existing + blok teks `Portal Integrasi Satu Data SIDT Jabar` (text-sm font-semibold) di sebelah logo; heading tetap "Masuk ke Dashboard UMKM".
    - Field `id="identifier"` label "Email / NIB", `autocomplete="username"`, `inputmode="text"`, placeholder "nama@jabarprov.go.id atau 13 digit NIB".
    - Field sandi + toggle existing (label aria tetap "Tampilkan kata sandi"/"Sembunyikan kata sandi").
    - Tombol teks "Lupa Kata Sandi?" (`type="button"`) membuka `UiDialog` judul "Lupa Kata Sandi (Simulasi)", isi "Pemulihan kata sandi belum terhubung pada purwarupa. Hubungi Admin DISKUK Provinsi untuk mengatur ulang akun Anda.".
    - Blok CAPTCHA dummy: kotak border dengan checkbox `id="captcha-simulasi"` label "Saya bukan robot" dan keterangan "Simulasi CAPTCHA (prototipe) — tidak diverifikasi server"; tidak memengaruhi submit.
    - Submit `type="submit"` teks "Masuk ke Dashboard" (pending: "Memeriksa…").
    - Separator "atau" lalu tombol `type="button"` "Masuk Menggunakan Jabar Digital Services / SSO Jabar"; klik menampilkan `role="status"` "SSO Jabar belum terhubung pada purwarupa (simulasi).".
    - Teks kepatuhan (text-xs muted): "Sistem ini dilindungi enkripsi AES-256 dan tunduk pada UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)".
    - `submit()`: kosong → "Email/NIB atau kata sandi belum diisi."; `/^\d{13}$/.test(identifier.trim())` → `auth.loginWithNib`, selain itu `auth.login`; gagal → "Email/NIB atau kata sandi tidak sesuai."; sukses → `navigateTo(safeDashboardReturnTo(route.query.returnTo))` (middleware mengalihkan bila tidak diizinkan).
12. `sign-in.vue`: tambahkan `<DemoRoleSwitcher />` di akhir `<main>`.
13. `spasial.vue`: root class `flex h-dvh flex-col gap-3` → `flex h-[calc(100dvh-3.5rem)] flex-col gap-3` (ruang header h-14); tidak ada perubahan lain.
14. `akun.vue`: `definePageMeta({ layout: false })`; `<NuxtLayout :name="auth.user.value?.role === 'umkm' ? 'umkm' : 'dashboard'">`; kartu "Profil" (nama, email, `NavRoleBadge`, instansi, kota/usaha); kartu "Keamanan Akun" form sandi baru + konfirmasi (min 12 char, harus sama) → `$fetch("/panel/users/me", { method: "PATCH", body: { password } })` → "Kata sandi berhasil diperbarui."/"Kata sandi gagal diperbarui."; kartu `id="aktivitas"` "Log Aktivitas Sesi (Audit Trail)": `useFetch("/panel/operasional/aktivitas")` tabel Waktu (`formatAnalyticsWib`), Aksi (`login`→"Masuk", `create`→"Membuat", `update`→"Mengubah", `delete`→"Menghapus", selain itu nilai mentah), Koleksi, IP; kosong → "Belum ada aktivitas tercatat.".
15. `binaan/index.vue` (placeholder, diganti Phase 8): layout `dashboard`, heading "Dasbor Binaan Aktif", teks "Daftar peserta binaan akan tampil setelah Program Akselerasi aktif.". `usaha/index.vue` (placeholder, diganti Phase 7): layout `umkm`, heading "Beranda Usaha", nama usaha + NIB dari `auth.user.value.usaha`, teks "Ringkasan program akan tampil di sini.".
16. Server: `directus-session-login.ts`, `login-nib.post.ts`, `demo/switch.post.ts`, perubahan `directus-proxy.ts` sesuai §Final; `nuxt.config.ts`, `docker-compose.yml`, `playwright.config.ts` sesuai §Final.
17. Fixtures:
    - `mock-directus-server.mjs`: tambah `POST /auth/login` (baca JSON email; role = map `DEMO_ACCOUNT_EMAILS` terbalik, default `provinsi`; response 200 `{data:{}}` + `set-cookie: diskuk_session=mock; Path=/; HttpOnly` dan `mock_role=<role>; Path=/`); `POST /auth/logout` 204; `POST /operasional/internal/resolve-nib` (header secret harus sama dengan env `OPERASIONAL_INTERNAL_SECRET`, NIB `9900000000001` → `{data:{email:"dummy_wawan.leathercraft@gmail.com"}}`, selain itu 404); `GET /operasional/me` → fixture operator sesuai cookie `mock_role` (default provinsi). Pertahankan `/users/me`.
    - `mock-directus.mjs`: `installMockDirectus(page, { …existing, role = "provinsi" })` menambah cookie `mock_role` (url `process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100"`); route browser `/panel/operasional/me` → fixture operator untuk role dari cookie `mock_role` pada `route.request().allHeaders()` bila ada, selain itu opsi `role` (401 bila belum login); `/panel/operasional/aktivitas` → satu entri `login` `2026-09-26T01:00:00Z`; ekspor `OPERATOR_FIXTURES` (provinsi "Analis"/instansi "DISKUK Provinsi Jawa Barat"; kabkota kota `{id: 1, nama: "Kabupaten Bogor"}`; pendamping; umkm usaha `{id: "11111111-1111-4111-8111-000000000001", nama: "Wawan Leathercraft", nib: "9900000000001"}`). `loginMock(page, returnTo = "/dashboard", expectedPath = returnTo)`: label `Email / NIB`, tombol `{ name: "Masuk ke Dashboard", exact: true }`, tunggu `expectedPath`.
18. Tests:
    - `auth.spec.ts`: sesuaikan label/tombol; assert link "Lupa Kata Sandi?" dan tombol SSO tampil.
    - `auth.directus.spec.ts`: label `Email / NIB`, tombol exact "Masuk ke Dashboard", `Menu profil` → "Keluar".
    - `roles.spec.ts` (mock): (a) provinsi → `/dashboard`, sidebar memuat tautan "Analitik", "Data Tabular UMKM", "Peta Spasial UMKM" (assert keberadaan, bukan jumlah item — phase berikut menambah menu), header badge "Admin Provinsi", screenshot `dashboard-header-provinsi.png`; (b) pendamping login `returnTo=/dashboard` → `/dashboard/binaan`, sidebar memuat "Dasbor Binaan Aktif" dan tidak memuat "Analitik", goto `/dashboard/analitik` → `/dashboard/binaan`, screenshot `dashboard-header-pendamping.png`; (c) umkm → `/dashboard/usaha`, `getByTestId("umkm-frame")` visible, screenshot `umkm-beranda.png`; (d) kabkota → `/dashboard/akun`, screenshot `dashboard-header-kabkota.png`; (e) dropdown "Menu profil" → "Pengaturan Akun & Keamanan" → heading "Log Aktivitas Sesi (Audit Trail)" dan sel "Masuk"; (f) NIB login dengan `installMockDirectus(page, { authenticated: true, role: "umkm" })`: isi `9900000000001` → request `POST /api/auth/login-nib` status 200 → `/dashboard/usaha`; (g) demo switcher di `/sign-in` terlihat, buka (screenshot `demo-switcher-open.png`), klik "Pendamping" → `/dashboard/binaan`; (h) provinsi `/dashboard/spasial` screenshot `spasial-after.png`.
    - `operasional.directus.spec.ts` (skip bila `!process.env.PLAYWRIGHT_USE_REAL_API`): login form untuk keempat email dummy dengan `process.env.DEMO_ACCOUNT_PASSWORD` → URL `ROLE_HOME` Phase 2; login NIB `9900000000001` → `/dashboard/usaha`; demo switcher "Pendamping" → `/dashboard/binaan`.
    - `roles.test.ts`: matriks `isRouteAllowed` (termasuk `/dashboard/analitikx` false untuk entri `/dashboard/analitik`, `/dashboard` persis, beranda setiap role diizinkan untuk role itu).
    - `directus-session-login.test.ts`: upstream `node:http` lokal (pola `directus-proxy.test.ts`) untuk `/auth/login` (email `ok@example.invalid` → 200 + `set-cookie`, lainnya 401) dan `/auth/logout`; h3 app memanggil `loginDirectusSession`; assert set-cookie Directus diteruskan + dua cookie policy di-set; 401 → false tanpa cookie policy.
    - `directus-proxy.test.ts`: `GET /panel/operasional/internal/resolve-nib` → 404 `NOT_FOUND` dan upstream tidak menerima request.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- NIB 13 digit valid tetapi tidak terdaftar → pesan generik sama dengan sandi salah (tidak membocorkan keberadaan).
- Identifier 13 digit dengan spasi di tepi → di-trim lalu diperlakukan sebagai NIB.
- `DEMO_MODE` tidak `true` → widget tidak dirender dan `/api/demo/switch` 404 (uji manual di disposable stack dengan `DEMO_MODE=false`).
- `/api/demo/switch` dengan `Origin` berbeda → 403.
- `/panel/operasional/internal/*` dari browser → 404 di proxy.
- Session kedaluwarsa saat berada di halaman role → flow existing `auth:unauthorized` tetap ke `/sign-in`.
- Pergantian user (switch) → `clearPrivateClientState` dipanggil sebelum reload (tidak ada cache query lintas akun).
- Tablet (America/Los_Angeles): waktu aktivitas tetap tampil WIB.

## Validation commands

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/constants/ROLES.ts app/types/operasional.ts app/layouts/umkm.vue app/layouts/dashboard.vue app/components/nav/ProfileHeader.vue app/components/nav/RoleBadge.vue app/components/nav/AppSidebar.vue app/components/nav/Header.vue app/components/demo/DemoRoleSwitcher.vue "app/pages/(private)/dashboard/akun.vue" "app/pages/(private)/dashboard/binaan/index.vue" "app/pages/(private)/dashboard/usaha/index.vue" "app/pages/(private)/dashboard/spasial.vue" "app/pages/(auth)/sign-in.vue" app/components/auth/SignInForm.vue app/composables/useAuth.ts app/middleware/auth.global.ts app/constants/NAVIGATION.ts server/utils/directus-session-login.ts server/api/auth/login-nib.post.ts server/api/demo/switch.post.ts server/utils/directus-proxy.ts nuxt.config.ts playwright.config.ts)
pnpm lint:oxlint
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/roles.spec.ts tests/e2e/auth.spec.ts --project=mobile --project=tablet)
pnpm --dir apps/web build
docker compose --env-file .env.example config --quiet
```

Expected: semua exit 0; unit = 17 baseline + test baru pass; Playwright chromium seluruh suite pass (baseline 23 pass + 1 skip ditambah test baru; `auth.directus.spec.ts` dan `operasional.directus.spec.ts` skip); screenshot bernama ada di `apps/web/test-results/**`. Salin `sign-in-after-*`, `spasial-after.png`, `dashboard-header-*.png`, `umkm-beranda.png`, `demo-switcher-open.png` ke `/tmp/operasional-evidence/phase-2/`.

## Runtime/browser proof and unproven boundary

Disposable stack (main plan §7, setelah Phase 1 seed) lalu:

```bash
set -a; . /tmp/operasional-e2e.env; set +a
(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 DEMO_ACCOUNT_PASSWORD="$DEMO_ACCOUNT_PASSWORD" APPLICATION_USER_EMAIL="$APPLICATION_USER_EMAIL" APPLICATION_USER_PASSWORD="$APPLICATION_USER_PASSWORD" pnpm exec playwright test tests/e2e/operasional.directus.spec.ts tests/e2e/auth.directus.spec.ts --project=chromium)
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'origin: http://127.0.0.1:3000' -H 'content-type: application/json' -d '{"nib":"9900000000001"}' http://127.0.0.1:3000/panel/operasional/internal/resolve-nib
```

Expected: kedua spec pass; curl `404`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: cookie session Directus asli lewat server Nuxt, rate limit login Directus, redirect SSR dengan session nyata.

## No-advance condition

Jangan lanjut bila ada spec existing Playwright yang gagal, atau pendamping/umkm dapat membuka `/dashboard/analitik` tanpa dialihkan.

## Required failure probes

- Unit: `loginDirectusSession` 401 → false dan tidak ada cookie policy.
- Unit proxy: `/panel/operasional/internal/*` → 404 tanpa upstream.
- E2E: pendamping membuka `/dashboard/analitik` → dialihkan.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-2-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 2
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit phase (tidak ada migrasi). Handoff ke Phase 3: `ROLE_ROUTES`/`ROLE_HOME`/`NAVIGATION_LINKS` kabkota diperluas di Phase 3; `installMockDirectus({ role })` dan `OPERATOR_FIXTURES` dipakai spec berikutnya; `NavRoleBadge` dan `formatAnalyticsWib` dipakai ulang.
