# Phase 12 — Ekspor dokumen: PDF Executive Summary & Scorecard, PDF Katalog Ekspor, dan Slide PPT Canvas

## Objective, dependencies, observable result

- **Dependency:** Phase 11 (`bangunPassport`, slot `#aksi`).
- **Objective:** worker ekspor existing merender tiga tipe baru — `passport_pdf` ("Executive Summary & Business Scorecard"), `katalog_pdf` ("Katalog Ekspor Resmi"), `aggregate_pptx` (Slide PPT Canvas Analitik untuk rapat pimpinan) — dengan data dokumen passport dibekukan di request job oleh endpoint operasional; status/unduh memakai endpoint ekspor analitik yang kini terbuka untuk keempat role (kepemilikan tetap diperiksa).
- **Observable result:** Wawan menekan "Unduh Executive Summary & Business Scorecard (PDF)" → status "Diproses" → tautan unduh PDF berisi QR verifikasi; provinsi mengekspor Canvas sebagai "Slide PPT (rapat pimpinan)" → file `.pptx` 3 slide (judul, grafik native, tabel agregasi).

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-12-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| modify | `services/analytics-worker/package.json` |
| modify | `services/analytics-worker/pnpm-lock.yaml` |
| modify | `services/analytics-worker/src/export-renderer.js` |
| modify | `services/analytics-worker/src/exporter.js` |
| create | `services/analytics-worker/test/export-dokumen.test.js` |
| modify | `services/directus/extensions/directus-extension-analitik/src/exports-service.js` |
| modify | `services/directus/extensions/directus-extension-analitik/src/index.js` |
| modify | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/src/ekspor-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/passport-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/ekspor-service.test.cjs` |
| modify | `docker-compose.yml` |
| modify | `.env.example` |
| modify | `apps/web/app/types/analytics.ts` |
| modify | `apps/web/app/components/analytics/ExportDialog.vue` |
| modify | `apps/web/app/composables/useAnalyticsExports.ts` |
| modify | `apps/web/app/components/operasional/TalentPassportView.vue` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/ekspor-dokumen.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/analytics-worker/src/export-renderer.js::renderPdf`, `pdfEscape`, `renderAggregate`
- `services/analytics-worker/src/exporter.js::extensionFor`, `processExport` (cabang `profile_pdf`, blok `contentType`), `queryAggregate`
- `services/directus/extensions/directus-extension-analitik/src/exports-service.js::TYPES`, `extension`, `contentType`, `submitExport`
- `services/directus/extensions/directus-extension-analitik/src/index.js` route `/exports/:jobId`, `/exports/:jobId/download`
- `apps/web/app/types/analytics.ts::AnalyticsExportType`
- `apps/web/app/components/analytics/ExportDialog.vue::EXPORT_TYPES`
- `apps/web/app/composables/useAnalyticsExports.ts::submit`, `poll`
- `apps/web/app/lib/analytics-query.ts` nilai `visual` (`"bar"`, `"stacked"`, `"donut"`, …)

```bash
rg -n "export function renderPdf|function pdfEscape|export function renderAggregate" services/analytics-worker/src/export-renderer.js
rg -n "export function extensionFor|type === \"profile_pdf\"|application/pdf" services/analytics-worker/src/exporter.js
rg -n "const TYPES|function extension|function contentType" services/directus/extensions/directus-extension-analitik/src/exports-service.js
rg -n '"/exports/:jobId' services/directus/extensions/directus-extension-analitik/src/index.js
rg -n "export type AnalyticsExportType" apps/web/app/types/analytics.ts
rg -n "const EXPORT_TYPES" apps/web/app/components/analytics/ExportDialog.vue
rg -n "ALLOWED_VISUALS|\"donut\"" apps/web/app/lib/analytics-query.ts
```

## Current contract and final desired contract

### Current

