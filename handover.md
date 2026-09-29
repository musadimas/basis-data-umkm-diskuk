# Handover: merge `origin/main` → `main` (basis-data-umkm-diskuk)

> **Pembaruan 28 Sep 2026:** stage_1 (Y01–Y10) selesai dan sudah di-commit (`af1932c`).
> Perbaikan pasca-review arsitektur berjalan di
> `docs/dashboard-operasional-e2e-plan/stage_1/architecture_review_fixes.md` — baca **§2.0**
> (status per bug) dan **§2.0b** (riwayat commit + titik mulai berikutnya) sebelum mulai.
> Status per 28 Sep 2026 sore (kedua): seluruh P0/P1/P2 **backend** sudah di-commit (`5088ac5`…`8fa246a`).
> **Pelaksana A sudah commit + push** berkasnya (B04–B07, B23, `requireRole`, §2.6: `0e83667`…`e0e5533`; working
> tree bersih, `main` = `origin/main`, ahead/behind 0). Lane web aman sudah jalan (`0350ebc`…`70974b5`: B28,
> B26-web, B39, B40), ditambah higiene §2.5 (`a17e1f4`), encoding font QR PDF (`2ea59a1`), dan B02(c) —
> migrasi `20260928E` membatalkan job ekspor lama >8 filter (`7fec80c`).
> Yang tersisa: **B08-web** (pencarian Tabular ke body POST — mock/spec kini bebas diubah), **B16** (kabkota
> belum punya `/dashboard/klinik` di `ROLES.ts`), **B31** (`samaRahasia`/timingSafeEqual belum diekstrak),
> **B33** (satu `normalisasiTeleponSeluler`), **B34/B35/B38** (`PROGRAM.ts`, `.vue`, `kpi-outbox.ts`,
> `export-renderer.js`, `lib/katalog.ts`), sisa §2.5, dan gelombang 3+ (kandidat 01 → 03 → 02 → 06/04 → 05).

Dokumen ini untuk agent berikutnya yang melanjutkan pekerjaan setelah merge besar antara 18 commit
lokal (`fabhiansan`) dan 2 commit `origin/main` (`musadimas`).

Tulis dalam bahasa Indonesia, seperti pengguna dan dokumentasi repo ini.

---

## Status sekarang (diperbarui 27 September 2026, sesi Y01)

| Item | Nilai |
|---|---|
| Repo | `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk` |
| Branch | `main`, **ahead 31 / behind 0** dari `origin/main` |
| Merge kanonik | `790559b` — modul Brief Fitur (`program`) jadi kanonik; `1cab173` + `ecee7ac` tetap riwayat |
| Commit perbaikan | `ecee7ac` — memperbaiki extension operasional yang dipecahkan merge |
| Backup pra-merge | `backup/pre-merge-20260927` @ `d56f114` |
| Working tree | `M main_plan.md, scope_manifest.json, phase_Y01_identity.md` (bawaan handoff) + `M` 12 file Y01 sesi ini + `?? handover.md, execution-evaluation.md, receipt_Y01_identity.md`; tidak ada penanda konflik |
| Push | **belum** dilakukan |
| Gate | Y01 `done` (`docs/dashboard-operasional-e2e-plan/stage_1/receipt_Y01_identity.md` addendum 27 Sep 2026); Y02–Y03 dibuka; R01–R05 terkunci hingga Y10 `done` |

Alasan keputusan dan rekonsiliasi lengkap sudah ada di pesan kedua commit itu
(`git show 1cab173`, `git show ecee7ac`) — jangan diduplikasi di sini.

Titik awal yang paling cepat: `git log --oneline -3` dan `git show --stat 1cab173`.

---

## Keputusan yang sudah diambil pengguna (jangan dibuka ulang tanpa alasan baru)

1. **Arsitektur auth/sesi mengikuti `origin/main`.** Policy sesi hidup di extension Directus
   (`20260926C-add-session-policy-to-directus-sessions.js`); BFF proxy dan signed-cookie
   session-policy sisi Nuxt **dihapus**; web memakai SDK langsung
   (`apps/web/app/lib/directus.ts`, `apps/web/app/plugins/directus.ts`).
2. **Identitas peran = kolom `directus_users.app_role`** (TEXT, CHECK
   `('provinsi','kabkota','pendamping','umkm')`), bukan role Directus terpisah. Ini sengaja dipilih
   supaya guard musadimas (`requireDashboardAccountability`, yang di-hardcode ke satu UUID role)
   tidak perlu diubah.
