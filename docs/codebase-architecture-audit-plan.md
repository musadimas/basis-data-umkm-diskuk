# Codebase Architecture Audit and E2E Refactoring Plan

Tanggal: 2026-09-06  
Repository: `basis-data-umkm-diskuk`  
Scope: arsitektur lintas web, Directus, worker, shared contracts, test/build dan operasi; implementasi lokal pada lookup cache dan query budget.  
Status: audit statis + unit/contract checks + build lokal; bukan verifikasi produksi.  
Eksekusi 6 September: fase 0–4 selesai untuk F1/F2/F4/F6, F3, pengukuran F5, lint/README/ADR; F7 dan keputusan paging Tabular tersisa.

Audit 19 Agustus disimpan utuh di [arsip audit sebelumnya](codebase-architecture-audit-plan-2026-08-19.md). `codebase-architecture-audit-execution-evaluation.md` mengevaluasi periode tersebut, bukan perubahan 6 September. Temuan historis tidak otomatis dianggap masih berlaku.

## Executive Summary

- Pertahankan Nuxt + Directus + PostgreSQL read model + worker. Pemisahan API dan pekerjaan berat sudah ada; belum ada bukti yang mengharuskan tambahan service atau database.
- **Diimplementasikan:** penggabungan lookup source/registry yang sedang berjalan. Uji 20 request bersamaan menghasilkan **40 → 2 pemanggilan lookup DB** pada cache kosong (95% lebih sedikit). Ini pengukuran call count dengan DB stub, bukan peningkatan latency produksi sebesar 95%.
- **Diimplementasikan:** tiga salinan `withBudgetTransaction` menjadi satu helper lokal. Statement timeout, lock timeout, read-only transaction dan fail-closed saat pemasangan budget tetap dipertahankan.
- **Diperbaiki:** satu tes worker gagal karena regex mengharuskan spasi sedangkan source memakai baris baru. Regex kini menerima whitespace; worker 14/14 lulus. Tes ini masih pemeriksaan source, bukan bukti perilaku queue.
- Risiko berikutnya: overlap polling worker, bukti integrasi yang semu, biaya query Tabular terfilter, buffering proxy, dan modul dengan tanggung jawab bercampur. Perbaikan lebih besar membutuhkan regression harness dan pengukuran tersendiri.
- Build web, typecheck dan suite lokal yang dijalankan lulus. **Lint repo kini bersih (0 error, 0 warning)**: error frontend lama diperbaiki dari tipe sumber (type alias alih-alih dictionary `unknown`, hapus asersi redundan, SAFETY pada boundary tak terhapus).
- **Dieksekusi 6 September (fase 3–4):** guard claim in-flight worker dengan harness behavioral; harness integrasi opt-in yang benar-benar request/assert (skip eksplisit tanpa target); streaming proxy dengan benchmark before/after; merge tiga count rebuild menjadi satu pass FILTER setelah parity EXPLAIN pada cluster PostgreSQL disposable; README root; sinkronisasi status ADR.

## Evidence Sources

File/boundary yang diperiksa:

- Manifests root, `apps/web`, Directus, extension dashboard/analytics, worker; Vitest, Playwright, Oxlint; Dockerfiles Directus dan worker.
- `apps/web/server/utils/directus-proxy.ts`, plugin query/MapLibre, `useAnalyticsQuery`, dashboard utama dan inventory route Tabular/Analitik/Spasial.
- Analitik `src/{index,query-service,query-compiler,records-service,metadata,profile-service,source-service,runtime-cache,aggregate-cache}.js`.
- Extensions Tabular/Infografis, shared auth; worker entry point, queue, rebuild, reconcile, exporter dan tests.
- `docs/analytics/domain-model.md`, release runbook, ADR-0002, ADR-0006, audit/evaluasi lama. Grain tetap satu usaha, geografi lokasi usaha, missing/invalid tidak diubah menjadi nol.

