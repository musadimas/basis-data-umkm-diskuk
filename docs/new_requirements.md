1\. STRUKTUR MENU & INFORMASI APLIKASI (SITEMAP PROTOTYPE)  
Purwarupa harus memiliki pembagian navigasi yang jelas antara **Portal Publik** dan **Dashboard Internal Terotentikasi (Multi-Role)**:  
├── PORTAL PUBLIK (umkm.jabarprov.go.id)  
│   ├── Beranda (Ringkasan Makro & Peta Sebaran Ringkas)  
│   ├── Infografis Publik & Peta Spasial (GIS Terbuka)  
│   ├── Katalog Produk UMKM (Digital Twin Showroom)  
│   ├── Info Kegiatan & Pelatihan (Lini Masa / Kalender Binaan)  
│   ├── Layanan Fasilitasi & Bantuan Pemerintah (Permen No. 1/2026)  
│   ├── Klinik Pelayanan & Konsultasi Usaha  
│   └── Pusat Bantuan (FAQ & Kontak Hotline Dinas)  
│  
└── DASHBOARD OPERASIONAL (Multi-Role Login: /dashboard)  
    ├── \[Role: Admin DISKUK Jabar / Eksekutif Provinsi\]  
    │   ├── Executive Summary (Macro Infographics & KPI Pimpinan)  
    │   ├── Canvas Analitik (Custom Pivot & Grouping KBLI/Wilayah)  
    │   ├── Geodashboard GIS Multi-Layer (Tingkat Kab/Kota s.d. Titik)  
    │   ├── Master Basis Data Tabular (47 Atribut SIDT \+ 15 Atribut Jabar)  
    │   ├── Panel Kurasi & Penetapan Talent Scouting (SK Berita Acara)  
    │   └── Monitoring Progres Program Akselerasi (Talent Lab s.d. Global)  
    │  
    ├── \[Role: Admin / Enumerator Kabupaten/Kota\]  
    │   ├── Dasbor Kewilayahan (Capaian Pendaftaran vs Target Kuota)  
    │   ├── Manajemen Data Lapangan & Verifikasi Legalitas  
    │   └── Formulir Pengajuan Calon Talenta ke Tingkat Provinsi  
    │  
    ├── \[Role: Pendamping / Coach Lapangan\]  
    │   ├── Dasbor Binaan Aktif (Daftar UMKM Fase Accelerator)  
    │   ├── Verifikasi Laporan KPI Mingguan (Review Bukti Nota/Omzet)  
    │   └── Rekomendasi Kelayakan Pitching / Investment Day  
    │  
    └── \[Role: Pelaku UMKM (Mobile PWA View)\]  
        ├── Beranda Usaha & Profil Bisnis  
        ├── Talent Passport Digital (Kartu QR Code & Radar Scorecard)  
        ├── Formulir Laporan KPI Mingguan (Offline-First Ready)  
        └── Pengaturan Portofolio Produk (Digital Twin Uploader)

2\. SPESIFIKASI DETAIL MODUL & FITUR UNTUK PROTOTYPE

#### **MODUL 1:** AUTENTIKASI & MULTI-ROLE SWITCHER (DEMO CONTROL)

**Tujuan Demo:** Memperlihatkan bagaimana platform melayani berbagai aktor secara aman dengan antarmuka yang dipersonalisasi (next dev, bikin untuk super admin dulu aja)

**Spesifikasi Layar & Interaksi:**

1. **Layar Login Utama:** Tampilan dirancang bersih, mencerminkan identitas resmi Pemprov Jabar, dan mematuhi panduan antarmuka Portal Jabarprov.  
* **Komponen Form Autentikasi:**  
  * Header Logo: Logo Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat bersanding dengan identitas *Portal Integrasi Satu Data SIDT Jabar*  
  * Field Input Email/Username: Mendukung pengisian alamat email resmi kedinasan (@jabarprov.go.id) atau Nomor Induk Berusaha (NIB) bagi pelaku usaha, Field Kata Sandi: Dilengkapi tombol interaktif untuk menampilkan/menyembunyikan sandi (*Show/Hide Password Toggle*) dan tautan *"Lupa Kata Sandi?"*.  
  * Tombol Masuk Utama: Tombol kontras bertuliskan *"Masuk ke Dashboard"*.  
* **Keamanan & Kepatuhan Visual (Security Badges):**  
  * Di bawah formulir disematkan teks kepatuhan: *"Sistem ini dilindungi enkripsi AES-256 dan tunduk pada UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)"*.  
  * Tombol opsi SSO Pemprov: \[Masuk Menggunakan Jabar Digital Services / SSO Jabar\].  
  * CAPTCHA  
2. **Widget Pengalih Peran (*Floating Multi-Role Switcher*):** Komponen khusus purwarupa (*Demo Control Widget*) yang selalu tampil di pojok kanan bawah layar untuk memandu skenario presentasi di hadapan pimpinan dinas:  
* **Bentuk & Penempatan Antarmuka:**  
  1. Widget melayang (*floating pill/card*) dengan label: Mode Pengujian Prototipe: Pilih Peran Aktif.  
