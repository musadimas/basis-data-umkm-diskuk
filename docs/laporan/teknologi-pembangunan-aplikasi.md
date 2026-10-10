# Teknologi Pembangunan Aplikasi

Sistem Basis Data UMKM DISKUK Jawa Barat dibangun sebagai aplikasi web dengan arsitektur terpisah antara antarmuka pengguna (frontend), layanan API dan data (backend), pemroses analitik, serta infrastruktur pendukung. Seluruh komponen ditulis dalam JavaScript/TypeScript di atas runtime Node.js dan dijalankan sebagai kontainer Docker.

## Gambaran arsitektur

| Lapisan | Komponen | Peran |
| --- | --- | --- |
| Antarmuka pengguna | Aplikasi web Nuxt | Halaman publik (katalog, kegiatan, klinik, investor, dashboard publik) dan panel privat untuk setiap peran |
| Layanan API dan data | Directus dengan extension khusus | Autentikasi, otorisasi per peran dan wilayah, serta seluruh logika bisnis (program, katalog, klinik, kegiatan, analitik) |
| Pemroses analitik | Analytics worker | Membangun ulang dan merekonsiliasi model baca analitik serta memproses ekspor data di proses terpisah |
| Penyimpanan data | PostgreSQL + PostGIS, PgBouncer, Redis, MinIO | Basis data relasional dan spasial, pooling koneksi, cache, serta penyimpanan berkas |
| Gerbang dan operasional | Caddy, Docker Compose | Reverse proxy berikut HTTPS, serta orkestrasi seluruh layanan |

Alur data utama: setiap perubahan data (CRUD atau impor) dicatat ke antrean pekerjaan analitik dalam transaksi yang sama. Analytics worker kemudian mengambil pekerjaan tersebut, membangun model baca analitik per generasi, merekonsiliasinya, lalu mempromosikan hasilnya secara atomik sehingga dashboard selalu membaca data yang konsisten.

## Frontend

| Teknologi | Versi | Kegunaan |
| --- | --- | --- |
| Nuxt | 4.5 | Framework aplikasi web berbasis Vue dengan server-side rendering serta rute publik dan privat |
| Vue | 3.5 | Library komponen antarmuka |
| TypeScript | 5.9 | Bahasa pemrograman dengan pemeriksaan tipe statis |
| Tailwind CSS | 4.3 | Framework CSS berbasis utility |
| shadcn-nuxt dan Reka UI | 2.8 / 2.10 | Komponen antarmuka yang aksesibel (dialog, select, tabel, dan lainnya) |
| Pinia | 1.0 | Manajemen state aplikasi |
| TanStack Vue Query | 5.101 | Pengambilan, cache, dan sinkronisasi data dari API |
| Directus SDK | 24 | Klien resmi untuk berkomunikasi dengan API Directus |
| MapLibre GL dan PMTiles | 6.3 / 4.5 | Peta interaktif dan tileset spasial wilayah Jawa Barat |
| Unovis | 1.6 | Grafik dan visualisasi data pada dashboard analitik |
| Vite PWA | 1.1 | Dukungan Progressive Web App, termasuk antrean laporan saat luring |
| ALTCHA | 3.2 | Captcha berbasis proof-of-work untuk formulir publik dan login |
| GSAP, Lenis, Embla Carousel | — | Animasi, smooth scrolling, dan carousel pada halaman publik |

## Backend

| Teknologi | Versi | Kegunaan |
| --- | --- | --- |
| Node.js | 22 (LTS) | Runtime JavaScript untuk seluruh layanan |
| Directus | 11.17.4 | Platform headless CMS/API: manajemen pengguna dan peran, REST API, berkas, serta Data Studio |
| Extension Directus khusus | — | Endpoint domain `/v1/program` (talent, KPI, katalog, passport, klinik, kegiatan, registrasi, fasilitasi, peta, eksekutif), `/v1/analytics` (analisis, infografis, tabular), `/v1/auth`, dan `/operasional` |
| Argon2 | 0.44 | Hashing kata sandi |
| node-postgres (pg) | 8.16 | Akses PostgreSQL dari analytics worker |
| PptxGenJS dan uqr | 4.0 / 0.1 | Pembuatan dokumen ekspor dan kode QR |

Otorisasi dijalankan di setiap endpoint berdasarkan **peran** (Admin Provinsi, Admin Kab/Kota, Pendamping, Pelaku UMKM) dan **cakupan wilayah** pemanggil, sehingga setiap pengguna hanya dapat melihat dan mengubah data dalam cakupannya.

## Basis data dan penyimpanan

| Teknologi | Versi | Kegunaan |
| --- | --- | --- |
| PostgreSQL | 15 | Basis data relasional utama |
| PostGIS | 3.3 | Ekstensi data spasial untuk geometri provinsi, kabupaten/kota, kecamatan, dan kelurahan |
| PgBouncer | — | Connection pooling antara aplikasi dan PostgreSQL |
| Redis | 7.4 | Cache dan penyimpanan sementara Directus |
| MinIO | 2025-09 | Object storage kompatibel S3 untuk foto produk, lampiran tiket, dan dokumen PDF |
| WAL-G | — | Pencadangan berkelanjutan dan pemulihan point-in-time (PITR) basis data |

## Infrastruktur dan deployment

| Teknologi | Versi | Kegunaan |
| --- | --- | --- |
| Docker dan Docker Compose | — | Menjalankan seluruh layanan sebagai kontainer: PostGIS, PgBouncer, Redis, MinIO, Directus, web, analytics worker, dan Caddy |
| Caddy | 2 | Reverse proxy dan HTTPS otomatis |
| pnpm | ≥ 9.5 | Manajer paket untuk monorepo |
| Mailpit | — | Server email uji pada lingkungan pengembangan |

## Pengujian dan kualitas kode

| Teknologi | Versi | Kegunaan |
| --- | --- | --- |
| Vitest | 3.2 | Pengujian unit aplikasi web |
| Playwright | 1.55 | Pengujian end-to-end pada browser |
| Node.js test runner | 22 | Pengujian kontrak Directus, extension, dan analytics worker, termasuk pengujian terhadap PostgreSQL nyata |
| vue-tsc | 2.2 | Pemeriksaan tipe komponen Vue |
| ESLint dan Oxlint | 9.39 / 1.78 | Analisis statis untuk menjaga konsistensi dan kualitas kode |