Metode: `rg --files`, `rg -n`, `wc -l`, pembacaan source representatif, `git status`, diff, unit/contract tests, typecheck, build dan concurrent lookup harness. Tidak membaca setiap baris repository. Tidak menjalankan browser suite, PostgreSQL/Redis/MinIO nyata, EXPLAIN, load test, migrasi, rebuild data, deployment atau restore. Kandidat performance bukan klaim insiden runtime.

Baseline worktree: hanya `.dirac-cache/` untracked; direktori tersebut tidak diubah. Tidak ada dependency baru atau perubahan schema.

## Current Architecture Map

| Boundary | Entry point / tanggung jawab | Ketergantungan |
| --- | --- | --- |
| Web | Nuxt routes, Vue components/composables, TanStack Query | `/panel/*`; MapLibre/PMTiles |
| Session/proxy | `server/middleware/01-panel-proxy.ts`, session policy, origin/cookie checks | Directus internal URL |
| Directus endpoints | Tabular, Infografis, Analitik; Analitik mendelegasikan ke services per use case | Knex/PostgreSQL, Redis aggregate cache |
| Authorization | `extensions/shared/auth.cjs` | Directus accountability, application role/admin |
| Domain contracts | `analytics-shared/contracts.cjs`, `privacy.cjs` | Dikonsumsi API dan worker |
| Analytics read model | Active/previous/candidate generation, projection, dimension rollup | Sumber usaha, semantic registry, job/outbox |
| Worker | `src/index.js` → queue/projector/rebuild/reconcile/exporter | PostgreSQL dan object storage |
| Legacy dashboard | `usaha_tabular`, `infografis_snapshot` | Publikasi/refresh terpisah dari pointer generasi Analitik |
| Delivery | Dockerfiles build extension dari source, worker process terpisah | Web, Directus, PostgreSQL, Redis, storage |
| Tests | Node tests services, Vitest, Playwright dengan mock Directus | Bukti runtime nyata terpisah dari SQL-shape/API fixtures |

Arah dependensi: UI → HTTP boundary → service → shared contract/database. Worker menghasilkan read model dan menggunakan shared contract. Snapshot legacy dan generation Analitik tetap dua kontrak publikasi; menyatukannya bukan sekadar memindahkan file.

## Risk Map

Skor 1–3: impact/blast radius makin tinggi makin luas; implementation risk makin tinggi makin berisiko diubah. Confidence menunjukkan kekuatan bukti, bukan kepastian dampak produksi.

| ID | Area | Impact | Blast radius | Implementation risk | Confidence/status |
| --- | --- | --- | --- | --- | --- |
| F1 | Overlap claim worker | 3 | 3 | 2 | High; **guard + release diterapkan**, harness behavioral lulus, belum direproduksi dengan DB |
| F2 | Integration placeholder / source tests | 3 | 3 | 2 | High; **harness opt-in nyata diterapkan**, check sumber worker masih tertinggal |
| F3 | Concurrent lookup cache | 2 | 2 | 1 | High, direproduksi dan diperbaiki lokal |
| F4 | Duplikasi query budget | 2 | 2 | 1 | High, diperbaiki lokal |
| F5 | Tabular/rebuild repeated reads | 2 | 2 | 2 | High SQL shape; **diukur pada disposable 1M baris**, count rebuild digabung; Tabular belum diubah |
| F6 | Proxy full buffering | 2 | 3 | 2 | High source; **diukur dan streaming diterapkan** dengan test behavioral |
| F7 | Modul besar / mixed concerns | 2 | 2 | 2 | High struktur; ekstraksi per slice belum dijalankan |

## Prioritized Findings

### F1 — P1: polling worker dapat claim saat claim sebelumnya belum selesai — diperbaiki

Category: Reliability/Scalability. Confidence: High pada analisis statis; perilaku kini diuji behavioral.

Evidence: `services/analytics-worker/src/index.js:59` mengecek `active.size`, lalu `await queue.claim(...)` sebelum menambahkan job ke `active`. `index.js:85` memakai `setInterval(tick, config.pollMs)` tanpa guard claim in-flight. `queue.js:40` mengubah job menjadi processing dan commit sebelum mengembalikannya.