* **Pilihan Tombol Peran Cepat (*One-Click Switch*):**  
  1. **\[Eksekutif / Admin DISKUK Provinsi\]:**  
     * *Akun Demo:* admin@diskuk.jabarprov.go.id  
     * *Dampak Interaksi:* Mengarahkan ke Dashboard Utama dengan navigasi lengkap (Executive Infographics makro, Canvas Analitik 27 Kab/Kota, Geodashboard level provinsi, dan penerbitan Berita Acara Scouting)  
  2. **\[Admin Dinas KUK Kabupaten/Kota\]:**  
     * *Akun Demo:* admin.subang@jabarprov.go.id  
     * *Dampak Interaksi:* Dasbor otomatis terfilter khusus data wilayah terpilih (contoh: Kabupaten Subang). Menampilkan kuota pendataan lokal dan tombol *"Ajukan ke Talent Scouting"* pada data tabular  
  3. **\[Pendamping / Coach Wilayah\]:**  
     * *Akun Demo:* coach.pendamping@jabarprov.go.id  
     * *Dampak Interaksi:* Membuka dasbor operasional pendampingan, menampilkan antrean verifikasi bukti nota mingguan pelaku usaha fase *Accelerator*, dan form input catatan saran.  
  4. **\[Pelaku UMKM (Mobile PWA Simulator)\]:**  
     * *Akun Demo:* wawan.leathercraft@gmail.com  
     * *Dampak Interaksi:* Mengubah tampilan layar menjadi simulasi *frame* ponsel pintar (*mobile view*), memuat profil usaha, kartu Talent Passport ber-QR Code, dan formulir setor omzet mingguan offline-first  
3. **Indikator Status Profil & Navigasi Pengguna**  
* **User Profile Header (Pojok Kanan Atas Dasbor):**  
  * Menampilkan Avatar Pengguna, Nama Lengkap, Lencana Peran (*Role Badge* berwarna: Biru Tua \= Provinsi, Biru Muda \= Kab/Kota, Hijau \= Pendamping, Emas \= UMKM), serta Nama Instansi/Usaha.  
  * Menu Dropdown Profil:  
    * Pengaturan Akun & Keamanan  
    * Log Aktivitas Sesi (Audit Trail)  
    * Keluar (Logout)

#### **MODUL 2:** INFOGRAFIS MAKRO & CANVAS ANALITIK DINAMIS

**Tujuan Demo:** Menyajikan visualisasi data eksekutif untuk pengambilan keputusan berbasis data (*data-driven policy*)

**Spesifikasi Layar & Interaksi:**

1. **Executive Metric Cards (Highlight Angka Riil):**  
   1. Total UMKM: 5.429.638 unit (berdasarkan integrasi data SIDT).  
   2. Distribusi Skala (PP No. 7/2021): Usaha Mikro: 5.417.420 (99,92%), Usaha Kecil: 9.550, Usaha Menengah: 2.668.  
   3. Kepemilikan NIB (Terintegrasi OSS-RBA): Persentase ber-NIB vs Belum ber-NIB.  
   4. Demografi: Persentase Tenaga Kerja Berdasarkan Gender (Laki-laki vs Perempuan).  
2. **Penerapan Aspek Permen UMKM No. 2 Tahun 2026 (Fitur Wajib Baru):**  
   1. Tambahkan tabulasi visual untuk memetakan tingkat perkembangan usaha berdasarkan 5 aspek regulasi:  
   2. Aspek Legalitas dan Formalitas (Kepemilikan NIB, NPWP Usaha, Izin Edar).  
   3. Aspek Manajemen dan Tata Kelola Usaha (Pemisahan rekening pribadi/usaha, SOP tertulis).  
   4. Aspek Pemasaran dan Digitalisasi (Pemanfaatan e-commerce, media sosial bisnis).  
   5. Aspek Keuangan dan Akses Pembiayaan (Pencatatan pembukuan, pinjaman perbankan/KUR).  
   6. Aspek Kemitraan dan Jejaring Usaha (Rantai pasok industri, kontrak offtaker).  
3. **Canvas Analitik (Interactive Pivot Tool):**  
   1. Panel Kontrol  
   2. Metrik: Jumlah UMKM, Total Omzet, Tenaga Kerja.  
   3. Pengelompokan: Berdasarkan KBLI 5 Digit (Sektoral), Skala Usaha, Kabupaten/Kota, Kecamatan, Kelurahan/Desa.  
   4. Pilihan Visualisasi: Grafik Batang (Bar Chart), Batang Bertumpuk (Stacked Bar), atau Diagram Donat (Donut Chart).  
   5. Tabel Agregasi Otomatis: Menampilkan kolom Kelompok, Jumlah, Share (%), dan Kumulatif (%) yang langsung berubah begitu filter dipilih.  
   6. Tombol Ekspor Eksekutif: Tombol unduh instan: \[Export PDF Laporan\], \[Export Image PNG\], dan \[Export Slide PPT\] untuk bahan rapat pimpinan.

#### **MODUL 3:** GEODASHBOARD SPASIAL INTERAKTIF (GIS)

**Spesifikasi Layar & Interaksi:**

1. **Hierarki Peta Bertingkat (Drill-Down Navigation):**  
   1. Level 1 (Provinsi): Peta Choropleth 27 Kabupaten/Kota dengan gradasi warna sesuai kepadatan UMKM. Mengklik salah satu wilayah (misal: Kota Cimahi) otomatis memperbesar peta ke wilayah tersebut.  
   2. Level 2 (Kabupaten/Kota): Menampilkan batas administrasi kecamatan beserta pop-up ringkasan jumlah usaha lokal.  
   3. Level 3 (Kecamatan/Kelurahan): Menampilkan titik koordinat fisik usaha (pin marker) atau clustering bubble jika titik sangat padat.  
