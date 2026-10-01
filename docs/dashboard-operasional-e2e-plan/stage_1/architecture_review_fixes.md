# Stage 1: Daftar Perbaikan dari Review Arsitektur

> **Tanggal:** 2026-09-28
> **Cakupan:** semua kode yang disentuh fase Y01–Y10 (`docs/dashboard-operasional-e2e-plan/stage_1/`).
> **Status (diperbarui 2026-09-28, malam, sesi migrasi program):** Gelombang 0 dan 1 selesai. Gelombang 2 (P1) backend selesai — B09, B11, B13, B14, B15, B17, B18, B19, B20, B21, B22 di-commit. P2 backend selesai — B24, B26 (server/worker), B27, B29, B30, B32, B36, B08 (request job bebas PII), B02(c) (`20260928E`), plus temuan trigger `analitik_job`. Pelaksana A sudah commit + push B04–B07, B23, `requireRole`, dan §2.6 (`0e83667`…`e0e5533`; working tree bersih, `main` = `origin/main`). Lane P2 web tuntas semua — B31, B33, B16, B08-web, B34, B35, B38 (`54279e0`…`fb37f22`; label B38 penuh ikut rekomendasi K21 atas persetujuan pengguna sesi ini). Gelombang 3 berjalan: **kandidat 01 tahap 1 mendarat** — module `analytics-shared/cakupan.cjs` + adapter `terjaga`/`publik` + tes manifest 79 route + matriks pg (`7e774f6`; ADR-009 → Accepted; rute lama di `LEGACY_BELUM_MIGRASI`, migrasi bertahap). **Sesi ini (belum push, ahead 36): B25 ✅, 01 langkah 2 ✅, flake fieldVariants ✅, dan seluruh bundle program (46 route: peta, talent, KPI, katalog, passport, kegiatan, klinik) ✅ dimigrasi ke adapter.** **Tersisa: sisa §2.5 (tertahan agen paralel) dan gelombang 3+ (01 analytics/operasional → 03 → 02 → 06/04 → 05)** — lihat §2.0b.
> **Sumber:** review arsitektur (skill `improve-codebase-architecture`), lalu satu penjelajahan mendalam per kandidat. Laporan visual (HTML, sementara, bisa hilang): `/private/tmp/claude-501/-Users-fabhiantomaoludyo-development-basis-data-umkm-diskuk/187b5b5d-1cdf-4bb1-b21f-7728b52da58a/scratchpad/architecture-review-20260928-042627.html`
> **Nomor baris:** mengacu ke working tree 2026-09-28, termasuk perubahan yang belum di-commit. Cek ulang sebelum mem-patch.

Kosakata arsitektur mengikuti skill `codebase-design`: **module**, **interface**, **implementation**, **depth** (deep/shallow), **seam**, **adapter**, **leverage**, dan **locality**. Istilah domain mengikuti brief (usaha, kabkota, pendamping, peserta, BA, passport, kurasi, LOI, pengingat, klinik).

### Singkatan path

| Singkatan | Path |
|---|---|
| `program/…`, `klinik/…`, `katalog/…`, `talent/…`, `kpi/…`, `kegiatan/…`, `passport/…`, `legalitas/…` | `services/directus/extensions/program/src/endpoints/…` |
| `lib/…` (program) | `services/directus/extensions/program/src/lib/…` |
| `analysis/…`, `tabular/…`, `tabular-filter.js` | `services/directus/extensions/analytics/src/endpoints/…` atau `…/analytics/src/lib/utils/…` |
| `shared/…` | `services/directus/extensions/shared/…` |
| `analytics-shared/…`, `contracts.cjs`, `privacy.cjs` | `services/directus/analytics-shared/…` |
| `exporter.js`, `export-renderer.js`, `queue.js` | `services/analytics-worker/src/…` |
| `ROLES.ts`, `NAVIGATION.ts`, `PROGRAM.ts`, `*.vue`, `lib/*.ts` (web) | `apps/web/app/…` |
| `mock-*.mjs`, `*-data.mjs`, `*.spec.ts` | `apps/web/tests/fixtures/…`, `apps/web/tests/e2e/…` |
| migrasi `20260926S`, `J`, `K`, … | `services/directus/migrations/…` |

### Tanda verifikasi

- ✓ dibaca di kode dan/atau dibuktikan jalan (Postgres disposable, `pdftotext`, Playwright).
- ◐ direproduksi terisolasi (mis. `node` terhadap rules, tanpa stack).
- ○ disimpulkan dari kode (race atau latent) dan belum dijalankan.

---

## 1. Ringkasan

**Tidak semua bug terlihat oleh tes yang ada.** Tes program memalsukan database dengan pencocokan potongan SQL, dan mock Playwright menjawab rute yang tidak dikenalnya dengan `200 {data:{}}`. Akibatnya suite tetap hijau walaupun ada kebocoran scope, fitur yang selalu 400/500, dan drift antar-salinan.

Akarnya sama di keenam kandidat: sebuah pengetahuan tidak punya module sendiri, sehingga ditulis ulang di tiap pemanggil.

| # | Kandidat | Pengetahuan yang sekarang tersebar | Module deep yang diusulkan | Kekuatan | Bug yang ditutup |
|---|---|---|---|---|---|
| 01 | **Cakupan Pemanggil** | Siapa pemanggil dan apa yang boleh ia lihat: 4 cara memuat aktor, 3 sumber kota, gate opt-in | `analytics-shared/cakupan.cjs` + adapter router `terjaga({peran})` / `publik()` + tes manifest route | Strong | B01, B03–B06, B16, B21 (replay), B23, B36 |
| 02 | **Outbox Notifikasi** | Antrean pesan: dua outbox (klinik deep, pengingat shallow) | `lib/outbox/` + adapter WhatsApp/Email/memory; `klinik_notifikasi` → `notifikasi_outbox` | Strong | B14, B15, B17, B18, B31 |
| 03 | **Compiler analitik shared** | Kompilasi query + scope + budget: salinan di worker yang menyimpang 10 hal | `analytics-shared/query-compiler.cjs`, `compileAggregate(config, {registry, operator})` | Strong | B02, B20, B29, B30 |
| 04 | **Use case + Postgres ter-migrasi** | Perilaku DB (transaksi, lock, unique, rollback) yang tidak pernah dijalankan tes | Harness DB template per file tes + `create<Fitur>({db, files, notifier, clock})` | Worth exploring (harness: prasyarat) | Tes jujur untuk B11–B13, B21, B22, B24 |
| 05 | **Dokumen** | Serializer PDF: 4 buatan tangan + 1 salinan, encoding salah | `analytics-shared/dokumen.cjs`, `renderDokumen(model) → Buffer` | Worth exploring | B26–B28, B38 |
| 06 | **Kontrak klinik satu sumber** | Aturan klinik ditulis 4× (server, `.vue`, konstanta, mock) | Rules murni backend, DTO dengan field turunan, mock mengimpor rules, `lib/klinik.ts` | Worth exploring | B16, B34, B35, B38–B40, 8 tes mock merah |

**Urutan yang direkomendasikan** (detail di §3):
1. Perbaikan P0 sebagai patch kecil.
2. Harness Postgres (04), karena kandidat lain butuh tes yang jujur.
3. Kandidat 01 → 03 → 02 → 06 → 05. Ekstraksi use case (04) dikerjakan bersamaan, fitur demi fitur.

---

## 2. Perbaikan segera (bug hidup)

Setiap bug bisa di-patch sebelum deepening. Patch-nya kecil, dan tes regresinya ditulis **merah dulu**. Kolom § menunjuk bagian detail di lampiran kandidat.

### 2.0 Status eksekusi gelombang 0 (dikerjakan paralel oleh dua pelaksana)

Diperbarui 2026-09-28 (sore, kedua). Tujuannya supaya pelaksana lain tidak mengerjakan ulang item yang sudah selesai. Semua item gelombang 0 sudah di-commit — pelaksana A meng-commit berkasnya di `0e83667`…`e0e5533` (lihat §2.0b).

| Item | Status | Di mana |
|---|---|---|
| B01 | ✅ selesai, ikut commit `af1932c` | `klinik/service.js` (`dalam_cakupan`), `klinik.test.js` |
| B02 | ✅ selesai, commit `5088ac5`; (c) migrasi `20260928E` `7fec80c` | `exports-service.js`, `exporter.js`, `migrations/20260928E-batalkan-job-export-lama.js` |
| B03 | ✅ endpoint dihapus (K5), commit `a7cd262`; tes kartu peta dipindah ke `peta.test.js` | `program/package.json`, `oas.yaml`, `peta.test.js` |
| B04 | ✅ selesai, commit `8e0607c` (pelaksana A) | `talent/service.js`, `talent.test.js` (peran dibaca dari baris akun, bukan dari sesi) |
| B05 | ✅ selesai, commit `8e0607c` | `lib/access.js`, `test/access.test.js` |
| B06 | ✅ selesai, commit `0e83667`. Migrasi diuji up/down di Postgres disposable di dalam transaksi yang di-rollback | `lib/access.js` (`loadActor` fail-closed, 401 bila baris akun tidak ada), `migrations/20260928A-app-role-tanpa-default.js`, `operasional-schema.contract.test.mjs` |
| B07 | ✅ selesai, commit `aabd4ec` | `kegiatan/rules.js`, `kegiatan/index.js`, `kegiatan/adapter.js`, `lib/utils/http.js` (`escapeHtml`), `kegiatan.test.js` |
| B23 | ✅ selesai, commit `9729e42`. `dashboardRedirect`/`appRoleBadge` di `ROLES.ts`; akun tanpa `app_role` sah → `/sign-in?error=peran`, tanpa menu dan tanpa badge Provinsi; `DEFAULT_APP_ROLE` dihapus | `constants/ROLES.ts`, `middleware/auth.global.ts`, `nav/AppSidebar.vue`, `nav/User.vue`, `dashboard/akun/index.vue`, `auth/SignInForm.vue`, `tests/unit/auth-guard.test.ts` |
| Hapus `requireRole` (§2.5) | ✅ selesai, commit `0e83667`. `requireRole` dan `requireApplicationUser` dihapus dari `shared/auth.cjs` | `extensions/shared/auth.cjs`, `operasional-schema.contract.test.mjs` |
| §2.6 tes mock | ✅ selesai, commit `e0e5533`. Suite mock chromium saat itu 88 lulus / 16 skip / 0 gagal; tiga spec target hijau 3× dari cache dingin. M11–M15 selesai; `asRole` di `produk-passport.spec.ts` ternyata menyetel cookie di port yang salah (semua spec berjalan sebagai provinsi), sudah diperbaiki | `tests/fixtures/{operator-fixtures,analytics-data}.mjs` (baru), `mock-directus*.mjs`, `akun`/`infografis`/`produk-passport.spec.ts`, `nuxt.config.ts` |
| Sisa flake | ⚠️ belum. `klinik-ui.spec.ts` gagal ±3/20: SSR 500 `$setup.fieldVariants is not a function` (`konsultasi.vue:444`), kemungkinan impor melingkar `ui/field/Field.vue` ↔ `index.ts` di Vite dev. Tetap gagal dengan berkas HEAD dan tanpa `optimizeDeps`, jadi bukan akibat §2.6. Usulan: `Field.vue` mengimpor `fieldVariants` dari berkas terpisah | `app/components/ui/field/` |
| B10 + B12 | ✅ commit `d076303` (pelaksana lain) | `katalog/service.js` |

**Pembagian berkas (akhir):** pelaksana A mengerjakan web/tests (§2.6, B23) plus berkas backend `program` untuk B04–B07 (`talent/service.js`, `lib/access.js`, `kegiatan/*`, `lib/utils/http.js`) dan `shared/auth.cjs`; pelaksana B mengerjakan hapus `/legalitas`, B10+B12, seluruh P1/P2 backend analytics/worker, lane web (B26-web, B28, B39, B40), higiene §2.5, dan B02(c). Keduanya sudah commit; semua berkas sekarang bebas disentuh.

### 2.0b Riwayat commit dan titik mulai berikutnya

Untuk agen berikutnya: **jangan mulai dari nol.** Urutan commit di `main`:

| Commit | Isi |
|---|---|
| `af1932c` | checkpoint stage_1: seluruh bukti Y01–Y10, ADR-008/009, `CONTEXT.md`, dokumen ini |
| `5088ac5` | B02 — `submitExport` menolak config ter-scope >8 filter; worker tidak lagi memotong filter |
| `a7cd262` | B03 — hapus `/legalitas`; tes kartu peta (NIK + sertifikat kedaluwarsa) dipindah ke `peta.test.js` |
| `d076303` | B10+B12 — validasi tipe/ukuran foto katalog di server + proxy `asset.file.type` & nosniff |
| `5e337cd` | Gelombang 1 — harness Postgres: `scripts/test-db-template.sh`, `test-support/{pg-harness,directus-fakes,fixtures}.mjs`, smoke `test/pg`, script `test:pg` |
| `bf3e907` | B11 — edit produk tayang: pindahkan foto sebelum validasi + pengecualian foto milik produk |
| `236be3f` | B13 — hapus `ESCAPE` ganda, arm pemilik `= ANY(ARRAY(...))`, migrasi index trigram `20260928B` |
| `b448646` | B19 — ekspor Tabular ditulis `processing`, klaim worker melewatinya, cleanup TTL + status `expired` (`20260928C`) |
| `16e4856` | B20 — worker menghormati filter `status_usaha` eksplisit |
| `5f0eddc` | B21 — KPI: kunci peserta & scope sebelum lookup `clientUuid`, cadangan 23505 |
| `927948b` | B22 — tanggal bisnis Asia/Jakarta (query + trigger + default BA, migrasi `20260928D`) |
| `912f6cc` | B09 — `csvCell` pindah ke `analytics-shared/csv.cjs`; ekspor Tabular menetralkan formula |
| `4b34973` | B14+B15 — pembatalan pakai template status berubah; kunci idempotensi per versi |
| `1be10a7` | B17+B18 — pengingat email bebas starvation; kegiatan yang sudah mulai kedaluwarsa |
| `77549c4` | B24 — `versi` wajib pada PATCH tiket klinik (400 bila tidak ada) |
| `8e41e37` | B32 — bukti KPI harus gambar yang diunggah pemanggil (`uploaded_by` + `type LIKE 'image/%'`) |
| `6116375` | B30 — config ekspor tidak valid dijawab 400, bukan 500 |
| `200b9fa` | B29 — "Lainnya" = total window − kelompok tampil (router dan worker) |
| `1258382` | B08 (backend) + temuan: request job tidak lagi memuat kueri mentah/PII; kunci `maxRows`/`estimatedRows` memicu trigger `analitik_job` (Tabular: insert gagal diam-diam → unduhan 404; detail_csv: 500) |
| `4074f3a` | B36 — snapshot `permissionScopeOf(operator)` saat submit; unduhan analitik dan Tabular menolak bila peran/kota berubah |
| `26a711f` | B27 — ringkasan PDF: rata-rata 4 pilar, ambang `NAIK_KELAS_AMBANG`/label "Siap Naik Kelas", tanpa lencana palsu dan tanpa QR `/passport/DRAFT` |
| `8fa246a` | B26 (backend) — PDF latin1 (tanpa mojibake), baris dibungkus ~95 karakter, PDF agregat tidak lagi dipotong 28 baris; router menyimpan `title` job |
| `0350ebc` | B28 — kalimat catatan QR PDF dibungkus `textLine`; tes memastikan setiap baris content stream hanya operator yang dikenal |
| `a5494f0` | B26 (web) — dialog Ekspor mengirim `judul` dokumen lewat `lib/analytics-export.ts` (`exportRequestBody`); tes unit + assertion e2e `postData.title` |
| `7ad2c47` | B39 — aturan kunci kota pindah ke `useTabularFilters.ts` (`useLockedKota`, `applyLockedKota`); spasial ikut terkunci, dropdown kabupaten dinonaktifkan; tes Vitest + e2e kabkota-spasial |
| `70974b5` | B40 — composable `useKontakHotline()` (satu key `useAsyncData`) menggantikan 4 salinan `readSingleton("kontak_hotline")` |
| `a17e1f4` | Higiene §2.5 — hapus `lib/notify.js` (program, tanpa pemanggil) dan `KLINIK_SLOTS` (`PROGRAM.ts`, tanpa pemakai) |
| `2ea59a1` | Tindak lanjut B28 — font PDF QR web mendeklarasikan `/Encoding /WinAnsiEncoding`; `pdftotext` membaca "·" dan "Café" (sebelumnya "•" dan "CafØ") |
| `7fec80c` | B02(c) — migrasi `20260928E` membatalkan job ekspor lama `queued`/`retry` dengan config ter-scope >8 filter; tes pg baru |
| `0e83667` | B06 (pelaksana A) — `shared/auth.cjs` kehilangan `requireRole`/`requireApplicationUser`; `20260928A-app-role-tanpa-default.js`; tes kontrak baru |
| `8e0607c` | B04+B05 (pelaksana A) — `loadActor` fail-closed (401 bila baris akun tidak ada), talent membaca peran dari baris akun; `test/access.test.js` baru |
| `9729e42` | B23 (pelaksana A) — akun tanpa `app_role` sah diarahkan ke `/sign-in?error=peran`; badge "Peran belum ditetapkan"; tes `auth-guard.test.ts` |
| `aabd4ec` | B07 (pelaksana A) — `escapeHtml` di `lib/utils/http.js`, email pengingat tanpa markup, pola email ketat |
| `e0e5533` | §2.6 (pelaksana A) — fixture bersama `operator-fixtures.mjs`/`analytics-data.mjs`, mock fail-loud, `optimizeDeps` di `nuxt.config.ts` |
| `54279e0` | B31 — `samaRahasia` (timingSafeEqual) diekstrak ke `lib/utils/http.js`; rute job kegiatan (`!==`) ikut memakainya; tes `http-utils.test.js` baru |
| `3ada000` | B33 — satu `normalisasiTeleponSeluler` di `lib/validate.js`; klinik (`rules.js`), kegiatan (`normalisasiTujuan` whatsapp), dan LOI katalog memakainya; tes `validate.test.js` baru |
| `8a9f8ac` | B16 — `ROLE_ROUTES.kabkota` + menu kabkota bertambah `/dashboard/klinik` ("Klinik Konsultasi"); tes `hasRouteAccess` kabkota→klinik + tes "menu ⊆ rute" semua peran |
| `be88445` | B08-web — route `POST /v1/analytics/tabular/query` (baca body, handler dipakai bersama GET /); `TabularData.vue` mengirim seluruh rowsQuery sebagai body; mock `postDataJSON()` + spec menegaskan `q` tak pernah di URL |
| `fd995a6` | B34 — `KANBAN_KOLOM` (5) pisah dari `KLINIK_STATUS` (6, "Dibatalkan"); `labelStatusKlinik` untuk kode asing apa adanya; toggle "Tampilkan dibatalkan" (`?status=batal`) + jadwal-ulang; mock menyaring batal seperti server |
| `4492b3f` | B35 — peta error dilengkapi (konsultasi +3, panel +2, outbox +3); `NOMOR_TIDAK_VALID` dihapus diganti cek regex klien; tes penjaga drift kunci-peta × korpus server |
| `fb37f22` | B38 — `INSTANSI` tunggal (worker + web); label ikut rekomendasi K21 (Talent Pool/Akselerator, Rekomendasi Marketplace); `toProduk.hargaLabel` dipakai kartu + detail publik |
| `eec732a` | Higiene §2.5 — hapus `RoleBadge.vue` + `ROLE_LABELS`/`ROLE_BADGE_CLASSES` + `RoleKey`/`OperatorProfile` (tanpa pemakai); tes dialihkan ke `APP_ROLE_BADGES` |
| `7e774f6` | Kandidat 01 tahap 1 — `analytics-shared/cakupan.cjs` (`muatPemanggil` fail-closed, `predikat`, `pastikanUsaha` 404, `kapabilitas`, `terjaga`/`publik` bertanda Symbol) + `test/cakupan.contract` (14) + `test/cakupan-matrix.pg` (3) + `test/route-manifest` (3: 79 route, 18 publik eksplisit, sisanya `LEGACY_BELUM_MIGRASI`) |
| `6429eda` | B25 — `useKpiOutbox.add` mengembalikan `"terkirim" \| "antre" \| "ditolak"` (`hasilUntukEntri` di `lib/kpi-outbox.ts`); form usaha memakai outcome, bukan `online`; tes unit `kpi-outbox.test.ts` baru (5) |
| `8ae8053` | Kandidat 01 langkah 2 — `sendError` program menghormati `DirectusError` (`CakupanError` dirender status aslinya, bukan 500); tes `http-utils.test.js` baru |
| `0d405b4` | Flake §2.0 — `Field.vue` tidak lagi mengimpor dari barel `index.ts`; varian pindah ke `field/variants.ts` (barel mengekspor ulang); tes penjaga impor `field-variants.test.ts` (2) |
| `1733d05` | Tes B25 dirapikan tanpa `vi.mock` (oxlint 0 error untuk berkas milik sesi; 3 error tersisa milik berkas demo paralel) |
| `bdbcdba` | Kandidat 01 migrasi pilot — route peta memakai `terjaga` (peran provinsi/kabkota/umkm) + `pastikanUsaha` 404 (K1); temuan: tanda Symbol kini ikut di inner closure (terjaga + publik); peta 7/7, program 143/143, build rollup hijau; `LEGACY_BELUM_MIGRASI` 79→78 |
| `8ebdf61` | Kandidat 01 migrasi talent — 8 route memakai `terjaga` (kelola provinsi/kabkota, terbit BA provinsi); service menerima `pemanggil`; penolakan peran via `next`, domain via `sendError`; talent 12/12, program 144/144, build hijau; `LEGACY_BELUM_MIGRASI` 78→70 |
| `e14c77f` | Kandidat 01 migrasi KPI — 6 route memakai `terjaga` (baca semua, kirim umkm, review provinsi/pendamping); scope via `predikat`, `canSubmit`/`canReview` dipetakan ke pemanggil; KPI 8/8, program 145/145, build hijau; `LEGACY_BELUM_MIGRASI` 70→64 |
| `e69ea7e` | Kandidat 01 migrasi katalog — 10 route (`terjaga` kelola provinsi/umkm, kurasi provinsi, `publik` pdf + LOI); service menerima `pemanggil`; katalog 13/13 + media 6/6, program 146/146, build hijau; `LEGACY_BELUM_MIGRASI` 64→54 |
| `6976558` | Kandidat 01 migrasi passport — 6 route (baca + PDF provinsi/kabkota K8/umkm, terbit/cabut provinsi, verifikasi publik); scope via `pastikanUsaha` 404 (K1); passport 14/14, program 147/147, build hijau; `LEGACY_BELUM_MIGRASI` 54→48 |
| `b2c4caf` | Kandidat 01 migrasi kegiatan — 6 route publik (captcha/rahasia tetap di handler); kegiatan 28/28, program 148/148, build hijau; `LEGACY_BELUM_MIGRASI` 48→42 |
| `4117256` | Kandidat 01 migrasi klinik — 9 route (petugas terjaga, publik poli/slot/tiket/lacak/receipt, prefill + lampiran semua peran); `actorKlinik`→`pemohonKlinik` + pemanggil, hantu 401 fail-closed; klinik 25/25, program 149/149, build hijau; `LEGACY_BELUM_MIGRASI` 42→33; **bundle program tuntas** |
| `f4a0d7b` | Kandidat 01 migrasi infografis — 2 route (`terjaga` provinsi/kabkota); scope via `scopeTabularQuery` dari pemanggil, `KOTA_NOT_ASSIGNED` tetap 403; infografis 11/11, build analytics hijau; `LEGACY_BELUM_MIGRASI` 33→31 |
| `2d07a29` | Higiene — hapus `USER` tak terpakai di `katalog-media.test.js` (sisa migrasi katalog); warning oxlint sesi 0; 2 error tersisa milik `AtRiskMap.client.vue` paralel |
| `92742c8` | Kandidat 01 migrasi tabular — 13 route (`publik` status, `terjaga` DATA lainnya, publish adminOnly via cek `pemanggil.admin`); `POST /query` berbagi handler `daftarBaris` dengan `GET /` (B08-web); `permissionScopeOf` ekspor dipertahankan (B36); tabular 26/26, analytics 98 pass/1 skip, build analytics hijau; `LEGACY_BELUM_MIGRASI` 31→18 |
| `03c6945` | Rapian tabular — hapus 3 `try-catch` tanpa log (hanya lempar ulang); oxlint berkas sesi 0/0; tes tetap hijau |
| `0f60073` | Kandidat 01 migrasi analysis — 10 route (`publik` metadata/templates/status per DAFTAR_PUBLIK, `terjaga` DATA lainnya); scope via `scopeAnalysisRequest`/`assertUsahaInScope` dari pemanggil, `resolveScopedOperator`→`AnalyticsApiError` dipertahankan, `permissionScopeOf` (B36) + `wrap`/`finishError` (B30) tidak dirusak; analytics 100 pass/1 skip, build analytics hijau; `LEGACY_BELUM_MIGRASI` 18→8 |
| `95b4d06` | Higiene §2.5 — lebur 2 dari 3 salinan `lib/utils/auth.js` (program + analytics, md5 identik) ke `cakupan.cjs` (`sanitizeError` baru + kontrak); salinan authentication tetap (paralel); program 156/156, analytics 100 pass/1 skip, build program+analytics hijau, oxlint 0/0 |
| `476894b` | Kandidat 03 langkah 1 — `DIMENSIONS` analitik jadi sumber tunggal di `analytics-shared/query-compiler.cjs` (14 entri, filter integer sargable ikut); router `query-compiler.js` mengimpor dari shared + tes kontrak baru; analytics 101 pass/1 skip, worker 38/38, build analytics hijau, oxlint 0/0 |
| `9f842ef` | Kandidat 03 langkah 2a — `DIMENSIONS` worker (`exporter.js`) memakai shared yang sama (key/label identik, metadata filter ekstra diabaikan, `FILTER_KEYS` tetap dari key) + tes paritas baru; analytics 101 pass/1 skip, worker 39/39 |
| `7281947` | Kandidat 03 langkah 2b — `filterSql` worker memakai metadata integer shared (sargable `a.kota_id = $n::integer`, `unknown` → `IS NULL`, `contains`/`starts_with` ditolak) + 3 tes baru; worker 42/42 |
| `749b415` | Kandidat 03 langkah 2c — `ROLLUP_DIMENSIONS` (`rebuild.js`) diturunkan dari `DIMENSIONS` shared (urutan + key/label identik, diekspor untuk kontrak) + tes paritas baru; worker 43/43 |
| `3927901` | Kandidat 03 langkah 2d — `ROLLUP_DIMENSIONS` Set (`query-service.js`) diturunkan dari `DIMENSIONS` shared via `query-compiler.js` (tanpa salinan manual, diekspor untuk kontrak) + tes baru; analytics 102 pass/1 skip |
| `51a239b` | Kandidat 03 langkah 2e — `METRICS` kanonik di shared (penamaan router); router memakai sebagai alias `METRIC`, worker memetakan ke nama pendek di seam + tes paritas baru; worker 44/44, analytics 102 pass/1 skip |
| `1c4adff` | Kandidat 02 pengaman resi sebelum migrasi outbox — callback hanya mengubah pesan `mengirim`/`terkirim`; resi terlambat tidak menghidupkan kembali `batal`/`gagal`. Tes kontrak merah→hijau + tes pg opt-in (tanpa kredensial: skip); program 172/172, oxlint berkas sesi 0/0 |
| `df1075d` | Kandidat 02 pengaman identitas resi — `id` dan `messageId` bila hadir bersama wajib menunjuk pesan yang sama; callback tanpa keduanya tidak mengubah baris. Tes kontrak merah→hijau + tes pg opt-in (tanpa kredensial: skip); program 173/173, oxlint berkas sesi 0/0 |
| `4d829e8` | Kandidat 03 langkah 3f — `compileQuery`/`compileFiltersOnly` router memakai `compileAggregate` shared dengan `operator` wajib (fail-closed); route `/query`, `/records`, `/exports` tidak lagi pra-scope; analytics 105 pass/1 skip |
| `0fae401` | Kandidat 03 langkah 3h — worker (`queryAggregate`, `detail_csv`) memakai `compileAggregate`/`compileFilters` shared; operator diturunkan dari `permissionScope` job (K14); `filterSql`/`FILTER_KEYS`/`identifier` worker dihapus; router menyimpan config klien apa adanya (kabkota + 8 filter kini lolos, 9 → 422); job tanpa `permissionScope` ditolak; worker 49/49 |
| `8b8d9d4` | Kandidat 03 paritas — tes pg `export-parity` (canvas `queryAnalytics` = worker `queryAggregate`, provinsi + kabkota, 3 config); pg analytics 8/8, worker 1/1 |
| `5b40297` | Kandidat 03 langkah 5 — worker menghapus cabang mati: `aggregate_csv` (router sinkron), `request.result` (trigger melarang), `passport_pdf`/`katalog_pdf` + builder + `renderDokumenPdf` (program merender sendiri); worker 46/46 |
| `3e348a1`, `059ba2e` (merge `6864219`) | Kandidat 01 langkah 4–6 — 8 route legacy operasional + authentication dimigrasi ke `terjaga`/`publik`; `/aktivitas` (+ `audit-sesi.vue`), `resolve-nib`, dan salinan `auth.js` dihapus; `LEGACY_BELUM_MIGRASI` kosong. Perubahan perilaku: `/v1/auth/activity` dan `/me` 403 untuk `app_role` NULL. Route `/aspek-perkembangan` (kerja paralel) dipasang ulang dengan `terjaga` |
| `19d901e` | Fix bug lama router analitik — fallback populasi filter `status_usaha` (`in` ≥2 nilai / non-sederhana) mengikat `plan.params` (sebelumnya "Expected 1 bindings, saw 2"); kasus ditambah ke tes paritas pg (merah→hijau) |
| `f60a16d` | Kandidat 05 — `analytics-shared/dokumen.cjs` (`renderDokumen`, `INSTANSI`, `publicUrl`, `teksPdf`); passport, katalog, dan worker memakai satu renderer; B26–B28 sudah tertutup sebelumnya (`8fa246a`, `26a711f`, `0350ebc`, `2ea59a1`), ini konsolidasi. Tes kontrak 8 (`pdftotext` "Café"/"·", 120 baris → 3 halaman); program 147/147, worker 45/45. Belum: deskripsi filter di PDF agregat, K19 (pdftotext di CI) |
| `a818481`, `0ef9081`, `3001fee` (+ wiring bersama) | Kandidat 02 langkah 3–6 — migrasi `20260928H` (`klinik_notifikasi` → `notifikasi_outbox`, up/down/up), `lib/outbox/` + adapter WA/email/memory + `runtime.js`; klinik dan kegiatan dipindah, satu hook cron `notifikasi`, `klinik/notifikasi.js` dan `kegiatan/adapter.js` dihapus; `terapkanResi` dibatasi AND + status; kunci pengingat memuat `date_updated`. Tes: outbox pg 11, kegiatan pg 6, klinik pg; program 190/190 (non-pg + pg), kontrak 51/51. Tersisa: langkah 7–8 (hapus `lib/notify.js`, catatan receipt Y07/Y08 di `oas.yaml`), bukti sandbox WhatsApp (Y07/Y08), drop kolom `percobaan`/`provider_id`/`dikirim_at` di `kegiatan_pengingat` |
| `9c4a0ea`, `92667a7` | Kandidat 06 (klinik + katalog/KPI) — rules murni `klinik/rules.js` (TRANSISI, `bolehUbah`, `barisAudit`, `dalamCakupan`, `transisiUntuk`) dan `katalog/rules.js`; DTO tiket mengirim `transisi`/`statusLabel`; mock klinik/katalog/KPI/kegiatan mengimpor rules backend (M1–M10); web `lib/klinik.ts`, `lib/katalog.ts`, `lib/kpi.ts` dengan satu peta pesan + tes penjaga drift. M11–M15 dan tes mock merah sudah tertutup di `e0e5533`. Tes: program 167, vitest 115, pg klinik 35. Tersisa: halaman KPI memakai `pesanKpi`, format harga (W12), Kandidat 04 (use case + harness) |
| `81e1848`, `837a5ce`, `558554e`, `c912ef3`, `02388f7` | Kandidat 04 — use case per fitur di atas harness pg: `createKatalog`, `createKpi`, `createKlinik` (adapter multipart di `lib/http/multipart.js`, `versi` wajib); kegiatan dan talent/passport/peta memakai tes pg tanpa bungkus `createX` (verb sudah menerima dependensi eksplisit). Fake-SQL → 0 di fitur tersebut. Dua bug baru yang ditemukan tes pg: `hitung-skor` talent 500 (variabel `usaha`), PDF passport 500 (`ORDER BY date_created`). Tes: pg 120, program non-pg 114, kontrak 51, vitest 115. Menyusul di `66eabe4` (tabular-search pg: `%`/`_` literal, KBLI/NIK/NIB, `EXPLAIN` Bitmap Index Scan) dan `cf37615` (`lacakTiket` dengan captcha sah). Kandidat 02 langkah 7 (`lib/notify.js`) dan catatan receipt `oas.yaml` ternyata sudah selesai. Tersisa: registrasi/fasilitasi (kerja paralel belum di-commit), bukti sandbox WhatsApp (butuh kredensial), drop kolom `percobaan`/`provider_id`/`dikirim_at` (belum diputuskan) |

