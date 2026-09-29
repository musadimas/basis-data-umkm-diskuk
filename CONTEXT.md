# Basis Data UMKM DISKUK Jawa Barat

Basis data dan dashboard operasional Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat. Isinya data usaha mikro dan kecil, program pendampingan dan talent, katalog produk, klinik konsultasi, dan kegiatan publik. Setiap peran hanya melihat data dalam cakupannya.

## Pemanggil dan akses

**Pemanggil**:
Akun yang sedang membuat permintaan, lengkap dengan peran dan penugasannya.
_Avoid_: actor, operator, user (dalam pembahasan otorisasi)

**Peran**:
Fungsi seorang pemanggil. Nilainya salah satu dari Admin Provinsi, Admin Kab/Kota, Pendamping, atau Pelaku UMKM.
_Avoid_: role (role Directus adalah hal lain), app role, jabatan

**Admin Provinsi**:
Pengelola tingkat provinsi yang melihat seluruh wilayah dan memegang keputusan kurasi.
_Avoid_: superadmin, admin (tanpa keterangan)

**Admin Kab/Kota**:
Pengelola yang ditugaskan ke satu wilayah penugasan.
_Avoid_: admin daerah, operator kota

**Pendamping**:
Petugas yang mendampingi peserta program yang ditugaskan kepadanya dan menangani tiket klinik yang diklaimnya.
_Avoid_: mentor, fasilitator

**Pelaku UMKM**:
Pemanggil yang akunnya terhubung ke tepat satu usaha miliknya dan login dengan NIB.
_Avoid_: UMKM (untuk akun), pengguna usaha

**Wilayah Penugasan**:
Kabupaten/kota yang ditugaskan kepada seorang Admin Kab/Kota.
_Avoid_: kota (rancu dengan lokasi usaha), scope

**Cakupan Pemanggil**:
Himpunan data yang boleh dilihat atau diubah seorang pemanggil, diturunkan dari peran dan penugasannya. Data yang wilayahnya tidak diketahui berada di luar cakupan setiap Admin Kab/Kota.
_Avoid_: scope, hak akses, permission

**Kapabilitas**:
Izin bernama atas satu kemampuan, misalnya mengkurasi katalog atau meninjau laporan mingguan, yang dimiliki pemanggil karena perannya.
_Avoid_: permission, fitur, menu

## Usaha

**Usaha**:
Satu unit bisnis mikro atau kecil yang terdaftar dengan NIB dan berlokasi di satu kabupaten/kota.
_Avoid_: UMKM (untuk record), bisnis, toko

**Pelaku Usaha**:
Orang pemilik usaha, dikenali dengan NIK.
_Avoid_: pemilik, owner

**Legalitas**:
Sertifikat atau izin milik usaha (Halal, PIRT, BPOM, HKI, SNI, UMKU) beserta status dan masa berlakunya.
_Avoid_: izin (tanpa keterangan), dokumen legal

## Program dan talent

**Peserta**:
Usaha yang mengikuti program pendampingan selama sejumlah minggu, didampingi satu pendamping.
_Avoid_: binaan, talenta

**Laporan Mingguan**:
Laporan capaian KPI seorang peserta untuk satu minggu program. Laporan dikirim pelaku UMKM, lalu ditinjau pendampingnya atau Admin Provinsi.
_Avoid_: laporan KPI, weekly report

**Pengajuan Talent**:
Usulan agar sebuah usaha masuk jalur talent. Pengajuan dinilai dengan skor, lalu diputuskan lewat Berita Acara.
_Avoid_: nominasi, scouting (untuk record)

**Berita Acara**:
Catatan resmi keputusan kurasi atas pengajuan talent.
_Avoid_: BA (dalam teks untuk pengguna), notulen

**Talent Passport**:
Identitas talent sebuah usaha yang ditandatangani secara digital dan dapat diverifikasi publik lewat kodenya.
_Avoid_: sertifikat talent, kartu talent

**Talent Index**:
Rata-rata empat pilar skor talent sebuah usaha. Nilai ini menjadi dasar status Siap Naik Kelas.
_Avoid_: skor total, skor kinerja

## Katalog

**Produk**:
Barang atau jasa sebuah usaha yang diajukan ke katalog publik.
_Avoid_: item, listing

**Kurasi**:
Peninjauan produk sebelum tampil ke publik. Hasilnya tayang, rekomendasi marketplace, atau ditolak dengan catatan.
_Avoid_: moderasi, approval

**Produk Tayang**:
Produk yang lolos kurasi (tayang atau rekomendasi marketplace) dan terlihat publik.
_Avoid_: produk aktif, published

**LOI**:
Pernyataan minat (letter of intent) dari calon pembeli publik terhadap satu produk tayang.
_Avoid_: pesanan, order, inquiry

## Klinik konsultasi

**Tiket Klinik**:
Permintaan konsultasi untuk satu poli pada satu slot, diajukan pelaku UMKM atau masyarakat umum.
_Avoid_: booking, reservasi, konsultasi (untuk record)

**Poli**:
Bidang layanan konsultasi di klinik.
_Avoid_: layanan, kategori

**Slot**:
Waktu konsultasi pada satu poli yang dapat dipesan oleh satu tiket.
_Avoid_: jadwal (tanpa keterangan)

**Petugas Klinik**:
Admin Provinsi, Admin Kab/Kota, atau Pendamping yang menangani tiket dalam cakupannya.
_Avoid_: staf, konsultan

**Lampiran**:
Berkas yang dilampirkan pemohon ke tiket klinik. Hanya pemohon dan petugas klinik dalam cakupan tiket itu yang boleh membacanya.
_Avoid_: attachment, file

## Kegiatan dan notifikasi

**Kegiatan**:
Acara publik DISKUK, seperti pelatihan, pameran, bazar, seminar, atau temu bisnis.
_Avoid_: event, agenda

**Langganan Pengingat**:
Persetujuan seseorang untuk diingatkan tentang satu kegiatan, lewat satu kanal, ke satu tujuan. Langganan dapat dibatalkan lewat tautan.
_Avoid_: pengingat (untuk langganannya), reminder, subscription

**Kanal**:
Media pengiriman pesan notifikasi, yaitu WhatsApp atau Email.
_Avoid_: channel, provider

**Pesan Notifikasi**:
Satu pesan untuk satu tujuan lewat satu kanal, lahir dari satu kejadian domain seperti tiket dibuat, status tiket berubah, atau pengingat jatuh tempo.
_Avoid_: notifikasi (untuk record), blast

**Outbox Notifikasi**:
Antrean tahan-lama berisi pesan notifikasi. Pesan dicatat bersama perubahan yang memicunya, lalu dikirim kemudian.
_Avoid_: antrean WA, queue, notifikasi klinik

**Resi Provider**:
Konfirmasi dari penyedia kanal bahwa pesan notifikasi sudah sampai. Hanya resi ini yang membuat pesan dianggap diterima.
_Avoid_: receipt, delivery report, centang

## Dokumen

**Dokumen**:
Berkas cetak resmi yang diterbitkan sistem atas nama instansi, misalnya ringkasan passport, lembar spesifikasi produk, atau laporan analitik.
_Avoid_: PDF (untuk konsepnya), laporan (tanpa keterangan), export
