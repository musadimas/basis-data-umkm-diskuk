# Receipt Y02 — Tabular dan Talent Scouting (M4-01…M4-04)

- **Tanggal:** 27 September 2026
- **Verdict:** `done` — seluruh pengujian unit, kontrak schema/service, typecheck, mock browser E2E Playwright, serta pembuktian runtime stack disposable (`diskuk-operasional-e2e`) dengan `PLAYWRIGHT_USE_REAL_API=1` lulus 100% (5/5 suite `operasional.directus.spec.ts`, 2/2 `kabkota-scope.spec.ts`, 50/50 test program extension, 15/15 contract test, 40/40 vitest).
- **Scope:** Fase Y02 (M4-01, M4-02, M4-03, M4-04).

## Baseline yang dipertahankan

- `git status --short --branch`: branch `main` pasca-merge `790559b` (arsitektur kanonik `extensions/program`). Tidak ada `reset --hard`, `clean`, atau modifikasi merusak.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present; two green repairs in Y05.` (exit code 0).
- Rekonsiliasi `scope_manifest.json` Y02: 48 entri pra-merge (merujuk ke extension legacy `directus-extension-operasional` dan rute lawas `dashboard/talenta/`) digantikan oleh 25 entri kanonik pasca-merge (`extensions/program/src/endpoints/talent/`, `dashboard/talent/`, `ScoreBars.vue`, `talent.spec.ts`, dsb.).

## Implementasi & Acceptance per ID

### 1. M4-01: Aksi Tabular & Penegakan Isolasi Wilayah Kab/Kota
- **Implementasi:**
  - Baris `TabularData.vue` menyediakan aksi dropdown: "Lihat Profil UMKM" (`/dashboard/usaha/:id`), "Ajukan ke Talent Scouting" (`/dashboard/talent/ajukan/:id`), dan pemulihan aksi "Ubah Data Lapangan" (`/dashboard/data-lapangan/:id`).
  - Backend `services/directus/extensions/program/src/lib/access.js` mengimplementasikan helper otorisasi `assertTalentAccess(actor)` dan penegakan isolasi wilayah `assertUsahaInActorScope(actor, usaha)`.
  - Backend `services/directus/extensions/program/src/endpoints/talent/service.js` menegakkan bahwa petugas kab/kota hanya dapat membaca dan mengajukan usaha di wilayah penugasannya (`actor.kotaScope === usaha.kotaId`).
  - Request lintas kabupaten/kota atau akun kab/kota tanpa penugasan wilayah (`kota_scope IS NULL`) langsung ditolak dengan HTTP 403 `FORBIDDEN` / `KOTA_NOT_ASSIGNED`.
- **Bukti Pengujian:**
  - Unit/integration test `test/talent.test.js`: `kabkota access is scoped to assigned kota; out-of-scope usaha is rejected with 403` (PASS).
  - Playwright test `talent.spec.ts`: `tabular rows link to the talent submission form and detail profile` (PASS) & `out-of-scope or inaccessible business shows error alert` (PASS).

### 2. M4-02: Form Nominasi, Prefill SIDT Read-Only & Penyamaran NIK
- **Implementasi:**
  - Data profil SIDT (nama usaha, NIB, omzet, alamat, kontak) diambil secara server-side dan disajikan read-only di form `ajukan/[usahaId].vue`.
  - NIK pemilik usaha disamarkan (`maskNik`) dan tidak pernah dikirim dalam bentuk mentah (plaintext) ke browser maupun dicatat dalam log client.
  - Petugas mengisi field operasional Jawa Barat: kapasitas produksi bulanan dan satuan, kesiapan legalitas (Halal, PIRT, BPOM, HKI), literasi digital (QRIS, pembukuan digital), serta surat komitmen.
  - Endpoint `createPengajuan` dan `updatePengajuan` di `service.js` hanya mengizinkan modifikasi field operasional Jawa Barat dan menolak/mengabaikan mutasi pada field SIDT (nama, NIB, omzet tidak dapat dioverwrite via payload POST/PATCH).
- **Bukti Pengujian:**
  - Unit test `test/talent.test.js`: `submission does not alter read-only SIDT fields via POST/PATCH` (PASS).
  - Playwright test `talent.spec.ts`: `nomination shows masked SIDT data, saves Jabar fields and scores on the server` (PASS).

### 3. M4-03: Formula Deterministik Talent Index (4 × 25%) & Rekomendasi
- **Implementasi:**
  - Formula perhitungan di `services/directus/extensions/program/src/endpoints/talent/scoring.js` menghitung 4 aspek dengan bobot masing-masing 25%:
    1. Finansial (25%): Omzet bulanan (skala tier) + pembukuan digital + rekening terpisah.
    2. Pasar & Produk (25%): Kapasitas produksi + jangkauan pemasaran (ecommerce, medsos bisnis, offtaker).
    3. Legalitas (25%): NIB, sertifikat Halal, izin edar (PIRT/BPOM), HKI merek, SNI.
    4. Pengelolaan / SDM (25%): Jumlah tenaga kerja + SOP tertulis + literasi QRIS/digital.
  - Skor total 0–100 deterministik dengan handling data kosong/null yang aman (tanpa NaN).
  - Fungsi `rekomendasiOf(skorTotal)` menghasilkan klasifikasi konsisten:
    - `total >= 75` → `"Direkomendasikan Masuk Talent Pool"`
    - `total >= 60` → `"Dipertimbangkan"`
    - `total < 60` → `"Belum Direkomendasikan"`
  - Komponen `ScoreBars.vue` menampilkan breakdown skor 4 pilar beserta label status rekomendasi dengan atribut `data-testid="skor-rekomendasi"`.
- **Bukti Pengujian:**
  - Unit test `test/scoring.test.js`:
    - `the four weights are 25% each and sum to 1` (PASS)
    - `rekomendasi thresholds match domain rules` (PASS)
    - `an empty submission scores zero and is tagged with the placeholder rubric` (PASS)
    - `a complete submission scores 100 on every dimension` (PASS)
    - `garbage inputs never produce NaN or out-of-range scores` (PASS)

### 4. M4-04: Transaksi Atomik Berita Acara (BA) & Otoritas Provinsi
- **Implementasi:**
  - Penerbitan Berita Acara (`createBeritaAcara` di `service.js`) dijalankan di dalam database transaction atomik (`database.transaction(...)`).
  - Otorisasi dibatasi secara ketat: hanya role `provinsi` atau Directus `admin` yang dapat menerbitkan BA via helper `assertBeritaAcaraAccess(actor)`. Role `kabkota`, `pendamping`, atau `umkm` ditolak dengan HTTP 403 `FORBIDDEN`.
  - Transaksi memperbarui batch pengajuan menjadi `status = 'disetujui'` dan secara otomatis memperbarui status usaha terkait menjadi `talent_status = 'talent_pool'` (selaras dengan modul hilir Talent Passport).
  - Idempotency & integritas batch: pengajuan yang belum dinilai atau yang sudah pernah disetujui ditolak dengan HTTP 409 `PENGATURAN_SUDAH_DISETUJUI`, mencegah duplikasi penerbitan BA.
  - Di frontend Nuxt (`kurasi.vue`), tombol "Terbitkan Berita Acara & Masukkan ke Talent Pool" serta checkbox seleksi disembunyikan jika login sebagai petugas non-provinsi (`isProvinsi`).
- **Bukti Pengujian:**
  - Unit test `test/talent.test.js`:
    - `only provinsi or admin can issue a Berita Acara; kabkota and pendamping are rejected with 403` (PASS)
    - `duplicate Berita Acara on non-scored or already-approved submissions returns 409` (PASS)
  - Playwright test `talent.spec.ts`:
    - `curates submissions with a Berita Acara for provinsi, while kabkota cannot issue BA` (PASS)
    - `kabkota role cannot see or use Berita Acara issuance button` (PASS)

---

## Bukti Eksekusi Lokal (Perintah + Exit Code)

| Perintah | Ruang Lingkup | Hasil |
| --- | --- | --- |
| `node --test services/directus/extensions/program/test/*.test.js` | Unit & integrasi extension program (talent scoring, service, access, dll.) | **50/50 pass** (exit 0) |
| `node --test services/directus/test/operasional-schema.contract.test.mjs` | Kontrak skema migrasi dan akses operasional Directus | **15/15 pass** (exit 0) |
| `pnpm --filter ./apps/web exec vitest run` | Unit test aplikasi web Nuxt | **40/40 pass** dalam 6 file (exit 0) |
| `pnpm --filter ./apps/web exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | Pengecekan tipe statis TypeScript/Vue | **0 error** (exit 0) |
| `pnpm --filter ./apps/web exec playwright test tests/e2e/talent.spec.ts tests/e2e/kabkota-scope.spec.ts tests/e2e/tabular.spec.ts tests/e2e/data-lapangan.spec.ts --project=chromium` | Pengujian E2E browser Playwright (mock server) | **11/11 pass** (exit 0) |
| `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | Validasi kepatuhan matrix rencana E2E | **OK** (exit 0) |

---

## Bukti Eksekusi Runtime Disposable (`diskuk-operasional-e2e`)

| Perintah / Pengujian | Ruang Lingkup | Hasil |
| --- | --- | --- |
| `PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000" PLAYWRIGHT_USE_REAL_API=1 pnpm --filter ./apps/web exec playwright test tests/e2e/operasional.directus.spec.ts --project=chromium` | E2E browser Playwright atas stack nyata: login role, ubah data lapangan, ajukan usaha Subang, hitung skor deterministik, isolasi tombol BA Kabkota, kurasi BA Provinsi | **5/5 pass** (8.2s) |
| `PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000" PLAYWRIGHT_USE_REAL_API=1 pnpm --filter ./apps/web exec playwright test tests/e2e/kabkota-scope.spec.ts --project=chromium` | Isolasi wilayah kab/kota (kunci infografis & tabular disabled) | **2/2 pass** (3.4s) |
| Runtime API Scoping & Otorisasi (`/v1/program/talent/usaha/:id`) | Akses usaha Subang (`kota_id=1`) oleh Kabkota Subang → 200; akses usaha Garut (`kota_id=3`) → 403 `FORBIDDEN` | **Terverifikasi** |
| Runtime API Berita Acara (`/v1/program/talent/berita-acara`) | Penerbitan BA oleh Kabkota → 403 `FORBIDDEN`; penerbitan BA oleh Provinsi → 201 (`BA-TS/2026/0001`), `usaha.talent_status` otomatis menjadi `talent_pool`; duplikasi penerbitan BA → 409 | **Terverifikasi** |
| Data Read Model (`scripts/refresh-dashboard-snapshots.sql`) | Populate `usaha_tabular` (8 baris usaha dummy Jabar) | **8 baris terisi** |

---

## Langkah Selanjutnya

1. Phase Y02 dinyatakan **`done`**.
2. Membuka Phase Y03: Program Akselerasi & Monitoring KPI Mingguan (M5-01…M5-04).
3. Melakukan rekonsiliasi `scope_manifest.json` untuk Y03 dan mengimplementasikan alur pelaporan mingguan UMKM, verifikasi pendamping, serta rekapitulasi KPI.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

Review arsitektur pasca-Y10 (`architecture_review_fixes.md`) menemukan bug yang tidak terlihat tes lama. Yang menyentuh phase ini:

- **B04** (kabkota tanpa `kota_scope` melihat semua pengajuan; `GET /berita-acara` tanpa gate peran) dan **B05** (`assertUsahaInActorScope` meloloskan usaha tanpa kota): selesai di working tree pelaksana A, belum di-commit — lihat §2.0.
- **B22** (tanggal bisnis dihitung UTC): default tanggal Berita Acara dan trigger snapshot kini memakai `(now() AT TIME ZONE 'Asia/Jakarta')::date` lewat migrasi `20260928D`, commit `927948b`.

Verdict receipt ini tidak berubah: addendum ini mencatat patch, bukan bukti runtime baru.

