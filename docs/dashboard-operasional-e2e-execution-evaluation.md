# Review progres dashboard operasional E2E

Tanggal review: 27 September 2026. Acuan: `dashboard-operasional-e2e-plan/main_plan.md` dan phase aktif Y01–Y10/R01–R05. Branch saat review: `main` pada `ecee7ac`, 20 commit di depan `origin/main`; `handover.md` sudah untracked sebelum review ini.

**Amendemen setelah review (27 September 2026):** pengguna memilih mempertahankan ALTCHA terbaru. Temuan CAPTCHA nomor 4 di bawah adalah selisih terhadap keputusan plan lama, bukan lagi permintaan untuk kembali ke simulasi. Kontrak terbaru ada di `dashboard-operasional-e2e-plan/main_plan.md` dan `stage_1/phase_Y01_identity.md`; proof ALTCHA Y01 tetap belum selesai.

## Verdict

**Needs repair / Stage 1 partial.** Implementasi baru mencapai fondasi Y01–Y03. Tidak ada phase yang dapat dinyatakan `done` menurut gate rencana karena bukti migrasi, readback, browser dengan API nyata, dan penerimaan per ID belum lengkap. Y04–Y09 belum memenuhi acceptance; Y10 belum lulus. R01–R05 tertahan oleh Y10. Dari 35 ID must-have, 14 ID pada Y01–Y03 sudah mempunyai kode awal, tetapi 0 ID mempunyai bukti selesai penuh sesuai gate. Angka ini menyatakan cakupan implementasi awal, bukan persentase pekerjaan atau tingkat kelulusan fitur.

`check_coverage.py` lulus untuk *pemetaan rencana* 35 M + 14 N. Hasil itu tidak menguji implementasi. Stack Docker disposable `diskuk-operasional-e2e` saat review berjalan (Directus, PostGIS, worker, MinIO, Redis, Mailpit; `/server/health` HTTP 200), tetapi tidak ada bukti saat review ini bahwa migrasi, dummy seed, dan alur browser/API Y01–Y03 telah diuji pada stack tersebut. Tidak ada service web dalam daftar `docker compose ps`.

## Temuan utama

1. **P0 — Y05 masih mempunyai ekspor PNG 1×1.** `services/analytics-worker/src/export-renderer.js:4` membuat PNG berukuran 1×1, dan `services/analytics-worker/src/exporter.js:441` menggunakannya untuk `aggregate_png`. Ini melanggar M2-01 dan perbaikan eksplisit di Y05. Jenis ekspor API di `services/directus/extensions/analytics/src/endpoints/analysis/exports-service.js:11` juga belum mencakup PPT.
2. **P1 — Y04/Y06 dan Modul 7 belum diimplementasikan sesuai kontrak.** Migrasi operasional saat ini baru membuat atribut Jabar, talenta/BA, batch, dan laporan KPI. Tidak ditemukan model/route produk terkurasi, Passport, LOI, agenda, tiket klinik, atau FAQ kurasi. `apps/web/app/pages/(public)/katalog.vue:59` masih daftar dummy lokal. `apps/web/app/pages/(public)/konsultasi.vue:73` masih menuju `/sign-uo`; `apps/web/app/components/landing/LandingFaq.vue:15` masih memuat jadwal 2025.
3. **P1 — Dua perbaikan hijau Y05 belum ada.** `apps/web/app/components/dashboard/TabularData.vue` masih memakai filter kategori/wilayah tanpa input pencarian global; `services/directus/extensions/analytics/src/lib/utils/tabular-filter.js` belum menyediakan predikat teks global. `apps/web/app/components/dashboard/map/Choropleth.client.vue:459` hanya mendefinisikan basemap OSM.
4. **Keputusan setelah review — pertahankan ALTCHA.** Plan lama meminta simulasi, sedangkan `apps/web/app/components/auth/Captcha.client.vue:2` memakai ALTCHA dengan verifikasi di Directus. Pengguna memilih implementasi terbaru; plan Y01 kini mengharuskan proof challenge sah, kosong, salah, kedaluwarsa, dan replay sebelum `done`.
5. **P1 — verifikasi pasca-merge belum hijau.** `vue-tsc` gagal pada `altcha`, `crossws`, `ws`, dan tipe `peer`; test extension authentication gagal karena paket `altcha` tidak terpasang di lingkungan lokal. Ini masalah setup yang terlihat, belum bukti regresi perilaku. E2E `apps/web/tests/e2e/roles.spec.ts` masih mengharapkan `/api/auth/login-nib`, “Menu profil”, dan “Admin Provinsi”, sedangkan implementasi sekarang memakai login Directus dan `app_role`. `lockedKotaId()` di `apps/web/app/constants/ROLES.ts:65` masih membaca `user.role` dan bentuk kota objek; `useAuth.ts` sekarang memberi `app_role` dan kota angka. Guard server tetap memiliki test scope, tetapi kunci UI belum dipulihkan.

