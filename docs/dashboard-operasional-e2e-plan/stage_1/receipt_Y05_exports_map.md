# Receipt Y05 — Ekspor, popup peta, pencarian Tabular, basemap satelit

- **Tanggal:** 29 September 2026 (sesi penutup bagian Y05 dari gate Y10).
- **Verdict phase: `partial`** — M2-01, M6-05, pencarian Tabular (sisi server) dan basemap satelit terbukti runtime pada klon terisolasi; **M3-01 (popup pin real-API) belum dibuktikan**, UI Tabular real-API dan browser mobile belum dijalankan, dan provider tile/lisensi belum dikonfirmasi.
- **Isolasi:** DB `y05_clone` (`pg_dump diskuk | psql`, 8 usaha nyata + 300k baris sintetis khusus uji indeks), container sementara berawalan `y05-` (`y05-directus` port 8156 dengan ekstensi `analytics`/`program` dibangun dari sumber saat ini di salinan scratch, `y05-worker-1..3` dari `docker/Dockerfile.analytics-worker` saat ini, volume `y05-exports`). Migrasi 28A–28H + 29A diterapkan lewat migrator resmi di klon. **Stack bersama `diskuk-operasional-e2e-*` dan DB `diskuk` tidak diubah** (probe read-only; versi migrasi `diskuk` tetap seperti semula, uptime container tidak berubah). Semua container/DB/volume/image `y05-*` sudah dihapus di akhir sesi.
- **Yang dijalankan bukan compose:** worker dijalankan dengan `docker run` dari Dockerfile + nama env yang sama dengan service `analytics-worker` di `docker-compose.yml` (volume ekspor dibagi dengan Directus seperti di compose). Bukti bukan dari `docker compose up` pada stack bersama.

## Verdict per ID

| ID | Verdict | Ringkasan bukti |
| --- | --- | --- |
| M2-01 | **done** (klon) | Worker dari sumber saat ini memproses job PDF/PNG/PPTX/detail-CSV/aggregate-CSV lewat API `POST /v1/analytics/analysis/exports` (provinsi dan kabkota Subang). PNG 900×560 (bukan 1×1), PDF A4 1 halaman, PPTX 3 slide (sampul, chart native, tabel), angka sama dengan `detail_csv` dan DB, filter dan cakupan wilayah kini tercantum di ketiganya. Lihat tabel bukti E1–E12. Batasan: PDF hanya baris teks (tanpa grafik), PNG memakai font bitmap 5×7 huruf besar. |
| M3-01 | **partial** | Hanya tes mock: kartu pin memuat field sesuai peran dan tidak bocor `nik`/`telepon` (`tabular-search-peta.spec.ts`, hijau pada sumber saat ini). **Klik pin dari kota berizin vs di luar scope pada API/browser nyata belum dijalankan** (`/v1/program/peta/*` tidak dipanggil di klon). |
| M6-05 | **done** (klon, data sintetis) | `GET /v1/program/passport/pdf/summary` dan `/pdf/katalog` sebagai pemilik usaha: sebelumnya **500 Postgres 42703** (bug, diperbaiki), sekarang PDF valid; QR di kedua PDF terdekode `http://…/passport/TP5RMTKPVE2N` = kode passport yang diterbitkan, `GET /verify/:kode` → `valid:true`; katalog memuat hanya produk berstatus `tayang` (produk `menunggu` tidak tampil); tanpa passport semua baris "Belum diterbitkan" tanpa QR. Akses usaha orang lain → 404, anonim → 401. Passport diterbitkan pada klon dengan menyisipkan `talent_pengajuan` `disetujui` lewat SQL (bukan jalur UI Y04). |
| Hijau: pencarian Tabular | **done (server)**, UI **mock saja** | Trigram + BitmapOr terpakai; EXPLAIN dan waktu HTTP pada 300k baris (tabel bukti T1–T6); jumlah hasil, paginasi, kosong, gabung filter, scope kota dari server; `q` < 3 karakter kini 400 (`Q_TOO_SHORT`) bukan 500. UI Playwright hijau terhadap sumber saat ini dengan mock; UI real-API belum. Akses beraksen (`Sumedáng`) **tidak** cocok (tidak ada `unaccent`). |
| Hijau: basemap satelit | **done** (browser mock-API, tile nyata) | Chromium: tile Esri (200 `image/jpeg`… 20 respons 200) muncul, atribusi Esri tampil; tetap satelit setelah terapkan filter (drill-down); kembali ke OSM menampilkan atribusi OSM; screenshot di `artifacts/Y05/basemap/`. **Provider tile/lisensi produksi belum dikonfirmasi** (perlu keputusan pemilik). |

