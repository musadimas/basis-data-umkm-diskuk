# E2E Plan — Dashboard Operasional Multi-Role (Modul 1–6 `new_requirements.md`)

**Verdict plan:** executor-ready  
**Repository:** `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`  
**Baseline inspeksi:** branch `main`, commit `fc450bb8a06fcd5a6d112dfc35ff65a7ef380f43`, working tree bersih (2026-09-26)  
**Sumber normatif:** `docs/new_requirements.md` (sitemap "DASHBOARD OPERASIONAL", Modul 1–6), keputusan pengguna pada sesi perencanaan (dicatat di §1), `docs/architecture/decisions/*.md`  
**Scope implementasi:** 14 phase; setiap phase satu focused commit; manifest tertutup di `scope_manifest.json`.

## 1. Outcome, pengguna, dan definisi selesai

### Outcome

Dashboard internal `/dashboard` berubah dari satu role analis menjadi dashboard operasional empat role dengan data asli di PostgreSQL/Directus, scoping wilayah server-side, alur Talent Scouting → Program Akselerasi → Monitoring KPI mingguan offline-first → Talent Passport terverifikasi kriptografis, katalog produk Digital Twin milik UMKM, dan perbaikan celah Modul 2–4 pada halaman yang sudah ada. Semua data demo bertanda `dummy_` pada field kunci teknis dan dapat dihapus dengan satu runbook.

### Pengguna dan role

| Role key | Label UI | Directus role | Badge | Beranda |
| --- | --- | --- | --- | --- |
| `provinsi` | Admin Provinsi | `7d6d493c-1a6d-4c59-9e74-40d42a7862eb` (role lama "Application User", di-rename) | `bg-blue-900 text-white` | `/dashboard` |
| `kabkota` | Admin Kab/Kota | `ade3c009-8725-46ba-a7a0-904eeba89d01` | `bg-sky-400 text-sky-950` | `/dashboard` (terfilter wilayah) |
| `pendamping` | Pendamping | `d824230f-46db-407d-b8ea-fb2ed58c6c4f` | `bg-emerald-600 text-white` | `/dashboard/binaan` |
| `umkm` | Pelaku UMKM | `d821d35e-62e1-4f27-a323-843845d6c965` | `bg-amber-400 text-amber-950` | `/dashboard/usaha` (frame ponsel) |

Break-glass Directus admin (`accountability.admin === true`) diperlakukan sebagai `provinsi` tanpa scoping.

### Perilaku saat ini

- Satu role `Application User` dikunci di `services/directus/extensions/shared/auth.cjs::requireDashboardAccountability`; ADR-001 menolak "empat role produk".
- `/dashboard` (Infografis), `/dashboard/analitik`, `/dashboard/tabular`, `/dashboard/spasial`, `/dashboard/umkm/:id` sudah ada; tidak ada navigasi per role, tidak ada Talent Scouting, KPI, Passport, produk.
- Sign-in hanya email + password (`apps/web/app/components/auth/SignInForm.vue`), show/hide password sudah ada.
- Tabular tanpa pencarian global; ekspor Canvas hanya CSV/PNG/PDF; popup titik peta hanya nama/skala/produk/wilayah; basemap hanya OSM.
- Data SIDT (49 kolom, `scripts/ingest-sidt.py::EXPECTED_COLUMNS`) tidak memuat sertifikasi, NPWP, QRIS, e-commerce, pembukuan, KUR, kemitraan.

### Perilaku target

Empat role login dengan akun Directus sungguhan (email atau NIB untuk UMKM), navigasi dan beranda per role, header profil kanan atas dengan badge warna role, halaman akun + log aktivitas, widget demo pengalih peran (hanya `DEMO_MODE=true`), scoping Kab/Kota di seluruh endpoint data, 15 Atribut Jabar + edit data lapangan + verifikasi, Executive Summary (5 aspek Permen No. 2/2026 + kuota pendataan), Talent Scouting (rubrik 4×25%, Berita Acara), Program Akselerasi (batch, tahap, pendamping), laporan KPI mingguan offline-first, verifikasi pendamping, monitoring eksekutif (kepatuhan, kenaikan omzet, tren target vs realisasi, peta at-risk), produk Digital Twin + kurasi, Talent Passport (QR, Ed25519, radar 5 dimensi, badge, showroom, halaman verifikasi publik, PDF), ekspor PPT, pencarian trigram, popup peta diperkaya + basemap satelit.

### Keputusan produk dan arsitektur yang dikunci

