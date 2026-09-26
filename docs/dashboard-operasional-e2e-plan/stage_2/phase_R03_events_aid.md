# R03 — Pendaftaran kegiatan, e-pass/sertifikat, bantuan

- **Stage:** merah; **ID:** N7-01…N7-03. **Dependency:** Y10 done dan Y07.
- **Scope:** manifest R03; perluasan agenda publik. Event yang dulu hanya punya URL eksternal dapat tetap memakai URL itu; event internal memakai pendaftaran baru tanpa mengubah sejarah.

## Implementasi

1. Form daftar dari NIK/NIB dan SIDT hanya untuk identitas yang sudah dibuktikan pemiliknya. Isi profil otomatis, pakta integritas Non-ASN/TNI/Polri hanya pada event yang mensyaratkan, kebutuhan aksesibilitas, consent, validasi syarat wilayah/skala/NIB dan kuota. Endpoint publik tidak menjadi oracle NIK/NIB.
2. Buat pendaftaran status menunggu/diterima/ditolak/daftar tunggu dengan seleksi skor Talent Index, administrasi, asal wilayah; kebijakan skor dan keputusan dapat diaudit. E-pass QR unik dan notifikasi WhatsApp jadwal/lokasi/URL hanya untuk peserta diterima. Ekspor XLSX dibatasi admin; jangan bocorkan NIK.
3. Scan QR presensi idempotent, hitung persentase hadir dan penyelesaian tugas. Ambang ≥80% serta tugas membuka e-sertifikat QR bertanda/verifiable. Penerbitan memperbarui `bukti_pelatihan_manajemen` dan capaian Peningkatan Kapasitas SDM IP-UMKM secara atomik, dengan sumber/versi dan pembatalan bila sertifikat dicabut.
4. Halaman fasilitasi bantuan berisi delapan bentuk: penghargaan, beasiswa, operasional, sarpras produksi, sarpras pemasaran, revitalisasi/pembangunan gedung, permodalan/pembiayaan, dan bantuan pemerintah lainnya. Filter bentuk uang/barang/jasa, kuota tersisa dari sumber yang disetujui, dan hitung mundur masa pendaftaran dari waktu server. Jika tidak ada alur permohonan yang diminta, CTA menuju petunjuk/kanal resmi, bukan form fiktif.

## Acceptance per ID

| ID | Aksi | Bukti |
| --- | --- | --- |
| N7-01 | Daftar event eligible/non-eligible dengan prefill dan aksesibilitas | Data sendiri terisi, pakta bersyarat, syarat/kuota ditegakkan server. |
| N7-02 | Seleksi, WA, QR e-pass, scan hadir, tugas, sertifikat | Status/receipt/readback; QR tidak reusable lintas peserta; ≥80%+tugas mengubah dua indikator tepat sekali; XLSX valid. |
| N7-03 | Lihat 8 kartu, filter uang/barang/jasa, lewati deadline | Semua bantuan dan kuota tampil benar, countdown sesuai server, CTA resmi. |

## State dan gate

- Uji dua pendaftar untuk slot terakhir, daftar ulang, daftar tunggu naik, event batal, WA gagal, dua scan QR, hadir 79.9%, tugas gagal, sertifikat dicabut, kuota bantuan nol. Gate: schema/transaction, API role/PII/concurrency, provider sandbox WA, browser mobile/admin, parser QR/XLSX/PDF, readback indikator IP-UMKM.
