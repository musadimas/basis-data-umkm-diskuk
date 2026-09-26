# Requirements purwarupa Basis Data UMKM DISKUK Jabar

Sumber: [Brief Fitur](https://docs.google.com/document/d/1FG6eZ2b94300R_FnO_Z09JE-pqo6vBAHIqlOZSSHuSc/edit?tab=t.0), dibaca 26 September 2026. Dokumen ini mengubah **warna highlight pada brief** menjadi ruang lingkup kerja. Status “sudah ada” berasal dari brief dan belum merupakan hasil audit implementasi repo.

## Aturan prioritas dan ruang lingkup

| Highlight di brief | Arti | Perlakuan di dokumen ini |
| --- | --- | --- |
| Hijau | Sudah ada | Tidak masuk pekerjaan baru; dicatat sebagai acuan integrasi. |
| Kuning | Belum ada, *must have* | Dikerjakan pada pengembangan sekarang. |
| Merah | Belum ada, *nice to have* | Dicatat untuk pengembangan berikutnya. |
| Tanpa highlight | Judul, tujuan, sitemap, atau konteks | Memberi struktur, tetapi tidak otomatis menambah prioritas. |

Sitemap brief membedakan **portal publik** (beranda, infografis/peta, katalog, kegiatan, fasilitasi, klinik, FAQ) dari **dashboard operasional** (provinsi, kabupaten/kota, pendamping, pelaku UMKM). Prioritas fitur di bawah tetap mengikuti highlight pada spesifikasi detail, bukan seluruh entri sitemap. Catatan eksplisit brief untuk Modul 1 adalah **“next dev, bikin untuk super admin dulu aja”**; pengalih peran dan akun demo lintas peran masuk tahap berikutnya.

## Must have — dikerjakan sekarang

### M1. Autentikasi dan profil

- **M1-01 — Form autentikasi.** Input email/username menerima alamat kedinasan `@jabarprov.go.id` atau NIB pelaku usaha. Field kata sandi mempunyai kontrol tampil/sembunyi dan tautan **“Lupa Kata Sandi?”**.
- **M1-02 — CAPTCHA.** Sediakan CAPTCHA pada alur login sesuai butir kuning di brief.
- **M1-03 — Identitas pengguna di dashboard.** Header kanan atas menampilkan avatar, nama lengkap, nama instansi/usaha, dan lencana peran: biru tua untuk provinsi, biru muda untuk kabupaten/kota, hijau untuk pendamping, emas untuk UMKM. Untuk tahap admin pertama, tampilkan peran yang benar bagi pengguna yang tersedia; tampilan peran lain mengikuti saat akunnya tersedia.
- **M1-04 — Menu profil.** Dropdown menyediakan **Pengaturan Akun & Keamanan**, **Log Aktivitas Sesi (Audit Trail)**, dan **Keluar (Logout)**.

### M2. Infografis dan canvas analitik

- **M2-01 — Ekspor eksekutif.** Dari canvas analitik, pengguna dapat mengunduh **PDF laporan**, **PNG gambar**, dan **PPT slide** untuk bahan rapat pimpinan. Hasil ekspor merepresentasikan tampilan/filter analitik yang sedang dipilih.

### M3. Geodashboard spasial

- **M3-01 — Kartu detail titik UMKM.** Klik pin UMKM membuka kartu mengambang berisi nama usaha dan pemilik, skala Mikro/Kecil/Menengah, KBLI 5 digit beserta kegiatan utama, omzet tahunan dalam rupiah, status sertifikasi (Halal, PIRT, hak merek), status talenta, dan tautan **“Buka Profil Lengkap”**.

### M4. Basis data tabular dan Talent Scouting

- **M4-01 — Aksi tabel.** Tiap baris data terintegrasi menyediakan **“Lihat Detail”** dan **“Ajukan ke Talent Scouting”**.
- **M4-02 — Form nominasi.** Form pengajuan menampilkan data SIDT sebagai *read-only*: nama usaha, NIK terenkripsi, NIB, omzet historis, dan alamat. Petugas dapat mengisi kapasitas produksi bulanan (unit/kg), kesiapan legalitas lanjutan (Halal, BPOM/PIRT, HKI/merek), literasi digital (QRIS dan pencatatan keuangan digital), serta komitmen keikutsertaan kegiatan dengan simulasi unggah surat komitmen.
- **M4-03 — Talent Index Score.** Tombol **“Hitung Skor”** menjalankan kalkulasi dengan empat aspek berbobot masing-masing 25%: finansial/omzet, kesiapan pasar/produk, legalitas/kepatuhan, dan kapasitas pengelolaan/SDM. Tampilkan nilai pada skala 0–100 dan status rekomendasi, dengan contoh di brief `84.50 / 100.00 — Direkomendasikan Masuk Talent Pool`; animasi kalkulasi termasuk dalam interaksi yang diminta.
- **M4-04 — Persetujuan provinsi.** Admin provinsi dapat meninjau nominasi yang telah dinilai, memakai aksi **“Terbitkan Berita Acara & Masukkan ke Talent Pool”**, lalu sistem mengubah `talent_status` menjadi `Scouting` sesuai teks brief.

### M5. Monitoring KPI mingguan melalui mobile PWA

- **M5-01 — Beranda peserta.** Tampilan mobile menunjukkan nama usaha, nama pengusaha, fase/batch program, pendamping, dan progres minggu pendampingan (contoh: minggu ke-6 dari 12).
- **M5-02 — Status koneksi.** Banner membedakan **“Terhubung - Data Real-Time”** dari **“Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel”**. Laporan yang dikirim saat offline harus tersimpan lokal dan tersinkron ketika koneksi pulih; simulasi toggle presentasi diprioritaskan terpisah di *nice to have*.
- **M5-03 — Laporan kinerja mingguan.** Form untuk pelaporan setiap Jumat menampilkan target KPI mingguan dari sistem rujukan, input realisasi omzet (Rp), jumlah transaksi/pesanan, foto bukti dari kamera atau galeri, catatan kendala produksi/pasar, dan aksi **“Kirim Laporan Kinerja Mingguan”**.
- **M5-04 — Antrean verifikasi pendamping.** Pendamping melihat peserta binaan yang mengirim laporan pekan berjalan, dengan filter **Menunggu Persetujuan**, **Telah Disetujui**, dan **Belum Mengirimkan Laporan**.
- **M5-05 — Pemeriksaan dan keputusan.** Pemeriksa dapat memperbesar foto bukti, melihat persentase realisasi omzet terhadap target KPI, menulis catatan saran, serta memilih **“Tolak & Minta Perbaikan Bukti”** atau **“Setujui & Verifikasi Laporan”**.
- **M5-06 — Tren dan rekomendasi.** Tampilkan grafik target KPI mingguan versus realisasi terverifikasi yang diperbarui pada dashboard pimpinan. Jika UMKM mencapai target empat pekan berturut-turut, pendamping dapat menandai **“Rekomendasikan ke Talent Investment Day / Champion”**.

### M6. Talent Passport dan portofolio

- **M6-01 — Kartu identitas dan verifikasi.** Tampilkan kartu Talent Passport dengan badge status akselerasi, QR unik berbasis `qr_talent_passport_code` yang bisa diunduh sebagai gambar/PDF, serta aksi verifikasi keaslian berbasis tanda tangan kriptografis terhadap data resmi DISKUK Jabar dan SIDT.
- **M6-02 — Business Scorecard.** Radar chart interaktif memakai skala 0–100 untuk lima dimensi: model bisnis/diferensiasi produk; manajemen keuangan/profitabilitas; legalitas/tata kelola/SOP; digitalisasi/akses pasar PMSE; serta eskalasi/dampak rantai pasok/TKDN.
- **M6-03 — Lencana.** Tampilkan status 100% PDN terverifikasi, tahap **“Siap Naik Kelas”** (contoh skor >75% pada brief), dan legalitas aktif (NIB OSS-RBA, Halal, PIRT/BPOM, HKI/merek) sesuai data yang tersedia.
- **M6-04 — Showroom Digital Twin.** Portofolio mendukung video profil usaha, galeri foto multi-sudut, dan tab spesifikasi teknis yang memuat dimensi produk, bahan baku lokal, kapasitas pasokan bulanan, dan sertifikasi uji laboratorium.
- **M6-05 — Unduhan.** Sediakan **“Unduh Executive Summary & Business Scorecard (PDF)”** dan **“Unduh Katalog Ekspor Resmi (PDF)”**.

### M7. Portal layanan publik

#### Katalog produk

- **M7-01 — Halaman `/katalog`.** Katalog publik responsif menampilkan produk UMKM Jawa Barat dalam galeri yang mudah dibaca. Pencarian mencakup nama produk, jenama, UMKM, atau KBLI 5 digit; *quick chips* memuat Kuliner & Makanan Olahan, Fesyen & Tekstil, Kerajinan, Kecantikan & Herbal, dan Agribisnis.
- **M7-02 — Filter katalog.** Pengunjung dapat memfilter 27 kabupaten/kota, skala Mikro/Kecil/Menengah, status Champion/Talent Lab atau Accelerator/UMKM Ekspor, sertifikasi Halal/PIRT atau BPOM/HKI/SNI, 100% PDN, dan UMK ramah disabilitas.
- **M7-03 — Kartu produk.** Setiap kartu menampilkan foto utama 1:1, badge Champion/PDN/Halal atau PIRT, nama produk dan produsen, asal wilayah, rentang harga, MOQ, serta aksi **“Lihat Detail Produk”** dan **“Hubungi Produsen via WhatsApp”**.
- **M7-04 — Detail produk.** Halaman detail memuat foto multi-sudut dan video cerita produk; spesifikasi dimensi, berat bersih, masa kedaluwarsa, bahan baku, TKDN; kapasitas produksi bulanan, stok, kapasitas pesanan besar, *lead time*; status/nomor NIB, Halal, PIRT/BPOM, HKI; serta unduhan lembar spesifikasi/katalog ekspor PDF.
- **M7-05 — Kontak dan minat kemitraan.** Detail produk mempunyai **“Ajukan Minat Kemitraan / Order B2B”** yang membuka formulir LOI digital dan **“Kontak Penjualan Resmi”** ke kontak terverifikasi.
- **M7-06 — Pengelolaan katalog oleh pelaku UMKM.** Form tambah/ubah produk menerima nama, deskripsi, kategori KBLI, harga retail dan grosir/B2B, hingga lima foto, tautan video, dan deklarasi persentase bahan baku lokal. Tampilkan status **Menunggu Verifikasi Kurasi**, **Tayang di Katalog**, atau **Rekomendasi Marketplace Mitra**, beserta pengingat larangan manipulasi transaksi dan kewajiban menjaga mutu.

#### Kegiatan dan pelatihan

- **M7-07 — Agenda publik.** Halaman kegiatan menawarkan tampilan **Kalender Bulanan** dan **Daftar Lini Masa / Agenda**, navigasi bulan/tahun, dan penanda hari ini.
- **M7-08 — Filter kegiatan.** Filter mencakup kategori pelatihan/bimtek, sertifikasi, pameran, akselerasi UMKM Talent, literasi digital/PMSE; penyelenggara provinsi, 27 dinas kabupaten/kota, kementerian atau mitra; metode daring/luring/hybrid; serta kegiatan ramah disabilitas.
- **M7-09 — Kalender dan lini masa.** Tanggal kalender memakai badge kategori; hover agenda menampilkan judul, lokasi/platform, sisa kuota, dan batas registrasi. Lini masa mengelompokkan **Sedang Berjalan**, **Pendaftaran Dibuka**, **Segera Datang**, dan **Selesai & Dokumentasi**, masing-masing dengan tautan presensi/streaming, daftar, pengingat WhatsApp/email, atau dokumentasi/materi sesuai status.
- **M7-10 — Detail kegiatan.** Agenda membuka rincian silabus, narasumber, fasilitas, syarat skala/wilayah/NIB, dan dokumen pendukung. Alur pendaftaran, tiket, presensi, serta sertifikat berada di *nice to have* sesuai highlight merah.

#### Klinik konsultasi dan pusat bantuan

- **M7-11 — Enam bidang konsultasi.** Tampilkan: (1) **Legalitas & Standardisasi Produk** untuk NIB, Halal, PIRT/BPOM, PB UMKU, dan HKI; (2) **Manajemen & Keuangan** untuk rekening terpisah, laporan keuangan, SOP, dan KUR/LPDB; (3) **Pemasaran & Transformasi Digital** untuk marketplace, promosi, QRIS, dan katalog ekspor; (4) **Advokasi & Mediasi PMSE** untuk kontrak e-commerce, tarif, sanksi, dan pemulihan akun; (5) **Akses Bantuan Pemerintah** untuk proposal, kelayakan, RAB, SPJ/BAST; (6) **Inklusif & Disabilitas** untuk pendampingan alat produksi dan akses pasar.
- **M7-12 — Form konsultasi.** Alur bertahap: (1) validasi NIB/NIK ke data SIDT untuk mengisi identitas usaha, skala, wilayah, KBLI; (2) pilih poli, jelaskan masalah, dan lampirkan berkas; (3) pilih daring atau tatap muka dan slot kalender; (4) terbitkan nomor tiket konsultasi dan kirim notifikasi WhatsApp.
- **M7-13 — Antrean dan sesi internal.** Dashboard pendamping/dinas menyediakan tampilan Kanban dan daftar dengan status **Tiket Masuk → Jadwal Ditetapkan → Sesi Berjalan → Tindak Lanjut Rekomendasi → Selesai**, penanda aduan PMSE mendesak, tautan video, serta catatan diagnosis, rencana aksi, dan rujukan ke bantuan sarpras, pelatihan vokasi, mediasi Kementerian/SAPA UMKM, atau Talent Lab.
- **M7-14 — Pusat bantuan.** Sediakan FAQ program dan tombol WhatsApp narahubung dinas.

## Nice to have — pengembangan berikutnya

### M1. Autentikasi dan pergantian peran

- **N1-01 — Identitas login.** Pasang logo DISKUK Provinsi Jawa Barat berdampingan dengan identitas Portal Integrasi Satu Data SIDT Jabar.
- **N1-02 — SSO.** Tambahkan aksi **“Masuk Menggunakan Jabar Digital Services / SSO Jabar”**.
- **N1-03 — Demo multi-role.** Widget melayang **“Mode Pengujian Prototipe: Pilih Peran Aktif”** menyediakan pergantian satu klik untuk admin provinsi/eksekutif (`admin@diskuk.jabarprov.go.id`), admin kabupaten/kota contoh Subang (`admin.subang@jabarprov.go.id`), pendamping (`coach.pendamping@jabarprov.go.id`), dan pelaku UMKM pada frame mobile (`wawan.leathercraft@gmail.com`). Setiap pilihan membuka dashboard, filter wilayah/kuota, antrean pendamping, atau profil/Talent Passport/laporan peserta sesuai perannya. Alamat tersebut adalah contoh akun demo dari brief; tidak ada kata sandi di dokumen ini.

### M2. Infografis regulasi

- **N2-01 — Lima aspek perkembangan usaha.** Tambahkan tabulasi visual menurut aspek pada brief: legalitas/formalitas (NIB, NPWP usaha, izin edar); manajemen/tata kelola (rekening terpisah, SOP); pemasaran/digitalisasi (e-commerce, media sosial bisnis); keuangan/akses pembiayaan (pembukuan, kredit/KUR); kemitraan/jejaring (rantai pasok, kontrak *offtaker*).

### M5. Presentasi demo dan pemantauan eksekutif

- **N5-01 — Simulasi koneksi.** Toggle presentasi untuk memutus/memulihkan koneksi secara simulatif, dengan notifikasi bahwa laporan tersimpan lokal dan kemudian tersinkron ke server.
- **N5-02 — Agregasi eksekutif.** Metrik kenaikan omzet peserta Accelerator dibanding data dasar SIDT, kepatuhan laporan mingguan dengan target >95%, dan grafik 12 minggu untuk target agregat (garis putus-putus) versus realisasi terverifikasi (garis hijau tebal).
- **N5-03 — Peta risiko.** Pin merah untuk usaha yang omzetnya turun 30% selama dua pekan berturut-turut, berikut penugasan bimbingan teknis pendamping wilayah.

### M6. Direktori investor

- **N6-01 — Filter matchmaking.** Direktori investor/lembaga pembiayaan memfilter rentang kebutuhan modal (<Rp50 juta, Rp50–500 juta, >Rp500 juta), skema KUR/LPDB, *offtaker*, penyertaan modal, konsinyasi/akses pasar global, dan sektor KBLI.
- **N6-02 — Deal card.** Tampilkan profil usaha, jenama, domisili, Talent Index Score, pertumbuhan omzet mingguan, margin, kebutuhan dana atau kapasitas pasok, serta aksi lihat portofolio, unduh executive summary/pitch deck PDF, dan ajukan minat kemitraan melalui LOI digital.

### M7. Layanan publik lanjutan

- **N7-01 — Pendaftaran kegiatan.** Form pendaftaran terisi dari NIK/NIB dan SIDT, validasi pakta integritas Non-ASN/TNI/Polri untuk kegiatan tertentu, serta kebutuhan aksesibilitas peserta.
- **N7-02 — Tiket dan penyelenggaraan kegiatan.** QR e-pass dan notifikasi WhatsApp berisi jadwal/lokasi atau tautan daring; seleksi peserta menurut Talent Index Score, administrasi, dan asal wilayah, berikut aksi terima/tolak/daftar tunggu dan ekspor XLSX; pindai QR presensi, persentase kehadiran, e-sertifikat QR bagi peserta yang memenuhi ambang 80% serta tugas. Sertifikat memperbarui `bukti_pelatihan_manajemen` dan capaian Peningkatan Kapasitas SDM dalam IP-UMKM.
- **N7-03 — Fasilitasi bantuan.** Kartu delapan bentuk bantuan: penghargaan, beasiswa, operasional, sarpras produksi, sarpras pemasaran, revitalisasi/pembangunan gedung, permodalan/pembiayaan, dan bantuan pemerintah lainnya. Sertakan filter bentuk uang/barang/jasa, indikator sisa kuota, dan hitung mundur masa pendaftaran.
- **N7-04 — Halaman depan dan statistik klinik.** Halaman pengenalan klinik, total konsultasi selesai, waktu respons rata-rata, CSAT, serta direktori konsultan/coach dan ketersediaannya.
- **N7-05 — Integrasi hasil konsultasi.** Setelah sesi ditutup, hasil kepatuhan/perbaikan usaha tersambung otomatis ke profil UMKM dan indikator perkembangan usaha.

## Acuan yang ditandai sudah ada (hijau)

- Tombol login **“Masuk ke Dashboard”** dan teks kepatuhan pada formulir.
- Executive Metric Cards untuk total UMKM, skala, NIB, dan demografi; panel metrik, pengelompokan, grafik, serta tabel agregasi pada Canvas Analitik.
- Drill-down peta provinsi → kabupaten/kota → kecamatan/kelurahan dan kontrol layer/basemap.
- Pencarian serta filter bertingkat pada data tabular.

Butir hijau menjadi titik integrasi bagi fitur kuning. Verifikasi terhadap perilaku aplikasi aktual tetap diperlukan saat implementasi; daftar ini tidak menyatakan bahwa fitur tersebut telah diuji pada runtime.

## Keputusan yang perlu dipastikan sebelum implementasi

1. **Batas akun tahap sekarang.** Brief meminta admin/super admin dulu pada Modul 1, tetapi beberapa butir kuning memerlukan pelaku UMKM dan pendamping (laporan, katalog, klinik). Tentukan akun/otorisasi yang akan menjalankan alur tersebut tanpa menganggap widget pergantian peran merah sebagai *must have*.
2. **Kontrak data dan skor.** Pastikan sumber 15 atribut regional, bukti sertifikasi/PDN, KPI mingguan, lima dimensi scorecard, dan rumus Talent Index Score. Bobot empat aspek 25% dinyatakan dalam brief; detail formula dan sumber data belum dijelaskan di sana.
3. **Makna status Scouting.** Brief menyebut aksi “Masukkan ke Talent Pool” menghasilkan `talent_status: Scouting`; pastikan definisi transisi status sebelum membuat alur persetujuan.
4. **Batas klaim regulasi dan verifikasi.** Teks brief menyebut Permen 1/2026, 2/2026, 3/2026, tanda tangan kriptografis, OSS-RBA, dan SIDT. Validasi data, dasar aturan, dan mekanisme integrasi sebelum menampilkan status “terverifikasi” atau klaim kepatuhan kepada pengguna.
5. **Aksi daftar kegiatan.** Lini masa dan detail kegiatan berwarna kuning, tetapi form pendaftaran dan e-pass berwarna merah. Tentukan tujuan tombol **“Daftar Sekarang”** pada tahap sekarang agar tidak menjanjikan pendaftaran yang belum tersedia.
