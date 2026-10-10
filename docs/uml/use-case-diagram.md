# Use Case Diagram — Basis Data UMKM DISKUK Jawa Barat

Dokumen ini menjelaskan use case diagram Sistem Basis Data UMKM Dinas Koperasi dan Usaha Kecil (DISKUK) Provinsi Jawa Barat. Diagram disusun menurut notasi UML dan terdiri atas satu papan ringkasan aktor (Papan 0) serta sembilan papan use case per subsistem (Papan 1–9).

Diagram lengkap: [Use Case Diagram DISKUK (Claude Design)](https://claude.ai/artifact/FYFoxMfHEoZnWQGUMqcg3K)

## Ketentuan penyusunan

1. **Batas sistem.** Setiap diagram memiliki satu batas sistem «system» Basis Data UMKM DISKUK. Aktor berada di luar batas, sedangkan use case berada di dalamnya.
2. **Hanya kegiatan di dalam sistem.** Use case yang dimodelkan hanya kegiatan yang dijalankan melalui sistem. Kegiatan di luar sistem tidak dituliskan, misalnya impor data SIDT melalui skrip oleh tim data, pendampingan tatap muka, dan proses pengiriman pesan oleh layanan WhatsApp/Email itu sendiri.
3. **Satu use case, satu operasi data.** Setiap use case diberi label operasi CRUD:

   | Label | Operasi | Arti |
   | --- | --- | --- |
   | C | Create | Membuat data baru |
   | R | Read | Melihat, mencari, atau mengunduh data |
   | U | Update | Mengubah data atau status, termasuk verifikasi dan pencabutan |
   | D | Delete | Menghapus data atau sesi |

   Pencabutan (passport, sertifikat, outcome, akun investor) dikategorikan sebagai **Update** karena sistem mengubah status data menjadi dicabut dan tidak menghapus datanya.
4. **Relasi yang digunakan:**

   | Relasi | Notasi | Arti |
   | --- | --- | --- |
   | Asosiasi | Garis lurus tanpa panah | Aktor menjalankan use case |
   | Generalisasi | Garis dengan kepala segitiga kosong | Aktor anak mewarisi semua use case aktor induk |
   | «include» | Garis putus-putus berpanah terbuka | Use case dasar selalu menjalankan use case yang di-include |
   | «extend» | Garis putus-putus berpanah terbuka | Use case tambahan yang bersifat opsional terhadap use case dasar |

5. **Login sebagai prasyarat.** Login tidak dihubungkan dengan «include» ke setiap use case. Login diperlakukan sebagai prasyarat bagi aktor yang terdaftar dan dimodelkan tersendiri pada Papan 1.

---

## Papan 0 — Ringkasan Aktor dan Legenda

Papan ini menampilkan seluruh aktor sistem beserta hubungan generalisasinya, legenda notasi, dan daftar diagram.

### Daftar aktor

| Aktor | Jenis | Keterangan |
| --- | --- | --- |
| Pengguna Terdaftar | Abstrak | Induk dari semua aktor yang login ke sistem. |
| Admin Provinsi | Manusia | Pengelola tingkat provinsi yang melihat seluruh wilayah Jawa Barat dan memegang keputusan kurasi. |
| Admin Kab/Kota | Manusia | Pengelola yang dibatasi pada satu wilayah penugasan (kabupaten/kota). |
| Pendamping | Manusia | Petugas yang mendampingi peserta program yang ditugaskan kepadanya dan menangani tiket klinik yang diklaimnya. |
| Pelaku UMKM | Manusia | Pemilik usaha yang login dengan NIB; akunnya terhubung ke tepat satu usaha. |
| Investor Terverifikasi | Manusia | Akun investor yang telah diaktifkan oleh Admin Provinsi. |
| Pengunjung Publik | Manusia | Masyarakat umum yang mengakses halaman publik tanpa login. |
| Penyedia Kanal (WhatsApp/Email) | Sistem eksternal | Layanan pengirim pesan yang mengirimkan resi pengiriman notifikasi ke sistem. |

### Hubungan generalisasi

- **Admin Provinsi, Admin Kab/Kota, Pendamping, Pelaku UMKM, dan Investor Terverifikasi → Pengguna Terdaftar.** Kelima aktor ini mewarisi use case autentikasi dan pengelolaan akun.
- **Admin Provinsi → Admin Kab/Kota.** Admin Provinsi dapat menjalankan semua use case Admin Kab/Kota dengan cakupan seluruh provinsi, ditambah use case khusus provinsi seperti kurasi dan penerbitan passport. Karena itu, pada Papan 1–9 Admin Provinsi hanya dihubungkan langsung ke use case yang khusus untuknya.
- **Investor Terverifikasi → Pengunjung Publik.** Investor dapat melakukan semua yang dapat dilakukan pengunjung publik, ditambah akses pitch deck dan LOI investor.

---

## Papan 1 — Autentikasi & Akun

Subsistem ini mengatur proses masuk dan keluar sistem, pemulihan kata sandi, dan pengaturan akun. Aktornya adalah **Pengguna Terdaftar**, sehingga seluruh use case berlaku bagi semua aktor yang login melalui generalisasi.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 1.1 | Verifikasi Captcha | R | — | Memeriksa jawaban captcha. Dijalankan oleh Login melalui «include». |
| 1.2 | Login (membuat sesi) | C | Pengguna Terdaftar | Memvalidasi kredensial dan membuat sesi. Pelaku UMKM login dengan NIB. |
| 1.3 | Login via SSO | C | Pengguna Terdaftar | Alternatif login melalui single sign-on. |
| 1.4 | Minta Tautan Lupa Kata Sandi | C | Pengguna Terdaftar | Membuat permintaan dan tautan reset kata sandi. |
| 1.5 | Reset Kata Sandi | U | Pengguna Terdaftar | Mengganti kata sandi melalui tautan reset. |
| 1.6 | Lihat Profil Akun | R | Pengguna Terdaftar | Menampilkan identitas, peran, dan wilayah penugasan akun. |
| 1.7 | Ubah Kata Sandi | U | Pengguna Terdaftar | Mengganti kata sandi dari halaman pengaturan akun. |
| 1.8 | Lihat Riwayat Aktivitas Akun | R | Pengguna Terdaftar | Menampilkan riwayat aktivitas login dan sesi akun. |
| 1.9 | Logout (menghapus sesi) | D | Pengguna Terdaftar | Mengakhiri dan menghapus sesi yang aktif. |

**Relasi:**
- Login «include» Verifikasi Captcha: setiap login selalu melewati pemeriksaan captcha.
- Login via SSO «extend» Login: SSO adalah cara masuk alternatif yang bersifat opsional.

---

## Papan 2 — Data Usaha & Peta

Subsistem ini mengelola data lapangan usaha dalam cakupan wilayah pemanggil, verifikasi data, dan peta sebaran usaha. Admin Kab/Kota hanya melihat usaha di wilayah penugasannya, Admin Provinsi melihat seluruh wilayah, dan Pelaku UMKM hanya mengakses usahanya sendiri.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 2.1 | Lihat Data Lapangan Usaha | R | Admin Kab/Kota | Menampilkan detail data lapangan suatu usaha. |
| 2.2 | Perbarui Data Lapangan Usaha | U | Admin Kab/Kota | Mengubah data lapangan usaha dalam cakupan wilayah. |
| 2.3 | Verifikasi Data Usaha | U | Admin Kab/Kota | Menandai data usaha telah diverifikasi. |
| 2.4 | Lihat Aspek Perkembangan Usaha | R | Admin Kab/Kota | Menampilkan aspek perkembangan usaha sesuai acuan Permen. |
| 2.5 | Lihat Peta Sebaran Usaha | R | Admin Kab/Kota, Pelaku UMKM | Menampilkan lokasi usaha pada peta sesuai cakupan pemanggil. |
| 2.6 | Lihat Profil Usaha Sendiri | R | Pelaku UMKM | Menampilkan profil usaha milik Pelaku UMKM. |
| 2.7 | Perbarui Profil Usaha Sendiri | U | Pelaku UMKM | Mengubah profil usaha milik sendiri. |

**Relasi:** Admin Provinsi → Admin Kab/Kota (generalisasi), sehingga Admin Provinsi dapat menjalankan use case 2.1–2.5 untuk seluruh wilayah.

---

## Papan 3 — Analitik

Subsistem ini menyediakan dashboard, kueri analisis, data tabular, peta spasial, analisis tersimpan, dan ekspor data bagi staf dinas. Pengunjung publik hanya dapat melihat dashboard publik yang sudah diterbitkan.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 3.1 | Lihat Dashboard Analitik | R | Admin Kab/Kota | Menampilkan ringkasan indikator UMKM sesuai cakupan wilayah. |
| 3.2 | Jalankan Kueri Analisis | R | Admin Kab/Kota | Menjalankan kueri analisis dengan filter dan pengelompokan. |
| 3.3 | Lihat Profil Analitik UMKM | R | Admin Kab/Kota | Menampilkan profil analitik satu UMKM. |
| 3.4 | Lihat Data Tabular | R | Admin Kab/Kota | Menampilkan data UMKM dalam bentuk tabel dengan filter. |
| 3.5 | Lihat Peta Spasial | R | Admin Kab/Kota | Menampilkan sebaran data pada peta spasial. |
| 3.6 | Simpan Analisis | C | Admin Kab/Kota | Menyimpan konfigurasi analisis untuk dipakai kembali. |
| 3.7 | Lihat Analisis Tersimpan | R | Admin Kab/Kota | Menampilkan daftar analisis yang tersimpan. |
| 3.8 | Ubah Analisis Tersimpan | U | Admin Kab/Kota | Mengubah konfigurasi analisis tersimpan. |
| 3.9 | Hapus Analisis Tersimpan | D | Admin Kab/Kota | Menghapus analisis tersimpan. |
| 3.10 | Ajukan Ekspor Data Analitik | C | Admin Kab/Kota | Membuat pekerjaan ekspor data sesuai cakupan pemanggil. |
| 3.11 | Unduh Hasil Ekspor | R | Admin Kab/Kota | Mengunduh berkas hasil ekspor yang sudah selesai. |
| 3.12 | Terbitkan Ulang Dashboard Publik | C | Admin Provinsi | Membuat pekerjaan pembangunan ulang data dashboard publik. |
| 3.13 | Lihat Dashboard Publik & Infografis | R | Pengunjung Publik | Menampilkan dashboard dan infografis publik. |

**Relasi:** Admin Provinsi → Admin Kab/Kota (generalisasi). Use case 3.6–3.9 membentuk siklus CRUD lengkap atas data analisis tersimpan.

---

## Papan 4 — Pendampingan & Laporan Mingguan

Subsistem ini mengelola peserta program pendampingan, laporan capaian KPI mingguan, peninjauan laporan, dan pemantauan peserta berisiko. Peninjauan laporan hanya dapat dilakukan oleh Pendamping dan Admin Provinsi; Admin Kab/Kota tidak meninjau laporan.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 4.1 | Pantau Peserta Berisiko | R | Admin Kab/Kota | Menampilkan peserta yang berisiko tidak mencapai target. |
| 4.2 | Hitung Ulang Risiko Peserta | U | Admin Kab/Kota | Menghitung ulang status risiko dan membuat tugas tindak lanjut bagi pendamping. |
| 4.3 | Lihat Tugas Tindak Lanjut Risiko | R | Admin Kab/Kota, Pendamping | Menampilkan tugas tindak lanjut atas peserta berisiko. |
| 4.4 | Lihat Daftar Peserta | R | Admin Kab/Kota, Pendamping, Pelaku UMKM | Menampilkan peserta sesuai cakupan pemanggil. |
| 4.5 | Lihat Detail Peserta & Riwayat Laporan | R | Admin Kab/Kota, Pendamping, Pelaku UMKM | Menampilkan detail peserta dan riwayat laporan mingguannya. |
| 4.6 | Lihat Antrean Laporan Mingguan | R | Admin Provinsi, Pendamping | Menampilkan laporan yang menunggu peninjauan. |
| 4.7 | Tinjau Laporan Mingguan | U | Admin Provinsi, Pendamping | Menyetujui atau mengembalikan laporan mingguan. |
| 4.8 | Tetapkan Status Pitching | U | Admin Provinsi, Pendamping | Menetapkan kesiapan peserta untuk sesi pitching. |
| 4.9 | Kirim Laporan Mingguan | C | Pelaku UMKM | Mengirim laporan capaian KPI untuk satu minggu program. |
| 4.10 | Revisi Laporan Mingguan | U | Pelaku UMKM | Memperbaiki laporan yang dikembalikan peninjau. |

**Relasi:** Admin Provinsi → Admin Kab/Kota (generalisasi).

---

## Papan 5 — Talent & Passport

Subsistem ini mengelola alur jalur talent: pengajuan oleh admin, penilaian skor, keputusan kurasi oleh Admin Provinsi melalui Berita Acara, hingga penerbitan Talent Passport yang dapat diverifikasi publik melalui kodenya.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 5.1 | Lihat Ringkasan Talent Usaha | R | Admin Kab/Kota | Menampilkan data talent suatu usaha sebelum diajukan. |
| 5.2 | Buat Pengajuan Talent | C | Admin Kab/Kota | Membuat usulan agar usaha masuk jalur talent. |
| 5.3 | Lihat Daftar Pengajuan Talent | R | Admin Kab/Kota | Menampilkan pengajuan beserta statusnya. |
| 5.4 | Ubah Pengajuan Talent | U | Admin Kab/Kota | Mengubah data pengajuan yang belum diputuskan. |
| 5.5 | Hitung Skor Talent | U | Admin Kab/Kota | Menghitung skor empat pilar talent untuk pengajuan. |
| 5.6 | Ajukan ke Kurasi Provinsi | U | Admin Kab/Kota | Meneruskan pengajuan ke Admin Provinsi untuk diputuskan. |
| 5.7 | Lihat Berita Acara | R | Admin Kab/Kota | Menampilkan daftar Berita Acara keputusan kurasi. |
| 5.8 | Unduh PDF Berita Acara | R | Admin Provinsi | Mengunduh dokumen resmi Berita Acara. |
| 5.9 | Tolak Pengajuan Talent | U | Admin Provinsi | Menolak pengajuan beserta alasannya. |
| 5.10 | Buat Berita Acara Kurasi | C | Admin Provinsi | Mencatat keputusan resmi kurasi atas pengajuan. |
| 5.11 | Terbitkan Talent Passport | C | Admin Provinsi | Menerbitkan passport bertanda tangan digital untuk usaha. |
| 5.12 | Cabut Talent Passport | U | Admin Provinsi | Mencabut passport yang telah terbit. |
| 5.13 | Lihat Talent Passport | R | Admin Kab/Kota, Pelaku UMKM | Menampilkan passport milik usaha. |
| 5.14 | Unduh Dokumen Passport (PDF) | R | — | Mengunduh ringkasan passport atau lembar katalog dalam PDF. |
| 5.15 | Verifikasi Talent Passport | R | Pengunjung Publik | Memeriksa keaslian passport berdasarkan kodenya. |

**Relasi:**
- Admin Provinsi → Admin Kab/Kota (generalisasi).
- Unduh PDF Berita Acara «extend» Lihat Berita Acara: pengunduhan PDF dilakukan opsional dari daftar Berita Acara.
- Unduh Dokumen Passport (PDF) «extend» Lihat Talent Passport: pengunduhan PDF dilakukan opsional dari tampilan passport.

---

## Papan 6 — Katalog Produk & LOI

Subsistem ini mengelola produk usaha yang diajukan ke katalog publik. Produk diajukan oleh Pelaku UMKM atau Admin Provinsi, dikurasi oleh Admin Provinsi, lalu produk yang lolos tampil di katalog publik. Calon pembeli dapat mengirim pernyataan minat (LOI) atas produk tayang.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 6.1 | Cari Usaha Pemilik Produk | R | Admin Provinsi | Mencari usaha yang akan dikelola produknya. |
| 6.2 | Lihat Antrean Kurasi Produk | R | Admin Provinsi | Menampilkan produk yang menunggu kurasi. |
| 6.3 | Kurasi Produk | U | Admin Provinsi | Memutuskan produk tayang, rekomendasi marketplace, atau ditolak dengan catatan. |
| 6.4 | Ubah Status LOI | U | Admin Provinsi | Menandai LOI baru, ditindaklanjuti, atau ditutup. |
| 6.5 | Tambah Produk | C | Admin Provinsi, Pelaku UMKM | Menambahkan produk beserta fotonya. |
| 6.6 | Lihat Produk Usaha | R | Admin Provinsi, Pelaku UMKM | Menampilkan produk milik suatu usaha. |
| 6.7 | Ubah Produk | U | Admin Provinsi, Pelaku UMKM | Mengubah data produk. |
| 6.8 | Lihat Daftar LOI | R | Admin Provinsi, Pelaku UMKM | Menampilkan LOI yang masuk untuk produk. |
| 6.9 | Jelajahi Katalog Produk Tayang | R | Pengunjung Publik | Menampilkan produk yang lolos kurasi di katalog publik. |
| 6.10 | Unduh Lembar Spesifikasi Produk | R | — | Mengunduh lembar spesifikasi produk dalam PDF. |
| 6.11 | Kirim LOI | C | Pengunjung Publik | Mengirim pernyataan minat terhadap satu produk tayang. |

**Relasi:** Unduh Lembar Spesifikasi Produk «extend» Jelajahi Katalog Produk Tayang. Pada katalog, Admin Kab/Kota tidak memiliki akses, sehingga Admin Provinsi ditampilkan tanpa generalisasi.

---

## Papan 7 — Investor

Subsistem ini mempertemukan usaha dengan investor. Pelaku UMKM menyusun profil investor usahanya, Admin Provinsi mengkurasi profil tersebut dan mengaktifkan akun investor. Direktori investor dapat dilihat publik, sedangkan pitch deck dan LOI investor hanya tersedia bagi investor terverifikasi.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 7.1 | Lihat Antrean Kurasi Investor | R | Admin Provinsi | Menampilkan profil investor usaha yang menunggu kurasi. |
| 7.2 | Kurasi Profil Investor Usaha | U | Admin Provinsi | Menyetujui, menolak, atau mencabut profil investor usaha. |
| 7.3 | Aktifkan / Cabut Akun Investor | U | Admin Provinsi | Mengaktifkan atau mencabut verifikasi akun investor. |
| 7.4 | Lihat Profil Investor Usaha Sendiri | R | Pelaku UMKM | Menampilkan profil investor milik usaha sendiri. |
| 7.5 | Simpan Profil Investor Usaha | C, U | Pelaku UMKM | Membuat profil baru atau memperbarui profil yang ada, termasuk pitch deck. |
| 7.6 | Lihat Direktori Investor | R | Pengunjung Publik | Menampilkan daftar usaha yang profilnya disetujui. |
| 7.7 | Lihat Detail Profil Usaha | R | Pengunjung Publik | Menampilkan detail profil investor suatu usaha. |
| 7.8 | Unduh Profil Usaha (PDF) | R | — | Mengunduh profil usaha dalam PDF. |
| 7.9 | Unduh Pitch Deck | R | Investor Terverifikasi | Mengunduh pitch deck usaha. |
| 7.10 | Kirim LOI Investor | C | Investor Terverifikasi | Mengirim pernyataan minat investasi atas produk tayang usaha. |

**Relasi:**
- Investor Terverifikasi → Pengunjung Publik (generalisasi): investor juga dapat melihat direktori dan detail profil usaha.
- Unduh Profil Usaha (PDF) «extend» Lihat Detail Profil Usaha.

---

## Papan 8 — Klinik Konsultasi

Subsistem ini melayani permintaan konsultasi untuk satu poli pada satu slot. Tiket diajukan oleh Pelaku UMKM atau masyarakat umum, ditangani petugas klinik (Pendamping, Admin Kab/Kota, Admin Provinsi) melalui papan tiket, lalu hasil kepatuhan atau perbaikan usaha dicatat sebagai outcome. Outcome diajukan oleh satu petugas dan diverifikasi oleh Admin Kab/Kota atau Admin Provinsi yang berwenang atas wilayah usaha. Pendamping hanya dapat mengajukan outcome, tidak memverifikasinya.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 8.1 | Lihat Papan Tiket Klinik | R | Pendamping, Admin Kab/Kota | Menampilkan tiket dalam bentuk kanban sesuai cakupan petugas. |
| 8.2 | Klaim & Ubah Status Tiket | U | Pendamping, Admin Kab/Kota | Mengklaim tiket dan mengubah statusnya (dijadwalkan, berjalan, tindak lanjut, selesai, batal). |
| 8.3 | Ajukan Outcome Klinik | C | Pendamping, Admin Kab/Kota | Mencatat hasil kepatuhan atau perbaikan usaha saat menutup tiket. |
| 8.4 | Lihat Daftar Outcome | R | Admin Kab/Kota | Menampilkan outcome yang menunggu verifikasi. |
| 8.5 | Verifikasi Outcome | U | Admin Kab/Kota | Mengesahkan outcome agar masuk profil usaha dan indikator. |
| 8.6 | Koreksi Outcome | U | Admin Kab/Kota | Memperbaiki outcome disertai alasan, tanpa menimpa data lama. |
| 8.7 | Cabut Outcome | U | Admin Kab/Kota | Mencabut outcome disertai alasan. |
| 8.8 | Unduh Lampiran Tiket | R | Pendamping, Admin Kab/Kota, Pelaku UMKM | Mengunduh berkas lampiran tiket; hanya untuk pemohon dan petugas dalam cakupan tiket. |
| 8.9 | Lihat Poli & Slot Tersedia | R | Pengunjung Publik, Pelaku UMKM | Menampilkan poli dan slot waktu yang masih dapat dipesan. |
| 8.10 | Ajukan Tiket Konsultasi | C | Pengunjung Publik, Pelaku UMKM | Membuat tiket konsultasi untuk satu poli pada satu slot. |
| 8.11 | Lampirkan Berkas | C | — | Melampirkan berkas pendukung pada tiket. |
| 8.12 | Lacak Status Tiket | R | Pengunjung Publik, Pelaku UMKM | Menampilkan status tiket berdasarkan nomor tiket. |
| 8.13 | Beri Nilai CSAT | C | Pengunjung Publik, Pelaku UMKM | Memberi nilai kepuasan 1–5 atas tiket yang selesai. |
| 8.14 | Lihat Direktori Konsultan | R | Pengunjung Publik | Menampilkan konsultan beserta poli, afiliasi, dan jadwal mingguannya. |
| 8.15 | Lihat Statistik Klinik | R | Pengunjung Publik | Menampilkan statistik layanan klinik. |
| 8.16 | Catat Resi Pengiriman Notifikasi | U | Penyedia Kanal | Menerima konfirmasi bahwa pesan notifikasi telah sampai ke penerima. |

**Relasi:**
- Admin Provinsi → Admin Kab/Kota (generalisasi).
- Lampirkan Berkas «extend» Ajukan Tiket Konsultasi: lampiran bersifat opsional saat mengajukan tiket.
- Penyedia Kanal adalah aktor sistem eksternal yang memicu use case 8.16; pengiriman pesan oleh WhatsApp/Email sendiri berada di luar sistem.

---

## Papan 9 — Kegiatan & Fasilitasi

Subsistem ini mengelola kegiatan publik DISKUK (pelatihan, pameran, bazar, seminar, temu bisnis), pendaftaran Pelaku UMKM, pengelolaan pendaftar oleh staf, pencatatan kehadiran, sertifikat, langganan pengingat, dan kuota program fasilitasi.

| No | Use case | CRUD | Aktor | Keterangan |
| --- | --- | --- | --- | --- |
| 9.1 | Lihat Daftar Pendaftar | R | Admin Kab/Kota | Menampilkan pendaftar suatu kegiatan. |
| 9.2 | Ekspor Daftar Pendaftar (XLSX) | R | — | Mengunduh daftar pendaftar dalam format XLSX. |
| 9.3 | Putuskan Pendaftaran | U | Admin Kab/Kota | Menetapkan pendaftar diterima, ditolak, daftar tunggu, atau batal. |
| 9.4 | Nilai Tugas Peserta | U | Admin Kab/Kota | Menandai tugas peserta selesai atau belum. |
| 9.5 | Catat Kehadiran (Pindai QR) | C | Admin Kab/Kota | Mencatat kehadiran peserta per sesi dengan memindai QR e-pass. |
| 9.6 | Terbitkan Sertifikat | C | Admin Kab/Kota | Menerbitkan sertifikat bagi peserta yang memenuhi syarat kehadiran. |
| 9.7 | Cabut Sertifikat | U | Admin Kab/Kota | Mencabut sertifikat yang telah terbit. |
| 9.8 | Perbarui Kuota Fasilitasi | U | Admin Provinsi | Memperbarui jumlah kuota terisi pada program fasilitasi. |
| 9.9 | Daftar Kegiatan | C | Pelaku UMKM | Mendaftarkan usaha pada suatu kegiatan. |
| 9.10 | Lihat Status Pendaftaran | R | Pelaku UMKM | Menampilkan status pendaftaran kegiatan milik sendiri. |
| 9.11 | Unduh E-Pass | R | — | Mengunduh e-pass berisi QR untuk presensi. |
| 9.12 | Lihat Agenda Kegiatan | R | Pelaku UMKM, Pengunjung Publik | Menampilkan agenda kegiatan DISKUK. |
| 9.13 | Berlangganan Pengingat Kegiatan | C | Pengunjung Publik | Mendaftarkan pengingat kegiatan lewat WhatsApp atau Email. |
| 9.14 | Batalkan Langganan Pengingat | U | Pengunjung Publik | Membatalkan langganan pengingat melalui tautan. |
| 9.15 | Verifikasi Sertifikat | R | Pengunjung Publik | Memeriksa keaslian sertifikat berdasarkan kodenya. |
| 9.16 | Lihat Program Fasilitasi | R | Pengunjung Publik | Menampilkan program fasilitasi beserta kuotanya. |

**Relasi:**
- Admin Provinsi → Admin Kab/Kota (generalisasi).
- Ekspor Daftar Pendaftar (XLSX) «extend» Lihat Daftar Pendaftar.
- Unduh E-Pass «extend» Lihat Status Pendaftaran: e-pass tersedia dari halaman status pendaftaran.

---

## Rekapitulasi

| Papan | Subsistem | Jumlah use case |
| --- | --- | --- |
| 1 | Autentikasi & Akun | 9 |
| 2 | Data Usaha & Peta | 7 |
| 3 | Analitik | 13 |
| 4 | Pendampingan & Laporan Mingguan | 10 |
| 5 | Talent & Passport | 15 |
| 6 | Katalog Produk & LOI | 11 |
| 7 | Investor | 10 |
| 8 | Klinik Konsultasi | 16 |
| 9 | Kegiatan & Fasilitasi | 16 |
| | **Total** | **107** |