Implemented: poll loop diekstrak ke `services/analytics-worker/src/poller.js` (`JobPoller`) dengan satu guard `claimInFlight` yang dilepas di finally. Job yang terklaim tetapi tidak dimulai (kapasitas penuh atau shutdown) dikembalikan eksplisit via `JobQueue.release` (status `queued`, attempts dikembalikan, hanya lease milik worker sendiri). `stop()` menunggu claim tertunda selesai agar job-nya dibebaskan, lalu melaporkan sisa job aktif untuk exit code. Dispatch/complete/fail tetap di `index.js`.

Validation: `test/poller.test.js` behavioral — dua tick overlap pada claim lambat hanya memicu satu claim dan semua job di-handle; job melebihi kapasitas dirilis eksplisit; stop saat claim tertunda melepaskan job tanpa memproses dan menghentikan tick berikutnya; claim gagal melepas guard; handler gagal membebaskan slot; stop timeout melaporkan job tersisa; kontrak SQL `release` (uuid cast, filter lease_owner, decrement attempts). Worker 21/21 lulus. Belum ada reproduksi dengan PostgreSQL nyata pada load.

### F2 — P1: suite hijau belum membuktikan integrasi aktual — diperbaiki untuk harness

Category: Testability. Confidence: High.

Evidence: `services/directus/extensions/directus-extension-analitik/test/integration.test.cjs:1` tidak melakukan request/assertion, baik URL environment diset maupun tidak. `services/analytics-worker/test/worker.test.js:33` mencocokkan source; baseline 13/14 gagal karena whitespace meskipun branch reconcile ada.

Implemented: placeholder diganti harness opt-in sungguhan — tanpa `ANALYTICS_INTEGRATION_BASE_URL` suite melaporkan **skip eksplisit** (27 pass + 1 skipped); dengan target diset, lima test melakukan HTTP request dan assertion nyata: anonymous ditolak 401 `AUTHENTICATION_REQUIRED`, metadata/templates/status generasi, filter zero-match menghasilkan total 0 (filter benar-benar diterapkan), paging records keyset tidak mengulang baris antar halaman, export job tak dikenal 404 `EXPORT_NOT_FOUND` untuk owner terautentikasi. Target eksplisit yang tidak tersedia **gagal** (bukan skip), dan defaultnya bukan produksi. Harness tervalidasi terhadap stack mock lokal: 5/5 pass. Check sumber-based lifecycle worker (regex reconcile) masih tertinggal — konversi behavioral bertahap menjadi pekerjaan berikutnya.

### F3 — P2: cache tidak menggabungkan lookup yang belum selesai — diperbaiki

Category: Scalability. Confidence: High, behavioral test.

Evidence: `services/directus/extensions/directus-extension-analitik/src/runtime-cache.js:8`, `source-service.js:84`. Pola sebelumnya `get → await load → set` berjalan mandiri pada setiap cache miss. Callers adalah query dan records services.

Implemented: `getOrLoad` menyimpan satu pending promise pada TTL cache yang sudah ada. Hasil sukses memakai TTL lama (source 5 detik, registry 60 detik); error membebaskan pending untuk retry; source null tidak di-cache. Clear membatalkan hak hasil lookup lama untuk mengisi cache baru.

Validation: `test/runtime-cache.test.cjs` memeriksa 20 concurrent requests, warm hit, shared rejection/retry, null, expiry, clear saat pending. Harness before/after menghasilkan 40 → 2 lookup. Optimasi ini tidak menggabungkan aggregate query mahal atau Redis cache misses.

Boundary: cache tetap per proses, satu database Directus per instance sebagaimana wiring sekarang. Jika multi-database/tenant masuk satu proses, cache harus diisolasi lebih dulu. Authorization dan isi response tidak berubah.

Rollback: revert runtime-cache/source-service dan rebuild extension; tidak ada data untuk dipulihkan.

### F4 — P2: tiga salinan transaction budget — diperbaiki

Category: Maintainability. Confidence: High.