2. **Interaktivitas Pin & Pop-Up Card:**  
   1. Mengklik salah satu titik UMKM akan memunculkan kartu mengambang (Floating Modal) berisi:  
      1. Nama Usaha & Nama Pemilik.  
      2. Skala Usaha (Badge: Mikro / Kecil / Menengah).  
      3. KBLI 5 Digit & Kegiatan Utama (contoh: 14111 \- Industri Pakaian Jadi).  
      4. Realisasi Omzet Tahunan (Rp).  
      5. Status Sertifikasi (Badge Hijau: Halal Terverifikasi, PIRT, Hak Merek).  
      6. Status Talenta (contoh: Talent Pool \- Batch 1).  
      7. Tautan: \[Buka Profil Lengkap\]  
3. **Panel Kontrol Peta:** Toggle filter: Tampilkan Titik UMKM, Tampilkan Klaster KBLI, Tampilkan Sentra Industri, dan pemilihan Basemap (Street View / Satellite View).

#### **MODUL 4:** MANAJEMEN BASIS DATA TABULAR & TALENT SCOUTING ENGINE

**Tujuan Demo:** Menunjukkan integrasi 47 atribut SIDT nasional dengan 15 atribut regional Jabar serta mekanisme kurasi otomatis (*Talent Scouting*).

**Spesifikasi Layar & Interaksi:**

1. **Tabel Data Terintegrasi:**  
   1. Pencarian global berdasarkan NIK, NIB, Nama Usaha, atau Nama Pemilik.  
   2. Filter bertingkat: Wilayah administrasi, Klaster KBLI, Skala Usaha, Status Kepemilikan NIB.  
   3. Kolom Aksi per Baris: Tombol \[Lihat Detail\] dan tombol \[Ajukan ke Talent Scouting\].  
2. **Formulir Pengajuan Talent Scouting (Regional Parameter):**  
   1. Menampilkan data bawaan SIDT (Read-only: Nama Usaha, NIK terenkripsi, NIB, Omzet historis, Alamat).  
   2. Field Input Tambahan Operasional Jabar:  
      1. Kapasitas Produksi Bulanan (Satuan unit/kg).  
      2. Kesiapan Legalitas Lanjutan (Sertifikat Halal, BPOM/PIRT, HKI/Merek).  
      3. Tingkat Literasi Digital (Adopsi QRIS, Pencatatan Keuangan Digital).  
      4. Komitmen Keikutsertaan Kegiatan (Upload Surat Komitmen \- simulasi file upload).  
3. **Mesin Kalkulator Talenta Otomatis (Talent Index Score Calculator):**  
   1. Saat petugas menekan tombol \[Hitung Skor\], sistem menjalankan animasi kalkulasi berbasis pembobotan metodologi Kantor Perwakilan Bank Indonesia Jabar:  
      1. Aspek Finansial & Omzet (Bobot 25%)  
      2. Kesiapan Pasar & Produk (Bobot 25%)  
      3. Legalitas & Kepatuhan Usaha (Bobot 25%)  
      4. Kapasitas Pengelolaan & SDM (Bobot 25%)  
   2. Hasil Skor muncul seketika: Talent Index Score: 84.50 / 100.00 (Status: Direkomendasikan Masuk Talent Pool).  
4. **Panel Persetujuan Provinsi (DISKUK Approval):**  
   1. Admin Provinsi meninjau daftar nominasi yang telah dinilai, lalu menekan tombol \[Terbitkan Berita Acara & Masukkan ke Talent Pool\]. Status berubah otomatis menjadi talent\_status: Scouting.

#### **MODUL 5:** MONITORING EVALUASI KPI (MOBILE PWA OFFLINE-FIRST) **BARU**

**Tujuan Demo:** Memperlihatkan solusi pemantauan usaha di lapangan tanpa terhambat area susah sinyal (*blank spot*).

**Spesifikasi Layar & Interaksi:**

1. **Tampilan Mobile Pelaku Usaha (Frame Smartphone PWA):**  
* **Header Dasbor Peserta:**  
* Identitas Usaha: Nama Usaha, Nama Pengusaha, Status Tahap (Fase Accelerator \- Batch 1), dan Nama Pendamping/Coach pendamping.  
* Indikator Progres Program: Indikator tahapan mingguan interaktif (misal: *Minggu Ke-6 dari 12 Minggu Pendampingan*).  
* Banner Status Konektivitas:  
  * Badge Hijau: *"Terhubung \- Data Real-Time"*  
  * Badge Kuning: *"Mode Offline Aktif \- Laporan Akan Disimpan di Memori Ponsel"*.  