1. Empat role dibuat sekarang; role lama `Application User` (UUID tetap) di-rename menjadi **Admin Provinsi**; akun & test existing tetap berfungsi.
2. Data disimpan sungguhan di PostgreSQL via migrasi Directus; data demo ditandai prefix `dummy_` hanya pada field kunci teknis (email akun, `usaha.sumber_id`, `pelaku_usaha.nik`, kolom `kode` tabel referensi/batch/kuota, `nomor` Berita Acara, `filename_download` berkas). Nama tampilan tetap bersih. Baris anak dari usaha dummy terhapus lewat `ON DELETE CASCADE`.
3. UMKM dummy adalah baris `usaha` baru (ikut ke analitik/tabular/peta lewat outbox + rebuild).
4. Floating Role Switcher dibuat sungguhan: endpoint server Nuxt menukar session Directus ke akun `dummy_` tetap; aktif hanya bila `DEMO_MODE=true`; password (`DEMO_ACCOUNT_PASSWORD`) tidak pernah dikirim ke browser. Login di browser berbeda tetap didukung.
5. Login: show/hide password dan login dengan NIB 13 digit **fungsional**; "Lupa Kata Sandi?", "Masuk Menggunakan SSO Jabar", dan CAPTCHA **dummy** (placeholder berlabel "Simulasi", tidak memblokir login, tidak memanggil layanan eksternal).
6. Scoping Admin Kab/Kota ditegakkan server-side di **semua** endpoint data (tabular, infografis, analitik termasuk options/records/profile/exports, spasial; PMTiles ditolak → fallback GeoJSON terfilter).
7. 15 Atribut Jabar (tabel 1:1 `usaha_atribut_jabar`, nullable = belum didata): `npwp_usaha, izin_edar, sertifikat_halal, pirt_bpom, hki_merek, sni, rekening_terpisah, sop_tertulis, ecommerce, medsos_bisnis, qris, pembukuan_digital, akses_kur, rantai_pasok_industri, kontrak_offtaker`.
8. Admin Kab/Kota (dan Provinsi) boleh mengubah 15 atribut **dan** kolom SIDT terpilih; konsekuensi: perubahan dapat ditimpa ingest SIDT berikutnya bila sumber lebih baru (`scripts/ingest-sidt.py::incoming_is_newer`) dan setiap edit memicu outbox `project_record_change`.
9. Talent Scouting: Kab/Kota dan Provinsi mengajukan; skor dihitung server-side dengan rubrik deterministik v1 (§4 ledger); Provinsi menominasikan, menolak, dan menerbitkan Berita Acara.
10. Status talenta: `diajukan → dinilai → scouting → talent_lab → accelerator → champion`, plus `ditolak` (dari `diajukan`/`dinilai`).
11. Laporan KPI boleh dikirim kapan saja, maksimal satu per minggu program; minggu dihitung dari `program_batch.tanggal_mulai` dalam zona `Asia/Jakarta`.
12. Target mingguan = `talenta.target_mingguan_override` bila ada, selain itu `round(omzet_tahunan / 52 × program_batch.faktor_target)` (default faktor 1,20); `omzet_tahunan` null → target null ("Target belum tersedia").
13. At-risk = dua minggu program berurutan dengan laporan `disetujui` dan `omzet < 0,7 × target` minggu itu.
14. Talent Passport lengkap sesuai Modul 6 bagian 1; tanda tangan Ed25519 (`node:crypto`), kunci privat di env Directus `PASSPORT_SIGNING_PRIVATE_KEY_B64`; QR menunjuk halaman publik `/verifikasi/<kode>`.
15. PDF passport/katalog dan PPT Canvas dibuat oleh worker ekspor yang ada (`analitik_job` tipe `export`).
16. Pencarian Tabular: NIK 16 digit / NIB 13 digit exact; nama usaha/pemilik "mengandung" via `pg_trgm` + GIN index di tabel sumber `usaha.nama` dan `pelaku_usaha.nama_lengkap`; index dibuat oleh skrip SQL `CONCURRENTLY` terpisah (bukan migrasi boot).
17. Basemap: Street = OpenStreetMap (existing), Satellite = Esri World Imagery raster tanpa API key dengan atribusi.
18. Setelah selesai, poin requirement yang terimplementasi ditandai di `docs/new_requirements.md`.

### Non-goals

- Modul 6 bagian 2 (Matchmaking Investor, Deal Card, LOI) dan seluruh Modul 7 (portal publik, katalog publik, kalender kegiatan, fasilitasi bantuan, klinik konsultasi, FAQ).
- SSO Jabar, CAPTCHA, dan reset password yang sungguhan; notifikasi WhatsApp/email.
- Offline cold-reload aplikasi (service worker app-shell); offline-first berarti antrean IndexedDB + sinkronisasi otomatis selama halaman terbuka.
- Perlindungan edit lapangan dari penimpaan ingest SIDT berikutnya.
- Memperbaiki renderer PNG/PDF agregat existing (`services/analytics-worker/src/export-renderer.js::renderPng` masih piksel 1×1) — hanya dicatat.
- Menjalankan migrasi, seed, index, atau deploy pada database production.
- Memperbarui `scripts/dev-direct.sh` (tetap hanya membangun extension analitik; database production belum memiliki tabel baru sampai deploy terkonfirmasi, sehingga extension `operasional` tidak berfungsi di mode itu).
- Menghapus kode mati existing (`apps/web/app/components/nav/User.vue`, `apps/web/app/components/nav/TeamSwitcher.vue`, `apps/web/app/components/nav/Header.vue` hanya disentuh agar typecheck lulus) — hanya dicatat.
- Toggle peta "Tampilkan Klaster KBLI" dan "Tampilkan Sentra Industri" (Modul 3 butir 3) — tidak dipilih pengguna.
- Membuktikan klaim teks kepatuhan "enkripsi AES-256" pada layar login (teks disalin apa adanya dari requirement; kebenaran klaim di luar plan).
- Halaman publik `/verifikasi/<kode>` tidak menampilkan showroom/foto/pemilik (hanya payload bertanda tangan).

### Completion definition

