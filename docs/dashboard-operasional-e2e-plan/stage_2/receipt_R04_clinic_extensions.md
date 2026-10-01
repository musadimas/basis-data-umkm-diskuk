# Receipt R04 — Statistik klinik dan integrasi hasil konsultasi

- **Tanggal:** 29 September 2026.
- **Verdict:** `partial`. N7-04 dan N7-05 terbukti pada API nyata (66/66 probe), browser real-API (6/6), Postgres nyata (17 tes) dan suite lokal. Gate Stage 2 belum lulus karena [Y10](../stage_1/receipt_Y10_acceptance.md) masih `blocked`; jangan menyatakan `done`.
- **ID:** N7-04, N7-05.
- **Isolasi:** seluruh mutasi runtime pada DB `r04_clone` dan container `r04-directus` (:8156) serta `nuxt dev` :3120; DB `diskuk` dan stack bersama tidak disentuh. Rincian: [runtime-evidence.md](artifacts/R04/runtime-evidence.md).
- **Keputusan pengguna (29 September 2026, tanya-jawab):** direktori = tabel kurasi baru; CSAT diisi pemohon sendiri (consent); outcome dua langkah beda aktor; `selesai` tetap final (koreksi lewat outcome). Ditulis di [phase R04](phase_R04_clinic_extensions.md) bagian addendum.

## Hasil per ID

| ID | Bukti | Sisa gate |
| --- | --- | --- |
| N7-04 | Total selesai, rata-rata respons, dan CSAT dari API sama dengan hitungan independen dari baris mentah (fixture selesai/berjalan/masuk/batal, respons 26/5/2/10 jam, CSAT dengan dan tanpa consent). CSAT tanpa sampel = `null` (UI "Belum ada penilaian"), bukan angka. Direktori dan slot bebas per konsultan sama dengan hitungan independen dari DB, termasuk jadwal mingguan, slot poli terpakai, tiket batal yang membebaskan slot, pendamping tertaut yang sibuk di poli lain, dan konsultan tanpa slot (tampil dengan `ketersediaan: []`). Dua jawaban CSAT serentak → satu baris. PII scan publik bersih. Browser: halaman publik dan alur menilai tiket pada server nyata. | Tablet/mobile tidak dijalankan. Kurasi direktori hanya lewat Data Studio (admin), tanpa UI provinsi dan tanpa seed dummy. Pemesanan tiket tidak dibatasi jadwal konsultan (ketersediaan bersifat informasi). |
| N7-05 | Outcome terstruktur (atribut Jabar × kepatuhan/perbaikan) diajukan bersama penutupan tiket (atomik) atau sesudahnya; diverifikasi aktor lain di wilayahnya; hanya yang terverifikasi masuk profil (`hasilKonsultasi`) dan indikator IP-UMKM (`indikator-operasional-v2`). Retry/serentak: satu outcome hidup per tiket, satu efek per usaha. Gagal di tengah (fault injection CHECK palsu pada DB) → tiket, outcome, audit ikut rollback, ulang berhasil sekali. Koreksi = versi baru terverifikasi + versi lama dicabut beralasan; cabut mengeluarkan efek; semua beraudit dengan aktor, nama, waktu. IDOR/peran: pendamping/umkm 403, anonim 401, kab/kota lain 404 (verifikasi/koreksi/cabut/catat). Catatan sesi tidak pernah masuk outcome/profil (scan). | Verifikasi bergantung pada adanya verifikator berbeda dari pengaju (lihat risiko). Indikator IP-UMKM adalah indikator operasional, bukan skor resmi Permen. |

## State yang diminta fase dan cara dibuktikan

| State | Bukti |
| --- | --- |
| Tiket tanpa outcome | Penutupan sah; tidak ada baris; profil/indikator tetap; server menawarkan "Catat outcome". |
| Outcome belum terverifikasi | Tidak mengubah profil maupun indikator; pengaju tidak ditawari verifikasi. |
| Dua close bersamaan | 200 + 409 `TIKET_BERUBAH`; satu outcome, satu transisi. |
| Pekerjaan integrasi gagal | Fault injection di DB clone: rollback penuh, retry berhasil sekali. Integrasi memakai transaksi + unique parsial (bukan outbox): tidak ada pekerjaan asinkron yang bisa tertinggal setengah jalan. |
| Hasil dikoreksi | Versi baru, versi lama dicabut beralasan, efek berganti dalam satu transaksi; retry idempoten. |
| Tiket dibuka ulang | `selesai` final (409 pada semua transisi keluar); `batal → dijadwalkan` tidak menghasilkan outcome. Koreksi salah catat lewat outcome. |
| Coach tidak tersedia | Konsultan tanpa slot bebas tampil dengan `ketersediaan: []` dan pesan jujur di UI. |