* **Formulir Laporan Kinerja Mingguan (Setiap Hari Jumat):**  
* Target KPI Mingguan (Otomatis tampil dari sistem rujukan, misal: Target Rp 15.000.000,-).  
* Input Realisasi Omzet Mingguan (Rp).  
* Input Jumlah Transaksi / Pesanan Produk dalam sepekan.  
* Unggah Bukti Transaksi: Kamera langsung ponsel atau galeri foto (foto buku kas catatan penjualan, foto nota faktur, atau tangkapan layar saldo dompet digital/QRIS).  
* Catatan Singkat Kendala Produksi/Pasar (contoh: *Kenaikan harga bahan baku kedelai atau keterlambatan pengiriman kemasan*).  
* Tombol Aksi: \[Kirim Laporan Kinerja Mingguan\].  
* **Simulasi Fitur Demo (Khusus Presentasi Prototipe):**  
* Sediakan toggle melayang (*Floating Demo Tool*): \[Simulasikan Koneksi Terputus (Offline)\].  
* Saat tombol ditekan dan form disubmit: Muncul pop-up notifikasi animasi: *"Koneksi internet tidak terdeteksi. Laporan berhasil diamankan di ponsel Anda. Sinkronisasi otomatis akan berjalan saat online."*  
* Ketika toggle ditekan kembali \[Simulasikan Koneksi Pulih (Online)\]: Muncul notifikasi sukses: *"Sinkronisasi Berhasil\! 1 Laporan Mingguan Telah Terkirim ke Server Provinsi."*.  
2. **Dasbor Verifikasi Pendamping (Coach Review Panel):**  
* **Antrean Laporan Masuk (*Review Queue*):**  
* Daftar pelaku usaha binaan yang telah menyetor laporan pekan berjalan.  
* Status Filter: Menunggu Persetujuan, Telah Disetujui, dan Belum Mengirimkan Laporan.  
* **Modal Pemeriksaan Bukti Fisik:**  
* Pratinjau foto bukti nota dengan fitur perbesaran gambar (*zoom preview*).  
* Perbandingan otomatis sistem: Realisasi Omzet vs Target KPI (menampilkan persentase pencapaian, misal: *Capaian 112% dari Target*).  
* **Catatan Saran Bimbingan Usaha & Verifikasi:**  
* Kolom catatan masukan dari pendamping untuk pelaku usaha.  
* Tombol: \[Tolak & Minta Perbaikan Bukti\] dan \[Setujui & Verifikasi Laporan\].  
* Grafik Real-Time: Garis tren Target KPI Mingguan vs Realisasi Nyata yang langsung terbarukan dan tercatat ke dasbor pimpinan dinas.  
* **Rekomendasi Kelayakan Pitching:**  
* Tombol rekomendasi bertahap: Jika UMKM konsisten mencapai target selama 4 pekan berturut-turut, pendamping dapat mengaktifkan centang \[Rekomendasikan ke Talent Investment Day / Champion\].  
3. **Dasbor Pemantauan Eksekutif DISKUK Jabar (Level Provinsi & Kab/Kota)**Tampilan analitik agregat untuk Kepala Dinas dan Kepala Bidang:  
* **Metrik Tren Kinerja Kolektif:**  
  * Rata-rata Kenaikan Omzet Pelaku Usaha Fase Accelerator (perbandingan data dasar SIDT vs realisasi mingguan).  
  * Tingkat Kepatuhan Laporan Mingguan (Target \> 95% kepatuhan setor laporan).  
* **Grafik Garis Pertumbuhan Interaktif (*Target vs Actual Realization*):**  
  * Sumbu X: Lini masa pekan (Minggu 1 s.d. Minggu 12).  
  * Garis Putus-putus: Target Rencana Agregat.  
  * Garis Tebal Hijau: Realisasi Penjualan Riil yang terverifikasi pendamping.  
* **Peta Sebaran Pelaku Usaha Bermasalah (*At-Risk Alert Map*):**  
  * Titik pin merah pada peta GIS untuk pelaku usaha yang mengalami penurunan omzet 30% selama dua pekan berturut-turut, memicu penugasan bimbingan teknis khusus oleh pendamping wilayah.

#### **MODUL 6:** TALENT PASSPORT, DIGITAL TWIN, & MATCHMAKING INVESTOR  **BARU**

**Tujuan Demo:** Memperlihatkan hasil akhir akselerasi (*output nyata*) berupa identitas digital dan akses pembiayaan formal bagi UMKM Champion.

**Spesifikasi Layar & Interaksi:**

1. **Layar Talent Passport & Portofolio Publik:**  
* **Header Identitas Usaha & Verifikasi QR:**  
* Penampil kartu identitas digital dengan badge status akselerasi (misal: UMKM Champion Jawa Barat \- Batch 1).  
* Kode QR dinamis ber-hash kriptografis unik (qr\_talent\_passport\_code) yang dapat diunduh (*Save as Image/PDF*).  
* Tombol verifikasi keaslian nirsangkal (*Cryptographic Signature Verification*) yang membuktikan bahwa data terikat langsung dengan basis data resmi DISKUK Jabar & SIDT.  
* **Radar Chart Business Scorecard (5 Dimensi Penilaian Bank Indonesia):**  
* Visualisasi bagan radar interaktif yang memetakan kapasitas riil usaha:  
  1. *Model Bisnis & Diferensiasi Produk* (Skala 0–100).  
  2. *Kapasitas Manajemen Keuangan & Profitabilitas* (Skala 0–100).  
  3. *Kesiapan Legalitas, Tata Kelola & SOP* (Skala 0–100).  
  4. *Kesiapan Digitalisasi & Akses Pasar PMSE* (Skala 0–100).  
  5. *Potensi Eskalasi & Dampak Rantai Pasok/TKDN* (Skala 0–100).  
