# Y07 — Agenda kegiatan publik dan pengingat

- **Stage:** kuning; **ID:** M7-07…M7-10. **Dependency:** Y01; dapat berjalan paralel Y02–Y06 setelah foundation.
- **Baseline:** belum ada model kegiatan terstruktur. Registrasi/tiket/sertifikat internal N7-01/N7-02 berada di R03.
- **Scope:** manifest Y07; model kegiatan, API publik, kalender/lini masa/detail, adapter pengingat. Jangan memberi kesan bahwa tombol Daftar Sekarang mengirim pendaftaran internal pada Stage 1.

## Implementasi

1. Model kegiatan memuat kategori, judul, silabus, narasumber, penyelenggara, metode, lokasi/URL, kuota dan sisa, batas daftar, tanggal zona WIB, syarat skala/wilayah/NIB, aksesibilitas, materi/dokumentasi, serta `registration_url` resmi bila tersedia. Berikan alur admin kurasi; hanya konten tayang diekspos publik.
2. API list/detail mendukung bulan/tahun, filter kategori, penyelenggara 27 dinas/provinsi/kementerian/mitra, metode, ramah disabilitas, dan status temporal. Kalender bulanan punya navigasi dan penanda hari ini; badge kategori pada tanggal; tooltip/focus card menampilkan judul, lokasi/platform, sisa kuota, batas registrasi. Mobile memakai tap, bukan hover saja.
3. Lini masa mengelompokkan Sedang Berjalan, Pendaftaran Dibuka, Segera Datang, Selesai & Dokumentasi dari waktu/status server. CTA diarahkan sesuai keadaan: tautan streaming/presensi eksternal resmi, `registration_url` resmi, pengingat, atau materi. Bila URL daftar belum ada, CTA dinonaktifkan dengan pesan jujur. Jangan membuat data pendaftar internal sampai R03.
4. Pengingat WhatsApp/email: simpan opt-in, jadwal, dan status pengiriman; gunakan adapter server/provider sandbox, idempotency dan unsubscribe. Jika gateway/kontrak belum tersedia, UI boleh menerima permintaan namun gate phase harus `not provider-proven` dan tidak mengklaim “terkirim”. Email juga memerlukan bukti receipt/delivery.

## Acceptance per ID

| ID | Input/aksi | Hasil dan bukti |
| --- | --- | --- |
| M7-07 | Navigasi bulan/tahun, pilih hari ini pada mobile/desktop | Kalender dan lini masa konsisten pada tanggal WIB. |
| M7-08 | Kombinasikan lima kategori, penyelenggara, metode, disabilitas | Hasil server dan count benar; semua 27 dinas tersedia sebagai opsi. |
| M7-09 | Buka badge, tooltip/tap, empat kelompok status dan tiap CTA | Judul/lokasi/sisa kuota/deadline benar; CTA sesuai status dan tidak menjanjikan registrasi internal. |
| M7-10 | Buka detail dari agenda | Silabus/narasumber/fasilitas/syarat/dokumen benar dan tautan resmi aman. |

## State dan gate

- Uji tanggal lintas bulan/tahun, event dibatalkan, kuota habis, deadline lewat, data kosong, URL eksternal tidak valid, dua opt-in pengingat, nomor tak valid, provider gagal/retry. Kendalikan race antara kurasi event dan job pengingat.
- Gate: migrasi dan API disposable, perhitungan status waktu, browser kalender/timeline/detail di mobile/desktop, receipt provider sandbox untuk pengingat atau status jelas `not provider-proven`. Tidak boleh menyatakan Stage 1 selesai penuh bila must-have pengingat belum dibuktikan.
