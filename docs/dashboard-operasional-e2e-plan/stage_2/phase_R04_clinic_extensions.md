# R04 — Statistik klinik dan integrasi hasil konsultasi

- **Stage:** merah; **ID:** N7-04, N7-05. **Dependency:** Y10 done dan Y09.
- **Scope:** manifest R04; tambah metrik/direktori dan event integrasi, tanpa melemahkan kerahasiaan tiket.

## Implementasi

1. Halaman depan klinik memperjelas layanan dan menampilkan total konsultasi selesai, waktu respons rata-rata, CSAT dari jawaban dengan consent, direktori coach/konsultan dan ketersediaan slot yang benar. Definisikan timestamp awal/akhir dan denominator; jangan tampilkan CSAT dari sampel nol sebagai nilai numerik.
2. Saat tiket `Selesai`, tulis outcome terstruktur: kepatuhan/perbaikan usaha yang diverifikasi, indikator perkembangan usaha yang terpengaruh, sumber tiket/aktor/tanggal. Integrasi ke profil UMKM memakai outbox atau transaksi dengan idempotency; hanya outcome yang diperbolehkan masuk profil, bukan catatan sensitif sesi. Rekalkulasi indikator memakai versi dan memungkinkan koreksi/revoke dengan audit.

## Acceptance per ID

| ID | Input/aksi | Bukti |
| --- | --- | --- |
| N7-04 | Fixture tiket selesai/belum, CSAT kosong/isi, jadwal coach | Total/rata-rata/CSAT benar, direktori dan ketersediaan cocok dengan DB. |
| N7-05 | Tutup tiket dengan outcome terverifikasi, retry dan koreksi | Profil/indikator berubah tepat sekali; sumber dan histori terlacak, catatan privat tidak bocor. |

## State dan gate

- Uji tiket tanpa outcome, outcome belum terverifikasi, dua close bersamaan, pekerjaan integrasi gagal, hasil dikoreksi, tiket dibuka ulang, coach tidak tersedia. Gate: perhitungan metrik, SQL readback profil/outbox, API IDOR, browser klinik/profil, scan PII, regresi status Stage 1.