## Bug ditemukan dan diperbaiki (minimal, dengan tes)

| # | Bug | Bukti sebelum | Perbaikan | Tes |
| --- | --- | --- | --- | --- |
| B1 | Ekstensi analytics membaca `process.env.DIRECTUS_SECRET`, tetapi compose meneruskannya ke container sebagai `SECRET`. Di produksi `getExportStatus`/`submitExport(aggregate_csv)` **selalu 500** ("DIRECTUS_SECRET is required"), dan Tabular/records/cursor memakai rahasia dev hardcoded (tanda tangan bisa ditebak). | GET `/exports/:id` → 500 di container | fallback ke `process.env.SECRET` di `exports-service.js`, `records-service.js`, `tabular/index.js` (2 tempat) | `analytics/test/export-secret.test.js` |
| B2 | `rebuildCurrentModel` mengembalikan `{skipped:"rebuild_locked"}` bila lock advisory dipegang job lain (mis. `reconcile`) dan job ditandai **completed tanpa generasi**. Terjadi nyata di klon: job rebuild `completed`, `analitik_generation` kosong, 3 job `reconcile` terus `ACTIVE_GENERATION_UNAVAILABLE`. | log worker + `analitik_generation` 0 baris | melempar `REBUILD_LOCKED` (dijadwalkan ulang seperti reconcile/activate) | `worker/test/export-filter-summary.test.js` |
| B3 | `workerId` default `worker-${pid}`; di container semua replika ber-PID 1 sehingga berbagi `lease_owner` (worker B dapat heartbeat/complete job worker A). | `lease_owner` = `worker-1` di semua container | `worker-${hostname}-${pid}` | idem |
| B4 | Teks "Data per …" di PDF/PNG/PPTX/profil dan "Diterbitkan Pada" di PDF passport memakai `Date.toString()` ("Mon Sep 28 2026 … (Coordinated Universal Time)"); `·` tampil `?` di PNG. | PDF/PNG di E1–E3 pertama | `dataAsOf`/`diterbitkan_at` → ISO; footer PNG memakai `-` | worker + `passport-pdf.test.js` |
| B5 | Filter canvas dan cakupan wilayah tidak tercantum di PDF/PNG/PPTX (acceptance M2-01 "filter tercantum"). | PDF hanya judul + baris grup | `ringkasanFilter()` → meta/baris PDF/PNG/sampul PPTX; kabkota tidak mengklaim filter kota klien yang dibuang compiler | idem |
| B6 | PDF profil mencetak `(0%)` di tiap baris. | `profile_pdf` awal | nilai teks tanpa persen | idem |
| B7 | `TabularQueryError` bernama bukan `DirectusError` → `q` pendek/cursor rusak menjadi **500**. | `q=ab` → 500 `INTERNAL_SERVER_ERROR` | nama `DirectusError` + `extensions` (bentuk `CakupanError`) | `tabular-search.test.js` |
| B8 | PDF passport `summary`/`katalog` memakai `ORDER BY date_created` pada `talent_passport` yang tidak punya kolom itu → **500 (42703) selalu**, tersembunyi karena tes memakai mock. | `curl` → 500, log `code: "42703"` | `ORDER BY diterbitkan_at` (2 query) | `passport-pdf.test.js` (mock menolak `date_created`) |
| B9 | Perf: `usaha.pelaku_usaha` tanpa indeks → arm pemilik pencarian melakukan Parallel Seq Scan atas seluruh `usaha`. 300k baris: 104,8 ms → **7,4 ms** (count), empty-result 38,9 → 0,08 ms dengan indeks. | `explain-*.out` | migrasi baru `20260929A-usaha-pelaku-usaha-index.js` (`CREATE INDEX CONCURRENTLY`), diterapkan lewat migrator, `down` membuangnya | readback `migration-run.log` (tanpa tes unit) |

**Belum diterapkan di stack bersama:** semua perbaikan hanya di sumber; image `directus`/`analytics-worker` pada stack bersama masih basi (worker tidak berjalan, image 26 Sep) dan migrasi 28A–H + 29A harus dijalankan di sana. Hanya klon yang membuktikan perilaku baru.

