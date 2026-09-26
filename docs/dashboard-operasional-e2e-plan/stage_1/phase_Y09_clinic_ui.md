# Y09 — Antrean, sesi konsultasi, FAQ dan hotline

- **Stage:** kuning; **ID:** M7-13, M7-14; juga UI penerima kontrak M7-11/M7-12 dari Y08. **Dependency:** Y08.
- **Baseline:** `/konsultasi` masih pengantar dengan tautan salah `/sign-uo`; `LandingFaq.vue` memuat tanggal program 2025.
- **Scope:** manifest Y09; pengalaman klinik publik dan dashboard petugas. N7-04/N7-05 menunggu R04.

## Implementasi

1. Buat landing klinik dengan enam poli, form empat langkah Y08, nomor tiket/konfirmasi yang dapat dibaca ulang, banner status notifikasi yang jujur, dan responsive mobile. Perbaiki tautan masuk yang rusak. Gunakan guard auth/pemilik dari Y01/Y08; isi prefill disunting hanya melalui alur data resmi.
2. Panel pendamping/dinas memberi Kanban dan daftar untuk Tiket Masuk → Jadwal Ditetapkan → Sesi Berjalan → Tindak Lanjut Rekomendasi → Selesai. Akses dibatasi penugasan/organisasi. Tampilkan flag PMSE mendesak, tautan video aman, catatan diagnosis, rencana aksi, dan rujukan ke bantuan sarpras, pelatihan vokasi, mediasi Kementerian/SAPA UMKM, atau Talent Lab.
3. Setiap transisi status dan catatan mempunyai aktor/waktu/audit; hindari overwrite update konkuren. Tiket selesai tidak mengubah profil UMKM otomatis sampai R04. Publikasikan FAQ program dari konten terkurasi, hilangkan jadwal 2025 basi, tampilkan WhatsApp narahubung dinas yang dikonfigurasi/terverifikasi.

## Acceptance per ID

| ID | Input/aksi | Bukti |
| --- | --- | --- |
| M7-13 | Petugas berpindah lima status dan daftar/Kanban, tandai PMSE, tulis diagnosis/aksi/rujukan | Status/catatan persisted dan dibaca ulang; request lintas petugas ditolak; tautan video hanya untuk pihak berizin. |
| M7-14 | Pengunjung membuka FAQ dan tombol narahubung | Jawaban terkini dari konten kurasi, tanpa tanggal basi; WA mengarah ke nomor dinas yang benar. |
| Kontrak Y08 | Pemohon memakai form dan membaca tiket | Enam poli, prefill aman, slot dan berkas nyata; status provider tampil sesuai receipt. |

## State dan gate

- Uji tiket kosong, dua petugas mengubah status bersamaan, status melompat, sesi batal/no-show, catatan kosong, petugas tak berhak, FAQ tak tersedia, nomor hotline kosong. Aksi tidak sah harus gagal tanpa mengubah state.
- Gate: browser publik dan petugas mobile/desktop dengan API disposable, SQL readback histori, IDOR probes, link check, FAQ freshness, notifikasi provider sesuai gate Y08. Receipt membedakan bagian yang sudah dan belum provider-proven.
