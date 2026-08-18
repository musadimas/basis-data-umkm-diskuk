# Product Specification — Halaman Analitik

**Status:** disetujui sebagai target produk
**Implementasi:** belum dimulai dalam scope dokumentasi ini

## 1. Latar belakang

Aplikasi saat ini memiliki halaman Infografis, Tabular, dan Spasial. Pengguna membutuhkan ruang kerja baru untuk menjawab pertanyaan dengan cepat, membandingkan segmen, melakukan drill-down, dan membuka detail UMKM tanpa mengolah data secara manual di luar aplikasi.

Halaman baru harus membuat aplikasi berfungsi sebagai decision support system berbasis bukti. Pada fase ini, data hanya mendukung keputusan berbasis kondisi terkini; belum ada histori yang layak untuk tren dan belum ada data program/outcome untuk mengukur dampak intervensi.

## 2. Pengguna

Hanya ada satu pengguna manusia untuk fase awal: analis/perencana internal DisKUK yang juga dapat menjalankan pekerjaan operasional. Pengalaman analisis dioptimalkan untuk pengguna tersebut, sedangkan hasilnya tetap mudah dibaca pimpinan. Secara teknis tetap ada dua identitas:

- **Application User** — akun harian dengan akses minimum yang diperlukan untuk dashboard, Analitik, dan kelak CRUD.
- **Break-glass Admin** — akun Directus terpisah untuk konfigurasi dan pemulihan darurat; tidak dipakai sehari-hari.

Tidak ada registrasi publik dan tidak ada pembagian peran UI yang kompleks pada fase awal.

## 3. Tujuan

1. Menjawab pertanyaan prioritas dalam waktu maksimal tiga menit.
2. Menelusuri agregat sampai profil UMKM tanpa ekspor manual.
3. Memastikan setiap angka memiliki definisi, denominator, filter, coverage, dan waktu data yang dapat dilihat.
4. Mendukung penentuan wilayah atau kelompok UMKM yang perlu diperhatikan.
5. Menemukan anomali dan masalah kualitas data yang dapat ditindaklanjuti.
6. Tetap stabil ketika Directus memperoleh field baru atau mengalami perubahan schema.

## 4. Bukan tujuan

Target awal tidak mencakup:

- analitik tren atau klaim naik/turun;
- prediksi, rekomendasi kausal, atau model AI generatif;
- pengukuran keberhasilan program/intervensi;
- dashboard builder multi-widget;
- shortlist sasaran;
- catatan, kesimpulan, atau workflow persetujuan keputusan;
- registrasi, pemulihan password publik, atau multi-role UI;
- halaman CRUD khusus (Directus Admin dapat menjadi sumber perubahan sementara);
- monitoring eksternal/push alert;
- perhitungan agregat jutaan record di browser.

## 5. Information architecture

| Route | Fungsi | Akses |
|---|---|---|
| `/sign-in` | Login Directus | Publik |
| `/dashboard` | Infografis eksekutif | Authenticated |
| `/dashboard/analitik` | Canvas Analitik | Authenticated |
| `/dashboard/tabular` | Data tabular | Authenticated |
| `/dashboard/spasial` | Peta spasial | Authenticated |
| `/dashboard/umkm/:id` | Profil UMKM | Authenticated |

Klik visualisasi pada Infografis sebaiknya membuka Analitik dengan filter yang sesuai. Pengunjung tanpa sesi diarahkan ke `/sign-in`; API privat mengembalikan `401` dan tidak mengandalkan penyembunyian menu.

## 6. Model pengalaman

### 6.1 Canvas tunggal

Canvas menggunakan urutan:

1. judul dan waktu data terakhir;
2. template analisis;
3. pemilih metrik, dimensi, breakdown, dan filter;
4. KPI;
5. insight otomatis;
6. grafik atau peta utama;
7. breakdown;
8. daftar UMKM hasil analisis.

Istilah worker, queue, cache, retry, dan reconciliation tidak boleh tampil pada canvas.

### 6.2 Grammar analisis

Setiap visual utama memakai grammar:

```text
Metrik → Kelompokkan berdasarkan → Breakdown opsional → Filter
```

Contoh:

```text
Jumlah UMKM → Kabupaten/Kota → Skala Usaha → Sektor KBLI C
```

Satu visual memiliki satu metrik utama dan maksimal dua dimensi. Perubahan konfigurasi baru dikirim setelah pengguna menekan **Terapkan**, bukan pada setiap perubahan input.

### 6.3 Template

Template default saat halaman dibuka adalah **Sebaran UMKM Saat Ini** pada level kabupaten/kota. Template bawaan:

