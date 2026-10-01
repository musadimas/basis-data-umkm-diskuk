# E2E Plan — Prioritas Kuning lalu Merah, Basis Data UMKM DISKUK Jabar

- **Status:** implementasi awal Y01–Y09 sudah tersebar di source; tidak satu pun phase mempunyai receipt `done` sesuai gate E2E. Frontier pertama adalah rekonsiliasi pasca-merge dan penutupan Y01. Y10 belum lulus; Stage 2 tertahan.
- **Tanggal revisi:** 27 September 2026 (setelah merge `790559b`).
- **Sumber prioritas:** `requirements.md` di root repo, yang menyalin highlight [Brief Fitur](https://docs.google.com/document/d/1FG6eZ2b94300R_FnO_Z09JE-pqo6vBAHIqlOZSSHuSc/edit?tab=t.0).
- **Target:** repo `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`.
- **Aturan eksekusi:** selesaikan dan buktikan seluruh `Y01–Y10` (kuning) sebelum mulai `R01–R05` (merah). Huruf Y/R adalah urutan kerja baru, bukan nomor phase lama.

## Executor brief

Baca `requirements.md`, `priority_coverage.json`, tabel posisi kerja di bawah, lalu [phase Y01](stage_1/phase_Y01_identity.md). **Mulai dari source pasca-merge; jangan membangun ulang modul yang sudah ada.** Tutup gap kontrak dan bukti Y01 dahulu, lalu Y02/Y03; lanjutkan Y04–Y09 menurut dependency. Dua perbaikan hijau—pencarian global Tabular dan basemap satelit—tetap milik Y05. `docs/brief-fitur-plan/main_plan.md` menjelaskan sebagian kode yang masuk dari branch lain, tetapi pernyataan “super admin saja” dan “pencarian Tabular sudah hijau” di sana bukan keputusan prioritas plan ini. `requirements.md` dan plan Y/R ini tetap mengatur cakupan. `legacy/phase_*.md` hanya jejak historis.

Selesai berarti setiap ID pada `priority_coverage.json` mempunyai bukti hasil perilaku/API/artifak di phase miliknya; gate Stage 1 dan Stage 2 lulus secara terpisah; migrasi, worker, browser, dan provider diuji pada stack disposable. Tes statis atau mock saja tidak membuktikan alur user atau provider.

## Posisi kerja terverifikasi (snapshot 27 September 2026)

Periksa ulang `git status --short --branch` sebelum mengedit. Snapshot ini: `main` pada merge lokal `790559b`, 31 commit di depan `origin/main`; `main_plan.md`, `scope_manifest.json`, dan Y01 sudah dimodifikasi sebelum handoff ini; `handover.md` serta `docs/dashboard-operasional-e2e-execution-evaluation.md` untracked. Pertahankan perubahan itu. Evaluasi tersebut dibuat pada `ecee7ac` **sebelum** merge `790559b`, sehingga daftar “missing” Y04–Y09 dan kegagalan dependensi/typecheck di sana sudah usang. `check_coverage.py` lulus untuk pemetaan 35 M + 14 N, bukan implementasi. Pada source saat snapshot, tes authentication 32/32, program 44/44, operasional 15/15, kontrak Directus 21/21, web unit 40/40, dan typecheck web lulus. Semua ini bukti lokal saja. Compose disposable `diskuk-operasional-e2e` berjalan, tetapi service `web` yang ada di Compose tidak tercantum pada `docker compose ps`; migrasi/readback dan browser real API sesudah merge belum dibuktikan.

| Phase | Kode yang sudah ada | Sisa pekerjaan dan bukti sebelum `done` |
| --- | --- | --- |
| Y01 | Login NIB, ALTCHA, empat `app_role`, profil, dan guard server; tes auth/typecheck lokal hijau. | E2E masih memakai `/api/auth/login-nib`, “Menu profil”, `/forgot-password`; `lockedKotaId()` masih membaca `user.role` dan kota objek. Selaraskan dengan `app_role`/`kota_scope`, lalu buktikan empat role, CAPTCHA, reset, audit, logout, dan scope di API/browser nyata. Belum ada receipt. |
| Y02 | Migrasi E serta I, `extensions/program/src/endpoints/talent`, halaman `/dashboard/talent/*`, tes lokal; receipt lama `partial` mendeskripsikan implementasi yang diganti merge. | Cocokkan status BA: source mengubah `talent_status` ke `talent_pool`, M4-04 meminta `Scouting`. Rubrik masih `placeholder-v0`; putuskan sumber resminya sebelum klaim skor final. Uji migrasi, nominasi→skor→BA, readback, akses lintas role/kota, browser; tulis receipt baru. |
| Y03 | Migrasi J, `extensions/program/src/endpoints/kpi`, IndexedDB outbox, halaman UMKM/pendamping; receipt lama `partial` merujuk migrasi G yang sudah hilang. | Endpoint hanya memeriksa minggu dimulai, belum memaksa pengiriman Jumat; `createdAt` antrean belum menjadi kontrak server untuk sinkron Sabtu. Perbaiki aturan dan akses bukti foto pendamping, lalu buktikan offline→sync sekali, verifikasi, tren, dan readback. |
| Y04 | Migrasi K/L, kurasi produk, Passport bertanda tangan, QR PNG, radar dan showroom sudah ada. | Source memakai HMAC, sedangkan phase meminta Ed25519; QR PDF dan rubrik radar/sumber badge belum selesai. Buktikan media privat, kurasi, verifikasi, dan artefak pada runtime. |
| Y05 | Popup pin dan PPT tiga slide dari tampilan Canvas sudah ada. | Worker `aggregate_png` masih 1×1; pencarian global Tabular, basemap satelit, dua PDF produk/Passport, dan validasi semua ekspor belum selesai. |
| Y06 | Katalog publik Directus, detail produk, filter, LOI dengan CAPTCHA, dan tabel `produk_loi` sudah ada. | Buktikan 27 wilayah/filter server, status verifikasi, privasi draft/PII, kontak, CTA, LOI readback dan PDF; opsi wilayah saat ini berasal hanya dari produk yang sudah tayang. |
| Y07 | Migrasi M dan halaman kalender/lini masa/detail kegiatan sudah ada. | CTA masih “Pendaftaran online segera hadir”; tautan registrasi resmi dan pengingat opt-in/provider belum ada. Buktikan filter/status/kalender mobile dan receipt pengingat. |
| Y08–Y09 | Migrasi N, endpoint tiket/slot/lookup, halaman konsultasi, panel klinik, FAQ/hotline sudah ada. | `notify.js` hanya menulis log; outbox, gateway, receipt WhatsApp belum ada. Buktikan kepemilikan/prefill, IDOR, slot konkuren, lampiran, histori status, browser dan FAQ; pisahkan receipt Y08 dan Y09. |
| Y10 / R01–R05 | Ada satu halaman bantuan merah yang masuk bersama merge, belum merupakan bukti N7-03. | Seluruh receipt Y dan dua perbaikan hijau harus `done` sebelum Y10 lulus. Jangan mulai atau mengklaim R dari kode parsial yang sudah terlanjur ada. |

**Urutan mulai untuk agen berikut:**

1. Catat baseline dan jalankan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py`. Inventaris manifest, file nyata, dan migrasi yang sudah diterapkan; **ambil snapshot scope sebelum mengedit manifest atau kode**. `scope_manifest.json` masih menunjuk komponen/service yang dihapus dan merencanakan nama migrasi H–N untuk fitur lain, padahal `20260926H`–`N` sekarang dipakai kode hasil merge. Amandemen hanya entri phase aktif, jalankan guard, dan catat alasan di receipt; jangan menamai ulang migrasi yang mungkin sudah diterapkan. ADR-007 dan phase lama juga perlu diselaraskan dari `kota` ke `kota_scope`/`app_role` ketika disentuh.
2. Buka Y01 dan perbaiki E2E serta `lockedKotaId()` yang basi. Ulangi tes lokal yang relevan; jangan mengulang instalasi paket hanya karena evaluasi pra-merge mencatat dependensi hilang. Inventaris konfigurasi stack disposable dan migrasi yang sudah berjalan, nyalakan web pada stack yang sama, lalu uji empat role, ALTCHA, reset Mailpit, audit/logout, dan scope dengan API/browser nyata. Buat receipt Y01 baru.
3. Setelah Y01 `done`, buka Y02 dan Y03 sesuai dependency. Rekonsiliasi status BA serta aturan Jumat/offline pada source kanonik `extensions/program`; jangan menghidupkan service lama yang dihapus merge. Uji migrasi, browser/API, SQL readback, dan perbarui receipt lama lewat addendum bertanggal tanpa menghapus sejarah.
4. Tutup Y04–Y09 menurut tabel dependency di bawah, dengan receipt per phase. Jika provider atau rubrik resmi belum tersedia, kerjakan bagian independen tetapi beri verdict `partial`/`not provider-proven`; jangan menaikkan gate Y10. Setelah semua Y terbukti, jalankan Y10, lalu R01–R05.

`apps/web/playwright.config.ts` memakai mock server kecuali `PLAYWRIGHT_BASE_URL` diisi; set `PLAYWRIGHT_USE_REAL_API=1` untuk spec runtime. Health container dan tes mock tidak menggantikan receipt API/browser. Buka `main_plan.md` ini lagi pada setiap batas phase, lalu hanya file phase aktif.

## Klarifikasi dan tradeoff yang dikunci

| Keputusan | Dasar dan konsekuensi |
| --- | --- |
| Semua kuning sebelum merah | Instruksi pengguna pada percakapan ini. Stage 2 tidak boleh dimulai dengan alasan file lama sudah menaruhnya di Phase 2/5/7/9. |
| Empat role dasar tetap dibangun di Stage 1 | M5, M6, dan M7 kuning membutuhkan akun UMKM serta pendamping. Widget demo satu klik N1-03 tetap Stage 2. Ini menyelesaikan catatan “admin dulu” dengan membedakan otorisasi fungsional dari kontrol presentasi. |
| Pencarian global Tabular dan basemap satelit ikut Stage 1 | Pengguna mengonfirmasi dua item hijau itu perlu diperbaiki karena belum ada pada source. Proof fase Y05 harus menguji perilaku asli, bukan sekadar tombol. |
| CAPTCHA mengikuti implementasi ALTCHA terbaru | Pengguna mengonfirmasi pada 27 September 2026: pertahankan widget ALTCHA dan verifikasi challenge di Directus (`services/directus/extensions/authentication`), termasuk expiry, single-use/replay guard, dan rate limiting login. Keputusan lama “Simulasi CAPTCHA” dicabut; jangan menambahkan label simulasi atau mengganti ALTCHA dengan checkbox palsu. Buktikan alur sah, kosong, salah, kedaluwarsa, dan replay pada Y01. CAPTCHA tidak boleh diklaim sebagai jaminan bebas bot. |
| Laporan KPI mengikuti brief: setiap Jumat | Pengguna mengonfirmasi. Minggu dan hari dihitung di `Asia/Jakarta`. Laporan yang dibuat offline pada Jumat boleh tersinkron setelah Jumat dengan metadata waktu pembuatan dan idempotency key yang valid. |
| Notifikasi/pengingat WhatsApp Stage 1 | Asumsi perencanaan: gateway nyata dan adapter server diperlukan. Nama provider, kredensial, template, dan nomor pengirim belum tersedia; phase Y07/Y08/Y09 harus berhenti pada gate provider dan melapor `not provider-proven` bila sandbox provider tidak dapat diuji. Tidak boleh mengklaim pesan terkirim dari toast/mock. |
| SSO Jabar dan klaim verifikasi eksternal | SSO berada di Stage 2; alur riil perlu kontrak IdP. Status OSS/sertifikasi/PDN pada katalog hanya boleh berlabel “terverifikasi” setelah ada sumber bukti/verifikator; deklarasi mandiri diberi label terpisah. |

Rencana lama berdasar `docs/new_requirements.md` yang tidak mempertahankan warna dan memilih Modul 1–6. Revisi ini menjadikan `requirements.md` sumber prioritas, mempertahankan kontrak keamanan/scoping/worker yang relevan dari plan lama, menambah Modul 7, serta memindahkan seluruh fitur merah ke Stage 2. Direktori `legacy/` disimpan untuk audit keputusan terdahulu dan bukan bagian urutan executor.

## Peta sistem dan baseline yang diperiksa

| Permukaan | Baseline | Konsekuensi phase |
| --- | --- | --- |
| Identitas | `directus_users.app_role` adalah kunci peran, `role` tetap UUID Directus bersama, `kota_scope` adalah FK integer; `useAuth.ts` memetakan ke `AuthUser.kota`. Web memakai SDK/session Directus dan login NIB melalui `/auth/login` dengan ALTCHA server-side. | Y01 memperbaiki test/helper lama dan menutup proof auth/scope, reset, profil, audit; jangan menghidupkan lagi BFF Nuxt, `/api/auth/login-nib`, atau policy Directus terpisah per peran. |
| Talent dan KPI | Migrasi E + I/J dan `services/directus/extensions/program/src/endpoints/{talent,kpi}` adalah jalur aktif. Service dan halaman operasional Y02/Y03 lama sebagian dihapus oleh merge. | Y02/Y03 merekonsiliasi BA `scouting` vs `talent_pool` dan Jumat/offline sebelum runtime proof. Jangan menulis lagi ke tabel lama `talenta`/`talenta_laporan_mingguan` hanya karena ledger historis menyebutnya. |
| Analitik dan spasial | Popup pin dan PPT client-side sudah ada; `TabularData.vue` belum punya pencarian global, `Choropleth.client.vue` hanya OSM, worker PNG agregat masih 1×1. | Y05 mempertahankan popup/PPT yang bekerja dan melengkapi pencarian, satelit, PNG/PDF/PPT serta artefak produk. |
| Produk/Passport/katalog | Migrasi K/L dan `extensions/program` menyediakan produk, kurasi, LOI, Passport HMAC, serta `/katalog` dan detail publik berbasis Directus. | Y04/Y06 menutup perbedaan Ed25519/PDF, rubrik/badge, filter, privasi, dan proof server/browser; jangan mengembalikan katalog hardcoded. |
| Kegiatan | Migrasi M membuat `kegiatan`, `faq`, `kontak_hotline`; `/kegiatan` menampilkan kalender dan dialog detail. | Y07 menambah CTA tautan resmi/pengingat dan membuktikan filter/status/provider. Registrasi internal QR tetap R03. |
| Klinik/FAQ | Migrasi N dan `extensions/program/src/endpoints/klinik` menyediakan tiket/slot/lookup; `/konsultasi` dan `/dashboard/klinik` sudah ada, tetapi `notify.js` hanya log. | Y08/Y09 menutup outbox/provider, keamanan kepemilikan, transisi status, lampiran, FAQ, dan browser proof. |
| Privasi | ADR-001 dan ADR-004 mewajibkan session, CSRF, scoping serta minimisasi PII | Semua endpoint publik harus memakai DTO allowlist; NIK dan nomor telepon mentah tidak boleh masuk katalog, log, ekspor, atau query publik. |

## Rekonsiliasi rencana terkait

| Sumber/selisih | Perlakuan plan ini |
| --- | --- |
| `docs/brief-fitur-plan/main_plan.md` datang dari merge dan menyebut “super admin saja” serta pencarian Tabular hijau. | Empat role fungsional tetap Stage 1; pencarian Tabular dan satelit tetap perbaikan Y05 sesuai keputusan pengguna. Ambil kode/temuan implementasi dari dokumen itu, bukan keputusan prioritas yang bertentangan. |
| Implementasi baru memakai `kota_scope`, tabel `talent_pengajuan`, `kpi_laporan`, `talent_passport`, `produk_loi`, `konsultasi_tiket`; rencana/manifest lama masih menunjuk `kota`, `talenta`, `kemitraan_minat`, `klinik_tiket`, dan path komponen yang dihapus. | Sesuaikan phase aktif, manifest, dan ledger ketika dikerjakan. Migrasi `20260926H`–`N` sudah terpakai; setiap migrasi tambahan mendapat nama baru setelah cek `directus_migrations` disposable. |
| Rencana lama mempertahankan auth/scope, dummy cleanup, rollback, worker ekspor, KPI offline, dan probe privasi/konkurensi. | Semua tetap gate Stage 1. Bukti statis dari branch lama atau halaman baru tidak menggantikan readback dan browser. |
| Ada halaman `/bantuan` dari merge, sedangkan N7-03 merah. | Keberadaan route tidak mengubah urutan. Fitur bantuan lengkap dan receipt N7-03 tetap R03 setelah Y10 `done`. |

## Urutan phase dan dependency

| Stage | Phase | File aktif | ID requirement | Dependency dan exit utama |
| --- | --- | --- | --- | --- |
| Kuning | Y01 | [stage_1/phase_Y01_identity.md](stage_1/phase_Y01_identity.md) | M1-01…04 | Role, sesi, scoping, login, profil; foundation. |
| Kuning | Y02 | [stage_1/phase_Y02_talent.md](stage_1/phase_Y02_talent.md) | M4-01…04 | Y01; atribut Jabar dan Talent Scouting sampai BA. |
| Kuning | Y03 | [stage_1/phase_Y03_kpi.md](stage_1/phase_Y03_kpi.md) | M5-01…06 | Y02; laporan Jumat/offline, verifikasi, tren, rekomendasi. |
| Kuning | Y04 | [stage_1/phase_Y04_product_passport.md](stage_1/phase_Y04_product_passport.md) | M6-01…04, M7-06 | Y02; produk terkurasi, Passport, radar, showroom. |
| Kuning | Y05 | [stage_1/phase_Y05_exports_map.md](stage_1/phase_Y05_exports_map.md) | M2-01, M3-01, M6-05; dua perbaikan hijau | Y02, Y04; berkas ekspor valid, popup, pencarian, satelit. |
| Kuning | Y06 | [stage_1/phase_Y06_public_catalog.md](stage_1/phase_Y06_public_catalog.md) | M7-01…05 | Y04, Y05; katalog/produk publik, filter, kontak, LOI. |
| Kuning | Y07 | [stage_1/phase_Y07_events.md](stage_1/phase_Y07_events.md) | M7-07…10 | Y01; agenda dan detail publik, provider pengingat. Bisa dikerjakan paralel Y02–Y06 setelah Y01. |
| Kuning | Y08 | [stage_1/phase_Y08_clinic_backend.md](stage_1/phase_Y08_clinic_backend.md) | M7-11…12 (kontrak) | Y01; data, tiket, slot, lampiran, notifikasi. |
| Kuning | Y09 | [stage_1/phase_Y09_clinic_ui.md](stage_1/phase_Y09_clinic_ui.md) | M7-11…14 (UI) | Y08; form, antrean, sesi, FAQ/hotline. |
| Gate | Y10 | [stage_1/phase_Y10_acceptance.md](stage_1/phase_Y10_acceptance.md) | seluruh M + perbaikan hijau | Semua Y; bukti runtime dan coverage lengkap sebelum merah. |
| Merah | R01 | [stage_2/phase_R01_demo_regulation.md](stage_2/phase_R01_demo_regulation.md) | N1-01…03, N2-01, N5-01 | Y10; branding, SSO, switcher, lima aspek, demo offline. |
| Merah | R02 | [stage_2/phase_R02_executive_investor.md](stage_2/phase_R02_executive_investor.md) | N5-02…03, N6-01…02 | Y10; KPI agregat/at-risk dan direktori investor. |
| Merah | R03 | [stage_2/phase_R03_events_aid.md](stage_2/phase_R03_events_aid.md) | N7-01…03 | Y10, Y07; pendaftaran, QR/presensi/sertifikat, bantuan. |
| Merah | R04 | [stage_2/phase_R04_clinic_extensions.md](stage_2/phase_R04_clinic_extensions.md) | N7-04…05 | Y10, Y09; metrik klinik, coach dan profil usaha. |
| Gate | R05 | [stage_2/phase_R05_acceptance.md](stage_2/phase_R05_acceptance.md) | seluruh N | R01–R04; bukti akhir tanpa mengubah verdict Stage 1. |

Y07 dan Y08 dapat berjalan setelah Y01 tanpa menunggu Y02–Y06; Y09 menunggu Y08. R01–R04 boleh berjalan paralel **hanya setelah** Y10 lulus. Satu phase adalah satu konteks executor dan satu receipt; jangan menggabungkan dua phase dalam satu commit tanpa alasan tertulis.

## Scope ownership dan batas aman

- Baseline historis rencana lama adalah `fc450bb`; baseline pra-merge lain `ecee7ac`; **keduanya bukan titik mulai executor baru**. Gunakan `HEAD` dan `git status` aktual. `requirements.md` dan file plan terlacak; `docs/` tidak diabaikan. Pertahankan semua perubahan/untracked yang sudah ada, khususnya `handover.md`, laporan review, dan amandemen plan/manifest/Y01; stage hanya path phase yang sengaja diubah.
- `priority_coverage.json` adalah daftar tertutup 49 ID. Jalankan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` sebelum phase dan setelah perubahan requirement. Kegagalan coverage adalah stop condition.
- `scope_manifest.json` membatasi path per phase, tetapi **Y01–Y09 dan R yang bersinggungan dengan migrasi H–N masih perlu rekonsiliasi pasca-merge**. Banyak entri `create` menunjuk file yang sudah ada atau yang dihapus; nomor migrasi H–N di manifest bertabrakan dengan file aktif. Inventaris path dan `directus_migrations` pada stack disposable; lalu ambil snapshot **sebelum mengedit manifest atau kode**: `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-Y01-scope.json`. Amandemen hanya phase aktif dengan alasan tertulis; manifest sudah mengizinkan amandemen dirinya pada Y01. Sebelum commit jalankan `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check --snapshot /tmp/operasional-Y01-scope.json --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase Y01` (ganti ID/nama snapshot untuk phase lain). Jalankan ulang sampai `outside` kosong; jangan menyembunyikan file di luar scope atau menamai ulang migrasi yang sudah diterapkan.
- Jangan menjalankan `pnpm dev:direct`, migrasi/seed/index/cleanup ke environment bersama atau production, membaca `.env`/token, melakukan `git reset --hard`, `git clean`, `git stash` seluruh tree, `git add -A`, atau push. Gunakan project Docker disposable `diskuk-operasional-e2e` sesuai runbook lama.
- Pertahankan URL analitik lama, akun provinsi lama, format API `{ data, meta? }`, error `{ errors: [...] }`, private `Cache-Control: no-store`, session policy same-origin, dan privacy ADR-004.
- Public catalog/agenda/FAQ hanya mengeluarkan allowlist field publik. Kontak produsen memakai nomor terverifikasi; NIK/telepon pribadi, omzet pribadi, payload Directus mentah, path berkas privat, dan identitas tiket klinik tidak boleh bocor.

## Contract ledger lintas lapisan

| Kontrak | Penyimpanan/producer | Service/API | UI/consumer | Bukti wajib |
| --- | --- | --- | --- | --- |
| Role dan scope kota/usaha | `directus_users.app_role/kota_scope/usaha` + satu role/policy aplikasi Directus; `role` adalah UUID Directus | `resolveOperator`/`loadActor` membaca `app_role` dan `kota_scope`; analytics membatasi `provinsi`/`kabkota` di resolver | `useAuth.ts` memetakan `kota_scope` ke `AuthUser.kota`; menu, header, route, fetch memakai `app_role` | request silang role/kota/usaha menghasilkan 403/404; helper UI tidak membaca UUID `role` sebagai peran. |
| Login dan CAPTCHA | challenge ALTCHA bertanda tangan + tabel `auth_captcha_used` | `/v1/auth/captcha/challenge`, hook `auth.login` dan rate limiting; NIB di-resolve ke akun UMKM | `Captcha.client.vue` + `SignInForm.vue` | challenge valid masuk sekali; kosong/salah/expired/replay ditolak tanpa enumerasi akun atau kebocoran token. |
| Scouting | `usaha_atribut_jabar`, `talent_pengajuan`, `talent_berita_acara`, `usaha.talent_status` | `extensions/program/src/endpoints/talent` menghitung 4×25% dan menerbitkan BA | `/dashboard/talent/*`, Tabular | skor deterministik, BA readback dan status M4-04 `Scouting` konsisten; source saat ini menulis `talent_pool`. |
| Laporan Jumat | `program_peserta`, `kpi_laporan`, bukti file, `client_uuid` dan timestamp pembuatan offline yang perlu dikontrak | `extensions/program/src/endpoints/kpi` wajib memvalidasi Jumat WIB, retry dan status verifikasi | `/dashboard/usaha`, `/dashboard/pendampingan`, IndexedDB outbox | offline Jumat → sync Sabtu tepat satu laporan; kirim biasa di luar Jumat ditolak dan bukti foto dapat dibuka pendamping berizin. |
| Produk/Passport | `produk`, `produk_foto`, `talent_passport.kode`, legalitas terverifikasi | `extensions/program/src/endpoints/{katalog,passport}`; source sekarang HMAC, phase meminta Ed25519 | editor/kurasi produk, Passport, showroom, `/passport/:kode` | QR PNG/PDF asli valid, data publik minim, signature invalid setelah perubahan payload, sumber badge jelas. |
| Ekspor Canvas | `analitik_job` + worker renderer; PPT saat ini dibuat di browser dari tampilan aktif | PNG/PDF worker dan PPT client harus membawa filter/angka yang sama | `ExportDialog.vue` dan unduhan | PNG bukan 1×1; semua format terbuka dan angka/filter cocok; dua PDF produk/Passport valid. |
| Katalog publik dan LOI | produk tayang, legalitas/verifikasi, `produk_loi` | Directus public read terfilter dan `POST /v1/program/katalog/loi` | `/katalog`, `/katalog/:id` | filter server, detail, CTA, LOI tersimpan; draft/PII tidak bocor. |
| Agenda | `kegiatan` + penyelenggara/kuota/metode | list/detail publik, pengingat provider | kalender/lini masa/detail | semua kategori/filter/status, CTA terarah, reminder receipt provider atau `not provider-proven`. |
| Klinik | `konsultasi_tiket`, poli, slot, lampiran, catatan; outbox belum ada | `extensions/program/src/endpoints/klinik`; `notify.js` saat ini hanya log | `/konsultasi` + `/dashboard/klinik` | tiket/antrean/status/readback, IDOR ditolak, WhatsApp receipt cocok dengan tiket atau `not provider-proven`. |
| FAQ/hotline | `faq`/`kontak_hotline` + nomor dinas | Directus public read dengan field allowlist | `LandingFaq.vue`/footer/halaman klinik | tidak ada tanggal 2025 basi dan tautan hotline membuka nomor yang dikonfigurasi. |

## Acceptance proof dan gate runtime

Setiap ID M/N mempunyai phase tepat satu di `priority_coverage.json`. File phase menjabarkan input, aksi, expected output, test, dan artefak bukti. Gate Y10/R05 membaca seluruh receipt dan menolak penanda `done` bila hanya ada typecheck, screenshot mock, request antrean tanpa hasil, atau provider tidak dapat dibuktikan.

| Preflight | Perintah/aksi | Sinyal siap | Bila gagal |
| --- | --- | --- | --- |
| Repo | `git status --short --branch` dan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | baseline tercatat, 49/49 ID unik | stop; jangan menyapu dirty file. |
| Env dan port disposable | Inventaris env/override milik project `diskuk-operasional-e2e` yang sudah ada tanpa mencetak rahasia. Hanya jika stack belum ada, mulai dari `.env.example` dan buat `/tmp/operasional-e2e.env` dengan secret acak lokal; `DEMO_MODE=false` selama Y01–Y10. Periksa port dan `docker compose --env-file .env.example config --quiet`; pola env baru ada di `legacy/main_plan.md` bagian “Prosedur disposable stack”. | Konfigurasi target jelas, Compose config lolos, tidak ada kredensial production di file sementara | stop; jangan mengganti state stack lama dengan env baru atau menyalin secret ke receipt. |
| Stack disposable | Inventaris project `diskuk-operasional-e2e` yang sudah berjalan dan file env/override yang dipakainya; setelah memastikan target disposable, gunakan konfigurasi project yang sama untuk menyalakan service `web` bila belum ada. Jika stack tidak ada, gunakan prosedur `up -d --build` dengan `/tmp/operasional-e2e.env`. | Directus `/server/health`, web HTTP 200, Postgres/MinIO/worker sehat | status `not runtime-proven`; jangan menyamakan health Directus dengan browser/API proof. |
| Migrasi dan dummy | jalankan migrasi/seed sesuai phase pada stack disposable, hanya data bertanda `dummy_` | query readback, login empat role, cleanup runbook nol baris dummy | stop pada phase stateful. |
| Browser | Playwright real API dengan `PLAYWRIGHT_BASE_URL` ke web disposable dan `PLAYWRIGHT_USE_REAL_API=1`; visual desktop/mobile dan akses tanpa login. Tanpa `PLAYWRIGHT_BASE_URL`, config Playwright menyalakan mock Directus. | alur user, filter, popup, PWA, PDF/PNG/PPT terbaca dari service nyata | `not browser-proven` bila hanya mock/fixture. |
| Provider | sandbox WhatsApp/SSO/OSS sesuai phase, tanpa kredensial di repo | callback/receipt dan readback yang cocok dengan tiket/reminder | `not provider-proven`; tidak mengirim ke nomor riil tanpa fixture izin. |

State matrix wajib pada phase yang menulis: awal, kosong, tidak berizin, valid, gagal jaringan, retry, duplikat/idempotency, stale, dan dua request bersamaan. Keputusan status/BA, upload, LOI, tiket, laporan, registrasi, sertifikat, dan ekspor harus dibuktikan pada service/API + persistensi; UI mock hanya bukti tambahan.

## Kontrak eksekusi setiap phase

1. Baca `main_plan.md` dan file phase aktif, bukan seluruh `legacy/`. Periksa anchor/source dan baseline. Jika kontrak berubah, stop dan amandemen plan.
2. Snapshot scope; edit hanya path phase; jalankan gate unit/contract/typecheck/build yang relevan; jalankan runtime disposable dan browser/provider sesuai phase.
3. Simpan receipt: verdict `done/partial/blocked`, ID kebutuhan, file berubah, perintah+exit, output API/SQL, screenshot atau artefak, provider receipt bila ada, cek yang tidak berjalan, risiko.
4. Phase berikutnya hanya boleh menganggap dependency selesai jika receipt membuktikan semua hasil kritis. `not runtime-proven` tidak boleh dinaikkan menjadi `done`.
5. Di batas Stage 1, Y10 menjalankan coverage, semua test suite relevan, proof runtime, file export scan, security/PII probes, dan cleanup dummy. Stage 2 baru dibuka setelah Y10 `done`.

## Global failure probes

| Probe | Cara | Menangkap |
| --- | --- | --- |
| Prioritas | `check_coverage.py` + cek file Stage 1 terhadap daftar N pada receipt | ID hilang, merah masuk sebelum gate. |
| Batas file | `scope_guard.py check --snapshot <snapshot> --manifest <manifest> --phase <ID>` | edit di luar manifest. |
| Publikasi data | GET katalog/detail/agenda/FAQ tanpa login; scan response untuk NIK, telepon pribadi, raw omzet, directus file privat | bocor PII atau katalog memakai DTO internal. |
| Mutasi | dua POST identik dan dua POST konkuren untuk laporan/LOI/tiket/BA | duplicate write, status stale, email/WA ganda. |
| Export | buka seluruh tipe dengan parser PNG/PDF/PPT; cek ukuran, halaman/slide, angka dan QR | tombol unduh semu, file kosong/1×1. |
| Provider | simulasi 2xx API tanpa callback/receipt tidak boleh menutup gate | klaim notifikasi/SSO/OSS palsu. |
| Browser | desktop dan mobile, authenticated dan unauthenticated | konfigurasi/test statis disalahartikan sebagai UX terbukti. |

## Context refresh dan final checklist

Pada pergantian phase, buka kembali `main_plan.md` dan hanya file phase berikut. Jangan mengulang eksplorasi seluruh repo kecuali anchor gagal. Akhiri dengan:

- [ ] `check_coverage.py`: semua 35 M dan 14 N tepat sekali, M pada Y, N pada R.
- [ ] Semua Y01–Y09 dan Y10 `done` sebelum R01 dimulai.
- [ ] Semua R01–R04 dan R05 `done` untuk menyatakan keseluruhan plan selesai.
- [ ] Setiap artefak browser/API/SQL/worker/provider mempunyai readback yang dapat diperiksa.
- [ ] `scope_guard.py` hijau tiap phase, tidak ada dirty path pengguna tertimpa.
- [ ] Dummy cleanup pada disposable stack menghasilkan nol baris `dummy_`; production tetap tidak berubah.
