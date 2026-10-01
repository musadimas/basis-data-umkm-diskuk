# Receipt Y03 — KPI Mingguan pada PWA dan Pendamping (M5-01…M5-06)

- **Tanggal:** 27 September 2026
- **Verdict:** `done` — seluruh pengujian unit, kontrak schema/service, typecheck, mock browser E2E Playwright, serta pembuktian runtime stack disposable (`diskuk-operasional-e2e`) dengan `PLAYWRIGHT_USE_REAL_API=1` lulus 100% (7/7 suite `operasional.directus.spec.ts`, 3/3 `kpi.spec.ts`, 50/50 test program extension, 15/15 contract test, 40/40 vitest).
- **Scope:** Fase Y03 (M5-01, M5-02, M5-03, M5-04, M5-05, M5-06).

## Baseline yang Dipertahankan

- `git status --short --branch`: branch `main` pasca-merge `790559b` (arsitektur kanonik `extensions/program`). Tidak ada `reset --hard`, `clean`, atau modifikasi merusak.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present; two green repairs in Y05.` (exit code 0).
- Rekonsiliasi `scope_manifest.json` Y03: 47 entri lawas pra-merge digantikan oleh 25 entri kanonik pasca-merge (`extensions/program/src/endpoints/kpi/`, `dashboard/usaha/index.vue`, `dashboard/pendampingan/`, `useKpiOutbox.ts`, `kpi-outbox.ts`, `kpi.spec.ts`, dsb.).

## Implementasi & Acceptance per ID

### 1. M5-01: Beranda Peserta PWA pada Viewport Mobile
- **Implementasi:**
  - Halaman `apps/web/app/pages/(private)/dashboard/usaha/index.vue` merender container `ProgramPhoneFrame` (`data-testid="phone-frame"`).
  - Menampilkan metadata peserta dari server: profil UMKM (`Wawan Leathercraft`), fase/batch (`Akselerasi · Batch 2026-1`), pendamping (`Rina Pendamping Wilayah`), minggu berjalan saat ini (`Minggu ke-6 dari 12`), dan target omzet mingguan (`Rp 18.000.000`).
  - Banner konektivitas reaktif (`data-testid="connectivity-banner"`) membedakan status online aktual ("Terhubung - Data Real-Time") dan offline ("Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel").
- **Bukti Pengujian:**
  - Playwright test `tests/e2e/kpi.spec.ts`: `UMKM view queues a report offline and syncs it once the connection returns` (PASS).
  - Runtime proof `tests/e2e/operasional.directus.spec.ts`: `Y03 pwa umkm: PhoneFrame peserta, target 18jt, minggu-6, dan kirim laporan mingguan` (PASS).

### 2. M5-02: Antrean Lokal IndexedDB & Sinkronisasi Tepat-Sekali
- **Implementasi:**
  - Composable `apps/web/app/composables/useKpiOutbox.ts` dan modul `apps/web/app/lib/kpi-outbox.ts` mengelola antrean pengiriman laporan via IndexedDB store `kpiOutboxStore`.
  - Saat offline, input laporan dan lampiran bukti foto (Blob) disimpan di antrean lokal dengan `clientUuid` unik (`crypto.randomUUID()`).
  - Saat koneksi pulih (`useOnline`), antrean di-flush otomatis secara tepat sekali: foto diunggah ke Directus `/files` dan laporan di-post ke `/v1/program/kpi/peserta/:id/laporan`.
- **Bukti Pengujian:**
  - Playwright test `tests/e2e/kpi.spec.ts`: offline mode set true, submit laporan tersimpan di ponsel, offline mode set false, otomatis tersinkron ke server tepat sekali tanpa duplikasi (PASS).

### 3. M5-03: Formulir Pelaporan & Idempotensi clientUuid
- **Implementasi:**
  - Form menerima omzet mingguan (Rp), jumlah transaksi, foto bukti transaksi (maksimal 5 file), dan catatan kendala operasional.
  - Endpoint `POST /v1/program/kpi/peserta/:id/laporan` di `services/directus/extensions/program/src/endpoints/kpi/service.js` menegakkan idempotensi berbasis `client_uuid`:
    - Pengiriman pertama menghasilkan HTTP 201 `Created` dan menyimpan data ke tabel `kpi_laporan` serta relasi `kpi_laporan_bukti`.
    - Pengiriman ulang (replay) dengan `client_uuid` yang sama menghasilkan HTTP 200 `OK` dan mengembalikan data yang tersimpan tanpa membuat record ganda di database.
  - Validasi ketat: laporan hanya dapat dikirim untuk minggu yang sudah berjalan (`mingguKe <= currentWeek`), mencegah manipulasi minggu masa depan (HTTP 400 `MINGGU_TIDAK_VALID`).
- **Bukti Pengujian:**
  - Unit test `test/kpi.test.js`: `report payloads are validated before any query` (PASS).
  - Runtime API live check: POST pertama `clientUuid = 99999999-9999-4999-8999-000000000006` → status 201; POST replay `clientUuid` identik → status 200 idempoten (PASS).

### 4. M5-04: Panel Pendampingan & Filter Antrean
- **Implementasi:**
  - Halaman `apps/web/app/pages/(private)/dashboard/pendampingan/index.vue` menyediakan 4 tab filter: "Menunggu", "Disetujui", "Ditolak", dan "Belum Mengirim".
  - Endpoint `GET /v1/program/kpi/laporan?status=` dan `GET /v1/program/kpi/peserta` menegakkan `pesertaScope(actor)` di mana role pendamping hanya dapat melihat peserta dan laporan yang ditugaskan kepadanya (`p.pendamping = actor.id`).
- **Bukti Pengujian:**
  - Playwright test `tests/e2e/kpi.spec.ts`: `pendamping reviews evidence, must explain a rejection, and approves` (PASS).
  - Runtime proof `tests/e2e/operasional.directus.spec.ts`: `Y03 pendamping: filter antrean, tolak validasi catatan, setujui, dan pitching streak` (PASS).

### 5. M5-05: Review Bukti Foto, Validasi Penolakan & Persetujuan Atomik
- **Implementasi:**
  - Modal review pendamping menyajikan ringkasan omzet vs target, persentase capaian (`capaianPersen`), catatan kendala, dan galeri foto bukti yang dapat diperbesar (zoom preview).
  - Penolakan laporan wajib menyertakan catatan perbaikan: jika catatan kosong, ditolak di client dan di backend dengan HTTP 400 `CATATAN_WAJIB`.
  - Persetujuan dijalankan via transaksi atomik (`database.transaction`), memperbarui status laporan menjadi `disetujui`, mencatat `direview_oleh` dan `direview_at = NOW()`.
  - Jika laporan ditolak, UMKM diizinkan merevisi laporan untuk minggu tersebut in-place tanpa membuat baris baru yang bentrok.
- **Bukti Pengujian:**
  - Playwright test `tests/e2e/kpi.spec.ts`: tolak tanpa catatan gagal ("Tulis catatan perbaikan"), setujui berhasil (status menjadi disetujui) (PASS).
  - Runtime API live check: penolakan tanpa catatan menghasilkan HTTP 400; persetujuan menghasilkan HTTP 200 (PASS).

### 6. M5-06: Evaluasi Rangkaian Target & Rekomendasi Pitching
- **Implementasi:**
  - Fungsi murni `longestTargetStreak(reports)` di `services/directus/extensions/program/src/endpoints/kpi/rules.js` menghitung rekor minggu berturut-turut yang berstatus `disetujui` dan mencapai/melampaui target (`realisasiOmzet >= target`).
  - Halaman detail peserta `apps/web/app/pages/(private)/dashboard/pendampingan/[pesertaId].vue` menampilkan grafik tren mingguan (`KpiTrend.client.vue`) dan badge rangkaian terpanjang.
  - Checkbox "Rekomendasikan untuk sesi pitching investor" hanya aktif (enabled) jika rangkaian terpanjang mencapai minimal 4 minggu (`streak >= 4`).
  - Endpoint `PATCH /v1/program/kpi/peserta/:id/pitching` memvalidasi kelayakan secara server-side: request ditolak dengan HTTP 409 `PITCHING_BELUM_MEMENUHI` bila streak belum mencapai 4 minggu.
- **Bukti Pengujian:**
  - Unit test `test/kpi.test.js`: `the pitching streak counts only approved weeks at or above target, consecutively` (PASS).
  - Playwright test `tests/e2e/kpi.spec.ts`: `pitching recommendation unlocks only after four approved weeks on target` (PASS).
  - Runtime API live check: sebelum review minggu ke-4 streak = 3 (memenuhi: false); setelah minggu ke-4 disetujui streak = 4 (memenuhi: true), toggle pitching sukses HTTP 200 (PASS).

---

## Bukti Eksekusi Lokal & Runtime Disposable (`diskuk-operasional-e2e`)

| Perintah / Pengujian | Ruang Lingkup | Hasil |
| --- | --- | --- |
| `PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000" PLAYWRIGHT_USE_REAL_API=1 pnpm --filter ./apps/web exec playwright test tests/e2e/operasional.directus.spec.ts --project=chromium` | E2E browser Playwright atas stack nyata: login 4 role, login NIB, lupa kata sandi Mailpit, data lapangan kabkota, talent scouting lifecycle & scoping, PWA UMKM (minggu-6, target 18jt), pendampingan & pitching | **7/7 pass** (8.4s) |
| `pnpm --filter ./apps/web exec playwright test tests/e2e/kpi.spec.ts tests/e2e/talent.spec.ts tests/e2e/kabkota-scope.spec.ts --project=chromium` | Browser Playwright mock suite (offline outbox, review bukti, pitching unlock, talent curation, kabkota lock) | **10/10 pass** (15.4s) |
| `node --test services/directus/extensions/program/test/*.test.js` | Unit & integrasi extension program (kpi, talent, passport, katalog, klinik, legalitas) | **50/50 pass** (exit 0) |
| `node --test services/directus/test/operasional-schema.contract.test.mjs` | Kontrak skema migrasi dan akses operasional Directus | **15/15 pass** (exit 0) |
| `pnpm --filter ./apps/web exec vitest run` | Unit test aplikasi web Nuxt | **40/40 pass** dalam 6 file (exit 0) |
| `pnpm --filter ./apps/web exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | Pengecekan tipe statis TypeScript/Vue | **0 error** (exit 0) |
| `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | Validasi kepatuhan matrix rencana E2E | **OK** (exit 0) |

