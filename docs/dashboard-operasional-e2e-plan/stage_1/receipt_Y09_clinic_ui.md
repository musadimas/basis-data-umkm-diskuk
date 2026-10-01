# Receipt Y09 — Antrean, sesi konsultasi, FAQ dan hotline (M7-13, M7-14 + UI penerima kontrak M7-11/M7-12)

- **Tanggal:** 27 September 2026
- **Verdict:** `partial` — UI publik, panel petugas, lingkup/audit/transisi status, dan perbaikan FAQ membumi dan teruji lokal + SQL readback; **belum** `done` karena (a) bukti runtime untuk sesi petugas (scope/IDOR/audit) belum dijalankan pada API disposable dari sisi executor ini, (b) notifikasi WhatsApp belum provider-proven, (c) live `/poli` sedang 500 akibat kolom `subtopik` hilang di DB disposable (pekerjaan Y08 yang sedang berjalan), dan (d) proyek Playwright `tablet`/`mobile` tidak dapat dijalankan di mesin ini (`webkit` belum terpasang).
- **Scope:** fase Y09; manifest Y09 diamandemen (alasan di bagian Amandemen).

## Baseline yang Dipertahankan

- `git status --short --branch`: branch `main` pasca-merge `790559b`. Tidak ada `reset --hard`, `clean`, `stash`, `add -A`, atau push.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present; two green repairs in Y05.` (exit 0).
- **Pekerjaan paralel Y04–Y08 pengguna dipertahankan apa adanya.** Banyak berkas di luar Y09 berubah di worktree selama sesi ini (katalog, passport, kegiatan, klinik backend Y08). Receipt ini tidak mengklaim pekerjaan itu.
- Snapshot scope: **tidak sempat diambil sebelum edit** (kelalaian executor ini). Guard dijalankan memakai snapshot pra-sesi `/tmp/operasional-phase-Y05-before.json` (21:41 WIB, sebelum edit Y09 dimulai) dan hasil mentahnya memuat 81 path di luar Y09 yang seluruhnya milik pekerjaan paralel Y04–Y08/dokumen mereka. Setelah amandemen manifest, **tidak ada satu pun path Y09 yang jatuh di `outside`**:

```text
$ python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
    --snapshot /tmp/operasional-phase-Y05-before.json \
    --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase Y09
