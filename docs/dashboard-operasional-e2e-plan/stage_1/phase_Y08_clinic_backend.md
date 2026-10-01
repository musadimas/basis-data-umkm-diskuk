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

## Amendemen 27 September 2026 (sesi Y08)

Keputusan yang dikunci saat implementasi. Rincian perintah, respons API, dan readback SQL ada di
`receipt_Y08_clinic_backend.md`.

1. **Endpoint pencarian NIB/NIK publik dihapus.** `POST /lookup` tidak ada lagi; `GET /prefill`
   (sesi) hanya mengembalikan usaha milik akun yang login dan menolak anonim dengan 401. Alasan:
   setiap lookup NIB/NIK adalah oracle identitas, sedangkan brief hanya menuntut prefill milik
   sendiri. Konsekuensi: pengunjung anonim mengisi nama usaha sendiri dan tiketnya tersimpan
   sebagai `sumber_identitas = 'manual'` (belum terverifikasi). NIK tidak pernah masuk URL, log,
   atau payload; tidak ada query formulir publik yang membaca kolom NIK.
2. **Kontrak identitas tiket:** `pemohon` (akun), `sumber_identitas` (`sidt`/`manual`),
   `wa_consent`. Nama usaha milik usaha SIDT tidak dapat ditimpa payload.
3. **Baca ulang tiket pemohon** memakai `POST /tiket/lacak` dengan nomor tiket **dan** nomor
   WhatsApp yang dipakai saat memesan, ber-captcha; salah satu tidak cocok menghasilkan 404 yang
   sama seperti tiket tidak ada.
4. **Lampiran** tetap di folder privat "Lampiran Klinik" yang tidak dibuka policy mana pun, tetapi
   dibaca lewat `GET /lampiran/:fileId` dengan pemeriksaan pemohon/petugas (pemohon sendiri atau
   petugas klinik; pihak lain 404). Validasi berkas: sniff tipe dari byte pertama
   (PDF/JPEG/PNG/WebP), maksimal 3 berkas × 5 MB. Tidak ada pemindai anti-malware di infrastruktur
   ini, jadi klaim yang boleh dibuat hanya "tipe/konten dibatasi + folder privat", bukan "bebas
   malware".
5. **Kuota slot = satu tiket per (poli, tanggal, slot)** lewat unique index parsial
   `ux_konsultasi_tiket_slot` (`WHERE status <> 'batal'`): dua pemesan bersamaan menghasilkan satu
   201 dan satu 409 `SLOT_PENUH`. Batas waktu pemesanan: Senin–Jumat, besok sampai 30 hari ke
   depan (`Asia/Jakarta`). Kuota per slot dapat dinaikkan kemudian tanpa mengubah kontrak API.
6. **Outbox WhatsApp** `klinik_notifikasi`: idempotency key per (tiket, jenis[, status]), `consent`,
   `tujuan_terverifikasi` (true bila identitas tiket berasal dari SIDT), `template`, `payload`,
   `attempts` + backoff + `last_error`, `provider`, `provider_message_id`, `provider_status`,
   `provider_receipt`, `terkirim_at`, `diterima_at`. 2xx dari gateway hanya menandai `terkirim`;
   `diterima` hanya lewat callback resi `POST /notifikasi/receipt` (rahasia bersama, dibandingkan
   constant-time). Tanpa `WHATSAPP_GATEWAY_URL`, publisher tidak berjalan dan pesan tetap `pending`
   — laporan berbunyi `not provider-proven`.
7. **UI minimal di Y08:** `konsultasi.vue` dan `dashboard/klinik.vue` hanya disambungkan ke kontrak
   baru (prefill sesi, checkbox consent, status notifikasi, tautan lampiran) supaya aplikasi tidak
   putus setelah `/lookup` dihapus; pengalaman penuh M7-11…M7-14 tetap milik Y09.
8. **Scope manifest Y08 direkonsiliasi** dari entri pra-merge (path BFF Nuxt dan extension
   `directus-extension-operasional` yang sudah tidak ada) menjadi 18 entri kanonik pasca-merge.

Migrasi yang dipakai: `20260926S-klinik-poli-notifikasi.js` (menggantikan nama `20260926L` di
manifest pra-merge; `L`–`R` sudah terpakai kode hasil merge).