**Pelaksana A sudah commit + push** (`0e83667`…`e0e5533`; `main` = `origin/main`, working tree bersih). Lane P2 web sesi 28 Sep malam tuntas semua: ✅ B31 (`54279e0`), ✅ B33 (`3ada000`), ✅ B16 (`8a9f8ac`), ✅ B08-web (`be88445`), ✅ B34 (`fd995a6`), ✅ B35 (`4492b3f`), ✅ B38 (`fb37f22`; label penuh ikut rekomendasi K21 atas persetujuan pengguna sesi ini). **Tersisa: sisa §2.5 (tertahan: agen paralel masih mengedit `operasional/src/index.js` untuk fitur aspek + demo/sso; patch higiene tersimpan di `/tmp/higiene-operasional.patch`), dan gelombang 3+ (kandidat 01 analytics/operasional → 03 → 02 → 06/04 → 05).** **Pelaksana B (sesi 28 Sep 2026, sore) — lane web + higiene:** B28, B26-web, B39, B40 (`0350ebc`…`70974b5`), higiene §2.5 `notify.js`/`KLINIK_SLOTS` (`a17e1f4`), encoding font QR PDF (`2ea59a1`), dan **B02(c)** migrasi `20260928E` (`7fec80c`). **Sesi 28 Sep malam (lanjutan, belum push, ahead 36): ✅ B25 (`6429eda`+docs), ✅ 01 langkah 2 (`8ae8053`), ✅ flake fieldVariants (`0d405b4`), ✅ bundle program tuntas dimigrasi (peta `bdbcdba`, talent `8ebdf61`, KPI `e14c77f`, katalog `e69ea7e`, passport `6976558`, kegiatan `b2c4caf`, klinik `4117256`; tiap migrasi + docs).**

Sisa gelombang 0: **tidak ada.** Verifikasi terakhir (sesi pelaksana B, setelah A commit; pohon bersih): program **136/136** (+ pg 15/15), contract **23/23**, analytics **93 pass/1 skip** (+ pg 7/7), worker **37/37** (+ pg 1/1), web unit **68/68** (10 berkas), mock chromium **89 lulus/16 skip/0 gagal**, oxlint **0/0** (595 berkas), `check_coverage.py` **OK**; sisa database di container uji = `diskuk_test_template` (template) dan `diskuk` (21 MB, bukan buatan sesi ini — tinjau sebelum dihapus). `pdftotext` membaca kalimat QR PDF web, "·", dan "Café" (encoding WinAnsi); 120 baris → 3 halaman (dari sesi sebelumnya).

Verifikasi 28 Sep malam (sesi lane P2 web; pohon berisi fix B31–B38 + docs): program **141/141**, analytics **94 pass/1 skip**, worker **38/38**, web unit **80/80** (12 berkas). Suite lain belum dijalankan ulang — lihat laporan akhir sesi.

Verifikasi 28 Sep malam (sesi migrasi program; ahead 36, belum push): program **149/149**, analytics **94 pass/1 skip**, worker **38/38**, web unit **86/86** (14 berkas), directus/test **40 pass/0 gagal/3 skip pada pohon bersih** (pohon kotor: 1 gagal route-manifest karena route `/aspek-perkembangan` milik agen paralel belum bertanda — tanggung jawab mereka), oxlint **0 error** (1 warning pohon kotor), `check_coverage.py` **OK**; tiap bundle program `directus-extension build` hijau per migrasi. pg tidak dijalankan (kredensial DB kosong di shell ini; tes pg skip normal).

Verifikasi 29 Sep dini hari (sesi migrasi infografis; belum push): program **149/149**, analytics **95 pass/1 skip** (infografis 10→11 tes), worker **38/38**, web unit **86/86**, `check_coverage.py` **OK**, build analytics hijau; route-manifest di pohon kotor merah 1 rute (`/aspek-perkembangan` paralel, belum bertanda); oxlint **0 warning milik sesi** (2 error milik `AtRiskMap.client.vue` paralel). pg tidak dijalankan (kredensial kosong, skip normal).

Titik mulai yang disarankan (semua berkas kini bebas — pelaksana A sudah commit; lihat catatan di §2.0b):

1. ~~**Gelombang 1 — harness Postgres**~~ ✅ commit `5e337cd`. Pakai: `bash scripts/test-db-template.sh`, lalu `DISKUK_TEST_PG_URL=postgres://<DB_USER>:<DB_PASSWORD>@127.0.0.1:15432/postgres pnpm --dir services/directus/extensions/program test:pg` (script `test:pg` juga ada di analytics dan worker; tanpa env tes pg di-skip; template basi ditolak dengan pesan menjalankan script).
2. **Gelombang 2 — P1 backend selesai**: ✅ B09, B11, B13, B14, B15, B17, B18, B19, B20, B21, B22. **P2 backend selesai**: ✅ B24, B26 (sisi server/worker), B27, B29, B30, B32, B36, dan sisi backend B08 (request job bebas PII) — lihat tabel commit. Semua dikerjakan dengan tes merah di Postgres (`test/pg/*.test.js`, satu database per file lewat `withDatabase(t)`) atau byte-level (`pdftotext` untuk PDF).
3. **Sisa P2 yang menyentuh berkas web/lain:** ✅ semuanya — B26 (sisi web), B28, B39, B40, B31 (`54279e0`), B33 (`3ada000`), B16 (`8a9f8ac`), B08-web (`POST /query` + body + mock + spec; `be88445`), B34 (arsip batal + toggle; `fd995a6`), B35 (peta error + penjaga drift; `4492b3f`), B38 (`INSTANSI` + label K21 + `hargaLabel`; `fb37f22`). Belum: **tidak ada** — tersisa higiene §2.5 dan gelombang 3+.
4. **Prefix migrasi terpakai:** `20260928A` (A), `20260928B/C/D` (B), `20260928E` (B02c). Migrasi baru mulai dari `20260928F` agar tidak bentrok.
5. **Temuan tambahan saat eksekusi:** (a) arm pemilik `id IN (subquery)` membuat seluruh OR tidak bisa BitmapOr sehingga tiga index trigram tak terpakai — ditulis ulang `= ANY(ARRAY(...))`; (b) CHECK `analitik_job.status` tidak punya nilai `expired`, jadi cleanup worker/analytics selalu gagal 23514 — diperbaiki migrasi `20260928C`; (c) tes perilaku B22 hanya membedakan UTC vs Jakarta pada jendela 00:00–07:00 WIB, ditutup dua tes deterministik (definisi fungsi/default + SQL `loadLegalitas`); (d) trigger `analitik_job` menolak request yang memuat kata `rows`/`nik`/… sehingga `maxRows` (Tabular) dan `estimatedRows` (detail_csv) membuat job tidak pernah tersimpan — Tabular jatuh ke job ephemeral tanpa jejak dan URL unduhannya 404, detail_csv menjawab 500; kini request hanya menyimpan ringkasan aman + `permissionScope`; (e) CHECK >8 filter dan budget filter sudah dijaga compiler, dan job agregat lama yang sudah antre dibatalkan migrasi `20260928E` (`7fec80c`, B02 (c)) — baris `queued`/`retry` dengan config ter-scope >8 filter menjadi `cancelled` dengan penanda `error_code='EXPORT_BUDGET'`; `down` memulihkannya.


### 2.1 Pasangan yang wajib dikirim bersama

| Pasangan | Kenapa |
|---|---|
| **B12 + B10** | Memperbaiki proxy foto (Content-Type dari `asset.file.type`) tanpa membatasi tipe unggahan membuat SVG unggahan pemilik tampil inline di origin Directus, yaitu stored XSS. Hari ini proxy selalu 500, dan itu satu-satunya yang menahan celah ini. |
| **B06 + B23** | Migrasi yang membuang `DEFAULT 'provinsi'` membuat `app_role` NULL mungkin terjadi. Tanpa perbaikan middleware web (W4), akun seperti itu terjebak loop redirect. |
| **B18 sebelum gateway WA dipasang** | Begitu `WHATSAPP_GATEWAY_URL` diisi untuk bukti provider Y07, semua pengingat lama untuk kegiatan yang sudah lewat ikut terkirim. |
| **B02 (a) + (b)** | Patch (b) saja memindahkan kegagalan ke worker. Pengguna baru tahu setelah job gagal, dan job lama yang sudah antre tetap terpotong diam-diam. |

### 2.2 P0: kebocoran data dan keamanan

