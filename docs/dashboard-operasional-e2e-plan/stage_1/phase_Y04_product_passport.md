# Y04 — Produk terkurasi, Talent Passport, dan Showroom

- **Stage:** kuning; **ID:** M6-01…M6-04 dan M7-06. **Dependency:** Y01, Y02.
- **Rujukan teknis:** `../legacy/phase_10.md` dan `../legacy/phase_11.md`.
- **Scope:** pemilik mengelola produk, provinsi mengurasi, Passport dan halaman verifikasi. Katalog publik memakai data ini pada Y06; investor directory N6 baru R02.

## Implementasi

1. Form produk privat menerima nama/deskripsi/KBLI, harga retail-grosir, maksimum lima foto, video, persentase bahan baku lokal, data dimensi/berat/masa kedaluwarsa, kapasitas dan stok. Validasi ukuran/tipe media dan hak milik. Status `Menunggu Verifikasi Kurasi → Tayang di Katalog` atau `Rekomendasi Marketplace Mitra` disimpan dengan alasan/timestamp; perubahan produk tayang kembali ke review bila field publik material berubah. Tampilkan pengingat larangan manipulasi transaksi dan kewajiban mutu.
2. Passport memakai identitas talenta yang disetujui dan kode QR unik. Nama penyimpanan `passport_kode` pada rancangan lama harus dipetakan secara eksplisit ke kontrak brief `qr_talent_passport_code` (alias API atau migrasi satu nama); jangan ada dua kode yang terlepas. QR menuju verifikasi publik dengan payload minimum dan tanda tangan Ed25519. Kunci privat dari runtime secret, rotasi/kid terdokumentasi. Klaim keterhubungan SIDT hanya jika data sumber/versi dapat diverifikasi.
3. Hitung radar 5 dimensi 0–100 dari field dan bukti sumber; data kosong tidak otomatis nilai sempurna. Badge 100% PDN, Siap Naik Kelas, dan legalitas aktif hanya tampil sebagai **terverifikasi** jika bukti dan pihak verifikator tercatat; deklarasi UMKM dibedakan. Showroom menampilkan video, foto multi-sudut, spesifikasi, kapasitas, bahan lokal, dan uji lab sesuai data tersedia.

## Acceptance per ID

| ID | Aksi nyata | Bukti wajib |
| --- | --- | --- |
| M6-01 | Unduh QR gambar/PDF, scan, ubah satu byte payload | QR unik menuju verifikasi; tanda tangan sah untuk payload asli dan gagal saat diubah; tidak mengungkap PII. |
| M6-02 | Buka Passport dengan lima skor dan satu sumber kosong | Radar interaktif 0–100, label/dimensi tepat, sumber dan versi skor tersedia. |
| M6-03 | Ubah bukti verifikasi PDN/legalitas lalu baca Passport | Badge hanya muncul setelah verifikasi sah; ambang Siap Naik Kelas konsisten. |
| M6-04 | Upload media dan spesifikasi, buka Showroom | Multi-sudut/video/spesifikasi sesuai produk, file tidak dapat diakses lintas pemilik sebelum kurasi. |
| M7-06 | Pemilik tambah/edit; kurator tayang/rekomendasikan | Field lengkap, batas 5 foto, tiga status dan pengingat; status persisted/readback. |

## State dan gate

- Uji draft kosong, file gagal, media tak aman, legalitas dicabut, produk diubah setelah tayang, dua kurator bersamaan, QR kedaluwarsa/rotasi, dan akses lintas usaha. Katalog publik belum boleh menampilkan draft.
- Gate: schema/file storage disposable, unit skor/tanda tangan, API role/PII, browser editor-kurasi-Passport-showroom-verifikasi. Receipt menyimpan contoh payload publik yang sudah disamarkan dan bukti PDF QR dibuka.
