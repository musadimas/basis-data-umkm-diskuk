# Y06 — Katalog publik, detail produk, dan LOI

- **Stage:** kuning; **ID:** M7-01…M7-05. **Dependency:** Y04, Y05.
- **Baseline:** `apps/web/app/pages/(public)/katalog.vue` masih daftar hardcoded. Pakai produk yang telah terkurasi dari Y04, bukan fixture statis.
- **Scope:** manifest Y06; endpoint baca publik dengan DTO allowlist, halaman katalog/detail, kontak, dan minat kemitraan. Jangan membuka data Passport privat atau tahap investor N6.

## Implementasi

1. Definisikan status layak tayang dan DTO publik yang eksplisit: hanya produk `Tayang di Katalog`, foto yang publik, nama produsen/wilayah, harga/MOQ, spesifikasi dan legalitas yang statusnya jelas. Tambahkan pagination, query dibatasi, cache invalidation setelah kurasi, rate limit. NIK, email pribadi, telepon mentah, omzet, nomor tiket, path media privat tidak dikirim.
2. Ganti katalog hardcoded dengan data API. Pencarian server mencakup nama produk, jenama, UMKM, KBLI 5 digit. Quick chips lima kelompok. Filter 27 kabupaten/kota, skala, Champion/Talent Lab atau Accelerator/Ekspor, sertifikasi, PDN, dan ramah disabilitas dapat digabung dan URL state dapat dibagikan.
3. Kartu 1:1 menampilkan badge yang diverifikasi, nama produk/produsen, asal, rentang harga, MOQ, dan dua CTA. Detail menyediakan media multi-sudut/video, dimensi/berat/masa kedaluwarsa/bahan/TKDN, kapasitas/stok/lead time, nomor/status legalitas dan PDF spesifikasi/katalog ekspor dari Y05. Field tidak tersedia harus diberi “Belum tersedia”, bukan dipalsukan.
4. Kontak WhatsApp membuka `wa.me` dari nomor penjualan yang telah diverifikasi, dengan pesan yang tidak memuat PII pengunjung. LOI digital menyimpan minat kemitraan/order B2B dan persetujuan kontak, melakukan validasi/rate limit/anti-spam serta idempotency; hanya petugas/pemilik berwenang dapat membaca detail LOI.

## Acceptance per ID

| ID | Input/aksi | Hasil dan bukti |
| --- | --- | --- |
| M7-01 | Cari nama, jenama, UMKM, KBLI; pilih lima chips | Hasil berasal dari DB, mobile rapi, kata kunci terhubung ke query server. |
| M7-02 | Kombinasikan wilayah/skala/status/sertifikasi/PDN/disabilitas | Semua dimensi mengubah hasil dan count, 27 wilayah tersedia; filter kosong jelas. |
| M7-03 | Buka kartu produk tayang | Foto 1:1, badge, harga, MOQ, wilayah dan kedua CTA sesuai record. |
| M7-04 | Buka detail produk dan PDF | Semua kelompok field muncul atau dinyatakan kosong; PDF valid. |
| M7-05 | Buka kontak terverifikasi dan kirim LOI dua kali | Nomor resmi benar; satu LOI persisted, umpan balik jelas, tidak ada data privat bocor. |

## State dan gate

- Uji produk draft/ditarik, badge belum terverifikasi, nomor kontak kosong, video gagal, filter saling bertentangan, query panjang, dua LOI konkuren, dan akses publik tanpa login. Jangan buat tautan WA bila kontak belum disetujui.
- Gate: API list/detail/LOI pada DB disposable, scan response untuk PII, browser mobile/desktop seluruh CTA, SQL readback LOI, hasil pencarian/filter, dan parser PDF. Receipt menunjukkan satu produk tayang dan satu draft yang sengaja tidak muncul.

## Amandemen 27 September 2026 (setelah eksekusi)

- **Wilayah filter** diambil dari tabel referensi `kota` lewat grant publik baru (migrasi `20260926R`, fields `id,nama`, batas provinsi JAWA BARAT di level permission), bukan diturunkan dari produk yang tayang. Query klien tidak boleh memfilter `provinsi` karena field itu di luar allowlist.
- **NIB dan nomor legalitas** tampil di detail publik lewat salinan publik pada `produk` (`usaha_nib`, `usaha_legalitas`) yang diisi trigger snapshot dari sertifikat `terbit`; `usaha` dan `usaha_legalitas` tetap tanpa grant publik.
- **Lembar spesifikasi PDF publik per produk**: `GET /v1/program/katalog/produk/:id/pdf` (hanya status tayang/rekomendasi, tanpa kontak pemilik). PDF Y05 per-usaha tetap terautentikasi dan tidak dipakai halaman publik.
- **LOI**: `persetujuan_kontak` wajib, `idempotency_key` unik parsial, rate limit 5 surat/10 menit per alamat ber-hash, penekanan duplikat isi 24 jam; dibaca kurator atau pemilik produk. Idempotensi diperiksa sebelum captcha supaya retry setelah respons hilang tetap dijawab “sudah diterima”.
- **Kontak penjualan**: `usaha_whatsapp` dianggap disetujui setelah produk lolos kurasi; tautan WA hanya dibuat untuk produk tayang/rekomendasi yang nomornya terisi.
- **Terbuka dan tidak diklaim**: jenama (tidak ada field di model), filter UMKM Ekspor (tidak ada atribut), stok dan kapasitas pesanan besar (tidak ada field, selalu “Belum tersedia”). Rincian bukti di `receipt_Y06_public_catalog.md`.