* **Lencana Akreditasi & Kepatuhan Regulasi:**  
* Badge Hijau Emas: 100% Produk Dalam Negeri (PDN) Terverifikasi (Permen No. 3/2026).  
* Badge Biru: Tahapan Perkembangan: Siap Naik Kelas (Skor \>75% Permen No. 2/2026).  
* Badge Legalitas Aktif: NIB Terverifikasi OSS-RBA, Sertifikat Halal, PIRT/BPOM, dan Hak Merek (HKI).  
* **Showroom Digital Twin & Video Storytelling:**  
* Pemutar video terintegrasi: Video sinematik profil usaha (kisah pendirian, dampak penyerapan tenaga kerja lokal, dan alur proses produksi higienis).  
* Galeri foto multi-sudut beresolusi tinggi dengan spesifikasi ekspor.  
* Tab Spesifikasi Teknis: Dimensi produk, bahan baku lokal, kapasitas pasokan bulanan, dan sertifikasi uji laboratorium.  
* **Aksi Unduhan Dokumen Resmi:**  
* Tombol: \[Unduh Executive Summary & Business Scorecard (PDF)\].  
* Tombol: \[Unduh Katalog Ekspor Resmi (PDF)\].  
2. **Direktori Matchmaking Investor / Lembaga Pembiayaan:**  
* **Filter Kebutuhan Investasi & Kemitraan:**  
* Filter berdasarkan Rentang Kebutuhan Permodalan: \< Rp 50 Juta (Mikro), Rp 50 Juta \- Rp 500 Juta (Kecil/KUR), \> Rp 500 Juta (Ekspansi/Komersial).  
* Filter Berdasarkan Skema Kerja Sama:  
  * Penyaluran Kredit Perbankan / KUR / LPDB.  
  * Kemitraan Rantai Pasok Industri (Offtaker Contract).  
  * Penyertaan Modal / Equity Investment.  
  * Konsinyasi & Akses Pasar Global.  
* Filter Sektoral KBLI: Kuliner Kemasan, Fesyen & Tekstil, Kriya Kerajinan, Agribisnis, serta Manufaktur Ringan.  
* **Kartu Peluang Bisnis (*Deal Card*):**  
* Ringkasan profil usaha, nama jenama, dan domisili kabupaten/kota.  
* Metrik Kunci: Nilai *Talent Index Score*, Pertumbuhan Omzet Rata-rata Mingguan (data hasil Monev Accelerator), dan Margin Keuntungan.  
* Kebutuhan Dana / Kapasitas Pasok yang ditawarkan.  
* Tombol Aksi: \[Lihat Portofolio Lengkap\], \[Unduh Executive Summary & Pitch Deck PDF\] dan \[Ajukan Minat Kemitraan (LOI Digital)\].

#### **MODUL 7:** PORTAL LAYANAN PUBLIK & INFORMASI FASILITASI (PERMEN NO. 1/2026)  **BARU**

**Tujuan Demo:** Memperlihatkan bahwa portal ini menyediakan akses pelayanan terpadu bagi seluruh UMKM Jawa Barat sesuai regulasi bantuan pemerintah terbaru.

**Spesifikasi Layar & Interaksi:**

1. **Katalog Produk Publik:** Etalase produk UMKM Jawa Barat yang dapat dicari berdasarkan kategori kuliner, fesyen, kerajinan, dan agribisnis.  
   1. **Halaman Utama Katalog Publik (/katalog):**Halaman katalog dirancang dengan tata letak galeri modern, responsif, dan menerapkan standar keterbacaan inklusif (WCAG):  
* **Header & Pencarian:**  
  * Pencarian global (*Global Search Bar*): Mencari berdasarkan nama produk, nama jenama (*brand*), nama UMKM, atau kode KBLI 5 digit.  
  * Filter Cepat (*Quick Chips*): Kategori populer seperti Kuliner & Makanan Olahan, Fesyen & Tekstil, Kerajinan (Craft), Kecantikan & Herbal, dan Agribisnis.  
* **Sidebar Panel Filter Bertingkat:**  
  * **Wilayah Produksi:** Filter berbasis 27 Kabupaten/Kota di Jawa Barat.  
  * **Skala Usaha:** Pilihan skala usaha Mikro, Kecil, atau Menengah.  
  * **Status Binaan / Talenta:** Filter khusus untuk menampilkan UMKM Champion, Peserta Talent Lab/Accelerator, atau UMKM Ekspor.  
  * **Sertifikasi & Legalitas:** Kotak centang (*checkbox*) untuk filter Tersertifikasi Halal, Memiliki PIRT/BPOM, Merek Terdaftar (HKI), dan Tersertifikasi SNI.  
  * **Afirmasi & Regulasi Khusus:**  
    * Toggle 100% Produk Dalam Negeri (PDN) (Permen No. 3/2026).  
    * Toggle UMK Ramah Disabilitas (dikelola / mempekerjakan disabilitas \- Pasal 10 ayat 4 Permen No. 3/2026).  
* **Grid Kartu Produk (*Product Card Component*):**  
  * Foto produk utama (rasio 1:1, resolusi tinggi).  
  * Label/Badge Status:  
    * Badge Emas: Champion Jabar.  
    * Badge Hijau: 100% PDN Terverifikasi.  
    * Badge Biru: Halal Indonesia / PIRT.  
  * Nama Produk & Nama Usaha/Produsen.  
  * Asal Wilayah (contoh: *Kabupaten Subang, Jawa Barat*).  
  * Rentang Harga Satuan (Rp) & Minimal Pembelian (*Minimum Order Quantity / MOQ*).  
  * Tombol Aksi: \[Lihat Detail Produk\] dan ikon cepat \[Hubungi Produsen via WhatsApp\].  
  2. **Halaman Rinci Produk & Showroom:** Saat kartu produk diklik, sistem membuka halaman portofolio mendalam:  
