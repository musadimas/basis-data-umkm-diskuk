# Temuan Validasi Data Deployment

**Tanggal pemeriksaan:** 18 Agustus 2026
**Sifat dokumen:** fakta point-in-time, bukan invariant permanen
**Kredensial:** tidak dicatat

## 1. Metode

Pemeriksaan dilakukan read-only melalui:

- endpoint snapshot publik deployment;
- endpoint status/tabular/infografis;
- Directus Items API authenticated untuk aggregate count dan reference lookup;
- source repository untuk memahami query refresh dan semantik schema.

Tidak ada record PII yang diambil. Query authenticated hanya aggregate/reference data.

Repository evidence utama:

- `scripts/refresh-dashboard-snapshots.sql`
- `services/directus/migrations/20260816-create-infografis-snapshot.js`
- `services/directus/migrations/20260816B-create-usaha-tabular.js`
- `services/directus/extensions/directus-extension-tabular/src/index.js`
- `services/directus/migrations/20250801B-create-entrepreneurs.js`
- `services/directus/migrations/20250801C-create-businesses.js`
- `services/directus/migrations/20250801D-create-workforce-stats.js`
- `scripts/ingest-sidt-batch-end.sql`
- `docker-compose.yml`

## 2. Ringkasan hasil

| Pemeriksaan | Hasil |
|---|---:|
| Total base collection `usaha` | 5.429.638 |
| Total snapshot tabular/infografis | 5.429.638 |
| Selisih base versus snapshot | 0 |
| `usaha.alamat` null | 0 |
| `alamat.kelurahan` null pada usaha | 0 |
| Usaha terhubung ke Provinsi Jawa Barat | 5.429.638 |
| Reference provinsi | 1 (`JAWA BARAT`) |
| Kabupaten/kota administratif | 27 |
| Bucket sintetis `Tidak diketahui` | 1 bucket, 2 usaha |
| Snapshot refreshed at | 16 Agustus 2026 06:36:13 UTC / 13:36:13 WIB |

Kesimpulan point-in-time: pada pemeriksaan ini, refresh query yang memakai complete geography chain tidak membuang record `usaha`. Hal ini tidak membenarkan penggunaan silent inner join selamanya; fallback unmapped dan rekonsiliasi tetap wajib karena data masa depan dapat berbeda.

## 3. Scale coverage

Payload snapshot:

| Skala | Jumlah |
|---|---:|
| Mikro | 5.417.420 |
| Kecil | 9.550 |
| Menengah | 2.668 |
| Total | 5.429.638 |

Jumlah ketiga skala sama dengan total snapshot, sehingga tidak ada unknown scale pada point-in-time ini.

Semantik penting: repository memetakan label `skala_usaha` dari sumber; sistem tidak menghitung ulang skala dari omzet/aset. UI target harus menyebutnya **skala yang dilaporkan**.

## 4. KBLI coverage

| Status | Jumlah | Share |
|---|---:|---:|
| Mapped ke sektor A–U | 3.058.354 | 56,33% |
| Unclassified/unmapped | 2.371.284 | 43,67% |
| Total | 5.429.638 | 100% |

`Unclassified` di sini berarti kode tidak dapat dipetakan oleh aturan sektor dua-digit saat ini; ini belum membuktikan bahwa seluruh record tersebut tidak memiliki nilai KBLI. Profiling lanjutan harus memisahkan missing, nonnumeric, invalid/out-of-range, dan mapping gap. Ini merupakan risiko kualitas terbesar yang terlihat pada snapshot. Semua grafik KBLI wajib:

- menampilkan coverage;
- menjaga `mapped + unmapped = total`;
- menyediakan bucket unclassified;
- tidak menyamakan kode KBLI lengkap dengan sektor A–U;
- tidak menyembunyikan 43,67% dari denominator.

## 5. Geography

Snapshot memiliki 27 kabupaten/kota administratif Jawa Barat dan satu bucket sintetis **Tidak diketahui** berisi dua usaha. Jumlah seluruh region sama dengan total snapshot.

Target hierarchy:

```text
Jawa Barat → Kabupaten/Kota → Kecamatan → Desa/Kelurahan → Usaha
```

Required regression checks setelah setiap publish:

- total per region + unmapped = total scope;
- tidak ada record hilang akibat null chain;
- reference name/id tidak null pada response option;
- bucket sintetis dibedakan dari kabupaten/kota administratif.

## 6. Workforce risk

Snapshot saat ini memuat:

- laki-laki: 2.494.883;
- perempuan: 1.876.350;
- total: 4.371.233.

Namun refresh SQL menjumlahkan paid/unpaid dan kolom berlabel disabilitas. Repository tidak membuktikan apakah kolom disabilitas adalah subset atau tambahan. Angka snapshot tersebut harus dianggap **belum tervalidasi secara semantik** dan tidak menjadi metric resmi baru sampai data dictionary/source owner mengonfirmasi definisinya.

Missing workforce yang dinormalisasi menjadi nol juga berpotensi tidak dapat dibedakan dari true zero.