1. Sebaran UMKM berdasarkan wilayah
2. Profil sektor dan KBLI
3. Komposisi skala usaha
4. Tenaga kerja — hanya setelah semantik sumber tervalidasi
5. Kualitas dan kelengkapan data
6. Eksplorasi kustom

Template adalah preset; pengguna tetap dapat mengganti metrik, dimensi, filter, dan visual yang valid.

### 6.4 Filter

Filter global mencakup:

- kabupaten/kota → kecamatan → desa/kelurahan;
- sektor A–U → divisi dua digit → kode KBLI lengkap;
- skala usaha;
- aktif/arsip;
- status kualitas data;
- field dinamis yang diizinkan registry.

Filter wajib searchable, cascading, terlihat sebagai chips, dapat dihapus satu per satu, dan terserialisasi ke URL tanpa membawa PII.

### 6.5 Visualisasi

Tipe yang didukung:

- KPI;
- bar dan stacked bar;
- donut untuk maksimal enam kategori;
- choropleth map;
- histogram untuk angka;
- tabel.

Grafik garis dinonaktifkan sampai tersedia dimensi waktu yang valid. Sistem memilih visual awal berdasarkan tipe data, tetapi pengguna boleh menggantinya dengan tipe lain yang kompatibel. Grafik menampilkan maksimal 20 kategori; sisanya menjadi **Lainnya**. Field ber-cardinality sangat tinggi dipakai untuk pencarian, filter, dan tabel, bukan grafik.

### 6.6 Perbandingan

Tanpa histori, perbandingan yang sah adalah:

- wilayah terpilih versus Jawa Barat;
- wilayah versus wilayah;
- sektor versus sektor;
- nilai absolut, persentase, dan selisih pada snapshot yang sama.

UI tidak boleh memakai kata “naik”, “turun”, “pertumbuhan”, atau “tren” tanpa data antarperiode.

### 6.7 Cross-filter dan drill-down

- Klik elemen grafik memfilter seluruh canvas.
- Aksi **Drill down** turun ke hierarki berikutnya.
- Aksi **Lihat record** membuka daftar UMKM.
- Breadcrumb kembali ke level sebelumnya.
- Back/forward browser mempertahankan state.
- Membuka profil dan kembali ke Analitik tidak menghilangkan filter atau posisi hasil.

Aksi cross-filter dan drill-down harus terpisah agar klik tidak ambigu.

## 7. Metrik MVP

Metrik awal:

1. jumlah UMKM;
2. kualitas/coverage data;
3. jumlah tenaga kerja hanya setelah hubungan kolom disabilitas terhadap total dikonfirmasi.

Nilai modal, omzet, dan aset dapat dianalisis sebagai distribusi, median, average, min, atau max setelah coverage ditampilkan. `SUM` hanya tersedia jika metadata menyatakan field additive dan definisinya tervalidasi.

## 8. Insight otomatis

Insight deterministik dapat menampilkan:

- konsentrasi wilayah/sektor tertinggi;
- perbedaan terbesar terhadap distribusi Jawa Barat;
- missing/invalid tinggi;
- record yang belum terpetakan;
- outlier numerik berdasarkan IQR.

Baseline warning kualitas:

- `>5%` missing/invalid: warning;
- `>20%` missing/invalid: high warning.

Threshold dapat diubah melalui metadata. Setiap insight wajib menampilkan rumus, denominator, coverage, filter aktif, dan link ke bukti. Insight tidak boleh menyatakan sebab-akibat.

## 9. Saved analysis

`analitik_view` menyimpan:

- nama;
- konfigurasi query/filter/visual;
- versi schema konfigurasi;
- waktu dibuat dan diperbarui.

Saved analysis tidak menyimpan shortlist, catatan, atau kesimpulan. Saat dibuka, konfigurasi selalu dihitung ulang terhadap data terkini. Ekspor adalah artefak tetap yang membawa timestamp, filter, dan waktu data.

## 10. Profil UMKM

`/dashboard/umkm/:id` menggunakan UUID internal dan tampilan kaya seperti profil media sosial, tanpa feed, like, comment, atau follower.

Bagian profil:

- hero/cover dan foto usaha;
- ringkasan usaha dan badge status/skala;
- identitas dan NIB;
- produk/kegiatan utama serta KBLI;
- lokasi usaha dan peta;
- modal, omzet, dan aset;
- tenaga kerja;
- profil pelaku usaha dengan aturan privasi;
- kualitas dan asal data;
- field dinamis tambahan.

Aksi konseptual:

- kembali ke analisis tanpa kehilangan state;
- Edit;
- Archive/Restore menggunakan archive Directus;
- salin tautan internal;
- ekspor PDF;
- UMKM sebelumnya/berikutnya dari hasil analisis.