* **Galeri Multimedia:**  
  * Penampil foto multi-sudut (*Multi-angle image carousel*): Foto kemasan depan, belakang (informasi nilai gizi/komposisi), sertifikasi kemasan, dan foto proses produksi higienis.  
  * Pemutar video terintegrasi: Video singkat cerita produk (*storytelling video*) mengenai proses pembuatan dan dampak sosial terhadap petani/pengrajin lokal.  
* **Spesifikasi Teknis & Kapasitas Produksi:**  
  * Tabel rincian spesifikasi: Dimensi, berat bersih, masa kedaluwarsa (*shelf life*), bahan baku utama, dan kandungan nilai TKDN (%).  
  * Informasi Pasokan Industri: Kapasitas produksi bulanan, ketersediaan stok reguler, kapasitas pemenuhan pesanan besar (*offtaker supply capacity*), dan waktu tunggu produksi (*lead time*).  
* **Kartu Integritas Legalitas Usaha:**  
  * Status NIB terverifikasi OSS RBA.  
  * Nomor sertifikat Halal (BPJPH), nomor izin edar PIRT/BPOM, dan status HKI Merek.  
  * Tautan unduh: \[Unduh Lembar Spesifikasi Teknis / Katalog Ekspor (PDF)\].  
* **Aksi Matchmaking & Transaksi Kemitraan:**  
  * Tombol Utama: \[Ajukan Minat Kemitraan / Order B2B\] (membuka form Letter of Intent digital).  
  * Tombol Sekunder: \[Kontak Penjualan Resmi\] (menghubungkan ke kontak terverifikasi tanpa perantara calo).  
  3. **Dasbor Pengelolaan Katalog (Sudut Pandang Pelaku Usaha \- Multi-Role):** Fitur di dalam dashboard login pelaku UMKM untuk mengelola etalasenya secara mandiri:  
* **Formulir Tambah/Ubah Produk Digital Twin:**  
  * Pengisian nama produk, deskripsi pemasaran, kategori sektoral KBLI, dan penentuan harga retail vs harga grosir/B2B.  
  * Upload aset: Foto resolusi tinggi (maksimal 5 foto per produk) dan link video promosi.  
  * Deklarasi Mandiri Asal Bahan Baku: Form isian persentase bahan baku lokal guna verifikasi kepatuhan Produk Dalam Negeri (PDN).  
* **Pemberitahuan Kepatuhan PMSE (Permen No. 3/2026):**  
  * Tampilan status kurasi dinas: \[Menunggu Verifikasi Kurasi\]  \[Tayang di Katalog\]  \[Rekomendasi Marketplace Mitra\].  
  * Pengingat larangan manipulasi transaksi dan kewajiban menjaga standar mutu barang.

2. **Info Kegiatan & Pelatihan (Kalender Interaktif):**  
   1. **Jadwal pelatihan dinas, kurasi pameran, fasilitasi legalitas, dan bimbingan teknis.**  
   2. **Tombol aksi:** \[Daftar Kegiatan\] yang langsung mengaitkan data profil UMKM.  
   3. **Halaman Utama Kegiatan Publik:** Halaman ini dirancang intuitif dengan dua mode tampilan utama: Tampilan Kalender (Calendar View) dan Tampilan Kartu Lini Masa (Timeline/List View):  
* **Header Kontrol & Mode Tampilan:**  
  * Toggle Mode Tampilan: \[Kalender Bulanan\] | \[Daftar Lini Masa / Agenda\].  
  * Navigasi Bulan & Tahun: Pemilih bulan dinamis dengan penanda tanggal hari ini.  
* **Filter (*Smart Filter Bar*):**  
  * **Kategori Kegiatan:**  
    * Pelatihan & Bimtek SDM (Manajemen, Keuangan, Ekspor).  
    * Fasilitasi Sertifikasi Gratis (Halal, PIRT, HKI, UMKU).  
    * Pameran & Promosi Dagang (Lokal, Nasional, Global Exposure).  
    * Program Akselerasi UMKM Talent (Tahapan Scouting, Talent Lab 30 Hari, Coaching 90 Hari).  
    * Literasi Digital & PMSE (Optimasi Toko Online, Standardisasi KBD E-commerce).  
  * **Penyelenggara:** DISKUK Provinsi Jawa Barat, Dinas KUK Kabupaten/Kota (Dropdown 27 Kab/Kota), atau Kementerian UMKM / Mitra Strategis (BI/Perbankan).  
  * **Metode Pelaksanaan:** \[Semua\], \[Daring / Webinar\], \[Luring / Tatap Muka\], \[Hybrid\].  
  * **Afirmasi Khusus:** Checkbox Ramah Penyandang Disabilitas (kegiatan dengan fasilitas juru bahasa isyarat / aksesibilitas lokasi).  
* **Tampilan Kalender Interaktif (*Calendar Matrix Component*):**  
  * Kotak tanggal menampilkan badge warna sesuai kategori (misal: Biru \= Pelatihan, Hijau \= Sertifikasi, Emas \= UMKM Talent Lab, Ungu \= Pameran).  
  * *Hover Popover Card:* Mengarahkan kursor ke agenda menampilkan: Judul Kegiatan, Lokasi/Platform, Kuota Peserta (misal: *Tersisa 15 dari 50 Kursi*), dan Batas Akhir Registrasi.  
