# Y03 — KPI mingguan pada PWA dan pendamping

- **Stage:** kuning; **ID:** M5-01…M5-06. **Dependency:** Y01, Y02.
- **Rujukan teknis:** `../legacy/phase_7.md`, `../legacy/phase_8.md`; pantau hanya bagian tren per peserta dari `../legacy/phase_9.md`.
- **Keputusan:** pelaporan **setiap Jumat, Asia/Jakarta** sesuai Brief Fitur. Toggle demo offline N5-01 dan agregat eksekutif N5-02/N5-03 berada di Stage 2.

## Implementasi

1. Model batch/program, keanggotaan peserta-pendamping, target KPI per minggu, laporan dengan `client_uuid`, foto bukti privat, verifikasi, dan rekomendasi. Tetapkan minggu program dari tanggal mulai dan batas 12 minggu atau panjang batch yang dikonfigurasi.
2. PWA UMKM menampilkan profil, fase/batch, pendamping, minggu saat ini. Banner koneksi memakai kondisi online dan hasil request aktual; jangan menganggap `navigator.onLine` saja sebagai bukti server dapat dijangkau. Antrean lokal IndexedDB menyimpan laporan/foto yang dibuat saat offline; jelaskan retensi dan hapus saat sinkron sukses.
3. Validasi server: laporan baru dibuat pada Jumat WIB. Laporan yang dibuat offline pada Jumat membawa waktu penciptaan dan idempotency key yang diverifikasi saat sinkron setelah Jumat; server harus mencegah timestamp palsu secara proporsional dengan kontrak prototype dan mencatat provenance. Satu laporan aktif per peserta/minggu; revisi karena penolakan terkait record yang sama.
4. Pendamping melihat tiga filter status, hanya peserta binaan. Bukti bisa diperbesar; rasio realisasi/target memakai aturan target nol. Tolak dengan catatan dan minta revisi, atau setujui secara atomik. Grafik peserta dan pembacaan dasar pimpinan hanya memakai data terverifikasi. Empat minggu berturut-turut memenuhi target membuka rekomendasi Champion/Investment Day, dengan aktor pendamping.

## Acceptance per ID

| ID | Aksi nyata | Hasil dan bukti |
| --- | --- | --- |
| M5-01 | Login peserta pada viewport mobile | Nama usaha/pengusaha, batch, pendamping, minggu benar dari data server. |
| M5-02 | Putus jaringan saat Jumat, kirim, pulihkan Sabtu | Banner berubah, antrean lokal bertahan reload, sinkron tepat sekali dan record server terbaca ulang. |
| M5-03 | Isi target, omzet, pesanan, foto kamera/galeri, kendala; kirim Kamis dan Jumat | Form lengkap; Kamis ditolak, Jumat diterima, replay offline Jumat sesudahnya sah. |
| M5-04 | Pendamping ganti tiga filter dengan peserta belum/sudah kirim | Baris dan jumlah benar; peserta luar binaan tidak muncul. |
| M5-05 | Zoom bukti, tolak dan revisi, lalu verifikasi | Rasio benar; catatan dan status persisted, histori keputusan tidak hilang. |
| M5-06 | Empat minggu valid dan satu minggu gagal target | Tren hanya laporan terverifikasi; rekomendasi muncul hanya pada empat pekan berturut-turut; pimpinan membaca tren sesuai scope. |

## State dan gate

- Uji antrian kosong, gagal upload foto, dua submit simultan, reconnect berulang, draft lama dari pekan lain, edit setelah persetujuan, pendamping berganti, target nol, timezone lintas tengah malam Jumat, dan storage perangkat penuh.
- Gate: kontrak timezone/idempotency, schema+file readback, Playwright mobile dengan network offline/online pada stack disposable, panel pendamping dan pimpinan real API. Receipt menyimpan jejak satu `client_uuid` dari lokal sampai server.

## Receipt eksekusi Y03 (26 Sep 2026)