Evidence: sebelum patch, `withBudgetTransaction` identik secara perilaku di query-service, records-service dan metadata. Kini ketiganya mengimpor `services/directus/extensions/directus-extension-analitik/src/query-budget.js:1`.

Implemented: Extract Function/Module. Urutan statement timeout → lock timeout → read-only → callback pada transaksi yang sama dipertahankan. Setup gagal menghentikan query. Fallback mock tanpa transaction tetap ada untuk kontrak test lama, bukan dukungan production database tanpa transaksi.

Validation: `test/query-budget.test.cjs` memeriksa setup order, transaction connection, hasil dan fail-closed; suite Analitik lulus. Rollback: restore ketiga helper sebagai satu patch, hapus module bersama dan rebuild.

### F5 — P2: repeated reads di Tabular dan rebuild — diukur; kandidat rebuild diimplementasikan

Category: Scalability. Confidence: High SQL shape; pengukuran pada cluster disposable 1M baris.

Evidence: `directus-extension-tabular/src/index.js:290` menghitung exact filtered count sebelum page; cursor request juga menjalankan count. `index.js:323` hanya memperingatkan deep OFFSET dan tetap mengeksekusinya. Unfiltered count sudah memakai snapshot. `analytics-worker/src/rebuild.js:774` menjalankan tiga count berurutan (total/active/archived), sebelum reconciliation menghitung sebagian invariant lagi.

Measured (PostgreSQL disposable lokal, skema dari migrasi repo, 1.000.000 baris, warm cache): rebuild tiga count berurutan 30,0+32,2+6,8 ms = **69,0 ms** vs satu pass `COUNT ... FILTER` **40,7 ms** dengan parity nilai (1.000.000/900.000/100.000). Tabular: count selektif `kota_id` 2,5 ms; nonselektif `skala` 15,2 ms; keyset page 0,3 ms; **deep OFFSET 500.000 baris 439,5 ms** (dominan). Angka hardware lokal — bukan profil produksi 5,4 juta baris.

Implemented: finalisasi rebuild kini satu query `COUNT(*) FILTER (WHERE status=...)` menggantikan tiga scan; contract response tidak berubah. Tabular **belum** diubah — reuse count menuntut kejelasan key filter/versi publikasi dan migrasi caller cursor terlebih dahulu; deep-OFFSET guard tetap hanya warn. Kandidat lanjutan didokumentasikan di bawah.

### F6 — P2: proxy mematerialisasi respons penuh — diukur; streaming diimplementasikan

Category: Scalability. Confidence: High source; benchmark membuktikan dampak.

Evidence: `apps/web/server/utils/directus-proxy.ts:234` menjalankan `await response.arrayBuffer()` sebelum `res.end`. Payload besar harus dibaca ke memori sebelum dikirim; memori meningkat dengan ukuran dan concurrency.

Measured (harness lokal: upstream fake drip 1MB/chunk, proxy `proxyToDirectus` asli vs kandidat streaming di boundary yang sama): payload 64MB dengan upstream lambat (20ms/MB) — TTFB buffered **1.397 ms** vs streamed **32 ms**; throughput tanpa drip 117 ms → 91 ms. Konkurensi 8×16MB: RSS delta buffered **+435 MB** vs streamed **+213 MB** (baseline proses 57 MB). Memori buffered tumbuh linear terhadap payload × concurrency.

Implemented: tail proxy kini `pipeline(Readable.fromWeb(response.body), res)` — backpressure native, status/header/cookie/HEAD/origin/auth tidak berubah. Kegagalan mid-stream memusnahkan socket (`res.destroy()`) agar respons sobek tidak terlihat lengkap; 502 JSON hanya bila header belum terkirim. Disconnect klien tetap membatalkan fetch upstream via AbortSignal yang sudah ada.

Validation: `tests/unit/directus-proxy.test.ts` behavioral — byte pertama tiba saat upstream masih mengirim (asersi akan gagal pada proxy buffered), body utuh, status 404 + x-request-id + cache-control diteruskan, upstream putus di tengah body tidak pernah tampak sebagai transfer lengkap, anonymous tetap 401 sebelum menyentuh upstream. 17/17 unit web lulus.

