# Receipt Y08 — Kontrak data dan API klinik konsultasi (M7-11, M7-12)

- **Tanggal:** 27 September 2026
- **Verdict:** `done` untuk kontrak data/API M7-11 dan M7-12 pada stack disposable
  `diskuk-operasional-e2e`, dengan **satu gate must-have tetap terbuka: `not provider-proven`**
  (tidak ada sandbox provider WhatsApp; mekanika outbox dibuktikan dengan gateway tiruan lokal).
- **Scope:** phase Y08 (`scope_manifest.json` sudah direkonsiliasi: 18 entri kanonik pasca-merge).
  Statistik klinik N7-04/N7-05 tetap R04; pengalaman penuh klinik (M7-13/M7-14 dan form 4 langkah)
  tetap Y09.
- **Bukti ringkas:** unit test extension program 127/127, contract test Directus 21/21, typecheck web
  exit 0, vitest web 57/57, browser mock klinik 2/2, bukti runtime API 13/13 (tanpa gateway) dan
  16/16 (dengan gateway tiruan), readback SQL tiket/slot/outbox, siklus rollback→up migrasi.

## Baseline dan rekonsiliasi

- Baseline: `main` pasca-merge `790559b`, 31 commit di depan `origin/main`; worktree sudah berisi
  pekerjaan pengguna untuk fase lain (Y06/Y07/Y09) dan **dua sesi berjalan bersamaan pada file yang
  sama** (lihat bagian “Tabrakan sesi paralel”).
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → exit 0
  (`OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present`).
- Snapshot scope sebelum edit: `python3 …/scope_guard.py snapshot --output /tmp/operasional-Y08-scope.json`.
- Manifest Y08 direkonsiliasi dari entri pra-merge (path BFF Nuxt `apps/web/server/api/klinik/*`,
  extension `directus-extension-operasional` yang sudah tidak ada, migrasi `20260926L-create-klinik`
  yang bentrok dengan kode hasil merge) menjadi 18 entri kanonik; migrasi baru diberi nama
  `20260926S-klinik-poli-notifikasi.js` setelah memeriksa `directus_migrations` disposable
  (`L`–`R` sudah terpakai).

## Implementasi

### 1. M7-11 — katalog enam poli (migrasi `20260926S`)

- `konsultasi_poli.subtopik` (JSONB) ditambahkan; enam poli di-*upsert* persis sesuai
  `requirements.md` beserta subtopiknya, dan tiga poli placeholder dari `20260926N`
  (produksi, sdm, ekspor) dihapus atau dinonaktifkan bila masih direferensikan tiket
  (`konsultasi_tiket.poli` adalah FK `RESTRICT`).
- `GET /v1/program/klinik/poli` (publik, `Cache-Control: private, no-store`) hanya mengeluarkan
  `id, kode, nama, deskripsi, subtopik`; tidak ada field PII. Policy publik `konsultasi_poli`
  diperluas dengan `subtopik` (masih allowlist konten).
- Halaman `/konsultasi` memakai endpoint ini, bukan `readItems` langsung, dan menampilkan subtopik
  sebagai chip di bawah nama poli.

### 2. M7-12 langkah 1 — identitas aman, tanpa oracle NIB/NIK

- `POST /lookup` **dihapus**; tidak ada lagi jalur publik yang bisa dipakai menguji keberadaan
  NIK/NIB (`GET /v1/program/klinik/lookup` → 404 pada runtime).
- `GET /v1/program/klinik/prefill` (sesi) mengembalikan usaha milik akun sendiri
  (`nama, skala, kota, kbli, sumber: "sidt"`) plus kontak (`nama`, `email`, nomor WhatsApp bisnis
  bila ada). Anonim → 401; akun tanpa baris `directus_users` → anonim (bukan otomatis “staff”).
- Formulir anonim mengisi nama usaha sendiri dan tiket tersimpan
  `sumber_identitas = 'manual'` (belum terverifikasi) + `pemohon = null`; tiket dari sesi pemilik
  tersimpan `sumber_identitas = 'sidt'` + `pemohon = <akun>`. Nama usaha SIDT tidak dapat ditimpa
  payload.
- NIK tidak pernah dibaca formulir publik: unit test memeriksa tidak ada query `/prefill` yang
  menyebut kolom NIK, dan readback SQL memastikan tidak ada kolom tiket berisi 16 digit.

### 3. M7-12 langkah 2–4 — tiket, slot atomik, lampiran privat