## Bukti (perintah → exit/readback → artefak di `stage_1/artifacts/Y05/`)

| # | Perintah / aksi | Readback | Artefak |
| --- | --- | --- | --- |
| E0 | `docker build -t y05-analytics-worker -f docker/Dockerfile.analytics-worker .` (konteks salinan sumber saat ini) lalu `docker run … y05-worker-1` | image terbangun (exit 0); worker: `registry_sync fieldCount 26`; generasi aktif 8 baris, job `project_record_change` 8 completed | `clone-final-state.log` |
| E1 | `POST /exports aggregate_png` (provinsi, filter `skala_dilaporkan = micro`, groupBy `kota_nama`) → poll → download | 202 → `completed` (4 grup) → 200 `image/png`; `identify`: **PNG 900×560 8-bit RGBA** | `prov/aggregate_png.png` |
| E2 | idem `aggregate_pdf` | 200; `pdfinfo`: 1 halaman A4; `pdftotext`: "Filter: skala dilaporkan = micro \| Cakupan: Provinsi Jawa Barat", Subang 3 (50%), Karawang 1, Sumedang 1, Cimahi 1 (total 6 = `detail_csv` 6 baris) | `prov/aggregate_pdf.pdf`, `pii-and-parse.log` |
| E3 | idem `aggregate_pptx` | 200; python-pptx: **3 slide**; chart native kategori [Subang, Karawang, Sumedang, Cimahi] nilai [3,1,1,1]; tabel 4 kolom kumulatif 100%; sampul memuat filter + cakupan; `unzip -l` 50 berkas | `prov/aggregate_pptx.pptx` |
| E4 | `detail_csv` + `aggregate_csv` | 6 baris usaha micro (kolom ID, nama, skala, kota, kecamatan, KBLI; tanpa NIK/telepon); agregat sama dengan PDF | `prov/*.csv` |
| E5 | sama untuk kabkota Subang (`kota_scope=1`) | semua tipe berhasil; hanya "Kabupaten Subang: 3 (100%)"; detail 3 baris; cakupan "kabupaten/kota ID 1" | `subang/*` |
| E6 | kabkota Subang mengirim filter klien `kota_nama = Kabupaten Sumedang` | tetap Subang 4 usaha (filter kota klien dibuang compiler), PDF "Filter: tanpa filter \| Cakupan: kabupaten/kota ID 1" | `subang-kotafilter/*` |
| E7 | scan PII 10 artefak: NIK kanari `3213012345678901`, telepon `081234567890`, 16 digit, `dummy_` | 0 temuan di CSV/PDF/PNG (PPTX dibaca via teks slide + `strings` tanpa temuan); catatan: profil/summary memuat NIK **bermasker** `************8901` dan telepon `08******7890` (masking v1, 4 digit akhir) | `pii-and-parse.log` |
| E8 | akses silang: kabkota membaca status/unduh job provinsi; unduh anonim; tanda tangan diubah; pendamping submit | 404 `EXPORT_NOT_FOUND`; 401; 403 `DOWNLOAD_FORBIDDEN`; 403 `FORBIDDEN`. `profile_pdf` usaha luar kota → 404 `PROFILE_NOT_FOUND`, dalam kota → PDF (NIK bermasker) | `scope-probes.log`, `profile/subang_in.pdf` |
| E9 | race klaim: 40 + 120 + 150 job `aggregate_pdf` diantrekan lalu 3 worker (masing-masing concurrency 2) | **150/150 `completed`, `attempts` min=max=1, 150 artefak berbeda** (klaim `FOR UPDATE SKIP LOCKED` tanpa ganda); setelah B3 `lease_owner` terlihat dua id container berbeda | `race-lease-owners.log` |
| E10 | siklus hidup: `cancelled`; `processing` dengan lease lewat; lease lewat pada `attempts=max`; job tanpa `permissionScope` (`max_attempts=1`); `tabular_csv` queued | `cancelled` tidak disentuh; lease lewat → direklamasi → `completed` `attempts=2`; `dead` `LEASE_EXHAUSTED`; `dead` `INVALID_ANALYSIS_CONFIG` (fail-closed tanpa snapshot scope); `tabular_csv` tetap `queued` (bukan urusan worker) | `lifecycle-jobs.log` |
| E11 | TTL/cleanup: `expiresAt` dimundurkan, `cleanupExpiredExports` | count 1; berkas dihapus dari volume; job `expired` `EXPORT_EXPIRED`, `request` tanpa `artifact`; API status `expired` tanpa `downloadUrl`; unduh URL lama → **410 `EXPORT_EXPIRED`** | `expiry-cleanup.log` |
| E12 | M6-05: `GET /passport/pdf/summary` dan `/pdf/katalog` sebagai pemilik | tanpa passport: 200 "Belum diterbitkan"; dengan passport `TP5RMTKPVE2N`: 200, skor 70/65/80/75 (rata-rata 72,5) + kinerja 66,67; produk tayang saja; QR terdekode (OpenCV `QRCodeDetector`) = `…/passport/TP5RMTKPVE2N` di kedua PDF; `usaha` orang lain 404, anonim 401 | `passport-pdf/*.pdf`, `passport-pdf/qr-decode.log` |
| T1 | `psql -f explain-tabular-search.sql` (300.008 baris; trigram dari migrasi 20260928B) | ada trigram: BitmapOr atas `idx_usaha_tabular_{nama,produk,kegiatan}_trgm` + `usaha_tabular_pkey` (arm pemilik), `idx_pelaku_usaha_nama_trgm`; count "lestari 1234" **104,8 ms**, rows halaman 1 **60,9 ms**, kota+search **86,6 ms**, kosong **38,9 ms**; tanpa trigram (rollback) count **294 ms**, Parallel Seq Scan | `explain-tabular-search.{sql,out}` |
| T2 | + `idx_usaha_pelaku_usaha` (B9) | count **7,4 ms**, kota+search **48,9 ms**, kosong **0,08 ms**; `usaha` tidak lagi di-seq-scan pada arm pemilik | `explain-with-pelaku-index.{sql,out}` |
| T3 | `POST /v1/analytics/tabular/query` (provinsi): "lestari 1234" halaman 1/2/9 | `filterCount 29`, halaman 1 = 10 baris, halaman 2 = 10 baris, halaman 9 = 0 baris (`hasNext:false`); waktu 113/40/32 ms — pencarian lintas halaman, bukan filter halaman aktif | `tabular-search-http.log` |
| T4 | q kosong hasil, q pendek, spasi/kapital, aksen, NIB | `zzzzqx` → 0 hasil 14 ms; `ab` → **400 Q_TOO_SHORT**; `  KERIPIK BANDUNG  ` → 4001 hasil (dipangkas, tidak peka kapital); `Sumedáng` → 0 hasil (tak ada `unaccent`); NIB 13 digit tak dikenal → 0 | idem |
| T5 | kombinasi filter + pencarian | `keripik` + `skala=micro`: `filterCount 20001` (dari 33.335) | idem |
| T6 | scope: kabkota Subang mencari `lestari`, dengan dan tanpa `kota_id=2` di body | hasil identik, `filterCount 6315` (kota dipaksa 1) | idem |
| S1 | `pnpm exec playwright test tabular-search-peta spasial tabular --project=chromium` terhadap `nuxt dev` saya sendiri (port 3111) dan mock Directus | **10/10 hijau** (validasi panjang, `q` di body POST, satelit toggle, kartu pin tanpa NIK, filter spasial, PMTiles fallback) | — |
| S2 | Chromium + tile nyata (`installMockDirectus` renderMap): OSM default → satelit → terapkan filter Kab. Bogor/Cibinong → kembali OSM | 20 respons 200 OSM sebelum satelit; 20 respons 200 Esri; saklar tetap `aria-checked=true` setelah filter; atribusi satelit "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics…" + BIG, atribusi OSM "© OpenStreetMap contributors" setelah kembali | `basemap/*.png`, `basemap/result.log` |
| G1 | `cd services/analytics-worker && node --test test/*.test.js` | **51/51** (sebelumnya 45 + 6 tes baru), exit 0 | `suites.log` |
| G2 | `cd services/directus/extensions/analytics && node --test test/*.test.js` | **107 pass / 1 skip**, 0 fail | `suites.log` |
| G3 | program (`test/*.test.js`) dan `services/directus/test/*.test.mjs` | program **167/167**; directus contract **51 pass / 3 skip (pg)** | `suites.log` |
| G4 | migrator: `20260929A` di klon | `Applying Usaha Pelaku Usaha Index… Database up to date`; `pg_indexes` memuat `idx_usaha_pelaku_usaha` | `migration-run.log` |