Semua 14 phase `proven` pada gate statis/test lokal; bukti runtime disposable stack dicatat per phase (`proven` atau `not runtime-proven` dengan alasan); `scope_guard.py check` hijau per phase; `docs/new_requirements.md` ditandai (Phase 14); runbook dummy (`docs/operasional/dummy-data-runbook.md`) terbukti menghapus seluruh data `dummy_` di disposable stack.

## 2. Evidence map

| Jalur / simbol | Fakta yang mengikat plan |
| --- | --- |
| `services/directus/extensions/shared/auth.cjs::requireDashboardAccountability` | 401 tanpa user; 403 bila bukan admin dan `accountability.role !== APPLICATION_ROLE_ID`; dipakai `routeGuard` oleh tabular, infografis, analitik. |
| `services/directus/migrations/20260819A-private-dashboard-access.js` | Role `7d6d493c…`, policy `9325db4b…`, access `c2bd9d4a…`; permission `directus_users.read` hanya `id,email,first_name,last_name,avatar`. |
| `services/directus/migrations/20260819C-create-analytics-foundation.js` | Trigger `analitik_capture_source_change`: `usaha` → `project_record_change`; tabel referensi (`pelaku_usaha`,`alamat`,`kota`,…,`statistik_tenaga_kerja`) → `rebuild_current_model`; permission `analitik_view` CRUD owner-only dan `usaha` read/update status untuk policy provinsi. |
| `services/directus/migrations/20250801C-create-businesses.js` | `usaha(id uuid, sumber_id, pelaku_usaha, nib UNIQUE, nama, klasifikasi, skala CHECK micro/small/medium, omzet_tahunan, total_aset, alamat, latitude, longitude, date_created timestamptz)`. |
| `services/directus/migrations/20250801B-create-entrepreneurs.js` | `pelaku_usaha.nik VARCHAR(16) NOT NULL UNIQUE`, `nama_lengkap`, `jenis_kelamin CHECK male/female`. |
| `services/analytics-worker/src/rebuild.js::refreshLegacySnapshots` | `usaha_tabular` hanya di-TRUNCATE+INSERT saat rebuild penuh; `projector.js::projectRecord` hanya memperbarui `analitik_usaha_current`. |
| `services/directus/extensions/shared/tabular-filter.cjs::buildTabularFilter` | Filter tabular/infografis dari `query.kota/kecamatan/kelurahan/skala/kegiatan/kbli`; tanpa filter → fast path `infografis_snapshot`. |
| `services/directus/extensions/directus-extension-analitik/src/query-compiler.js::filterExpression` | Filter `{fieldId, operator, value}`; `kota_id` bertipe integer (`eq/neq/in`); `QUERY_BUDGET.maxFilters = 8`. |
| `services/directus/extensions/directus-extension-analitik/src/aggregate-cache.js::aggregateCacheKey` | Key memuat `permissionScope` dan plan (filter) → scoping mengubah key. |
| `services/directus/extensions/directus-extension-analitik/src/exports-service.js::TYPES`, `insertJob` | Tipe ekspor tertutup; job `analitik_job(job_type='export', export_type, owner, request)`. |
| `services/analytics-worker/src/exporter.js::processExport`, `extensionFor` | Worker merender per `export_type`; tipe tak dikenal → `EXPORT_TYPE`. |
| `apps/web/server/utils/directus-proxy.ts::proxyToDirectus` | Semua `/panel/*` diteruskan ke Directus; policy cookie wajib kecuali login/logout; header non-allowlist tidak diteruskan; body dibaca `readRawBody(event)` (UTF-8 string → merusak biner). |
| `apps/web/server/utils/session-policy.ts::setPolicyCookies` | Cookie policy HMAC harus diset setelah login sukses. |
| `apps/web/app/composables/useAuth.ts::currentUser` | Bootstrap via `/panel/users/me`; state `auth:user`, `auth:status`. |
| `apps/web/app/middleware/auth.global.ts` | Hanya cek autentikasi untuk `/dashboard*`, tidak ada otorisasi role. |
| `apps/web/app/constants/NAVIGATION.ts::NAVIGATION_LINKS` | Satu grup `dashboard` 4 item statis. |
| `apps/web/app/lib/idb.ts::clearPrivateClientState` | Semua store IndexedDB privat dibersihkan saat logout/revocation. |
| `apps/web/tests/fixtures/mock-directus.mjs::installMockDirectus`, `loginMock` | Mock browser untuk `/panel/**`; `loginMock` bergantung pada label `Email`, tombol `Masuk`, `Tampilkan kata sandi`. |
| `apps/web/tests/fixtures/mock-directus-server.mjs` | Mock SSR port 3101; menjawab `/users/me` statis. |
| `apps/web/playwright.config.ts` | Proyek `chromium` (UTC), `tablet` (America/Los_Angeles), `mobile` (UTC). |
| `scripts/dev-direct.sh` | Menjalankan Directus lokal terhadap **Postgres production** lewat tunnel — dilarang untuk executor. |
| `docker-compose.yml`, `docker/Dockerfile.directus` | Port tetap `127.0.0.1:{5432,8055,3000}`; setiap extension harus dibangun eksplisit di Dockerfile. |
| `services/directus/init.sh` | `migrate:latest` saat boot → migrasi berat memblokir startup. |

## 3. Current dan target end-to-end flow