* **Tampilan Lini Masa (*Timeline View Component*):**  
  * Garis waktu vertikal (*stepper*) yang mengelompokkan kegiatan berdasarkan status:  
    * Sedang Berjalan (Active Now): Menampilkan tautan presensi atau ruang streaming bagi peserta terdaftar.  
    * Pendaftaran Dibuka (Open Registration): Menampilkan tombol aksi pendaftaran.  
    * Segera Datang (Upcoming): Opsi tombol *"Ingatkan Saya via WhatsApp/Email"*.  
    * Selesai & Dokumentasi (Archived): Galeri ringkasan luaran kegiatan dan materi unduhan.  
  4. **Modal Detail & Formulir Pendaftaran Kegiatan:** Saat pengguna mengklik agenda atau tombol "Daftar Sekarang", sistem memunculkan alur pendaftaran terintegrasi:  
* **Panel Informasi Rinci Kegiatan:**  
  * Deskripsi materi silabus, profil narasumber/instruktur, fasilitas yang didapat (sertifikat kompetensi, uang saku/konsumsi bila ada, modul materi).  
  * Syarat & Kualifikasi: Skala usaha minimum, cakupan wilayah, kepemilikan NIB, dan kelengkapan dokumen pendukung.  
* **Formulir Pendaftaran Terintegrasi (*Pre-filled System*):**  
  * Input NIK / NIB: Sistem otomatis menarik data pengusaha, nama bisnis, kode KBLI, dan alamat dari database SIDT tanpa pengisian manual yang berulang.  
  * Validasi Kelayakan Khusus (Permen No. 1/2026): Jika kegiatan berupa beasiswa/bantuan, pengguna mencentang pakta integritas *Non-ASN/TNI/Polri*.  
  * Kebutuhan Aksesibilitas: Checkbox konfirmasi jika pendaftar merupakan penyandang disabilitas (tuli, netra, daksa) agar disiapkan pendampingan khusus.  
* **Tiket Pendaftaran Digital (*E-Pass Activity*):**  
  * Sistem menerbitkan tiket pendaftaran ber-**QR Code Presensi Unik**.  
  * Notifikasi instan via WhatsApp Gateway memuat jadwal, tautan lokasi Google Maps atau tautan ruang daring Zoom/Google Meet.  
  5. **Dasbor Penyelenggara & Monitoring Kelas (Sudut Pandang DISKUK / Instruktur)** Fitur pada area terotentikasi:  
* **Manajemen Pendaftar & Kurasi Peserta:**  
  * Tabel seleksi calon peserta: Filter berdasarkan *Talent Index Score*, kepatuhan administrasi, dan asal wilayah untuk memastikan pemerataan keterwakilan 27 Kab/Kota.  
  * Aksi Batch: \[Terima Peserta\], \[Tolak/Daftar Tunggu\], \[Ekspor Daftar Hadir (XLSX)\].  
* **Presensi Digital & Pelacak Kehadiran (*Attendance Tracking*):**  
  * Pemindai QR Code Presensi pada hari pelaksanaan (melalui kamera smartphone petugas/panitia).  
  * Menghitung persentase kehadiran harian secara real-time (khususnya untuk *Talent Lab 30 Hari*).  
* **Penerbitan E-Sertifikat Terverifikasi:**  
  * Sistem otomatis menghasilkan e-sertifikat ber-QR Code validasi resmi DISKUK Jabar bagi peserta yang memenuhi batas minimal kehadiran (80%) dan menyelesaikan tugas.  
  * **Dampak Database Otomatis:** Kepemilikan sertifikat ini otomatis memperbarui atribut bukti\_pelatihan\_manajemen (Aspek Manajemen) dan data capaian *Peningkatan Kapasitas SDM* pada perhitungan Indeks Pengembangan UMKM (IP-UMKM).

3. **Modul Fasilitasi & Bantuan Pemerintah (Rujukan Permen UMKM No. 1 Tahun 2026):**  
   1. Menu informasi dan pengajuan 8 bentuk bantuan pemerintah, menyajikan kartu interaktif (*Card Grid*) untuk masing-masing kluster bantuan:  
      1. **Pemberian Penghargaan:** Fasilitasi apresiasi bagi PMKM, wirausaha berprestasi, dan lembaga yang memajukan UMKM. Bentuk: Uang pembinaan atau piagam/trofi.  
      2. **Pemberian Beasiswa:** Akses beasiswa pelatihan vokasi, sertifikasi profesi ekspor, atau pendidikan bisnis.  
      3. **Bantuan Operasional:** Dukungan biaya operasional kegiatan pendampingan bagi pendamping usaha, inkubator, atau kelompok UMK.  
      4. **Bantuan Sarana/Prasarana Produksi:** Penyediaan alat/mesin pengolahan, peralatan kemasan higienis, atau perbaikan teknologi produksi.  
      5. **Bantuan Sarana/Prasarana Pemasaran:** Fasilitasi stan pameran dagang (nasional/internasional), etalase promosi, dan gerai pameran.  
      6. **Bantuan Revitalisasi / Pembangunan Gedung:** Bantuan fisik perbaikan rumah produksi bersama, sentra UMKM, atau kios usaha binaan.  
      7. **Bantuan Permodalan / Pembiayaan:** Bantuan stimulan modal kerja dan fasilitasi pembiayaan non-bunga bagi usaha mikro rintisan.  
      8. **Bantuan Pemerintah Lainnya:** Skema bantuan khusus darurat atau penugasan strategis kepala daerah.  
   2. **Filter Interaktif & Bentuk Bantuan (Pasal 4 ayat 2\)**  
      1. Toggle Bentuk Bantuan: \[Semua\], \[Bantuan Uang\], \[Bantuan Barang\], \[Bantuan Jasa\].  
      2. Indikator Kuota & Masa Pendaftaran: Menampilkan progress bar sisa kuota penerima dan countdown timer batas akhir pengajuan usulan.

