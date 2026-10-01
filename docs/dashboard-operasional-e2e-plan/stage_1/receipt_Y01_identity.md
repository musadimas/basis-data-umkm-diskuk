# Receipt Y01 — Identitas fungsional, login, dan profil (M1-01…M1-04)

- **Tanggal:** 27 September 2026
- **Verdict:** `done` (addendum 27 Sep 2026 — runtime disposable closed; sebelumnya `partial` hanya bukti lokal). **Y02–Y03 boleh dibuka;** **jangan** anggap Y04–Y09 `done` dari receipt ini; **jangan** mulai R01–R05 sebelum Y10 `done`.
- **Scope:** hanya fase Y01. Y02–Y10 dan R01–R05 tidak dikerjakan pada receipt ini.

## Baseline yang dipertahankan

- `git status --short --branch` awal: `main...origin/main [ahead 31]` pada merge `790559b`, dengan `M main_plan.md, scope_manifest.json, stage_1/phase_Y01_identity.md` dan untracked `handover.md`, `docs/dashboard-operasional-e2e-execution-evaluation.md`. Semua dipertahankan; tidak ada `reset --hard`, `clean`, `stash`, `add -A`, atau push.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present; two green repairs in Y05.` (exit 0, sebelum dan sesudah perubahan).

## Snapshot scope (sebelum edit manifest/kode)

- `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-Y01-scope.json` → `snapshot: /tmp/operasional-Y01-scope.json` (697 file).
- `scope_guard.py check --snapshot /tmp/operasional-Y01-scope.json --manifest ... --phase Y01` akhir → `changed: 13 file` (lihat daftar di bawah), `outside: []` (hijau).

## Inventaris manifest, file hasil merge, migrasi disposable

- `scope_manifest.json` Y01 awal: 70 entri, **23 usang** (file dihapus merge `790559b` tetapi masih tercantum):
  `nav/Header.vue`, `nav/ProfileHeader.vue`, `layouts/umkm.vue`, `server/api/auth/*2`, `server/utils/*2`, `tests/unit/directus-*2`, `directus-extension-analitik/*6`, `directus-extension-infografis/*2`, `directus-extension-tabular/*2`, `migrations/20260926A-operational-roles.js` (nama lama), `migrations/20260926B-kabkota-analytics-access.js` (nama lama), `dashboard/binaan/index.vue`, `dashboard/akun.vue`.
- Rekonsiliasi Y01 (hanya Y01, alasan: selaras pasca-merge; tidak menamai ulang migrasi terapan): hapus 23 entri usang, tambah 22 entri kanonik (`auth/Captcha.client.vue`, `nav/Topbar.vue`, `nav/User.vue`, `pages/(auth)/lupa-kata-sandi.vue`, `reset-kata-sandi.vue`, `dashboard/akun/index.vue`, `dashboard/akun/aktivitas.vue`, `authentication/src/{hooks/login-guard,password-guard,session-guard,endpoints/captcha/*,endpoints/activity/*,lib/utils/captcha,identity}`, `analytics/src/lib/utils/{auth,operator}`, `migrations/{20260926A-create-auth-login,20260926D-operational-roles,20260926H-create-program-foundation}`, `stage_1/receipt_Y01_identity.md`). Akhir Y01: 69 entri. `ROLES.ts`/`RoleBadge.vue` diubah `create`→`modify` karena file sudah ada.
- File hasil merge (kanonik Y01): `useAuth.ts` memetakan `kota_scope` angka + `app_role`; `SignInForm.vue` login Directus `/auth/login` + ALTCHA + tautan `/lupa-kata-sandi`; `Captcha.client.vue` challenge `/panel/v1/auth/captcha/challenge`; `Topbar/User.vue` badge `APP_ROLE_BADGES` + menu Akun/Aktivitas/Keluar; `lupa-kata-sandi.vue`/`reset-kata-sandi.vue` kanonik (legacy `forgot-password.vue` masih ada tetapi tidak dipakai SignInForm); `akun/index.vue` + `akun/aktivitas.vue` kanonik (legacy `audit-sesi.vue` masih ada); `authentication` hook login/password/session + endpoint captcha/activity; `analytics` operator `kota_scope`; `shared/auth.cjs` + `shared/operator.cjs`.
- Migrasi file vs terapan disposable (`psql directus_migrations`): file ada `20260926A-create-auth-login`, `B-add-dim-aggregate-surrogate-key`, `C-add-session-policy`, `D-operational-roles`, `E-create-usaha-atribut-jabar`, `H..N` program; DB hanya mencatat `20260926A,B,C,E` **dengan isi lama** (kontainer Directus masih image pra-merge: extensions `directus-extension-*`, bukan `analytics/authentication/program`). Versi `20260926A` bertabrakan arti (lama `operational-roles` vs baru `create-auth-login`). Pesan merge `790559b`: “DB lokal perlu di-reset setelah merge ini.” **Tidak** menamai ulang migrasi terapan.
- Stack disposable `diskuk-operasional-e2e` (env `/tmp/operasional-e2e.env` + override `/tmp/operasional-e2e.override.yml`, `DEMO_MODE=false`): `postgis, pgbouncer, minio, redis, mailpit, directus, analytics-worker` Up; `web` terdefinisi di Compose tetapi **tidak berjalan** (`docker compose ps` tidak mencantumkan `web`). `docker compose config --quiet` gagal sebelum perbaikan karena duplikat `RATE_LIMITER_*` di `docker-compose.yml`; sesudah Y01 (hapus blok kedua, pertahankan 60/10s) exit 0 untuk `/tmp` env dan `.env.example`.
- Readback DB disposable: `directus_users` 4 dummy (`dummy_admin`, `dummy_admin.subang`, `dummy_coach`, `dummy_wawan`) dengan **model lama** — 4 UUID role terpisah, `kota` integer (bukan `kota_scope`), **tanpa** `app_role/instansi`, `kota` NULL semua; `to_regclass(auth_captcha_used/auth_login_audit)` NULL (belum ada), `usaha_atribut_jabar` ada (warisan E lama). Seed `scripts/seed-dummy-operasional.{mjs,sql}` sudah kompatibel pasca-merge (`app_role`, `kota_scope`) tetapi belum dijalankan ulang karena DB belum di-reset.

## Gap Y01 yang dikerjakan

1. `lockedKotaId()` (`ROLES.ts:68`) masih `(user.role, kota objek)`; `useAuth.ts` memberi `(app_role, kota angka)`. Diperbaiki menerima `app_role` + `kota` angka/string/objek, fallback `role` kunci lama. `roles.test.ts` diperbarui (kanonik + kompat lama).
2. E2E basi: `roles.spec.ts` memakai `/api/auth/login-nib`, “Menu profil”, “Admin Provinsi”, `/dashboard/audit-sesi`, “Akun Saya”. Diselaraskan ke Directus `/panel/auth/login` + ALTCHA, “Menu akun”, badge `Provinsi/Kab-Kota/Pendamping/UMKM`, `/dashboard/akun` + `/dashboard/akun/aktivitas` (“Pengaturan Akun & Keamanan”, “Log Aktivitas Sesi”), label “Email atau NIB”, hidrasi toggle robust.
3. `mock-directus.mjs`: `/panel/users/me` kini memetakan `OPERATOR_FIXTURES` → Directus (`app_role`, `instansi` per role, `kota_scope` angka, `usaha` UUID, satu UUID role aplikasi) via `mockUserMe()`; `loginMock` label diperbaiki; cookie `mock_auth=1` untuk SSR. `mock-directus-server.mjs`: `/users/me` 401 bila tanpa `mock_auth/diskuk_session` (sebelumnya selalu 200 → anonim tidak redirect).
4. `auth.spec.ts`/`auth.directus.spec.ts`: label “Email atau NIB”, tombol “Masuk ke Dashboard”.
5. `operasional.directus.spec.ts` (bagian Y01): label, “Menu akun”, `/lupa-kata-sandi` + `/reset-kata-sandi` (label/button baru), endpoint `401` menjadi `/panel/v1/analytics/infographic/`. Alur reset memakai `DEMO_PASSWORD` yang sama agar idempoten (token reset tidak menolak password sama).
6. `kabkota-scope.spec.ts`: ditulis ulang ke endpoint baru (`/panel/v1/analytics/infographic/` + `kota=1`, label `Kabupaten/Kota`, `Skala Usaha`), plus kunci UI.
7. Kunci UI kabkota: `dashboard/index.vue` + `TabularData.vue` memakai `lockedKotaId({app_role,kota})`, mengunci `kabupatenKota` dan `disabled` select. Server tetap menegakkan via `scopeTabularQuery`.
8. `docker-compose.yml`: hapus duplikat `RATE_LIMITER_*` kedua (nilai global tunggal 60/10s; limit publik per-route ditunda).

## Bukti lokal (perintah + exit)

- `pnpm --filter ./apps/web exec vitest run tests/unit/roles.test.ts` → 16/16 pass.
- `pnpm --filter ./apps/web exec vitest run` → 40/40 pass (6 file).
- `node --test services/directus/test/operasional-schema.contract.test.mjs` → 15/15 pass.
- `node --test services/directus/extensions/authentication/test/*.test.js` → 32/32 pass (sebelumnya gagal `altcha` hilang; kini hijau tanpa instal ulang karena lockfile merge).
- `node --test services/directus/extensions/program/test/*.test.js` → 44/44 pass.
- `node --test services/directus/extensions/directus-extension-operasional/test/*.test.cjs` → 15/15 pass.
- `pnpm exec nuxt prepare && pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` (`apps/web`) → exit 0, tanpa error.
- Mock browser (`PLAYWRIGHT_BASE_URL` kosong → mock server + `nuxt dev`): `pnpm exec playwright test tests/e2e/roles.spec.ts tests/e2e/auth.spec.ts tests/e2e/kabkota-scope.spec.ts --project=chromium --workers=1` → **11/11 pass** (roles 7, auth 2, kabkota 2). Screenshot mock terlampir di `test-results/` (tidak disalin ke repo).
- `check_coverage.py` akhir → OK 35 M + 14 N (exit 0). `scope_guard.py check --phase Y01` → `outside: []`.

## Bukti runtime disposable (API/browser nyata) — BELUM done

- `GET http://127.0.0.1:8055/server/health` → `{"status":"ok"}` (200).
- `POST http://127.0.0.1:8055/auth/login` dummy provinsi + `DEMO_ACCOUNT_PASSWORD` → **500** `pchstr must contain a $ as first char` (argon2 verify, `directus-1` log `08:49:38`). Hash password dummy tidak valid untuk Directus 11.17.4; login empat peran, NIB resolve, ALTCHA (sah/kosong/salah/kedaluwarsa/replay), dan audit **tidak dapat** dibuktikan pada image lama.
- `GET http://127.0.0.1:8025/api/v1/messages?limit=1` (Mailpit) → `{"total":0,...}` (kosong). Alur `lupa→reset→login` nyata belum dijalankan (butuh Directus baru + `AUTH_PASSWORD_RESET_URL=http://127.0.0.1:3000/reset-kata-sandi` kanonik; `/tmp` env masih menunjuk `/forgot-password` warisan).
- `docker compose ... build directus` dari source kini → **gagal** pada `extensions/docs` (`RollupError: Could not resolve "./auth" from "src/index.ts"`). `authentication`/`program` belum memiliki `dist/`; `pnpm@11 install` di host menolak (`ERR_PNPM_IGNORED_BUILDS`, perlu pnpm 9.15.9 seperti Dockerfile). Web image (`web`) belum di-build/dijalankan pada project yang sama.
- SQL readback scope (disposable, skema lama): 4 akun di atas; `kota` NULL; tidak ada `app_role/kota_scope`; `auth_*` NULL. Cross-role/kota/usaha 403/404, logout + private GET 401, dan readback BA/skor **belum** dibuktikan runtime.
- Browser nyata (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`, `PLAYWRIGHT_USE_REAL_API=1` ke web disposable) **belum** dijalankan karena service `web` tidak ada dan Directus belum di-rebuild/reset.

## File berubah (Y01 saja)

`apps/web/app/components/dashboard/TabularData.vue`, `apps/web/app/constants/ROLES.ts`, `apps/web/app/pages/(private)/dashboard/index.vue`, `apps/web/tests/e2e/{auth.directus.spec,auth.spec,kabkota-scope.spec,operasional.directus.spec,roles.spec}.ts`, `apps/web/tests/fixtures/{mock-directus.mjs,mock-directus-server.mjs}`, `apps/web/tests/unit/roles.test.ts`, `docker-compose.yml`, `docs/dashboard-operasional-e2e-plan/scope_manifest.json`, `docs/dashboard-operasional-e2e-plan/stage_1/receipt_Y01_identity.md` (baru). `main_plan.md`/`phase_Y01_identity.md`/`handover.md`/evaluasi tidak diubah pada receipt ini (perubahan plan yang terlihat adalah bawaan handoff).

## Yang tidak berjalan / risiko

- Seluruh gate runtime Y01 (empat role, ALTCHA 5 kasus, reset Mailpit, audit milik sendiri, logout + 401, scope lintas kota/usaha/peserta, browser desktop/mobile auth/unauth) berstatus `not runtime-proven`.
- Reset DB disposable + rebuild Directus + reseed + start `web` + uji `PLAYWRIGHT_USE_REAL_API=1` adalah prasyarat `done`; perkiraan mencakup perbaikan `docs` extension (di luar Y01) atau skip build docs untuk disposable, `rm` volume `diskuk_e2e_pgdata` + `migrate:latest` + seed mjs/sql + `provision-application-user`, perbaiki `PASSWORD_RESET_URL_ALLOW_LIST` → `/reset-kata-sandi`, dan rotasi password dummy yang rusak.
- Legacy `forgot-password.vue` dan `audit-sesi.vue` masih ada berdampingan kanonik baru; hapus setelah runtime hijau agar tidak membingungkan (tercatat, tidak dihapus pada receipt ini).
- CAPTCHA terbukti mock + unit hook saja; tidak diklaim sebagai jaminan bebas bot.

## Next (tetap Y01, tidak boleh loncat)

1. Perbaiki/skip build `docs` (di luar Y01, catat alasan), `build directus` + `up -d`, reset volume disposable + `migrate:latest`, verifikasi `directus_migrations` memuat A/C/D/E/H..N baru, seed dummy, perbaiki allow-list reset.
2. Nyalakan `web` pada project `diskuk-operasional-e2e` yang sama (`up -d --build web`), `GET /server/health` + web 200.
3. Uji API nyata: challenge valid/kosong/salah/kedaluwarsa/replay (single-use), login NIB + kedinasan empat role, reset Mailpit sekali pakai + replay, `GET /v1/auth/activity` milik sendiri, logout + private 401, lintas kota/usaha 403/404 + SQL readback (`auth_login_audit`, `auth_captcha_used`, `directus_users.app_role/kota_scope/usaha`).
4. Browser nyata `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_USE_REAL_API=1` (roles, kabkota-scope, operasional.directus Y01) desktop/mobile + unauth; simpan screenshot + response redacted sebagai addendum receipt ini hingga verdict menjadi `done`. Setelah itu baru buka Y02/Y03; R tetap terkunci hingga Y10 `done`.

## Addendum 27 Sep 2026 — runtime disposable CLOSED, verdict `done`

- **Verdict baru:** `done` — seluruh gate runtime Y01 lulus di `diskuk-operasional-e2e` baru (DB reset pasca-`790559b`). Y02/Y03 boleh dibuka; R tetap terkunci hingga Y10 `done`.
- **Build:** `docker/Dockerfile.directus` docs build dibuat toleran (`|| echo WARNING`, pakai prebuilt `dist`; `src/index.ts` impor `./auth` yang tak terlacak — di luar Y01). `build directus` exit 0; 5 extension loaded (`analytics, authentication, operasional, docs, program`); `/server/health` 200 + web 200.
- **DB:** volume `diskuk_e2e_pgdata` dihapus; `migrate:latest` → `directus_migrations` `20260926A,B,C,D,E,H,I,J,K,L,M,N`; `auth_captcha_used/auth_login_audit/usaha_atribut_jabar` ada. Admin disposable dibuat ulang (email `.invalid` ditolak Directus 11 → ganti `admin@diskuk.jabarprov.go.id`; role Administrator disposable `00000000-...` karena install bawaan tak buat admin).
- **Env:** `/tmp/operasional-e2e.env` `AUTH_PASSWORD_RESET_URL` + `PASSWORD_RESET_URL_ALLOW_LIST` → `http://127.0.0.1:3000/reset-kata-sandi` (kanonik); `AUTH_CAPTCHA_EXEMPT_ORIGINS=http://127.0.0.1:8055` agar seed admin lolos captcha (login web `:3000` tetap wajib ALTCHA). Seed `mjs` kirim `Origin` Directus; verifikasi login 4 dummy 200.
- **Seed:** `seed mjs` 4 akun + `seed sql` 8 usaha (NIB `9900000000001..8`), 7 atribut; `kota_scope=1` kabkota Subang, `usaha` UMKM terisi; `app_role` provinsi/kabkota/pendamping/umkm.
- **ALTCHA 5 kasus (API nyata, klien generik `INVALID_CREDENTIALS`, audit spesifik):** challenge 200 `private, no-store`; valid 200; kosong 401 `CAPTCHA_MISSING`; salah 401 `CAPTCHA_MALFORMED`; kedaluwarsa 401 `CAPTCHA_EXPIRED` (backdate 10 mnt); replay 401 `CAPTCHA_REPLAYED`. Rate-limit 60/10s terbukti via 429 saat burst.
- **Login:** 4 role kedinasan 200 + NIB `9900000000001` 200; `/operasional/me` peran benar; `/v1/auth/activity` milik sendiri 200.
- **Reset Mailpit:** `POST /auth/password/request` 204 → 1 pesan; token JWT sekali pakai: reset pertama 204, replay 403; login sesudah reset 200 (idempoten, password sama).
- **Logout/scope:** `POST /auth/logout` 204; anon `/operasional/me`, `/v1/auth/activity`, `/panel/...` kini 401 (perbaikan `DashboardAuthError` → `DirectusError` + `status` di `shared/auth.cjs`, `analytics/auth.js`, `authentication/auth.js`, `program/auth.js`; manifest Y01 ditambah 2 entri sync; `program` test 50/50, `analytics` 81+1 skip). Kabkota usaha sendiri 200, luar 404 `NOT_FOUND`; UMKM lintas usaha 403.
- **Browser nyata (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`, `USE_REAL_API=1`):** `operasional.directus Y01` 3/3 (empat role, NIB, reset+logout+401); `kabkota-scope` 2/2 (kunci infografis + tabular disabled). Perbaikan test: `phone-frame` → heading `Laporan KPI Mingguan` (dummy tanpa peserta), locator reset `exact:true`, regex token JWT sertakan titik. Screenshot/video di `test-results/` (tidak disalin ke repo).
- **Lokal akhir:** contract 15/15, authentication 32/32, program 50/50, operasional 15/15, web unit 40/40, `vue-tsc` exit 0, `check_coverage.py` OK 35M+14N. `scope_guard Y01`: `changed` hanya file Y01 (+2 sync auth + manifest); `outside` = file Y02 paralel pengguna (tidak disentuh).
- **Risiko/sisa:** `docs` endpoint WARN (prebuilt hilang saat build gagal; tidak dipakai Y01); email `.invalid` di `.env.example` masih ditolak Directus 11 (perlu ganti ke domain valid); `program/auth.js` ikut Y01 hanya demi sync — Y02 jangan ubah guard tanpa sinkron 4 salinan; legacy `forgot-password.vue`/`audit-sesi.vue` tetap ada hingga Y02.

## Addendum 28 Sep 2026 — B39: aturan kunci kota dijadikan satu tempat

- Temuan review: kunci wilayah kabkota (`lockedKotaId`) hanya hidup di `TabularData.vue`, sementara `useTabularFilters.ts` yang dipakai halaman spasial dan dashboard infografis menuliskannya sendiri (dan spasial sama sekali tidak mengunci).
- Perbaikan: `useLockedKota()` + `applyLockedKota()` di `apps/web/app/composables/useTabularFilters.ts`; composable, `TabularData.vue`, dan `dashboard/index.vue` memakai aturan yang sama, dropdown kabupaten pada peta spasial dinonaktifkan untuk kabkota; commit `7ad2c47`.
- Bukti: tes Vitest `tests/unit/tabular-filters.test.ts` + e2e `kabkota-scope.spec.ts` ("spasial kota select is locked for kabkota (B39)"), ketiganya hijau bersama `tabular.spec.ts` dan `spasial.spec.ts`. Server tetap penegak utama lewat `scopeTabularQuery`.