### Current read

```text
browser -> Nuxt page useFetch(/panel/<ext>/...) -> proxyToDirectus (policy cookie) -> Directus endpoint routeGuard(Application User|admin) -> SQL usaha_tabular / infografis_snapshot / analitik_usaha_current -> JSON -> komponen
```

### Current write/publish

```text
ingest SIDT / Directus item write -> trigger analitik_capture_source_change -> analitik_job -> worker project_record_change | rebuild_current_model -> analitik_usaha_current (+ usaha_tabular/infografis_snapshot hanya saat rebuild)
```

### Target mutation/projection

```text
browser form -> /panel/operasional/<route> -> operasional extension -> requireRole + resolveOperator(role, kotaId, usahaId) -> validasi domain + transaksi SQL -> tabel domain (talenta, laporan, produk, atribut, kuota)
edit SIDT usaha -> trigger -> worker project_record_change -> analitik_usaha_current + refreshLegacyTabularRow(usaha_tabular)
upload berkas -> /panel/files (body biner utuh) -> directus_files folder operasional -> id direferensikan tabel domain -> GET /panel/operasional/berkas/:id (otorisasi domain) -> stream
laporan offline -> IndexedDB kpiOutboxStore -> event online / toggle demo -> POST /panel/operasional/laporan (client_uuid idempotent)
ekspor dokumen -> operasional/analitik insert analitik_job(export) -> worker render (PDF/PPTX) -> object store -> /panel/analitik/exports/:id/download (owner)
```

### Target query/consumer

```text
login -> useAuth.currentUser(/panel/operasional/me) -> role + kota + usaha -> middleware allowedRoute(role) -> layout (dashboard | umkm) -> NAVIGATION_LINKS[role]
kabkota -> endpoint existing -> scopeTabularQuery / scopeAnalysisRequest (kota dipaksa) -> data wilayah
QR passport -> /verifikasi/<kode> (publik) -> Nuxt server /api/publik/passport/<kode> -> Directus /operasional/publik/passport/<kode> -> verifikasi Ed25519 -> kartu publik
```

### Target failure flow

```text
role tidak diizinkan -> Directus 403 FORBIDDEN (JSON errors[]) ; web middleware redirect ke ROLE_HOME[role]
kabkota tanpa kota -> 403 KOTA_NOT_ASSIGNED ; umkm tanpa usaha -> 403 USAHA_NOT_ASSIGNED
data milik wilayah/peserta lain -> 404 NOT_FOUND (tidak membocorkan keberadaan)
transisi status ilegal -> 409 INVALID_TRANSITION ; laporan minggu duplikat -> 409 WEEK_ALREADY_REPORTED ; client_uuid ulang -> 200 dengan laporan yang sama
DEMO_MODE != true -> /api/demo/switch 404 ; secret internal hilang -> 503 ; kunci passport hilang -> 503 PASSPORT_SIGNING_UNAVAILABLE
offline submit -> antre IndexedDB + pesan "Laporan berhasil diamankan di ponsel Anda" ; sinkron gagal 4xx -> item ditandai gagal dengan pesan, tidak dihapus diam-diam
```

## 4. Contract ledger