3. **`directus_users.kota_scope` (integer FK ke `kota.id`) adalah wilayah terstruktur pasca-`790559b`** (migrasi `20260926H-create-program-foundation.js`). Baris lama di dokumen ini yang menyebut `directus_users.kota` merujuk keadaan pra-`790559b`; kode kanonik (`useAuth.ts`, `shared/operator.cjs`, `analytics operator.js`, `lockedKotaId`) membaca `kota_scope`. Jangan menghidupkan lagi kolom `kota` lama.
4. **Enforcement wilayah kabkota di-porting**, bukan dibuang, meskipun `origin/main` menang di
   tempat lain. UI kini juga mengunci (`dashboard/index.vue`, `TabularData.vue` via `lockedKotaId` Y01); server tetap batas keamanan via `scopeTabularQuery`.
5. **Kerjaan unik lokal dipertahankan:** extension operasional, halaman
   talenta/binaan/data-lapangan/akselerasi/usaha, laporan KPI offline, dan `extensions/shared/`.

---

## Invariant yang tidak boleh dilanggar

Bagian ini yang paling penting. Melanggarnya akan mengembalikan bug yang sudah diperbaiki.

### Peran

- `AuthUser.role` = **UUID role Directus**. `AuthUser.app_role` = **kunci peran**
  (`"provinsi" | "kabkota" | "pendamping" | "umkm"`). Jangan pernah memakai `role` sebagai kunci
  peran — itu bug yang sempat terjadi di `auth.global.ts` dan `AppSidebar.vue`.
- Jangan membuat ulang `directus_roles` / `directus_policies` per peran. Semua pengguna operasional
  memakai satu policy aplikasi `9325db4b-9518-41db-b122-8c667f2ce510`.
- `directus_users.kota_scope` (integer FK) adalah **satu-satunya** wilayah terstruktur pasca-`790559b`.
  Baris lama yang menyebut `kota` sudah usang untuk kode baru.

### Enforcement analytics

- Kode: `services/directus/extensions/analytics/src/lib/utils/operator.js` dan
  `services/directus/extensions/analytics/src/endpoints/analysis/scope.js`.
- Gerbang `DATA_ROLES` (`provinsi`, `kabkota`) **sengaja ditaruh di dalam `resolveOperator`**, bukan
  per route, supaya tidak ada route yang bisa lupa. Jangan dipindahkan ke tiap route.
- `pendamping` dan `umkm` **tidak** memakai endpoint analytics; mereka memakai endpoint
  `/panel/operasional/*`. Kalau ada kebutuhan baru, ubah `DATA_ROLES` secara sadar, jangan
  melonggarkan gerbangnya.
- Error guard harus punya `name = "DirectusError"` **dan** `status` (lihat `OperatorError`). Kalau
  tidak, Directus meratakan 401/403 menjadi **500** — `isDirectusError()` di `@directus/errors`
  hanya memeriksa `value.name === "DirectusError"`.

### `extensions/shared/` harus tetap hidup

- `directus-extension-operasional` (CommonJS) me-`require` `shared/auth.cjs` dan
  `shared/operator.cjs`. Pada merge pertama, git membaca `shared/auth.cjs` sebagai *rename* ke
  salinan per-bundel milik `origin/main` lalu menghapusnya, dan extension itu **gagal dimuat sama
  sekali** (`Cannot find module '../../shared/auth.cjs'`). Jangan biarkan git melarutkan direktori
  ini lagi; periksa dengan `ls services/directus/extensions/shared/`.
- Konsekuensinya ada **tiga salinan** util auth yang harus dijaga sinkron:
  `shared/auth.cjs`, `analytics/src/lib/utils/auth.js`, `authentication/src/lib/utils/auth.js`.
  Ini pola "keep both in sync" milik `origin/main` yang dipertahankan, bukan kelalaian.
- `shared/tabular-filter.cjs` juga terhapus oleh merge dan **tidak** perlu dihidupkan lagi.

### Migrasi

- Migrasi `origin/main` (`20260926A`, `B`, `C`) **jangan di-rename** — mungkin sudah dijalankan di
  environment lain. Pasca-`790559b`, nama `20260926H`–`N` dipakai kode program kanonik; manifest lama
  yang merencanakan H–N untuk fitur lain sudah direkonsiliasi pada Y01 (hanya entri Y01).
- Migrasi milik kita: `20260926D-operational-roles.js`, `E-create-usaha-atribut-jabar.js`,
  `H-create-program-foundation.js` (`kota_scope`), `I` talent, `J` KPI, `K` katalog, `L` passport,
  `M` kegiatan/FAQ, `N` klinik. `F/G` lama (talenta/program_akselerasi) dihapus merge.
- `20260926D` sengaja **tidak** membuat role/policy, dan **wajib** mempertahankan `app_role` dan
  `instansi` di string read-fields. Versi sebelumnya menimpanya dan akan merusak model auth.
- `20260926E-kabkota-analytics-access` **dihapus dengan sengaja**: `20260819C-create-analytics-foundation.js`
  sudah memberi policy aplikasi hak `analitik_view` dengan isolasi `owner = $CURRENT_USER`.
