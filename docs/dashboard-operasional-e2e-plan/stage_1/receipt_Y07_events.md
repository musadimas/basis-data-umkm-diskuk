# Receipt Y07 — Agenda Kegiatan Publik dan Pengingat (M7-07…M7-10)

- **Tanggal:** 27 September 2026 (sesi Y07, dijalankan paralel dengan sesi Y04/Y06/Y08/Y09).
- **Verdict:** `partial` — keempat ID M7-07…M7-10 terbukti pada unit, kontrak DTO, API runtime, dan browser
  (desktop + viewport ponsel). Pengingat **email** punya resi provider nyata (Mailpit: message id + tautan
  batal). Pengingat **WhatsApp** sadar-diri berhenti di `menunggu_gateway` dan **`not provider-proven`**,
  karena kontrak/kredensial gateway belum ada; gate phase tidak boleh mengklaim pesan WhatsApp terkirim.
- **Scope:** fase Y07 pada `docs/dashboard-operasional-e2e-plan/scope_manifest.json` (25 entri, diamandemen sesi ini).

## Baseline yang Dipertahankan

- `git status --short --branch`: `main` pasca-merge `790559b`, ahead 31. Tidak ada `reset --hard`, `clean`,
  `stash`, `git add -A`, atau push. Perubahan sesi paralel (Y04/Y06/Y08/Y09) tidak disentuh.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → **OK** (35 M di fase Y, 14 N di fase R).
- Snapshot scope pra-edit: `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-Y07-scope.json`.
- Rekonsiliasi manifest Y07 (hanya Y07): entri lawas pra-merge (BFF `apps/web/server/api/publik/kegiatan/*`,
  `directus-extension-operasional/src/kegiatan-service.js` + `pengingat-service.js`, komponen
  `KalenderKegiatan.vue`/`LiniMasaKegiatan.vue`, `types/operasional.ts`, migrasi `20260926K-create-kegiatan`)
  diganti jalur kanonik pasca-`790559b`: `extensions/program/src/endpoints/kegiatan/*` + hook pengingat,
  migrasi `20260927A-kegiatan-agenda-publik.js`, halaman `(public)/kegiatan.vue`, dan fixture bersama
  `tests/fixtures/kegiatan-data.mjs`. Aksi tiga entri yang ternyata sudah ada sebelum fase (`app/lib/kegiatan.ts`,
  `pages/(public)/kegiatan.vue`, `tests/unit/kegiatan.test.ts`) dikembalikan ke `modify`. Akhir Y07: 25 entri;
  `scope_guard.py check --phase Y07` → 0 file Y07 di luar manifest (25/25 berubah), tidak menamai ulang
  migrasi terapan.

## Kontrak yang Dibangun

| Lapisan | Isi |
| --- | --- |
| Migrasi `20260927A-kegiatan-agenda-publik.js` | kategori brief (pelatihan/sertifikasi/pameran/akselerasi/literasi_digital + peta nilai lama), `registration_url`, `dokumen_url`, `materi_url`, `syarat_skala/syarat_wilayah/syarat_nib`, `status_publikasi='dibatalkan'`, tabel `kegiatan_pengingat` (kanal, tujuan + `tujuan_masked`, `jadwal_kirim`, status, `percobaan`, `provider_id`, `token`, unique `(kegiatan, kanal, tujuan)`), field/koleksi Data Studio. Tanpa grant baca publik untuk tabel pengingat (tujuan = data pribadi, ADR-004). |
| Endpoint publik `GET /v1/program/kegiatan` | `bulan`/`tahun` (jendela WIB), `kategori`, `penyelenggara`, `metode`, `ramah`, `status`; status temporal + `kelompok` + `meta.opsi` dihitung server; nilai filter asing ditolak 400 `INVALID_PAYLOAD` (bukan diabaikan diam-diam). Envelope mengikuti konvensi analytics (`meta` di dalam `data`) karena SDK Directus melepas `data` teratas. |
| Endpoint publik `GET /v1/program/kegiatan/:id` | Detail allowlist: silabus, narasumber, fasilitas, syarat skala/wilayah/NIB, poster, dan **hanya tautan https absolute** (`tautanAman` menolak `http:`, `javascript:`, `data:`); draft/dibatalkan/tidak ada → 404. |
| Endpoint pengingat | `POST /:id/pengingat` (ALTCHA single-use, normalisasi email/`62` mobile, jadwal absolut antara sekarang dan akhir acara, idempoten lewat unique index; WhatsApp tanpa gateway langsung berstatus `menunggu_gateway`), `POST /pengingat/batal` + halaman `GET /pengingat/:token` (konfirmasi dua langkah agar pemindai email tidak membatalkan), `POST /pengingat/proses` (internal secret). |
| Job `hooks/kegiatan-pengingat.js` | `schedule("0 * * * * *")` memanggil `prosesPengingat` yang sama dengan route internal; klaim baris lewat `UPDATE ... WHERE status IN ('menunggu','menunggu_gateway')` (dua worker/Directus tidak mengirim ganda), baris `mengirim` yang tertahan 15 menit dilepas kembali, acara yang ditarik dari publik membatalkan pengingatnya, dan menunggu gateway **tidak** dihitung sebagai percobaan kirim. |
| Adapter `adapter.js` | Email lewat `services.MailService` Directus (transport stack: Mailpit; produksi: SMTP relay) — `messageId` disimpan sebagai resi. WhatsApp lewat `src/lib/whatsapp.js` (adapter yang sama dengan klinik, Y08) sehingga kontrak gateway tidak diduplikasi. |
| Wilayah `src/lib/wilayah.js` | 27 kabupaten/kota Jawa Barat + provinsi + kementerian + mitra selalu tersedia sebagai opsi penyelenggara, ditambah nilai yang benar-benar ada di data tayang. |

