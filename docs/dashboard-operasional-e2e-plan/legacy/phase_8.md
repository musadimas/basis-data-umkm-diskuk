# Phase 8 — Dasbor pendamping: binaan aktif, verifikasi laporan KPI, tren, dan rekomendasi pitching

## Objective, dependencies, observable result

- **Dependency:** Phase 7 (laporan mingguan, penugasan pendamping).
- **Objective:** pendamping melihat peserta binaannya, antrean verifikasi (Menunggu Persetujuan / Telah Disetujui / Belum Mengirimkan Laporan), modal pemeriksaan bukti dengan zoom dan perbandingan capaian vs target, catatan bimbingan + setujui/tolak, grafik garis target vs realisasi per peserta, dan centang rekomendasi Talent Investment Day/Champion setelah 4 pekan berturut-turut mencapai target.
- **Observable result:** akun `dummy_coach.pendamping@…` melihat 3 binaan (Wawan, Tahu Sumedang, Sambal Subang), menyetujui laporan minggu 5 Wawan ("Capaian 116,7% dari Target"), lalu centang rekomendasi Wawan menjadi aktif (4 pekan berturut-turut ≥ target: minggu 2–5).

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-8-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/extensions/directus-extension-operasional/src/kpi-evaluasi.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/binaan-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/kpi-evaluasi.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/binaan-service.test.cjs` |
| create | `apps/web/app/components/ui/chart-line/LineChart.vue` |
| create | `apps/web/app/components/ui/chart-line/index.ts` |
| create | `apps/web/app/components/operasional/BuktiZoomPreview.vue` |
| create | `apps/web/app/components/operasional/TrenTargetRealisasi.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/binaan/index.vue` |
| create | `apps/web/app/pages/(private)/dashboard/binaan/verifikasi.vue` |
| create | `apps/web/app/pages/(private)/dashboard/binaan/[talentaId].vue` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/pendamping.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/directus-extension-operasional/src/program-week.js::mingguKe`, `targetMingguan`
- `apps/web/app/components/ui/chart-bar/BarChart.vue` (pola `VisXYContainer`, `useMounted`, `defaultColors`)
- `apps/web/app/pages/(private)/dashboard/binaan/index.vue` (placeholder Phase 2)
- `@unovis/ts` `LineConfigInterface.lineDashArray`, `lineWidth` (number)

```bash
rg -n "function mingguKe|function targetMingguan" services/directus/extensions/directus-extension-operasional/src/program-week.js
rg -n "VisXYContainer|useMounted" apps/web/app/components/ui/chart-bar/BarChart.vue
rg -n "lineDashArray|lineWidth" apps/web/node_modules/@unovis/ts/components/line/config.d.ts
rg -n "Daftar peserta binaan akan tampil" "apps/web/app/pages/(private)/dashboard/binaan/index.vue"
```

## Current contract and final desired contract

### Current

Beranda pendamping placeholder; tidak ada endpoint verifikasi; tidak ada komponen grafik garis.

### Final

- `kpi-evaluasi.js` (murni, dipakai Phase 9):
  - `capaianPersen(omzet, target)` → `null` bila target null/0, selain itu `Math.round(omzet / target * 1000) / 10`.
  - `layakRekomendasi(laporan)` → `true` bila ada ≥4 minggu **berurutan** (`minggu_ke` naik 1) dengan `status = 'disetujui'`, target tidak null, dan `omzet >= target`.
  - `isAtRisk(laporan)` → `true` bila ada 2 minggu berurutan `disetujui` dengan target tidak null dan `omzet < 0.7 × target`.
  - Input: array `{ mingguKe, omzet, target, status }` tak berurutan (fungsi mengurutkan sendiri).