- `20260926F` (talenta) memberi hak `directus_files` ke policy aplikasi saja.
- Unique index `directus_users(usaha)` hanya boleh ada satu: `directus_users_usaha_unique` (milik A).

---

## Verifikasi

Node v22.22.2. Perhatikan: bentuk direktori `node --test services/directus/test/` gagal
(`MODULE_NOT_FOUND`); pakai bentuk glob.

```bash
cd services/directus/extensions/analytics && node --test test/*.test.js
# harapan: 82 tests, 81 pass, 0 fail, 1 skip (integration test butuh DB, memang di-skip)

cd services/directus/extensions/directus-extension-operasional && node --test test/*.test.cjs
# harapan: 66 tests, 66 pass, 0 fail

node --test services/directus/test/*.test.mjs
# harapan: 23 tests, 23 pass, 0 fail

cd apps/web && npx vitest run
# harapan: 4 files, 29 tests, semua lulus

cd apps/web && npx nuxt prepare && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json
# harapan: hanya 4 error, semuanya modul belum terpasang (altcha, crossws, ws)
```

Cek cepat tidak ada konflik tersisa:

```bash
git grep -n -E "^<<<<<<< |^>>>>>>> |^\|\|\|\|\|\|\| " -- .
```

---

## Tugas lanjutan (berurut prioritas) — pembaruan Y01 27 Sep 2026

Selesai pada sesi Y01 ini (lihat receipt `docs/dashboard-operasional-e2e-plan/stage_1/receipt_Y01_identity.md`, verdict `partial`):
- [x] 1. Dependensi `altcha` kini hijau tanpa instal ulang (auth 32/32, typecheck exit 0). Sisa `crossws`/`ws` tidak lagi memblokir typecheck.
- [x] 2. Kunci filter kota di-porting: `lockedKotaId()` menerima `app_role` + kota angka (`ROLES.ts:68`), dipakai `dashboard/index.vue` + `TabularData.vue`.
- [x] 3. E2E basi diperbaiki: `roles.spec` (Directus `/panel/auth/login`, “Menu akun”, badge Provinsi/Kab-Kota), `operasional.directus` (label “Email atau NIB”, `/lupa-kata-sandi` + `/reset-kata-sandi`), `kabkota-scope` (endpoint baru + kunci UI), mock `/users/me` per-role + 401 anonim. Mock browser 11/11 pass.

Tugas lama di bawah bernomor tetap; yang sudah selesai dicoret dan diganti tindak lanjut runtime:

1. ~~**`pnpm install` di `apps/web`.**~~ Selesai untuk Y01 (lihat di atas).
2. ~~**Kunci filter kota di sisi web belum di-porting.**~~ Selesai untuk infografis + tabular (lihat di atas). Sisa: `spasial.vue` + `useTabularFilters.ts` belum dikunci; hapus legacy `forgot-password.vue`/`audit-sesi.vue` setelah runtime hijau.
3. ~~**E2E spec basi.**~~ Selesai untuk Y01 (lihat di atas).
4. **Dampak rename migrasi pada DB yang sudah jalan.** Kalau ada database yang sudah menjalankan
   migrasi lokal dengan nama lama (`20260926A-operational-roles` dst.), nama barunya akan dianggap
   migrasi baru. Isinya idempoten (`IF NOT EXISTS` / guard `WHERE NOT EXISTS`) sehingga aman
   diulang, tetapi baris lama di `directus_migrations` akan tertinggal — khususnya untuk `E` yang
   sudah dihapus. Perlu diperiksa sebelum deploy.
5. **Dokumentasi masih menggambarkan model 4 role lama:** `docs/architecture/decisions/0007-*.md`
   dan `docs/dashboard-operasional-e2e-plan/**`.
6. **`DashboardAuthError` masih bisa menjadi 500** pada jalur yang hanya lewat `routeGuard` (namanya
   bukan `"DirectusError"`). Ini sifat bawaan kode `origin/main` yang sengaja tidak disentuh; di
   dalam extension operasional tertutup oleh `sendOperasionalError`. Perbaiki kalau mau rapi.
7. **Push.** Belum dilakukan. Repo privat `musadimas`, dan kredensial push perlu token akun
   `fabhiansan`; tanpa itu push gagal `Repository not found`. Jangan menaruh nilainya di dokumen ini.

---

## Jebakan yang sudah menggigit (jangan terulang)

Merge ini **bersih secara git tapi rusak secara semantik**. Tiga kasus terburuk:

- `AppSidebar.vue` (milik `origin/main`) membaca `NAVIGATION_LINKS` sebagai peta section datar,
  sedangkan `NAVIGATION.ts` (milik lokal) berkunci peran → menu **semua peran tampil ke semua
  orang**. Git tidak memberi konflik karena beda file.