### F7 — P2: modul besar mencampur orchestration dan mapping

Category: Maintainability/Readability. Confidence: High struktur.

Evidence: `analytics-worker/src/rebuild.js` 961 baris mencakup SQL snapshot/rollup, backfill, tail replay, promotion, financial activation dan retention. `apps/web/app/pages/(private)/dashboard/index.vue` 754 baris: options (58), infografis fetch (195), map state (208), map fetch (252), points (285). Query-service baseline 782 baris berisi pemilihan source, rollup, fallback, budgeting dan response shaping. Ukuran file saja bukan alasan rewrite; campuran tanggung jawab meningkatkan biaya review.

Recommendation: satu boundary per patch—SQL rollup sebagai named constants, atau composable map/filter khusus halaman. Pertahankan transaction/promotion ownership di orchestration semula. F4 adalah extraction awal yang telah konkret; hindari generic dashboard engine, strategy classes atau repository interface untuk satu implementasi.

Validation: golden SQL/response fixtures untuk backend; URL/filter cascade/map drilldown dan screenshot desktop/mobile untuk UI. Rollback: revert extraction per slice tanpa migrasi data.

## Code Smell Inventory

| Smell | Location/evidence | Refactoring | Confidence |
| --- | --- | --- | --- |
| Temporal coupling | Worker capacity checked sebelum await claim | Serialize claim + explicit release; **fixed** dengan JobPoller | High; behavioral test |
| Misleading coverage | Integration placeholder tanpa assertion | Explicit skip + actual opt-in harness; **fixed** | High; 5/5 pada mock stack |
| Duplicate concurrent work | Cache: 40 lookup untuk 20 requests | Coalesce pending loads | High; fixed |
| Shotgun surgery | Tiga budget helpers | Extract shared function | High; fixed |
| Repeated query work | Filtered count per page, tiga rebuild counts | Rebuild: **fixed** (satu pass FILTER); Tabular: measured, kandidat menunggu keputusan paging | High SQL; runtime candidate |
| Eager buffering | Proxy arrayBuffer | Streaming + backpressure | High; **fixed** dengan benchmark |
| Mixed concerns | Rebuild/dashboard page | Extract Module/Composable per slice | High; belum dijalankan |

## Refactoring and Design Pattern Recommendations

| Target | Pressure | Recommendation | Rationale / mengapa bukan lebih berat |
| --- | --- | --- | --- |
| Budget | Kebijakan berulang | Extract Function/Module, implemented | Satu pemilik kebijakan; DI container/repository tidak diperlukan |
| Lookup | Request bersamaan | Pending promise pada existing TTL cache, implemented | Tidak perlu distributed lock untuk dua lookup kecil |
| Worker poll | Async lifecycle | Guard sederhana + behavioral tests | State-machine library belum diperlukan |
| Dashboard | State/effects padat | Composable satu use case | Pola Vue lokal cukup; tidak perlu generic engine |
| Proxy | Full buffering | Streaming adapter, conditional | Boundary sudah jelas; service download baru menambah operasi |

## Design Pattern Candidate Matrix

| Pattern | Target | Use when | Avoid when | Migration sequence |
| --- | --- | --- | --- | --- |
| Composable / Container-Presenter | Map/filter dashboard | Effects/transform punya kontrak lokal stabil | Sekadar memindahkan markup | Characterize → extract → browser regression |
| Adapter | Proxy streaming | Buffering terbukti membatasi kapasitas | Payload kecil dan memori aman | Fake-upstream contract → stream → auth/error tests |
| CQRS/read model, sudah ada | Generation/rollup | Bentuk hot reads berbeda dari CRUD | Cube tambahan tanpa pola terukur | Measure → satu rollup bila perlu → reconcile → measure |

Tidak menambahkan pattern baru pada patch ini; fungsi bersama dan promise cukup untuk optimasi yang dibuktikan.

## E2E Implementation Plan

