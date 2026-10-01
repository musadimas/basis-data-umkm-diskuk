# ADR-006: Optimasi Hot-Path Analitik (Rollup Per-Generasi, Single-Scan, Cache Klien)

- **Status:** Accepted
- **Tanggal:** 21 Agustus 2026
- **Keputusan target:** diimplementasikan pada `analitik_dim_aggregate`, `directus-extension-analitik`, dan `useAnalyticsQuery`

## Context

Volume produksi ±5,5 juta baris. Halaman analitik adalah permukaan dengan frekuensi pergantian konfigurasi tertinggi: user aktif berganti dimensi, filter, dan drill-down. Pengukuran sebelum perubahan:

- Setiap apply memicu dua statement SQL berurutan atas WHERE yang sama (GROUP BY + COUNT) — I/O fact table dobel.
- GROUP BY unfiltered hanya kebagian fast path untuk kota/skala; dimensi lain selalu memindai `analitik_usaha_current`.
- Setiap request menjalankan ulang lookup active generation + load registry `analitik_field`.
- Klien mengeksekusi query dua kali per page load (SSR + hydration, raw `$fetch` tidak masuk payload Nuxt), berurutan antara aggregate dan records, tanpa cache antar konfigurasi.

## Decision

1. **Rollup dimensi per generasi.** Worker mengisi `analitik_dim_aggregate(generation_id, dimension, dimension_value, label, status, value)` sebelum promotion (satu statement UNION ALL, ekspresi wajib sinkron dengan `DIMENSIONS` di `query-compiler.js`). API menjawab GROUP BY satu dimensi tanpa filter dari tabel ini; generasi lama otomatis terhapus via `ON DELETE CASCADE`. Ini bukan cube kombinasi filter — tetap mematuhi ADR-002 #7.
2. **Single-scan aggregate.** Jalur umum menggabungkan GROUP BY dan matched total dalam satu scan via `SUM(COUNT(*)) OVER ()`, menggantikan dua statement berurutan.
3. **Runtime cache in-process ber-TTL.** Active generation (5 detik) dan registry (60 detik) dicache dalam proses; TTL jauh di dalam SLO freshness ≤60 detik. Nilai cache diperlakukan immutable oleh pemanggil.
4. **Cache klien per konfigurasi kanonik.** `useAnalyticsQuery` bermigrasi ke TanStack Query (sudah terpasang) dengan key kanonik (`canonicalAggregateKey`/`canonicalRecordsKey`) yang hanya mencakup input yang mengubah respons server — visual/page/cursor tidak ikut, urutan filter/value dinormalisasi. staleTime 60 detik dengan revalidasi latar (stale-while-revalidate); key TIDAK mengandung `"cache"` sehingga tidak pernah persist ke web storage (privasi).
5. **Paralel aggregate + records.** Halaman records hanya bergantung pada filters+sort, bukan respons aggregate; halaman pertama records kini dimuat paralel.
6. **Satu eksekusi SSR.** Melalui dehydration/hydration Vue Query yang sudah disiapkan plugin, query tidak lagi dieksekusi ganda (server + klien).
7. **Shared cache agregat Redis (amendemen 24 Agustus 2026).** Respons privat `POST /analitik/query` dicache lima menit berdasarkan query tervalidasi, active generation, schema/masking, registry, dan permission scope. Records/profil tidak dicache. Redis bersifat fail-open; kegagalan cache kembali ke PostgreSQL tanpa menggagalkan request.

## Consequences

### Positive

- GROUP BY unfiltered semua dimensi menjadi indexed lookup kecil, bukan scan 5,5 juta baris.
- I/O fact table untuk jalur terfilter/breakdown turun ±50% (satu scan).
- Dua round-trip lookup hilang per request (source + registry).
- Pergantian antar konfigurasi yang pernah dibuka langsung paint dari cache; revalidasi latar menyegarkan tanpa loading state.
- Konfigurasi populer lintas sesi/instance tidak mengulang query agregat PostgreSQL selama namespace generasinya sama.
- Hemat satu round-trip per apply (paralel) dan ~50% eksekusi hilang di page load (SSR tunggal).

### Negative

- Rollup menambah durasi rebuild (±11 pass GROUP BY atas candidate) dan penyimpanan (±puluhan ribu baris per generasi).
- Ekspresi rollup dan compiler harus disinkronkan manual; test worker mengunci jumlah dimensinya.
- Staleness klien hingga 60 detik setelah promotion sebelum revalidasi latar selesai — tetap dalam SLO, tapi terlihat berbeda dari perilaku refetch-penuh sebelumnya.
- Cache runtime membuat deployment yang mengubah registry/generation harus menunggu TTL atau restart untuk konsistensi penuh.
- Query kombinasi baru tetap membayar biaya PostgreSQL pada cache miss pertama; Redis bukan pengganti index dan rollup.

## Alternatives rejected/deferred

- **Cube semua kombinasi filter** — melanggar batas ADR-002 #7; kardinalitas kombinatorik tidak perlu untuk pola pemakaian saat ini.
- **Materialized view PostgreSQL** — tidak memberi versioning per generasi dan refresh-nya tidak atomik dengan promotion.
- **Invalidasi klien berbasis dataAsOf** — berisiko loop refetch pada query yang baru saja melaporkan perubahan; staleTime + revalidasi latar dipilih karena lebih sederhana dengan bound yang sama.