- `auth.global.ts` (milik lokal, tidak konflik) memakai `user.role` sebagai kunci peran, sementara
  `useAuth.ts` (milik `origin/main`) mengubah `role` menjadi UUID → semua pengguna non-admin
  terlempar ke `/dashboard`.
- `20260926D` menimpa field baca `directus_users` milik `20260926A`, menghapus `app_role` dan
  `instansi` → model auth rusak tanpa error apa pun.

**Pelajaran untuk merge berikutnya di repo ini:** setelah merge yang menyentuh auth/peran, jangan
percaya "tidak ada konflik" sebagai bukti aman. Telusuri silang: grep pemakaian simbol yang
terdampak (`user.role`, `app_role`, `NAVIGATION_LINKS`, `roleGuard`, `resolveOperator`), jalankan
typecheck, dan periksa bahwa setiap modul yang di-`require` masih ada. `git merge-tree --write-tree`
sebelum merge hanya mendeteksi konflik tekstual, bukan tabrakan makna antar-file.

---

## Skills yang disarankan untuk sesi berikutnya

Panggil lewat tool `Skill`:

- **`directus`** — untuk memeriksa koleksi, permission, dan kolom `app_role` / `kota` / `usaha` di
  instance Directus sungguhan. Berguna untuk tugas lanjutan #4 dan untuk membuktikan enforcement
  berjalan pada data nyata, bukan hanya di test.
- **`browser-use:web-gui-tester`** — untuk memvalidasi matriks peran → menu → rute di UI. Ini area
  paling berisiko pasca-merge (lihat bagian jebakan), dan belum ada yang mengujinya di browser.
- **`to-tickets`** — untuk memecah daftar tugas lanjutan di atas menjadi tiket berurutan sebelum
  dikerjakan.
- **`grilling`** — kalau pengguna ingin menguji ulang keputusan yang tersisa, terutama apakah kunci
  filter kota di UI perlu di-porting dan bagaimana `lockedKotaId()` sebaiknya dibentuk.

---

## Kelanjutan Y01 → Y02 (agen berikutnya mulai di sini)

Jalankan sesuai `docs/dashboard-operasional-e2e-plan/main_plan.md` (urutan Y01→Y02/Y03→Y04–Y09→Y10, R terkunci hingga Y10 `done`).

1. **Y01 `done` (addendum 27 Sep 2026).** Runtime disposable closed: `build directus` hijau (docs toleran, di luar Y01), DB reset + `A–E,H–N`, seed 4 akun/8 usaha, ALTCHA 5 kasus + 4 role/NIB + reset Mailpit sekali pakai + activity/logout/401 + scope 403/404, browser Y01 3/3 + kabkota 2/2. Perbaikan `DashboardAuthError`→`DirectusError` 4 salinan; manifest Y01 +2 entri sync. Blocker lama di bawah sudah tertutup.
2. Perintah acuan lanjutan: `up -d` sudah hijau (`/server/health` + web 200); jaga `RATE_LIMITER 60/10s`, `AUTH_PASSWORD_RESET_URL=/reset-kata-sandi`, `AUTH_CAPTCHA_EXEMPT_ORIGINS` hanya `:8055` (web `:3000` tetap wajib ALTCHA).
3. Bukti yang menutup Y01: challenge ALTCHA 5 kasus, login NIB + kedinasan empat role, reset Mailpit sekali pakai + replay, `GET /v1/auth/activity` milik sendiri, logout + private 401, lintas kota/usaha 403/404 + readback (`auth_login_audit`, `auth_captcha_used`, `app_role/kota_scope/usaha`), browser nyata `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_USE_REAL_API=1` desktop/mobile + unauth. Simpan sebagai addendum `receipt_Y01_identity.md` hingga `done`.
4. Baru buka Y02/Y03 sesuai dependency (BA `Scouting` vs `talent_pool`, aturan Jumat/offline pada `extensions/program` kanonik). Jangan menghidupkan service/migrasi lama yang dihapus `790559b`.

## Artefak terkait

- Keputusan & rekonsiliasi: pesan commit `1cab173` dan `ecee7ac`, plus merge kanonik `790559b` (“DB lokal perlu di-reset”).
- Receipt Y01 (`partial`): `docs/dashboard-operasional-e2e-plan/stage_1/receipt_Y01_identity.md` — hasil tes, readback, blocker runtime, dan syarat `done`.
- Keadaan pra-merge untuk perbandingan: branch `backup/pre-merge-20260927`.
- Kontrak istilah operasional: `docs/operasional/`, `docs/dashboard-operasional-e2e-plan/`.
- ADR analitik: `docs/architecture/decisions/`.
- Skill proyek untuk akses data: `.agents/skills/directus/SKILL.md`.