changed total: 99 ; outside total: 81 (semua Y04–Y08/dokumen, bukan Y09)
Y09 paths outside manifest: tidak ada
```

## Amandemen manifest Y09 (alasan langsung)

Entri lama menunjuk berkas yang tidak pernah ada pasca-merge; semuanya diganti dengan path nyata:

1. `apps/web/app/components/klinik/{FormKonsultasi,KanbanTiket}.vue`, `dashboard/klinik/index.vue`, `dashboard/klinik/[id].vue`, `apps/web/server/api/publik/faq.get.ts`, `directus-extension-operasional/src/{index,klinik-service}.js` → **dihapus**: form empat langkah hidup di `pages/(public)/konsultasi.vue`, panel di `pages/(private)/dashboard/klinik.vue`, dan FAQ publik dibaca lewat policy Public Directus (ADR-006) tanpa BFF.
2. `apps/web/app/constants/NAVIGATION.ts` dan `apps/web/tests/fixtures/mock-directus.mjs` → **dihapus**: tidak tersentuh fase ini; menu klinik sudah benar dari Y01.
3. **Ditambahkan** path yang benar-benar dipakai: dua komponen `klinik/`, `types/program.ts`, `tests/fixtures/klinik-data.mjs`, `katalog-data.mjs`, `mock-directus-server.mjs`, `mock-program.mjs`, `tests/e2e/klinik.spec.ts`, `klinik-penugasan.test.js`, `endpoints/klinik/penugasan.js`, `endpoints/klinik/service.js`, `migrations/20260927B-klinik-audit-dan-faq.js`, receipt ini, dan manifest itu sendiri.

## Implementasi

### 1. Landing klinik, enam poli, form empat langkah, nomor tiket yang dapat dibaca ulang

- `KlinikPengantarKlinik.vue` merender enam poli dari `GET /v1/program/klinik/poli` (nama, deskripsi, subtopik yang dapat diedit admin), alur empat langkah, dan tombol WhatsApp narahubung dari singleton `kontak_hotline`. Landing hanya tampil sebelum langkah 1, jadi form tetap fokus.
- `KlinikLacakTiket.vue` memakai `POST /v1/program/klinik/tiket/lacak` (nomor tiket **dan** nomor WhatsApp, captcha): status, poli, jadwal, dan label notifikasi. Ini jalur baca-ulang resmi Y08; tidak ada endpoint oracle baru yang dibuat fase ini.
- `konsultasi.vue`: tab "Ajukan konsultasi"/"Lacak tiket", tombol salin nomor tiket, dan banner notifikasi yang **hanya** menyebut status outbox yang dikirim server (`tiket.notifikasi.label`), bukan klaim "terkirim".
- Tautan rusak `/sign-uo` sudah hilang di source pasca-merge; `/konsultasi` kini menautkan `/sign-in` yang benar.

### 2. Panel pendamping/dinas (M7-13)

- Kanban + daftar, lima tahap, penugasan, tautan rapat https, diagnosis per aspek, rencana aksi, dan rujukan (sarpras, vokasi, mediasi Kementerian/SAPA UMKM, Talent Lab) — dipertahankan dari Y08 dan dilengkapi:
  - **Filter "Aduan PMSE mendesak"** + badge di kartu/daftar. Flag dihitung server: `poli.kode = 'advokasi' AND prioritas = 'mendesak'`.
  - **Jejak audit** per tiket (aktor + waktu + kolom yang ditulis, status dari → ke).
  - **Hanya tahap berikutnya** yang bisa dipilih; opsi `batal` tetap tersedia.
  - **Konflik**: panel mengirim `versi` (timestamp mikrodetik dari server) dan menampilkan pesan jujur saat tiket sudah diubah petugas lain (`TIKET_BERUBAH`).
  - Catatan tegas bahwa menutup tiket **tidak** mengubah profil UMKM sampai N7-05 (R04).
- Akun UMKM tidak lagi menabrak API staff-only: halaman menampilkan form lacak tiket, bukan kanban.

### 3. Lingkup petugas, transisi, audit, dan anti-overwrite (backend)

Modul baru `endpoints/klinik/penugasan.js` + penyambungan kecil di `service.js`:

| Peran | Melihat | Mengubah |
| --- | --- | --- |
| provinsi / admin Directus | semua tiket | semua tiket |
| kab/kota | tiket yang usahanya terdaftar di `kota_scope` | sama; tanpa `kota_scope` → 403 `KOTA_NOT_ASSIGNED` |
| pendamping | tiket yang ditugaskan **plus** kolam belum ditugaskan | hanya tiketnya sendiri; tiket kolam hanya boleh diklaim (`pendamping = dirinya`) |
| umkm | 403 (memakai jalur lacak publik) | 403 |

- Transisi dibatasi peta tahap (`masuk → dijadwalkan → berjalan → tindak_lanjut → selesai`, `batal` dari tahap mana pun, `batal → dijadwalkan` untuk membuka ulang) → 409 `TRANSISI_TIDAK_VALID` sebelum ada tulisan.
- Versi baris (`to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`) dibandingkan di dalam transaksi ber-`FOR UPDATE OF t` → 409 `TIKET_BERUBAH`.
- `konsultasi_tiket_audit` (append-only) mencatat satu baris per jenis perubahan (`transisi`/`penugasan`/`catatan`); status yang sama tidak dicatat sebagai transisi. Dibaca lewat DTO tiket, tanpa grant API langsung.

### 4. FAQ program dan hotline (M7-14)

- Halaman baru `/faq` (target tombol "Selengkapnya" di landing dan footer): FAQ dari koleksi `faq` (hanya status `terbit`), dikelompokkan per kategori, dengan tanggal "Diperbarui" sebagai penanda kesegaran; kartu narahubung dari `kontak_hotline`.
- **Konten basi dibuang di sumbernya**: migrasi `20260927B` menulis ulang jawaban yang menyebut jadwal 2025 (idempoten: hanya cocok bila teks lama masih terpasang) dan menambahkan `date_updated` ke allowlist field publik `faq`.
- `LandingFaq.vue` (fallback bila Directus tidak tersedia) memakai teks tanpa tahun basi.
- Keadaan jujur: FAQ tak tersedia → pesan eksplisit; nomor WhatsApp belum dikonfigurasi → tombol tidak muncul dan alasannya dinyatakan.

## Bukti Eksekusi

| Perintah / Pengujian | Ruang lingkup | Hasil |
| --- | --- | --- |
| `node --test test/*.test.js` (extensions/program) | seluruh unit/contract extension termasuk `klinik-penugasan.test.js` baru | **127/127 pass** (exit 0) |
| `pnpm typecheck` (apps/web) | tipe Vue/TS | **0 error** (exit 0) |
| `pnpm test:unit` (apps/web) | vitest | **57/57 pass** (exit 0) |
| `pnpm test:e2e --project=chromium tests/e2e/klinik-ui.spec.ts tests/e2e/klinik.spec.ts tests/e2e/portal.spec.ts` | klinik UI baru (5), klinik Y08 yang diselaraskan (2), FAQ/hotline portal (3) | **10/10 pass** (exit 0) |
| `pnpm test:e2e --project=chromium` (seluruh suite) | regresi luas | **80 pass / 8 fail / 13 skipped**; 8 kegagalan ada di `akun.spec.ts` (Y01) dan `passport`/`produk-passport` (Y04/Y06 yang sedang dikerjakan) — tidak ada berkas Y09 yang terlibat |
| `psql` readback pada stack `diskuk-operasional-e2e` | migrasi `20260927B` | tabel `konsultasi_tiket_audit` + indeks, 1 collection, 9 field, 2 relasi, `faq` **tanpa** baris memuat "2025" (6/6), allowlist `faq` kini `…,date_updated` |
| `curl` API publik disposable | `GET /v1/program/klinik/poli` | **200** — enam poli persis brief + subtopik "Advokasi & Mediasi PMSE" |
| `curl` API disposable | `GET /v1/program/klinik/tiket`, `PATCH /v1/program/klinik/tiket/:id` tanpa sesi | **401** `AUTHENTICATION_REQUIRED` (IDOR dasar) |
| `curl` policy publik | `GET /items/faq?fields=…,date_updated`; `GET /items/kontak_hotline` | **200**; 6 item, tidak ada "2025", `date_updated` tersedia; hotline `whatsapp = null` (kasus "nomor belum dikonfigurasi") |
| Browser real API (`nuxt dev` + `PANEL_URL=http://127.0.0.1:8055`) | `/faq` tanpa login | 6 pertanyaan kurasi tampil, **tanpa** "2025", pesan jujur "Nomor WhatsApp narahubung belum dikonfigurasi" — screenshot `/tmp/y09-faq-desktop.png` |
| Browser mock (Playwright) | `/konsultasi` desktop + 390×844 | enam kartu poli, form dalam viewport — `/tmp/y09-konsultasi-desktop.png`, `/tmp/y09-konsultasi-mobile.png`, `/tmp/y09-viewport-konsultasi.png` |
| Browser mock (Playwright, login provinsi) | `/dashboard/klinik` kanban + detail dengan jejak audit | badge "PMSE mendesak", kartu di kolom Tiket Masuk, panel detail dengan tahap berikutnya + riwayat — `/tmp/y09-panel-kanban.png`, `/tmp/y09-panel-detail.png` |

## Yang Belum Terbukti (jujur)

1. **Runtime sesi petugas** (provinsi/kabkota/pendamping): scope kanban, `403 BUKAN_PENUGASAN_ANDA`, `409 TRANSISI_TIDAK_VALID`, `409 TIKET_BERUBAH`, dan readback audit **hanya** terbukti lewat unit/contract test + fake DB, bukan sesi nyata. Executor ini tidak memegang kredensial akun dummy pada stack disposable (sesuai aturan plan: jangan membaca `.env`/token). Jalankan ini sebelum verdict `done`.
2. **Notifikasi WhatsApp: `not provider-proven`.** Outbox Y08 ada, gateway belum dikonfigurasi, jadi label UI hanya "Menunggu dikirim"/"Tidak dikirim". Tidak ada klaim terkirim.
3. **Live `/poli` sedang 500** di stack disposable: kolom `konsultasi_poli.subtopik` tidak ada di DB (pekerjaan Y08 yang sedang berjalan) sementara endpoint memilihnya. UI Y09 tahan terhadap `subtopik` hilang, tetapi bukti browser enam poli akhirnya memakai mock; probe API 200 di atas terjadi sebelum kolom itu hilang.
4. **Proyek `tablet` dan `mobile` (webkit)** tidak bisa dijalankan: `Executable doesn't exist … webkit-2336`. Uji 390 px dijalankan pada chromium.
5. **`pnpm lint` (apps/web) merah** karena 2 error di `apps/web/app/pages/(public)/kegiatan.vue` (Y07, sedang dikerjakan), bukan berkas Y09.
6. **Overflow 585 px pada header landing** di viewport 390 px (`LandingHeaderMask`, semua halaman publik) — kondisi pra-ada, bukan Y09; uji mobile Y09 sengaja mengukur section miliknya sendiri dan tidak menutupi temuan ini.

## Langkah Selanjutnya

1. Jalankan bukti runtime sesi petugas (butir 1) di stack disposable, lalu ubah verdict menjadi `done` bila semua lolos.
2. Setelah Y08 menutup `/poli` (kolom `subtopik`) dan gateway WhatsApp, ulangi bukti browser enam poli dan tandai receipt notifikasi.
3. Fase ini tidak memblokir Y10 selama verdict tetap `partial`; Y10 tetap menuntut receipt `done` untuk setiap Y.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

- **B16** (sesi 28 Sep malam) — kabkota kini dapat membuka `/dashboard/klinik` (`ROLE_ROUTES.kabkota` + item menu "Klinik Konsultasi"), selaras dengan server (`isStaff`/`cakupanPetugas`) dan halaman yang sudah menganggap kabkota petugas; tes `hasRouteAccess("kabkota","/dashboard/klinik")` + tes "menu ⊆ rute" semua peran; commit `8a9f8ac`. Verdict `partial` tidak berubah.
- **B34** (sesi 28 Sep malam) — `KANBAN_KOLOM` (5) dipisah dari `KLINIK_STATUS` (6, "Dibatalkan"); `labelStatusKlinik` menampilkan kode asing apa adanya; toggle "Tampilkan dibatalkan" memanggil `?status=batal` (didukung server) dan tiket batal bisa dijadwalkan ulang; mock menyaring batal seperti server; commit `fd995a6`. E2e toggle hijau 6/6 `klinik-ui.spec.ts`.
- **B35** (sesi 28 Sep malam, bagian klinik) — peta error dilengkapi (konsultasi +3, panel +2); `NOMOR_TIDAK_VALID` dihapus (server tak pernah mengirimnya) diganti cek regex format di klien; tes penjaga drift kunci-peta × korpus server; commit `4492b3f`. Verdict `partial` tidak berubah.

---

## Addendum 29 Sep 2026 — bukti runtime sesi petugas (isolasi klon `y49`)

**Verdict: butir (a) "runtime sesi petugas" kini `runtime-proven` (API 98/98 probe, browser 4/4). WhatsApp tetap `not provider-proven` (keputusan pengguna: WA bukan syarat gate; tidak ada provider yang dikejar).** Tidak ditemukan bug baru pada kode Y09; tidak ada perubahan kode. Butir (c) `/poli` 500 tidak muncul lagi (enam poli 200 pada klon dengan migrasi terkini) dan butir (d) webkit tetap tidak diuji.

**Isolasi.** Sama dengan addendum Y04: DB `y49_clone`, container `y49-directus` :8255 (extension + migrasi terkini, captcha login off hanya di klon, storage lokal), web `nuxt dev` :3255 dari salinan scratch. Data klon-only: user `y49_kab_sumedang` (kota 2), `y49_pendamping2`, `y49_umkm2` (Sumedang), `y49_umkm6`; semua tiket uji dibuat lewat endpoint publik dengan ALTCHA nyata (diselesaikan dengan pustaka `altcha`). Semua dibersihkan; DB `diskuk` tetap 12 tiket, migrasi maks `20260927B`. Bukti mentah di `stage_1/artifacts/Y04-Y09/` (`y09.mjs`, `y09-run.log`, `y09-results.json`, `y49.real.spec.ts`, `browser-run.log`, `y09-browser-*.png`).

### API (HTTP nyata + readback SQL)

| Probe | Hasil |
| --- | --- |
| Kanban per peran dibandingkan dengan SQL | provinsi = semua tiket non-batal (20/20); kabkota Subang = 8 = tiket usaha kota 1, tidak melihat tiket Sumedang maupun tiket manual (tanpa kota); kabkota Sumedang = 2 = kota 2; pendamping = miliknya + kolam belum ditugaskan; umkm 403, anonim 401; `?status=bogus` 400; kabkota tanpa `kota_scope` 403 `KOTA_NOT_ASSIGNED` |
| Penugasan / IDOR tulis | kabkota Subang menugaskan tiket Sumedang 403; menugaskan tiket manual 403; kabkota Sumedang ke tiket Subang 403; umkm PATCH tiketnya sendiri 403; anonim 401; id tak dikenal 404; id rusak 400; tanpa `versi` 400; `versi` rusak 400; pendamping menulis non-klaim di kolam 403; menugaskan rekan 403; klaim diri sendiri 200; pendamping2 mengedit tiket pendamping 403 dan tidak melihatnya di kanban; tidak ada tulisan/audit dari panggilan yang ditolak |
| Transisi | `masuk→berjalan` dan `masuk→selesai` 409 `TRANSISI_TIDAK_VALID`; `selesai→dijadwalkan` dan `selesai→batal` 409; jalur sah sampai `selesai` 200; `dijadwalkan→batal→dijadwalkan` (buka ulang) 200; batal tersembunyi di kanban default dan muncul di `?status=batal`; tautan rapat `http://` 400 |
| Konflik versi | `versi` basi → 409 `TIKET_BERUBAH`, status tidak berubah di SQL; dua petugas dengan `versi` sama serentak → 200 + 409; menulis status yang sama = bukan transisi |
| Audit (SQL `konsultasi_tiket_audit`) | tiket uji: baris `penugasan`, 4 baris `transisi` berurutan (`masuk>dijadwalkan>berjalan>tindak_lanjut>selesai`), baris `catatan`, semua dengan `aktor` dan `aktor_nama`; panggilan basi/ditolak/no-op tidak tercatat; jumlah `riwayat` di DTO kanban = jumlah baris audit; `pmseMendesak` true hanya untuk poli advokasi + prioritas mendesak |
| Lampiran | pemilik 200, kabkota kota sama 200, provinsi 200; kabkota kota lain 404, umkm lain 404 (juga umkm satu kota), anonim 401; `/assets/<file>` anonim dan umkm lain bukan 200 |
| PII endpoint publik / pelacakan | respons lacak hanya `nomor,namaUsaha,poli,status,moda,tanggal,slot,sumberIdentitas,notifikasi` (tanpa WA, e-mail, deskripsi, kontak, pendamping, diagnosis, link rapat); WA salah dan nomor tak dikenal → 404 dengan body identik; captcha buruk 400; normalisasi WA ("0811-…") diterima; `/slot` hanya `slot,tersedia`; `/items/konsultasi_tiket`, `_audit`, `_lampiran`, `notifikasi_outbox`, `klinik_notifikasi`, `directus_users` tidak memberi baris ke anonim maupun umkm (403) |
| Pembuatan tiket | captcha sekali pakai (replay 400 `CAPTCHA_INVALID`), balapan slot sama → 201 + 409 `SLOT_PENUH` (SQL 1 aktif), tanggal lampau/akhir pekan/deskripsi pendek 400, `usaha` di body anonim diabaikan (tetap `manual`, tanpa `usaha`) |
| WhatsApp/outbox | baris outbox `pending` (`tiket_dibuat`, `status_berubah`), label UI "Menunggu gateway"/"Menunggu dikirim"; 0 pesan berstatus `terkirim`/`diterima` — **not provider-proven**, tidak ada klaim terkirim |

### Browser (Playwright chromium, real API klon, 4/4 pass)

| Langkah | Bukti |
| --- | --- |
| Pengunjung publik: landing 6 kartu poli, form empat langkah dengan ALTCHA nyata, nomor tiket `KLN-…` | SQL `manual|masuk`; label notifikasi "Menunggu gateway" |
| Lacak dengan nomor + WA benar → hasil "Tiket Masuk", tanpa WA/nama kontak/deskripsi di DOM; WA salah → alert "tidak cocok", tanpa hasil | screenshot `y09-browser-4-track-result.png` |
| Kanban kabkota Subang vs kabkota Sumedang (login sungguhan) | masing-masing hanya nomor tiket kotanya; tiket manual tidak tampil; item menu "Klinik Konsultasi" ada (B16) |
| Akun umkm buka `/dashboard/klinik` | form "Lacak tiket konsultasi", tanpa kolom kanban |
| Provinsi klaim tiket → Simpan rencana aksi → sesi kedua menyimpan dengan versi lama | pesan "sudah diubah petugas lain"; SQL `catatan` tidak tertimpa; riwayat audit tampil di panel (2 baris audit di SQL) |

### Catatan dan belum terbukti

- Temuan desain (bukan bug, tidak diubah): pendamping melihat SELURUH kolom belum-ditugaskan lintas kota, termasuk WA/e-mail pemohon; kab/kota tidak pernah melihat tiket manual (tanpa usaha) sehingga tiket itu hanya dapat ditangani provinsi/pendamping. Konfirmasi produk diperlukan bila kolam lintas kota dianggap terlalu luas.
- Pengiriman WhatsApp/e-mail klinik: **not provider-proven** (sengaja).
- Proyek Playwright `tablet`/`mobile` (webkit) tidak dijalankan; overflow header landing 390 px (pra-ada) tidak disentuh.
- Uji browser berjalan pada `nuxt dev` dari sumber terkini, bukan image web bersama.
- Uji balapan kanban memakai dua sesi provinsi dengan akun yang sama; tidak diuji dua akun berbeda di browser (API menguji dua aktor berbeda).
- Ringkasan test lokal: program 162/162; `services/directus/test` 51 pass, 3 skip, 0 fail.
