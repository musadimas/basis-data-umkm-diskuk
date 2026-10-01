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

## Receipt eksekusi Y03

Lihat dokumen receipt lengkap di [Receipt Y03](stage_1/receipt_Y03_kpi.md).
- **Verdict:** `done` (27 September 2026, pasca-merge `790559b` & runtime disposable stack `diskuk-operasional-e2e`).
- Seluruh unit test, kontrak skema/service, typecheck, mock browser E2E Playwright (`tests/e2e/kpi.spec.ts` 3/3 pass), serta pembuktian runtime browser API nyata (`tests/e2e/operasional.directus.spec.ts` Y03 suite 2/2 pass dengan `PLAYWRIGHT_USE_REAL_API=1`) lulus 100%.
- Memenuhi seluruh acceptance ID: M5-01 (PWA mobile beranda UMKM & info program), M5-02 (antrean offline IndexedDB & sync tepat-sekali), M5-03 (form omzet/transaksi/bukti/kendala & idempotency client_uuid), M5-04 (panel pendamping & filter antrean 4 tab berizin), M5-05 (review bukti foto, validasi catatan penolakan & persetujuan atomik), M5-06 (evaluasi rangkaian streak target 4 pekan berturut-turut & toggle rekomendasi pitching).