| Area | Final contract |
| --- | --- |
| Producer | Extension baru `services/directus/extensions/directus-extension-operasional` (id `operasional`, CommonJS, build `cp -R src/* dist/`); modul existing tabular/infografis/analitik hanya menerima scoping; worker menambah refresh baris `usaha_tabular` dan tipe ekspor `passport_pdf`, `katalog_pdf`, `aggregate_pptx`. |
| Persistence | Migrasi `20260926A` (roles), `B` (akses analitik kabkota), `C` (atribut Jabar), `D` (kuota), `E` (talenta/BA/berkas), `F` (program akselerasi/laporan), `G` (produk), `H` (passport_kode), `I` (pg_trgm). Tabel baru: `usaha_atribut_jabar`, `kuota_pendataan`, `talenta`, `talenta_berita_acara`, `program_batch`, `talenta_laporan_mingguan`, `produk`, `produk_foto`; kolom baru `directus_users.kota`, `directus_users.usaha`, `talenta.passport_kode`; folder `directus_folders` `fa57be17-82ba-480c-b77c-536d42a124d4` ("operasional"); ekstensi `pg_trgm`. Semua FK ke `usaha` `ON DELETE CASCADE`; FK audit ke `directus_users` `ON DELETE SET NULL`. |
| Serialization/API | JSON camelCase; sukses `{ data, meta? }`; gagal `{ errors: [{ message, extensions: { code, status } }] }` via `OperasionalError`; header `Cache-Control: private, no-store`. Nilai rupiah integer (BIGINT → `Number`); skor 2 desimal. |
| Consumers | Halaman `apps/web/app/pages/(private)/dashboard/**` per role, layout `dashboard`/`umkm`, halaman publik `apps/web/app/pages/(public)/verifikasi/[kode].vue`, worker ekspor. |
| Permissions | Directus policy per role hanya untuk: baca diri sendiri (`directus_users`: `id,email,first_name,last_name,avatar,role,kota,usaha`), `analitik_view` owner-only (provinsi+kabkota), `directus_files` create (folder operasional, tipe gambar/PDF) + read own. Semua data domain hanya lewat endpoint `operasional` yang memanggil `requireRole` + `resolveOperator`. |
| Role matrix | Analitik/Infografis/Tabular/Spasial: provinsi (penuh), kabkota (dipaksa kota). Talent: ajukan provinsi+kabkota(kota sendiri); nominasi/tolak/BA/tahap/batch provinsi. Laporan: kirim umkm (usaha sendiri); verifikasi pendamping (peserta binaannya). Monitoring: provinsi+kabkota(scoped). Produk: CRUD umkm (usaha sendiri), kurasi provinsi. Passport: umkm (milik sendiri), provinsi, kabkota (scoped); publik via kode. |
| Talent Index v1 | Finansial = `70×min(omzet_tahunan/600.000.000,1) + 15×pencatatan_keuangan_digital + 15×akses_kur`; Pasar = `25×ecommerce + 25×medsos_bisnis + 25×adopsi_qris + 25×min(kapasitas_produksi_bulanan/1000,1)`; Legalitas = `20×(nib ada) + 20×npwp_usaha + 20×(kesiapan_halal ∨ sertifikat_halal) + 20×(kesiapan_pirt_bpom ∨ pirt_bpom) + 20×(kesiapan_hki ∨ hki_merek)`; SDM = `30×min(total_tenaga_kerja/10,1) + 20×rekening_terpisah + 20×sop_tertulis + 30×(surat_komitmen ada)`; null = false/0; total = rata-rata 4 aspek, 2 desimal; label ≥75 "Direkomendasikan Masuk Talent Pool", ≥60 "Dipertimbangkan", selain itu "Belum Direkomendasikan"; `rubrik_versi = 1`. |
| Permen No. 2/2026 | Legalitas & Formalitas = {nib ada, npwp_usaha, izin_edar}; Manajemen & Tata Kelola = {rekening_terpisah, sop_tertulis}; Pemasaran & Digitalisasi = {ecommerce, medsos_bisnis, qris}; Keuangan & Akses Pembiayaan = {pembukuan_digital, akses_kur}; Kemitraan & Jejaring = {rantai_pasok_industri, kontrak_offtaker}. Per aspek: terpenuhi (semua true), sebagian, belum (semua false/null) untuk usaha yang punya baris atribut; `belumDidata = populasi − jumlah baris atribut`. Skor Permen per usaha = rata-rata 5 aspek (persentase atribut true). |
| Radar Passport (0–100) | Model Bisnis = `40×min(produk_tayang/3,1) + 30×hki_merek + 30×(sni ∨ sertifikat_halal)`; Keuangan = `skor_finansial`; Legalitas & SOP = `(skor_legalitas + 50×rekening_terpisah + 50×sop_tertulis)/2`; Digitalisasi = `skor_pasar`; Eskalasi = `40×rantai_pasok_industri + 30×kontrak_offtaker + 30×(rata-rata bahan_baku_lokal_persen produk/100)`. |
| Time/date | `TIMESTAMPTZ` disimpan UTC, diserialisasi ISO-8601 dengan `Z`; kolom `DATE` (`program_batch.tanggal_mulai`, `talenta_berita_acara.tanggal`) selalu diseleksi `to_char(col,'YYYY-MM-DD')` dan diparse sebagai tanggal kalender WIB (tanpa `new Date(date)` lokal). Minggu program = `floor((tanggalHariIniJakarta − tanggal_mulai)/7)+1`, dihitung dengan `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'})`. Tampilan `id-ID` zona `Asia/Jakarta`. Uji lintas zona: `2026-10-04T17:30:00Z` = Senin 2026-10-05 00:30 WIB → minggu berikutnya; Playwright `tablet` (America/Los_Angeles) menampilkan tanggal WIB yang sama. |
| Failure behavior | Kode stabil: `AUTHENTICATION_REQUIRED` 401, `INVALID_CREDENTIALS` 401 (server Nuxt), `FORBIDDEN` 403, `KOTA_NOT_ASSIGNED` 403, `USAHA_NOT_ASSIGNED` 403, `NOT_FOUND`/`PROFILE_NOT_FOUND`/`PASSPORT_BELUM_TERSEDIA` 404, `VALIDATION_FAILED`/`Q_TOO_SHORT` 400 (+`extensions.fields`), `INVALID_TRANSITION`, `WEEK_ALREADY_REPORTED`, `PHOTO_LIMIT`, `TALENTA_SUDAH_ADA`, `PROGRAM_BELUM_AKTIF`, `REKOMENDASI_DIPERLUKAN`, `BELUM_LAYAK_REKOMENDASI`, `NIB_CONFLICT`, `ATRIBUT_BELUM_DIISI`, `KODE_SUDAH_ADA` 409, `PASSPORT_SIGNING_UNAVAILABLE`, `INTERNAL_SECRET_UNAVAILABLE` 503, `DEMO_ACCOUNT_UNAVAILABLE`/`UPSTREAM_UNAVAILABLE` 502. |
| Compatibility | Akun Application User existing tetap login sebagai `provinsi`; `/panel/users/me` tetap tersedia; filter/URL analitik existing tetap valid; fixtures e2e existing diperbarui tanpa mengubah assert perilaku provinsi. |
| Dummy marker | Akun `dummy_admin@diskuk.jabarprov.go.id`, `dummy_admin.subang@jabarprov.go.id`, `dummy_coach.pendamping@jabarprov.go.id`, `dummy_wawan.leathercraft@gmail.com`; usaha `sumber_id LIKE 'dummy\_%'` dengan UUID `d0000000-0000-4000-8000-0000000000NN`; NIB dummy `99000000000NN`; NIK `dummy_00000000NN`; referensi wilayah yang dibuat seed `kode LIKE 'dummy\_%'`; batch `kode LIKE 'dummy\_%'` (`dummy_ACC-2026-B1`, `dummy_TL-2026-B1`); kuota `kode='dummy_KUOTA-<kotaId>-2026'`; BA `nomor LIKE 'dummy_BA-%'`; berkas `filename_download LIKE 'dummy\_%'`. |