- `POST /v1/program/klinik/tiket` (publik, ALTCHA, multipart) membuat tiket dalam satu transaksi:
  nomor `KLN-YYYY-MM-NNNN` dari sequence, kuota slot dari unique index parsial
  `ux_konsultasi_tiket_slot (poli, jadwal_tanggal, jadwal_slot) WHERE status <> 'batal'`,
  lampiran, dan baris outbox. Pelanggaran kuota → 409 `SLOT_PENUH`; batas waktu pemesanan:
  Senin–Jumat, besok s/d 30 hari (`Asia/Jakarta`).
- Lampiran: sniff tipe dari byte pertama (PDF/JPEG/PNG/WebP), maksimal 3 berkas × 5 MB, disimpan di
  folder privat “Lampiran Klinik”. Karena tidak ada pemindai anti-malware di infrastruktur ini,
  klaim yang dicatat adalah “tipe/konten dibatasi + folder privat”, bukan “bebas malware”.
- `GET /v1/program/klinik/lampiran/:fileId` adalah satu-satunya pintu baca lampiran: pemohon pada
  tiket itu atau petugas klinik; pihak lain 404 (bukan 403) supaya keberadaan berkas tidak bocor.
  Semua policy Directus hanya memberi `directus_files` publik pada folder produk, jadi lampiran
  klinik tidak dapat dibaca lewat `/assets/:id`.
- `POST /v1/program/klinik/tiket/lacak` (publik, ALTCHA) = baca ulang pemohon: nomor tiket **dan**
  nomor WhatsApp pemesan harus cocok; salah satu tidak cocok → 404 `TIKET_TIDAK_DITEMUKAN`.
- Kanban petugas (`GET/PATCH /tiket`) tetap sesi + aplikasi role; UMKM ditolak 403. Scoping petugas
  yang lebih halus (kab/kota, pendamping, transisi status, audit) dikerjakan Y09 dan sudah ikut
  teruji pada bukti runtime ini (`ambil` tiket sebelum pindah status).

### 4. M7-12 langkah 4 — outbox WhatsApp idempotent

- Tabel `klinik_notifikasi`: satu baris per pesan dengan `idempotency_key` unik
  (per tiket + jenis [+ status tujuan]), `consent`, `tujuan`, `tujuan_terverifikasi`, `template`,
  `payload`, `attempts`, `max_attempts`, `last_error`, `provider`, `provider_message_id`,
  `provider_status`, `provider_receipt`, `terkirim_at`, `diterima_at`.
- Pesan diantre di transaksi yang sama dengan tiket/status; pengulangan transisi status yang sama
  tidak menambah baris (dibuktikan: dua PATCH `dijadwalkan` → tetap dua baris per tiket).
- Publisher (`startDispatcher`) hanya hidup bila `WHATSAPP_GATEWAY_URL` diisi. Adapter
  (`src/lib/whatsapp.js`) mengirim JSON ke gateway HTTP dengan bearer token, timeout, dan
  menerjemahkan jawaban provider: 2xx → `terkirim`; `diterima` **hanya** dari callback resi
  `POST /v1/program/klinik/notifikasi/receipt` (header `x-diskuk-secret`, dibandingkan
  constant-time) atau dari jawaban provider yang sudah menyatakan `delivered` bila
  `WHATSAPP_REQUIRE_CALLBACK=false`.
- Kegagalan: kembali ke `pending` dengan backoff 1 mnt → 5 mnt → 15 mnt → 60 mnt → 6 jam, lalu
  `gagal` setelah `max_attempts`; `last_error` menyimpan kode aman (`http_503`, `network_error`,
  `timeout`), bukan payload pengguna.

## Acceptance per ID

| ID | Bukti runtime (stack disposable) |
| --- | --- |
| M7-11 | `GET /v1/program/klinik/poli` tanpa login → 200, 6 poli, nama persis sesuai `requirements.md`, subtopik lengkap, tidak ada `nik/whatsapp/email` di respons. |
| M7-12 | prefill sesi UMKM → `sumber: "sidt"`, kontak akun; tiket sesi pemilik → 201 `sumberIdentitas: sidt`; nama usaha SIDT tidak dapat ditimpa payload → 201; tiket anonim → 201 `sumberIdentitas: manual`; dua pemesan slot sama → `[201, 409]` dengan tepat satu baris tiket; baca ulang nomor+WA benar → 200, WA salah → 404; lampiran: 401 tanpa sesi, 200 pemohon, 404 usaha lain; kanban pendamping/kabkota 200, UMKM 403; perubahan status → pesan `status_berubah` masuk antrean; outbox tanpa gateway tetap `pending` (label jujur), dengan gateway `terkirim` → resi → `diterima`. |

## Bukti eksekusi