Tipe ekspor: `aggregate_csv`, `detail_csv`, `aggregate_png`, `aggregate_pdf`, `profile_pdf`; renderer PDF satu halaman ASCII; status/unduh hanya provinsi/kabkota.

### Final

- Worker dependency: `pnpm --dir services/analytics-worker add pptxgenjs@4.0.1 uqr@0.1.3` (API terverifikasi saat perencanaan: `new PptxGenJS().addSlide().addChart(pptx.ChartType.bar, …)`, `write({ outputType: "nodebuffer" })`; `encode(text)` → `{ size, data }`).
- `export-renderer.js` menambah:
  - `teksPdf(value)` → transliterasi `—`/`–`→`-`, `×`→`x`, `≥`→`>=`, `≤`→`<=`, `•`→`-`, kutip lengkung → lurus; karakter di luar Latin-1 → `?`; escape `\`, `(`, `)`.
  - `renderDokumenPdf({ judul, subjudul, bagian: [{ judul, baris: string[] }], qr: { teks, ukuran } | null, meta })` → PDF A4 multi-halaman (Helvetica + Helvetica-Bold, `/Encoding /WinAnsiEncoding`), ~46 baris per halaman, pemecahan halaman otomatis, footer tiap halaman "Dokumen resmi DISKUK Provinsi Jawa Barat · dibuat {meta.generatedAt} · halaman n/N"; bila `qr` ada, halaman pertama menggambar QR (`encode(qr.teks, { border: 2 })`, setiap modul gelap `x y w h re` lalu `f`) di pojok kanan atas ukuran `qr.ukuran` pt.
  - `pptxChartType(visual)` → `"doughnut"` bila `visual === "donut"`, selain itu `"bar"`.
  - `renderAggregatePptx({ judul, dataAsOf, visual, groups })` (async) → Buffer PPTX: slide 1 judul + "Data per {dataAsOf}" + "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat"; slide 2 grafik native (`pptx.ChartType[pptxChartType(visual)]`; maksimal 20 kelompok teratas); slide 3 tabel "Kelompok | Jumlah | Share (%) | Kumulatif (%)" (maks. 15 baris, kumulatif dihitung berurutan).
- `exporter.js`:
  - `extensionFor`: `passport_pdf`→`pdf`, `katalog_pdf`→`pdf`, `aggregate_pptx`→`pptx`.
  - `processExport`: `aggregate_pptx` → `queryAggregate` (seperti agregat lain) → `renderAggregatePptx({ judul: request.title || "Analitik UMKM", dataAsOf: result.meta.dataAsOf, visual: request.config?.visual, groups: result.data.groups })`; `passport_pdf` → `renderDokumenPdf` dari `request.dokumen` (bagian: "Identitas Usaha", "Talent Index Score" (4 aspek + total), "Business Scorecard 5 Dimensi" (nilai per dimensi + bar teks berupa karakter `#` sebanyak `Math.round(nilai / 10)`), "Lencana Akreditasi & Kepatuhan", "Verifikasi Keaslian" (URL verifikasi, sidik jari kunci, potongan 24 char pertama signature)) dengan `qr: { teks: request.dokumen.verifikasiUrl, ukuran: 120 }`; `katalog_pdf` → `renderDokumenPdf` bagian per produk layak ("{nama}" + kategori, harga retail/grosir, MOQ, bahan baku lokal %, spesifikasi) dengan QR yang sama; produk kosong → bagian "Belum ada produk tayang di katalog.".
  - `contentType` artefak: `pptx` → `application/vnd.openxmlformats-officedocument.presentationml.presentation`; pdf/png/csv seperti sekarang.