## 5. Intentional visual dan behavior deltas

| Surface | Before | After | Evidence wajib |
| --- | --- | --- | --- |
| `/sign-in` | Email + sandi + "Masuk" | Field "Email / NIB", toggle sandi, tautan "Lupa Kata Sandi?" (dialog simulasi), placeholder CAPTCHA berlabel "Simulasi CAPTCHA (prototipe)", tombol "Masuk ke Dashboard", tombol "Masuk Menggunakan Jabar Digital Services / SSO Jabar" (simulasi), teks kepatuhan UU PDP, logo DISKUK + "Portal Integrasi Satu Data SIDT Jabar" | screenshot `sign-in-before.png`/`sign-in-after.png` (chromium + mobile) |
| Layout dashboard | Sidebar + konten | + header profil kanan atas (avatar, nama, badge role, instansi, dropdown) | `dashboard-header-{provinsi,kabkota,pendamping}.png` |
| Sidebar | 4 menu statis | Menu per role | screenshot per role |
| `/dashboard/spasial` | root `h-dvh` | root `h-[calc(100dvh-3.5rem)]` (ruang header) | `spasial-before.png`/`spasial-after.png` |
| Widget demo | tidak ada | pill kanan bawah "Mode Pengujian Prototipe: Pilih Peran Aktif" (hanya DEMO_MODE) | `demo-switcher-open.png` |
| UMKM | tidak ada | frame ponsel 390×844 di ≥md, tab bawah 4 menu, banner konektivitas hijau/kuning | `umkm-beranda.png` (chromium + mobile) |
| Infografis | kartu existing | + kartu "Tingkat Perkembangan Usaha (Permen UMKM No. 2/2026)" + "Capaian Pendataan vs Target Kuota" + ringkasan pipeline talenta; kabkota: filter kota terkunci | `infografis-provinsi.png`, `infografis-kabkota.png` |
| Tabular | filter + aksi "Lihat Profil UMKM" | + kotak pencarian global + aksi "Ajukan ke Talent Scouting" + "Ubah Data Lapangan" | `tabular-search.png` |
| Popup titik peta | nama/skala/produk/wilayah | + pemilik, KBLI, omzet, badge sertifikasi, status talenta, tautan "Buka Profil Lengkap"; toggle basemap Street/Satellite | `map-popup.png`, `map-satellite.png` |
| Profil UMKM | "Edit di Directus" | "Ubah Data Lapangan" (in-app); archive/restore hanya provinsi | `umkm-profile-actions.png` |
| Ekspor Canvas | CSV/PNG/PDF | + "Slide PPT" | `export-dialog.png` |

Halaman baru (bukan parity): akun, talenta (daftar/ajukan/detail), akselerasi, binaan (daftar/detail/verifikasi), usaha (beranda/laporan/passport/produk), kurasi-produk, data-lapangan, verifikasi publik — setiap phase mencantumkan screenshot bernama.

## 6. Phase index

| Phase | Depends on | Exit result | Rationale |
| --- | --- | --- | --- |
| 1 — Fondasi identitas & role (backend) | — | 4 role + policy, `directus_users.kota/usaha`, `requireRole`/`resolveOperator`, extension `operasional` (`/me`, `/internal/resolve-nib`, `/aktivitas`), seed akun dummy + usaha Wawan, cleanup, runbook, ADR-007 | Kontrak identitas harus ada sebelum UI dan scoping. |
| 2 — Identitas & navigasi web | 1 | Login email/NIB, demo switcher, header profil, menu & route guard per role, layout UMKM, halaman akun, placeholder beranda pendamping/UMKM | Vertical slice login → beranda per role. |
| 3 — Scoping wilayah Kab/Kota | 1, 2 | Semua endpoint data existing memaksa kota untuk kabkota; UI filter kota terkunci; route kabkota dibuka | Batas keamanan data sebelum fitur baru memakai data wilayah. |
| 4 — 15 Atribut Jabar & data lapangan | 3 | Tabel atribut, edit SIDT+atribut, verifikasi, refresh `usaha_tabular` per-record, aksi profil in-app | Dasar data untuk Permen, rubrik, badge. |
| 5 — Executive Summary & kuota | 4 | Kartu 5 aspek Permen + kuota pendataan (edit provinsi) di `/dashboard` | Konsumen pertama atribut. |
| 6 — Talent Scouting | 4 | Pengajuan + hitung skor + nominasi/tolak + Berita Acara; infrastruktur upload berkas; aksi "Ajukan" di Tabular | Pipeline talenta; upload pertama. |
| 7 — Program akselerasi & laporan KPI UMKM | 6 | Batch, tahap, pendamping; beranda UMKM; laporan mingguan offline-first | Laporan butuh peserta accelerator. |
| 8 — Verifikasi pendamping | 7 | Dasbor binaan, antrean verifikasi, modal bukti + zoom, tren per peserta, rekomendasi pitching | Konsumen laporan. |
| 9 — Monitoring eksekutif | 8 | Kepatuhan, kenaikan omzet, tren agregat, peta at-risk, ringkasan pipeline | Agregat laporan terverifikasi. |
| 10 — Produk Digital Twin & kurasi | 6 | CRUD produk UMKM + maks 5 foto + deklarasi PDN + kurasi provinsi | Dibutuhkan radar/showroom passport. |
| 11 — Talent Passport | 7, 10 | Kartu passport, QR, Ed25519, radar, badge, showroom, verifikasi publik | Menggabungkan talenta, atribut, produk. |
| 12 — Ekspor dokumen | 11 | `passport_pdf`, `katalog_pdf`, `aggregate_pptx` + tombol | Worker boundary terpisah (dependency baru). |
| 13 — Pencarian & peta diperkaya | 6 | Pencarian trigram, popup kaya, basemap satelit | Popup memakai status talenta. |
| 14 — Penutupan | 1–13 | `new_requirements.md` ditandai, README diperbarui, validasi penuh | Serah terima. |