| ID | Masalah | Lokasi | Patch minimal | Tes regresi | § |
|---|---|---|---|---|---|
| B01 ✓ | Staf klinik (termasuk pendamping) bisa men-stream **file apa pun** di `directus_files`, karena `boleh = isStaff(actor) \|\| …` lalu `AssetsService({accountability:null})` | `klinik/service.js:515-541` | Bila file bukan lampiran tiket mana pun → 404 (juga untuk staf). Staf hanya boleh membaca bila tiketnya lolos `cakupanPetugas(actor)`: tambahkan `(${cakupan.sql}) AS dalam_cakupan` ke query `milik` | Pendamping + file id bukan lampiran → 404; kabkota(7) + tiket kota 9 → 404. Ubah `klinik.test.js:160`, yang sekarang mengunci perilaku bocor | 01 |
| B02 ✓ | Kabkota + 8 filter non-kota pada ekspor png/pdf/pptx menghasilkan data **seluruh provinsi**. Scope menambah filter ke-9 (`kota_id`), `submitExport` tidak mengecek budget, dan worker memotong `slice(0, 8)` | `exporter.js:158-160`; `exports-service.js:196-199,287-293`; `contracts.cjs:161-176` | (a) `submitExport` menjalankan `compileQuery(config, registry)` untuk semua tipe agregat sebelum `insertJob`, sehingga filter ke-9 → 422. (b) Worker melempar error bila jumlah filter > `QUERY_BUDGET.maxFilters`, tidak lagi memotong. (c) Batalkan job agregat kabkota yang sedang antre | Router: kabkota + 8 filter + `aggregate_pdf` → 422. Worker: 9 filter → error, bukan pemotongan | 03 |
| B03 ✓ | `GET /legalitas/:usahaId` hanya punya `routeGuard`, sehingga pengguna mana pun bisa membaca sertifikat usaha mana pun | `legalitas/index.js` | **Rekomendasi:** hapus endpoint beserta testnya dan entri di `program/package.json`, karena web tidak memanggilnya. Alternatif: gate seperti `/peta` | umkm `GET` usaha lain → bukan 200, atau route tidak ada | 01 |
| B04 ✓ | Talent: kabkota tanpa `kota_scope` melihat **semua** pengajuan (`?::integer IS NULL`). `GET /berita-acara` tidak punya gate peran | `talent/service.js:130-150`, `:316-331` | Kabkota tanpa kota → 403 `KOTA_NOT_ASSIGNED`. `listBeritaAcara` memanggil `loadActor` + `assertTalentAccess` | Kabkota null → 403; umkm/pendamping `GET /berita-acara` → 403 | 01 |
| B05 ✓ | `assertUsahaInActorScope` meloloskan kabkota bila `usaha.kotaId` null. Dampaknya ke peta, talent (5 route), dan PDF passport | `lib/access.js:62-72` | Tolak bila `usaha.kotaId == null` **atau** berbeda dari scope | Kabkota + usaha kota NULL → 403/404 di peta, talent, dan PDF | 01 |
| B06 ✓ | `app_role` punya `DEFAULT 'provinsi'`, dan `loadActor` jatuh ke `accountability.app_role`/`appRole`/`"provinsi"`. Akibatnya akun baru atau salah konfigurasi mendapat akses **seluruh provinsi** | migrasi `20260926A-create-auth-login.js:12`; `lib/access.js:23-25` | Migrasi `app-role-tanpa-default`: `DROP DEFAULT, DROP NOT NULL`, CHECK tetap. `loadActor`: baris tidak ada → 401, `app_role` null → peran null → semua predikat menolak. Keluarkan daftar audit akun `provinsi` yang sudah ada untuk ditinjau manusia. **Kirim bersama B23** | Talent/peta dengan baris `directus_users` tanpa `app_role` → 403. Hapus tes yang menyuntik peran lewat `accountability.appRole` (`talent.test.js:86-164`) | 01 |
| B07 ◐ | Stored XSS di halaman batal pengingat. `EMAIL_PATTERN` menerima `a@<img/src=x/onerror=…>.com`; `maskTujuan` menyimpannya di `tujuan_masked`, lalu nilainya diinterpolasi mentah ke HTML di origin Directus | `kegiatan/rules.js:172`; `kegiatan/index.js:115-142`; `kegiatan/adapter.js:48-51` | (a) `escapeHtml` untuk semua interpolasi di halaman HTML. (b) Pola email yang ketat: `/^[^\s@<>"'`&]+@[a-z0-9.-]+\.[a-z]{2,}$/i`. (c) Escape `judul`/`tempat` di HTML email. (d) Mask ulang baris yang sudah mengandung `<` | Opt-in dengan email itu → 400 `TUJUAN_TIDAK_VALID`; `tujuan_masked` berisi `<b>` dirender `&lt;b&gt;` | 02 |

### 2.3 P1: fitur rusak, privasi, atau keamanan sekunder

| ID | Masalah | Lokasi | Patch minimal | Tes regresi | § |
|---|---|---|---|---|---|
| B08 ✓ | NIK mentah masuk URL (`GET ?q=`), dan ekspor menyimpan `{where, params, filters: q}` di `analitik_job.request`. Ini melanggar ADR-004 #10 | `TabularData.vue:268,303,556`; `tabular/index.js:418` | Pencarian lewat POST body (atau NIK di-HMAC). Job hanya menyimpan filter non-PII: `q` 16 digit menjadi `"[NIK]"`, dan `params` tidak disimpan. Scan log serta tabel job yang ada | `request` job tidak cocok dengan `/\d{16}/` | 03 |
| B09 ✓ | Formula injection di CSV Tabular: sel hanya di-quote | `tabular/index.js:434-435` | Pakai `csvCell` (awalan `'` untuk `=+-@`) dari `exporter.js:110-114`, lalu pindahkan ke `analytics-shared` | `=HYPERLINK(…)` → `'=HYPERLINK(…)` | 03 |
| B10 ✓ | Unggahan foto katalog tidak dicek tipe dan ukurannya di server; validasi hanya di klien | `katalog/service.js` `assertKurasiPhotos`; `ProdukForm.vue:82` | Pilih juga `type, filesize`. Wajibkan `type IN ('image/jpeg','image/png','image/webp')` dan ukuran ≤ 5 MB. **Kirim bersama B12** | Unggahan SVG → 400 `FOTO_TIDAK_VALID` | 04 |
| B11 ✓ | Edit produk yang sudah **tayang** selalu 400 `FOTO_TIDAK_VALID`, karena `assertKurasiPhotos` (butuh folder kurasi) dijalankan sebelum `pindahkanFoto` | `katalog/service.js:295-306` | Jalankan `pindahkanFoto(trx, id, false)` lebih dulu. Izinkan juga foto yang sudah terhubung ke produk ini (`id IN (SELECT directus_files_id FROM produk_foto WHERE produk_id = ?)`) | pg: PATCH pemilik → 200, folder pindah ke kurasi, status `menunggu`; edit yang gagal rollback dengan foto tetap di folder katalog | 04 |
| B12 ✓ | Proxy foto katalog selalu 500: `asset.file.mimetype` tidak ada (field Directus adalah `type`) | `katalog/service.js:200-206` | `asset.file.type \|\| "application/octet-stream"` + `X-Content-Type-Options: nosniff`. **Kirim bersama B10** | Perbaiki fake `katalog-media.test.js:129` menjadi `{type}`, lalu assert header | 04 |
| B13 ✓ | Pencarian Tabular 500 di Postgres nyata: `ESCAPE '\\'` adalah dua karakter (`invalid escape string`) | `tabular-filter.js:51,64` | Hapus klausa `ESCAPE`, karena backslash sudah escape bawaan LIKE. Pindahkan index ke migrasi baru: trigram `usaha_tabular.nama/produk_utama/kegiatan_utama` + `pelaku_usaha.nama_lengkap`, `CONCURRENTLY`; buang `idx_usaha_nama_trgm` yang tak terpakai | pg: query tereksekusi; `EXPLAIN` memuat Bitmap Index Scan ketiga index | 04 |
| B14 ✓ | Pembatalan tiket klinik mengirim template "tiket diterima" | `klinik/notifikasi.js:30-41` | `jenis === "tiket_dibuat" ? pesanTiket(tiket) : pesanStatusBerubah(tiket, status ?? "batal")`. Tidak perlu template provider baru | Enqueue `pembatalan` → template `klinik_status_berubah`, teks memuat "dibatalkan" | 02 |
| B15 ✓ | Kunci idempotensi `pembatalan:<tiket>` / `status_berubah:<tiket>:<status>` menelan transisi berulang (`batal → dijadwalkan → batal` hanya satu pesan) | `klinik/notifikasi.js:35-37` | Tambahkan `versi` baris setelah update ke kunci. Retry request yang sama tetap aman karena `assertVersi` memberi 409 | Dua pembatalan pada versi berbeda → dua kunci | 02 |
| B16 ✓ | Kabkota tidak bisa membuka `/dashboard/klinik`, padahal server dan halaman menganggapnya petugas; menunya juga tidak ada | `ROLES.ts:43-54`; `NAVIGATION.ts` | Tambahkan route dan menu "Klinik Konsultasi" untuk kabkota | `hasRouteAccess("kabkota","/dashboard/klinik")`; tes "menu ⊆ rute" untuk semua peran | 01, 06 |
| B17 ✓ | Starvation pengingat: ≥50 baris WA `menunggu_gateway` di depan antrean menutup email yang lebih baru | `kegiatan/service.js:286-311` | `AND (p.status = 'menunggu' OR (p.status = 'menunggu_gateway' AND ?::boolean))` dengan `whatsappConfigured(env)` | 51 WA terparkir + 1 email → email diproses | 02 |
| B18 ✓ | Pengingat kegiatan yang **sudah lewat** tetap dikirim begitu gateway dipasang, karena tidak ada filter `tanggal_mulai` | `kegiatan/service.js:297` | `AND k.tanggal_mulai > now()`. Baris kedaluwarsa → `dibatalkan` dengan `alasan='kedaluwarsa'` | Kegiatan kemarin tidak dikirim, statusnya `dibatalkan` | 02 |
| B19 ✓ | Ekspor Tabular masuk antrean worker (`status 'queued'`), sehingga worker bisa mengklaim lalu gagal `EXPORT_TYPE`. Berkasnya di `TABULAR_EXPORT_DIR` juga tidak pernah dibersihkan | `tabular/index.js:113,418`; `queue.js:44`; `exporter.js:681-700` | Insert dengan status atau `job_type` yang tidak di-poll worker, lalu tambahkan cleanup TTL untuk direktori Tabular | Klaim worker tidak mengambil baris `tabular_csv` | 03 |
| B20 ✓ | Worker selalu menambah `status='active'`, sehingga filter `status_usaha=archived` selalu menghasilkan 0 | `exporter.js:252` | Samakan dengan `hasStatusFilter` (seperti cabang `detail_csv` :580-587) | Filter archived → klausa status tidak ada | 03 |
| B21 ○ | KPI: lookup duplikat `client_uuid` berjalan **sebelum** lock peserta dan `canSubmit`. Retry paralel mendapat 409 `LAPORAN_SUDAH_ADA`, bukan 200, dan replay dikembalikan sebelum scope dicek | `kpi/service.js:176-184` | `loadPeserta(trx, actor, id, {lock:true})` + `canSubmit` lebih dulu, baru lookup duplikat. Cadangan: tangkap 23505 pada `client_uuid`, baca ulang, lalu 200 | pg: dua submit paralel → `{201, 200}` dan tepat satu baris; umkm lain me-replay → 404 | 01, 04 |
| B22 ✓ | `CURRENT_DATE` dihitung dalam UTC, sehingga sertifikat yang kedaluwarsa hari ini masih "terbit" sampai 07:00 WIB. Hal yang sama terjadi di trigger dan default tanggal BA | `lib/usaha.js:56`; `legalitas/service.js:20`; migrasi `K:122`, `R:29,34`, `I:15` | `(now() AT TIME ZONE 'Asia/Jakarta')::date` + migrasi yang mendefinisikan ulang trigger dan default | pg dengan `SET TIME ZONE 'UTC'` + fixture kemarin menurut Jakarta | 04 |
| B23 ○ | Loop redirect saat `app_role` kosong atau tidak valid: middleware mengarah ke `/dashboard`, yang ditolak lagi. Latent hari ini, menjadi hidup setelah B06 | `auth.global.ts:11-17`; `AppSidebar.vue:19`; `nav/User.vue:19` | `!isRoleKey(app_role)` → logout lalu `/sign-in?error=peran`. Fallback `"provinsi"` di web diganti "Peran belum ditetapkan". **Kirim bersama B06** | e2e: `/users/me` tanpa `app_role` berakhir di sign-in, tanpa loop | 01, 06 |

### 2.4 P2: kebenaran, UX, dan pengerasan

| ID | Masalah | Lokasi | Patch minimal | § |
|---|---|---|---|---|
| B24 ✓ | `assertVersi` langsung lolos bila `versi` tidak dikirim, sehingga optimistic lock bisa dilewati | `klinik/penugasan.js:89-95` | `versi` wajib pada PATCH tiket, 400 bila tidak ada. Web sudah mengirimnya | 04 |
| B25 ◐ | Form KPI menampilkan "dikirim" walau ditolak atau masih antre | `useKpiOutbox.add`; `usaha/index.vue:138` | `add()` mengembalikan `"terkirim" \| "antre" \| "ditolak"`, lalu pesan mengikutinya | 06 (W6) |
| B26 ✓ | PDF: mojibake (UTF-8 di stream WinAnsi), baris panjang tidak dibungkus, PDF agregat dipotong 28 baris, judul selalu default | `passport/pdf.js`; `export-renderer.js:255-456` | `Buffer.from(…, "latin1")` + `/Length` dan offset per byte latin1; wrap ±95 karakter; paginasi; web mengirim `title`, router menyimpannya | 05 |
| B27 ✓ | PDF ringkasan: skor dirata-rata 5 dimensi (seharusnya 4 pilar), ambang dan label berbeda dari badge Siap Naik Kelas, lencana palsu "Talent Pool", status "Aktif (DRAFT)", QR ke `/passport/DRAFT` | `passport/pdf.js:217-285,338-353` | 4 pilar + `NAIK_KELAS_AMBANG` dari `passport/service.js`; tanpa passport aktif → "Belum diterbitkan", tanpa QR, tanpa lencana | 05 |
| B28 ✓ | `qr-pdf.ts:43`: kalimat mentah di luar `BT…Tj` (content stream tidak valid) | `apps/web/app/lib/qr-pdf.ts:43` | Bungkus dengan `textLine(24, 58, "F1", 7, …)` | 05 |
| B29 ✓ | Grup "Lainnya" hanya memuat grup ke-(limit+1), bukan sisa semua grup | `exporter.js:272`; `query-service.js:~620` | Overflow = `metric_total − Σ grup` dari window `SUM() OVER ()` | 03 |
| B30 ✓ | Error config ekspor (`INVALID_ANALYSIS_CONFIG`) menjadi 500 | `analysis/index.js:66-72` | Petakan ke 400 | 03 |
| B31 ✓ | Rahasia job kegiatan dibandingkan dengan `!==` | `kegiatan/index.js:83` | Ekstrak `samaRahasia` (timingSafeEqual) dari `klinik/index.js:43-46` ke `lib/utils/http.js` | 02 |
| B32 ✓ | Bukti KPI menerima UUID file apa pun | `kpi/service.js:144-147` | Wajibkan `uploaded_by = caller` dan `type LIKE 'image/%'` di dalam transaksi; bila tidak → 400 `BUKTI_TIDAK_VALID` | 04 |
| B33 ✓ | Tiga aturan telepon berbeda (klinik, kegiatan, LOI) | `klinik/rules.js:38-44`; `kegiatan/rules.js:188-193`; `katalog/service.js:403` | Satu `normalisasiTeleponSeluler` di `lib/validate.js` | 04 |
| B34 ✓ | Tiket `batal` tidak tampil di web; `statusLabel` menampilkan "Batal" untuk kode apa pun yang tak dikenal | `PROGRAM.ts:113-119`; `klinik.vue:152`; `LacakTiket.vue:52` | Pisahkan `KANBAN_KOLOM` (5) dari `KLINIK_STATUS` (6); toggle "Tampilkan dibatalkan"; kode tak dikenal ditampilkan apa adanya | 06 (W7) |
| B35 ✓ | Kode error server yang tidak dipetakan di web (`LAMPIRAN_TERLALU_BANYAK`, `POLI_TIDAK_VALID`, `TANGGAL_TIDAK_VALID`, `SLOT_PENUH`, `KOTA_NOT_ASSIGNED`, `CLIENT_UUID_CONFLICT`), dan satu yang tidak pernah dikirim server (`NOMOR_TIDAK_VALID`) | `konsultasi.vue:19`; `klinik.vue:43`; `kpi-outbox.ts:55`; `LacakTiket.vue:12` | Lengkapi peta; tes penjaga drift (regex `ProgramError(…, "KODE")` × peta web) | 06 (W8/W9) |
| B36 ✓ | Unduhan ekspor hanya mengecek pemilik job; peran dan scope tidak dicek ulang | `analysis/index.js:141-163`; `tabular/index.js:466-507` | `resolveOperator` sebelum cek pemilik; simpan `permissionScopeOf(operator)` saat submit, dan tolak bila sudah berbeda | 01 |
| B37 ✓ | Kabkota bisa mengunduh PDF passport kotanya, tetapi `GET /passport` ditolak (tidak konsisten) | `passport/pdf.js:198`; `passport/service.js:16-17` | Tergantung keputusan K8 | 01 |
| B38 ✓ | Nama instansi ditulis 5 versi. Label juga menyimpang: "Rekomendasi" (3 versi), Talent Pool/Lab, 4 peta skala, format harga | `export-renderer.js:171,408,498`; `qr-pdf.ts:34`; `analytics-slide.ts:120`; `PROGRAM.ts`; `lib/katalog.ts` | Satu konstanta `INSTANSI` di server dan satu di web; satu konstanta per konsep; harga memakai `hargaLabel` dari server (menunggu K21) | 05, 06 (W12) |
| B39 ✓ | Logika filter Tabular ganda. Kunci kota kabkota (`lockedKotaId`) hanya ada di `TabularData.vue`, tidak di `useTabularFilters` yang dipakai `spasial.vue` dan `dashboard/index.vue`. Server tetap menegakkan scope, jadi dampaknya UX | `TabularData.vue:99,150,260`; `useTabularFilters.ts` | Pindahkan ke composable dan uji dengan Vitest | 06 (W11) |
| B40 ✓ | `readSingleton("kontak_hotline")` disalin di 4 halaman | `PengantarKlinik.vue:24`; `bantuan.vue:22`; `faq.vue:29`; `katalog/[id].vue:37` | Composable `useKontakHotline()` dengan satu key `useAsyncData` | 06 (W13) |

### 2.5 Kode mati dan jebakan (hapus)

- `shared/auth.cjs:62-68,94-95`: `requireRole`/`requireApplicationUser` tidak punya pemanggil, dan `roleKeyOf` memetakan UUID bersama ke `provinsi`. Bila dipakai, fungsi ini akan menolak semua kabkota nyata. **Hapus sebelum ada yang "memakai ulang".**
- `lib/notify.js` (program): tidak diimpor di mana pun. ✅ **dihapus** `a17e1f4` (grep `notify` di `src/`, `test/`, `package.json`, `oas.yaml` kosong).
- `POST /operasional/internal/resolve-nib` (`operasional/src/index.js:58-68`): login memakai `authentication/src/lib/utils/identity.js`.
- `GET /operasional/aktivitas` + `audit-sesi.vue`: duplikat `/v1/auth/activity` dan tidak ada di menu. Hapus beserta entri `ROLE_ROUTES`, `roles.test.ts:54,79,91`, dan mock-nya (keputusan K6).
- Worker: cabang `request.result`, cabang `aggregate_csv`, `passport_pdf`/`katalog_pdf` (`exporter.js:547,557,630,645-655`), dan `renderDokumenPdf`/`teksPdf` di `export-renderer.js:238-456`.
- Web: `nav/RoleBadge.vue`, `ROLE_LABELS`/`ROLE_BADGE_CLASSES`, `RoleKey`/`OperatorProfile` (`types/operasional.ts:38-46`), dan `KLINIK_SLOTS` (`PROGRAM.ts:143`). ◐ `KLINIK_SLOTS` **dihapus** `a17e1f4`. ✅ **`RoleBadge.vue` + `ROLE_LABELS`/`ROLE_BADGE_CLASSES` + `RoleKey`/`OperatorProfile` dihapus `eec732a`** (tanpa pemakai sejak B23; badge header memakai `APP_ROLE_BADGES` via `appRoleBadge`; tes `roles.test.ts` dialihkan; e2e akun+roles+kabkota 16/16 hijau).
- Worker §2.5 (cabang `request.result`, `aggregate_csv`, `passport_pdf`/`katalog_pdf`, `renderDokumenPdf`/`teksPdf`): **belum**, karena `aggregate_csv` masih tipe ekspor yang dikirim web (`ExportDialog.vue`) dan `exports-service.js:252` menanganinya — perlu analisis tipe job dulu sebelum dihapus.
- Tiga salinan `lib/utils/auth.js` dengan md5 identik (program, authentication, analytics) digabung ke module Cakupan Pemanggil (langkah C1-6). Update 28 Sep malam: module `analytics-shared/cakupan.cjs` sudah mendarat (`7e774f6`); penghapusan salinan dijadwalkan setelah migrasi route pertama memakai module.

### 2.6 Tes mock Playwright yang merah (gate Y10)

Receipt Y10 mencatat 8 kegagalan. Run ulang menunjukkan 7/10 lalu 10/16 gagal, jadi sebagian flaky. Ada tujuh penyebab, dan semuanya bisa diperbaiki tanpa menyentuh kode produk:

1. `role=status` ganda karena `<NuxtRouteAnnouncer />`. Gunakan `getByRole("main").getByRole("status")`.
2. `toHaveURL(/\/dashboard\/akun$/)` sudah cocok dengan `/sign-in?returnTo=/dashboard/akun` (positif palsu). Gunakan `waitForURL(u => u.pathname === …)`.
3. Login mock tidak menyetel cookie sesi, sehingga reload penuh di-SSR sebagai anonim. Tambahkan `set-cookie: diskuk_session=mock` (M15).
4. SSR bertanya ke mock statis, yang menjawab `/v1/program/*` dengan `{data:{}}`. Gunakan navigasi sisi klien, dan buat mock **gagal keras** pada rute yang tidak dikenal (M13).
5. Klik sebelum hidrasi. Tambahkan helper `waitForHydration(page)`.
6. Ekspektasi basi "Halal: Terverifikasi". Gabungkan `passport.spec.ts` ke `produk-passport.spec.ts` atau pakai `getByTestId`.
7. Re-optimisasi dependency Vite dev (`runtime-core` dengan dua hash). Tambahkan ke `optimizeDeps.include`, atau jalankan gate terhadap `nuxt build && nuxt preview`.

Selain itu ada divergensi mock yang harus ditutup: M11 (SSR `/users/me` tanpa `kota_scope`/`usaha`), M12 (dua salinan `OPERATOR_FIXTURES`), dan M14 (`/aktivitas` berupa array telanjang). Daftar lengkap M1–M15 ada di Kandidat 06.

Kriteria selesai: tiga run berturut-turut `akun`, `passport`, dan `produk-passport` hijau.

---

## 3. Urutan eksekusi

Setiap gelombang punya perintah verifikasi. Jangan mulai gelombang berikutnya sebelum yang sekarang hijau.

| Gelombang | Isi | Kenapa di sini | Verifikasi |
|---|---|---|---|
| **0: P0 + higiene tes** | B01–B07 (+ B23 bersama B06). Paralel: §2.6 (tes mock), M13–M15, hapus `requireRole` | Kebocoran data tidak perlu menunggu refactor. Tes mock membuka gate Y10 | `node --test services/directus/extensions/program/test/*.test.js`; `cd services/directus/extensions/analytics && node --test test/*.test.js`; `cd services/analytics-worker && node --test test/*.test.js`; Playwright mock `akun`/`passport`/`produk-passport` 3× hijau; B06: cek `information_schema.columns` di stack disposable |
| **1: Harness Postgres** (04 langkah 1–2) | `scripts/test-db-template.sh`, `test-support/pg-harness.mjs`, `directus-fakes.mjs`, `fixtures.mjs`, script `test:pg` | B11–B13, B21, B22 dan semua kandidat berikutnya butuh tes yang menjalankan SQL sungguhan | `bash scripts/test-db-template.sh && DISKUK_TEST_PG_URL=… node --test …/program/test/pg/smoke.test.js` |
| **2: P1 dengan tes pg merah → hijau** | B10+B12, B11, B13 (+ migrasi index), B21, B22, B19, B20, B14, B15, B17, B18, B16, B08, B09 | Setiap bug mendapat tes yang tidak bisa dibohongi oleh fake | `pnpm --dir services/directus/extensions/program test:pg` + suite biasa |
| **3: Kandidat 01, Cakupan Pemanggil** | Module `cakupan.cjs`, adapter `terjaga`/`publik`, tes manifest route, migrasi `app_role`, web kapabilitas (bila K4), ADR-009 → Accepted | Gate yang wajib dideklarasikan mencegah kelas bug B01–B05 muncul lagi di endpoint baru. Module ini juga menyediakan `operator` bagi 03 | Tes matriks peran × resource di pg; tes manifest; `pnpm run build` di keempat bundle |
| **4: Kandidat 03, compiler shared** | `analytics-shared/query-compiler.cjs`; router dan worker memakai module yang sama; hapus salinan di worker | Menutup drift ekspor secara permanen. Butuh `operator` dari 01 | Tes paritas canvas = ekspor di pg; `docker compose build directus analytics-worker` |
| **5: Kandidat 02, Outbox Notifikasi** | Migrasi `notifikasi_outbox`, `lib/outbox/`, klinik dan kegiatan dipindah, satu hook cron | Butuh harness untuk tes SKIP LOCKED. **Setelahnya satu bukti sandbox WhatsApp menutup M7-09 (Y07) dan M7-12 (Y08) sekaligus** | Tes interface Outbox 1–9 (lihat Kandidat 02); migrasi up/down/up |
| **6: Kandidat 06 + use case 04** | Rules murni klinik/katalog, DTO `transisi`/`statusLabel`, mock mengimpor rules (M1–M10), `lib/klinik.ts`; ekstraksi use case per fitur (katalog → kpi → klinik → talent/passport/legalitas/peta → kegiatan) | Drift web dan mock hanya bisa ditutup setelah server mengirim field turunan | Tes penjaga drift kode error; `grep -c "stubDatabase\|fakeDb\|match:" test/*.test.js` turun ke 0 |
| **7: Kandidat 05, Dokumen** | `analytics-shared/dokumen.cjs`; program dan worker memakainya; B26–B28 | Nilai paling rendah sampai ada kebutuhan dokumen baru, tetapi bug P2 bisa dipatch lebih awal | `pdftotext` memuat "Café" dan "·"; 120 baris → 3 halaman |

**Pemetaan ke blocker receipt Y10:**
- 8 tes mock merah → gelombang 0.
- WhatsApp "not provider-proven" → B17/B18 (gelombang 2) lalu Kandidat 02 dan satu bukti sandbox (gelombang 5).
- Receipt Y05 yang tidak ada, status partial Y04/Y07/Y09, dan 125 error oxlint **di luar cakupan dokumen ini**.

---

## 4. Keputusan terbuka

Keputusan bertanda **(pemilik produk)** menyangkut perilaku yang dilihat pengguna. Sisanya keputusan teknis dan boleh mengikuti rekomendasi kecuali ada keberatan.

| # | Keputusan | Rekomendasi | § |
|---|---|---|---|
| K1 | Status HTTP untuk target di luar scope **(pemilik produk)** | 404 seragam (keberadaan tidak bocor). `KOTA_NOT_ASSIGNED` tetap 403 | 01 |
| K2 | Lokasi module shared (Cakupan, compiler, Dokumen) | `services/directus/analytics-shared/`, karena terjangkau keempat bundle dan worker. Nama folder bisa dirapikan nanti | 01, 03, 05 |
| K3 | Sumber kebenaran usaha → kota | `usaha_tabular.kota_id` (ber-index, sudah dipakai 5 tempat; fail-closed selama latensi worker) | 01 |
| K4 | Menu dan route web **(pemilik produk)** | Kapabilitas dari `/operasional/me` menggantikan `ROLE_ROUTES` statis | 01 |
| K5 | `GET /legalitas/:usahaId` | Hapus, karena tidak ada pemanggil | 01 |
| K6 | `/operasional/aktivitas` + `audit-sesi.vue` | Hapus; `/v1/auth/activity` + `akun/aktivitas.vue` tetap | 01, 06 |
| K7 | Akun `provinsi` yang sudah ada (tidak bisa dibedakan dari default lama) **(pemilik produk)** | Tinjau manual dari daftar audit migrasi B06 | 01 |
| K8 | Kabkota dan passport **(pemilik produk)** | Boleh membaca passport usaha di kotanya (read-only), konsisten dengan PDF | 01 |
| K9 | Bentuk penyimpanan outbox | Rename `klinik_notifikasi` → `notifikasi_outbox` + kolom `kanal`/`pengingat`/`kedaluwarsa_pada`; `kegiatan_pengingat` menjadi langganan | 02 |
| K10 | Kapan membuktikan provider WA | Setelah module Outbox jadi, supaya satu bukti menutup Y07 dan Y08 | 02 |
| K11 | Bukti email | Penerimaan SMTP dengan `messageId` dianggap final (`butuhResi: false`) | 02 |
| K12 | Kapan pesan pengingat dirender | Saat jatuh tempo (enqueue), supaya perubahan judul/lokasi terbawa | 02 |
| K13 | Penjadwal notifikasi | Satu hook cron + kick setelah commit; hapus `setInterval` | 02 |
| K14 | Scope ekspor saat job jalan | Compile ulang dengan snapshot operator; tidak dievaluasi ulang (jendela maksimal TTL 24 jam) | 03 |
| K15 | Dua jalur PPT (browser dan worker) | Jalur server saja | 03 |
| K16 | Isolasi tes pg | Database per file (clone template) + fixture UUID acak | 04 |
| K17 | Postgres untuk tes | Service `postgis-test` (profile `test`, `tmpfs`, `127.0.0.1:55432`); sementara boleh `:15432` dengan guard nama DB | 04 |
| K18 | Letak use case | `service.js` berevolusi di tempat; `index.js` menjadi adapter HTTP tipis | 04 |
| K19 | Builder isi passport, QR di module Dokumen, uji PDF di CI | Builder di program; QR dikirim sebagai matriks; `pdfjs-dist` devDependency atau `pdftotext` di image CI | 05 |
| K20 | Web mengimpor rules backend atau server mengirim field turunan | Field turunan. Hanya mock dan tes yang mengimpor backend | 06 |
| K21 | Istilah kanonik "Talent Pool/Lab", "Akselerator/Accelerator" **(pemilik produk)** | Ikuti `BADGE` server dan brief | 06 |
| K22 | Kabkota di kurasi talent **(pemilik produk)** | Menu read-only | 06 |
| K23 | Tiket batal di kanban **(pemilik produk)** | Toggle filter; kanban tetap 5 kolom | 06 |
| K24 | Server e2e | `nuxt build && preview` untuk gate, `dev` untuk lokal | 06 |

---

## 5. Dokumentasi yang harus ikut berubah

- **ADR-007: ✅ ditangani** oleh [ADR-008](../../architecture/decisions/0008-app-role-single-application-role.md) (Accepted), yang mencatat model yang berlaku: satu role aplikasi + `app_role`, `kota_scope`/`usaha`, login NIB lewat hook, ALTCHA terverifikasi, dan identitas dari `readMe()`. Usulan penegakan ada di [ADR-009](../../architecture/decisions/0009-cakupan-pemanggil-fail-closed.md) (✅ Accepted 28 Sep 2026 malam, kandidat 01 tahap 1 `7e774f6`). Status ADR-007 sudah ditandai sebagian digantikan.
- **ADR-002 (outbox).** Tambahkan bagian atau ADR baru "Outbox Notifikasi": satu tabel pesan, klaim `SKIP LOCKED`, adapter per kanal, dan status `diterima` hanya dari resi provider.
- **ADR-006.** Compiler analitik berada di `analytics-shared` dan dipakai router maupun worker. Salinan di `rebuild.js` diturunkan dari `DIMENSIONS` shared.
- **ADR-004 #10.** Catat penegakannya: NIK tidak boleh di query string atau di `analitik_job.request` (B08).
- **`CONTEXT.md`: ✅ dibuat** di root repo, berisi glosarium domain dan istilah baru *Pemanggil*, *Cakupan Pemanggil*, *Wilayah Penugasan*, *Kapabilitas*, *Outbox Notifikasi*, *Langganan Pengingat*, *Pesan Notifikasi*, *Resi Provider*, dan *Dokumen*. Istilah Talent Pool/Lab dan Akselerator/Accelerator sengaja belum dimasukkan sampai K21 diputuskan.
- **`main_plan.md` / receipt fase.** Catat ID bug yang ditutup di receipt fase terkait saat patch masuk. Per 28 Sep 2026 addendum bertanggal sudah ditambahkan di `receipt_Y02` (B04, B05, B22), `receipt_Y03` (B21, B32), `receipt_Y04` (B03, B10+B12, B11, B22, B26, B27), `receipt_Y06` (B12, B26), `receipt_Y07` (B07, B17, B18, B22), `receipt_Y08` (B01, B14, B15, B24), dan `receipt_Y10` (ringkasan pasca-patch + verdict tetap `blocked`). **Y05 belum punya receipt**, sehingga B02, B09, B13, B19, B20, B26-agregat, B29, B30, dan B36 hanya tercatat di §2.0b.

---

# Lampiran: detail per kandidat

Bagian berikut adalah hasil penjelajahan mendalam per kandidat. Isinya: peta bukti, sketsa interface, seam dan adapter, langkah migrasi dengan verifikasi, tes yang dihapus/ditulis, perbaikan segera (sudah dikonsolidasi di §2 dengan ID B01–B40), dan keputusan terbuka (sudah dikonsolidasi di §4).

---

## Kandidat 01 — Cakupan Pemanggil

> **ID di §2:** bug 1→B01 · 2→B03 · 3–4→B04 · 5→B05 · 6→B06 · 7→B21 · 8→B36 · 9–10→§2.5 · 11→B16, B23. Keputusan → K1–K8.

Isi bagian ini dicek ulang langsung di kode pada 28 September 2026. Nomor baris mengikuti working tree saat itu.

### Ringkasan

Masalahnya: pertanyaan "siapa pemanggil ini dan apa yang boleh ia lihat" dijawab ulang di setiap endpoint, dengan cara yang berbeda-beda.
- Ada 4 cara memuat pemanggil: `loadActor` (`program/src/lib/access.js:7`), `actorKlinik` (`klinik/service.js:28`), dan 2 salinan `resolveOperator` (`shared/operator.cjs:52`, `analytics/src/lib/utils/operator.js:60`).
- Ada 3 sumber kota: `usaha_tabular.kota_id`, `analitik_usaha_current.kota_id`, dan join `alamat→kelurahan→kecamatan→kota` di `usaha-service.js:60-70`.
- Karena gate-nya opt-in, endpoint yang lupa memanggilnya bocor.

Solusinya: satu module deep di `services/directus/analytics-shared/cakupan.cjs`, ditambah adapter router yang mewajibkan setiap route mendeklarasikan peran. Semua keputusan akses (termasuk kota yang tidak diketahui dan peran yang kosong) ada di satu tempat, dan tes lintas-kota cukup ditulis sekali terhadap Postgres ter-migrasi.

### Peta route saat ini

| Bundle · route | Gate | Sumber kota | Kabkota tanpa kota / usaha tanpa kota | Di luar scope |
|---|---|---|---|---|
| program `GET /legalitas/:usahaId` | `routeGuard` saja 🔴 | — | — / — | **200 untuk semua** |
| program `GET /peta/:usahaId` | `loadActor` + `assertUsahaInActorScope` | `usaha_tabular` (LEFT JOIN, `lib/usaha.js:21`) | 403 / **lolos** 🔴 | 403; 404 bila usaha tidak ada (keberadaan bocor) |
| talent `GET /usaha/:id`, `POST /pengajuan`, `PATCH /pengajuan/:id`, `POST …/hitung-skor`, `POST …/tolak` | `loadActor` + `assertTalentAccess` + `assertUsahaInActorScope` | `usaha_tabular` | 403 / **lolos** 🔴 | 403 |
| talent `GET /pengajuan` | `assertTalentAccess` + filter inline (`talent/service.js:138`) | `usaha_tabular` | **semua baris** 🔴 / tersembunyi | — |
| talent `GET /berita-acara` | `routeGuard` saja 🔴 (`talent/service.js:316`) | — | — | 200 untuk umkm/pendamping |
| talent `POST /berita-acara` | `assertBeritaAcaraAccess` | — | 403 | 403 |
| kpi `GET /peserta`, `/peserta/:id`, `/laporan`, `PATCH …/pitching`, `POST /laporan/:id/review` | `pesertaScope` (+`canReview`) | `usaha_tabular` (EXISTS) | FALSE / tersembunyi | 404 |
| kpi `POST /peserta/:id/laporan` | replay `clientUuid` **sebelum** `pesertaScope` 🔴 (`kpi/service.js:177-183`) | `usaha_tabular` | FALSE | 404 (replay: 200) |
| katalog `GET /usaha`, `/produk`, `POST`/`PATCH /produk`, `GET /foto/:fileId`, `/loi` | `isCurator`/`canManage` (provinsi atau usaha sendiri) | tidak memakai kota | — | 403 |
| katalog `GET /kurasi`, `POST …/kurasi` | `isCurator` | — | — | 403 |
| passport `GET /` | `canView` (provinsi atau usaha sendiri) | — | kabkota 403 | 403 |
| passport `GET /pdf/summary`, `/pdf/katalog` | `assertUsahaInActorScope` (`pdf.js:198`) | `usaha_tabular` | 403 / **lolos** 🔴 | 403; kabkota bisa PDF tetapi tidak bisa `GET /` |
| passport `POST /`, `POST /:id/cabut` | `isCurator` | — | — | 403 |
| klinik `GET /tiket` | `actorKlinik` + `isStaff` + `cakupanPetugas` | `usaha_tabular` | 403 / tiket tersembunyi | tersembunyi |
| klinik `PATCH /tiket/:id` | `isStaff` + `bolehUbah` | `usaha_tabular` | ditolak / ditolak | 403 `BUKAN_PENUGASAN_ANDA` |
| klinik `GET /lampiran/:fileId` | `isStaff` langsung lolos 🔴 (`klinik/service.js:528-535`) | — | — | **staf: 200 untuk file apa pun** |
| klinik `GET /prefill` | `actorKlinik` (usaha sendiri) | — | — | — |
| publik: klinik `/poli`, `/slot`, `POST /tiket`, `/tiket/lacak`; katalog `…/pdf`, `POST /loi`; passport `/verify/:kode`; semua route kegiatan; auth `captcha/challenge` | tanpa sesi (captcha/rahasia bila perlu) | — | — | — |
| analysis `GET /metadata`, `/templates`, `/status`; tabular `GET /status` | `routeGuard` saja (umkm/pendamping ikut lolos) | — | — | data non-PII |
| analysis `/metadata/options`, `POST /query`, `/records`, `/exports` | `resolveOperator` + `scopeAnalysisRequest` | `analitik_usaha_current` | 403 / baris tidak cocok | filter dipaksa (ekspor bocor, lihat Kandidat 03) |
| analysis `GET /umkm/:id` | `assertUsahaInScope` (`scope.js:37`) | `analitik_usaha_current` | 403 / 404 | 404 |
| analysis `GET /exports/:jobId(/download)`; tabular `GET /export/:jobId(/download)` | `routeGuard` + pemilik job | — | — | 404; peran tidak dicek ulang |
| infographic `/`, `/map`; tabular `/`, `/options`, `/kelurahan`, `/export`, `/spasial`, `/spasial/tileset` | `resolveOperator` + `scopeTabularQuery`/`Options` | `usaha_tabular`/snapshot | 403 | kota dipaksa |
| tabular `/spasial/authorize` · `POST /publish` | kabkota 403 · adminOnly | — | — | — |
| operasional `GET /me` | `resolveOperator(requireAssignment:false)` | `kota_scope` | lolos (sengaja) | tidak ada pemanggil produksi |
| operasional `GET /aktivitas` · auth `GET /v1/auth/activity` | sesi + user sendiri | — | — | dua endpoint untuk hal yang sama |
| operasional `POST /internal/resolve-nib` | `routeGuard` (butuh sesi) + rahasia | — | — | tidak terjangkau pemanggil server |
| operasional `GET`/`PATCH /usaha/:id`, `POST …/verifikasi` | `resolveOperator` + `assertUsahaAccess` | join alamat live | 403 / 404 | 404 |

### Bentuk module (sketsa interface)

Module `analytics-shared/cakupan.cjs` (CommonJS, sama seperti `privacy.cjs`/`contracts.cjs`):

- **`muatPemanggil(database, accountability)`** → `{ id, admin, peran, kotaId, usahaId }`.
  - Admin menjadi `provinsi` tanpa query.
  - Baris akun tidak ada → 401.
  - `peran` null atau tidak dikenal → 403 `FORBIDDEN`.
  - Tidak pernah memakai default, dan tidak pernah membaca `accountability.appRole`.
- **`wajibPeran(pemanggil, daftar)`** → 403 bila peran di luar daftar. Biasanya dipanggil oleh adapter, bukan oleh handler.
- **`predikat(pemanggil, jenis, alias)`** → `{ sql, bindings }` untuk jenis `usaha` (kolom id usaha), `peserta`, `tiketKlinik`, dan `readModel` (kolom `kota_id` milik read model yang sedang dibaca).
  - Kondisi default adalah `FALSE`.
  - Kabkota tanpa kota → 403 `KOTA_NOT_ASSIGNED`.
  - Kota null tidak pernah cocok.
- **`pastikanUsaha(database, pemanggil, usahaId)`** → 404 `NOT_FOUND` seragam bila usaha tidak ada atau di luar scope, sehingga keberadaannya tidak bocor.
- **`kapabilitas(pemanggil)`** → daftar string (mis. `analitik.baca`, `talent.kelola`, `talent.ba`, `katalog.kurasi`, `klinik.petugas`, `kpi.kirim`, `kpi.review`) untuk `/me` dan web.
- **Error**: berbentuk `DirectusError` (`name`, `status`, `statusCode`, `code`, `extensions`), seperti `OperatorError` sekarang.

Adapter router ikut di module yang sama:
- `terjaga({ peran: [...] }, handler)`: memanggil `routeGuard` (UUID Application User), lalu `muatPemanggil`, lalu `wajibPeran`. Handler menjadi `(ctx) => (req, res, pemanggil)`.
- `publik(handler)` untuk route tanpa sesi.

Kedua adapter menandai handler dengan sebuah `Symbol`, dan satu tes manifest menolak route yang di-mount tanpa tanda itu. Dengan begitu handler tidak bisa di-mount tanpa deklarasi peran.

### Di balik seam

- **Postgres**: `directus_users(app_role, kota_scope, usaha)`, `usaha_tabular.kota_id`, `program_peserta(pendamping, usaha)`, `konsultasi_tiket(pendamping, usaha)`.
- **Sumber tunggal usaha→kota adalah `usaha_tabular.kota_id`.** Alasannya:
  - Kolom ini diturunkan dari join alamat yang sama dengan yang dipakai operasional (`legacy-tabular.js:28-60`, `refresh-dashboard-snapshots.sql`).
  - Worker memperbaruinya per record pada setiap proyeksi.
  - Sudah ber-index (`idx_usaha_tabular_kota`, migrasi `20260816B:24`).
  - Sudah dipakai oleh 5 tempat di program.
  - Join live empat tabel akan membebani setiap predikat list.
  - Usaha yang belum terproyeksi akan ditolak untuk kabkota (fail-closed, paling lama selama latensi worker).
- **Pengecualian:** list di read model analytics memakai kolom `kota_id` milik read model itu sendiri. Kolom itu ditulis oleh projector yang sama.
- **Tes**: module diuji terhadap Postgres ter-migrasi. Harness-nya dirancang di Kandidat 04.

### Langkah migrasi

Urutannya: perbaikan segera (bagian di bawah) lebih dulu, baru langkah-langkah ini.

1. **Buat `analytics-shared/cakupan.cjs`** berisi interface di atas, beserta `routeGuard`/`APPLICATION_ROLE_ID` (`APPLICATION_ROLE_ID` sudah diekspor `contracts.cjs`).
   - Cek: `node -e "require('./services/directus/analytics-shared/cakupan.cjs')"`, lalu tes matriks baru `services/directus/test/cakupan.contract.test.mjs`.
2. **Buat `sendError` program menghormati error berbentuk DirectusError.** `program/src/lib/utils/http.js:23-36` sekarang hanya mengenali `instanceof ProgramError`, sehingga error dari module akan menjadi 500.
   - Cek: `node --test services/directus/extensions/program/test/*.test.js`.
3. **Pindahkan program ke module.**
   - Hapus `lib/access.js`, `actorKlinik`/`isStaff` (`klinik/service.js:19-34`), bagian peran di `cakupanPetugas`/`bolehUbah` (`penugasan.js:49-78`, logika transisi tetap), `isCurator`/`canManage` (`katalog/service.js:24-25`), dan `isCurator`/`canView` (`passport/service.js:16-17`).
   - Ganti `guarded` lokal di `katalog/index.js:28`, `talent:23`, `kpi:12`, `passport:13`, `klinik:22`, serta router peta, dengan `terjaga`/`publik`.
   - Cek: `cd services/directus/extensions/program && pnpm run build` (memastikan rollup meng-inline `.cjs`), lalu jalankan tes.
4. **Pindahkan analytics ke module.**
   - Hapus fork `lib/utils/operator.js`, `assertUsahaInScope` (`scope.js:37`), dan `scopeTabularQuery`/`Options`.
   - `resolveScopedOperator` (`analysis/index.js:18`) tetap memetakan ke `AnalyticsApiError`.
   - Cek: `cd services/directus/extensions/analytics && node --test test/*.test.js && pnpm run build`.
5. **Pindahkan operasional ke module.**
   - Pakai `require("../../../analytics-shared/cakupan.cjs")`. Path ini valid dari `src/` lokal maupun dari `dist/` di container, karena `Dockerfile.directus:40` menyalin `/directus/analytics-shared`.
   - `assertUsahaAccess` (`usaha-service.js:55`) berpindah ke `pastikanUsaha`.
   - Hapus `extensions/shared/`.
   - Cek: `node --test services/directus/extensions/directus-extension-operasional/test/*.test.cjs`.
6. **Hapus salinan `auth.js` yang identik (md5 sama)** di analytics, authentication, dan program. Ketiganya mengimpor dari module.
   - Cek: `cd services/directus/extensions/authentication && node --test test/*.test.js && pnpm run build`.
7. **Tambah tes manifest** `services/directus/test/route-manifest.contract.test.mjs`. Tes ini me-mount semua bundle ke router perekam dan menegaskan setiap handler bertanda `terjaga`/`publik`, dengan daftar route publik yang eksplisit.
8. **Buat migrasi `20260928A-app-role-tanpa-default.js`.**
   - `ALTER COLUMN app_role DROP DEFAULT, DROP NOT NULL`. CHECK tetap berlaku; NULL berarti tanpa akses.
   - Rollback mengembalikan default.
   - Baris yang sudah ada tidak diubah otomatis. Keluarkan daftar audit `SELECT id,email,date_created FROM directus_users WHERE app_role='provinsi'` untuk ditinjau manusia.
   - Cek pada stack disposable: `SELECT column_default,is_nullable FROM information_schema.columns WHERE table_name='directus_users' AND column_name='app_role'`.
9. **Web.**
   - Bila keputusan 4 = kapabilitas: `/operasional/me` mengembalikan `kapabilitas`; `useAuth` memuatnya; `ROLE_ROUTES` (`ROLES.ts:25`) dan `NAVIGATION_LINKS` diturunkan dari kapabilitas.
   - Hapus fallback `?? "provinsi"` di `auth.global.ts:12,17`, `AppSidebar.vue:19`, `nav/User.vue:19`, `akun/index.vue:23`, dan `DEFAULT_APP_ROLE` (`ROLES.ts:107`).
   - Cek: `pnpm --filter ./apps/web exec vitest run tests/unit/roles.test.ts`, lalu Playwright `roles.spec.ts` dan `kabkota-scope.spec.ts`, termasuk `PLAYWRIGHT_USE_REAL_API=1`.
10. **Amandemen ADR-007.** ✅ Sudah ditulis sebagai ADR-008 (fakta yang berlaku, Accepted) dan ADR-009 (usulan, Proposed). Rincian asli:
    - Decision 1: satu UUID role Application User, dan peran ada di `directus_users.app_role` (NULL = tanpa akses, tanpa default).
    - Decision 2: `kota_scope` INTEGER FK (`ON DELETE SET NULL`, migrasi `20260926H:14`) dan `usaha`. Penegakan dilakukan oleh module Cakupan Pemanggil dan adapter `terjaga`/`publik`, dengan sumber kota `usaha_tabular.kota_id`, kota tak diketahui = tolak, dan di luar scope = 404.
    - Decision 8: identitas dari `readMe` atau `/operasional/me`.
    - Hapus penyebutan `requireRole` dan empat UUID role.
    - Decision 6 (CAPTCHA) diperbarui ke ALTCHA terverifikasi sesuai keputusan 27 September.

### Tes (hapus / tulis)

**Hapus atau tulis ulang:**
- `program/test/talent.test.js`: tes `:8`, yang hanya menguji gate UUID.
- `program/test/talent.test.js`: tes `:86-164`, yang menyuntik peran lewat fallback `accountability.appRole`/`kotaScope` karena db default mengembalikan `[]` (`helpers.js:14-18`). Tes ini mati begitu fallback dihapus.
- Kasus scope di `peta.test.js:94-128` dan `passport-pdf.test.js:185`, yang memakai fake substring SQL.
- `klinik.test.js:160`, yang mengunci perilaku bocor "staf boleh membaca lampiran apa pun".
- Tes `resolveOperator`/`assertUsahaInScope`/`scopeTabular*` di `analytics/test/scope.test.js:44-300`.
- Tes sinkron salinan di `services/directus/test/operasional-schema.contract.test.mjs:115-335`, termasuk `:306` (kontrak silang antar-fork).
- Tes wrong-role UUID di `directus-extension-operasional/test/index.test.cjs:91-176`.

**Tulis, di interface module, terhadap Postgres ter-migrasi:**
- Matriks peran `{admin, provinsi, kabkota(7), kabkota(null), pendamping, umkm(milik), app_role NULL, baris hilang}` × resource `{usaha kota 7, usaha kota 9, usaha kota NULL, peserta, tiket manual (usaha NULL), baris read model}` → allow / 404 / 403 `KOTA_NOT_ASSIGNED`.
- Tes manifest route (langkah 7).
- Satu smoke test per bundle untuk memastikan handler memakai `pemanggil` dari adapter.

### Perbaikan segera (bug)

Semua perbaikan di bawah bisa masuk sebelum deepening, sebagai patch kecil masing-masing.

1. **Lampiran klinik** (`klinik/service.js:522-532`).
   - Bila `milik` tidak ada → 404, termasuk untuk staf.
   - Staf hanya boleh membaca lampiran bila tiketnya lolos `cakupanPetugas(actor)` (tambahkan `(${cakupan.sql}) AS dalam_cakupan` ke query `milik`, alias `t`).
   - Tes regresi: pendamping + file id yang bukan lampiran → 404; kabkota(7) + tiket kota 9 → 404. Perbarui `klinik.test.js:160`.
2. **Legalitas.** Endpoint ini tidak punya pemanggil web (`grep program/legalitas` di `apps/web` kosong).
   - Rekomendasi: hapus entri `v1/program/legalitas` di `program/package.json`, `src/endpoints/legalitas/`, dan `test/legalitas.test.js`.
   - Alternatif: pasang gate seperti peta.
   - Tes: umkm `GET` usaha lain → bukan 200.
3. **Talent `listPengajuan`** (`talent/service.js:138`). Kabkota tanpa `kotaScope` → 403 `KOTA_NOT_ASSIGNED`.
   - Tes: kabkota null → 403.
4. **Talent `listBeritaAcara`** (`talent/service.js:316-331`). Tambahkan `loadActor` + `assertTalentAccess`.
   - Tes: umkm/pendamping → 403. Halaman `talent/kurasi.vue:30` tetap berjalan untuk provinsi/kabkota.
5. **`assertUsahaInActorScope`** (`access.js:68`). Ubah menjadi tolak bila `usaha.kotaId == null` atau berbeda.
   - Tes: peta/talent/PDF, kabkota + usaha kota NULL → 403.
6. **`loadActor`** (`access.js:23-25`). Hapus fallback `accountability.*` dan `"provinsi"`.
   - Baris tidak ada → 401 (seperti `actorKlinik`).
   - `app_role` null → peran null, sehingga semua predikat menolak (`pesertaScope` → FALSE, `assert*` → 403).
   - Sertakan migrasi langkah 8.
   - Tes: talent/peta memakai fake baris `directus_users`, bukan fallback accountability.
7. **KPI replay** (`kpi/service.js:176-184`).
   - Pindahkan `loadPeserta(trx, actor, id, {lock:true})` + `canSubmit` ke sebelum lookup `client_uuid`. Ini juga menyerialkan retry bersamaan pada lock peserta.
   - Tes: umkm lain me-replay `clientUuid` peserta X → 404.
8. **Unduhan ekspor (P2)** (`analysis/index.js:141-163`, `tabular/index.js:466-507`).
   - Panggil `resolveOperator` sebelum pengecekan pemilik.
   - Simpan `permissionScopeOf(operator)` saat submit, dan tolak unduhan bila sudah berbeda.
9. **Jebakan `requireRole`.** Hapus `requireRole`/`requireApplicationUser` (`shared/auth.cjs:62-68,94-95`), yang tidak punya pemanggil. Fungsi ini akan memberi 403 ke semua kabkota nyata, karena `roleKeyOf` (`:25-31`) memetakan UUID bersama ke `provinsi`.
10. **Operasional.**
    - Hapus `POST /internal/resolve-nib` (`index.js:58-68`, `resolveNib`/`assertInternalSecret` di `me-service.js`). Login memakai `authentication/src/lib/utils/identity.js`.
    - `/aktivitas` (`index.js:47-57`) menduplikasi `/v1/auth/activity`, dan halaman pemakainya `audit-sesi.vue` tidak ada di menu (menu mengarah ke `/dashboard/akun/aktivitas`, `nav/User.vue:64`). Hapus keduanya, beserta entri `ROLE_ROUTES`, `roles.test.ts:54,79,91`, dan mock `mock-directus.mjs:272` serta `mock-directus-server.mjs:202`.
11. **Web.**
    - Tambahkan `"/dashboard/klinik"` ke `ROLE_ROUTES.kabkota` (`ROLES.ts:43-54`), karena server (`klinik/service.js:19`, `penugasan.js:51`) dan halaman (`klinik.vue:19`) sudah menganggap kabkota petugas.
    - Tambahkan menu Talent (kurasi) dan Klinik untuk kabkota di `NAVIGATION.ts:99+`.
    - Di `auth.global.ts:11-17`: bila `!isRoleKey(app_role)`, logout lalu arahkan ke `/sign-in?error=peran`. Saat ini pengguna diarahkan ke `/dashboard`, yang sendiri ditolak `hasRouteAccess(undefined)`, sehingga redirect berulang (latent).
    - Tes: `roles.test.ts` untuk kabkota→klinik, dan unit middleware untuk peran kosong.

### Keputusan terbuka

1. **Status di luar scope.**
   - Rekomendasi: 404 seragam, seperti analytics dan operasional sekarang.
   - Alternatif: tetap 403 di program dan klinik.
   - `KOTA_NOT_ASSIGNED` tetap 403, karena menyangkut keadaan pemanggil sendiri, bukan keberadaan target.
2. **Lokasi module.**
   - Rekomendasi: `analytics-shared`. Lokasi ini terjangkau oleh keempat bundle, dan juga oleh worker (`Dockerfile.analytics-worker:7`), yang dibutuhkan Kandidat 03.
   - `extensions/shared` tidak terjangkau worker.
   - Nama folder bisa dirapikan belakangan.
3. **Sumber usaha→kota.**
   - Rekomendasi: `usaha_tabular.kota_id` (fail-closed selama latensi worker).
   - Alternatif: join live yang lebih mahal.
4. **Menu dan route web.**
   - Rekomendasi: kapabilitas dari `/operasional/me`.
   - Alternatif: tetap memakai `ROLE_ROUTES` statis yang sudah diperbaiki.
5. **`/legalitas`.** Rekomendasi: hapus (tanpa pemanggil). Alternatif: pasang gate.
6. **`/operasional/aktivitas` + `audit-sesi.vue`.** Rekomendasi: hapus.
7. **Akun provinsi yang sudah ada.** Default lama tidak bisa dibedakan dari pilihan sengaja, jadi daftar audit dari langkah 8 perlu ditinjau manual.
8. **Kabkota dan passport.** Kabkota sekarang boleh mengunduh PDF passport untuk kotanya, tetapi ditolak di `GET /passport`. Perlu diputuskan apakah kabkota boleh membaca passport di kotanya (rekomendasi: boleh, read-only), atau PDF-nya juga ditutup.

---

## Kandidat 02 — Outbox Notifikasi

> **ID di §2:** bug 1→B07 · 2→B17 · 3→B18 · 4→B14 · 5→B15 · 6→B31 · 7 ditunda ke deepening · 8 rekomendasi UX (tanpa ID) · 9→§2.5. Keputusan → K9–K13.


### Ringkasan

- **Masalah.** Dua outbox ditulis terpisah untuk satu masalah yang sama:
  - `klinik_notifikasi`, yang sudah deep: klaim SKIP LOCKED, backoff, dan resi.
  - Job pengingat di `kegiatan_pengingat`, yang shallow: SELECT lalu UPDATE per baris, tanpa backoff, tanpa resi.
- **Akibatnya:**
  - locality hilang;
  - bug hidup berada di glue masing-masing (starvation, template pembatalan yang salah, XSS);
  - gate provider Y07 (M7-09) dan Y08 (M7-12) harus dibuktikan dua kali.
- **Rekomendasi.** Kembangkan `klinik_notifikasi` menjadi satu tabel pesan `notifikasi_outbox` di balik satu module Outbox. `kegiatan_pengingat` tetap menjadi *langganan* (opt-in, token, jadwal) yang meng-enqueue pesan saat jatuh tempo.
- **Adapter di seam:** WhatsApp, Email, dan in-memory. Tiga adapter berarti seam-nya nyata.

### Dua outbox hari ini

| Aspek | `klinik_notifikasi` (20260926S:89-116, `klinik/notifikasi.js`) | `kegiatan_pengingat` (20260927A:50-71, `kegiatan/service.js`) |
|---|---|---|
| Satuan baris | satu **pesan** (template + payload yang sudah dirender) | satu **langganan**; pesan dirender saat kirim dari JOIN `kegiatan` (`adapter.js:35-54`) |
| Idempotensi | `idempotency_key` UNIQUE, `ON CONFLICT DO NOTHING` (`notifikasi.js:50-57`) | UNIQUE `(kegiatan, kanal, tujuan)`; upsert me-reset status dan percobaan (`service.js:201-217`) |
| Consent | kolom `consent`; tanpa consent tidak ada baris (`:48`) | opt-in itu sendiri adalah consent |
| Status | `pending → mengirim → terkirim → diterima` / `gagal` / `batal` | `menunggu → mengirim → terkirim` / `gagal` / `dibatalkan`, plus `menunggu_gateway` |
| Klaim | `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)` (`:62-80`) | SELECT `LIMIT 50` lalu UPDATE bersyarat per baris (`service.js:291-311`) |
| Lease | 5 mnt, diklaim ulang di query yang sama (`:23,70`) | 15 mnt, di-reset lewat UPDATE terpisah (`rules.js:34`, `service.js:284-289`) |
| Retry | 5×, backoff 1m/5m/15m/1j/6j (`:19-21,113-119`) | 3×, tanpa backoff: langsung `menunggu` dan dicoba lagi menit berikutnya (`rules.js:32`, `service.js:342-344`) |
| Resi provider | `provider_message_id`, `provider_status`, `provider_receipt`, callback `applyReceipt` (`:130-146`) | hanya `provider_id`; `providerStatus` dari adapter dibuang (`service.js:320`) |
| Tanpa gateway | tidak mengklaim apa pun (`:88`) | baris WA dipilih, diklaim, dan diparkir ulang setiap menit (`service.js:297,330-340`) |
| Penjadwal | `setInterval` saat registrasi endpoint (`klinik/index.js:32`, `notifikasi.js:151-159`), ditambah `kickDispatcher` setelah commit (`klinik/service.js:36-39`) | hook `schedule("0 * * * * *")` (`hooks/kegiatan-pengingat.js:9`) |
| Cek rahasia | `crypto.timingSafeEqual` (`klinik/index.js:43-46`) | `secret !== env…` (`kegiatan/index.js:83`) |
| Metadata Directus | collection dan fields terdaftar (20260926S:122-155) | collection terdaftar (20260927A:74-89) |
| Dipakai web | label status di DTO tiket (`klinik/service.js:294-297,323,374-380`) | `status` termasuk `menunggu_gateway` (`apps/web/app/types/program.ts:420`, `kegiatan.vue:192`) |

Tambahan: `lib/notify.js` (8 baris) tidak diimpor di mana pun (`grep -rn notify src test` hanya menemukan file itu sendiri).

### Bentuk module (sketsa interface)

Lokasi: `services/directus/extensions/program/src/lib/outbox/`. Isinya `index.js` sebagai interface, plus `adapters/{whatsapp,email,memory}.js`.

```text
buatOutbox({ database, logger, adapters, now? }) →
  enqueue(trx, { kunci, kanal, tujuan, template, pesan:{text,html?,params},
                 consent, tujuanTerverifikasi, sumber:{tiket}|{pengingat},
                 kirimPada?, kedaluwarsaPada? })          → row | null
  batalkan(trx, sumber)                                   → jumlah baris pending yang dibatalkan
  dispatch({ limit })                                     → { terkirim, gagal, dilewati }
  terapkanResi({ id? , providerMessageId?, status, receipt }) → row | null
  statusUntuk(sumber)                                     → { status, label } | null
```

**Invarian yang dipegang module (bukan pemanggil):**

1. `enqueue` selalu dijalankan di transaksi pemanggil, sehingga mutasi domain dan pesan sama-sama commit atau sama-sama rollback.
2. `kunci` unik. Enqueue ulang tidak menambah baris, dan tanpa `consent` tidak ada baris.
3. `dispatch` hanya mengklaim baris yang kanalnya punya adapter. Baris lain tetap `pending` tanpa percobaan terpakai. Ini menghapus starvation *by construction*.
4. Klaim memakai `FOR UPDATE SKIP LOCKED` dengan lease 5 menit, jadi aman untuk banyak instance maupun dispatch yang berjalan bersamaan.
5. Batas percobaan `max_attempts` dengan backoff. Kegagalan `permanen` langsung menjadi `gagal`.
6. Jika `butuhResi` = true pada adapter, respons 2xx hanya menjadi `terkirim`. Status `diterima` hanya bisa lewat `terapkanResi`.
7. Baris yang lewat `kedaluwarsaPada` (misalnya kegiatan sudah mulai) menjadi `batal` dengan `alasan='kedaluwarsa'`, tidak dikirim.
8. PII tidak masuk log. Log hanya memuat `jenis`, `attempts`, dan kode error (pola `notifikasi.js:120-123`).

**Error modes:**

- Adapter mengembalikan `{ok:false, permanen}` → retry atau `gagal`.
- Kanal tidak dikenal → `gagal` permanen.
- Resi dengan status yang tidak dikenal → `null` (pola `receiptStatus`, `whatsapp.js:97-102`).

### Adapter di seam

**Port:** `{ kanal, butuhResi, kirim({ tujuan, template, pesan }) → { ok, messageId, providerStatus, receipt, error, permanen } }`

| Adapter | Implementasi | `butuhResi` |
|---|---|---|
| WhatsApp | membungkus `sendWhatsApp` (`lib/whatsapp.js:52-94`, `fetchImpl` sudah injectable). `permanen` bila `http_4xx` (logika `adapter.js:84-86`) | `WHATSAPP_REQUIRE_CALLBACK` (default true) |
| Email | memindahkan `MailService` dari `kegiatan/adapter.js:63-68`. `messageId` SMTP menjadi `provider_message_id` | false: penerimaan SMTP (Mailpit di stack disposable) adalah bukti final |
| Memory | dipakai di tes: merekam kiriman dan bisa diskenariokan gagal (sementara atau permanen) | bisa dikonfigurasi |

Adapter hanya dipasang bila terkonfigurasi. Adapter WhatsApp tidak dipasang bila `WHATSAPP_GATEWAY_URL` kosong, dan status yang ditampilkan ke pengguna tetap "menunggu gateway" (diturunkan dari `pending` + kanal tanpa adapter).

**Penjadwalan:**

- Satu hook `schedule` (ganti nama `hooks/kegiatan-pengingat.js` menjadi `hooks/notifikasi.js`) menjalankan `jadwalkanPengingatJatuhTempo()` lalu `outbox.dispatch()`.
- Hapus `startDispatcher`/`setInterval` dari `klinik/index.js:32`.
- `kickDispatcher` setelah commit boleh tetap ada (fire-and-forget). Ini aman karena klaim memakai SKIP LOCKED.
- Anggap cron berjalan di **setiap** instance. Keamanannya datang dari klaim, bukan dari deduplikasi jadwal. Saya tidak memverifikasi apakah Directus 11 mendeduplikasi `schedule` antar-instance, jadi jangan bergantung padanya.

### Langkah migrasi

Kerjakan berurutan. Setiap langkah punya perintah verifikasi.

1. **Perbaikan segera** (bagian di bawah) dikerjakan dulu, supaya bug tidak ikut dipindahkan.
   - Verifikasi: `node --test services/directus/extensions/program/test/*.test.js`.
2. **Harness Postgres dari Kandidat 04.** Tes SKIP LOCKED dan konkurensi tidak bisa ditulis jujur dengan fake substring SQL.
3. **Migrasi `services/directus/migrations/20260928A-notifikasi-outbox.js`:**
   - `ALTER TABLE klinik_notifikasi RENAME TO notifikasi_outbox`. Baris dan resi yang sudah ada tetap utuh.
   - Tambah kolom:
     - `kanal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (kanal IN ('whatsapp','email'))`
     - `pengingat UUID NULL REFERENCES kegiatan_pengingat(id) ON DELETE CASCADE`
     - `kedaluwarsa_pada TIMESTAMPTZ`
     - `alasan VARCHAR(200)`
   - `tiket` dibuat nullable, ditambah `CHECK (num_nonnulls(tiket, pengingat) = 1)`.
   - `tujuan` diperlebar ke `VARCHAR(160)` (email). CHECK `jenis` ditambah `'pengingat_kegiatan'`.
   - Ganti nama index `idx_klinik_notifikasi_antrean`, dan buat index klaim baru `(status, kanal, next_attempt_at)`.
   - Perbarui metadata Directus: `directus_collections`, `directus_fields`, `directus_relations`, dan izin bila ada. Pakai `UPDATE … SET collection='notifikasi_outbox'`.
   - `kegiatan_pengingat.status`: CHECK menjadi `menunggu | dijadwalkan | dibatalkan`, dan pindahkan baris lama (`terkirim`/`gagal` → `dijadwalkan`, enqueue baris outbox historis bila perlu). `down` membalik semuanya.
   - Verifikasi: jalankan up/down/up di DB disposable, `\d notifikasi_outbox`, `SELECT count(*)` sebelum dan sesudah sama, lalu `node --test services/directus/test/*.test.mjs`.
4. **Module `lib/outbox/`.** Pindahkan `claimNotifikasi`, `dispatchNotifikasi`, `applyReceipt`, dan `BACKOFF_MS` dari `klinik/notifikasi.js`, lalu tambahkan filter kanal ber-adapter dan `kedaluwarsa_pada`.
   - Verifikasi: tes interface baru (lihat bagian Tes).
5. **Klinik.**
   - `service.js:273,492` memanggil `outbox.enqueue` dengan template dari `rules.js`: `pesanTiket`, `pesanStatusBerubah`, dan `pesanPembatalan` yang baru.
   - Subquery label (`:323`, `:374`) diganti `statusUntuk`/JOIN `notifikasi_outbox`.
   - Route `/notifikasi/receipt` (`index.js:36-64`) memanggil `outbox.terapkanResi`. Path lama tetap dipertahankan.
   - Hapus `klinik/notifikasi.js`, kecuali `STATUS_LABEL` yang dipindah ke outbox.
6. **Kegiatan.**
   - `prosesPengingat` menjadi `jadwalkanPengingatJatuhTempo`:
     - pilih langganan `menunggu` yang sudah jatuh tempo, dengan kegiatan `terbit` dan `tanggal_mulai > now`;
     - render `pesanPengingat`;
     - `outbox.enqueue` dengan kunci `pengingat:<id>:<jadwal_kirim ISO>` dan `kedaluwarsaPada = tanggal_mulai`;
     - tandai langganan `dijadwalkan`.
   - Langganan yang kegiatannya ditarik atau sudah lewat menjadi `dibatalkan`.
   - `batalkanPengingat` juga memanggil `outbox.batalkan`.
   - Opt-in ulang (upsert `:204`) memanggil `outbox.batalkan` untuk pesan lama sebelum reset.
   - DTO `status` tetap memakai kosakata lama (`menunggu_gateway`, `terkirim`, …), dipetakan dari status outbox, sehingga `types/program.ts:420` dan `kegiatan.vue:192` tidak perlu berubah.
7. **Hook dan paket.** Perbarui entri hook di `program/package.json:62-64`. Hapus `kegiatan/adapter.js` (email berpindah ke adapter), dan pertahankan `tautanBatal`/`pesanPengingat` di `kegiatan/`.
8. **Hapus `lib/notify.js`.** Perbarui `src/oas.yaml:61` serta catatan receipt Y07/Y08.

### Tes (hapus dan tulis)

**Dihapus**, karena tes itu menguji melewati interface dengan regex SQL:

- `whatsapp.test.js` bagian enqueue/dispatch/receipt (`:72-145`)
- `kegiatan.test.js` job test (`:397-453`)
- `klinik.test.js:180`

**Dipertahankan:**

- tes adapter WhatsApp murni (`whatsapp.test.js:27-70`);
- tes template di `klinik.test.js:58`;
- tes rahasia route (`klinik.test.js:164`), dipindah ke route yang sama.

**Ditulis baru di interface Outbox.** Butuh Postgres ter-migrasi dan adapter memory:

1. Enqueue idempoten: kunci yang sama dua kali menghasilkan satu baris. Tanpa consent tidak ada baris. `trx` pemanggil yang rollback berarti tidak ada baris.
2. Dua `dispatch` paralel: setiap baris terkirim tepat satu kali (SKIP LOCKED).
3. Lease habis membuat baris diklaim ulang. Pesan yang sedang dikirim tidak terkirim dua kali selama lease masih berlaku.
4. Retry: jadwal backoff ke-1 sampai ke-5, lalu `gagal`. Kegagalan `permanen` langsung `gagal`.
5. **Regresi starvation:** 60 baris WA tanpa adapter ditambah 1 email jatuh tempo → email terkirim, dan baris WA tetap tanpa percobaan terpakai.
6. Resi: dengan `butuhResi`, 2xx menjadi `terkirim`. Callback `delivered` menjadi `diterima`, status tidak dikenal menghasilkan `null`, dan `providerStatus` tersimpan.
7. `batalkan` terhadap pesan pending → tidak pernah dikirim. Lewat `kedaluwarsaPada` → `batal`.
8. Kegiatan: langganan kegiatan yang sudah lewat tidak di-enqueue, dan kegiatan yang ditarik membuat langganannya `dibatalkan`.
9. Klinik: transisi `batal → dijadwalkan → batal` menghasilkan dua pesan pembatalan dengan template pembatalan.

### Perbaikan segera (bug)

Bisa dikerjakan sebelum deepening. Setiap poin berisi patch minimal dan ide tes regresinya.

1. **Stored XSS di halaman batal pengingat.**
   - Penyebab:
     - `EMAIL_PATTERN` (`kegiatan/rules.js:172`) menerima `a@<img/src=x/onerror=alert(1)>.com`;
     - `maskTujuan` menghasilkan `a***@<img/src=x/onerror=alert(1)>.com`, dan hasilnya disimpan di `tujuan_masked`;
     - nilai itu diinterpolasi mentah ke HTML di origin Directus (`kegiatan/index.js:123,141`).
   - Direproduksi di memori ◐ lewat `node` terhadap `rules.js`.
   - Patch:
     - (a) helper `escapeHtml` yang dipakai untuk semua interpolasi di `index.js:118-142`;
     - (b) perketat pola menjadi `/^[^\s@<>"'`&]+@[a-z0-9.-]+\.[a-z]{2,}$/i`;
     - (c) escape juga `row.judul` dan `tempat` di HTML email (`adapter.js:48-51`);
     - (d) di DB disposable, jalankan UPDATE yang me-mask ulang `tujuan_masked` yang mengandung `<`.
   - Tes: opt-in dengan email tersebut menghasilkan 400 `TUJUAN_TIDAK_VALID`. Baris dengan `tujuan_masked` berisi `<b>` dirender sebagai `&lt;b&gt;`.
2. **Starvation pengingat.**
   - Penyebab: kandidat dipilih dengan `status IN ('menunggu','menunggu_gateway') … ORDER BY jadwal_kirim LIMIT 50` (`service.js:291-301`). Jadi ≥50 baris WA yang terparkir akan menutup email yang lebih baru.
   - Patch: `AND (p.status = 'menunggu' OR (p.status = 'menunggu_gateway' AND ?::boolean))` dengan binding `whatsappConfigured(env)`.
   - Tes: 51 baris WA terparkir ditambah 1 email → email ikut diproses. Untuk sementara pakai fake, lalu diganti tes interface.
3. **Pengingat untuk kegiatan yang sudah lewat.**
   - Penyebab: tidak ada filter `tanggal_mulai` (`service.js:297`). Begitu gateway dipasang, backlog lama ikut terkirim.
   - Patch: tambah `AND k.tanggal_mulai > ?` (`now`), dan satu UPDATE yang menandai baris kedaluwarsa menjadi `dibatalkan` dengan `alasan='kedaluwarsa'`.
   - Tes: kegiatan kemarin tidak dikirim dan statusnya `dibatalkan`.
4. **Pembatalan tiket klinik memakai template "tiket diterima".**
   - Penyebab: `isiPesan` hanya mengenali `status_berubah`, sehingga `pembatalan` jatuh ke `pesanTiket({id, nomor})` (`notifikasi.js:39-41`; pemanggil di `klinik/service.js:492-499`).
   - Patch: `jenis === "tiket_dibuat" ? pesanTiket(tiket) : pesanStatusBerubah(tiket, status ?? "batal")`. Ini memakai template `klinik_status_berubah` yang sudah ada, jadi tidak ada template provider baru.
   - Tes: enqueue `pembatalan` menyimpan template `klinik_status_berubah` dengan teks yang memuat "dibatalkan".
5. **Kunci idempotensi menelan transisi berulang.**
   - Penyebab: `pembatalan:<tiket>` tidak memuat status (`notifikasi.js:35-37`). Akibatnya `batal → dijadwalkan → batal` hanya memberi satu notifikasi, dan `dijadwalkan` kedua juga tertelan.
   - Patch: tambahkan `versi` baris setelah update (`klinik/service.js:455`, sudah dipilih di `row`) ke kunci `status_berubah` dan `pembatalan`. Retry request yang sama tetap aman karena `assertVersi` (`:466`) memberi 409.
   - Tes: dua pembatalan pada versi berbeda menghasilkan dua kunci.
6. **Rahasia job kegiatan dibandingkan dengan `!==`** (`kegiatan/index.js:83`).
   - Patch: ekstrak pembanding constant-time dari `klinik/index.js:43-46` ke `lib/utils/http.js` (`samaRahasia`) dan pakai di kedua route.
   - Tes: rahasia yang salah, termasuk yang panjangnya berbeda, menghasilkan 403.
7. **`providerStatus` dibuang** (`kegiatan/service.js:320`).
   - `kegiatan_pengingat` tidak punya kolom untuknya, jadi **tunda ke deepening**, karena outbox punya `provider_status`/`provider_receipt`.
   - Sampai saat itu, pengingat WA tetap dilaporkan `not provider-proven`.
8. **`tujuan_terverifikasi` hanya ditulis** (`klinik/service.js:279,496`), tidak pernah dibaca.
   - Rekomendasi: tampilkan sebagai penanda "nomor belum terverifikasi" di DTO kanban petugas. Jangan pakai untuk memblokir pengiriman, karena tiket manual juga memberi consent.
9. **`lib/notify.js` mati.** Hapus, lalu pastikan `grep -rn "lib/notify" services/directus/extensions/program` kosong dan tes program tetap hijau.

### Keputusan terbuka

1. **Bentuk penyimpanan.**
   - Rekomendasi: satu tabel pesan, didapat dengan mengubah nama `klinik_notifikasi` menjadi `notifikasi_outbox` dan menambahkan kolom.
   - Alasannya: baris dan resi Y08 tidak perlu disalin, integritas FK tetap terjaga lewat `num_nonnulls`, dan tidak perlu memetakan dua kosakata status.
   - Alternatif yang ditolak: dua tabel di balik module yang diparameterisasi nama kolom. Interface-nya selebar implementasinya (shallow), dan dua kosakata status tetap harus dipetakan.
2. **Kapan membuktikan provider untuk Y07 dan Y08.**
   - Rekomendasi: kerjakan perbaikan segera sekarang, dan jalankan satu bukti sandbox **setelah** module Outbox jadi, karena satu bukti itu menutup M7-09 dan M7-12 sekaligus.
   - Jika tenggat memaksa lebih cepat, bukti klinik dengan kode sekarang tetap sah untuk M7-12 saja.
3. **Semantik bukti email.** Rekomendasi: penerimaan SMTP dengan `messageId` (Mailpit) dianggap final (`butuhResi: false`), dengan label "Terkirim (SMTP)". Y07 sudah memakai bukti ini.
4. **Kapan pesan pengingat dirender.** Rekomendasi: saat jatuh tempo (enqueue), bukan saat opt-in, supaya perubahan judul atau lokasi kegiatan ikut terbawa.
5. **Penjadwal.** Rekomendasi: satu hook cron ditambah kick setelah commit, dan hapus `setInterval`.

---

## Kandidat 03 — Compiler analitik shared untuk worker ekspor

> **ID di §2:** bug 1→B02 · 2→B20 · 3→B19 · 4→B09 · 5→B08 · 6→B30 · 7→B29. Keputusan → K14–K15.


### Ringkasan
- Ekspor `aggregate_png`, `aggregate_pdf` dan `aggregate_pptx` tidak dihitung oleh compiler analitik. Worker menyusun SQL-nya sendiri dari salinan `DIMENSIONS`/`METRICS`/`filterSql`/`queryAggregate` (`analytics-worker/src/exporter.js:4-360`), dan salinan itu sudah menyimpang.
- Scope kabkota hanya dipasang di router (`analysis/index.js:127-139` → `scope.js:8-23`). `submitExport` untuk tipe gambar dan dokumen hanya menjalankan `assertSafeAnalysisConfig` (`exports-service.js:196-199`), yang tidak membatasi jumlah filter (`contracts.cjs:161-176`), lalu menyimpan `{config}` (`:287-293`).
- Jadi scope dan budget sebenarnya tidak punya module: keduanya hidup di dua implementation. Usulnya satu module compile di `analytics-shared` yang menerima config + operator + registry. Budget dan scope ditegakkan di dalamnya, lalu router dan worker memakai module yang sama.

### Bukti drift (✓ = dibaca di kode saat ini)

| Aspek | Compiler (`query-compiler.js`) | Worker (`exporter.js`) |
|---|---|---|
| Jumlah filter | lebih dari 8 → 422 `QUERY_COMPLEXITY` (:239-240) | `filters.slice(0, 8)` tanpa error (:160) ✓ |
| `status='active'` | ditambah hanya jika tidak ada filter `status_usaha` (:245-246) | selalu ditambah (:252). Filter `status_usaha=archived` jadi selalu 0 ✓ |
| Id field | registry `id` (UUID) atau `semantic_id`, plus cek `lifecycle_status` (:118-127) | hanya kunci semantik (`identifier`, :105-109). Id registry UUID yang diwajibkan ADR-003 #7 ditolak ✓ |
| Filter integer (kota/kecamatan/kelurahan_id) | `a.kota_id = ?::integer` (sargable); `unknown` → `IS NULL`; `contains` ditolak (:128-161) | `COALESCE(a.kota_id::text,'unknown') = $n`, yang tidak memakai index; ILIKE diizinkan ✓ |
| `kecamatan_nama` | kolom `a.kecamatan_nama` (:32) | ekspresi COALESCE ✓ |
| `groupBy` kosong | 422 `DIMENSION_REQUIRED` (:219) | diam-diam jadi `kota_nama` (:221) ✓ |
| `schemaVersion`, `aggregation`, metrik aktif | dicek (:194-214) | tidak dicek ✓ |
| Scan | satu scan dengan `SUM() OVER ()` (`query-service.js:606-621`, ADR-006 #2) | dua statement (:271-280) ✓ |
| Rollup/snapshot | fast path (`query-service.js:582-586`) | selalu memindai `analitik_usaha_current` ✓ |
| Generation | `detail_csv` mem-pin `generationId` (`exports-service.js:219-225`) | png/pdf/pptx memakai generation yang aktif saat job jalan (:548-550) ✓ |

Temuan lain:
- Salinan ketiga ekspresi dimensi ada di `rebuild.js:356-359` (`ROLLUP_DIMENSIONS`, "MUST stay aligned"). ADR-006 menerima ini sebagai biaya.
- **Kode mati:**
  - cabang `request.result` (:547, :557, :630); router tidak pernah mengirimnya
  - cabang worker `aggregate_csv`; router menyelesaikannya in-process di `exports-service.js:236-285`
  - `passport_pdf`/`katalog_pdf` (:645-655); keduanya tidak ada di `TYPES` (`exports-service.js:11-18`)
- **`title`:** hanya `request.title` yang dibaca (:562, :574, :633), padahal router tidak menyimpannya dan web tidak mengirimnya (`useAnalyticsExports.ts:27`). Semua dokumen server berjudul "Analitik UMKM".
- **Error config menjadi 500:** `assertSafeAnalysisConfig` melempar `Error{code}` tanpa `statusCode`, lalu `finishError` (`index.js:66-72`) menjadikannya 500.

### Bentuk module (sketsa interface)
`services/directus/analytics-shared/query-compiler.cjs`: CJS tanpa dependency, mengikuti pola `contracts.cjs`.

Operasi:
- `compileAggregate(config, { registry, operator }) → { whereSql, params, aggregateSelectSql, groupBySql, metric, limit, includeOthers, normalized, scopeKey }`
- `compileFilters(config, { registry, operator }) → { whereSql, params }` untuk `detail_csv` dan estimasi
- `aggregateSql(plan, { fromSql, placeholder: "?" | "$n" })` menghasilkan satu scan, dengan bentuk dari `query-service.js:606-621`

Invariant:
- `operator` wajib. Kalau `undefined`, module melempar error; tidak ada default provinsi.
- Untuk kabkota: filter kota dari klien dibuang dan budget dihitung atas filter klien **sebelum** filter `kota_id` disisipkan. Jadi filter kota tidak mengurangi jatah 8 filter dan tidak bisa terpotong. Kabkota tanpa kota → `KOTA_NOT_ASSIGNED`. Logika ini dipindah dari `scope.js:8-23`, dan `scope.js` tinggal menyimpan `permissionScopeOf`/`assertUsahaInScope`.
- Tidak ada pemotongan diam-diam. Setiap pelanggaran budget melempar `{status: 422, code: "QUERY_COMPLEXITY"}`.
- Error berupa `Object.assign(new Error(code), {status, code})`. Adapter analytics memetakannya ke `AnalyticsApiError`; worker memetakannya ke `error_code` job.
- Registry dimasukkan oleh pemanggil: router memakai `loadRegistryCached`, worker memakai `SELECT id, semantic_id, semantic_role, lifecycle_status FROM analitik_field`.

### Di balik seam
- Compile bersifat in-process. Seam ke Postgres termasuk kategori local-substitutable.
- Isi job cukup berupa snapshot yang tidak berubah: `{config: normalized (sudah di-scope), operator: {role, kotaId}, generationId, title}`.
- Worker meng-compile ulang dengan operator dari snapshot. Ini defense in depth: scope ditegakkan lagi oleh module yang sama.

### Langkah migrasi
1. Buat `analytics-shared/query-compiler.cjs` dengan memindahkan `DIMENSIONS`, `METRIC`, `registryField`, `integerFilterExpression`, `filterExpression`, `compileQuery` dan `compileFiltersOnly` dari `query-compiler.js:4-306`. Tambahkan parameter `operator` dan logika scope. Precedent: worker sudah mengimpor `../../directus/analytics-shared/*.cjs` (`projector.js:1`, `registry.js:1`), dan image worker menyalin folder itu (`Dockerfile.analytics-worker:7`).
2. Ubah `extensions/analytics/src/endpoints/analysis/query-compiler.js` jadi adapter tipis: re-export ditambah pemetaan error ke `AnalyticsApiError`. `query-service.js:567` meneruskan operator; `index.js` meneruskan `resolveScopedOperator` ke `queryAnalytics`.
3. `exports-service.js submitExport`: untuk semua tipe agregat, panggil `compileAggregate` sebelum `insertJob` sebagai validasi (hasilnya 422 bila melanggar). Pin `generationId` seperti `detail_csv`. Simpan `operator` dan `title`.
4. `exporter.js`:
   - Hapus :4-109 (`DIMENSIONS`/`FILTER_KEYS`/`METRICS`/`identifier`) dan `filterSql` :158-207.
   - Ganti bangunan SQL di `queryAggregate` dengan `compileAggregate` + `aggregateSql(plan, {placeholder: "$n"})`.
   - `detail_csv` (:579-591) memakai `compileFilters`.
5. Hapus kode mati: cabang `request.result`, `aggregate_csv` di worker (termasuk `aggregateCsv`, yang tetap dibutuhkan router lewat `csvFor`; periksa dulu sebelum menghapus), dan `passport_pdf`/`katalog_pdf` (lihat 05).
6. `rebuild.js:359` menurunkan `ROLLUP_DIMENSIONS` dari `DIMENSIONS` shared.
7. Verifikasi:
   - `cd services/directus/extensions/analytics && node --test test/*.test.js && pnpm run build`
   - `cd services/analytics-worker && node --test test/*.test.js`
   - `docker compose build directus analytics-worker`

### Tes (hapus / tulis)
- **Hapus:**
  - tes regex SQL worker yang memeriksa ekspresi salinan (`worker.test.js:160` untuk `queryAggregate`) setelah pindah
  - bagian `export-dokumen.test.js:98` yang memakai `request.result`/`request.title`
- **Pindahkan:** `analysis-query-compiler.test.js` dan kasus scope `scope.test.js:143-196` menjadi tes module shared, lewat interface `compileAggregate`.
- **Tulis:**
  - kabkota + 8 filter non-kota → `whereSql` memuat `a.kota_id = ?::integer` dan budget lolos
  - kabkota + 9 filter → 422
  - `operator` kosong → throw
  - filter `status_usaha=archived` → tidak ada `status='active'`
  - fieldId UUID dari registry diterima
- **Paritas canvas = ekspor:** di Postgres ter-migrasi (fixture generation kecil), `queryAnalytics(config, operator)` dan `processExport` untuk `aggregate_pdf` menghasilkan grup dan nilai yang sama. Pakai tes opt-in bila DB tersedia, seperti `analysis-integration.test.js`.

### Perbaikan segera (bug)
1. **Kebocoran ekspor kabkota dengan 8 filter ✓.** Patch minimal ada dua:
   - (a) `submitExport` memanggil `compileQuery(config, registry)` (sudah diimpor lewat `compileFiltersOnly`) untuk png/pdf/pptx sebelum `insertJob`. Karena config sudah di-scope, 9 filter → 422.
   - (b) `exporter.js:160`: ganti `slice(0, 8)` dengan throw bila lebih dari `QUERY_BUDGET.maxFilters`.

   Regresi: tes router bahwa kabkota + 8 filter + `aggregate_pdf` → 422 atau SQL memuat kota, dan tes worker bahwa 9 filter → error, bukan pemotongan.
2. **`status='active'` selalu ditambah ✓** (`exporter.js:252`). Samakan dengan `hasStatusFilter` seperti cabang `detail_csv` (:580-587). Tes: filter archived → klausa status tidak ada.
3. **Ekspor Tabular masuk ke antrean worker ✓** (`tabular/index.js:418`): `INSERT … status 'queued', export_type 'tabular_csv'`.
   - Dampak: worker bisa mengklaimnya (`queue.js:44`) lalu melempar `EXPORT_TYPE`.
   - Dampak: `cleanupExpiredExports` (`exporter.js:681-700`) menghapus dari `ANALYTICS_EXPORT_DIR` (`storage.js:3`), sedangkan berkas ada di `TABULAR_EXPORT_DIR` (`tabular/index.js:113`). Akibatnya berkas Tabular tidak pernah terhapus.
   - Patch: insert langsung dengan `status='processing'` dan `job_type='tabular_export'`, atau jalur yang tidak di-poll worker, lalu tambah cleanup TTL untuk direktori Tabular.
   - Tes: klaim worker tidak mengambil baris `tabular_csv`.
4. **Formula injection di CSV Tabular ✓** (`tabular/index.js:434-435`: hanya meng-quote). Pakai `csvCell` yang memberi awalan `'` untuk `=+-@` (`exporter.js:110-114`); pindahkan ke `analytics-shared`. Tes: `=HYPERLINK(...)` → `'=HYPERLINK`.
5. **NIK mentah di URL dan di job ✓.**
   - `TabularData.vue:268` memasukkan `q` ke `filterQuery`, dikirim lewat GET `?q=` (:303), dan placeholder (:556) mengajak mencari NIK 16 digit.
   - Ekspor menyimpan `{where, params, maxRows, filters: q}` di `analitik_job.request` (`tabular/index.js:418`), bertentangan dengan ADR-004 #10.
   - Patch:
     - (a) pencarian dikirim lewat POST body, atau NIK di-hash (HMAC) sebelum dikirim
     - (b) job hanya menyimpan filter non-PII; `q` 16 digit disimpan sebagai `"[NIK]"`/hash, `params` tidak disimpan
     - (c) jalankan scan log dan tabel job
   - Tes: `request` job tidak mengandung `/\d{16}/`.
6. **Error config ekspor menjadi 500 ✓** (`index.js:66-72`). Petakan `INVALID_ANALYSIS_CONFIG` ke 400.
7. **"Lainnya" hanya memuat satu grup ✓** (bug bersama, bukan drift). `LIMIT limit+1` (`exporter.js:272`, `query-service.js:~620`) lalu `slice(limit)`, sehingga "Lainnya" hanya berisi grup ke-(limit+1). Hitung overflow sebagai `metric_total − Σ grup` dari window `SUM() OVER ()`. Tes: 30 grup dengan limit 5 → Lainnya = sisa 25 grup.

### Keputusan terbuka
- **Evaluasi ulang scope saat job jalan.** Rekomendasi: tidak. Compile ulang dengan snapshot operator; download ulang tetap hanya oleh pemilik. Kalau role diturunkan setelah enqueue, job lama masih memakai hak lamanya, dengan jendela maksimal TTL 24 jam.
- **Placeholder.** Rekomendasi: compiler menghasilkan `?`, lalu helper shared mengubahnya ke `$n` untuk `pg` di worker.
- **Dua jalur PPT.** Browser (`analitik.vue` → `analytics-slide.ts` `downloadSlideDeck`) dan worker (`aggregate_pptx`, `export-renderer.js:468`). Rekomendasi: pertahankan jalur server saja, karena scope dan budget tercatat di job; web hanya meminta job.

---

## Kandidat 04 — Use case program + Postgres ter-migrasi

> **ID di §2:** bug 1→B11 · 2→B12 · 3→B13 · 4→B21 · 5 celah tes rollback (tanpa ID) · 6→B10 · 7→B32 · 8→B33 · 9→B22; `assertVersi` opsional di sketsa use case → B24. Keputusan → K16–K18.

### Ringkasan
- **Bentuk sekarang.** Interface setiap fitur program adalah handler `(req, res)` yang langsung memanggil knex mentah. Karena itu tes hanya bisa berpura-pura menjadi database dengan mencocokkan potongan teks SQL.
- **Akibatnya ada perilaku yang tidak pernah dijalankan tes:** transaksi, `FOR UPDATE`, `ON CONFLICT`, `SKIP LOCKED`, dan unique index parsial. Empat bug nyata lolos dari suite yang hijau (katalog edit 400, proxy foto 500, `ESCAPE` 500, race KPI).
- **Arah perbaikan (dua langkah):**
  1. Harness Postgres ter-migrasi. Satu database per file tes, di-clone dari template. Langkah ini tidak mengubah kode produk.
  2. Use case per fitur menjadi interface yang deep. `index.js` hanya menjadi adapter HTTP. Tes memanggil use case terhadap Postgres sungguhan.
- **Kategori dependency:** local-substitutable, yaitu Postgres yang sama dengan produksi dan dijalankan lewat Docker.

### Infrastruktur tes yang ada
- **Tes program.** `program/test/helpers.js:9-19`: `mountEndpoint` adalah router perekam. DB bawaannya `raw → {rows: []}`, dan transaksinya `transaction: fn => fn(db)` yang tidak bisa rollback. Sekitar 9 file menulis fake substring SQL sendiri; jumlah pencocokan SQL per file: talent 18, kegiatan 21, katalog 14, klinik 7, katalog-media 5.
- **Suite integrasi analytics** (`analytics/test/analysis-integration.test.js:3-8`) adalah suite HTTP ke Directus yang sedang hidup. Ia diaktifkan lewat `ANALYTICS_INTEGRATION_BASE_URL/EMAIL/PASSWORD` dan di-skip bila variabel itu kosong. Ini bukan harness Postgres, tetapi pola gating-nya layak ditiru.
- **Tes kontrak** `services/directus/test/*.contract.test.mjs` hanya membaca teks migrasi (`readFileSync`) dan tidak menjalankan SQL apa pun.
- **Migrasi.** Ada 44 migrasi Directus di `services/directus/migrations`. Migrasi ini membutuhkan:
  - tabel sistem Directus: `directus_files`, `directus_folders`, `directus_users`, `directus_access`, `directus_permissions`;
  - ekstensi `postgis` (`20250801A:5`), `pgcrypto` (`20260819B:10`), dan `pg_trgm` (`Q`);
  - schema `spatial` (`services/storage/pg/init-scripts/01-create-spatial-schema.sql`).
- **Cara migrasi dijalankan sekarang:** `services/directus/init.sh` di dalam image menjalankan `directus database install` lalu `database migrate:latest`. Runner Directus tidak membungkus migrasi dalam transaksi (`@directus/api/dist/database/migrations/run.js:40-56`), jadi `CREATE INDEX CONCURRENTLY` boleh dipakai (preseden: `20260819F`).
- **CLI Directus lokal gagal di Node 26.** `isolated-vm` dikompilasi untuk NODE_MODULE_VERSION 127, sedangkan Node 26 butuh 147. Akibatnya bootstrap template harus lewat image Docker. Sebaliknya, `knex@3.1.0` dan `pg@8.16.3` tersedia di `services/directus/node_modules/.pnpm`, dengan versi yang sama seperti runtime.
- **Stack disposable sedang berjalan.** Postgis ada di `127.0.0.1:15432`. Saya cek read-only: `standard_conforming_strings=on` dan `TimeZone=Etc/UTC`.
- Tidak ada CI (`.github/` tidak ada).

### Harness yang diusulkan
| File | Isi |
|---|---|
| `scripts/test-db-template.sh` | Idempoten. Langkahnya: (1) `DROP DATABASE IF EXISTS diskuk_test_template WITH (FORCE)` lalu `CREATE`. (2) `psql -f services/storage/pg/init-scripts/01-create-spatial-schema.sql`. (3) `docker compose -p "$PROJECT" run --rm --no-deps --entrypoint sh -v "$PWD/services/directus/migrations:/directus/migrations:ro" -e DB_HOST=postgis -e DB_DATABASE=diskuk_test_template directus -c "npx directus bootstrap"`. Koneksi langsung ke postgis, bukan lewat pgbouncer, dan volume migrasi di-mount supaya image yang basi tidak jadi masalah. (4) `ALTER DATABASE diskuk_test_template WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`. (5) `COMMENT ON DATABASE … IS '<sha256 isi folder migrations>'`. |
| `services/directus/test-support/pg-harness.mjs` | Menyediakan `withDatabase(t)`. Ia membaca `DISKUK_TEST_PG_URL` (mis. `postgres://diskuk_app:…@127.0.0.1:15432/postgres`), lalu menjalankan `CREATE DATABASE diskuk_t_<pid>_<n> TEMPLATE diskuk_test_template` dan mengembalikan instance knex. Knex di-`createRequire` dari `services/directus/node_modules` supaya versinya sama dengan runtime. Database di-drop di `after()`. **Guard keamanan:** host wajib `127.0.0.1`/`localhost`, nama DB wajib berawalan `diskuk_t_`, dan hash migrasi harus sama dengan COMMENT template; bila berbeda, gagal dengan pesan "jalankan scripts/test-db-template.sh". Bila env tidak diset, tes memanggil `test.skip(reason)`, meniru suite analytics. |
| `services/directus/test-support/directus-fakes.mjs` | Adapter in-memory di seam Directus. `FilesService.uploadOne` meng-INSERT baris **nyata** ke `directus_files` (folder, `uploaded_by`, `type`, `filesize`) dan menyimpan byte di sebuah `Map`. `AssetsService.getAsset` mengembalikan `{stream, file: <baris directus_files>, stat}`, yaitu bentuk asli di `@directus/api/dist/services/assets.js:190-250`: field-nya `type`, bukan `mimetype`. `MailService.send` hanya merekam. `getSchema: async () => ({})`. |
| `services/directus/test-support/fixtures.mjs` | Builder data: `kota`, `usaha` dan baris `usaha_tabular` (`kota_id`), `directus_users` (`role = APPLICATION_ROLE_ID`, `app_role`, `kota_scope`, `usaha`), `program_peserta`, `produk` beserta foto di folder tertentu, dan `konsultasi_tiket`. Semua id memakai `randomUUID()` supaya tes dalam satu file tidak saling bertabrakan. |
| `package.json` program dan analytics | Tambah `"test:pg": "node --test test/pg/*.test.js"`. Script `test` yang ada tetap murni tanpa database. |

- **Isolasi: satu database per file tes, bukan per tes.** Use case memiliki transaksinya sendiri, dan tes race membutuhkan ≥2 koneksi, sehingga rollback per tes tidak bisa dipakai.
- **Jembatan cepat:** `mountEndpoint(register, { database: knex, context: { services, getSchema } })` sudah bisa menjalankan handler yang ada sekarang dengan DB nyata, sebelum refactor apa pun. Tes regresi bug memakai jalur ini.

### Bentuk use case (sketch)
**Pola umum:**
- Kode: `endpoints/<fitur>/service.js` berevolusi di tempat menjadi `create<Fitur>({ db, files, notifier, clock }) → { verb(caller, …) }`.
- `caller` adalah pemanggil yang sudah di-resolve (dari Kandidat 01), bukan `req.accountability`.
- **Interface setiap verb:**
  - Validasi payload terjadi di dalam use case, demi locality.
  - Use case memiliki transaksinya sendiri.
  - Keluarannya DTO domain; kegagalan dilempar sebagai `ProgramError(status, code)`.
  - Efek setelah commit (`notifier.kick()`) dipanggil oleh use case.

1. **`katalog.editProduk(caller, produkId, body)`**
   - Urutan dalam satu transaksi: kunci produk (`FOR UPDATE OF p`) → `canManage` → pindahkan foto lama ke folder kurasi → validasi foto (harus di folder kurasi; `uploaded_by = caller` **atau** sudah terhubung ke produk ini; tipe/ukuran diizinkan) → `UPDATE` sekaligus reset status kurasi → `replaceFoto` → hasilkan `toProduk`.
   - Error: 400 `INVALID_PAYLOAD`/`FOTO_TIDAK_VALID`, 403 `FORBIDDEN`, 404 `PRODUK_NOT_FOUND`.
2. **`klinik.ubahStatusTiket(caller, tiketId, patch, versi)`**
   - `versi` **wajib**. Sekarang `assertVersi` langsung lolos bila `versi` undefined (`penugasan.js:~95`), sehingga optimistic lock bisa dilewati.
   - Urutan: kunci tiket → `bolehUbah` → `assertTransisi` → `UPDATE` (kode 23505 → 409 `SLOT_PENUH`) → `catatAudit` → enqueue ke Outbox (Kandidat 02) → commit → `notifier.kick()`.
   - Keluaran: baris tiket beserta label notifikasi.
3. **`kpi.kirimLaporan(caller, pesertaId, body)`**
   - Urutan: kunci peserta, termasuk scope → `canSubmit` → cari duplikat `client_uuid` **setelah** kunci → cek minggu → cek bukti → insert atau revisi.
   - Keluaran: `{ hasil: "dibuat" | "diulang" | "direvisi", laporan }`. Adapter memetakannya ke 201/200/200.

**Adapter HTTP:**
- `index.js`: `router.patch("/tiket/:id", http(async (req) => klinik.ubahStatusTiket(await callerOf(req), req.params.id, req.body, req.body?.versi)))`.
- `lib/utils/http.js#http` tetap memegang `sendError`, `noStore`, dan pemetaan status.
- **Multipart:** `readMultipart` (`klinik/service.js:133-164`) pindah ke `lib/http/multipart.js` sebagai adapter yang menghasilkan `{ fields, files: [{ filename, buffer }] }`.
- `sniffType` dan batas lampiran tetap di rules klinik (aturan domain) dan dipanggil oleh `klinik.buatTiket(caller | null, form, lampiran, captcha)`.
- Captcha diverifikasi di use case, karena urutannya bagian dari aturan: validasi → idempotensi → captcha.

### Inventaris tes (bertahan / diganti / baru)
| File (jumlah tes) | Bertahan (murni) | Diganti ke `test/pg` | Baru, belum pernah dieksekusi |
|---|---|---|---|
| `scoring` (7), `captcha` (2), `manifest` (3) | semua | – | – |
| `passport` (6) | canonical/sign/rotasi/kode (5) dan guard | – | issue → verify → tamper → cabut → terbit ulang |
| `kpi` (7) | `currentWeek`, streak, persen, predikat scope, guard | – | 201, replay 200, revisi yang ditolak, minggu belum mulai, `clientUuid` lintas peserta 409, **dua submit paralel dengan clientUuid sama → satu baris**, review setuju/tolak, pitching |
| `katalog-media` (5) | – | kelima-limanya (fake folder di :91 dan `mimetype` di :129 menyembunyikan B1/B2) | – |
| `katalog` (11) | validasi dan guard | LOI (idempotensi, rate limit, replay captcha), lembar spesifikasi | dua LOI paralel (unique parsial `idempotency_key`), kurasi (pindah folder) |
| `klinik` (13) | tanggal, nomor, sniff, telepon, isi pesan, guard | prefill, lampiran | `buatTiket` sukses (upload → insert → lampiran → outbox), kompensasi hapus file saat 409, **dua pemesan slot → 201 + 409** (`ux_konsultasi_tiket_slot`) |
| `klinik-penugasan` (10) | 6 tes murni (`transisiSah`, `assertTransisi`, `assertVersi`, `cakupanPetugas`, `bolehUbah`) | 4 tes berbasis mount | **rollback nyata:** audit gagal membatalkan `UPDATE` (lihat bug 5) |
| `kegiatan` (26) | ±12 tes rules (status temporal, link, normalisasi, jadwal, window WIB, filter) | ±14 tes list/detail/opt-in/batal/job | `ON CONFLICT` opt-in (`service.js:204`), dua job paralel, hook `hooks/kegiatan-pengingat.js` |
| `talent` (10) | validasi, guard, binding JSON | scope, Berita Acara, duplikat | dua klik BA paralel → satu BA |
| `legalitas` (7), `peta` (5), `passport-pdf` (4) | guard | semuanya (scope, null kota) | kedaluwarsa menurut WIB |
| `whatsapp` (12) | adapter gateway, pemetaan resi, `idempotencyKey` | enqueue/dispatch/backoff | dua dispatcher dengan `SKIP LOCKED` (koordinasi dengan Kandidat 02) |
| analytics `tabular-search` | `escapeLike`, klasifikasi NIK/NIB/KBLI/panjang minimal | regex SQL (:58-66) diganti eksekusi nyata | `%`/`_` literal, 5 digit KBLI, `EXPLAIN` dengan `SET enable_seqscan = off` untuk membuktikan index bisa dipakai |

### Langkah migrasi
1. **Harness dan template** (tanpa kode produk). Verifikasi: `bash scripts/test-db-template.sh && DISKUK_TEST_PG_URL=… node --test services/directus/extensions/program/test/pg/smoke.test.js`. Smoke test memeriksa `to_regclass('konsultasi_tiket')` dan ekstensi `postgis`/`pg_trgm`.
2. **Tes regresi untuk bug 1–4**, lewat `mountEndpoint` dengan knex nyata. Tes harus **merah dulu**, baru dipatch sampai hijau.
3. **Katalog lebih dulu.** Bug yang terbukti paling banyak ada di sini, dan logika foldernya bergantung pada `directus_files` sungguhan. Ekstrak use case, jadikan `index.js` adapter, lalu hapus `stubDatabase` di `katalog*.test.js`.
4. **KPI**, karena outbox offline di web bergantung pada kebenaran idempotensinya.
5. **Klinik:** adapter multipart dan unique index slot. Outbox-nya dikerjakan bersama Kandidat 02.
6. **Talent, passport, legalitas, peta**, setelah Kandidat 01 selesai, karena tes mereka sebagian besar tentang scope.
7. **Kegiatan**, bersama Kandidat 02.

Setiap langkah diverifikasi dengan:
- `pnpm --dir services/directus/extensions/program test` dan `DISKUK_TEST_PG_URL=… pnpm --dir … test:pg`;
- `grep -c "stubDatabase\|fakeDb\|match:" test/*.test.js`, yang angkanya harus turun sampai 0.

### Perbaikan segera (bug)
1. **Edit produk tayang selalu 400 `FOTO_TIDAK_VALID`** (`katalog/service.js:301-303`).
   - **Akar:** `assertKurasiPhotos` hanya menerima foto di folder kurasi (:163), padahal foto produk tayang ada di folder katalog. `pindahkanFoto` baru dijalankan sesudahnya.
   - **Patch:** jalankan `pindahkanFoto(trx, id, false)` **sebelum** `assertKurasiPhotos`. Beri `assertKurasiPhotos(trx, foto, actor, produkId)` pengecualian `uploaded_by = ? OR id IN (SELECT directus_files_id FROM produk_foto WHERE produk_id = ?)`, karena foto bisa diunggah kurator atas nama pemilik.
   - **Tes pg:** produk tayang dengan foto di folder katalog → PATCH pemilik menghasilkan 200, folder berpindah ke kurasi, dan status menjadi `menunggu`. Edit yang gagal harus rollback, dengan foto tetap di folder katalog.
2. **Proxy foto selalu 500** (`katalog/service.js:204`).
   - **Akar:** `getAsset` mengembalikan baris `directus_files` yang tidak punya field `mimetype`.
   - **Patch:** `setHeader("Content-Type", asset.file.type || "application/octet-stream")` ditambah `X-Content-Type-Options: nosniff`, sama seperti lampiran klinik (`klinik/service.js:533-535`).
   - **Tes:** perbaiki fake di `katalog-media.test.js:129` menjadi `{ type }` dan assert header-nya.
3. **Pencarian Tabular 500** (`analytics/src/lib/utils/tabular-filter.js:51,64`).
   - **Akar:** string JS `'\\\\'` menghasilkan SQL `ESCAPE '\\'`, dua karakter. Terbukti di Postgres disposable: `invalid escape string`, sedangkan `ESCAPE '\'` menghasilkan `t`.
   - **Patch:** hapus klausa `ESCAPE`. Backslash sudah menjadi escape bawaan LIKE di PostgreSQL, dan `escapeLike` (:23) sudah memakainya.
   - **Index** di `scripts/create-operasional-search-indexes.sql` tidak cocok dengan predikat:
     - `idx_usaha_nama_trgm` tidak pernah dipakai.
     - `idx_usaha_tabular_nama_trgm` tidak berguna sendirian, karena arm OR pada `produk_utama` dan `kegiatan_utama` tanpa index memaksa seq scan.
   - **Patch index:** jadikan migrasi baru (`20260928A-tabular-search-trgm.js`, `CREATE INDEX CONCURRENTLY`, preseden `20260819F`) dengan isi: trigram pada `usaha_tabular.nama`, `produk_utama`, dan `kegiatan_utama` (BitmapOr), ditambah `pelaku_usaha.nama_lengkap`; buang index `usaha.nama`.
   - **Aman terhadap refresh:** `refresh-dashboard-snapshots.sql:5` memakai `TRUNCATE`, sehingga index tidak hilang.
   - **Tes pg:** query tereksekusi, dan `EXPLAIN` memuat `Bitmap Index Scan` untuk ketiga index.
4. **Retry KPI paralel mendapat 409, bukan 200** (`kpi/service.js:177-182`).
   - **Akar:** pencarian duplikat `client_uuid` dijalankan sebelum `loadPeserta(…, { lock: true })`. T2 tidak melihat baris T1 yang belum commit, menunggu kunci peserta, lalu menemukan laporan minggu itu dan membalas `LAPORAN_SUDAH_ADA`. Replay juga dikembalikan **sebelum** cek scope/`canSubmit`.
   - **Patch:** kunci peserta dan jalankan `canSubmit` lebih dulu, baru cari duplikat. Di READ COMMITTED, statement baru setelah menunggu kunci akan melihat commit T1. Sebagai cadangan, tangkap 23505 pada `client_uuid UNIQUE` (migrasi `J:32`) lalu baca ulang dan balas 200.
   - **Tes pg:** `Promise.all` dua submit dari dua koneksi menghasilkan `{201, 200}` dan tepat satu baris.
5. **Transaksi palsu menyembunyikan rollback** (`klinik-penugasan.test.js:22,205`). `fn => fn(db)` tidak bisa membuktikan atomisitas. Gantinya tes pg: di DB tes, pasang trigger `BEFORE INSERT ON konsultasi_tiket_audit` yang `RAISE EXCEPTION`. PATCH harus menghasilkan 500, dan status tiket harus tetap.
6. **Unggahan katalog tanpa cek tipe/ukuran di server.**
   - **Akar:** validasi hanya ada di klien (`ProdukForm.vue:82`); `assertKurasiPhotos` hanya memeriksa folder dan pemilik. Karena proxy menyajikan file sesuai `type`-nya, SVG bisa tampil inline di origin Directus.
   - **Patch:** `assertKurasiPhotos` ikut memilih `type, filesize` dan mewajibkan `type IN ('image/jpeg','image/png','image/webp')` serta `filesize <= 5 MB`. Batas global saat ini 10 MB (`docker-compose.yml:176`).
   - **Catatan:** `type` diisi dari deklarasi pengunggah (lihat keputusan 6).
7. **Bukti KPI menerima UUID file apa pun.**
   - **Akar:** `kpi/service.js:144-147` hanya memeriksa bentuk UUID; web mengunggah tanpa folder (`kpi-outbox.ts:91`).
   - **Patch:** di dalam transaksi, `SELECT id FROM directus_files WHERE id IN (…) AND uploaded_by = ? AND type LIKE 'image/%'`. Bila jumlahnya tidak cocok → 400 `BUKTI_TIDAK_VALID`.
   - **Tes pg:** file milik akun lain ditolak.
8. **Validasi telepon berbeda antar fitur.**
   - Klinik (`klinik/rules.js:38-44`) hanya membuang `[\s-]` dan mewajibkan awalan 0/62/+62.
   - Kegiatan (`kegiatan/rules.js:188-193`) membuang semua non-digit dan menerima awalan `8…` tanpa kode.
   - LOI (`katalog/service.js:403`) punya regex ketiga.
   - Akibatnya `"(0812) 3456-7890"` dan `"81234567890"` diterima kegiatan tetapi ditolak klinik.
   - **Patch:** satu `normalisasiTeleponSeluler` di `lib/validate.js` untuk ketiganya. Tes table-driven tetap berupa unit tes murni.
9. **`CURRENT_DATE` dihitung dalam UTC.**
   - Lokasi: `lib/usaha.js:56`, `legalitas/service.js:20` (salinan SQL `loadLegalitas`, sebaiknya memanggilnya saja), trigger migrasi `K:122` dan `R:29,34`, serta default tanggal BA di `I:15`.
   - **Terbukti:** pada 04:26 WIB, `CURRENT_DATE` = 2026-09-27 sementara tanggal Jakarta = 2026-09-28. Sertifikat yang kedaluwarsa hari ini masih "terbit" sampai 07:00 WIB.
   - **Patch:** ganti dengan `(now() AT TIME ZONE 'Asia/Jakarta')::date` di kedua query, plus migrasi baru yang mendefinisikan ulang fungsi trigger R dan default BA.
   - **Tes pg:** `SET TIME ZONE 'UTC'` dengan fixture `berlaku_hingga` = kemarin menurut Jakarta.

### Keputusan terbuka
1. **Isolasi.** Rekomendasi: database per file (clone template) dengan fixture UUID acak. Transaksi per tes tidak cocok dengan use case yang memiliki transaksinya sendiri maupun dengan tes race.
2. **Postgres target.** Rekomendasi: service `postgis-test` di profile `test` compose (data di `tmpfs`, port `127.0.0.1:55432`), supaya tes tidak mengganggu stack disposable yang dipakai untuk bukti runtime. Sementara itu stack `:15432` boleh dipakai dengan guard nama DB.
3. **Tempat validasi.** Rekomendasi: di dalam use case (locality). Adapter HTTP hanya mengambil body dan multipart.
4. **Directus services.** Rekomendasi: fake di seam (Files/Assets/Mail). Directus asli adalah adapter kedua, dan bukti di level HTTP tetap ada di `*.directus.spec.ts`.
5. **Letak use case.** Rekomendasi: `service.js` berevolusi di tempat, tanpa ganti nama berkas, supaya diff tidak membengkak. `index.js` menjadi adapter tipis.
6. **Tipe file katalog.** Rekomendasi: sekarang cek metadata ditambah `nosniff`. Sniff byte (memakai ulang `sniffType` klinik) cukup bila produk memang membutuhkannya.
7. **Index pencarian.** Rekomendasi: tiga index trigram satu kolom, supaya predikat tidak berubah. Expression index gabungan menawarkan performa serupa tetapi mengubah semantik pencarian.

---

## Kandidat 05 — Module Dokumen

> **ID di §2:** bug 1, 2, 8→B26 · 3–5→B27 · 6→B28 · 7→B38. Keputusan → K19.

### Ringkasan
Ada 4 serializer PDF tulisan tangan dan satu salinan byte-per-byte. Isi dokumen passport dan katalog dibangun dua kali; salah satunya tak terjangkau. Semua renderer menaruh byte UTF-8 ke stream WinAnsi. Usulnya satu module Dokumen yang dependency-free di `analytics-shared`: model isi masuk, `Buffer` keluar.

### Bukti drift (✓ dibaca atau diuji)
**Inventaris generator:**

| Generator | Lokasi | Keterjangkauan |
|---|---|---|
| `renderPng` 900×560, bitmap font | `export-renderer.js:150` | ✓ terjangkau |
| `renderPdf` agregat | `:255-280`; `lines.slice(0, 28)`; non-ASCII → `?` | terjangkau |
| `renderDokumenPdf` | `:292-456` | dipakai hanya oleh cabang mati `exporter.js:645-655` |
| `renderAggregatePptx` | `:468` | terjangkau |
| Program `renderDokumenPdf` | `passport/pdf.js:20-175` | terjangkau; dipakai summary (:206), katalog (:321) dan lembar spesifikasi publik (`katalog/service.js:467-543`, impor :6) |
| Web `jpegPdf` | `qr-pdf.ts:32` | terjangkau (`usaha/passport.vue:115`) |
| Web `downloadSlideDeck` | `analytics-slide.ts:111` | terjangkau |

- **Salinan:** `diff` antara `export-renderer.js:292-456` dan `pdf.js:20-176` hanya berbeda di komentar ✓. `teksPdf` identik ✓. `buildPassportDokumen`/`buildKatalogDokumen` (`exporter.js:404-526`) menduplikasi isi `pdf.js:206-404`.
- **Encoding ✓ (pdftotext):** `Buffer.from(pdf)` (UTF-8) di stream `/WinAnsiEncoding` menghasilkan `Talent Passport Â· Ringkasan`, `CafÃ© Sunda` dan footer `Â· dibuat`. Baris panjang terpotong di tepi halaman karena tidak ada word wrap.
- **Skor ✓:**
  - Summary merata-ratakan 5 dimensi termasuk `skor_kinerja` (`pdf.js:230-237`), padahal Talent Index di passport adalah 4 pilar (`passport/service.js:169-171`).
  - Ambang 75 diberi label "Siap Akselerasi & Naik Kelas" (`pdf.js:285`), berbeda dengan `NAIK_KELAS_AMBANG` (`service.js:104`) dan `rekomendasiOf` (`talent/scoring.js:27-31`).
  - Label `kinerja` adalah "Inovasi & Produksi" (`pdf.js:249`); salinan worker memakai `skor.inovasi` (`exporter.js:415`).
- **Nama instansi berbeda-beda ✓:**
  - "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat" (`export-renderer.js:498`)
  - "DINAS KOPERASI DAN USAHA KECIL JAWA BARAT" (:171)
  - "DISKUK Provinsi Jawa Barat" (footer :408)
  - "Dinas Koperasi dan UKM Provinsi Jawa Barat" (`qr-pdf.ts:34`)
  - "DISKUK Jawa Barat" (`analytics-slide.ts:120`)
- **URL publik ✓:** `resolveBaseUrl` (`pdf.js:177`) dan `publicWebUrl` (`katalog/service.js:64`) identik, dan keduanya membaca `process.env` sebelum `env` yang diinjeksi.

### Bentuk module (sketsa interface)
`analytics-shared/dokumen.cjs`, tanpa dependency (folder itu tidak punya `package.json`/`node_modules`):
- `renderDokumen({ judul, subjudul, bagian: [{judul, baris[]}], qr?: {modul: boolean[][], ukuran}, meta: {generatedAt, sumber, halamanPublik} }) → Buffer`
- Module memegang:
  - encoding WinAnsi (`Buffer.from(…, "latin1")`, dengan `/Length` dan offset dihitung per byte latin1)
  - transliterasi `teksPdf`
  - word wrap berdasarkan lebar Helvetica
  - paginasi dan footer
  - satu konstanta `INSTANSI`
  - `publicUrl(env)`, dengan env yang diinjeksi didahulukan
- QR dikirim sebagai matriks (`modul`). Pemanggil meng-encode dengan `uqr` yang sudah ada di program (`package.json:86`) dan worker, karena module shared tidak bisa me-resolve `uqr`.
- Builder dokumen passport tunggal ada di program (`passport/dokumen.js`). Sumbernya baris `talent_passport` (skor dan payload bertanda tangan) ditambah `loadUsahaSummary`/`loadLegalitas`.
- Talent Index dan rekomendasi diambil dari satu fungsi yang diekstrak dari `service.js:171` beserta `NAIK_KELAS_AMBANG`.
- Tanpa passport aktif: tidak ada QR, tidak ada lencana, dan status ditulis "Passport belum diterbitkan".

### Di balik seam
Semua in-process. Rekomendasi: **PDF program tetap sinkron di endpoint Directus.** Alasannya:
- Y06 menetapkan lembar spesifikasi publik sebagai GET sinkron (`/katalog/produk/:id/pdf`).
- `usaha/passport.vue:134` mengharapkan blob langsung.
- Cabang job worker tidak pernah dipanggil.
- Worker cukup memakai module yang sama untuk PDF agregat.

### Langkah migrasi
1. Buat `analytics-shared/dokumen.cjs` dari `pdf.js:7-175` dengan perbaikan encoding dan wrap. Tambahkan `INSTANSI` dan `publicUrl`.
2. Program:
   - `pdf.js` dan `katalog/service.js:6,64,543` mengimpor dari shared (`import dokumen from "../../../../../analytics-shared/dokumen.cjs"`, pola `lib/usaha.js:1`).
   - Hapus `renderDokumenPdf`/`teksPdf`/`resolveBaseUrl`/`publicWebUrl` lokal.
   - Ekstrak `passport/dokumen.js`.
3. Worker:
   - Hapus `export-renderer.js:238-456` (`teksPdf`/`renderDokumenPdf`) serta `exporter.js:404-526` dan :645-655.
   - Hapus `passport_pdf`/`katalog_pdf` dari `extensionFor` (:131-132).
   - `renderPdf` agregat memakai `renderDokumen` dengan satu bagian tabel, tanpa batas 28 baris, dan menampilkan deskripsi filter (sumber config dari job).
4. Web `qr-pdf.ts`: hanya perbaiki bug :43 dan samakan string instansi (web tidak bisa memuat CJS server).
5. Verifikasi:
   - `node --test services/directus/extensions/program/test/*.test.js`
   - `cd services/analytics-worker && node --test test/*.test.js`
   - `pnpm run build` di program
   - `pdftotext` untuk setiap artefak

### Tes (hapus / tulis)
- **Hapus:** `export-dokumen.test.js:17-54` (pindah ke tes shared) dan :98 bagian `passport_pdf`/`katalog_pdf`.
- **Tulis di interface `renderDokumen`:**
  - hasil `pdftotext` memuat `·` dan `Café` persis
  - baris 300 karakter terbungkus dan semua kata ada di teks hasil ekstraksi
  - 120 baris → 3 halaman
- **Builder passport:**
  - tanpa passport → tidak ada "Talent Pool" dan tidak ada QR
  - Talent Index = rata-rata 4 pilar dan sama dengan badge Siap Naik Kelas
- **Web:** `qr-pdf.test.ts` → content stream hanya berisi operator valid.
- **Catatan:** `pdftotext` ada di mesin lokal. Untuk CI, pilih parser JS (misal `pdfjs-dist` sebagai devDependency; saat ini belum terpasang) atau tes berbasis byte latin1.

### Perbaikan segera (bug)
1. **Mojibake ✓ (pdftotext),** di kedua salinan: `Buffer.from(pdf, "latin1")`, `Buffer.byteLength(x, "latin1")` untuk `/Length` dan offset, dan `footerText` dilewatkan `teksPdf`. Tes: ekstraksi teks memuat "Café".
2. **Baris panjang tidak dibungkus ✓.** Tambahkan wrap sekitar 95 karakter pada ukuran 9 pt, dengan setiap potongan dihitung ke anggaran halaman (`LINES_PER_PAGE`).
3. **Skor ringkasan ✓** (`pdf.js:224-237, 285`). Hitung dengan 4 pilar dan pakai ambang serta label Siap Naik Kelas dari `service.js`. Kinerja tampil sebagai dimensi informatif berlabel "Kinerja Program".
4. **Lencana palsu ✓** (`pdf.js:270`: `|| "Talent Pool Jawa Barat"`; :269: `|| "Talent Pool"`). Ganti dengan "Belum ada" bila tidak ada passport aktif.
5. **Katalog "Aktif (DRAFT)" ✓** (`pdf.js:353`) dan QR ke `/passport/DRAFT` (`:217-218`, `:338-339`). Tanpa passport: status "Belum diterbitkan" dan `qr: null`.
6. **`qr-pdf.ts:43` ✓.** Kalimat mentah berada di luar `BT…Tj`. Bungkus dengan `textLine(24, 58, "F1", 7, …)`.
7. **Nama instansi ✓.** Pakai satu konstanta di server dan satu di web, dengan nilai "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat".
8. **PDF agregat dipotong 28 baris ✓** (`export-renderer.js:~268`, `slice(0, 28)`) dan **judul selalu default ✓.** Paginasi lewat module Dokumen. Web mengirim `title`, lalu router menyimpannya (lihat 03).

### Keputusan terbuka
- **Lokasi builder isi passport.** Pilihannya program (rekomendasi) atau shared. Karena sumber data hanya ada di program, taruh di program.
- **QR di module shared.** Pilihannya matriks dari pemanggil (rekomendasi) atau encoder yang diinjeksi.
- **Cara menguji PDF di CI.** Pilihannya menambah `pdfjs-dist` di devDependencies atau mengandalkan `pdftotext` di image CI.

---

## Kandidat 06 — Kontrak klinik satu sumber (web + mock)

> **ID di §2:** W1→B16 · W2→K22 · W4→B23 · W5→§2.5 · W6→B25 · W7→B34 · W8/W9→B35 · W10→K6 · W11→B39 · W12→B38 · W13→B40; tes mock merah → §2.6. Keputusan D1→K20, D3→K21, D4→K22, D5→K23, D6→§2.6, D7→K24.

### Ringkasan

Aturan klinik ditulis empat kali: di server, di halaman `.vue`, di konstanta web, dan di mock Playwright. Keempatnya sudah menyimpang.

- Web tidak punya status `batal`.
- Kabkota diblokir di web padahal server menganggapnya petugas.
- Mock melewati aturan klaim, scope, dan audit.
- Mock menjawab rute yang tidak dikenalnya dengan `200 {data:{}}`, sehingga kegagalan SSR tersamar.

Ada preseden yang bisa diikuti: `tests/fixtures/kegiatan-data.mjs:9-11` sudah mengimpor rules backend, jadi mock kegiatan tidak menyimpang dari server.

Arah perbaikannya:
1. Backend memegang rules murni.
2. Server mengirim field turunan (transisi yang boleh, label), jadi web tidak perlu mengimpor kode backend.
3. Mock mengimpor rules backend dan hanya menyimpan state.
4. Web mendapat satu module klien per fitur yang memegang route, DTO, dan pemetaan error.

Alasan web tidak bisa langsung mengimpor rules backend: image web hanya menyalin `apps/web` (`docker/Dockerfile.web:10-15`), dan `apps/web/pnpm-workspace.yaml` menjadikan `apps/web` root `fs.allow` Vite.

### Di mana aturan klinik tinggal hari ini

| Aturan | Server (sumber) | Web | Mock | Drift |
|---|---|---|---|---|
| Transisi status | `klinik/penugasan.js:17-26` | `dashboard/klinik.vue:34-41`, `maju()` :125 | `klinik-data.mjs:18-25` | Isinya identik hari ini, tetapi diurus tiga kali |
| Daftar status | `klinik/rules.js:6` (6 status) | `PROGRAM.ts:113-119` (5, tanpa `batal`); `types/program.ts:501` (6) | — | Tiket batal tak terlihat. `statusLabel` jatuh ke "Batal" untuk status apa pun yang tak dikenal (`klinik.vue:152`, `LacakTiket.vue:52`) |
| Klaim oleh pendamping | `penugasan.js:65-76` `bolehUbah` | tidak dicek | `mock-program.mjs:225` hanya menolak jika pendamping berbeda | Mock mengizinkan PATCH non-klaim pada tiket yang belum ditugaskan |
| Cakupan petugas | `penugasan.js:45-60` | `klinik.vue:19` (3 peran); `ROLES.ts:43-54` tanpa `/dashboard/klinik` | `mock-program.mjs:214` tanpa scope, ikut mengembalikan `batal` | Kabkota diblokir web; server menyaring `batal` (`service.js:394`) |
| Telepon | `rules.js:37-43` `normalisasiTelepon` | regex di `konsultasi.vue:149` | `mock-program.mjs:200` membandingkan nomor mentah | Mock tidak menormalisasi |
| Lampiran | `service.js:13-14,152,157` + `sniffType` | `konsultasi.vue:16-17` | tanpa batas | — |
| Tanggal & slot | `rules.js:4,16-26` | `KLINIK_SLOTS` di `PROGRAM.ts:143` (tidak dipakai) | `klinik-data.mjs:16`; POST tiket tanpa validasi tanggal, nama poli di-hardcode (`mock-program.mjs:163`) | — |
| Audit | `penugasan.js:88-113` (satu baris per jenis perubahan) | label di `klinik.vue:139` | satu baris dipilih berdasarkan prioritas (`mock-program.mjs:232`) | Jumlah baris audit berbeda |
| Kode error | `service.js` + `penugasan.js` | 3 peta: `konsultasi.vue:19`, `LacakTiket.vue:12`, `klinik.vue:43` | subset | Lihat W8/W9 |

### Lokasi rules bersama

- **Tetap di backend, dengan impor nol atau murni.**
  - Pindahkan `TRANSISI`, `transisiSah`, `VERSI`, dan `AKSI_AUDIT` dari `penugasan.js` ke `klinik/rules.js`.
  - Tambahkan fungsi murni `barisAudit({statusDari, statusKe, perubahan}) → rows[]`. `catatAudit` tinggal meng-INSERT hasilnya.
  - Tambahkan `dalamCakupan(actor, tiket) → boolean` (versi JS dari `cakupanPetugas`) dan `transisiUntuk(actor, tiket) → status[]`.
  - `penugasan.js` hanya berisi wrapper yang melempar `ProgramError` plus SQL.
- Buat `katalog/rules.js` baru. Isinya: `KURASI_STATUS` (sekarang `const` privat di `katalog/service.js:13`), `STATUS_TAYANG`, `validasiKurasi(body)` (mengangkat cek `CATATAN_WAJIB` dari `:341-344`), `hargaRange`, dan konstanta LOI.
- `kpi/rules.js` sudah murni.
- `klinik/rules.js` mengimpor `kpi/rules.js` (murni), dan `sniffType` baru memakai `Buffer` saat dipanggil, jadi aman diimpor dari mock Node.
- **Web tidak mengimpor `services/**`.** Web menerima field turunan dari server:
  - DTO tiket: `transisi` (status berikutnya yang boleh untuk aktor ini) dan `statusLabel`.
  - DTO produk: `hargaLabel`.
- Mock (proses Node di repo) mengimpor rules backend seperti `kegiatan-data.mjs`.

### Bentuk module klien web (sketsa)

`app/lib/klinik.ts` (atau `useKlinik()`) adalah satu-satunya tempat yang mengenal `/v1/program/klinik/*`. Isinya:

- **Publik:**
  - `daftarPoli()`
  - `slotTersedia(poli, tanggal)`
  - `prefillSaya()`: mengembalikan `null` pada 401
  - `pesanTiket(form, lampiran, captcha) → TiketDibuat`
  - `lacakTiket(nomor, wa, captcha) → TiketLacak | null`: 404 dipetakan ke `null` supaya tidak ada oracle; format nomor dicek di klien
- **Petugas:**
  - `daftarTiket({ status? })`
  - `klaim(tiket)`
  - `majukan(tiket)`: memakai `tiket.transisi` dari server
  - `simpanSesi(tiket, patch)`
  - `batalkan(tiket)`
  - `jadwalkanUlang(tiket)`
- **Invarian:** `versi` selalu dikirim balik, dan halaman tidak memanggil `endpoint()` untuk klinik.
- **Mode error:** semua kegagalan menjadi `KlinikError { code, pesan, muatUlang }`. Satu peta `PESAN_KLINIK` mencakup setiap kode server; kode yang tak dikenal mendapat pesan generik; `TIKET_BERUBAH` membawa `muatUlang: true`.
- **Tes:** Vitest dengan client Directus palsu (`request` stub). Interface module ini adalah permukaan tesnya.

Urutan generalisasi:
1. klinik (drift terbesar, bukti Y09 masih terbuka)
2. katalog/kurasi (3 set label, `CATATAN_WAJIB`)
3. kpi (`kpi-outbox.ts` sudah deep; tambahkan outcome dan peta error)
4. talent
5. passport
6. kegiatan (`lib/kegiatan.ts` sudah menangani presentasi; tinggal ditambah verb fetch)

Saat ini ada sekitar 71 pemanggilan `endpoint<…>`/`endpointForm<…>` inline di 28 berkas.

### Divergensi mock → tindakan

| # | Divergensi (mock vs backend) | Tindakan |
|---|---|---|
| M1 | Klinik `GET /tiket` tanpa scope dan ikut mengembalikan `batal` (`mock-program.mjs:214` vs `service.js:389-394`) | Impor `dalamCakupan`; saring `batal` kecuali ada `?status=batal` |
| M2 | PATCH melewati aturan klaim (`:225` vs `penugasan.js:65`) | Impor `bolehUbah` |
| M3 | Audit hanya satu baris (`:232-238` vs `penugasan.js:98-113`) | Impor `barisAudit` |
| M4 | Lacak membandingkan nomor WA mentah dan tidak mengecek format nomor (`:200` vs `service.js:316-329`) | Impor `normalisasiTelepon`; nomor salah format → 404 |
| M5 | POST tiket tanpa `tanggalTidakValid`/`SLOT_PENUH`; poli di-hardcode (`:163,188`) | Impor rules; ambil poli dari `KLINIK_POLI` |
| M6 | Kurasi menerima keputusan apa pun dan tidak pernah `CATATAN_WAJIB` (`:287-290` vs `katalog/service.js:341-344`) | Impor `validasiKurasi` |
| M7 | LOI tanpa cek captcha; dedupe tidak per produk dan tidak dibatasi 24 jam (`:304-310` vs `:415-429`) | Samakan urutan: idempoten → captcha; dedupe per produk |
| M8 | `/katalog/produk` mengabaikan `?usaha` dan `canManage` (`:274`) | Saring per usaha |
| M9 | KPI tidak pernah mengirim `LAPORAN_SUDAH_ADA`, `MINGGU_TIDAK_VALID`, `PESERTA_TIDAK_AKTIF`, `CLIENT_UUID_CONFLICT`, `LAPORAN_SUDAH_DIREVIEW`; `statusMingguIni` tidak pernah `null` (`:316` vs `kpi/service.js:108`); streak ditulis ulang (`:131`) | Impor `longestTargetStreak`/`capaian`; tambahkan kode-kode itu |
| M10 | Kegiatan: captcha dicek sebelum `KEGIATAN_SELESAI` (`kegiatan-data.mjs:297-298` vs `service.js:188→193`) | Balik urutannya |
| M11 | SSR `/users/me` tidak mengirim `kota_scope`/`usaha`/`instansi` (`mock-directus-server.mjs:217-235` vs `mock-directus.mjs:163-180`) | Satu builder `userMe(role)` dipakai keduanya |
| M12 | `OPERATOR_FIXTURES` ada dua salinan dan emailnya berbeda (`mock-directus-server.mjs:16` vs `mock-directus.mjs:41`) | Ekspor sekali, impor di server |
| M13 | Rute tak dikenal → `200 {data:{}}` (`mock-directus-server.mjs:308`, `mock-directus.mjs:1131`) | **Gagal keras:** 404 `MOCK_ROUTE_MISSING <method> <path>` + `console.warn` |
| M14 | `/operasional/aktivitas` mengembalikan array telanjang di kedua mock (`server.mjs:202`, `mock-directus.mjs:272-290`); aslinya `{data}` (`operasional/src/index.js:54`) | Kembalikan `{data}`, lalu hapus cabang dua bentuk di `audit-sesi.vue:13-22` |
| M15 | Login mock tidak menyetel cookie sesi (`mock-directus.mjs:229-238`), sehingga setiap reload penuh di-SSR sebagai anonim | Tambahkan `set-cookie: diskuk_session=mock` di fulfill login |

### Tes mock yang merah (receipt Y10 mencatat 8)

Saya menjalankan `akun`, `passport`, dan `produk-passport` dua kali (chromium, mock). Hasilnya 7 dari 10 gagal di run 1, dan 10 dari 16 gagal di run 2 (ketiga file). Jumlahnya berubah-ubah antar run, jadi sebagian bersifat flaky. Penyebabnya:

1. **Strict mode `role=status`.** `<NuxtRouteAnnouncer />` (`app.vue:2`) menambah elemen `role=status`, sehingga locator menemukan dua elemen (`akun.spec.ts:62,77`). Perbaikan: `page.getByRole("main").getByRole("status")` atau `.filter({ hasText })`.
2. **Positif palsu URL.** `akun.spec.ts:15`: regex `toHaveURL(/\/dashboard\/akun$/)` sudah cocok dengan `/sign-in?returnTo=/dashboard/akun`, jadi assertion lolos sebelum login dan array `logins` kosong. Perbaikan: `await page.waitForURL(u => u.pathname === "/dashboard/akun")`.
3. **Cookie sesi mock tidak ada** (M15). Setiap reload penuh berakhir di halaman sign-in. Ini terjadi pada tes profil dan tes kurator passport di run 2.
4. **SSR ke mock statis.** `page.goto` ke halaman dashboard membuat SSR bertanya ke `mock-directus-server`, yang menjawab `/v1/program/*` dengan `{data:{}}`. Payload itu dipakai saat hidrasi, sehingga state `mock-program` tidak pernah terpakai (`produk-passport.spec.ts:91` passport-kode, alur produk). Perbaikan: navigasi sisi klien (`navigateSidebar` atau `$router.push`, `mock-program.mjs:474`) ditambah M13.
5. **Klik sebelum hidrasi** (tab publik passport di `produk-passport.spec.ts:116`, tombol "Tambah Produk"). Perbaikan: helper `waitForHydration(page)` yang menunggu `#__nuxt.__vue_app__`, atau loop `toPass` seperti di `passport.spec.ts:47`.
6. **Ekspektasi basi.** `passport.spec.ts:43` mencari "Halal: Terverifikasi", padahal halaman kini merender chip "Terverifikasi" dan label "Sertifikat Halal aktif". Isi file ini tumpang tindih dengan `produk-passport.spec.ts`: gabungkan, atau pakai `getByTestId("badge-legalitas_halal")`.
7. **Re-optimisasi dependensi Vite dev.** Run 1 memuat `runtime-core` dengan dua hash `?v=` dan gagal dengan `Cannot read properties of null (reading 'ce')` di `TooltipProvider`. Perbaikan: masukkan dependensi yang terlambat terdeteksi (mis. `qrcode`) ke `vite.optimizeDeps.include`, atau jalankan gate e2e terhadap `nuxt build && nuxt preview`.

### Langkah migrasi

1. **Mock gagal keras.** Kerjakan M11–M15. Jalankan suite mock penuh; setiap `MOCK_ROUTE_MISSING` yang muncul adalah rute yang harus ditambahkan secara eksplisit.
2. **Higiene tes.** Kerjakan penyebab 1, 2, 4, 5, 6, 7. Verifikasi: tiga run berturut-turut `akun`, `passport`, dan `produk-passport` hijau.
3. **Pisahkan rules murni backend** (klinik dan katalog, lihat di atas). Verifikasi: `node --test services/directus/extensions/program/test/*.test.js` hijau.
4. **DTO tiket membawa `transisi` dan `statusLabel`.** Setelah itu hapus salinan `TRANSISI` di `klinik.vue` dan di `klinik-data.mjs`.
5. **Mock mengimpor rules backend** (M1–M10). Tambahkan tes Vitest penjaga drift: regex `ProgramError\(\d+, "([A-Z_]+)"` dijalankan atas `klinik/*.js`, `katalog/service.js`, dan `kpi/service.js`, lalu tes memastikan setiap kode punya pesan di module klien web.
6. **Module klien web** `lib/klinik.ts` beserta unit test, lalu pindahkan `konsultasi.vue`, `LacakTiket.vue`, `PengantarKlinik.vue`, dan `dashboard/klinik.vue` ke module itu. Setelah itu ikuti urutan fitur di atas.

Perbaikan segera (W1–W13) independen dari langkah-langkah ini dan boleh dikerjakan lebih dulu.

### Perbaikan segera (bug web)

- **W1 — Kabkota tidak bisa membuka klinik.**
  - Patch: tambahkan `"/dashboard/klinik"` ke `ROLE_ROUTES.kabkota` (`ROLES.ts:43-54`) dan item "Klinik Konsultasi" ke menu kabkota di `NAVIGATION.ts`.
  - Tes di `roles.test.ts`:
    - `hasRouteAccess("kabkota","/dashboard/klinik")` bernilai true.
    - Setiap item `NAVIGATION_LINKS[role]` lolos `hasRouteAccess(role)` (menu ⊆ rute).
- **W2 — Kabkota punya rute `/dashboard/talent` tanpa menu.** Pilih salah satu: tambahkan menu read-only "Talent Scouting" (aksi BA sudah disembunyikan oleh `isProvinsi` di `talent/kurasi.vue:20`), atau hapus rutenya (lihat D4).
- **W3 — Menu "Data Lapangan" → `/dashboard/tabular`.** Bukan bug: `data-lapangan/` hanya berisi `[id].vue`, dan jalan masuknya memang dari baris Tabular. Tidak perlu tindakan.
- **W4 — Loop redirect saat `app_role` kosong.**
  - Penyebab: `auth.global.ts:11-16` mengarahkan ke `ROLE_HOME["provinsi"]` (`/dashboard`), yang ditolak lagi oleh `hasRouteAccess(undefined)`.
  - Patch: `app_role` yang kosong atau tak valid → logout, lalu `navigateTo("/sign-in?error=peran")`.
  - Fallback `"provinsi"` di `AppSidebar.vue:19` dan `nav/User.vue:19` diganti keadaan "Peran belum ditetapkan".
  - Tes: e2e dengan mock `/users/me` tanpa `app_role` harus berakhir di sign-in, tanpa loop.
- **W5 — Dua peta badge.** `nav/RoleBadge.vue` tidak dipakai di mana pun. `ROLE_LABELS`/`ROLE_BADGE_CLASSES` (`ROLES.ts`) dan `RoleKey`/`OperatorProfile` (`types/operasional.ts:38-46`) hanya dipakai olehnya. Hapus keempatnya dan pertahankan `APP_ROLE_BADGES`. Verifikasi: `vue-tsc`.
- **W6 — Form KPI menampilkan "dikirim" walau ditolak atau masih mengantre.**
  - Penyebab: `useKpiOutbox.add` mengembalikan `void`.
  - Patch: `add()` mengembalikan `"terkirim" | "antre" | "ditolak"`: entri hilang dari antrean berarti terkirim, masih ada tanpa `error` berarti antre, ada dengan `error` berarti ditolak. Pesan di `usaha/index.vue:138` mengikuti outcome itu.
  - Tes: unit untuk `flushOutbox` (saat ini tanpa tes) dan e2e untuk kasus mock yang mengembalikan `LAPORAN_SUDAH_ADA`.
- **W7 — Tiket batal hilang dan tidak bisa dibuka lagi.**
  - Pisahkan `KANBAN_KOLOM` (5 kolom) dari `KLINIK_STATUS` (6 status, termasuk `batal` berlabel "Dibatalkan").
  - Tambahkan toggle "Tampilkan dibatalkan" yang memanggil `?status=batal`, dan aksi "Jadwalkan ulang".
  - `statusLabel` untuk kode tak dikenal menampilkan kodenya apa adanya, bukan "Batal".
- **W8 — Kode yang tidak pernah dikirim server.** `LacakTiket.vue:12` memetakan `NOMOR_TIDAK_VALID`, padahal server menjawab 404 `TIKET_TIDAK_DITEMUKAN` untuk nomor yang salah format (`service.js:316`). Hapus kode itu dan ganti dengan cek regex format di klien.
- **W9 — Pemetaan error yang hilang:**
  - `konsultasi.vue:19` belum memetakan `LAMPIRAN_TERLALU_BANYAK` (`service.js:157`), `POLI_TIDAK_VALID` (`:117,226`), dan `TANGGAL_TIDAK_VALID` (`rules.js:19`).
  - `klinik.vue:43` belum memetakan `SLOT_PENUH` (`:478`) dan `KOTA_NOT_ASSIGNED` (`penugasan.js:52`).
  - `kpi-outbox.ts:55` belum memetakan `CLIENT_UUID_CONFLICT` (`kpi/service.js:179`).
  - Tes penjaga drift di langkah 5 akan menangkap kasus seperti ini ke depannya.
- **W10 — `audit-sesi.vue` menerima dua bentuk envelope.** Setelah M14, terima `{data}` saja. Ada juga dua endpoint aktivitas (`/v1/auth/activity` di `akun/aktivitas.vue` dan `/operasional/aktivitas` di `audit-sesi.vue`); keputusan soal ini masuk Kandidat 01.
- **W11 — Logika filter Tabular ganda.** `TabularData.vue` menulis ulang `kelurahanCache` (:150) dan `filterQuery` (:260) dari `useTabularFilters`. Kunci kabkota (`lockedKotaId`, :99) hanya ada di `TabularData.vue`, tidak di composable yang dipakai `spasial.vue` dan `dashboard/index.vue`. Pindahkan logika ke composable dan uji dengan Vitest.
- **W12 — Label yang menyimpang:**
  - Rekomendasi: "Rekomendasi" (`kurasi.vue:15`), "Rekomendasi Marketplace" (`PROGRAM.ts:98`), "Rekomendasi marketplace" (`produk.vue:19`).
  - Talent: "Talent Pool/Akselerator" (`PROGRAM.ts:7-8`) vs "Talent Lab/Accelerator" (`lib/katalog.ts:57-58`) vs server "Talent Pool Jawa Barat" (`passport/service.js:9`).
  - Skala: 4 peta (`PROGRAM.ts:41`, `lib/katalog.ts:48`, `katalog/service.js` `SKALA_LABEL`, `useTabularFilters.ts:17`).
  - Harga: "Rp12.000 – Rp15.000" (`lib/katalog.ts:185`) vs "Rp 12.000 - Rp 15.000" di PDF server.
  - Tindakan: satu konstanta per konsep; harga memakai `hargaLabel` dari server.
- **W13 — `readSingleton("kontak_hotline")` disalin di 4 tempat** (`PengantarKlinik.vue:24`, `bantuan.vue:22`, `faq.vue:29`, `katalog/[id].vue:37`). Buat composable `useKontakHotline()` dengan satu key `useAsyncData`.

### Keputusan terbuka

- **D1.** Web mengimpor rules backend (butuh COPY di `Dockerfile.web`, `server.fs.allow`, dan alias), atau server mengirim field turunan? **Rekomendasi:** field turunan. Hanya mock dan tes yang mengimpor backend.
- **D2.** Rules murni tetap di `program/src/endpoints/*/rules.js`, atau dipindah ke `services/directus/program-shared/`? **Rekomendasi:** tetap di tempat. Buka lagi hanya jika D1 memilih impor.
- **D3.** Istilah kanonik: "Talent Pool" atau "Talent Lab", "Akselerator" atau "Accelerator"? Ini keputusan pemilik domain. **Rekomendasi:** ikuti `BADGE` server dan brief.
- **D4.** Kabkota di kurasi talent: menu read-only, atau rute dihapus? **Rekomendasi:** menu read-only.
- **D5.** Tiket batal: filter terpisah atau kolom arsip? **Rekomendasi:** filter/toggle; kanban tetap 5 kolom.
- **D6.** Gabungkan `passport.spec.ts` ke `produk-passport.spec.ts`? **Rekomendasi:** ya.
- **D7.** Server e2e: `nuxt dev` atau `build + preview`? **Rekomendasi:** preview untuk gate, dev untuk lokal.