## Acceptance per ID

| ID | Bukti |
| --- | --- |
| M7-07 | Kalender bulanan + lini masa membaca `/v1/program/kegiatan`; navigasi bulan, tombol **Hari ini**, penanda `Hari ini: 2026-09-27 (WIB)`, dan bulan kosong (`kalender-kosong`) diuji mock dan runtime. Bug ditemukan & diperbaiki saat proof: `monthGrid` masih 0-based sementara API/URL 1-based (kalender menampilkan bulan bergeser satu). |
| M7-08 | Filter dikirim ke server (`kategori`, `penyelenggara`, `metode`, `ramah`), jumlah hasil di header berasal dari `meta.jumlah`, dan URL dapat dibagikan. Opsi penyelenggara runtime memuat **27** `Dinas KUMKM …` (opsiTotal 31 termasuk provinsi, Kementerian/Lembaga, Mitra, dan "Mitra Kampus" dari data). Nilai asing → 400 `INVALID_PAYLOAD`. |
| M7-09 | Fokus card kalender (tap + hover) memuat judul, metode/lokasi, sisa kuota, dan batas registrasi; empat kelompok status dari `meta.kelompok`/`status` server; CTA per keadaan: berjalan → tautan streaming/presensi resmi, pendaftaran → `registration_url` resmi (mati + pesan jujur bila belum ada), segera → pengingat, selesai → materi dokumentasi (mati bila belum diunggah). Tidak ada lagi teks "Pendaftaran online segera hadir" dan tidak ada janji registrasi internal. |
| M7-10 | Dialog detail runtime menampilkan silabus, narasumber, fasilitas, syarat (skala/wilayah/NIB + catatan), dokumen pendukung, tautan pendaftaran, dan tautan daring; `javascript:`/`http:` tidak pernah dirender sebagai tautan. |

## Bukti Pengujian (perintah + hasil)

| Perintah | Hasil |
| --- | --- |
| `node --test services/directus/extensions/program/test/kegiatan.test.js` | **26/26 pass** (aturan murni, DTO, filter, opt-in, job, adapter, route) |
| `node --test services/directus/extensions/program/test/*.test.js` | **128/128 pass, 0 fail** |
| `apps/web && npx vitest run` | **57/57 pass** (7 file; `kegiatan.test.ts` 7 tes) |
| `apps/web && npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | **exit 0** |
| `npx playwright test tests/e2e/kegiatan.spec.ts tests/e2e/portal.spec.ts --project=chromium` | **10 passed, 3 skipped** (skip = blok runtime tanpa `PLAYWRIGHT_USE_REAL_API`) |
| `npx playwright test --project=chromium` (seluruh suite mock) | 80 passed, 13 skipped, **8 failed** — semuanya `akun.spec.ts`/`passport.spec.ts`/`produk-passport.spec.ts` (badge passport, input foto produk, locator `role=status` ganda). Bukan file Y07 dan tidak diperbaiki di fase ini; statusnya pekerjaan sesi paralel Y04/Y06. |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 npx playwright test tests/e2e/kegiatan.spec.ts --project=chromium -g "agenda pada stack disposable"` | **3/3 pass**: kalender/filter/detail/CTA data nyata, opt-in pengingat email + WhatsApp, dan viewport ponsel 390×844 |
| `docker compose -p diskuk-operasional-e2e build directus web && up -d` | image memuat extension + migrasi baru; `/server/health` 200 dan `GET /kegiatan` web 200 menampilkan kegiatan seed |