### Phase 0 — Safety and Baseline — selesai lokal

- Catat dirty worktree, baca domain/ADR/audit lama.
- Baseline Analitik, worker, web unit; reproduksi 40 lookup untuk 20 request.
- Arsipkan audit lama dan pisahkan unit/build dari runtime proof.

Acceptance: baseline/gap dicatat; tidak ada perubahan data atau deployment; kegagalan worker ditelusuri sampai regex.

### Phase 1 — Boundary Clarification — selesai untuk budget

- Ekstrak helper lokal; migrasikan ketiga caller.
- Uji setup order, connection identity, failure propagation.

Acceptance: satu helper, response/read-only/timeout/error behavior tetap; suite Analitik lulus. Pemecahan modul lain belum selesai.

### Phase 2 — Smell Removal — selesai untuk lookup dan test repair

- Gabungkan pending source/registry lookup; pertahankan TTL/null/retry.
- Invalidasi hasil pending lama setelah clear.
- Perbaiki regex worker yang sensitif formatting.

Acceptance: 20 request → 2 lookup; warm hit tanpa lookup tambahan; retry/expiry/clear benar; worker lulus. Ini bukan klaim semua smell sudah dihapus.

### Phase 3 — Reliability and Scalability Hardening — selesai untuk F1, F2, F6; F5 terukur dengan satu kandidat diimplementasikan

1. F1: selesai — poller diekstrak, guard claim in-flight + explicit release, harness behavioral delayed-claim/shutdown/claim-rejection/stop-timeout. Reproduksi dua worker pada PostgreSQL nyata masih terbuka.
2. F2: selesai untuk harness — opt-in integration melakukan request/assert nyata (authorization, filter/total, cursor, export ownership, status generasi); skip eksplisit tanpa target; unavailable gagal. Konversi source-check worker ke behavioral masih tertinggal.
3. F5: terukur — cluster PostgreSQL disposable dibangun dari DDL migrasi repo + seed 1M baris; parity + EXPLAIN tercatat; kandidat merge count rebuild diimplementasikan setelah pengukuran. Kandidat Tabular (reuse count, deep-OFFSET) menunggu keputusan caller/paging — lihat bagian F5.
4. F6: selesai — benchmark buffered vs streaming pada boundary sama; streaming diterapkan dengan unit test behavioral (TTFB, truncation, header/cookie preservation).

Acceptance: setiap patch punya before/after behavior dan pengukuran relevan. SLO freshness/latency bukan berdasarkan unit tests. Baca konfigurasi `scripts/benchmark-analytics.mjs` sebelum menjalankannya pada target test eksplisit; jangan merekam token/cookie.

### Phase 4 — Cleanup and Documentation — selesai untuk lint, README, dan status ADR; ekstraksi F7 direncanakan

- Ekstrak satu slice F7 per patch setelah karakterisasi — belum dijalankan.
- Selesai: lint repo 0 error/0 warning; error frontend diperbaiki dari tipe sumber (type alias menggantikan dictionary `unknown`, hapus asersi redundan pada plugin, key series diketik `keyof GenderRow`), SAFETY hanya pada boundary yang tidak dapat dihapus (defineProps generic erasure, MapLibre ErrorEvent, undici body).
- Selesai: README root kini memuat peta paket, alur data, perintah per paket, integrasi opt-in, dan batas bukti.
- Selesai: baris "Keputusan target" kelima ADR disinkronkan dengan bukti kode; teks keputusan tidak diubah.
- Hapus compatibility fallback hanya setelah schema lama terbukti tidak perlu didukung — tertunda jawaban open question.

Acceptance: checks sesuai scope, browser chromium untuk UI (23 pass, 1 skip, 1 flake yang stabil saat dijalankan isolasi), ownership/test commands terdokumentasi di README. Rollback per slice dengan revert patch; tanpa migrasi destruktif.

## Validation Matrix

Commands dari root repository. Owner hasil sekarang: Codex; berikutnya executor backend/frontend/ops sesuai boundary.