## Perubahan

- **Backend:** migrasi `20260929C-klinik-konsultan-csat-outcome.js`; `klinik/direktori.js` (statistik, konsultan, CSAT) dan `klinik/outcome.js` (use case outcome); `klinik/{index,service,rules}.js`; `oas.yaml`; extension operasional: `permen-aspek.js` (CTE agregat outcome terverifikasi, versi definisi v2) dan `usaha-service.js` (`hasilKonsultasi`).
- **Web:** enam komponen klinik baru, `LacakTiket.vue` (CSAT), halaman `konsultasi`, panel `klinik.vue` (wiring), profil `data-lapangan/[id].vue`, `lib/klinik.ts`, `constants/PROGRAM.ts`, tipe, mock/fixture, spec mock `klinik-outcome.spec.ts`.
- **Tes:** `test/pg/klinik-statistik.test.js` (6), `test/pg/klinik-outcome.test.js` (11), tambahan di `klinik-rules.test.js` dan `klinik.test.js`, kontrak skema migrasi C, `tests/unit/klinik-outcome.test.ts` (8). Mutation check: mengubah filter `terverifikasi` pada indikator membuat tes pg gagal.
- **Manifest:** entri R04 lama (`directus-extension-operasional/src/klinik-*-service.js`, migrasi `20260926P`, `dashboard/klinik/[id].vue`) tidak pernah ada/bertabrakan; diganti path nyata.
- **Glosarium:** `CONTEXT.md` — istilah Konsultan Klinik, Outcome Klinik, CSAT; "konsultan" tidak lagi dilarang untuk Petugas Klinik karena kini istilah tersendiri.

## Bukti perintah

| Perintah | Hasil |
| --- | --- |
| `node --test services/directus/extensions/program/test/*.test.js` | 119 pass, 0 fail |
| `test/pg/*.test.js` (template `diskuk_test_template_r04`, Postgres nyata) | 141 pass, 0 fail (termasuk 17 tes baru) |
| `node --test services/directus/test/*.test.mjs` | 53 pass, 3 skip (tanpa PG); dengan `DISKUK_TEST_PG_URL`: 56/56 |
| `node --test …/directus-extension-operasional/test/*.test.cjs` | 25 pass |
| `pnpm --dir apps/web typecheck`, `vitest run`, `pnpm build` | lulus; 123/123; sukses |
| `pnpm exec playwright test klinik-outcome klinik-ui klinik data-lapangan --project=chromium` (mock) | 16 pass |
| `pnpm lint:oxlint` | exit 0, tanpa peringatan |
| `python3 …/check_coverage.py` | exit 0 |
| `r04-runtime.mjs` (API nyata + SQL readback, clone) | 66/66 (dua kali) |
| `r04.real.spec.ts` (Chromium, ALTCHA nyata, `nuxt dev` → clone) | 6/6 |
| `migrate:down` → `migrate:latest` untuk `20260929C` | bersih (tabel, 11 indeks, 5 collection, 11 field, 4 relasi identik) |

## Risiko dan yang belum terbukti

- **Beda aktor** dapat menemui jalan buntu: outcome yang diajukan satu-satunya akun provinsi untuk usaha tanpa kab/kota tidak bisa diverifikasi. Tiket manual (tanpa usaha) sengaja tidak boleh punya outcome.
- Waktu respons memakai jam kalender dan transisi status pertama non-`batal`; tiket yang dipindah data (tanpa jejak audit) tidak terhitung.
- `whatsapp` klinik tetap `not provider-proven` (keputusan pengguna); tidak terkait ID R04.
- Bukti browser memakai `nuxt dev`; image web bersama tidak diuji. Proyek tablet/mobile tidak dijalankan.
- Migrasi C bebas seed; halaman publik menampilkan "Direktori belum tersedia" sampai admin mengisi `klinik_konsultan`.

## Sisa gate

Y10 `blocked`; verdict akhir per ID ada di [receipt R05](receipt_R05_acceptance.md).