- Analitik `exports-service.js`: `TYPES` tambah `aggregate_pptx`; `extension(type)` → `"pptx"` untuk tipe berakhiran `pptx`; `contentType(type)` → MIME pptx untuk tipe itu; `aggregate_pptx` mengikuti jalur job asinkron (bukan cabang sinkron `aggregate_csv`); `passport_pdf`/`katalog_pdf` **tidak** ditambahkan ke `TYPES` (hanya dibuat oleh endpoint operasional).
- Analitik `index.js`: route `GET /exports/:jobId` dan `GET /exports/:jobId/download` memakai roles `ALL_ROLES` (kepemilikan owner tetap); `POST /exports` tetap `DATA_ROLES`.
- Operasional:
  - `passport-service.js` menambah `verifikasiUrl` absolut = `(process.env.PUBLIC_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "") + verifikasiPath` pada hasil `bangunPassport`.
  - `ekspor-service.js::ajukanEksporPassport(database, body, operator)` → `jenis` `passport_pdf|katalog_pdf` (selain itu 400); umkm → talenta milik usaha sendiri (abaikan `talentaId`); provinsi/kabkota → `talentaId` wajib UUID dan dalam cakupan (`getPassportTalenta` rules); pendamping → 403; bangun passport; `INSERT INTO analitik_job(job_type,dedupe_key,status,owner,request,schema_version,masking_version,export_type,max_attempts) VALUES ('export', 'export:'||owner||':'||gen_random_uuid(), 'queued', owner, request, 1, 1, jenis, 3)` dengan `request = { dokumen: { usaha, skor, radar, badges, showroom, payload, signature, publicKey: { sidikJari }, verifikasiUrl } }`; response 202 `{ meta: { status: "processing" }, data: { jobId, status: "queued", type: jenis } }`.
  - Route `POST /passport/ekspor` (ALL_ROLES; otorisasi di service).
- Env: `docker-compose.yml` directus `PUBLIC_WEB_URL: ${PUBLIC_WEB_URL:-http://127.0.0.1:3000}`; `.env.example` `PUBLIC_WEB_URL=http://127.0.0.1:3000`.
- Web:
  - `AnalyticsExportType` tambah `"aggregate_pptx" | "passport_pdf" | "katalog_pdf"`.
  - `ExportDialog.vue` `EXPORT_TYPES` tambah `{ value: "aggregate_pptx", label: "Slide PPT (rapat pimpinan)" }`.
  - `useAnalyticsExports.ts` tambah `submitDokumen(jenis: "passport_pdf" | "katalog_pdf", talentaId?: string)` → `POST /panel/operasional/passport/ekspor` lalu `poll(jobId)` existing.
  - `TalentPassportView.vue` slot `#aksi` diisi default: tombol "Unduh Executive Summary & Business Scorecard (PDF)" dan "Unduh Katalog Ekspor Resmi (PDF)" → `submitDokumen`; status "Menyiapkan dokumen…" / tautan "Unduh {nama berkas}" (`downloadUrl`) / "Ekspor gagal. Silakan coba lagi.".

## Ordered edits