## 7. Gap legacy versus target

### Sector percentage

Legacy SQL menghitung `sector total / largest sector total`. Target product mendefinisikan share sebagai:

```text
sector total / seluruh hasil filter
```

Response baru tidak boleh memakai legacy `percentage` tanpa mengganti definisi/label.

### Top KBLI label

Legacy `topKbli` mengelompokkan kode KBLI lengkap, sementara beberapa label UI menyebut “kategori”. Target wajib menyebut level eksplisit: sektor A–U, divisi dua digit, atau kode KBLI lengkap.

### Current-only snapshot

`infografis_snapshot` adalah singleton yang dioverwrite dan `usaha_tabular` dibangun ulang. Belum ada series snapshot untuk tren. Timestamp database/source saat ini juga belum cukup menjadi histori perubahan usaha yang sah.

### Ingestion behavior

Bulk ingest saat ini berorientasi insert/dedupe dan memakai pola `ON CONFLICT … DO NOTHING` untuk usaha/workforce yang sudah ada. Artinya repeated source import belum membuktikan bahwa perubahan terhadap record existing akan memperbarui current state. `pulled_at`/source update time juga tidak seluruhnya dipersist sebagai event domain yang dapat dipakai untuk tren. Karena itu:

- sebelum menjanjikan “selalu terbaru”, implementasikan update/upsert dan reconciliation semantics yang sah;
- jangan memakai database insert time sebagai waktu kejadian bisnis;
- jangan menyatakan pertumbuhan;
- desain history baru harus memiliki as-of/event semantics eksplisit.

### Public endpoints

Source extension saat pemeriksaan mendokumentasikan beberapa read endpoint sebagai publik. Keputusan target adalah menjadikan seluruh dashboard API privat. Ini adalah gap implementasi, bukan fakta yang sudah selesai.

### Archive

Target memakai archive Directus, tetapi schema `usaha` saat baseline belum boleh diasumsikan telah memiliki archive status yang dikonfigurasi. Implementasi perlu menambah/mengaktifkan semantics archive sebelum filter aktif/arsip dianggap selesai.

## 8. Security/deployment blockers yang terverifikasi

Pemeriksaan repository menemukan material TLS/ACME yang ter-track di bawah `services/caddy/data`, termasuk file berekstensi `.key`, serta runtime state Caddy. Jangan menyalin isi key ke issue/log/dokumen. Sebelum release:

1. Hentikan tracking runtime/key material.
2. Rotasi ACME account key dan certificate private key yang terdampak.
3. Audit sejarah repository dan distribusi clone; lakukan history cleanup sesuai prosedur organisasi bila diperlukan.
4. Pastikan hanya public certificate yang boleh dipublikasikan bila benar-benar diperlukan.

`docker-compose.yml` baseline juga mem-publish port PostgreSQL, MinIO, MinIO Console, Directus, dan web. Target private dashboard harus memakai Caddy-only ingress atau firewall/bind yang eksplisit; database/object storage/admin port tidak boleh terbuka ke internet tanpa kebutuhan dan control terdokumentasi.

Konfigurasi PWA baseline memakai `CacheFirst` untuk `/panel/assets`. Bila asset dapat bersifat private, aturan ini harus dikeluarkan atau dipisahkan berdasarkan authorization dan cache dibersihkan pada logout.

Temuan ini adalah release blocker terpisah dari fitur Analitik.

## 9. Counting identity

Counting key metric adalah:

```text
COUNT DISTINCT usaha.id
```

`usaha.id` adalah UUID internal. `sumber_id` dipakai proses ingest untuk mengenali source record non-null, tetapi tidak boleh diasumsikan selalu tersedia tanpa quality check. NIB bukan counting key; null/normalization dan uniqueness harus dilaporkan sebagai kualitas identifier.

## 10. Pre-implementation validation gate

Sebelum coding/publish target:

1. Ulangi semua aggregate point-in-time di atas.
2. Bandingkan base `usaha` dengan target active read model.
3. Hitung null/unmapped untuk setiap hierarchy level.
4. Validasi mapping KBLI dan sample unclassified tanpa mengekspos PII.
5. Konfirmasi semantik workforce dengan data owner/source dictionary.
6. Ukur coverage/null/range modal, omzet, dan aset sebelum mengaktifkan aggregate.
7. Verifikasi archive semantics.
8. Benchmark filter/dimension pada volume deployment.
9. Verifikasi seluruh endpoint target menolak public access.
10. Jalankan PII leakage tests untuk profile, URL, export, dan log.

## 11. Query rekonsiliasi minimum

Secara konseptual, publish hanya valid jika:

```text
base_scope_total = analytics_total
sum(region buckets) + region_unmapped = analytics_total
sum(scale buckets) + scale_unknown = analytics_total
kbli_mapped + kbli_unmapped = analytics_total
```

Setiap kegagalan menahan aktivasi versi baru dan dicatat ke `analitik_health` sebagai record `reconciliation`/incident yang tersanitasi.