Hash SHA-256, ukuran, dan tipe berkas ada di `artifacts/Y05/sha256.txt`.

## Yang belum terbukti / sisa

1. **M3-01 real-API**: popup pin (kartu penuh, tautan detail benar, pin luar scope tidak muncul/ditolak) hanya diuji di mock; `/v1/program/peta/*` tidak diprobe di klon.
2. **UI real-API**: pencarian Tabular dan peta spasial belum dijalankan di browser terhadap Directus nyata; browser **mobile/tablet** tidak dijalankan (hanya chromium desktop). Catatan: Playwright default memakai ulang `nuxt dev` di port 3100 yang ternyata dijalankan dari **worktree agen lain** (kode lama: `GET ?q=` bukan `POST /query`) sehingga `tabular-search-peta` merah di sana; terhadap sumber saat ini hijau (S1). Gunakan `PLAYWRIGHT_BASE_URL` + server sendiri, atau pastikan 3100 milik worktree ini.
3. **Tile/lisensi provider**: Esri World Imagery dan tile.openstreetmap.org dipakai langsung dari klien; kebijakan penggunaan/lisensi produksi belum dikonfirmasi (kewajiban dari phase doc).
4. **Skala**: 300k baris sintetis, bukan 5,4M; istilah umum berkeselektifan tinggi lambat (`keripik` ≈ 33k hasil dari 300k: 1,6 s; + filter skala 3,0 s) — bukan bug indeks (ILIKE menyapu ~11% baris) tetapi tidak ada anggaran waktu yang dibuktikan di sini. Pencarian beraksen tidak didukung (`unaccent` tidak terpasang) — akan mengembalikan kosong.
5. **Bug potensial belum diperbaiki**: kunci advisory `diskuk.analytics.rebuild` diambil/dilepas lewat `pool.query` (koneksi bisa berbeda antara `pg_try_advisory_lock` dan `pg_advisory_unlock`, sehingga kunci bisa bocor pada koneksi lain sampai proses berhenti) — hanya dari pembacaan kode, tidak direproduksi.
6. PDF agregat hanya baris teks (tanpa grafik) dan PNG memakai font bitmap; profil/summary menampilkan NIK bermasker dengan 4 digit akhir sesuai masking v1 — keputusan produk apakah ini boleh.
7. Job "filter berubah selama job" tidak diuji ulang (snapshot `request.config` dan `permissionScope` disimpan saat submit, dan worker hanya membaca snapshot itu); retry/backoff diuji hanya sampai `dead` pada `max_attempts=1`, bukan jadwal 10/30/120/300/900 s. Penyimpanan objek memakai disk lokal volume, bukan MinIO.
8. Passport untuk bukti M6-05 dibuat dengan SQL (`talent_pengajuan` `disetujui`) pada klon; jalur UI Y04 (kurasi, foto, unduh QR di browser) tetap milik Y04.
9. **Stack bersama belum menjalankan kode ini**: perlu `docker compose … up -d --build analytics-worker directus`, migrasi 28A–H + 29A, kuras 12 job `queued` lama (di klon 12 job lama diproses normal; job `export` lama sudah dibatalkan oleh migrasi 28E), lalu ulangi E1–E12 di sana.