| Risk | Command / evidence | Status 2026-09-06 (setelah eksekusi fase 3–4) |
| --- | --- | --- |
| Analitik behavior/cache | `pnpm --dir services/directus/extensions/directus-extension-analitik test` | 27 pass + 1 skipped eksplisit (harness integrasi opt-in) |
| Integration opt-in | `ANALYTICS_INTEGRATION_BASE_URL=... pnpm --dir ...analitik test` | Tervalidasi terhadap stack mock: 5/5 pass; target unreachable gagal (bukan skip) |
| Extension packaging | `pnpm --dir services/directus/extensions/directus-extension-analitik build` | Pass |
| Worker | `pnpm --dir services/analytics-worker test` | 21/21 pass (termasuk 7 behavioral poller) |
| Tabular | `pnpm --dir services/directus/extensions/directus-extension-tabular test` | 15/15 pass |
| Infografis | `pnpm --dir services/directus/extensions/directus-extension-infografis test` | 7/7 pass |
| Foundation | `pnpm --dir services/directus test` | 5/5 pass |
| Frontend units | `pnpm --dir apps/web test:unit` | 17/17 pass (termasuk 4 behavioral proxy streaming) |
| Types | `pnpm --dir apps/web typecheck` | Pass |
| Web packaging | `pnpm --dir apps/web build` | Pass lokal darwin-arm64, bukan deployment image proof |
| Repo lint | `pnpm lint:oxlint` | **0 error, 0 warning** (sebelumnya 22 error, 2 warning) |
| Whitespace | `git diff --check` | Pass |
| SQL plans (count/EXPLAIN) | Cluster PostgreSQL disposable dari DDL migrasi + 1M baris | Rebuild 69,0→40,7 ms (parity ✓); Tabular count 2,5–15,2 ms; deep OFFSET 439,5 ms |
| Proxy buffering | Harness upstream fake + `proxyToDirectus` asli | TTFB 1.397→32 ms (drip 64MB); RSS 8×16MB +435→+213 MB |
| UI flow | `pnpm --dir apps/web test:e2e --project=chromium` | 23 pass + 1 skipped + 1 flake (auth redirect, stabil 3/3 isolasi); default mock Directus |
| Runtime SLO/deployment/durability | Release runbook | Tidak dilakukan |

Lint error lama di `Choropleth.client.vue`, `public-dashboard.vue`, `directus.client.ts`, `BarChart.vue`, `GroupedBarChart.vue` telah diperbaiki dari tipe sumber per 6 September (lihat Phase 4); asersi yang tersisa memikul komentar SAFETY pada boundary yang tidak dapat dihapus tanpa kehilangan informasi tipe.

## Open Questions and Assumptions

- Satu database Directus per proses; pending cache belum dipakai lintas database/tenant.
- Volume aktual, distribusi filter, concurrent users, ukuran download dan p95 belum diukur. Angka 5,4 juta pada ADR/audit lama adalah konteks historis, bukan hasil hitung baru. Pengukuran disposable 1M baris pada 6 September adalah bukti *bentuk biaya*, bukan profil produksi.
- Apakah dukungan schema lama dan page/offset masih dibutuhkan? Jawaban diperlukan sebelum menghapus fallback/API compatibility (juga prasyarat kandidat Tabular F5).
- Stack disposable kini dapat dibangun lokal: cluster PostgreSQL dari DDL migrasi + stub `directus_users` + seed sintetis terbukti cukup untuk parity/EXPLAIN. Redis/MinIO disposable dan data representatif produksi belum disiapkan.
- Source/registry TTL tidak membuktikan freshness end-to-end; lag worker, Redis dan frontend harus diukur bersama.

## Non-Goals

- Tidak mengubah omzet/aset, missing vs zero, active/archive population, privacy atau izin.
- Tidak mengganti stack, menambah dependency, migrasi/rebuild produksi, deploy, commit atau push.
- Tidak menghapus reconciliation, retention, timeout atau authentication demi performance.
- Bukan exhaustive bug hunt maupun sertifikasi keamanan repository.