| Perintah | Hasil |
| --- | --- |
| `node --test services/directus/extensions/program/test/*.test.js` | **127 pass / 0 fail** (termasuk `klinik.test.js` dan `whatsapp.test.js` baru) |
| `node --test services/directus/test/*.test.mjs` | **21 pass / 0 fail** |
| `cd apps/web && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | exit 0 |
| `cd apps/web && npx vitest run` | **57 pass / 0 fail** (7 berkas) |
| `pnpm --filter ./apps/web exec playwright test tests/e2e/klinik.spec.ts --project=chromium` | **2 passed** (mock browser, kontrak baru: form 4 langkah + kanban) |
| `node scripts/verify-y08-klinik.mjs` (Directus disposable, tanpa gateway) | **13/13 PASS** |
| `node scripts/verify-y08-klinik.mjs --gateway` (gateway tiruan lokal di `127.0.0.1:9123`) | **16/16 PASS** |
| `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | exit 0 |
| `python3 …/scope_guard.py check --snapshot /tmp/operasional-Y08-scope.json --manifest … --phase Y08` | semua berkas Y08 ada di manifest; daftar `outside` hanya berkas sesi paralel (Y06/Y07/Y09) — lihat catatan di bawah |

Readback SQL tiket/slot/outbox (disposable):

```
 poli |   kode    |  tanggal   | jadwal_slot | tiket      -- kuota: satu tiket per slot
    1 | legalitas | 2026-09-29 | 09:00       |     1
   10 | advokasi  | 2026-09-29 | 14:30       |     1

      nomor       |   status    | sumber_identitas |     jenis      | status_pesan | tujuan_terverifikasi | consent
 KLN-2026-09-0009 | dijadwalkan | sidt             | tiket_dibuat   | pending      | f                    | t
 KLN-2026-09-0009 | dijadwalkan | sidt             | status_berubah | pending      | t                    | t
 KLN-2026-09-0011 | masuk       | manual           | tiket_dibuat   | pending      | f                    | t
```

Readback dengan gateway tiruan (setelah publisher berjalan):

```
      nomor       |     jenis      |  status  | provider   | provider_message_id | provider_status | attempts | diterima_at
 KLN-2026-09-0019 | tiket_dibuat   | terkirim | stub-lokal | stub-1              | accepted        |        1 | f
 KLN-2026-09-0019 | status_berubah | diterima | stub-lokal | stub-5              | delivered       |        1 | t
```

Siklus migrasi (disposable): `down` dijalankan manual di DB → tabel `klinik_notifikasi`, kolom
`pemohon/sumber_identitas/wa_consent`, kolom `subtopik`, metadata field, dan allowlist policy
`konsultasi_poli` kembali ke nilai sebelumnya; baris `directus_migrations(20260926S)` dihapus lalu
Directus dijalankan ulang → runner menerapkan `up` lagi dan seluruh schema/metadata kembali. Efek
samping yang wajar: kolom baru pada tiket lama kembali ke default (`manual`, `false`, `pemohon
null`) karena kolomnya sempat di-drop.

## Yang belum terbukti (jangan dinaikkan menjadi klaim penuh)

1. **`not provider-proven`** — tidak ada sandbox provider WhatsApp. Yang dibuktikan hanyalah
   mekanika outbox + adapter HTTP terhadap gateway tiruan lokal (`stub-lokal`): 2xx → `terkirim`
   (bukan `diterima`), resi ber-rahasia → `diterima`, resi tanpa rahasia → 401, kegagalan provider
   → backoff/`gagal`. Nama provider, kredensial, template resmi, dan nomor pengirim masih kosong di
   `.env.example`.
2. **Anti-malware** — tidak ada pemindai di infrastruktur; hanya validasi tipe/konten dan ukuran.
3. **Kuota slot per poli** saat ini 1 tiket per (poli, tanggal, slot). Bila dinas membutuhkan kuota
   lebih besar, tambahkan kolom kapasitas + hitung pemakaian dalam transaksi yang sama.
4. **UI penuh M7-11…M7-14** (landing, kanban lengkap, FAQ/hotline, transisi status + audit) adalah
   Y09; Y08 hanya menyambungkan kontrak agar aplikasi tidak putus.
5. Rate limiting khusus endpoint publik klinik belum ada; perlindungan saat ini adalah ALTCHA,
   pembatasan ukuran/tipe berkas, dan jawaban generik 404.

## Tabrakan sesi paralel (bukan bagian Y08, tetapi memblokir runtime)

Sesi lain di worktree yang sama sedang mengerjakan Y07/Y09 dan menyentuh berkas bersama. Tiga
temuan yang sudah ditangani di samping pekerjaan Y08:

1. `services/directus/migrations/20260927B-klinik-audit-dan-faq.js` (milik sesi lain) membuat
   Directus **crash-loop**: pada `INSERT INTO directus_relations` nilai `'cascade'`/`'nullify'`
   masuk ke kolom `one_collection_field`, sedangkan `one_deselect_action` (NOT NULL) tetap NULL.
   Penyebabnya urutan nilai `SELECT relasi.*, NULL, NULL, NULL, NULL` tidak sejajar dengan daftar
   kolom INSERT. Bug ini **tidak saya perbaiki** (milik sesi tersebut); pesan lengkapnya sudah
   dilaporkan ke pengguna.
2. Berkas yang sama sempat bermode `600` sehingga tidak terbaca user container; saya ubah ke `644`
   (hanya izin, bukan isi).
3. Untuk menjalankan bukti Y08, Directus dijalankan sementara dengan override lokal
   `/tmp/operasional-e2e-y08.override.yml` yang mem-*bind* salinan `migrations/` tanpa berkas
   bermasalah di atas, dan tabel `konsultasi_tiket_audit` dibuat manual dari DDL file tersebut agar
   kode sesi paralel (yang sudah memakai tabel itu di `TIKET_SELECT`) bisa berjalan. Override ini
   hanya berkas lokal di `/tmp` dan **harus dilepas setelah migrasi `20260927B` diperbaiki**.

Berkas yang saya ubah semuanya ada di manifest Y08; entri `outside` pada `scope_guard` adalah
berkas sesi paralel (`kegiatan/*`, `klinik/penugasan.js`, `klinik-ui.spec.ts`, `migration 20260927A/B`,
`oas.yaml`, dll) dan bukan bagian phase ini.

## Cleanup untuk Y10

Baris bukti Y08 dapat dikenali dari nomor fixture `08120000…` dan lampiran `bukti-y08.pdf`:

```sql
DELETE FROM konsultasi_tiket WHERE whatsapp LIKE '628120000%';            -- cascade lampiran + outbox
DELETE FROM directus_files WHERE filename_download = 'bukti-y08.pdf';
```

## Saran untuk phase berikutnya

- **Y09** dapat langsung memakai kontrak ini; label notifikasi yang jujur sudah tersedia di DTO tiket
  (`notifikasi.status` + `notifikasi.label`, `waConsent`, `sumberIdentitas`). Perbaiki
  `20260927B` lebih dulu (urutkan nilai pada INSERT `directus_relations`).
- **Y10** perlu mengulang bukti runtime dengan `WHATSAPP_GATEWAY_URL` benar-benar kosong
  (laporan `not provider-proven`) dan memastikan override `/tmp/operasional-e2e-y08.override.yml`
  sudah dilepas.
- **R04** (N7-04/N7-05) mewarisi outbox ini: statistik klinik dan integrasi profil cukup membaca
  `konsultasi_tiket`/`klinik_notifikasi`, tanpa mengubah kontrak tiket.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

- **B01** — staf klinik (termasuk pendamping) bisa men-stream file apa pun di `directus_files`. Kini hanya lampiran tiket yang lolos `cakupanPetugas(actor)` yang boleh dibaca; file lain → 404. Commit checkpoint `af1932c`.
- **B14** — pembatalan tiket memakai template "tiket diterima". Kini memakai `pesanStatusBerubah` dengan status `batal` (template `klinik_status_berubah`); commit `4b34973`.
- **B15** — kunci idempotensi `pembatalan:<tiket>` menelan transisi berulang (batal → dijadwalkan → batal). Kunci kini memuat `versi` baris setelah update; commit `4b34973`.
- **B24** — `assertVersi` lolos bila `versi` tidak dikirim, sehingga optimistic lock bisa dilewati. `versi` kini wajib pada PATCH tiket (400 `INVALID_PAYLOAD`); commit `77549c4`.
- **B31** (sesi 28 Sep malam) — pembanding timing-safe inline di `klinik/index.js` diekstrak ke `samaRahasia` di `lib/utils/http.js`; rute callback resi memakainya, beda panjang menjawab 401 bukan 500; commit `54279e0`.
- **B33** (sesi 28 Sep malam) — `normalisasiTelepon` klinik kini mendelegasikan ke satu `normalisasiTeleponSeluler` di `lib/validate.js` (semantik gabungan; pemetaan lama yang sudah tersimpan dinormalisasi ulang secara identik, jadi lacak tiket tetap cocok); commit `3ada000`.

Bukti baru berjalan di Postgres nyata (`program/test/pg/klinik-notifikasi.test.js`, `klinik-versi.test.js`). Verdict `done` tidak berubah.