4. **Klinik Pelayanan & Konsultasi Usaha:** Formulir pengajuan konsultasi pendampingan hukum, kemasan produk, dan sertifikasi usaha.  
   1. **Halaman Depan Klinik Konsultasi Publik:** Halaman pengenalan layanan konsultasi yang bersih, interaktif, dan mudah dipahami oleh pelaku usaha:  
* **Pilihan 6 Poli / Bidang Konsultasi Usaha:**  
  * *Poli Legalitas & Standarisasi Produk:* Konsultasi NIB (OSS-RBA), Sertifikasi Halal, PIRT, BPOM, Sertifikat PB UMKU, dan Pendaftaran HKI Merek\[cite: 2, 6\].  
  * *Poli Manajemen & Keuangan Usaha:* Pemisahan keuangan pribadi vs usaha, penyusunan laporan laba rugi/neraca, SOP produksi, dan fasilitasi KUR/LPDB.  
  * *Poli Pemasaran & Transformasi Digital:* Pemanfaatan *marketplace*, strategi promosi konten, adopsi QRIS, dan kurasi katalog ekspor.  
  * *Poli Advokasi & Mediasi PMSE (Permen No. 3/2026):* Layanan konsultasi hukum kemitraan e-commerce, telaah standar klausul minimal KBD, aduan perubahan tarif tanpa pemberitahuan 90 hari, dan pemulihan akun usaha.  
  * *Poli Akses Bantuan Pemerintah (Permen No. 1/2026):* Bimbingan penyusunan proposal, verifikasi syarat non-ASN/TNI/Polri, penyusunan RAB, serta panduan SPJ/BAST.  
  * *Poli Inklusif & Disabilitas:* Layanan afirmatif khusus wirausaha penyandang disabilitas untuk pendampingan adaptif alat produksi dan akses pasar.  
* **Statistik Layanan & Profil Pendamping:**  
  * Penghitung metrik: *Total Konsultasi Selesai, Waktu Respons Rata-rata (\<24 Jam), dan Tingkat Kepuasan Pelaku Usaha (CSAT)*.  
  * Daftar Konsultan/Coach Siaga: Menampilkan nama konsultan, keahlian, afiliasi (PLUT/Dinas/Praktisi), dan ketersediaan jadwal.  
  2. **Formulir Pengajuan Konsultasi & Advokasi:** Formulir dinamis (*Dynamic Multi-Step Form*) dengan penarikan data otomatis:  
* **Langkah 1: Identitas & Profil Usaha:**  
  * Pengisian NIB / NIK: Sistem otomatis memvalidasi ke basis data SIDT untuk menarik nama usaha, skala, wilayah kab/kota, dan kode KBLI tanpa perlu mengetik ulang.  
* **Langkah 2: Pemilihan Topik & Gejala Kendala:**  
  * Dropdown Bidang Konsultasi (Poli 1–6).  
  * Deskripsi permasalahan yang dihadapi.  
  * Lampiran berkas pendukung (misal: draf kontrak kemitraan digital, surat penolakan kredit, foto dokumen kemasan, atau surat sanksi platform e-commerce).  
* **Langkah 3: Preferensi Metode Konsultasi:**  
  * Pilihan Moda: \[Daring / Video Conference\] atau \[Tatap Muka / Datang ke PLUT / Dinas Kab/Kota\].  
  * Kalender interaktif pemilihan tanggal dan slot waktu konsultasi.  
* **Langkah 4: Konfirmasi & Tiket Digital:**  
  * Penerbitan **Nomor Registrasi Tiket Konsultasi** (misal: KLN-2026-09-0012) yang terkirim otomatis ke notifikasi WhatsApp pelaku usaha.  
  3. **Dasbor Pengelolaan Konsultasi (Sudut Pandang Pendamping / Dinas):** Tampilan pada dashboard internal:  
* **Tabel Antrean Tiket Masuk (Kanban & List View):**  
  * Kolom status: Tiket Masuk  Jadwal Ditetapkan  Sesi Berjalan  Tindak Lanjut Rekomendasi  Selesai.  
  * Penanda Prioritas: Badge merah untuk *Aduan Mediasi PMSE Mendesak* (sanksi/pemutusan sepihak) dan badge biru untuk *Konsultasi Reguler*.  
* **Ruang Sesi Konsultasi & Lembar Rekomendasi:**  
  * Tautan ruang temu video (*Video Call Embedded / Google Meet Link*).  
  * Lembar Catatan Pendamping (*Consultation Minutes*):  
    * Diagnosis kelemahan usaha (berdasarkan indikator 5 aspek Permen No. 2/2026).  
    * Rencana Aksi (*Action Plan*) yang wajib dilakukan pelaku usaha.  
    * Rekomendasi program intervensi: Tombol langsung rujuk ke \[Program Bantuan Sarpras\], \[Pelatihan Vokasi\], \[Mediasi Kementerian/SAPA UMKM\], atau \[Kurasi Talent Lab\].  
* **Integrasi Hasil ke Profil Basis Data UMKM:**  
  * Setelah sesi ditutup, poin kepatuhan/peningkatan otomatis terhubung ke skema penilaian indikator perkembangan usaha UMKM di sistem utama.

5. **FAQ & Kontak Hotline:** Pusat tanya jawab seputar program dan tombol WhatsApp narahubung dinas.