Proyek Playwright `tablet`/`mobile` memakai WebKit dan browser itu tidak terpasang di mesin ini
(`Executable doesn't exist … webkit-2336`), jadi bukti ponsel dijalankan sebagai emulasi sentuh Chromium
(viewport 390×844 + `hasTouch`) pada suite mock dan pada stack disposable. Ini keterbatasan environment,
bukan hasil lulus.

## Bukti Runtime Disposable (`diskuk-operasional-e2e`)

Migrasi diterapkan: `directus_migrations` memuat `20260927A` (plus `20260926S`/`20260927B` milik sesi
paralel); 6 kolom baru `kegiatan` ada; `kegiatan_pengingat` ada. Seed `scripts/seed-dummy-operasional.sql`
menambah 6 agenda (1 `dibatalkan`) dan cleanup `scripts/cleanup-dummy-operasional.sql` menghapusnya
(dry-run `BEGIN … ROLLBACK`: `DELETE 6` pengingat + `DELETE 6` kegiatan, sisa 0, data tidak hilang).

API (skrip disposable, rahasia tidak dicetak):

- List publik: 5 baris; `kelompok` = `berjalan 1, pendaftaran 2, segera 1, selesai 1`; `dibatalkan` tidak tampil;
  27 dinas; `tautanDaring`, `registration_url`, `dokumen_url`, dan `syarat {skala, wilayah, nib, catatan}` terisi.
- Filter: `kategori=pameran` → 1, `ramah=1&metode=daring` → 1, `status=segera` → 1, `kategori=rapat` → **400 `INVALID_PAYLOAD`**.
- Detail: terbit **200**, dibatalkan **404**, UUID asing **404**.
- Opt-in email: tujuan tidak valid **400 `TUJUAN_TIDAK_VALID`**; captcha salah **400 `CAPTCHA_INVALID`**;
  sukses **201** dengan `tujuanMasked = d***@contoh.invalid`; **replay captcha yang sama 400 `CAPTCHA_INVALID`**
  (single-use); opt-in ulang alamat yang sama **201** dan tetap **satu** baris.
- Kegiatan yang sudah selesai: **409 `KEGIATAN_SELESAI`**.
- Job: tanpa secret **403**; tick pertama `{diproses 1, terkirim 1}`; tick berikutnya `{diproses 0}`.
- **Resi email (Mailpit):** subjek `Pengingat kegiatan: Pelatihan Pemasaran Digital UMKM`, penerima yang diminta,
  tautan pembatalan ada, dan setelah **dua** opt-in alamat yang sama hanya ada **1** pesan di Mailpit.
- **WhatsApp (`not provider-proven`):** opt-in **201** langsung `menunggu_gateway`; job melaporkan
  `menungguGateway 1`, `terkirim 0`; baris tetap `menunggu_gateway` dengan `percobaan 0` (menunggu gateway
  bukan percobaan kirim) dan **tanpa** `provider_id`.
- Pembatalan: halaman `GET /pengingat/:token` menampilkan konfirmasi dengan tujuan tersamarkan; `?konfirmasi=1`
  membatalkan; permintaan kedua tetap halaman "Pengingat dibatalkan"; API ulang menjawab `sudah: true`.
- **Race kurasi ↔ pengingat:** opt-in yang sudah jatuh tempo, kegiatan lalu diubah ke `dibatalkan`, job
  melaporkan `dibatalkan 1` dan **0** email ke alamat itu; kegiatan dikembalikan ke `terbit` setelah uji.

Readback SQL (`kegiatan_pengingat`) pada image final, satu tick job yang memproses dua kanal sekaligus:
`job {diproses 2, terkirim 1, menungguGateway 1}`; baris `email|terkirim|percobaan 1|ada_resi t`,
`email|menunggu|percobaan 0` (jadwal masih jauh), `email|dibatalkan|alasan kegiatan_dibatalkan|tanpa resi`,
`whatsapp|dibatalkan|alasan kegiatan_dibatalkan`; duplikat `(kegiatan, kanal, tujuan)` = **0**. Sisa baris
uji ini tinggal di stack disposable dan dihapus oleh `scripts/cleanup-dummy-operasional.sql` (terbukti lewat
dry-run `BEGIN … ROLLBACK`).

