# Y08 — Kontrak data dan API klinik konsultasi

- **Stage:** kuning; **owner utama:** M7-11, M7-12. **Dependency:** Y01.
- **Y09** mengonsumsi API ini untuk M7-11…M7-14; pencatatan coverage unik tetap menempatkan M7-11/M7-12 di Y08.
- **Scope:** manifest Y08; katalog enam poli, pencocokan identitas, tiket, slot, berkas, pesan. Statistik dan integrasi profil otomatis N7-04/N7-05 menunggu R04.

## Implementasi

1. Definisikan enam poli persis sesuai `requirements.md`: Legalitas & Standardisasi Produk, Manajemen & Keuangan, Pemasaran & Transformasi Digital, Advokasi & Mediasi PMSE, Akses Bantuan Pemerintah, Inklusif & Disabilitas. Simpan subtopik dan konten yang dapat diedit admin; API publik hanya mengeluarkan konten poli.
2. Validasi NIB/NIK terhadap SIDT secara aman: pengguna login atau challenge kepemilikan yang benar dapat prefill usaha sendiri; endpoint publik tidak boleh menjadi oracle NIK/NIB. Jangan tampilkan NIK mentah atau memakai NIK di URL/log. Tetapkan fallback manual jika data SIDT tidak tersedia dengan status belum terverifikasi.
3. Tiket dibuat dari poli, uraian masalah, lampiran privat, pilihan daring/tatap muka, dan slot yang masih bebas. Nomor tiket unik; pemesanan slot transaksi atomik dengan kuota dan batas waktu. Workflow status awal dapat ditindaklanjuti Y09. Validasi file, anti-malware/tipe/ukuran sesuai infrastruktur, dan hak baca hanya pemohon/petugas terkait.
4. Setelah commit tiket, jadwalkan notifikasi WhatsApp via outbox idempotent. Simpan consent, nomor terverifikasi, template, provider message ID/receipt, retry dan kegagalan. Jangan menandai `sent` hanya dari 2xx request bila provider membutuhkan callback.

## Acceptance per ID

| ID | Input/aksi | Hasil dan bukti |
| --- | --- | --- |
| M7-11 | GET katalog poli tanpa login | Enam judul dan subtopik lengkap, DTO publik tanpa PII. |
| M7-12 | Prefill milik sendiri, pilih poli, uraian, upload, modus/slot, submit | Tiket unik dan slot persisted; pemohon dapat baca ulang; WA receipt cocok dengan tiket. |

## State dan gate

- Uji NIK milik orang lain, NIB ganda, SIDT tidak tersedia, form tanpa poli, lampiran gagal/berbahaya, slot penuh, dua pemesan bersamaan, dua submit sama, provider gagal/retry, cancellation. API harus memberi error aman dan tidak membocorkan keberadaan identitas.
- Gate: schema+rollback disposable, test kontrak/IDOR/concurrency, SQL readback tiket/slot/outbox, provider sandbox receipt. Jika tidak ada provider, laporkan `not provider-proven` dan pertahankan gate must-have terbuka.