## Dampak ke Y10

Y05 tidak lagi memblokir Y10 karena "tidak ada receipt / tidak ada artefak / worker tidak berjalan": worker dari sumber saat ini berjalan, tiga tipe ekspor plus dua PDF passport diparse, indeks pencarian terbukti dipakai planner, dan dua perbaikan hijau punya bukti. Yang tersisa dari Y05 sebelum verdict `done`: butir 1–3 dan 9 di atas. Tidak menaikkan verdict Y04/Y07/Y08/Y09.

## Berkas yang diubah

- Worker: `services/analytics-worker/src/{exporter,export-renderer,queue,rebuild}.js`; tes baru `services/analytics-worker/test/export-filter-summary.test.js`.
- Analytics: `services/directus/extensions/analytics/src/endpoints/analysis/{exports-service,records-service}.js`, `src/endpoints/tabular/index.js`, `src/lib/utils/tabular-filter.js`; tes `test/export-secret.test.js` (baru), `test/tabular-search.test.js`.
- Program: `services/directus/extensions/program/src/endpoints/passport/pdf.js`, `test/passport-pdf.test.js`.
- Migrasi baru: `services/directus/migrations/20260929A-usaha-pelaku-usaha-index.js`.
- Dokumen: file ini dan `stage_1/artifacts/Y05/`.