## 7. Global validation matrix

| Category | Command/proof | Expected |
| --- | --- | --- |
| Scope | `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check --snapshot /tmp/operasional-phase-N-before.json --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase N` | exit 0, `outside: []` |
| Source inspection | anchor `rg` per phase | anchor ditemukan sesuai phase file |
| Lint repo | `pnpm lint:oxlint` | exit 0 (baseline 0 warning/0 error) |
| Lint web (file berubah) | `(cd apps/web && pnpm exec eslint --max-warnings 0 <file berubah .vue/.ts>)` | exit 0 (full `pnpm lint` baseline sudah gagal karena 5 warning pre-existing di `QueryBuilder.vue`, `SaveAnalysisDialog.vue`, `SavedAnalysisMenu.vue` — di luar scope) |
| Typecheck web | `pnpm --dir apps/web typecheck` | exit 0 |
| Unit web | `pnpm --dir apps/web test:unit` | baseline 17 pass + test baru pass |
| Extension tests | `pnpm --dir services/directus/extensions/directus-extension-<x> test` | baseline analitik 27 pass/1 skip, tabular 15, infografis 7; operasional baru pass |
| Foundation contract | `pnpm --dir services/directus test` | baseline 5 + kontrak baru pass |
| Worker | `pnpm --dir services/analytics-worker test` | baseline 21 + baru pass |
| Browser (mock) | `(cd apps/web && pnpm exec playwright test <spec> --project=chromium)` (+ `--project=tablet` / `--project=mobile` bila disebut) | pass; screenshot bernama tersimpan di `apps/web/test-results/**` |
| Build | `pnpm --dir apps/web build` | exit 0 |
| Compose config | `docker compose --env-file .env.example config --quiet` | exit 0 |
| Disposable runtime | prosedur di bawah | bukti per phase; bila Docker tidak tersedia → `not runtime-proven` |
| Migration | disposable stack: log Directus `migrate:latest` sukses; `psql` cek tabel/kolom | tabel sesuai phase |
| Provider/Deployment/Production | tidak dijalankan | `not applicable` / wajib konfirmasi pengguna |

**Prosedur disposable stack** (hanya lokal; pastikan port 5432, 8055, 3000 bebas: `lsof -iTCP:5432 -iTCP:8055 -iTCP:3000 -sTCP:LISTEN` harus kosong):

```bash
python3 - <<'PY'
import pathlib, re, secrets, subprocess, base64
src = pathlib.Path(".env.example").read_text()
seen = {}
def repl(m):
    seen.setdefault(m.group(0), secrets.token_urlsafe(24).replace("-", "x").replace("_", "y"))
    return seen[m.group(0)]
out = re.sub(r"change-me[\w-]*", repl, src)
def setvar(text, name, value):
    line = f"{name}={value}"
    if re.search(rf"^{name}=", text, flags=re.M):
        return re.sub(rf"^{name}=.*$", lambda _m: line, text, flags=re.M)
    return text + "\n" + line + "\n"
out = setvar(out, "DEMO_MODE", "true")
out = setvar(out, "DEMO_ACCOUNT_PASSWORD", secrets.token_urlsafe(18))
out = setvar(out, "OPERASIONAL_INTERNAL_SECRET", secrets.token_urlsafe(32))
pem = subprocess.run(["openssl", "genpkey", "-algorithm", "ed25519"], check=True, capture_output=True).stdout
out = setvar(out, "PASSPORT_SIGNING_PRIVATE_KEY_B64", base64.b64encode(pem).decode())
pathlib.Path("/tmp/operasional-e2e.env").write_text(out)
PY
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env up -d --build postgis pgbouncer redis minio minioclient directus web analytics-worker
set -a; . /tmp/operasional-e2e.env; set +a
node scripts/provision-application-user.mjs
DIRECTUS_BASE_URL=http://127.0.0.1:8055 node scripts/seed-dummy-operasional.mjs seed
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_DATABASE" < scripts/seed-dummy-operasional.sql
# ... bukti phase ...
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env down -v
```