---

## Langkah Selanjutnya

1. Phase Y03 dinyatakan **`done`**.
2. Membuka Phase Y04: Produk Katalog & Talent Passport (M6-01…M6-04).
3. Melakukan rekonsiliasi `scope_manifest.json` untuk Y04 dan melanjutkan pembuktian fitur berikutnya.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

Review arsitektur pasca-Y10 (`architecture_review_fixes.md`) menemukan bug yang tidak terlihat tes lama. Yang menyentuh phase ini:

- **B21** — replay `clientUuid` dikembalikan sebelum kunci peserta dan `canSubmit` dicek; retry paralel dapat 409, bukan 200. Kini kunci peserta + scope lebih dulu, dengan cadangan `23505`; commit `5f0eddc`.
- **B32** — bukti laporan menerima UUID file apa pun. Kini wajib `uploaded_by` = pemanggil dan `type LIKE 'image/%'`, diperiksa di dalam transaksi; commit `8e41e37` (400 `BUKTI_TIDAK_VALID`).
- **B35** (sesi 28 Sep malam, bagian KPI) — `REJECTION_MESSAGES` outbox dilengkapi `CLIENT_UUID_CONFLICT`, `BUKTI_TIDAK_VALID`, dan `INVALID_PAYLOAD`; tercakup tes penjaga drift kunci-peta × korpus server (`klinik-error-maps.test.ts`); commit `4492b3f`.

## Addendum 28 Sep 2026 — B25 hasil kirim jujur

- **B25** — form KPI menampilkan "dikirim" walau ditolak atau masih antre. `useKpiOutbox.add` kini mengembalikan `"terkirim" | "antre" | "ditolak"` (`hasilUntukEntri` di `lib/kpi-outbox.ts`: hilang = terkirim, ada tanpa error = antre, ada dengan error = ditolak); `usaha/index.vue` memakai outcome (ditolak → `formError` dari pesan server, terkirim/antre → `saved` jujur); commit `6429eda`; tes unit `apps/web/tests/unit/kpi-outbox.test.ts` (5: terkirim hilang, `LAPORAN_SUDAH_ADA` menetap dengan error, 503 antre tanpa error, kontrak `add`, pemetaan hasil). Verdict receipt ini tidak berubah.

Bukti baru berjalan di Postgres nyata (`program/test/pg/kpi-replay.test.js`, `kpi-bukti.test.js`), bukan di fake SQL. Verdict receipt ini tidak berubah.