## Cakupan phase

| Phase | Status | Bukti / gap utama |
| --- | --- | --- |
| Y01 identitas | partial | `app_role`, login NIB, ALTCHA, profil, audit, dan scope server memiliki kode; receipt Y01 tidak ada; proof CAPTCHA, typecheck, dan E2E pasca-merge belum hijau. |
| Y02 Talent | partial | Migrasi E/F, service, halaman, dan test ada. Receipt Y02 sendiri menyebut `partial`; BA/status belum dibuktikan dengan readback disposable dan browser API nyata. |
| Y03 KPI Jumat | partial | Migrasi G, service, PWA, IndexedDB, panel pendamping, dan test ada. Receipt Y03 sendiri menyebut `partial`; replay Jumat→Sabtu dan verifikasi belum dibuktikan pada stack nyata. Receipt masih menyebut “migrasi F” untuk Y03, sedangkan file implementasinya G. |
| Y04 produk/Passport | missing | Tidak ditemukan schema/service/UI produk terkurasi, tanda tangan Ed25519, Passport, atau Showroom. |
| Y05 ekspor/map/Tabular | missing | PNG agregat masih 1×1; PPT dan dua PDF baru belum ada; pencarian global dan satelit belum ada. Ada ekspor dan peta lama, tetapi tidak menutup acceptance Y05. |
| Y06 katalog/LOI | missing | Katalog masih dummy; tidak ada endpoint produk publik terkurasi, detail, atau persistensi LOI. |
| Y07 agenda | missing | Tidak ada model/API agenda, kalender/lini masa, atau adapter pengingat dengan receipt provider. |
| Y08 klinik backend | missing | Tidak ada poli/tiket/slot/outbox dan pembuktian IDOR/provider. |
| Y09 klinik UI/FAQ | missing | Landing masih pengantar, tautan rusak, FAQ lama; tidak ada antrean dan workflow konsultasi. |
| Y10 gate kuning | blocked | 35 M, dua perbaikan hijau, artefak, provider, dan runtime belum terbukti. |
| R01–R04 | blocked | 14 N sengaja menunggu Y10; tidak ditemukan implementasi lengkap sesuai phase. |
| R05 gate merah | blocked | Bergantung pada R01–R04 dan Y10. |

## Verifikasi review

- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py`: lulus, 35 M + 14 N, 15 file phase.
- `node --test` extension operasional: 66/66 lulus; analytics: 81 lulus, 1 integration skip; kontrak Directus: 23/23 lulus; web `npx vitest run`: 29/29 lulus.
- `node --test test/*.test.js` extension authentication: gagal, 5 test file tidak dapat memuat `altcha` dari instalasi lokal.
- `npx nuxt prepare && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`: gagal dengan empat error dependensi/tipe di atas.
- `docker compose -p diskuk-operasional-e2e --env-file .env.example ps` dan `GET http://127.0.0.1:8055/server/health`: stack berjalan, health 200. Tidak menjalankan migrasi, seed, test browser real API, provider, atau perubahan data dalam review ini.

## Urutan lanjut

1. Pulihkan dependensi lokal dan test/auth/typecheck; rapikan E2E yang basi serta `lockedKotaId`, lalu buktikan ALTCHA sesuai keputusan terbaru. Buktikan Y01 pada empat akun disposable dengan scope lintas kota/usaha serta reset/audit/logout.
2. Jalankan migrasi/seed dan pembuktian real API + browser untuk Y02/Y03 pada stack disposable yang sudah ada; simpan receipt dan SQL readback. Jangan naikkan unit/mock menjadi `done`.
3. Kerjakan Y04–Y09 sesuai dependency; perbaiki PNG 1×1, pencarian Tabular, dan satelit di Y05. Tutup provider gate agenda/klinik dengan receipt sandbox atau tandai `not provider-proven`.
4. Jalankan seluruh checklist Y10, lalu mulai R01–R04 dan R05 hanya setelah Y10 berstatus `done`.