- `binaan-service.js` (pendamping: hanya `talenta.pendamping = operator.userId`; provinsi: semua; kabkota: `talenta.kota`):
  - `listBinaan(database, operator)` (pendamping) → talenta `accelerator|champion` milik pendamping: `[{ talentaId, usaha: { id, nama }, pemilik, kota, batch: { nama }, status, mingguBerjalan, jumlahMinggu, targetMingguan, statusMingguIni: "menunggu"|"disetujui"|"ditolak"|"belum", rekomendasiPitching, layakRekomendasi }]`.
  - `listAntrean(database, query, operator)` (pendamping) → `status` = `menunggu` (default: semua laporan `menunggu` milik binaan, urut `dikirim_pada ASC`), `disetujui` (laporan `disetujui` dengan `minggu_ke = mingguBerjalan` peserta), `belum` (peserta tanpa laporan apa pun untuk `mingguBerjalan`); item laporan `{ laporanId, talentaId, usaha, mingguKe, omzet, target, capaianPersen, dikirimPada, status }`, item belum `{ talentaId, usaha, mingguKe: mingguBerjalan }`.
  - `getLaporan(database, laporanId, operator)` (pendamping binaan, provinsi, kabkota scoped, umkm pemilik) → `{ laporanId, talentaId, usaha, pemilik, mingguKe, omzet, jumlahTransaksi, target, capaianPersen, catatanKendala, bukti: { id, tipe }, status, catatanPendamping, dikirimPada, diverifikasiOleh, diverifikasiPada }`; di luar cakupan → 404.
  - `verifikasiLaporan(database, laporanId, body, operator)` (pendamping binaan saja) → `keputusan` `disetujui|ditolak`; `catatan` wajib 3–1000 char bila `ditolak`, opsional ≤1000 bila `disetujui`; hanya dari `menunggu` (selain itu 409 `INVALID_TRANSITION`); set `status`, `catatan_pendamping`, `diverifikasi_oleh/pada`, `date_updated`.
  - `getBinaanDetail(database, talentaId, operator)` (pendamping binaan, provinsi, kabkota scoped) → `{ talentaId, usaha, pemilik, batch, status, mingguBerjalan, jumlahMinggu, targetMingguan, tren: [{ mingguKe: 1..jumlahMinggu, target: <target laporan atau targetMingguan saat ini>, realisasi: <omzet bila disetujui, selain itu null>, status: <status atau "belum"> }], laporan: [...], rekomendasiPitching, rekomendasiOleh, rekomendasiPada, layakRekomendasi }`.
  - `setRekomendasi(database, talentaId, body, operator)` (pendamping binaan saja) → `aktif: boolean`; `true` hanya bila `layakRekomendasi` (selain itu 409 `BELUM_LAYAK_REKOMENDASI`) dan status `accelerator`; `false` menghapus (`rekomendasi_oleh/pada = NULL`) kecuali status sudah `champion` (409 `INVALID_TRANSITION`).
  - Routes: `GET /binaan`, `GET /binaan/antrean`, `GET /binaan/:talentaId`, `POST /binaan/:talentaId/rekomendasi`, `GET /laporan/:id`, `POST /laporan/:id/verifikasi`.
