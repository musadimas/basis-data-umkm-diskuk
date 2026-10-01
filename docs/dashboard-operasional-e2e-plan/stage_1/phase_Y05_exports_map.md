# Y05 — Ekspor, popup peta, pencarian Tabular, basemap satelit

- **Stage:** kuning; **ID:** M2-01, M3-01, M6-05; plus dua perbaikan hijau yang diminta pengguna. **Dependency:** Y02, Y04.
- **Rujukan teknis:** `../legacy/phase_12.md` dan `../legacy/phase_13.md`.
- **Scope:** canvas/worker/Tabular/peta. Pertahankan filter, query budget, dan otorisasi lama.

## Implementasi

1. Bawa filter/seri/angka canvas aktif ke job ekspor server dan worker. Hasilkan PDF laporan, PNG resolusi layak presentasi, PPT slide dengan grafik/tabel/angka aktual. Perbaiki jalur PNG agregat 1×1. Validasi berkas dibuka parser sesuai tipe; ekspor privat, TTL dan cleanup job, status gagal/retry, serta scope kota.
2. Buat Executive Summary & Business Scorecard PDF dan Katalog Ekspor Resmi PDF dari Passport/produk terkurasi, dengan metadata sumber, tanggal, status verifikasi, dan QR yang benar. Unduhan harus memuat isi, tidak boleh file kosong atau placeholder.
3. Popup pin UMKM mengambil detail yang sesuai hak role: nama usaha/pemilik, skala, KBLI 5 digit+kegiatan, omzet Rp, Halal/PIRT/hak merek, status talenta, dan Buka Profil Lengkap. Hindari bocor NIK/nomor pribadi dan pin di luar scope. Jalur detail harus menuju record yang benar.
4. Perbaiki pencarian Tabular lintas nama/NIB/KBLI/kolom yang dijanjikan, dipadukan filter bertingkat dan pagination; pertimbangkan index trigram jika query plan membutuhkannya. Basemap OSM/satelit bisa dipilih, attribution dan ketersediaan tile dicatat, pilihan tetap setelah drill-down. Provider tile/lisensi harus dikonfirmasi sebelum produksi.

## Acceptance per ID

| ID | Input/aksi | Bukti |
| --- | --- | --- |
| M2-01 | Pilih filter tertentu lalu unduh tiga format | PDF/PNG/PPT valid, angka sama dengan canvas dan filter tercantum; PNG bukan 1×1. |
| M3-01 | Klik pin dari kota berizin dan pin di luar scope | Seluruh field kartu dan link detail benar; akses silang ditolak. |
| M6-05 | Unduh dua PDF dari Passport/produk | Ringkasan+scorecard dan katalog ekspor valid serta mencerminkan data terkini. |
| Hijau: pencarian Tabular | Cari teks lintas page, gabung filter, hasil kosong | Result count, pagination, dan isi sesuai query server; bukan filter hanya pada halaman yang sedang tampil. |
| Hijau: basemap satelit | Pilih satelit, drill-down, kembali ke OSM | Tile benar terlihat dengan attribution; pilihan dan layer spasial tetap bekerja. |

## State dan gate

- Uji dataset kosong/besar, filter berubah selama job, job gagal/diulang, unduhan tanpa izin, cache stale, tile gagal, popup data hilang, dan pencarian aksen/spasi. Gunakan snapshot filter sebagai input job immutable.
- Gate: tes worker+API, buka/parsing tiga artefak dengan pemeriksaan dimensi/slide/halaman dan angka, EXPLAIN/query budget pencarian, browser desktop-mobile peta/Tabular. Receipt melampirkan hash dan metadata file.
