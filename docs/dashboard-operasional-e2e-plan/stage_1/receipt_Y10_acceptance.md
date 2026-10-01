# Receipt Y10 — Gate akhir tahap kuning (Stage 1)

- **Tanggal:** 28 September 2026 (sesi gate; pengguna mengerjakan phase lain paralel di worktree yang sama).
- **Verdict gate:** **`blocked`** — Stage 1 belum lulus. R01 **tidak** dibuka.
- **Alasan utama (stop conditions):**
  1. **Y05 belum punya receipt** dan seluruh bukti runtime-nya belum ada: container `analytics-worker` tidak berjalan pada project `diskuk-operasional-e2e`, volume ekspor kosong, 11 job `analitik_job` berstatus `queued`, dan tidak ada artefak PDF/PNG/PPT untuk di-parse.
  2. **Y04 `partial`**: migrasi `O`/`P` sudah diterapkan dan schema terverifikasi, tetapi bukti runtime passport (issue → verify → tamper → cabut) belum ada; `talent_passport` berisi **0 baris** di DB disposable; bukti browser upload/kurasi/QR belum dijalankan.
  3. **Y07 `partial` + Y08/Y09 gate terbuka**: provider WhatsApp belum ada (`WHATSAPP_GATEWAY_URL` dst. tidak diisi di env disposable) sehingga pengingat WhatsApp dan notifikasi klinik berstatus **`not provider-proven`**.
  4. **Y09 `partial`**: bukti runtime sesi petugas (scope kanban, 403 penugasan, 409 transisi/version, audit) belum dijalankan pada API/sesi nyata.
  5. Regresi suite mock 8 tes (akun/passport/produk-passport) belum ditutup; `pnpm lint:oxlint` merah (125 error/17 warning) — sebagian pre-existing dari `origin/main`, sebagian pekerjaan phase berjalan.
- **Scope:** gate saja. Tidak ada perubahan kode pada sesi ini; hanya pembacaan, perintah uji, probe read-only, dan laporan ini.

## Checklist Y10 — hasil

| # | Butir | Hasil | Bukti |
| --- | --- | --- | --- |
| 1 | `check_coverage.py`; semua M tepat sekali; setiap phase punya receipt; tidak ada klaim N selesai | **Lulus sebagian** — coverage OK (exit 0), tidak ada klaim N di receipt Y (grep bersih), tetapi **Y05 tidak punya receipt** | `python3 …/check_coverage.py` → exit 0; `grep -nE 'N[1-7]-…' stage_1/receipt_*.md` → nihil |
| 2 | Migrasi/rollback, seed dummy, seluruh test unit/contract relevan, typecheck/build, smoke stack disposable | **Sebagian** — semua suite lokal hijau + build + typecheck + compose config + smoke health; rollback terbukti di receipt Y08 (tidak diulang); seed tidak dijalankan ulang (data dummy sudah ada); cleanup belum | Lihat tabel “Bukti yang dijalankan” |
| 3 | Browser real API seluruh alur (empat role, SIDT→BA, PWA Jumat, produk→passport, canvas/map/Tabular, katalog+LOI, agenda, klinik+FAQ) | **Tidak dijalankan penuh** — bukti real-API per phase ada untuk Y01/Y02/Y03/Y06; Y04/Y05/Y07(sebagian)/Y09 belum; browser real-API tidak diulang di sesi gate karena gate sudah `blocked` dan suite mutatif berisiko bentrok dengan sesi paralel pengguna | Receipt per phase |
| 4 | Parser + visual PDF/PNG/PPT/QR; provider WhatsApp/email; kontrak status verifikasi OSS/PDN/SIDT | **Gagal** — tidak ada artefak ekspor (volume kosong); WhatsApp `not provider-proven` (gateway kosong); email terbukti Mailpit (Y07); model badge PDN terverifikasi-vs-deklarasi ada di kode, OSS hanya NIB (tidak ada integrasi OSS) | Probe + receipt Y07/Y08 |
| 5 | PII scan response/log/ekspor; race/retry/idempotency; query budget/indeks | **Sebagian** — probe publik bersih (tanpa NIK/16 digit/PII), log scan bersih, idempotensi/race terbukti per phase di receipt (LOI, slot, clientUuid, klaim job); **indeks pencarian trigram belum diterapkan** (script ada, `pg_trgm` terpasang, index GIN tidak ada), worker tidak berjalan sehingga job tidak tereksekusi | Lihat tabel SQL |
| 6 | Cleanup dummy + readback nol `dummy_`; laporan akhir per ID | **Belum** — cleanup sengaja **tidak** dijalankan: gate belum lulus dan sesi paralel pengguna masih memakai fixture disposable. Laporan per ID ada di bawah | – |

## Bukti yang dijalankan sesi ini (perintah + hasil)

