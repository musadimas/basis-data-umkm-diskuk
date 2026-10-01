# Receipt R01 — Branding, demo peran, lima aspek, simulasi koneksi

- **Tanggal:** 28 September 2026.
- **Verdict:** `partial`. Pengguna meminta pekerjaan R01 paralel; [Y10](../stage_1/receipt_Y10_acceptance.md) masih `blocked`, sehingga gate Stage 2 belum lulus.
- **ID:** N1-01, N1-02, N1-03, N2-01, N5-01.
- **Batas lingkungan:** source lokal dan server preview loopback. Tidak ada perubahan production, push, migrasi, atau reset fixture bersama.

## Hasil per ID

| ID | Implementasi | Bukti | Sisa gate |
| --- | --- | --- | --- |
| N1-01 | Login memakai asset `logo-jabar-diskuk.png`, alt text lambang dan DISKUK, serta identitas “Portal Integrasi Satu Data · SIDT Jabar”. | SSR preview `GET /sign-in` memuat ketiganya; build/typecheck lulus. | Browser desktop/mobile terhalang sandbox browser. Verifikasi izin dan versi asset branding resmi oleh pemilik merek. |
| N1-02 | Tombol dengan label SSO Jabar memakai simulasi akun dummy saat demo; jalur provider Directus `jabar` disiapkan tetapi mati secara default, dengan redirect tetap dan pemeriksaan `app_role` saat kembali. Login email/NIB tetap tersedia. | `GET /api/auth/sso/start` tanpa konfigurasi → 503, tanpa meneruskan ke IdP. [Dokumentasi SSO Directus](https://docs.directus.io/self-hosted/sso) menjelaskan login provider dan mode session. | **`not provider-proven`**: kontrak/sandbox IdP Jabar, mapping external ID, state/callback/replay/logout, dan receipt provider belum ada. Simulasi tidak dihitung sebagai SSO asli. |
| N1-03 | Widget empat persona memilih hanya empat email berawalan `dummy_` di server. Endpoint demo butuh dua flag, host loopback, origin sama, JSON, password server-only, ALTCHA, dan cookie sesi HttpOnly dari Directus. Cache privat dibersihkan dan tab lain diberi sinyal `BroadcastChannel` saat berpindah. | Stub Directus lokal: POST role provinsi → 200, cookie sesi diteruskan tanpa token di body; origin luar → 403; role tak dikenal → 400. | Stack disposable nyata: empat sesi dan dashboard ter-scope belum terbukti. Password `DEMO_ACCOUNT_PASSWORD` dari env disposable tidak cocok dengan akun dummy yang ada (`/auth/login` → 401 `INVALID_CREDENTIALS`); akun tidak di-reset karena agent lain memakai fixture. Browser empat persona dan audit switch dua tab tertunda. |
| N2-01 | Endpoint agregasi dari `usaha_tabular`, `usaha`, `usaha_atribut_jabar`, lima tab visual, filter kota/kecamatan/kelurahan, kunci `kota_scope` di server. Setiap indikator memisahkan `ya`, `tidak`, `belumAdaData`; persentase = `ya / (ya + tidak)` dan null saat denominator nol. Labelnya **indikator operasional**, bukan skor resmi. | `permen-aspek.test.cjs` 2/2; query read-only DB disposable wilayah kota id 1: total 4, NPWP ya 3/tidak 0, NIB tercatat 4. | Endpoint Directus baru belum dibangun ulang/deploy ke disposable saat agent lain bekerja. Browser API real, angka seluruh filter, dan waktu query agregasi provinsi belum diuji; belum ada bukti dokumen/SAPA untuk skor resmi. |
| N5-01 | Toggle hanya muncul bila `DEMO_MODE=true`, `DEMO_DISPOSABLE=true`, dan email akun `dummy_`; membedakan simulasi dari status jaringan. Ia menahan `useKpiOutbox.sync()` dan memakai antrean IndexedDB serta retry Y03 saat dipulihkan; tombol mati sewaktu sync. | Typecheck/build lulus; spec Playwright ditambahkan dan terdaftar. Jalur kirim tetap `flushOutbox` Y03. | Browser offline→sync sekali belum terbukti karena Chromium ditolak sandbox. Runtime Jumat/di luar Jumat tetap perlu bukti API Y03. |

## Bukti perintah

| Perintah/probe | Hasil |
| --- | --- |
| `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | exit 0: 35 M, 14 N, semua fase terpetakan. |
| `node --test test/permen-aspek.test.cjs` pada extension operasional | 2 pass, 0 fail. |
| `node --test test/index.test.cjs` pada extension operasional | 4 pass, 0 fail saat diuji. |
| `pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | exit 0. |
| `pnpm build` di `apps/web` | exit 0, Nitro memuat route demo dan SSO. |
| `pnpm lint:oxlint` | exit 0 untuk codebase saat diuji; satu warning di tes katalog yang dikerjakan agent lain. |
| `docker compose --env-file .env.example config --quiet` | exit 0. |
| `GET /sign-in` preview `127.0.0.1:3101` | HTML memuat logo, SIDT Jabar, tombol simulasi SSO. Ini bukti SSR, bukan visual browser. |
| POST `/api/demo/switch` preview + stub Directus loopback | 200 + cookie sesi; body hanya `{data:{role:"provinsi"}}`. POST origin asing 403; role asing 400; GET SSO tanpa config 503. Stub memverifikasi solusi CAPTCHA dan email/password dummy. |
| POST `/api/demo/switch` ke disposable Directus nyata | 503 di endpoint; probe upstream `/auth/login` 401 `INVALID_CREDENTIALS`. Akun dummy ada dan aktif; password env saat ini tidak cocok. Tidak ada credential dicetak. |
| `pnpm exec playwright test tests/e2e/sso-demo.spec.ts --list` | 9 case (desktop/tablet/mobile) terdaftar. |
| Playwright Chromium R01 | gagal sebelum membuka halaman: macOS sandbox menolak `MachPortRendezvousServer` (`Permission denied (1100)`). Safari lewat computer use juga ditolak izin aplikasi; tidak ada klaim browser proof. |

## Regulasi dan definisi data

[JDIH Kementerian UMKM](https://jdih.umkm.go.id/doc/detail/kdaGwXzTbbXQnHCu4fNxvWoUg8_eQQDh3hRUoD9-tj8qjKHI89VYeSW0ITaDbHP-) mengonfirmasi Permen UMKM Nomor 2 Tahun 2026 tentang pedoman klasifikasi dan tingkat perkembangan. [PDF di portal peraturan pusat](https://www.peraturan.go.id/files/perukm-no-2-tahun-2026.pdf) masih bertanda “RANCANGAN” pada halaman pertama; Pasal 16–17 dan Lampiran I yang terlihat mensyaratkan bukti dokumen verifikatif dan penilaian melalui SAPA UMKM. Karena sumber final lampiran dan kontrak SAPA belum diperoleh, nilai boolean repo hanya dipakai sebagai sinyal pendataan. `izin_edar` dalam brief juga bukan pengganti seluruh dokumen legalitas Lampiran I. Tidak ada label “patuh”, “terverifikasi Permen”, atau “Siap Naik Kelas” dari endpoint ini.

## Scope dan tindak lanjut

Snapshot scope diambil **sebelum** edit: `/tmp/operasional-R01-scope.json`. `scope_manifest.json` diamandemen hanya untuk path R01 yang nyata (komponen auth, demo, outbox, web config/Dockerfile, API, receipt); entri `callback.get.ts` dihapus karena callback OIDC/SAML ditangani Directus. `scope_guard check` masih melaporkan path di luar R01 yang berubah **oleh agent paralel** pada Y03/Y10, field UI, program, dan tesnya; path itu tidak diedit oleh R01. Semua path edit R01 tercakup manifest. Jangan menyatakan gate guard global hijau dari snapshot bersama ini.

Setelah pekerjaan Stage 1 selesai: samakan password dummy pada stack disposable lewat runbook seed terotorisasi, rebuild hanya Directus extension dan web pada stack disposable, buktikan empat role serta scope API/browser, ulangi probe offline Jumat→sinkron tepat satu, verifikasi asset branding, dan jalankan ulang Y10. Provider Jabar tetap `not provider-proven` sampai sandbox resmi tersedia; jangan aktifkan `SSO_JABAR_ENABLED` di production dari simulasi ini.

## Addendum 29 September 2026 — bukti runtime pada clone

Verdict tetap `partial` (Y10 `blocked`). Bukti lengkap: [artifacts/R03/runtime-evidence.md](artifacts/R03/runtime-evidence.md), bagian "R01 pending items". Semua dijalankan pada clone `r03_clone` dan container sementara yang sudah dihapus.

| ID | Bukti baru | Sisa gate |
| --- | --- | --- |
| N1-03 | `POST /api/demo/switch` terhadap Directus clone (build `apps/web/.output` jalan native): empat persona → 200 dengan cookie sesi HttpOnly dan body hanya `{data:{role}}`; role asing 400; origin asing 403. Sesi cocok dengan role/email di `/operasional/me`. | Build `.output` bisa tertinggal dari source web terbaru; audit switch dua tab dan browser empat persona belum. |
| N2-01 | Rute sebenarnya `GET /operasional/aspek-perkembangan`. Total/NIB/dampak provinsi, filter kota, dan kabkota cocok dengan SQL independen; umkm 403, anonim 401, `kota=abc` 400. Agregat provinsi 300k baris sintetis: 1,07–1,45 s (orde besaran, bukan SLO). Indikator dampak IP-UMKM turun saat sertifikat dicabut; ketiadaan → `belumAdaData`. | Angka pada data produksi nyata; skor resmi Permen tetap tidak diklaim. |
| N1-02 | Tidak berubah: `not provider-proven`, belum ada sandbox IdP Jabar. | Kontrak IdP. |
| N1-01, N5-01 | Tidak berubah. Chromium ternyata dapat berjalan lokal lewat `pnpm exec playwright test --project=chromium` di `apps/web`; spec `sso-demo.spec.ts` belum dijalankan ulang di sesi ini. | Jalankan `sso-demo.spec.ts`; verifikasi aset logo oleh pemilik merek. |