- Web:
  - `ui/chart-line/LineChart.vue` (+ `index.ts` ekspor `LineChart`): props `data: { x: number; [key: string]: number | null }[]`, `series: { key: string; label: string; color: string; dashed?: boolean; width?: number }[]`, `xLabel?: string`, `yFormatter?: (value: number) => string`; satu `VisXYContainer` dengan satu `VisLine` per seri (`lineDashArray: dashed ? [6, 4] : undefined`, `lineWidth: width ?? 2`, `fallbackValue: undefined` sehingga garis terputus pada `null`), `VisAxis` x (label minggu) dan y (`yFormatter`), `VisCrosshair` + `VisTooltip`, legenda HTML di bawah; render hanya setelah `useMounted`; tabel `sr-only` berisi data (aksesibilitas).
  - `TrenTargetRealisasi.vue`: props `tren`; memanggil `LineChart` dengan seri `target` "Target KPI Mingguan" `#64748b` dashed dan `realisasi` "Realisasi Terverifikasi" `#16a34a` width 3; sumbu x "Minggu"; format `formatAnalyticsMetricValue(v, "IDR", true)`.
  - `BuktiZoomPreview.vue`: props `src`, `alt`; gambar `object-contain` dalam kontainer `overflow-auto` tinggi 60vh; tombol "Perbesar" / "Perkecil" / "Ukuran Asli" mengubah skala 1×–3× (step 0,5) via CSS `transform: scale()` dengan `transform-origin: top left`; klik gambar = toggle 1×/2×; PDF (tipe `application/pdf`) → tautan "Buka Bukti (PDF)".
  - `binaan/index.vue` (ganti placeholder): judul "Dasbor Binaan Aktif"; kartu per peserta (usaha, pemilik, kota, batch, `ProgresMingguan` ringkas, target minggu ini, badge `LAPORAN_STATUS[statusMingguIni]` atau "Belum Mengirimkan Laporan" `bg-slate-200`, badge "Direkomendasikan" bila `rekomendasiPitching`); tautan detail; tombol "Verifikasi Laporan KPI" → `/dashboard/binaan/verifikasi`; kosong → "Belum ada peserta binaan.".
  - `binaan/verifikasi.vue`: judul "Verifikasi Laporan KPI Mingguan"; chip filter "Menunggu Persetujuan" (default), "Telah Disetujui", "Belum Mengirimkan Laporan"; daftar; klik laporan → dialog "Pemeriksaan Bukti Fisik": `BuktiZoomPreview` (`berkasUrl(bukti.id)`), ringkasan "Realisasi Omzet {Rp} vs Target {Rp}" dan badge "Capaian {capaianPersen}% dari Target" (hijau ≥100, amber 70–99,9, merah <70; target null → "Target belum tersedia"), jumlah transaksi, catatan kendala UMKM, textarea "Catatan Saran Bimbingan Usaha & Verifikasi", tombol "Tolak & Minta Perbaikan Bukti" (validasi catatan ≥3 char) dan "Setujui & Verifikasi Laporan"; sukses → daftar di-refresh + `role="status"` "Laporan minggu ke-{m} {disetujui|dikembalikan untuk perbaikan}.".
  - `binaan/[talentaId].vue`: identitas peserta, `ProgresMingguan`, `TrenTargetRealisasi` (judul "Grafik Target KPI Mingguan vs Realisasi"), tabel laporan (minggu, omzet, target, capaian, status, catatan), kartu "Rekomendasi Kelayakan Pitching": checkbox "Rekomendasikan ke Talent Investment Day / Champion" (disabled bila `!layakRekomendasi` dengan keterangan "Aktif setelah 4 pekan berturut-turut mencapai target."; perubahan → `POST …/rekomendasi`).
  - `NAVIGATION_LINKS.pendamping` tambah `{ id: "verifikasi", label: "Verifikasi Laporan KPI", to: "/dashboard/binaan/verifikasi", icon: ClipboardCheck }`.

## Ordered edits

