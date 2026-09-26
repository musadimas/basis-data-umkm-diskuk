# Phase 9 — Monitoring eksekutif Program Akselerasi (provinsi & kab/kota)

## Objective, dependencies, observable result

- **Dependency:** Phase 8 (`kpi-evaluasi.js`, `LineChart`, `TrenTargetRealisasi`).
- **Objective:** tab "Monitoring" di `/dashboard/akselerasi` (metrik rata-rata kenaikan omzet fase Accelerator vs baseline SIDT, tingkat kepatuhan laporan mingguan dengan target >95%, grafik garis target agregat (putus-putus) vs realisasi terverifikasi (tebal hijau) minggu 1–12, peta At-Risk berpin merah), kartu "KPI Program Akselerasi" (pipeline talenta + dua metrik) di Executive Summary; data diperbarui otomatis tiap 30 detik; kabkota terbatas wilayahnya.
- **Observable result:** dengan seed awal, provinsi melihat kepatuhan 80% (12 dari 15), kenaikan omzet 13,6%, tren minggu 1 target Rp 36.000.000 vs realisasi Rp 34.800.000, dan satu pin merah "Tahu Sumedang Bu Ika" (dua minggu <70% target).

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-9-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/extensions/directus-extension-operasional/src/monitoring-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/ringkasan-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/monitoring-service.test.cjs` |
| modify | `services/directus/extensions/directus-extension-operasional/test/ringkasan-service.test.cjs` |
| create | `apps/web/app/components/operasional/AtRiskMap.client.vue` |
| create | `apps/web/app/components/dashboard/card/KpiProgram.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/akselerasi/index.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/index.vue` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| modify | `apps/web/tests/e2e/akselerasi.spec.ts` |
| create | `apps/web/tests/e2e/monitoring.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/directus-extension-operasional/src/kpi-evaluasi.js::isAtRisk`, `capaianPersen`
- `services/directus/extensions/directus-extension-operasional/src/program-week.js::mingguKe`, `targetMingguan`
- `services/directus/extensions/directus-extension-operasional/src/ringkasan-service.js::getRingkasanEksekutif`
- `apps/web/app/components/dashboard/map/Choropleth.client.vue` (style MapLibre OSM raster + atribusi)
- `apps/web/app/pages/(private)/dashboard/akselerasi/index.vue` tab "Peserta Program" (Phase 7)
- `apps/web/app/pages/(private)/dashboard/index.vue` `<DashboardCardPermenAspek` (Phase 5)

```bash
rg -n "function isAtRisk|function capaianPersen" services/directus/extensions/directus-extension-operasional/src/kpi-evaluasi.js
rg -n "tile.openstreetmap.org" apps/web/app/components/dashboard/map/Choropleth.client.vue
rg -n "Peserta Program" "apps/web/app/pages/(private)/dashboard/akselerasi/index.vue"
rg -n "<DashboardCardPermenAspek" "apps/web/app/pages/(private)/dashboard/index.vue"
```

## Current contract and final desired contract

### Current

Tidak ada agregat monitoring; halaman akselerasi hanya daftar peserta/batch; Executive Summary tanpa KPI program.

### Final

- `monitoring-service.js`:
  - `muatPeserta(database, operator, batchId)` → talenta `accelerator|champion` (+ batch, `omzet_tahunan`, lat/lng usaha, pendamping, kota) dan seluruh laporannya; kabkota `talenta.kota = operator.kotaId`; `batchId` UUID opsional.
  - `hitungKpiProgram(peserta, now)` → `kepatuhan = { terkirim, diharapkan, persen, target: 95 }` dengan `mingguSelesai = min(mingguKe(tanggalMulai, now) − 1, jumlahMinggu)` (≥0) per peserta, `diharapkan = Σ mingguSelesai`, `terkirim = Σ laporan (status apa pun) dengan minggu_ke ≤ mingguSelesai`, `persen = round(terkirim/diharapkan × 1000)/10` atau null; `kenaikanOmzet = { persen, pesertaDihitung }` = rata-rata per peserta (baseline `omzet_tahunan/52` tidak null dan ≥1 laporan disetujui) dari `(rata-rata omzet disetujui − baseline)/baseline × 100`, dibulatkan 1 desimal, null bila 0 peserta.
  - `hitungTren(peserta)` → minggu 1…max `jumlahMinggu`: `target = Σ (target laporan minggu itu bila ada, selain itu targetMingguan saat ini)` atas peserta dengan `jumlahMinggu ≥ w` dan target tidak null; `realisasi = Σ omzet laporan disetujui minggu itu` atau null bila tidak ada.
  - `daftarAtRisk(peserta)` → peserta `isAtRisk` dengan koordinat: `[{ talentaId, usaha: { id, nama }, kota, pendamping, latitude, longitude }]` + `tanpaKoordinat` (jumlah).
  - `hitungPipeline(database, operator)` → `SELECT status, count(*) FROM talenta [WHERE kota = ?] GROUP BY status` → objek 7 status (0 bila tidak ada).
  - `getMonitoring(database, query, operator)` (DATA_ROLES) → `{ data: { kepatuhan, kenaikanOmzet, tren, atRisk: { items, tanpaKoordinat }, pipeline, batch: [{ id, nama }], diperbaruiPada: ISO } }`.
  - Route `GET /monitoring`.
- `ringkasan-service.js::getRingkasanEksekutif` menambah `program: { pipeline, kepatuhan, kenaikanOmzet }` (memakai fungsi di atas tanpa filter batch).
- Web:
  - `akselerasi/index.vue`: tab baru "Monitoring" menjadi tab default (urutan: Monitoring, Peserta Program); select batch (Semua / per batch); `useFetch("/panel/operasional/monitoring", { query: { batchId } })` + `setInterval(refresh, 30000)` dibersihkan di `onBeforeUnmount`; kartu "Rata-rata Kenaikan Omzet Pelaku Usaha Fase Accelerator" (`formatAnalyticsPercent`, keterangan "dibanding data dasar SIDT, {n} peserta"), kartu "Tingkat Kepatuhan Laporan Mingguan" (persen + "{terkirim} dari {diharapkan} laporan" + indikator "Target > 95%" hijau bila persen > 95, selain itu amber); `TrenTargetRealisasi` berjudul "Grafik Pertumbuhan: Target Rencana Agregat vs Realisasi Terverifikasi" dengan label seri "Target Rencana Agregat" (putus-putus) dan "Realisasi Penjualan Riil Terverifikasi" (hijau tebal); `AtRiskMap` berjudul "Peta Sebaran Pelaku Usaha Bermasalah (At-Risk Alert Map)" + daftar teks peserta at-risk (aksesibilitas) + keterangan "{tanpaKoordinat} peserta berisiko tanpa koordinat" bila >0; teks "Diperbarui {formatAnalyticsWib(diperbaruiPada)}".
  - `AtRiskMap.client.vue`: props `items`; root `data-testid="at-risk-map"`; MapLibre style OSM raster sama seperti Choropleth (source `osm`, atribusi "© OpenStreetMap contributors"), center `[107.6, -6.9]` zoom 7; source GeoJSON titik; layer `circle` warna `#dc2626`, radius 8, stroke putih 2; klik → popup (nama usaha, kota, "Pendamping: {nama}", tautan "Lihat Talenta" ke `/dashboard/talenta/<talentaId>`); fit bounds bila ≥1 titik; items kosong → overlay "Tidak ada pelaku usaha berisiko saat ini.".
  - `KpiProgram.vue`: judul "KPI Program Akselerasi"; 7 chip jumlah per status (`TALENTA_STATUS` label/warna); dua metrik (kepatuhan, kenaikan omzet); tautan "Buka Monitoring" → `/dashboard/akselerasi`.
  - `index.vue`: render `<DashboardCardKpiProgram :data="ringkasan?.program" />` tepat setelah `DashboardCardPermenAspek`.