## Temuan yang Diperbaiki saat Proof

1. `monthGrid` web masih 0-based (kalender bergeser satu bulan) — diselaraskan ke kontrak 1-based API/URL.
2. Form pengingat tidak memakai `novalidate` (konvensi repo) sehingga checkbox `required` milik widget ALTCHA
   memblokir submit native tanpa pesan — ditambahkan `novalidate`, validasi tetap di JS + captcha server.
3. Menunggu gateway ikut menaikkan `percobaan` tiap tick — rollback penghitung agar "jumlah percobaan" jujur.
4. Opt-in WhatsApp tanpa gateway semula tersimpan `menunggu` (UI bisa dibaca sebagai "akan dikirim") — sekarang
   lahir sebagai `menunggu_gateway` dengan `alasan = gateway_belum_tersedia`, dan mock fixture diselaraskan.
5. Form pengingat kehilangan pesan hasil setelah dialog ditutup (pembatalan) — pesan dipindah ke lini masa
   (`role=status`), bukan lagi hanya di dalam dialog.

## Cek yang Tidak Berjalan / Catatan Jujur

- Provider WhatsApp: **belum ada** gateway/kredensial → `not provider-proven`; tidak ada klaim "terkirim".
- WebKit (proyek `tablet`/`mobile`): browser tidak terpasang di mesin ini.
- 8 kegagalan suite mock lain (akun/passport/produk-passport) berasal dari pekerjaan sesi paralel dan tidak
  berada di scope Y07; tidak ada file Y07 yang terlibat.
- `scope_guard.py check --phase Y07`: **0** file Y07 di luar manifest; 37 path "outside" adalah file phase lain
  (Y04/Y06/Y08/Y09) yang diubah sesi paralel setelah snapshot saya.

## Syarat Naik ke `done`

1. Isi `WHATSAPP_GATEWAY_URL` (+ token/sender) ke stack disposable, jalankan ulang
   `POST /v1/program/kegiatan/pengingat/proses` untuk opt-in WhatsApp yang sama, dan simpan resi provider
   (message id + status callback bila `WHATSAPP_REQUIRE_CALLBACK=true`) sebagai addendum bertanggal.
2. Jalankan proyek Playwright `tablet`/`mobile` (WebKit) pada environment yang memilikinya, atau tambahkan
   proyek Chromium-mobile bila tim memutuskan WebKit tidak wajib.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

- **B17** — starvation pengingat: ≥50 baris WhatsApp `menunggu_gateway` di depan antrean menutup email yang lebih baru. Kandidat kini menyaring `menunggu` biasa, plus `menunggu_gateway` hanya bila `whatsappConfigured(env)`; commit `1be10a7`.
- **B18** — pengingat untuk kegiatan yang sudah lewat tidak lagi dikirim saat gateway dipasang: kandidat menyaring `k.tanggal_mulai > now()`, dan baris kedaluwarsa ditandai `dibatalkan`/`kedaluwarsa`; commit `1be10a7`. Syarat bukti provider WhatsApp (di atas) tetap berlaku dan tidak berubah.
- **B07** — stored XSS di halaman pembatalan pengingat (escape HTML + pola email ketat + mask ulang baris lama): selesai di working tree pelaksana A, belum di-commit — lihat §2.0.
- **B22** — tanggal bisnis memakai `Asia/Jakarta` pada trigger/default yang menyentuh phase ini; commit `927948b`.
- **B31** (sesi 28 Sep malam) — rahasia job pengingat (`POST /pengingat/proses`) yang semula dibandingkan dengan `!==` kini memakai `samaRahasia` (timingSafeEqual) dari `lib/utils/http.js`; rahasia salah — termasuk beda panjang — tetap 403, bukan 500; commit `54279e0`.
- **B33** (sesi 28 Sep malam) — cabang whatsapp `normalisasiTujuan` kini memakai satu `normalisasiTeleponSeluler` dari `lib/validate.js` (semantik gabungan: `(0812)…` dan `812…` tetap diterima seperti sebelumnya); commit `3ada000`.

Verdict `partial` tidak berubah: bukti provider WhatsApp tetap syarat naik ke `done`.