Halaman detail harus schema-resilient. Field baru yang aman masuk section dari `analitik_field`; field tanpa kategori masuk **Informasi Tambahan**. Nilai kosong tampil sebagai **Belum tersedia**, bukan menghilang diam-diam.

## 11. Ekspor

- CSV agregat diproses langsung.
- CSV record detail diproses sebagai job, maksimal 50.000 record per file.
- PNG dan PDF diproses sebagai job.
- File privat memakai tautan sementara maksimal 24 jam.
- Masking tetap berlaku pada semua format.
- Setiap ekspor tercatat pada audit log.
- Ekstraksi lebih besar dilakukan melalui proses data khusus di luar UI.

## 12. Authentication requirements

- Login email dan password Directus.
- Tidak ada registrasi publik.
- Session memakai secure HTTP-only cookie melalui origin aplikasi.
- Session dapat diperbarui otomatis selama aktif.
- Logout mencabut sesi.
- Setelah login, pengguna kembali ke URL tujuan.
- Baseline sesi aktif delapan jam dan idle timeout 30 menit.
- Akun harian bukan Super Admin.
- Route guard Nuxt dan Directus accountability wajib diterapkan bersamaan.

## 13. Privacy requirements

- NIK: `************1234`.
- Telepon: `08******1234`.
- Tanggal lahir menjadi kelompok usia.
- Domisili pribadi pelaku usaha tidak ditampilkan.
- Alamat dan peta lokasi usaha dapat tampil untuk pengguna terautentikasi.
- API Analitik tidak mengirim NIK/telepon mentah.
- Data mentah hanya boleh tersedia pada pengalaman Edit yang berizin.
- PII, credential, dan payload mentah tidak boleh masuk URL, ekspor Analitik, atau log.

## 14. Keadaan data yang terlihat pengguna

Pengguna hanya melihat pesan nonteknis:

- “Data terakhir diperbarui pada …”
- “Pembaruan data sedang diproses.”
- “Data terbaru belum tersedia; menampilkan data terakhir yang berhasil diproses.”

Jika pemrosesan gagal, last-known-good data tetap tersedia.

## 15. Non-functional requirements

### Performa

- Analisis/filter umum: p95 ≤3 detik.
- Drill-down dan profil: p95 ≤5 detik.
- Perubahan Directus terlihat di Analitik ≤60 detik.
- Agregasi dilakukan di server.
- Query complexity budget, timeout, pagination, dan batas kategori wajib diterapkan.

### Accessibility dan responsive

- WCAG 2.1 AA.
- Desktop/tablet sebagai pengalaman utama.
- Mobile tetap dapat melihat, mencari, memfilter, dan membuka profil.
- Query builder mobile memakai drawer.
- Navigasi keyboard dan screen reader.
- Informasi tidak mengandalkan warna saja.
- Setiap grafik memiliki alternatif tabel.

### Lokalisasi

- Bahasa Indonesia.
- Zona waktu WIB.
- Format tanggal dan pemisah angka Indonesia.
- Mata uang Rupiah.
- Identifier internal boleh menggunakan istilah teknis Inggris.

## 16. Acceptance criteria

1. Pengunjung publik tidak dapat membuka dashboard maupun API privat.
2. Login, session refresh, logout, dan redirect bekerja.
3. Pengguna dapat menjawab pertanyaan prioritas dalam ≤3 menit.
4. Analisis umum memenuhi p95 ≤3 detik.
5. Drill-down dan profil memenuhi p95 ≤5 detik.
6. Angka memiliki definisi, denominator, coverage, filter, dan waktu data.
7. Perubahan Directus terlihat ≤60 detik.
8. Create/rename/type-change/delete field tidak merusak halaman.
9. Worker gagal tetap menyajikan last-known-good data.
10. Rekonsiliasi sumber dan agregat tidak memiliki selisih.
11. NIK/telepon tidak pernah tampil mentah di Analitik, ekspor, URL, atau log.
12. Seluruh visual memiliki alternatif tabel dan memenuhi WCAG 2.1 AA.
13. Saved analysis selalu memproses data terkini dan tetap dapat dibuka ketika field berubah, dengan peringatan jika perlu.
14. Profil UMKM kembali ke konteks analisis tanpa kehilangan state.

## 17. Dependensi dan gate

Sebelum implementasi dinyatakan siap:

- semantik tenaga kerja disabilitas harus dikonfirmasi;
- KBLI yang tidak dapat dipetakan harus ditangani sebagai coverage eksplisit;
- schema dan izin Directus target harus diverifikasi;
- benchmark query dilakukan terhadap volume deployment;
- desain backup/PITR dan restore drill harus dibuktikan;
- target snapshot/current read model harus lolos rekonsiliasi terhadap tabel `usaha`.