## Ordered edits

1. `monitoring-service.js` + route + test memakai fixture yang mereplikasi seed Phase 7 (tanggal mulai = hari tes − 35, `now` tetap): kepatuhan `terkirim 12, diharapkan 15, persen 80`; kenaikan omzet `13.6` dengan `pesertaDihitung 3`; tren minggu 1 `target 36000000, realisasi 34800000`, minggu 3 `realisasi 25400000` (laporan 08 ditolak tidak dihitung), minggu 5 `realisasi null`; at-risk hanya usaha 02; pipeline kabkota memakai binding kota; batch UUID invalid → 400.
2. `ringkasan-service.js` + update test (bagian `program`).
3. Web: `AtRiskMap.client.vue`, `KpiProgram.vue`, `akselerasi/index.vue`, `index.vue`, tipe `MonitoringData`, `ProgramKpi`.
4. `akselerasi.spec.ts` (Phase 7): tambahkan klik tab "Peserta Program" sebelum aksi peserta (tab default kini "Monitoring"); assert lain tidak berubah.
5. Mock fixture: `GET /panel/operasional/monitoring` (angka seed di atas, 1 item at-risk dengan koordinat Sumedang) dan `ringkasan-eksekutif.program`.
6. `monitoring.spec.ts` (mock provinsi): tab Monitoring default; teks "80%" (`formatAnalyticsPercent(80)`), "12 dari 15 laporan", "13,6%"; grafik ter-render; tabel `sr-only` baris minggu 1 memuat "36.000.000" dan "34.800.000"; kontainer `getByTestId("at-risk-map")` terlihat (tanpa assert WebGL/kanvas, mengikuti pola `spasial.spec.ts`) dan daftar teks at-risk memuat "Tahu Sumedang Bu Ika"; request monitoring terulang setelah `page.clock` maju 30 detik (gunakan `page.clock.install()` sebelum navigasi); screenshot `monitoring-provinsi.png`; kabkota — select batch ada, data mock kabkota, screenshot `monitoring-kabkota.png`; Executive Summary menampilkan kartu "KPI Program Akselerasi".
7. `operasional.directus.spec.ts`: provinsi `/dashboard/akselerasi` → kepatuhan dan kenaikan omzet tampil (nilai numerik apa pun non-kosong, karena Phase 8 spec mengubah status laporan); kabkota Subang → daftar at-risk tidak memuat usaha Sumedang (kota lain).

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Batch belum mulai (minggu 0) → `diharapkan` 0 → kepatuhan null → UI "Belum ada minggu selesai".
- Peserta tanpa omzet SIDT → dikecualikan dari kenaikan omzet dan target agregat (dicatat `pesertaDihitung`).
- Laporan `ditolak` dihitung sebagai "terkirim" untuk kepatuhan (keputusan: kepatuhan mengukur penyetoran, bukan kualitas) tetapi tidak sebagai realisasi.
- Peserta `champion` tetap dihitung dalam monitoring.
- Pendamping/umkm → 403.
- Tab disembunyikan → interval tetap; saat unmount interval dibersihkan (tidak ada request setelah navigasi keluar).

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/components/operasional/AtRiskMap.client.vue app/components/dashboard/card/KpiProgram.vue "app/pages/(private)/dashboard/akselerasi/index.vue" "app/pages/(private)/dashboard/index.vue" app/types/operasional.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; screenshot `monitoring-provinsi.png`, `monitoring-kabkota.png`.

## Runtime/API proof and unproven boundary

Disposable stack + seed (sebelum menjalankan spec Phase 8 agar angka seed murni): `curl -s -b /tmp/prov.cookies http://127.0.0.1:8055/operasional/monitoring | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["kepatuhan"]["persen"], d["kenaikanOmzet"]["persen"], [i["usaha"]["nama"] for i in d["atRisk"]["items"]])'` (cookie provinsi dibuat seperti Phase 3) → `80.0 13.6 ['Tahu Sumedang Bu Ika']`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: tile OSM eksternal di jaringan kantor dan performa agregasi pada ratusan peserta.

## No-advance condition

Jangan lanjut bila angka seed tidak cocok dengan unit test, atau kabkota melihat peserta di luar wilayahnya.

## Required failure probes

- Unit: laporan `ditolak` tidak masuk realisasi tren.
- Unit: kabkota pipeline memakai filter kota.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-9-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 9
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit (tanpa migrasi). Handoff: monitoring selesai; Phase 10 berdiri sendiri di atas Phase 6.
