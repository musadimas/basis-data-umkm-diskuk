# Phase 7 — Program Akselerasi dan laporan KPI mingguan UMKM (offline-first)

## Objective, dependencies, observable result

- **Dependency:** Phase 6 (talenta, berkas, `useBerkasUpload`).
- **Objective:** batch program, transisi tahap `scouting → talent_lab → accelerator → champion` dengan penugasan pendamping, beranda UMKM sesungguhnya (identitas, tahap, pendamping, progres minggu, target), formulir laporan KPI mingguan dengan unggah bukti (kamera/galeri), antrean offline IndexedDB + sinkronisasi otomatis, banner konektivitas, dan tombol demo "Simulasikan Koneksi Terputus".
- **Observable result:** Wawan (UMKM) melihat "Fase Accelerator — Batch 1", "Minggu ke-6 dari 12", target Rp 18.000.000; mengirim laporan saat online (tersimpan) dan saat offline (diamankan di ponsel, lalu "Sinkronisasi Berhasil! 1 Laporan Mingguan Telah Terkirim ke Server Provinsi." setelah online); provinsi memindahkan talenta ke Accelerator dengan batch + pendamping.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-7-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926F-create-program-akselerasi.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/program-week.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/program-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/berkas-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/program-week.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/program-service.test.cjs` |
| modify | `services/directus/extensions/directus-extension-operasional/test/berkas-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `scripts/seed-dummy-operasional.mjs` |
| modify | `scripts/seed-dummy-operasional.sql` |
| modify | `scripts/cleanup-dummy-operasional.sql` |
| create | `apps/web/app/lib/program-week.ts` |
| modify | `apps/web/app/lib/idb.ts` |
| create | `apps/web/app/composables/useKoneksi.ts` |
| create | `apps/web/app/composables/useLaporanOutbox.ts` |
| create | `apps/web/app/components/demo/DemoKoneksiToggle.vue` |
| create | `apps/web/app/components/operasional/ProgresMingguan.vue` |
| modify | `apps/web/app/layouts/umkm.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/usaha/index.vue` |
| create | `apps/web/app/pages/(private)/dashboard/usaha/laporan.vue` |
| create | `apps/web/app/pages/(private)/dashboard/akselerasi/index.vue` |
| modify | `apps/web/app/constants/OPERASIONAL.ts` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/ROLES.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| create | `apps/web/tests/unit/program-week.test.ts` |
| modify | `apps/web/tests/unit/roles.test.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/umkm-laporan.spec.ts` |
| create | `apps/web/tests/e2e/akselerasi.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `apps/web/app/lib/idb.ts::clearPrivateClientState`, `layerOrderStore` (pola `localforage.createInstance`)
- `apps/web/app/layouts/umkm.vue` (Phase 2) — header frame, `<main>`, `<nav aria-label="Navigasi UMKM">`
- `services/directus/extensions/directus-extension-operasional/src/berkas-service.js::BERKAS_RULES`
- `services/directus/extensions/directus-extension-operasional/src/talenta-service.js` status enum

```bash
rg -n "createInstance|export async function clearPrivateClientState" apps/web/app/lib/idb.ts
rg -n 'aria-label="Navigasi UMKM"' apps/web/app/layouts/umkm.vue
rg -n "BERKAS_RULES" services/directus/extensions/directus-extension-operasional/src/berkas-service.js
```

## Current contract and final desired contract

### Current

Talenta berhenti di `scouting`; beranda UMKM placeholder; tidak ada laporan mingguan.

### Final

- Migrasi `20260926F` (transaksi):
  - `program_batch(id UUID PK DEFAULT gen_random_uuid(), kode TEXT NOT NULL UNIQUE, nama TEXT NOT NULL, tahap TEXT NOT NULL CHECK (tahap IN ('talent_lab','accelerator')), tanggal_mulai DATE NOT NULL, jumlah_minggu SMALLINT NOT NULL DEFAULT 12 CHECK (jumlah_minggu BETWEEN 1 AND 52), faktor_target NUMERIC(4,2) NOT NULL DEFAULT 1.20 CHECK (faktor_target > 0 AND faktor_target <= 5), dibuat_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, date_created TIMESTAMPTZ NOT NULL DEFAULT NOW())`.
  - `ALTER TABLE talenta ADD COLUMN IF NOT EXISTS batch UUID REFERENCES program_batch(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS pendamping UUID REFERENCES directus_users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS target_mingguan_override BIGINT CHECK (target_mingguan_override >= 0), ADD COLUMN IF NOT EXISTS rekomendasi_pitching BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS rekomendasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS rekomendasi_pada TIMESTAMPTZ`; `CREATE INDEX IF NOT EXISTS idx_talenta_pendamping ON talenta(pendamping) WHERE pendamping IS NOT NULL`.
  - `talenta_laporan_mingguan(id UUID PK DEFAULT gen_random_uuid(), talenta UUID NOT NULL REFERENCES talenta(id) ON DELETE CASCADE, minggu_ke SMALLINT NOT NULL CHECK (minggu_ke BETWEEN 1 AND 52), omzet BIGINT NOT NULL CHECK (omzet >= 0), jumlah_transaksi INTEGER NOT NULL CHECK (jumlah_transaksi >= 0), target BIGINT, bukti UUID REFERENCES directus_files(id) ON DELETE SET NULL, catatan_kendala TEXT, status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak')), catatan_pendamping TEXT, diverifikasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, diverifikasi_pada TIMESTAMPTZ, client_uuid UUID NOT NULL UNIQUE, dikirim_pada TIMESTAMPTZ NOT NULL, date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(), date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (talenta, minggu_ke))`; `CREATE INDEX IF NOT EXISTS idx_laporan_status ON talenta_laporan_mingguan(status)`.
  - `directus_collections`: `program_batch` (icon `event`, sort 24), `talenta_laporan_mingguan` (icon `receipt_long`, sort 25). `down` membalik semuanya.
- `program-week.js` (murni): `tanggalJakarta(date)` → `"YYYY-MM-DD"` via `Intl.DateTimeFormat("en-CA",{ timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })`; `mingguKe(tanggalMulai, now)` → selisih hari kalender (`Date.UTC`) antara `tanggalJakarta(now)` dan `tanggalMulai`; negatif → 0; selain itu `floor(hari / 7) + 1`; `targetMingguan(omzetTahunan, faktorTarget, override)` → `override` bila bukan null, `null` bila omzet null, selain itu `Math.round(omzetTahunan / 52 * faktorTarget)`.
- `program-service.js`:
  - `listBatch(database, operator)` (DATA_ROLES) → `[{ id, kode, nama, tahap, tanggalMulai (to_char), jumlahMinggu, faktorTarget, jumlahPeserta }]`.
  - `createBatch(database, body, operator)` (provinsi) → `kode` `/^[A-Za-z0-9_-]{3,40}$/`, `nama` 1–120, `tahap` enum, `tanggalMulai` `/^\d{4}-\d{2}-\d{2}$/` tanggal valid, `jumlahMinggu` 1–52 (default 12), `faktorTarget` 0,1–5 (default 1,2); duplikat kode → 409 `KODE_SUDAH_ADA`.
  - `listPendamping(database, operator)` (provinsi) → user role pendamping `status='active'`: `[{ id, nama, email }]`.
  - `listPeserta(database, query, operator)` (DATA_ROLES; kabkota `talenta.kota`) → talenta status `scouting|talent_lab|accelerator|champion`: `[{ talentaId, usaha: { id, nama }, kota, status, batch, pendamping: { id, nama } | null, mingguBerjalan, jumlahMinggu, targetMingguan, rekomendasiPitching, laporanTerakhir: { mingguKe, status } | null }]`.
  - `ubahTahap(database, talentaId, body, operator)` (provinsi): `scouting → talent_lab` (`batchId` opsional; bila ada harus tahap `talent_lab`); `talent_lab → accelerator` (`batchId` wajib tahap `accelerator`, `pendampingId` wajib role pendamping aktif, `targetMingguanOverride` opsional integer ≥0); `accelerator → champion` (hanya bila `rekomendasi_pitching = true`, selain itu 409 `REKOMENDASI_DIPERLUKAN`); transisi lain → 409 `INVALID_TRANSITION`.
  - `ubahProgram(database, talentaId, body, operator)` (provinsi, status `accelerator`): `pendampingId` dan/atau `targetMingguanOverride` (null menghapus override).
  - `getUsahaSaya(database, operator)` (umkm; `resolveOperator` wajib usaha) → `{ data: { usaha: { id, nama, nib, kota, skala, omzetTahunan }, pemilik: { nama }, talenta: null | { id, status, batch: {…} | null, pendamping: { id, nama } | null, mingguBerjalan, targetMingguan, laporanMingguIni: { id, status } | null } } }`.
  - `listLaporanSaya(database, operator)` (umkm) → laporan talenta aktif milik usaha: `[{ id, mingguKe, omzet, jumlahTransaksi, target, status, catatanPendamping, dikirimPada, diverifikasiPada, bukti: { id } | null }]` urut `minggu_ke DESC`.
  - `kirimLaporan(database, body, operator)` (umkm): body `{ clientUuid: UUID, mingguKe: integer, omzet: integer 0–1.000.000.000.000, jumlahTransaksi: integer 0–1.000.000, buktiFileId: UUID (wajib), catatanKendala: null | string ≤1000, dikirimPada: ISO-8601 }`. Urutan: (1) `client_uuid` sudah ada untuk talenta milik usaha → 200 dengan laporan itu (idempoten); (2) talenta harus `accelerator` dengan batch, selain itu 409 `PROGRAM_BELUM_AKTIF`; (3) `1 ≤ mingguKe ≤ min(jumlah_minggu, mingguKe(tanggal_mulai, now))`, selain itu 400 `fields.mingguKe`; (4) `dikirimPada` ≤ now + 5 menit dan ≥ `tanggal_mulai` 00:00 WIB, selain itu 400; (5) `assertBerkasMilik(buktiFileId)`; (6) laporan minggu yang sama: `ditolak` → UPDATE baris itu (nilai baru, `status='menunggu'`, bersihkan `catatan_pendamping/diverifikasi_*`, `client_uuid` baru) → 200; `menunggu|disetujui` → 409 `WEEK_ALREADY_REPORTED`; tidak ada → INSERT dengan `target = targetMingguan(omzet_tahunan, faktor_target, target_mingguan_override)` → 201. Response `{ data: <laporan> }`.
  - Routes: `GET /batch`, `POST /batch`, `GET /pendamping`, `GET /akselerasi/peserta`, `POST /talenta/:id/tahap`, `PATCH /talenta/:id/program`, `GET /usaha-saya`, `GET /laporan-saya`, `POST /laporan`.
- `berkas-service.js::BERKAS_RULES` tambah aturan `bukti_laporan`: berkas = `talenta_laporan_mingguan.bukti` dan (provinsi) atau (kabkota: `talenta.kota = operator.kotaId`) atau (pendamping: `talenta.pendamping = operator.userId`) atau (umkm: `talenta.usaha = operator.usahaId`).
- Web:
  - `lib/program-week.ts`: `tanggalJakarta`, `mingguKe`, `targetMingguan` (semantik identik backend) dan `formatTanggalKalender(ymd)` → mis. "5 Oktober 2026" (`Intl.DateTimeFormat("id-ID",{ timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })` atas `Date.UTC`).
  - `lib/idb.ts`: `kpiOutboxStore = localforage.createInstance({ name: IDB_DB_NAME, storeName: "kpiOutbox" })`; `clearPrivateClientState` ikut `kpiOutboxStore.clear()`.
  - `useKoneksi.ts`: state `useState("koneksi:demoOffline", () => false)` (tersimpan di `sessionStorage` key `diskuk:demo-offline`), `browserOnline` (listener `online`/`offline`), `online = computed(() => browserOnline && !demoOffline)`, `toggleDemoOffline()`.
  - `useLaporanOutbox.ts`: item `{ clientUuid, mingguKe, omzet, jumlahTransaksi, catatanKendala, dikirimPada, bukti: Blob, buktiNama, buktiTipe, error: string | null }`; `enqueue(item)`, `items` (reaktif), `sync()` → untuk tiap item tanpa `error`: `uploadBerkas(new File([bukti], buktiNama, { type: buktiTipe }), "Bukti laporan minggu " + mingguKe)` lalu `POST /panel/operasional/laporan`; sukses (200/201) → hapus item; 4xx → set `error` = pesan server/“Laporan ditolak server.”; error jaringan → hentikan loop; return jumlah terkirim. `watch(online)` → saat true dan ada item → `sync()` lalu toast `"Sinkronisasi Berhasil! {n} Laporan Mingguan Telah Terkirim ke Server Provinsi."` bila n > 0.
  - `DemoKoneksiToggle.vue`: hanya bila `runtimeConfig.public.demoMode === true`; `fixed bottom-4 left-4 z-50`; teks "[Simulasikan Koneksi Terputus (Offline)]" / "[Simulasikan Koneksi Pulih (Online)]".
  - `umkm.vue`: banner di bawah header — online: `bg-emerald-100 text-emerald-800` "Terhubung - Data Real-Time"; offline: `bg-amber-100 text-amber-900` "Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel"; render `<DemoKoneksiToggle />`; menu "Keluar" → bila outbox berisi n > 0, `window.confirm("Ada {n} laporan belum tersinkron. Keluar akan menghapusnya dari ponsel ini. Lanjutkan?")` sebelum `auth.logout()`.
  - `ProgresMingguan.vue`: props `mingguBerjalan`, `jumlahMinggu`; teks "Minggu ke-{m} dari {n} Minggu Pendampingan"; n segmen (selesai `bg-emerald-500`, berjalan `bg-amber-400 ring`, belum `bg-slate-200`); `m = 0` → "Program dimulai {formatTanggalKalender(tanggalMulai)}".
  - `usaha/index.vue` (Beranda Usaha): `GET /panel/operasional/usaha-saya`; kartu identitas (Nama Usaha, Nama Pengusaha, badge tahap "Fase {TALENTA_STATUS[status].label} — {batch.nama}", "Pendamping: {nama}"); `ProgresMingguan`; kartu "Target KPI Minggu Ini" (`formatAnalyticsCurrency`; null → "Target belum tersedia"); status laporan minggu ini (belum → tombol "Kirim Laporan Minggu Ini" ke `/dashboard/usaha/laporan`); talenta null atau bukan accelerator → "Usaha Anda belum terdaftar pada Program Akselerasi Accelerator." tanpa form. Hasil fetch terakhir disimpan di `localStorage` key `diskuk:usaha-saya` (tanpa PII selain nama usaha/pemilik yang memang milik user) untuk render offline; dibersihkan oleh logout (tambahkan penghapusan key di handler logout layout umkm).
  - `usaha/laporan.vue`: form "Laporan Kinerja Mingguan" — "Target KPI Mingguan" read-only; "Minggu ke" read-only (hasil `mingguKe(batch.tanggalMulai, new Date())` dibatasi `jumlahMinggu`); "Realisasi Omzet Mingguan (Rp)"; "Jumlah Transaksi / Pesanan"; "Unggah Bukti Transaksi" (`<input type="file" accept="image/*" capture="environment">` + tombol "Pilih dari Galeri" `accept="image/*"`, pratinjau gambar); "Catatan Singkat Kendala Produksi/Pasar" (placeholder contoh requirement); tombol "Kirim Laporan Kinerja Mingguan". Submit: validasi klien (omzet/transaksi integer ≥0, bukti wajib ≤10 MB); `clientUuid = crypto.randomUUID()`, `dikirimPada = new Date().toISOString()`; bila `online` → upload + POST langsung (gagal jaringan → masuk outbox); bila offline → `enqueue` dan dialog "Koneksi internet tidak terdeteksi. Laporan berhasil diamankan di ponsel Anda. Sinkronisasi otomatis akan berjalan saat online."; sukses online → "Laporan minggu ke-{m} terkirim."; 409 → "Laporan minggu ini sudah dikirim."; daftar "Riwayat Laporan" (`GET /laporan-saya`: minggu, omzet, capaian % terhadap target, status `LAPORAN_STATUS`, catatan pendamping) + item outbox berlabel "Menunggu sinkronisasi" atau error-nya.
  - `akselerasi/index.vue` (provinsi; kabkota read-only): judul "Program Akselerasi"; tab "Peserta Program" (tabel `GET /akselerasi/peserta`: Usaha, Kab/Kota, Tahap badge, Batch, Pendamping, Minggu, Target, Rekomendasi; aksi provinsi: "Pindah ke Talent Lab" (dialog batch talent_lab opsional), "Masuk Accelerator" (dialog pilih batch accelerator + pendamping dari `GET /pendamping` + override target opsional), "Tetapkan Champion" (hanya bila `rekomendasiPitching`), "Ubah Pendamping/Target" (accelerator)); bagian "Batch Program" (list + tombol "Buat Batch" dialog field §Final, provinsi). Phase 9 menambah tab "Monitoring".
  - `OPERASIONAL.ts` tambah `LAPORAN_STATUS`: menunggu "Menunggu Persetujuan" `bg-amber-100 text-amber-900`, disetujui "Telah Disetujui" `bg-emerald-100 text-emerald-800`, ditolak "Perlu Perbaikan" `bg-rose-100 text-rose-800`.
  - `ROLE_ROUTES` provinsi & kabkota tambah `/dashboard/akselerasi`; `NAVIGATION_LINKS` provinsi `{ id: "akselerasi", label: "Program Akselerasi", to: "/dashboard/akselerasi", icon: Rocket }`, kabkota `{ id: "akselerasi", label: "Monitoring Akselerasi", … }`, umkm tambah `{ id: "laporan", label: "Laporan KPI", to: "/dashboard/usaha/laporan", icon: ClipboardList }`.

## Ordered edits

1. Migrasi `20260926F` + kontrak test.
2. `program-week.js` + test dan `apps/web/app/lib/program-week.ts` + `tests/unit/program-week.test.ts` dengan vektor identik: mulai `2026-09-28`; `2026-09-27T16:59:59Z` → 0; `2026-09-27T17:00:00Z` → 1; `2026-10-04T16:59:59Z` → 1; `2026-10-04T17:30:00Z` → 2; `targetMingguan(780000000, 1.2, null)` → 18000000; `(420000000, 1.2, null)` → 9692308; `(null, 1.2, null)` → null; `(360000000, 1.2, 5000000)` → 5000000.
3. `program-service.js` + routes + `berkas-service.js` aturan + test: kabkota `POST /batch` → 403; `ubahTahap` talent_lab→accelerator tanpa pendamping → 400; pendamping id milik role lain → 400; champion tanpa rekomendasi → 409; `kirimLaporan` idempoten (client_uuid sama 2x → 1 insert, 200); minggu > berjalan → 400; minggu duplikat `menunggu` → 409; minggu `ditolak` → UPDATE 200; talenta bukan accelerator → 409; umkm lain (usaha berbeda) tidak dapat melihat laporan; `dikirimPada` 1 jam di masa depan → 400; pendamping membaca bukti peserta bukan binaannya → 404.
4. Seed:
   - `.mjs`: unggah `apps/web/public/images/produk-1.jpg` sebagai `dummy_nota-mingguan.jpg` (folder operasional).
   - `.sql`: batch `('dummy_ACC-2026-B1','Batch 1','accelerator', (now() AT TIME ZONE 'Asia/Jakarta')::date - 35, 12, 1.20)` dan `('dummy_TL-2026-B1','Talent Lab Batch 1','talent_lab', (now() AT TIME ZONE 'Asia/Jakarta')::date - 10, 4, 1.00)` `ON CONFLICT (kode) DO UPDATE SET tanggal_mulai = EXCLUDED.tanggal_mulai`; talenta 01, 02, 08 → `accelerator`, batch ACC, pendamping dummy_coach; talenta 03 → `talent_lab`, batch TL. Laporan (bukti = `dummy_nota-mingguan.jpg`; `client_uuid = ('d1000000-0000-4000-8000-00000000' || NN || lpad(minggu::text, 2, '0'))::uuid` (grup terakhir tepat 12 digit); `dikirim_pada = (batch.tanggal_mulai + (minggu*7 - 2)) + time '03:00'` sebagai UTC; `target` = target rumus; status/verifikator dummy_coach, `diverifikasi_pada = dikirim_pada + interval '1 day'` untuk disetujui/ditolak):

     | NN | minggu | omzet | transaksi | status | catatan_pendamping |
     | --- | --- | --- | --- | --- | --- |
     | 01 | 1 | 16500000 | 42 | disetujui | Pertahankan pencatatan harian. |
     | 01 | 2 | 18200000 | 47 | disetujui | Target tercapai. |
     | 01 | 3 | 19000000 | 51 | disetujui | Bagus, stok bahan kulit aman. |
     | 01 | 4 | 20100000 | 55 | disetujui | Konsisten di atas target. |
     | 01 | 5 | 21000000 | 58 | menunggu | — |
     | 02 | 1 | 9800000 | 130 | disetujui | Target tercapai. |
     | 02 | 2 | 6100000 | 88 | disetujui | Harga kedelai naik, evaluasi harga jual. |
     | 02 | 3 | 6400000 | 90 | disetujui | Perlu bimbingan teknis pemasaran. |
     | 08 | 1 | 8500000 | 210 | disetujui | Target tercapai. |
     | 08 | 2 | 8900000 | 220 | disetujui | Target tercapai. |
     | 08 | 3 | 7900000 | 190 | ditolak | Foto nota tidak terbaca, mohon unggah ulang. |
     | 08 | 4 | 8600000 | 205 | menunggu | — |

     `catatan_kendala` untuk 02 minggu 2: "Kenaikan harga bahan baku kedelai"; lainnya NULL.
   - Cleanup (atas): `DELETE FROM program_batch WHERE kode LIKE 'dummy\_%';` (laporan & talenta ikut cascade usaha).
5. Web: `program-week.ts`, `idb.ts`, `useKoneksi.ts`, `useLaporanOutbox.ts`, `DemoKoneksiToggle.vue`, `ProgresMingguan.vue`, `umkm.vue`, dua halaman usaha, `akselerasi/index.vue`, konstanta/tipe/ROLES/NAVIGATION, `roles.test.ts`.
6. Mock fixture: `usaha-saya` (accelerator, batch `tanggalMulai` = tanggal WIB hari ini − 35 hari dihitung di fixture, target 18000000), `laporan-saya` (2 laporan), `POST /laporan` (201, kecuali `mingguKe` 99 → 400), `akselerasi/peserta`, `batch`, `pendamping`, `talenta/:id/tahap`.
7. `umkm-laporan.spec.ts` (mock, role umkm, proyek chromium + mobile): (a) beranda menampilkan "Minggu ke-6 dari 12 Minggu Pendampingan" dan "Rp 18.000.000" (normalisasi spasi non-breaking), screenshot `umkm-beranda-program.png`; (b) kirim online → POST `/panel/files` lalu `/panel/operasional/laporan` → "Laporan minggu ke-6 terkirim."; (c) klik "[Simulasikan Koneksi Terputus (Offline)]" → banner "Mode Offline Aktif…" → isi & kirim → dialog teks persis requirement, tidak ada request `/panel/operasional/laporan`, screenshot `umkm-offline.png` → klik "[Simulasikan Koneksi Pulih (Online)]" → request terkirim dan toast "Sinkronisasi Berhasil! 1 Laporan Mingguan Telah Terkirim ke Server Provinsi."; (d) `context.setOffline(true)` (offline nyata) → kirim → masuk antrean → `context.setOffline(false)` → sinkron otomatis; (e) POST mock 400 → item antrean menampilkan pesan error dan tetap ada.
8. `akselerasi.spec.ts` (mock provinsi): "Masuk Accelerator" pada peserta talent_lab → dialog pilih batch & pendamping → request `POST /panel/operasional/talenta/<id>/tahap` body `{ tahap: "accelerator", batchId, pendampingId }`; "Tetapkan Champion" disabled tanpa rekomendasi; kabkota tidak melihat tombol aksi; screenshot `akselerasi-peserta.png`.
9. `operasional.directus.spec.ts`: Wawan login → beranda "Minggu ke-6 dari 12"; klik "[Simulasikan Koneksi Terputus (Offline)]", kirim laporan minggu 6 dengan foto → dialog offline; klik "[Simulasikan Koneksi Pulih (Online)]" → toast sinkronisasi → riwayat "Menunggu Persetujuan" minggu 6; kirim ulang minggu 6 saat online → pesan "Laporan minggu ini sudah dikirim.".

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Pergantian minggu saat offline: minggu dihitung saat pengisian (klien) dan divalidasi server terhadap minggu berjalan server; laporan minggu lampau yang belum dikirim tetap diterima (≤ minggu berjalan).
- Sinkronisasi ganda (dua tab) → `client_uuid` unik → satu baris, keduanya 200.
- Blob bukti dihapus/rusak di IndexedDB → upload gagal 4xx → item bertanda error.
- Logout dengan antrean berisi → konfirmasi; revocation otomatis tetap menghapus (dicatat sebagai batas).
- Batch mulai di masa depan → minggu 0 → form menampilkan "Program dimulai …" dan tombol kirim disabled.
- Minggu > jumlah_minggu (program selesai) → form disabled "Program pendampingan telah selesai.".
- Target null (omzet SIDT kosong, tanpa override) → capaian "—".
- Cross-timezone: tablet (America/Los_Angeles) Minggu 4 Okt 10:30 PDT (= Senin 5 Okt 00:30 WIB) menghitung minggu berikutnya.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
node --check scripts/seed-dummy-operasional.mjs
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/lib/program-week.ts app/lib/idb.ts app/composables/useKoneksi.ts app/composables/useLaporanOutbox.ts app/components/demo/DemoKoneksiToggle.vue app/components/operasional/ProgresMingguan.vue app/layouts/umkm.vue "app/pages/(private)/dashboard/usaha/index.vue" "app/pages/(private)/dashboard/usaha/laporan.vue" "app/pages/(private)/dashboard/akselerasi/index.vue" app/constants/OPERASIONAL.ts app/types/operasional.ts app/constants/ROLES.ts app/constants/NAVIGATION.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/umkm-laporan.spec.ts --project=mobile --project=tablet)
```

Expected: semua exit 0; vektor minggu identik lulus di backend dan web; screenshot `umkm-beranda-program.png`, `umkm-offline.png`, `akselerasi-peserta.png`.

## Runtime/browser proof and unproven boundary

Disposable stack + seed; jalankan `operasional.directus.spec.ts`; cek `SELECT minggu_ke, status FROM talenta_laporan_mingguan l JOIN talenta t ON t.id=l.talenta WHERE t.usaha='d0000000-0000-4000-8000-000000000001' ORDER BY minggu_ke` berisi minggu 1–6. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: unggah kamera di perangkat fisik, IndexedDB di Safari iOS, perilaku sinkronisasi saat jaringan seluler putus-sambung.

## No-advance condition

Jangan lanjut bila laporan dapat dikirim untuk usaha lain, laporan ganda per minggu tercipta, atau antrean offline kehilangan item tanpa pesan.

## Required failure probes

- Unit: `client_uuid` ulang → tidak ada insert kedua.
- E2E: POST 400 saat sinkronisasi → item tetap dengan pesan error.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-7-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 7
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; `down` migrasi `20260926F` menghapus batch, laporan, dan kolom program talenta. Handoff: `program-week.js`, `talenta_laporan_mingguan`, `LAPORAN_STATUS`, `ProgresMingguan` dipakai Phase 8 dan 9; `akselerasi/index.vue` menerima tab Monitoring di Phase 9.