| Perintah | Hasil |
| --- | --- |
| `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | exit 0 — 35 M di Y, 14 N di R, 15 phase file, 2 perbaikan hijau di Y05 |
| `node --test services/directus/test/*.test.mjs` | **21/21 pass**, exit 0 |
| `node --test services/directus/extensions/program/test/*.test.js` | **128/128 pass**, exit 0 |
| `node --test services/directus/extensions/authentication/test/*.test.js` | **32/32 pass**, exit 0 |
| `node --test …/directus-extension-operasional/test/*.test.cjs` | **15/15 pass**, exit 0 |
| `cd services/directus/extensions/analytics && node --test test/*.test.js` | **88 pass, 1 skip, 0 fail**, exit 0 |
| `cd services/analytics-worker && node --test test/*.test.js` | **31/31 pass**, exit 0 |
| `cd apps/web && npx vitest run` | **57/57 pass** (7 file), exit 0 |
| `cd apps/web && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | exit 0 |
| `cd apps/web && pnpm build` | **sukses** (“Build complete!”, `.output/server/index.mjs` 28 Sep 04:01) |
| `cd apps/web && npx playwright test --project=chromium` (mock penuh) | **80 pass, 8 fail, 16 skip** (skip = blok `PLAYWRIGHT_USE_REAL_API`) |
| `pnpm lint:oxlint` | **exit 1** — 125 error, 17 warning pada 42 file (10 file baru/untracked, 17 dirty, 15 bersih-vs-HEAD termasuk file dari `origin/main`); plugin `anti-slop` berasal dari `origin/main` (`e45448d`) |
| `docker compose --env-file .env.example config --quiet` | exit 0 |
| Health stack disposable | Directus `/server/health` `{"status":"ok"}`, web `HTTP 200`, Mailpit `HTTP 200` |
| Migrasi terapan (DB disposable) | `20260926A,B,C,D,E,H,I,J,K,L,M,N,O,P,Q,R,S` + `20260927A,B` (semua file aktif terpasang) |
| Schema readback | `talent_passport.kid/signature`, `produk.uji_lab/usaha_nib`, `konsultasi_poli.subtopik`, `konsultasi_tiket.{pemohon,pendamping,sumber_identitas,wa_consent}`, `kegiatan.{kategori,registration_url,status_publikasi}` — semua ada |
| Tabel kunci | `kegiatan_pengingat`, `klinik_notifikasi`, `konsultasi_tiket_audit`, `auth_captcha_used`, `auth_login_audit`, `produk_loi`, `talent_pengajuan`, `talent_berita_acara`, `kpi_laporan(+bukti)` — semua ada |
| Row counts | produk 2 (tayang 1), produk_loi 2, konsultasi_tiket 12, poli 6, kegiatan 6, pengingat 5, **talent_passport 0**, BA 1, kpi_laporan disetujui 4, usaha 8 |
| `analitik_job` | **11 baris semua `queued`** (job tertua 27 Sep 11:13); export_type kosong; worker tidak berjalan |
| Volume ekspor worker | `diskuk-operasional-e2e_analytics_exports` **kosong** |
| `docker compose ps -a` | `analytics-worker` **tidak ada container**-nya; image worker masih 26 Sep (stale) |
| Indeks | `pg_trgm` terpasang (migrasi Q); **tidak ada** indeks GIN/trigram; script `scripts/create-operasional-search-indexes.sql` (3 indeks `CONCURRENTLY`) **belum diterapkan**; btree `idx_usaha_tabular_*` ada |
| Probe publik (anonim, `:8055`) | `GET /v1/program/klinik/poli` 200 (6 poli, `Cache-Control: private, no-store`); `GET /v1/program/kegiatan` 200; `GET /items/produk` 200 (1 produk tayang, field allowlist termasuk NIB/WA bisnis yang memang publik); `GET /items/produk?filter[status_kurasi][_eq]=menunggu` → `{"data":[]}`; detail produk draft → **403**; `GET /items/faq` 200 (tanpa `status`, → 403 saat `fields` menyertakan field terlarang); `GET /items/kota` 200; `GET /items/kontak_hotline` 200; `GET /v1/program/klinik/tiket` **401** |
| PII scan | Tidak ada pola NIK (16 digit), `"nik"`, telepon `62812…`, `240000000`, `Siti Aminah` pada seluruh response probe; scan 3000 baris terakhir log directus & web → **0** pola 16 digit |
| Provider | `/tmp/operasional-e2e.env` **tidak** memuat `WHATSAPP_GATEWAY_URL/TOKEN/SENDER/REQUIRE_CALLBACK` (nama env ada di container dengan default kosong) → WhatsApp `not provider-proven`; email Mailpit terbukti di Y07 (resi message id) |
| Klaim N | grep receipt stage_1 untuk `N#-…` → tidak ada klaim implementasi N selesai |

### 8 tes mock yang merah (belum ditutup)

- `akun.spec.ts` ×4 — login NIB/captcha/reset/profil (permintaan `/panel/auth/login` tidak tercatat di mock). File spec bersih-vs-HEAD; fixture mock ikut berubah oleh banyak phase.
- `passport.spec.ts` ×1 dan `produk-passport.spec.ts` ×3 — area Y04/Y06 (spec `produk-passport` masih untracked = pekerjaan in-flight).

Catatan: kegagalan ini sudah terlihat pada receipt Y07/Y09 sebagai “pekerjaan sesi paralel”; belum ada yang menutupnya.

## Verdict per ID (35 M + 2 perbaikan hijau)

“done” = ada receipt dengan bukti perilaku/API/artefak; “partial” = bukti lokal/mock ada, runtime/artefak belum; “blocked” = belum ada bukti berarti.

| Phase | ID | Verdict | Dasar |
| --- | --- | --- | --- |
| Y01 | M1-01…M1-04 | **done** (receipt) | Addendum 27 Sep; re-verifikasi sesi ini: auth 32/32, contract 21/21, unit web 57/57, typecheck 0; mock roles/auth hijau |
| Y02 | M4-01…M4-04 | **done** (receipt) | Program 128/128 mencakup talent; mock talent hijau; runtime BA/scope terbukti di receipt |
| Y03 | M5-01…M5-06 | **done** (receipt) | Mock kpi hijau; idempotensi & pitching terbukti runtime di receipt |
| Y04 | M6-01, M6-02, M6-03, M6-04, M7-06 | **partial** | Migrasi O/P terpasang + schema OK; unit/lokal hijau; **runtime passport belum** (`talent_passport` 0 baris), browser upload/kurasi/QR belum, scope guard belum hijau; receipt `partial` |
| Y05 | M2-01 | **blocked** | PNG renderer sudah 900×560 di kode, tetapi worker tidak berjalan, volume kosong, 11 job queued, tidak ada artefak untuk parser |
| Y05 | M3-01 | **partial** | Popup pin ada di kode; bukti runtime browser (pin dalam/luar scope) tidak ada |
| Y05 | M6-05 | **blocked** | Dua PDF (scorecard + katalog ekspor) tanpa artefak; bergantung passport runtime (Y04) |
| Y05 | Hijau: pencarian Tabular | **partial** | `searchClause`/`query.q` + `tabular-search.test.js` ada; indeks trigram belum diterapkan; EXPLAIN/query budget & bukti UI runtime belum |
| Y05 | Hijau: basemap satelit | **partial** | Layer Esri + attribution + toggle ada di kode; bukti runtime tile/drill-down belum |
| Y06 | M7-01…M7-05 | **done** (receipt) | Probe publik sesi ini: 1 produk tayang, draft 403, filter `menunggu` kosong, FAQ allowlist benar, LOI 2 baris + idempotensi dari receipt |
| Y07 | M7-07, M7-08, M7-10 | **done** | Unit 26/26 (kegiatan), API/browser runtime di receipt; filter/kalender/detail terbukti |
| Y07 | M7-09 | **partial** | CTA & pengingat email terbukti (Mailpit); **WhatsApp `not provider-proven`** |
| Y08 | M7-11 | **done** (receipt) | 6 poli runtime, subtopik ada di schema; probe sesi ini 200 |
| Y08 | M7-12 | **done** (kontrak/API) dengan gate provider terbuka | Outbox idempotent + adapter terbukti dengan gateway tiruan; provider nyata tidak ada |
| Y09 | M7-13 | **partial** | UI/kanban/audit/transisi hijau lokal; runtime sesi petugas (scope/IDOR/409/audit) belum |
| Y09 | M7-14 | **partial** | FAQ runtime terbukti (tanpa “2025”, allowlist baru); hotline belum dikonfigurasi; tombol jujur bila kosong |

**Konsekuensi:** 30 ID berstatus `done`/`done-dengan-gate-provider`, 4 ID `partial`, 3 ID `blocked`, 2 perbaikan hijau `partial`. Karena seluruh 35 M + 2 hijau belum `done` dan provider belum terbukti, **Y10 = `blocked`; R01–R05 tetap terkunci.**

## Next action per phase (urutan membuka Y10 ulang)

1. **Y04 (partial → done):** jalankan bukti runtime passport di stack disposable: terbitkan passport untuk usaha `talent_pool` dari BA Y02, `GET /verify/:kode` (kid + QR = kode), tamper payload di DB → `valid:false`, cabut → `dicabut`, flip `pdn_terverifikasi` + re-issue, legalitas tanpa berkas tetap “belum terverifikasi”; browser: unggah foto (MinIO) → kurasi → unduh QR PNG/PDF → buka `/passport/<kode>` tanpa sesi; jalankan `scope_guard` sampai `outside` bersih; tulis addendum receipt Y04.
2. **Y05 (blocked → done):** `docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env up -d --build analytics-worker` (image stale 26 Sep), kuras 11 job `queued`, hasilkan PDF/PNG/PPT dengan filter canvas, parse tiap artefak + buka visual, terapkan `scripts/create-operasional-search-indexes.sql`, jalankan EXPLAIN/query budget pencarian Tabular, browser desktop/mobile pencarian + satelit + popup pin; tulis receipt Y05.
3. **Provider WhatsApp:** isi `WHATSAPP_GATEWAY_URL` (+token/sender/secret) sandbox ke stack disposable, kirim ulang opt-in pengingat Y07 & notifikasi tiket Y08, simpan resi (message id/callback) sebagai addendum; atau biarkan `not provider-proven` dan Y10 tetap `blocked`.
4. **Y09:** jalankan bukti runtime sesi petugas (provinsi/kabkota/pendamping): scope kanban, `403 BUKAN_PENUGASAN_ANDA`, `409 TRANSISI_TIDAK_VALID`, `409 TIKET_BERUBAH`, readback `konsultasi_tiket_audit`; perbaiki/verifikasi hotline; tulis addendum receipt Y09.
5. **Regresi mock:** tutup 8 kegagalan `akun.spec` (4) dan `passport/produk-passport` (4) atau catat resmi sebagai di luar gate bila disepakati; putuskan baseline `oxlint` (125 error) agar gate berikutnya tidak ambigu.
6. **Y10 ulang:** setelah 1–5 selesai, ulangi checklist ini (termasuk browser real API penuh + parser artefak), lalu cleanup dummy (`scripts/cleanup-dummy-operasional.sql` + row `dummy_` = 0) dan baru buka R01.

## Catatan integritas

- Tidak ada perubahan kode/plan/manifest pada sesi ini; tidak ada `git add/reset/clean/stash/push`; tidak ada file pengguna yang ditimpa.
- Semua perintah berjalan terhadap stack disposable `diskuk-operasional-e2e`; production tidak disentuh. Rahasia tidak dicetak (hanya mengecek ada/tiadanya dan panjang nilai env provider).
- Browser real-API penuh tidak diulang di sesi ini: verdict gate sudah `blocked` oleh bukti di atas, dan suite mutatif berisiko bentrok dengan phase paralel pengguna yang masih memakai fixture disposable. Verdict ini tidak menaikkan klaim phase mana pun.

## Addendum 28 Sep 2026 — perbaikan oxlint dan 8 tes mock merah

- **Lingkup:** `pnpm lint:oxlint` dari 125 error/17 warning menjadi **0 error/0 warning (exit 0)**, dan 8 tes Playwright mock merah (3 `akun.spec.ts`, 1 `passport.spec.ts`, 4 `produk-passport.spec.ts`) menjadi lulus. Verdict gate **tidak berubah**: Y10 tetap `blocked` oleh bukti runtime/provider di atas.
- **Akar masalah tes (spec/fixture, bukan produk):**
  1. Tes login NIB meng-assert `toHaveURL(/\/dashboard\/akun$/)`, yang juga cocok dengan `/sign-in?returnTo=/dashboard/akun` — assertion lolos sebelum login selesai → diganti predikat `pathname === "/dashboard/akun"`.
  2. Dua tes memakai `getByRole("status")` yang kini bentrok dengan `NuxtRouteAnnouncer` (dua elemen) → diarahkan ke `div[role="status"]` (kotak pesan, bukan judul halaman).
  3. `passport.spec.ts` masih menguji teks lama "Halal: Terverifikasi" → diganti asersi badge Y04 (`data-testid="badge-legalitas_halal"` + `data-terverifikasi="true"`).
  4. `produk-passport.spec.ts` mengklik tombol/tab sebelum hidrasi dan melakukan `goto` ganda setelah `loginMock` (abort) → pola retry `toPass` yang sudah dipakai spec lain; login lewat `returnTo` berisi query.
  5. `loginMock` diperkuat: fill+submit diulang sampai navigasi sesi benar-benar terjadi (menutup flake lintas-spec yang muncul saat suite penuh berjalan paralel).
- **Perbaikan lint (tanpa perubahan perilaku):** komentar `SAFETY:` untuk assertion yang tersisa, predikat bertipe untuk semua `typeof`, kontrak map bernama (`RuntimeLabelMap`, pohon `FilterExpression`, `UrlQuery`/`QueryValueMap`), `satisfies` untuk peta berkunci union (PROGRAM/kegiatan/ROLES/klinik/analytics-slide), typed `reactive()` menggantikan assertion nilai awal, websocket tanpa rantai assertion, serta perapian impor/parameter tak terpakai.
- **Bukti perintah:**
  - `pnpm lint:oxlint` → `Found 0 warnings and 0 errors.` (exit 0).
  - `cd apps/web && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` → exit 0.
  - `cd apps/web && npx vitest run` → **57/57**.
  - `node --test services/directus/extensions/program/test/*.test.js` → **128/128**; contract **21/21**; analytics **88 pass/1 skip**; worker **31/31**.
  - `cd apps/web && npx playwright test --project=chromium` → **88 passed, 16 skipped, 0 failed** (sebelumnya 80/8/16).
  - `npx playwright test tests/e2e/akun.spec.ts tests/e2e/passport.spec.ts tests/e2e/produk-passport.spec.ts --workers=1` → **16/16**.
  - `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → tetap OK (tidak menyentuh plan/manifest/requirement).
- **Sisa gate Y10 (masih):** Y04/Y05 runtime & scope guard, Y05 receipt, Y09 runtime petugas, dan provider WhatsApp — lihat daftar di atas; addendum ini tidak menaikkan verdict ID mana pun.

---

## Addendum 28 Sep 2026 — patch pasca-review arsitektur

- Seluruh P0/P1 backend dan P2 backend dari review arsitektur sudah di-commit (`5088ac5`…`8fa246a`); daftar lengkap + titik mulai ada di `architecture_review_fixes.md` §2.0/§2.0b. Verifikasi pasca-patch: program **136/136** (+ pg 15/15), contract **23/23**, analytics **93 pass/1 skip** (+ pg 6/6), worker **37/37** (+ pg 1/1), oxlint **0/0**.
- **Masih di working tree pelaksana A** (26 berkas, belum commit): B04–B07, B23/§2.6 — termasuk delapan tes mock Playwright yang menjadi blocker gate ini.
- **Sisa:** B08/B16/B26-web/B28/B34/B35/B38–B40 (menyentuh berkas web), B31/B33 (menunggu commit pelaksana A), plus bukti runtime disposable Y04/Y05/Y09 dan resi provider WhatsApp seperti daftar di atas.
- **Verdict gate tidak berubah: `blocked`** sampai sisa itu tuntas dan bukti runtime disposable dijalankan.

## Addendum 28 Sep 2026 — gelombang 3 kandidat 01 tahap 1 (Cakupan Pemanggil)

- **Lingkup:** module deep `services/directus/analytics-shared/cakupan.cjs` + adapter `terjaga({peran})`/`publik()` + tes manifest route + matriks pg (commit `7e774f6`); ADR-009 → Accepted. Rute lama (79 route keempat bundle) belum diubah dan tercatat di `LEGACY_BELUM_MIGRASI` eksplisit; rute baru tanpa tanda menggagalkan tes manifest. Migrasi route menyusul bertahap, satu fitur per sesi (01 → 03 → 02 → 06/04 → 05).
- **Bukti perintah:**
  - `node --test services/directus/test/cakupan.contract.test.mjs services/directus/test/route-manifest.contract.test.mjs` → **17/17**.
  - pg (`DISKUK_TEST_PG_URL` disposable): `cakupan-matrix.pg.test.mjs` → **3/3**; program pg **15/15**, analytics pg **7/7**, worker pg **1/1**.
  - Regresi: program **141/141**, directus/test **40 pass/3 skip** (skip = pg tanpa env), analytics **94 pass/1 skip**, worker **38/38**, web unit **80/80**, oxlint **0/0** (602 berkas).
  - `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → OK (tetap, tidak menyentuh plan/manifest/requirement).
- **Verdict gate tidak berubah: `blocked`** — deepening ini tidak menaikkan klaim phase mana pun; K1/K4/K8 ikut rekomendasi, keputusan formal tetap milik pemilik produk.

## Addendum 28 Sep 2026 — B25 + 01 langkah 2

- **B25** (`6429eda`) — `useKpiOutbox.add` mengembalikan `"terkirim" | "antre" | "ditolak"`; form usaha jujur; tes unit `kpi-outbox.test.ts` (5). Web unit **85/85**.
- **Kandidat 01 langkah 2** (`8ae8053`) — `sendError` program menghormati `DirectusError`; program **142/142** (http-utils 4/4). Migrasi route (langkah 3–6,9) menyusul bertahap.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — flake klinik-ui fieldVariants

- **Flake §2.0** (`0d405b4`) — impor melingkar `Field.vue ↔ index.ts` dipecah via `field/variants.ts`; web unit **87/87** (termasuk penjaga impor 2/2). Diagnosis terisolasi tetap disarankan (`--workers=2`).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi pilot peta

- **Pilot** (`bdbcdba`) — `GET /v1/program/peta/:usahaId` memakai `terjaga({peran:[provinsi,kabkota,umkm]})`, scope via `pastikanUsaha` (404 seragam K1; `KOTA_NOT_ASSIGNED` tetap 403); peta **7/7**, program **143/143**, `directus-extension build` hijau; `LEGACY_BELUM_MIGRASI` 79→78.
- **Temuan**: tanda `Symbol.for("diskuk.cakupan")` hanya ditempel di fungsi pra-ctx sehingga handler ter-mount tak bertanda — kini inner closure ikut bertanda (terjaga + publik); tercakup tes tanda peta + kontrak cakupan 14/14.
- Pola yang sama berlaku untuk migrasi berikutnya (talent/kpi/katalog/passport/klinik/kegiatan → analytics → operasional). `lib/access.js` dan salinan `auth.js` belum dihapus (konsumen lain masih memakai).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi talent (8 route)

- **Migrasi** (`8ebdf61`) — seluruh route talent memakai `terjaga`; service menerima `pemanggil` (tidak ada `loadActor`/`assert*` tersisa di talent); scope via `pastikanUsaha` (404 K1); talent **12/12**, program **144/144**, build hijau; `LEGACY_BELUM_MIGRASI` 78→70.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi KPI (6 route)

- **Migrasi** (`e14c77f`) — seluruh route KPI memakai `terjaga`; scope via `predikat(peserta)`; KPI **8/8**, program **145/145**, build hijau; `LEGACY_BELUM_MIGRASI` 70→64.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi katalog (10 route)

- **Migrasi** (`e69ea7e`) — seluruh route katalog memakai `terjaga`/`publik`; katalog **13/13** + media **6/6**, program **146/146**, build hijau; `LEGACY_BELUM_MIGRASI` 64→54.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi passport (6 route)

- **Migrasi** (`6976558`) — seluruh route passport memakai `terjaga`/`publik` (K8 kabkota read-only ikut rekomendasi); passport **14/14**, program **147/147**, build hijau; `LEGACY_BELUM_MIGRASI` 54→48.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi kegiatan (6 route)

- **Migrasi** (`b2c4caf`) — seluruh route kegiatan memakai `publik`; kegiatan **28/28**, program **148/148**, build hijau; `LEGACY_BELUM_MIGRASI` 48→42.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — 01 migrasi klinik (9 route, program tuntas)

- **Migrasi** (`4117256`) — seluruh route klinik memakai `terjaga`/`publik`; klinik **25/25**, program **149/149**, build hijau; `LEGACY_BELUM_MIGRASI` 42→33. **Seluruh bundle program (46 route) kini memakai adapter.**
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — 01 migrasi infografis (2 route)

- **Migrasi** (`f4a0d7b`) — kedua route infografis memakai `terjaga` (provinsi/kabkota); infografis **11/11**, build analytics hijau; `LEGACY_BELUM_MIGRASI` 33→31.
- Manifest di pohon kotor masih merah 1 rute (`operasional|GET|/aspek-perkembangan` milik agen paralel, belum bertanda — tanggung jawab mereka).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — 01 migrasi tabular (13 route)

- **Migrasi** (`92742c8`) — seluruh route tabular memakai `terjaga`/`publik` (status `publik` per DAFTAR_PUBLIK, publish adminOnly via cek `pemanggil.admin` setelah `wajibPeran`, lainnya DATA provinsi/kabkota); scope via `scopeTabularQuery` dari pemanggil; `POST /query` berbagi handler `daftarBaris` dengan `GET /` (B08-web, tidak dipecah); cek `permissionScopeOf` ekspor dipertahankan (B36); `KOTA_NOT_ASSIGNED` tetap 403 via `OperatorError`; error domain di-throw setelah `logger.error`.
- **Bukti perintah:** tabular **26/26**, analytics **98 pass/1 skip**, program **156/156** (149 milik sesi + 7 `executive` milik paralel), worker **38/38**, web unit **86/86** (14 berkas), `directus-extension build` analytics hijau, `check_coverage.py` OK; `LEGACY_BELUM_MIGRASI` 31→18.
- Manifest di pohon kotor masih merah 1 rute (`operasional|GET|/aspek-perkembangan` milik agen paralel, belum bertanda — tanggung jawab mereka).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — rapian tabular (oxlint 0/0)

- **Rapian** (`03c6945`) — hapus 3 pembungkus `try-catch` tanpa `logger` di tabular; oxlint berkas sesi **0 warning/0 error**; tabular tetap **26/26**, build hijau.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — 01 migrasi analysis (10 route)

- **Migrasi** (`0f60073`) — seluruh route analysis memakai `terjaga`/`publik` (metadata/templates/status `publik` per DAFTAR_PUBLIK, lainnya DATA provinsi/kabkota); scope via `scopeAnalysisRequest`/`assertUsahaInScope` dari pemanggil, owner/isAdmin dari `pemanggil.id`/`pemanggil.admin`; `resolveScopedOperator`→`AnalyticsApiError` dipertahankan (sumber kini pemanggil); `permissionScopeOf` (B36) + `wrap`/`finishError` (B30) tidak dirusak; `KOTA_NOT_ASSIGNED` tetap 403.
- **Bukti perintah:** analytics **100 pass/1 skip**, `directus-extension build` analytics hijau, oxlint berkas sesi **0/0**; `LEGACY_BELUM_MIGRASI` 18→8.
- Manifest di pohon kotor masih merah 1 rute (`operasional|GET|/aspek-perkembangan` milik agen paralel, belum bertanda — tanggung jawab mereka).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — higiene §2.5 dedup auth.js (2 salinan)

- **Dedup** (`95b4d06`) — salinan `lib/utils/auth.js` program + analytics (md5 identik dengan salinan authentication) dilebur ke `analytics-shared/cakupan.cjs` (`sanitizeError` baru + tes kontrak); `http.js` program dan `watchdog` analytics mengimpor dari module; tes `APPLICATION_ROLE_ID` memakai module; penjaga drift menjadi penjaga penghapusan. Salinan authentication tetap ada (wilayah agen paralel).
- **Bukti perintah:** program **156/156**, analytics **100 pass/1 skip**, kontrak cakupan **15/15**, build program + analytics hijau, oxlint berkas sesi **0/0**.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 1 (dimensi shared)

- **Refactor** (`476894b`) — `DIMENSIONS` analitik (14 entri, termasuk metadata filter integer sargable) pindah ke `analytics-shared/query-compiler.cjs` sebagai sumber tunggal; router `query-compiler.js` menjadi adapter tipis yang mengimpor dari shared (perilaku compile tidak berubah); tes kontrak baru `analysis-query-compiler-shared.test.js` (sumber tunggal + deep-equal + penjaga impor). Langkah berikutnya (sesi lain): worker `exporter.js` + rollup `rebuild.js`/`query-service.js` memakai shared yang sama.
- **Bukti perintah:** analytics **101 pass/1 skip** (100 lama + 1 baru), worker **38/38**, `directus-extension build` analytics hijau, oxlint berkas sesi **0/0**.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 2a (DIMENSIONS worker dari shared)

- **Refactor** (`9f842ef`) — `exporter.js` worker memakai `DIMENSIONS` dari `analytics-shared/query-compiler.cjs` (key/label 14 entri identik, metadata filter ekstra diabaikan, `FILTER_KEYS` tetap diturunkan dari key); `DIMENSIONS` kini diekspor worker untuk kontrak paritas; tes baru `exporter-dimensions-shared.test.js` (deep-equal key/label + penjaga impor).
- **Bukti perintah:** worker **39/39** (38 lama + 1 baru), analytics **101 pass/1 skip**.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 2b (filter integer worker sargable)

- **Refactor** (`7281947`) — `filterSql` worker memakai metadata `filter`/`filterType` shared untuk dimensi integer (`a.kota_id = $n::integer`, `unknown` → `IS NULL`/`IS NOT NULL`, `in` → `= ANY($n::integer[])`, `contains`/`starts_with` ditolak dengan `INVALID_ANALYSIS_CONFIG`); dimensi teks tidak berubah.
- **Bukti perintah:** worker **42/42** (39 lama + 3 baru).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 2c (ROLLUP_DIMENSIONS dari shared)

- **Refactor** (`749b415`) — `rebuild.js` menurunkan `ROLLUP_DIMENSIONS` dari `DIMENSIONS` shared (urutan + key/label 14 entri identik, komentar "MUST stay aligned" dihapus karena kini diturunkan, bukan disalin); diekspor untuk kontrak paritas; SQL rollup (`DIM_AGGREGATE_SQL`, `SCALE_DIM_AGGREGATE_SQL`) tidak berubah bentuknya.
- **Bukti perintah:** worker **43/43** (42 lama + 1 baru).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 2d (Set rollup query-service dari shared)

- **Refactor** (`3927901`) — `ROLLUP_DIMENSIONS` Set di `query-service.js` diturunkan dari `DIMENSIONS` shared via `query-compiler.js` (salinan 14 nama dihapus, diekspor untuk kontrak paritas); perilaku fast path rollup tidak berubah.
- **Bukti perintah:** analytics **102 pass/1 skip** (101 lama + 1 baru).
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 29 Sep 2026 — kandidat 03 langkah 2e (METRICS dari shared)

- **Refactor** (`51a239b`) — `METRICS` kanonik (3 entri, penamaan `eligibleSql`/`missingSql`/`needsVerificationSql` ikut router) di `analytics-shared/query-compiler.cjs`; router `query-compiler.js` memakai sebagai alias `METRIC` (internal tak berubah); worker `exporter.js` memetakan ke nama pendeknya di seam + mengekspor untuk kontrak paritas.
- **Bukti perintah:** worker **44/44** (43 lama + 1 baru), analytics **102 pass/1 skip**.
- **Verdict gate tidak berubah: `blocked`**.

## Addendum 28 Sep 2026 — kandidat 02 pengaman resi sebelum migrasi outbox

- **Perbaikan** (`1c4adff`) — callback klinik kini hanya menerapkan resi untuk pesan `mengirim`/`terkirim`; status terminal `batal`/`gagal` tidak lagi berubah karena callback terlambat. Migrasi skema `notifikasi_outbox` belum dikerjakan; berkas compiler shared yang sedang diedit agen paralel tidak disentuh.
- **Bukti perintah:** tes kontrak resi merah 1/14, kemudian **13 lulus/1 skip** (tes Postgres baru skip karena `DISKUK_TEST_PG_URL` tidak diset); program **172/172**; oxlint tiga berkas **0 warning/0 error**. Tes perilaku Postgres belum dijalankan, tidak diklaim hijau.
- **Verdict gate tidak berubah: `blocked`**; receipt Y05 dan bukti provider tetap belum ada.

## Addendum 28 Sep 2026 — kandidat 02 identitas ganda resi

- **Perbaikan** (`df1075d`) — satu callback yang berisi `id` dan `messageId` sekarang mengubah pesan hanya bila keduanya cocok; tanpa salah satunya tetap bisa mencari lewat identitas yang tersedia, tanpa keduanya tidak ada baris terubah. Pembatas status `mengirim`/`terkirim` dari commit sebelumnya tetap berlaku.
- **Bukti perintah:** tes kontrak merah 1/16, kemudian **14 lulus/2 skip** (dua tes Postgres opt-in skip tanpa `DISKUK_TEST_PG_URL`); program **173/173**; oxlint tiga berkas **0 warning/0 error**. Postgres belum dibuktikan.
- **Verdict gate tidak berubah: `blocked`**; receipt Y05 dan bukti provider tetap belum ada.

## Addendum 29 Sep 2026 - hasil ulang gate (blocker #6)

- `pnpm lint:oxlint`: akar masalah "Cannot find module ./tools/oxlint/anti-slop/index.ts" adalah oxlint memuat `oxlint.config.ts` bersarang dari `.claude/worktrees/agent-*/` (worktree tanpa `tools/`), bukan Node/ekstensi. Perbaikan: skrip root menjadi `oxlint --disable-nested-config`. Hasil: config termuat, exit 1 dengan 88 temuan (0 dari config; 72 no-useless-escape + 5 no-unused-vars di `registrasi/*`, 11 anti-slop di `kegiatan/[id].vue`, `dashboard/kegiatan/index.vue`, `fasilitasi.vue`, `AtRiskMap.client.vue`, `investor.vue`, `pindai.post.ts`). Semua berada di berkas pekerjaan lain yang belum di-commit; belum diubah.
- Playwright mock (`--project=chromium --workers=2 --retries=0`): 99 passed, 19 skipped, 2 failed (exit 1) sebelum perbaikan. 8 merah lama (akun/passport/produk-passport) sudah hijau. Dua merah: `kpi.spec.ts` (spec usang: pesan antre B25 kini "antre dan akan dikirim saat terhubung") dan `sso-demo.spec.ts` N2-01 (strict mode: "66.7%" muncul 2x, dibatasi ke label "Indikator perkembangan usaha"). Setelah perbaikan keduanya lulus dijalankan tersendiri (kpi 3/3, sso-demo 2/2).
- `pnpm --dir apps/web typecheck`: exit 0.
- `pnpm --dir apps/web exec vitest run`: 14 files, 86 tests passed, exit 0.
- `pnpm --dir apps/web lint`: 9 temuan awal; 6 warning `vue/html-self-closing` diperbaiki (`eslint --fix`, 4 berkas). Sisa exit 1: `(public)/kegiatan/index.vue` (2 error: `hariJakarta` tak terpakai, `no-dynamic-delete`; 1 warning `meta` shadow), berkas pekerjaan lain.

## Addendum 29 September 2026 (malam) — pembaruan verdict gate

- **Verdict gate: `partial`** (sebelumnya `blocked`). Semua blokir "bukti runtime tidak ada" sudah ditutup pada clone terisolasi; yang tersisa adalah celah bukti dan keputusan, bukan fase tanpa bukti. R01 tetap **belum** dibuka secara resmi: Y10 belum `done`.
- **Amendemen requirement (keputusan pengguna):** WhatsApp bukan syarat pembuka R01 (lihat `phase_Y10_acceptance.md`). Jalur WhatsApp tetap `not provider-proven`.
- **Semua bukti runtime berasal dari clone** (`y05_clone`, `y49_clone`, `r03_clone`) yang sudah dihapus. Stack disposable bersama tidak diubah: image lama, tanpa worker, migrasi 28A–H dan 29A belum diterapkan.

### Yang berubah terhadap blokir awal

| Blokir awal | Status sekarang | Bukti |
| --- | --- | --- |
| Y05 tanpa receipt, worker mati, artefak kosong, job antre | **Ditutup pada clone** (M2-01 done, M6-05 done, pencarian Tabular server done, basemap satelit done). Sembilan bug ditemukan dan diperbaiki (mis. `SECRET` vs `DIRECTUS_SECRET`, lock rebuild, `workerId`, PDF passport 500, `q` pendek 500). Migrasi baru `20260929A`. | [receipt_Y05_exports_map.md](receipt_Y05_exports_map.md), `artifacts/Y05/` |
| Y04 tanpa runtime passport | **Ditutup pada clone:** 77/77 probe API, 5/5 browser; tamper/cabut/IDOR/6 issue paralel → satu aktif. | addendum receipt Y04, `artifacts/Y04-Y09/` |
| Y09 tanpa runtime petugas | **Ditutup pada clone:** 98/98 probe API, 4/4 browser; scope kanban, 403 penugasan, 409 transisi/versi, audit, tanpa PII. | addendum receipt Y09 |
| Indeks trigram belum diterapkan | Diterapkan lewat migrasi `20260928B` (+ `20260929A`) pada clone; count 294 ms → 105 ms → 7 ms. Belum ada di stack bersama. | receipt Y05 |
| 8 tes mock merah, `lint:oxlint` merah | **Hijau:** Playwright mock 101 pass/19 skip/0 fail; vitest 115/115; `pnpm lint:oxlint` exit 0 (script memakai `--disable-nested-config`; artefak bukti dikecualikan); typecheck lulus. | perintah di bawah |

### Perintah (sesi ini)

| Perintah | Hasil |
| --- | --- |
| `node --test` program / analytics / worker / operasional / `services/directus/test` | 167 / 107 (1 skip) / 51 / 25 / 51, semua 0 fail |
| `check_coverage.py` | exit 0 |
| `pnpm lint:oxlint` | exit 0 |
| `pnpm --dir apps/web typecheck`, `vitest run`, `playwright test --project=chromium` | lulus; 115 tes; 101 pass, 19 skip, 0 fail |

### Sisa gate (mengapa belum `done`)

1. **M3-01** (pin popup pada API nyata, dalam/luar scope): hanya bukti mock.
2. Tidak ada deploy ke stack disposable bersama; browser real-API memakai `nuxt dev`/build clone, bukan image web bersama. Uji desktop/mobile/tablet webkit belum.
3. Penyimpanan berkas hanya diuji lokal, belum MinIO/S3. QR belum dipindai kamera fisik. Rotasi kunci passport hanya unit test.
4. Skala pencarian 300k baris sintetis, bukan 5,4 juta; istilah umum ±11% baris 1,6–3 s tanpa anggaran waktu; pencarian tanpa aksen tidak didukung.
5. Lisensi tile OSM/Esri untuk produksi belum dikonfirmasi. OSS tidak terintegrasi (klaim publik dibatasi pada "NIB tercatat").
6. Cleanup dummy dan readback nol `dummy_` **sengaja tidak dijalankan** pada stack bersama; fixture paralel masih memakainya.
7. `scope_guard` global belum hijau karena perubahan paralel lintas fase.
8. Keputusan desain terbuka: pendamping melihat seluruh antrean tiket tanpa penugasan lintas kota (WhatsApp/email pemohon terlihat); risiko lock advisory rebuild lewat `pool.query` (hanya dari pembacaan kode).