1. `kpi-evaluasi.js` + test (seed Wawan minggu 1–4 disetujui target 18.000.000: minggu 1 16,5 jt < target → run minggu 2–4 = 3 → `false`; setelah minggu 5 disetujui 21 jt → run 4 → `true`; celah minggu (2,3,5,6) tidak dihitung berurutan; Tahu minggu 2–3 < 70% → `isAtRisk true`; minggu `ditolak` memutus run; target null memutus run; `capaianPersen(21000000, 18000000)` → 116.7).
2. `binaan-service.js` + routes + test (pendamping lain → 404 detail/laporan/verifikasi; provinsi verifikasi → 403; verifikasi dari `disetujui` → 409; tolak tanpa catatan → 400; rekomendasi belum layak → 409; antrean `belum` berisi peserta tanpa laporan minggu berjalan; kabkota detail kota lain → 404).
3. Web: `LineChart.vue`, `index.ts`, `TrenTargetRealisasi.vue`, `BuktiZoomPreview.vue`, tiga halaman binaan, tipe (`Binaan`, `AntreanItem`, `LaporanDetail`, `BinaanDetail`, `TrenMinggu`), `NAVIGATION.ts`.
4. Mock fixture: `GET /panel/operasional/binaan` (3 peserta), `/binaan/antrean` per status, `/laporan/:id` (omzet 21000000, target 18000000, capaian 116.7, bukti id berkas mock), `POST /laporan/:id/verifikasi`, `/binaan/:talentaId` (tren 12 minggu, `layakRekomendasi: true`), `POST …/rekomendasi`, dan `GET /panel/operasional/berkas/:id` → PNG 1×1 (`content-type: image/png`).
5. `pendamping.spec.ts` (mock role pendamping): beranda 3 kartu, screenshot `binaan-dasbor.png`; verifikasi: buka laporan → teks "Capaian 116.7% dari Target" (format sesuai `formatAnalyticsPercent` → "116,7%"; assert memakai regex `/Capaian 116[,.]7% dari Target/`), klik "Perbesar" → gaya transform `scale(1.5)`, screenshot `verifikasi-modal.png`; "Tolak & Minta Perbaikan Bukti" tanpa catatan → pesan validasi; "Setujui & Verifikasi Laporan" → request body `{ keputusan: "disetujui", catatan }`; detail peserta → grafik ter-render (elemen `svg` di dalam kontainer chart) + tabel `sr-only` memuat 12 baris; centang rekomendasi → request `{ aktif: true }`; screenshot `binaan-detail.png`.
6. `operasional.directus.spec.ts`: coach login → `/dashboard/binaan` 3 peserta; verifikasi laporan minggu 5 Wawan → disetujui; detail Wawan → checkbox rekomendasi enabled → centang → tersimpan; laporan Tahu minggu 3 → tolak dengan catatan → status Wawan tetap; `page.request.get("/panel/operasional/binaan/<talenta usaha 03>")` → 404 (bukan binaan).

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Laporan yang dikirim ulang setelah `ditolak` kembali `menunggu` dan muncul lagi di antrean.
- Target laporan tersimpan (snapshot saat kirim) dipakai untuk capaian; override yang diubah belakangan tidak mengubah histori.
- Peserta `champion` tetap tampil di binaan (read-only rekomendasi).
- Pendamping diganti provinsi → laporan lama hanya terlihat oleh pendamping baru.
- Bukti PDF → tautan buka, bukan gambar.
- Tren minggu tanpa laporan disetujui → garis realisasi terputus.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/components/ui/chart-line/LineChart.vue app/components/ui/chart-line/index.ts app/components/operasional/BuktiZoomPreview.vue app/components/operasional/TrenTargetRealisasi.vue "app/pages/(private)/dashboard/binaan/index.vue" "app/pages/(private)/dashboard/binaan/verifikasi.vue" "app/pages/(private)/dashboard/binaan/[talentaId].vue" app/types/operasional.ts app/constants/NAVIGATION.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/pendamping.spec.ts --project=tablet)
```

Expected: semua exit 0; screenshot `binaan-dasbor.png`, `verifikasi-modal.png`, `binaan-detail.png`.

## Runtime/browser proof and unproven boundary

Disposable stack + seed; jalankan `operasional.directus.spec.ts`; cek `SELECT rekomendasi_pitching FROM talenta WHERE usaha='d0000000-0000-4000-8000-000000000001'` = `t`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: render bukti foto besar dari MinIO dan performa zoom di perangkat pendamping.

## No-advance condition

Jangan lanjut bila pendamping dapat melihat/memverifikasi laporan peserta yang bukan binaannya, atau rekomendasi dapat diaktifkan tanpa 4 pekan berturut-turut.

## Required failure probes

- Unit: `layakRekomendasi` dengan celah minggu → false.
- Unit: pendamping lain verifikasi → 404.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-8-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 8
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit (tanpa migrasi). Handoff: `kpi-evaluasi.js` (`isAtRisk`, `capaianPersen`) dan `LineChart` dipakai Phase 9; `rekomendasi_pitching` membuka transisi champion Phase 7.