Real-API browser proof: `(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 DEMO_ACCOUNT_PASSWORD="$DEMO_ACCOUNT_PASSWORD" pnpm exec playwright test tests/e2e/operasional.directus.spec.ts --project=chromium)`.

## 8. Dirty-worktree dan high-risk boundaries

### Baseline yang wajib dipertahankan

- `docs/` tercantum di `.gitignore` (file docs lama di-force-add). File docs **baru** dalam manifest wajib `git add -f <path>` sebelum `scope_guard.py check`/commit. Folder plan ini sendiri juga ter-ignore: untuk meng-commit plan, pengguna menjalankan `git add -f docs/dashboard-operasional-e2e-plan`. `docs/new_requirements.md` untracked + ignored dan tidak di-commit oleh plan.
- Dirty file pre-existing di luar plan: `.zcodeignore` (untracked) — jangan diubah/dihapus.
- `pnpm --dir apps/web lint` penuh sudah gagal di baseline (5 warning `vue/html-self-closing` pre-existing); gunakan eslint per file berubah.

- Working tree bersih pada `fc450bb`; setiap phase dimulai dari tree bersih atau hanya berisi commit phase sebelumnya.
- Akun Application User existing, URL analitik existing, dan seluruh test existing tetap lulus (fixture boleh diperbarui hanya sebagaimana ditulis phase).

### Dilarang tanpa pengecualian

- `git reset --hard`, `git clean`, `git stash` seluruh tree, `git push`, force push.
- Membaca atau mencetak `.env`, file kunci, dump data, atau data PII; hanya `.env.example` dan `/tmp/operasional-e2e.env` yang dibuat sendiri.
- Menjalankan `pnpm dev:direct` / `scripts/dev-direct.sh` (terhubung ke Postgres production).
- Menjalankan migrasi, seed, cleanup, `scripts/create-operasional-search-indexes.sql`, atau `docker compose` tanpa `-p diskuk-operasional-e2e` terhadap database selain disposable stack.
- Menulis file di luar closed manifest phase aktif.

### Operasi yang memerlukan konfirmasi pengguna

- Deploy, migrasi/seed/cleanup/index pada environment bersama atau production.
- Menambah dependency di luar yang ditetapkan (`uqr@0.1.3` untuk web dan worker, `pptxgenjs@4.0.1` untuk worker).
- Amandemen scope (lihat §11).

## 9. Global invariants

1. Setiap endpoint `operasional` memanggil `requireRole(req, roles)` sebelum menyentuh database, lalu `resolveOperator` untuk scoping; tidak ada endpoint yang mempercayai `kota`/`usaha` dari klien untuk otorisasi.
2. Kab/Kota tidak pernah menerima baris di luar `operator.kotaId` dari endpoint mana pun.
3. Tidak ada password, secret, atau kunci privat di bundle browser, response API, atau log.
4. Semua SQL memakai parameter binding; nama kolom dinamis hanya dari allowlist konstan.
5. `TIMESTAMPTZ` UTC di storage; kolom `DATE` diserialisasi `YYYY-MM-DD`; hitungan minggu memakai `Asia/Jakarta`.
6. Data dummy hanya lewat `scripts/seed-dummy-operasional.{mjs,sql}` dan selalu memakai marker §4.
7. Response data privat selalu `Cache-Control: private, no-store`.

## 10. Executor checklist

1. Baca main plan ini dan phase file aktif sepenuhnya.
2. `git status --short --branch` bersih; jalankan snapshot `scope_guard.py` phase aktif.
3. Jalankan anchor `rg` phase; bila anchor tidak cocok, stop dan laporkan.
4. Kerjakan ordered edits persis berurutan.
5. Jalankan validation commands phase; semua harus sesuai `Expected`.
6. Jalankan runtime proof bila Docker tersedia; catat status (`proven | blocked | not runtime-proven | not applicable`).
7. `scope_guard.py check` hijau; commit satu phase dengan pesan `feat(operasional): phase N — <judul>` diakhiri baris atribusi dari system reminder sesi.
8. Laporkan: file berubah, hasil tiap command, status runtime, sisa boundary.

**Executor entry prompt:**

```text
Anda executor plan docs/dashboard-operasional-e2e-plan. Kerjakan HANYA phase <N>.
Baca docs/dashboard-operasional-e2e-plan/main_plan.md lalu docs/dashboard-operasional-e2e-plan/phase_<N>.md.
Ikuti Executor checklist §10. Jangan menyentuh file di luar manifest phase <N>; jangan menjalankan pnpm dev:direct;
jangan membaca .env. Bila anchor/test/manifest tidak cocok dengan kenyataan, STOP dan laporkan tanpa improvisasi.
Akhiri dengan laporan status per validation command dan status runtime proof.
```

**Stop conditions:** anchor tidak ditemukan atau berbeda makna; test baseline gagal sebelum edit; kebutuhan file di luar manifest; kebutuhan dependency baru; kebutuhan keputusan produk/visual yang tidak tertulis; perintah berisiko tinggi di §8.

## 11. Stop-and-amend rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak. Amandemen yang disetujui pengguna wajib memperbarui `main_plan.md`, phase file terkait, dan `scope_manifest.json` dalam satu perubahan.

## 12. Status vocabulary

`proven | blocked | not runtime-proven | not applicable`
