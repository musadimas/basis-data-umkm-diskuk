# Spesifikasi Analitik Basis Data UMKM

**Status:** baseline desain disetujui
**Tanggal:** 18 Agustus 2026
**Cakupan pekerjaan saat ini:** dokumentasi saja; belum merupakan bukti implementasi

Dokumen di direktori ini mendefinisikan target produk, domain, UX, API, operasi, dan roadmap untuk halaman **Analitik** pada Basis Data UMKM DisKUK Jawa Barat. Baseline ini berasal dari sesi discovery yang telah dikonfirmasi.

## Peta dokumen

| Dokumen | Isi |
|---|---|
| [Product specification](./product-spec.md) | Tujuan, ruang lingkup, kebutuhan fungsional, dan acceptance criteria |
| [Domain model dan glossary](./domain-model.md) | Grain, entitas, metrik, dimensi, field dinamis, dan istilah resmi |
| [UX specification](./ux-spec.md) | Struktur halaman, interaksi, visualisasi, profil UMKM, dan aksesibilitas |
| [API contract](./api-contract.md) | Kontrak konseptual endpoint Analitik dan aturan keamanan query |
| [Operations runbook](./operations-runbook.md) | Worker, outbox, health, retry, rekonsiliasi, RTO/RPO, dan recovery |
| [Temuan validasi data](./data-validation-findings.md) | Fakta deployment yang telah diverifikasi dan risiko kualitas data |
| [Roadmap](./roadmap.md) | Batas MVP dan evolusi menuju program/outcome serta histori |

Keputusan arsitektur berada di [`../architecture/decisions/`](../architecture/decisions/).

## Ringkasan keputusan

- Tambahkan `/dashboard/analitik`; pertahankan Infografis, Tabular, dan Spasial.
- Dashboard dan seluruh API datanya wajib privat dengan autentikasi Directus.
- Produk memakai satu canvas eksplorasi hybrid: template terarah yang tetap dapat dimodifikasi.
- Analitik hanya merepresentasikan **kondisi terkini**; tren belum boleh ditampilkan.
- Grain utama adalah satu record `usaha`; metric menghitung `COUNT DISTINCT usaha.id`, sedangkan `sumber_id` diperlakukan sebagai source key yang wajib dipantau kualitasnya.
- Perubahan data diproyeksikan ke read model Analitik maksimal 60 detik melalui worker terpisah dan PostgreSQL outbox.
- Field Directus baru didaftarkan otomatis dalam `analitik_field` tanpa mengorbankan keamanan atau kestabilan schema.
- Drill-down berakhir pada profil lengkap `/dashboard/umkm/:id`.
- NIK dan telepon selalu termasking pada Analitik; domisili pribadi tidak ditampilkan.
- Saved analysis menyimpan konfigurasi, bukan snapshot angka, catatan keputusan, atau shortlist.
- Detail teknis worker/queue tidak muncul pada canvas; pengguna hanya melihat waktu data dan pesan sederhana.
- Observability MVP memakai structured logs dan satu collection `analitik_health`; monitor eksternal belum termasuk.

## Bahasa normatif

- **MUST / wajib**: syarat yang tidak boleh dilanggar.
- **SHOULD / sebaiknya**: default yang hanya boleh dilanggar dengan alasan terdokumentasi.
- **MAY / boleh**: pilihan implementasi.

## Batas dokumen

Dokumen ini membedakan:

1. **Fakta saat ini** — diverifikasi dari repository atau deployment.
2. **Keputusan target** — perilaku yang harus dibangun kemudian.
3. **Roadmap** — belum termasuk MVP target.

Tidak ada token, password, NIK, nomor telepon, atau kredensial lain yang boleh ditulis ke dokumentasi maupun log.