1. Tambah dependency worker (lockfile ikut berubah).
2. `export-renderer.js` + `exporter.js`; test `export-dokumen.test.js`: (a) `renderDokumenPdf` dengan 120 baris → header `%PDF-1.4`, jumlah objek `/Type /Page` = 3, trailer valid, teks "Katalog Ekspor Resmi" ada; (b) `teksPdf("Kulit — 28 × 20 cm")` → `"Kulit - 28 x 20 cm"`; (c) QR: konten halaman pertama memuat operator ` re` dan `f`; (d) `renderAggregatePptx` → buffer diawali `PK` (zip) dan memuat nama entri `ppt/slides/slide3.xml` (nama berkas zip tidak terkompresi sehingga dapat dicari sebagai string pada buffer); `pptxChartType("donut") === "doughnut"`, `pptxChartType("stacked") === "bar"`; (e) `processExport` dengan fake client + fake store untuk `passport_pdf` menulis kunci `.pdf` dan contentType pdf; untuk `aggregate_pptx` (fake `queryAggregate` via `request.result`) menulis `.pptx` dan contentType pptx; tipe tak dikenal tetap `EXPORT_TYPE`.
3. Analitik `exports-service.js`, `index.js` + test (`aggregate_pptx` diterima 202; `passport_pdf` via `/exports` → 400 `EXPORT_TYPE_INVALID`; umkm `GET /exports/:jobId` milik sendiri → 200, milik orang lain → 404; umkm `POST /exports` → 403).
4. Operasional `passport-service.js` (`verifikasiUrl`), `ekspor-service.js`, route + test (umkm tanpa passport → 404; kabkota talenta kota lain → 404; pendamping → 403; jenis tidak valid → 400; request job memuat `dokumen.verifikasiUrl` absolut dan **tidak** memuat NIK/telepon).
5. Env compose/.env.example.
6. Web: tipe, `ExportDialog.vue`, `useAnalyticsExports.ts`, `TalentPassportView.vue`.
7. Mock fixture: `POST /panel/operasional/passport/ekspor` → 202 job `66666666-6666-4666-8666-000000000001`; `GET /panel/analitik/exports/66666666-…` → `completed` dengan `downloadUrl` `/panel/analitik/exports/66666666-…/download?expires=1&sig=x`; download → body `%PDF-1.4` `application/pdf`; `POST /panel/analitik/exports` dengan `exportType: "aggregate_pptx"` → 202 lalu completed.
8. `ekspor-dokumen.spec.ts`: umkm passport → klik unduh Executive Summary → tautan unduh muncul → event download `.pdf`; provinsi Canvas → buka dialog ekspor → opsi "Slide PPT (rapat pimpinan)" ada → submit → request body `exportType: "aggregate_pptx"`; screenshot `export-dialog.png`.
9. `operasional.directus.spec.ts`: Wawan unduh Executive Summary → file diunduh, 4 byte awal `%PDF`; provinsi ekspor PPT → file diunduh, 2 byte awal `PK`.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Passport berubah setelah job dibuat → dokumen memakai data saat pengajuan (dibekukan di request).
- Artefak kedaluwarsa 24 jam → status `expired`, unduh 410 (perilaku existing).
- Karakter non-Latin-1 pada nama produk → `?` (dicatat; tidak ada font embed).
- Worker gagal render → job `dead` → UI "Ekspor gagal. Silakan coba lagi.".
- Canvas dengan >20 kelompok → grafik PPT 20 teratas, tabel 15 teratas (dinyatakan di slide: "Menampilkan {n} kelompok teratas").
- Kabkota mengekspor PPT → filter kota sudah disuntik di `/exports` (Phase 3).

## Validation commands

```bash
pnpm --dir services/analytics-worker install --frozen-lockfile
pnpm --dir services/analytics-worker test
pnpm --dir services/directus/extensions/directus-extension-analitik test
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm lint:oxlint
docker compose --env-file .env.example config --quiet
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/types/analytics.ts app/components/analytics/ExportDialog.vue app/composables/useAnalyticsExports.ts app/components/operasional/TalentPassportView.vue)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; worker test ≥ baseline 21 + test baru; screenshot `export-dialog.png`.

## Runtime/worker proof and unproven boundary

Disposable stack (image worker di-build ulang dengan dependency baru) + seed; jalankan `operasional.directus.spec.ts`; simpan PDF/PPTX hasil unduh ke `/tmp/operasional-evidence/phase-12/` dan buka manual untuk inspeksi visual (catat hasil). Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: tampilan PDF/PPTX di PowerPoint/Keynote/LibreOffice, keterbacaan QR tercetak oleh kamera ponsel.

## No-advance condition

Jangan lanjut bila artefak PDF/PPTX tidak valid struktural pada unit test atau UMKM dapat mengunduh ekspor milik user lain.

## Required failure probes

- Unit: `passport_pdf` lewat `/analitik/exports` → 400.
- Unit: umkm status ekspor milik orang lain → 404.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-12-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 12
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit (dependency worker ikut kembali). Handoff: selesai untuk dokumen; Phase 13 independen terhadap ekspor.
