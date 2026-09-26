# ADR-002: Current-State Read Model dengan PostgreSQL Outbox dan Worker Terpisah

- **Status:** Accepted
- **Tanggal:** 18 Agustus 2026
- **Keputusan target:** diimplementasikan pada `services/analytics-worker`, trigger outbox, dan migrasi `analitik_*`; verifikasi runtime produksi (SLO ≤60 detik) belum dilakukan

## Context

Dataset deployment berukuran sekitar 5,4 juta usaha. Update diperkirakan jarang, tetapi perubahan yang sudah committed harus terlihat pada Analitik maksimal 60 detik. Current refresh menimpa singleton snapshot dan membangun ulang tabel aktif; pola tersebut tidak memberi histori, isolasi worker, ataupun last-known-good promotion yang kuat.

Produk memilih current-state analytics, bukan tren. Pengguna tidak boleh menunggu full refresh setelah setiap CRUD dan proses Directus utama tidak boleh menjalankan seluruh pekerjaan proyeksi berat.

## Decision

1. Gunakan `usaha.id` sebagai grain/immutable count key.
2. Tulis event outbox atomik pada transaksi yang sama dengan mutasi sumber.
3. Capture harus mencakup jalur Directus, import, dan raw SQL yang sah; database trigger atau explicit same-transaction integration dipilih berdasarkan audit implementasi, bukan after-action network call.
4. Jalankan Analytics Worker pada process/container terpisah.
5. Worker claim job singkat dengan `FOR UPDATE SKIP LOCKED`/lease, commit claim, lalu memproses tanpa menahan row lock sepanjang kalkulasi.
6. Job idempotent, dapat dicoalesce, retry eksponensial maksimal lima kali, dan berakhir `dead` bila tetap gagal.
7. Common aggregates/cache adalah optimasi; denormalized current row model tetap menjadi basis kombinasi filter dan drill-down.
8. Full rebuild memakai shadow/generation baru:
   - backfill;
   - replay tail sampai outbox high-water mark;
   - reconcile;
   - atomic active-pointer switch;
   - simpan previous generation sebagai last-known-good.
9. Jangan menampilkan histori/tren dari read model ini.
10. CRUD-to-active visibility SLO adalah ≤60 detik.

## Event dependencies

Perubahan pada entitas berikut dapat memicu proyeksi:

- `usaha`, status archive;
- `pelaku_usaha`;
- alamat dan hierarchy wilayah;
- `klasifikasi_usaha`;
- `statistik_tenaga_kerja`;
- schema/`analitik_field`.

Perubahan shared dimension memerlukan fan-out terkontrol atau rebuild, bukan update parsial yang meninggalkan data tidak konsisten.

## Consequences

### Positive

- Directus request thread tidak melakukan pekerjaan proyeksi berat.
- Event yang committed dapat direplay.
- Worker failure tidak menghapus last-known-good.
- Current read model dapat direkonsiliasi sebelum promotion.

### Negative

- PostgreSQL tetap menanggung beban query/proyeksi.
- Outbox, leases, generation, replay, dan reconciliation menambah kompleksitas.
- Duplicate disk/WAL perlu dihitung sebelum shadow build.
- Freshness ≤60 detik perlu capacity test; bukan hasil otomatis dari polling.

## Alternatives rejected/deferred

- **Full refresh synchronous per CRUD:** tidak layak untuk jutaan row.
- **Node worker_threads dalam Directus:** bukan failure/resource boundary.
- **Redis/BullMQ:** ditunda; update jarang dan PostgreSQL outbox cukup untuk MVP.
- **Database analitik terpisah/read replica:** roadmap jika isolation diperlukan.
- **Live browser aggregation:** melanggar performa dan security boundary.

## Invariants

- Event committed tidak hilang selama PostgreSQL selamat.
- Job yang dijalankan ulang tidak menggandakan aggregate.
- Candidate tidak aktif sebelum reconcile.
- `COUNT DISTINCT usaha.id` source scope sama dengan active model.
- `mapped + unmapped = total` pada dimensi wajib.

## Acceptance evidence required

- Worker kill/reclaim/replay test.
- Duplicate event/idempotency test.
- CRUD/import/raw SQL capture test.
- Backfill + tail replay + atomic promote test.
- 60-second freshness under representative load.
- Last-known-good test saat projection/reconciliation gagal.