- **Verdict: `partial`** — semua unit/contract/browser mock hijau; `not runtime-proven`
  (tidak ada disposable stack Docker dijalankan; `operasional.directus.spec.ts`
  Y03 skip tanpa `PLAYWRIGHT_USE_REAL_API`). Bukan `done` sampai readback
  migrasi F + seed Y03 + browser real API pada stack disposable dan Y01/Y02 `done`.
- **ID:** M5-01 (beranda UMKM: usaha/pengusaha/batch/pendamping/minggu-6 + target
  Rp 18jt dari server), M5-02 (offline Jumat → banner offline → antrean IndexedDB
  → online → toast sinkron 1 laporan tepat-sekali + riwayat), M5-03 (form lengkap
  kamera/galeri; Kamis 422 BUKAN_JUMAT, Jumat 201, replay idempoten 200),
  M5-04 (tiga filter menunggu/disetujui/belum; luar binaan tidak muncul),
  M5-05 (zoom scale 1.5x, capaian 116,7%, tolak validasi catatan ≥3, setujui atomik),
  M5-06 (tren SVG hanya realisasi disetujui + tabel sr-only 12 baris; rekomendasi
  enabled hanya layak 4 berurutan; provinsi/kabkota baca tren sesuai scope).
- **Keputusan Jumat (divergensi legacy):** `phase_7.md` mengizinkan kirim ≤ minggu
  berjalan hari apa pun; Y03 menegakkan Brief Fitur — `dikirimPada` (waktu
  penciptaan klien) wajib Jumat WIB. Replay offline Jumat sah maks 7 hari dengan
  `provenance offline-replay`; Kamis ditolak 422; timestamp masa depan >5 menit
  dan replay kedaluwarsa ditolak. Palsu penuh tidak dicegah (tanpa jam tepercaya),
  proporsional untuk prototype + tercatat di `provenance`.
- **Amandemen scope (reviewable):** `scope_manifest.json` Y03 tambah 1 path —
  `services/directus/extensions/directus-extension-operasional/test/index.test.cjs`
  (modify, uji tolak anonim/asing 18 route Y03). 46 path Y03 lain sesuai manifest;
  `outside` hanya manifest itu sendiri (amandemen). Tidak menyentuh N5-01 toggle
  demo, N5-02/N5-03 agregat/at-risk (Stage 2).
- **Jejak satu `client_uuid`:** `d1000000-0000-4000-8000-000000000001`
  (Jumat 2026-10-02T05:00Z, minggu 1) — `program-service.test.cjs`:
  POST 1 → INSERT provenance `online` 201; POST ulang UUID sama → 200 idempoten
  tanpa INSERT kedua (assert tidak ada `INSERT` pada panggilan kedua); race
  23505 → readback idempoten. Browser: UUID acak per submit via `crypto.randomUUID`,
  mock `__y03Laporan.seen` membuktikan replay 200 tanpa insert kedua.
- **Perintah + exit:** operasional ext 63/63, directus contract 18/18, web unit
  47/47 (roles 16 + program-week 3), typecheck 0, eslint Y03 0 error/0 warning,
  compose config OK, `node --check` seed OK, playwright chromium 7/7
  (umkm-laporan 3 + kpi-jumat 1 + pendamping 2 + akselerasi 1; stabil 3x).
  Screenshot/video/trace Playwright tersimpan di `test-results/`.
- **Tidak berjalan:** disposable stack + migrasi F up/down + seed Y03 SQL readback
  (`minggu_ke`/`provenance`/target 18jt/9692308/8307692) + `operasional.directus`
  Y03 real API + browser mobile/tablet WebKit (tidak terinstal di env ini;
  layout UMKM 390px + chromium offline/online sebagai bukti parsial) + mailer/
  provider (tidak relevan Y03). Risiko: auth/roles spec gagal 3 di suite penuh
  (milik Y01 dirty, bukan Y03 — Y03 terisolasi hijau); agen Y01 masih menulis file
  bersama (`NAVIGATION`, `ROLES`, `mock-directus`, seed) — pull/rebase sebelum Y10.
