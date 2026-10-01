# E2E Plan — Perbaikan Bug & Temuan QC DISKUK (BUG-001 … BUG-022, TS-15, TS-17)

**Verdict plan:** executor-ready setelah gerbang §9 terpenuhi
**Repository:** `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`
**Baseline inspeksi:** branch `main`, commit `d35158d020d12723bda5c2b2e666a739f6f04c00` + perubahan UI-audit P6 yang belum di-commit (lihat §9)
**Sumber normatif:** `~/Downloads/QC DISKUK.xlsx` (sheet "Bug & temuan" dan "TEST CASE - Program"), screenshot evidence dari tautan Google Drive di kolom Evidence (salinan lokal sementara: scratchpad sesi `qc/`), `requirements.md`, `docs/new_requirements.md`, `CONTEXT.md` (glosarium).
**Bahasa:** semua copy UI, pesan error, dan komentar kode baru memakai bahasa Indonesia sesuai glosarium `CONTEXT.md`.

---

## 1. Outcome, pengguna, dan definisi selesai

### Outcome

Menutup 22 bug QC + 2 temuan test case (TS-15, TS-17) di modul Dashboard (Infografis, Analitik, Peta Spasial) dan Program (Kurasi Talent Scouting, Program Akselerasi, Monitoring Eksekutif, Kurasi Investor, Kurasi Katalog, Produk Katalog, Talent Passport) sehingga setiap baris QC dapat diuji ulang dan berstatus lulus.

### Pengguna dan peran

| Peran (`app_role`) | Modul terdampak |
|---|---|
| `provinsi` (Admin Provinsi) | semua modul; satu-satunya peran yang memutuskan kurasi talent, kurasi investor, kurasi katalog, LOI |
| `kabkota` (Admin Kab/Kota) | Infografis/Analitik/Spasial (scope kota), pengajuan Talent Scouting (tanpa keputusan), Monitoring Eksekutif |
| `pendamping` | Panel Pendampingan (review laporan peserta binaannya, rekomendasi pitching) |
| `umkm` | Produk Katalog miliknya, profil investor miliknya, kirim Laporan Mingguan |
| Pengunjung publik / investor | Katalog publik (`/katalog`, `/katalog/:id`), peta landing |

### Perilaku saat ini → target (ringkas per bug)

| ID | Saat ini (bukti kode) | Target |
|---|---|---|
| BUG-001 | Panel "5 Kabupaten/Kota Teratas" (`components/dashboard/card/Overview.vue`, judul dari `constants/DASHBOARD.ts::topRegion`) menampilkan kecamatan/kelurahan saat filter wilayah aktif; `regionLevel` dari API tidak dipakai; klik baris selalu `openAnalytics('kota_id', …)` | Judul, deskripsi, tooltip mengikuti `regionLevel` ("5 Kecamatan Teratas", "5 Kelurahan Teratas"); klik baris membuka Analitik dengan field level yang benar |
| BUG-002 | `permen-aspek.js` membagi `ya ÷ (ya+tidak)`; NIB, bukti pelatihan, peningkatan SDM tak pernah bernilai `tidak` → 100% | Persentase = `ya ÷ total UMKM dalam filter` untuk semua indikator; sub-teks "x ya · y tidak · z belum ada data dari N UMKM" |
| BUG-003 | Registry punya `kota_id`/`kota_kode`/`kota_nama`, `kecamatan_id`/`kecamatan_nama`, `kelurahan_id`/`kelurahan_nama` aktif → tiap level muncul 2–3 kali | Builder menampilkan satu field per level: "Kabupaten/kota", "Kecamatan", "Kelurahan" (backing `*_nama`) |
| BUG-004 | `QueryBuilder.addFilter` mengganti filter field sama; picker `*_nama` mengirim id numerik → 0 hasil | Menambah nilai kedua pada field wilayah yang sama menggabungkan ke operator `in` ("salah satu"); nilai picker `*_nama` = label |
| BUG-005 | `Choropleth.client.vue::onRegionClick` langsung `emit("select")` → drill | Klik wilayah membuka kartu (nama, jumlah UMKM, share) + tombol "Lihat rincian kecamatan/kelurahan" dan (dashboard saja) "Buka di Analitik" |
| BUG-006 | "Hitung Skor" = submit de facto (status `dinilai`); "Simpan Draft" pada `dinilai` menarik kembali & menghapus skor | Hitung Skor = hitung & simpan skor (tetap `draft`); tombol baru "Ajukan ke Kurasi" (`draft→dinilai`); `dinilai` read-only bagi pengaju; ditolak → alasan tampil + "Ajukan ulang" (draft baru terisi dari pengajuan lama) |
| BUG-007 | Tombol Tolak tampil & diizinkan server untuk `draft` | Tolak hanya untuk `dinilai`, hanya `provinsi` (UI & server) |
| BUG-008 | Alasan tolak ditimpa ke `catatan` pengaju; banner ditolak statis | Kolom `alasan_tolak/ditolak_oleh/ditolak_at`; alasan tampil di form dan tab Ditolak |
| BUG-009 | Tab Ditolak = semua baris `ditolak` historis | Tab Ditolak hanya baris `ditolak` yang merupakan pengajuan terbaru usaha tsb |
| BUG-010 | Screenshot QC: `window.prompt` (build produksi pra-P4). Lokal (P4) sudah dialog, tetapi lebar rusak, error tersembunyi di balik overlay, validasi longgar | Dialog tolak ber-alasan wajib, error inline, tombol nonaktif saat proses, lebar benar |
| BUG-011 | Daftar BA teks polos; `talent_berita_acara.berkas` tak pernah diisi; tak ada endpoint lihat | Klik BA mengunduh PDF yang dibangkitkan server on-demand (provinsi) |
| BUG-012 | `GET /kpi/laporan` `LIMIT 500` tanpa paging; tabel merender semua baris | Paging server `page/limit=25` + total; kontrol Sebelumnya/Berikutnya "x–y dari N" |
| BUG-013 | Setujui tanpa foto bukti lolos tanpa peringatan | **Peringatan saja** (keputusan user): modal menampilkan banner "tanpa foto bukti" dan meminta konfirmasi kedua sebelum menyetujui; server tidak berubah |
| BUG-014 | `longestTargetStreak` = rangkaian terpanjang di mana saja → laporan terbaru ditolak tidak membatalkan | Rangkaian **terbaru**: dihitung mundur dari minggu terakhir yang tidak `menunggu`; terbaru `ditolak` → 0; minggu hilang memutus; rekomendasi lama tidak dicabut otomatis |
| BUG-015 | Tab Disetujui menghitung semua minggu; Kepatuhan hanya minggu selesai → 70 vs 67/72 | Rumus tetap; kartu menjelaskan "dihitung dari minggu program yang sudah selesai" + "X laporan disetujui pada minggu berjalan belum dihitung" |
| BUG-016 | `investor-kurasi.vue` tidak mengikuti pola kurasi baku (tanpa subjudul/tab, tombol tanpa konfirmasi, verifikasi akun di atas daftar) | Pola baku (`katalog/kurasi.vue`): header+subjudul, tablist, kartu daftar, dialog konfirmasi untuk cabut; verifikasi akun pindah ke kartu terpisah di bawah |
| BUG-017 | Tanpa tab; status diturunkan di klien; `belum_disetujui` tak pernah muncul dari alur baru | Tab Menunggu kurasi / Disetujui / Belum disetujui usaha / Persetujuan dicabut + jumlah; status & filter dihitung server |
| BUG-018 | Tombol Setujui tampil di profil Disetujui; server menerima persetujuan ulang | Tombol per status; server menolak transisi tidak valid (409) |
| BUG-019 | Dialog "Lihat" pada Tayang/Rekomendasi/Ditolak sama dengan Menunggu; server tanpa guard transisi | Aksi per status + guard transisi server bersyarat |
| BUG-020 | Tab LOI read-only tanpa status/kontak | Dialog detail LOI, kontak (bila persetujuan kontak), ubah status Baru → Ditindaklanjuti → Ditutup |
| BUG-021 | Grant baca `produk`/`produk_foto`/file katalog hanya ke Public policy; pengguna login dievaluasi dengan policy aplikasi → 403 → "Produk tidak ditemukan" | Grant baca identik ditambahkan ke policy aplikasi & policy investor (juga `kota` untuk filter wilayah `/katalog` dan `faq`; akar masalah sama) |
| BUG-022 | Screenshot QC: `window.confirm` (pra-P4). Lokal: dialog berganti isi saat menutup, tanpa status sibuk, copy generik, lebar rusak | Dialog cabut menampilkan kode & nama usaha, sibuk di dalam dialog, error inline, tanpa flip isi |
| TS-15 | Kapasitas produksi boleh kosong | Hitung Skor & Ajukan mensyaratkan kapasitas produksi > 0 dan satuan terisi (UI + server 422) |
| TS-17 | Skor legalitas/finansial muncul walau isian kosong | Hitung Skor ditolak bila data wajib kosong; skor dari SIDT tetap dihitung tetapi diberi label sumber "dari data SIDT" |

### Keputusan yang dikunci (dari user, 2026-10-01)

1. **Alur Talent Scouting:** Ajukan terpisah dari Hitung Skor; `dinilai` read-only untuk pengaju; ditolak → "Ajukan ulang" membuat draft baru terisi dari pengajuan yang ditolak.
2. **Wajib & skor:** wajib = kapasitas produksi > 0 + satuan; komponen skor dari SIDT tetap dihitung dan diberi label sumber.
3. **Berita Acara:** PDF on-demand via server (nomor, tanggal, penyetuju, daftar usaha + Talent Index); tidak disimpan ke `berkas`, tanpa tanda tangan.
4. **Bukti foto KPI:** hanya peringatan + konfirmasi kedua; server tetap mengizinkan.
5. **Pitching:** rangkaian 4 minggu terbaru (aturan §1 BUG-014); tidak auto-revoke; label "Rekomendasikan ke Talent Investment Day / Champion".
6. **Kepatuhan:** rumus minggu selesai dipertahankan + penjelasan di kartu.
7. **Investor:** cabut oleh kurator → status "Persetujuan dicabut" (kolom baru), dapat disetujui ulang; tarik/tanpa persetujuan usaha → "Belum disetujui usaha"; edit profil oleh UMKM → kembali "Menunggu kurasi".
8. **Katalog/LOI:** matriks aksi per status + guard server; LOI dialog detail + kontak + status.
9. **Lima aspek:** penyebut = seluruh UMKM dalam filter.
10. **Evidence:** screenshot dari tautan Drive dipakai sebagai bukti (sudah diperiksa); temuan berbasis kode melengkapi.
11. **Baseline:** P6 UI-audit wajib di-commit sebelum Phase 1.
12. **Peta:** kartu wilayah berlaku di semua peta (Spasial, Infografis, landing); landing tanpa tombol Analitik.

### Keputusan teknis yang dikunci oleh planner (dengan alasan)

- **Analitik memakai `*_nama` sebagai field wilayah kanonik** (bukan `*_id`): `defaultAnalysis.groupBy = "kota_nama"` (`lib/analytics-query.ts`), `DRILL_PATH` di `analitik.vue`, cascade `getOptions` (menerima label induk), dan chip filter semuanya sudah berbasis nama. Field `kota_id`, `kota_kode`, `kecamatan_id`, `kelurahan_id` disembunyikan dari daftar builder kecuali sedang terpilih (deep-link peta/infografis tetap memakai `*_id` dan tetap benar). Registry server tidak diubah, sehingga saved analysis lama tetap terkompilasi.
- **Tolak pengajuan talent = `provinsi` saja di server**, menyelaraskan dengan gate UI P1 (`isProvinsi`) dan UI_audit ("Admin Kab/Kota tidak boleh melihat aksi keputusan kurasi").
- **PDF Berita Acara = `provinsi` saja**: PDF memuat nama usaha lintas kota; kabkota tetap melihat daftar BA tanpa tautan.
- **`usaha.talent_status → 'scouting'` dipindah dari hitung-skor ke ajukan** (scouting = masuk antrean kurasi).
- **Grant katalog untuk pengguna login lewat migration** (bukan klien Directus tanpa kredensial) karena `<img src="/panel/assets/…">` tetap mengirim cookie sesi; hanya grant yang memperbaiki gambar sekaligus data.
- **Paging KPI** memakai bentuk `{ items, meta: { page, limit, total } }` di dalam `data` (pola `authentication/src/endpoints/activity/service.js`, komentar "meta harus di dalam data karena SDK membuka `data`").
- **`useAnalysisState.addFilter` tidak diubah:** klik kelompok/drill di canvas tetap mengganti filter; penggabungan ke `in` hanya dari "Tambah filter" di `QueryBuilder`. Nilai `in` di URL divalidasi per item (≤ 100 nilai), bukan string gabungan (≤ 100 karakter).
- **Nama migration berurutan:** `20261001A` (phase 4), `20261001B` (phase 8), `20261001C` (phase 9).
- **Konstanta baru memakai `satisfies`/`as const satisfies`**, bukan anotasi `Record<…>` eksplisit, karena aturan oxlint `anti-slop/no-known-value-widening` (`oxlint.config.ts`).

### Non-goals

- Mengubah rubrik skor talent (`placeholder-v0`), bobot 25%, atau skor data lama.
- Menyimpan PDF BA ke storage, tanda tangan digital BA, nomor BA baru.
- Mewajibkan foto bukti di server (keputusan: peringatan saja); placeholder "bukti gagal dimuat" (PDP-010).
- Auto-revoke rekomendasi pitching; batas kepatuhan berbasis hari Jumat.
- Picker akun investor dari daftar (tetap input ID akun); paging untuk Kurasi Investor/Katalog.
- Komponen pagination generik di `components/ui`; perubahan registry `analitik_field`.
- Tab LOI untuk pemilik UMKM; notifikasi LOI.
- Deploy ke produksi `fuad` (lihat §9 — keputusan terpisah, prod tanpa backup).
- Item UI_audit P7/P8 yang belum dikerjakan.

### Definisi selesai

Semua phase 1–10 di-commit (satu commit per phase) di `main` lokal; gerbang validasi tiap phase hijau; matriks §8 terisi bukti; setiap baris QC (BUG-001…022, TS-15, TS-17) memiliki bukti uji ulang (test otomatis dan/atau screenshot browser) yang dicatat di `docs/qc-diskuk-e2e-plan/execution_log.md`.

---

## 2. Evidence map

| Jalur / simbol | Fakta yang mengikat plan |
|---|---|
| `apps/web/app/pages/(private)/dashboard/index.vue::openAnalytics`, `<DashboardCardOverview … @drill:kota>` | Drill infografis selalu `kota_id`; `infografis.regionLevel` tersedia tetapi tidak diteruskan |
| `apps/web/app/components/dashboard/card/Overview.vue::topRegions`, `emit('drill:kota')` | Panel wilayah teratas; judul dari konstanta |
| `apps/web/app/constants/DASHBOARD.ts::DASHBOARD_SECTIONS.topRegion` | Judul/deskripsi/tooltip "Kabupaten/Kota" statis |
| `services/directus/extensions/analytics/src/endpoints/infographic/index.js::regionLevelFor`, `attachAuthoritativeGeometry` | `regionLevel` = `kota`/`kecamatan`/`kelurahan` sesuai filter |
| `services/directus/extensions/directus-extension-operasional/src/permen-aspek.js::EKSPRESI`, rumus `persentase` | Penyebut `diketahui`; tiga indikator TRUE/NULL |
| `services/directus/extensions/directus-extension-operasional/test/permen-aspek.test.cjs` | Mengunci perilaku 100% lama |
| `apps/web/app/components/dashboard/card/PermenAspek.vue` | Render persentase & sub-teks |
| `services/directus/migrations/20260819D-seed-analytics-registry.js` | Tujuh field wilayah aktif, `field_group='analytics'` |
| `services/directus/extensions/analytics/src/endpoints/analysis/metadata.js::getOptions` | Opsi `*_nama` beridentitas id numerik + label; cascade menerima label induk |
| `services/directus/analytics-shared/query-compiler.cjs::DIMENSIONS`, `filterExpression`, `integerFilterExpression`, `terapkanScope` | `*_nama` difilter dengan nama; `in` didukung (teks `= ANY(?::text[])`, 1–100 nilai); kabkota memaksa filter `kota_id` |
| `apps/web/app/components/analytics/QueryBuilder.vue::addFilter`, picker `:value="option.id"`, daftar field filter `role === 'filter' \|\| 'dimension'` | Ganti-bukan-tambah; nilai id |
| `apps/web/app/lib/analytics-filters.ts::FILTER_FIELDS`, `EQUALITY_ONLY` | Operator wilayah `eq/neq` saja |
| `apps/web/app/composables/useAnalysisState.ts::addFilter`, `drillDown` | Mengganti filter per field |
| `apps/web/app/components/analytics/FilterChips.vue` | Chip per `fieldId`, nilai array di-join |
| `apps/web/app/components/dashboard/map/Choropleth.client.vue::onRegionClick`, `onPointClick`, `loadPointCard` | Popup wilayah minimal lalu langsung `emit("select")`; pola kartu DOM sudah ada |
| `apps/web/app/pages/(private)/dashboard/spasial.vue::openRegion`, `openAnalytics`; `components/landing/LandingMap.vue::selectRegion` | Tiga konsumen `@select` |
| `services/directus/extensions/program/src/endpoints/talent/{index,service,scoring}.js` | Transisi `draft/dinilai/disetujui/ditolak`; `requireOpen`; `catatan = COALESCE(?, catatan)` saat tolak; BA tanpa berkas |
| `services/directus/migrations/20260926I-create-talent-scouting.js` | Skema `talent_pengajuan`, `talent_berita_acara`, unique open index |
| `apps/web/app/pages/(private)/dashboard/talent/ajukan/[usahaId].vue::syncFrom`, `save`, `hitungSkor` | Form tunggal; `rejected` banner statis |
| `apps/web/app/pages/(private)/dashboard/talent/kurasi.vue` | Tab per status; Tolak pada `draft`; dialog tolak `class="max-w-md"`; daftar BA `<li>` |
| `services/directus/extensions/program/src/endpoints/passport/pdf.js`, `analytics-shared/dokumen.cjs::renderDokumen` | Pola PDF server |
| `apps/web/app/pages/(private)/dashboard/usaha/passport.vue::unduhDokumen` | Pola unduh blob di klien |
| `services/directus/extensions/program/src/endpoints/kpi/{index,service,rules}.js::listLaporan`, `reviewLaporan`, `setPitching`, `longestTargetStreak` | `LIMIT 500`; tanpa cek bukti; streak terpanjang |
| `apps/web/app/pages/(private)/dashboard/pendampingan/index.vue`, `[pesertaId].vue` | Antrean & modal review; checkbox pitching |
| `services/directus/extensions/program/src/endpoints/executive/{index,rules}.js::aggregateProgram`, `completedWeeks` | Kepatuhan minggu selesai |
| `apps/web/app/pages/(private)/dashboard/akselerasi/index.vue` | Kartu kepatuhan |
| `services/directus/extensions/program/src/endpoints/executive/index.js` route `/investor/kurasi`, `/investor/profil`, `/investor/profil/:id/kurasi` | `LIMIT 200`, tanpa filter; kurasi tanpa guard status |
| `services/directus/migrations/20260928F-executive-investor.js` | Skema `investor_profil`; `INVESTOR_POLICY_ID = 89167fa4-30ad-4aec-9d97-d5256d5518df` |
| `apps/web/app/pages/(private)/dashboard/investor-kurasi.vue::statusItem` | Status diturunkan di klien |
| `apps/web/app/constants/PROGRAM.ts::KURASI_INVESTOR_STATUS` | Meta 4 status |
| `services/directus/extensions/program/src/endpoints/katalog/{index,service,rules}.js::kurasiProduk`, `daftarLoi`, `validasiKurasi` | Tanpa guard transisi; LOI read-only |
| `apps/web/app/pages/(private)/dashboard/katalog/kurasi.vue` | Dialog aksi sama untuk semua tab; tab LOI teks |
| `services/directus/migrations/20260926K-create-katalog.js::PUBLIC_GRANTS`, `20260926R-katalog-detail-publik.js`, `20260926M-create-kegiatan-faq.js` | Grant hanya untuk Public policy |
| `services/directus/node_modules/.pnpm/@directus+api@35.2.0…/permissions/lib/fetch-policies.js::_fetchPolicies` | Public policy hanya berlaku bila `roles.length === 0` |
| `services/directus/migrations/20260819A-private-dashboard-access.js::POLICY_ID = 9325db4b-9518-41db-b122-8c667f2ce510` | Policy aplikasi semua peran dashboard |
| `services/directus/test/public-grants.contract.test.mjs` | Kontrak grant publik (allowlist field) |
| `apps/web/app/pages/(public)/katalog/[id].vue`, `katalog/index.vue` | `readItem/readItems` dengan sesi pengguna |
| `apps/web/app/pages/(private)/dashboard/usaha/passport.vue` dialog konfirmasi, `cabut()` | Flip isi saat close; tanpa sibuk |
| `apps/web/app/components/ui/dialog/DialogContent.vue` | Kelas dasar `max-w-[calc(100%-2rem)] … sm:max-w-lg` |
| `apps/web/app/components/dashboard/map/Infographic.vue` | Pembungkus peta khusus index/spasial; hardcode `point-card`, kini juga `region-analytics` |
| `services/directus/extensions/analytics/src/endpoints/analysis/templates.js` | Template memakai `groupBy: "kota_nama"` → `*_nama` kanonik |
| `oxlint.config.ts` aturan `anti-slop/no-known-value-widening` | Anotasi `Record<…>` eksplisit pada literal gagal lint; pakai `satisfies` |
| `services/directus/extensions/program/test/talent.test.js` (`routes.length === 8`) | Mengunci jumlah & peran route talent; menjadi 9 di phase 4 dan 10 di phase 5 |
| `apps/web/app/app.vue` (`<NuxtPage/>` tanpa page-key), `nuxt/dist/pages/runtime/utils.js::generateRouteKey` | Halaman ber-param di-remount saat param berubah |
| `apps/web/app/pages/(public)/katalog/index.vue::readItems("kota")` | Filter wilayah katalog publik juga Public-only → ikut grant |
| `services/directus/migrations/20260926I-create-talent-scouting.js` | Policy aplikasi sudah punya `directus_files read uploaded_by=$CURRENT_USER`, fields `*` |
| `services/directus/test/public-grants.contract.test.mjs` | Hanya mencocokkan grant ke Public (`a."user"`); migration baru memakai alias `pub` dan punya contract test sendiri |
| `apps/web/app/pages/(private)/dashboard/usaha/passport.vue::cabut()` | Sudah punya `catch` sejak P1 (temuan UI_audit "try/finally tanpa catch" usang) |

---

## 3. Alur end-to-end saat ini → target

```text
Infografis: filter → GET /v1/analytics/infographic → {regions, regionLevel} → Overview (judul statis) → klik → /dashboard/analitik?filter=kota_id~eq~<id kecamatan>  ✗
Target    : … → Overview(regionLevel) → judul per level → klik → filter <level>_id~eq~<id>  ✓

Lima aspek: GET /operasional/aspek-perkembangan → ya/(ya+tidak) ✗ → ya/total ✓

Analitik: Tambah filter kota_nama=<id> (ganti) ✗ → kota_nama=<label>; nilai kedua → kota_nama~in~A,B ✓ → compileAggregate (= ANY(text[]))

Peta: klik poligon → emit select → refetch level bawah ✗ → kartu popup → [Lihat rincian] emit select | [Buka di Analitik] emit analyze ✓

Talent: form → POST/PATCH (draft) → hitung-skor (dinilai ✗ / draft+skor ✓) → POST ajukan (draft→dinilai ✓) → tolak (dinilai, provinsi, alasan_tolak ✓) | BA (dinilai→disetujui) → GET berita-acara/:id/pdf ✓

KPI: GET /kpi/laporan?status&page&limit → {items, meta.total} → pager; review modal → bukti=0 → konfirmasi kedua → POST review; pitching = trailing streak

Monitoring: GET /executive/monitoring → kepatuhan {terverifikasi, diharapkan, persen, belumDihitung} → kartu + penjelasan

Investor: GET /executive/investor/kurasi?status → {items, meta.counts} → tab; POST kurasi {setuju} → UPDATE bersyarat → 409 bila status berubah

Katalog: POST kurasi produk → UPDATE … WHERE status_kurasi IN (asal valid) → 409; PATCH /katalog/loi/:id → UPDATE bersyarat; produk dibaca pengguna login lewat grant policy aplikasi/investor

Paspor: dialog cabut → POST /passport/:id/cabut (tak berubah) → dialog sibuk → tutup saat sukses
```

---

## 4. Contract ledger

| Kontrak | Producer | Persistensi | Serialisasi/API | Consumer | Izin | Waktu | Gagal | Kompatibilitas |
|---|---|---|---|---|---|---|---|---|
| Infografis `regionLevel` | `infographic/index.js` | — | `regionLevel: "kota"\|"kecamatan"\|"kelurahan"` (sudah ada) | `index.vue` → `Overview.vue` prop `regionLevel` | sesi dashboard | — | default `kota` bila absen | tanpa perubahan API |
| Lima aspek | `permen-aspek.js` | baca saja | item: `persentase` (ya÷total, 1 desimal, `null` bila total 0), `ya`, `tidak`, `diketahui`, `belumAdaData`, `total` (tambahan); `definisiVersi = "indikator-operasional-v3"` | `PermenAspek.vue`, `types/operasional.ts` | sesi dashboard (+scope kabkota existing) | — | `persentase: null` → "—" | field tambahan; field lama tetap |
| Filter wilayah analitik | `QueryBuilder.vue` (hanya "Tambah filter") | URL `filter=kota_nama~in~A,B` | `AnalyticsFilter{operator:"in", value:string[]}`; validasi URL per item (≤ 100 nilai) | `compileAggregate`, worker exporter (compiler sama) | kabkota: filter kota klien dibuang server | — | 400 `FILTER_VALUE_INVALID` > 100 nilai | URL lama `eq` tetap valid; `useAnalysisState.addFilter` (klik kelompok/drill) tetap mengganti |
| Kartu wilayah peta | `Choropleth.client.vue` | — | emit `select(region)`, emit baru `analyze(region)`, prop baru `regionAnalytics?: boolean` (default `false`) | `Infographic.vue` (selalu `region-analytics`, meneruskan `analyze`) → `index.vue`/`spasial.vue` `@analyze="analyzeRegion"`; `LandingMap.vue` tanpa perubahan kode | — | — | — | level kelurahan: kartu tanpa tombol rincian |
| Pengajuan talent | `talent/service.js` | `talent_pengajuan` + `alasan_tolak TEXT`, `ditolak_oleh UUID`, `ditolak_at TIMESTAMPTZ` (migration `20261001A`) | `TalentPengajuan` + `alasanTolak`, `ditolakAt`; route baru `POST /pengajuan/:id/ajukan`; body tolak berubah dari `{catatan}` ke `{alasan}` | ajukan page, kurasi page, mock-program; passport/executive (baca `disetujui` terbaru, tidak terdampak) | KELOLA (provinsi,kabkota) untuk buat/ubah/hitung/ajukan; tolak, BA, PDF BA = provinsi | `ditolak_at` UTC di DB, ISO `Z` di JSON, tampil `id-ID` `Asia/Jakarta` | 409 `PENGAJUAN_CLOSED`/`PENGAJUAN_TIDAK_SIAP_DIKURASI`/`SKOR_BELUM_DIHITUNG`, 422 `DATA_BELUM_LENGKAP`, 400 `ALASAN_WAJIB` | backfill baris `ditolak` lama; label pill `dinilai` menjadi "Siap dikurasi"; `seed-dummy-program.sql` mengisi `alasan_tolak/ditolak_at` |
| PDF Berita Acara | `GET /talent/berita-acara/:id/pdf` (`talent/berita-acara-pdf.js`) | baca saja | `application/pdf`, `Content-Disposition: attachment; filename="<nomor dengan [^A-Za-z0-9_-]+ → '-'>.pdf"` | kurasi.vue (blob) | provinsi | `tanggal DATE` via `to_char 'YYYY-MM-DD'` lalu format `id-ID` `timeZone: UTC`; `generatedAt = jakartaDate()` | 404 `BERITA_ACARA_NOT_FOUND` | route baru |
| Antrean KPI | `kpi/service.js::listLaporan` | — | `GET ?status&page` (limit tetap 25 = `HALAMAN_ANTREAN`, tidak diterima dari klien); `data = { items, meta: { page, limit, total } }`; urutan `date_updated` + `id` | pendampingan/index.vue, tipe `KpiLaporanQueuePage`, mock-program, mock-directus-server | REVIEW (provinsi,pendamping) | — | 400 `INVALID_PAGE`; halaman lewat akhir → `items []` | **breaking**; semua consumer diubah di phase 6 |
| Pitching | `kpi/rules.js::latestTargetStreak` | `program_peserta.rekomendasi_pitching` | `pitching: { streak, dibutuhkan, memenuhi }` (bentuk tetap) | `[pesertaId].vue`, `setPitching`, `bacaPeserta` | REVIEW | minggu program dari `tanggal_mulai` (existing) | 409 existing bila tidak memenuhi | `longestTargetStreak` dihapus; consumer (`service.js`, `mock-program.mjs`, `test/kpi.test.js`) diganti di phase 6 |
| Kepatuhan | `executive/rules.js::aggregateProgram` | — | `kepatuhan` + `belumDihitung: number` (laporan disetujui dengan `completedWeeks < minggu ≤ min(12, jumlah_minggu)` dan realisasi valid) | akselerasi/index.vue, mock-directus-server (SSR), monitoring.spec.ts | provinsi,kabkota | `completedWeeks` berbasis `jakartaDate()` | — | field tambahan |
| Kurasi investor | `executive/index.js` | `investor_profil` + `kurator_dicabut_oleh UUID`, `kurator_dicabut_pada TIMESTAMPTZ` (migration `20261001B`; tabel tidak terdaftar di `directus_fields`) | `GET /investor/kurasi?status=` → `{ items:[{id,nama,jenama,status,disetujuiKuratorPada,kuratorDicabutPada,dateUpdated}], meta:{counts} }`; `POST /investor/profil/:id/kurasi {setuju}`; `profil-saya` + `kurator_dicabut_pada`; POST `/investor/profil` UMKM juga me-reset `kurator_dicabut_*` | investor-kurasi.vue, usaha/investor.vue | provinsi (kurasi), umkm (profil) | `TIMESTAMPTZ` | 400 `INVALID_STATUS`, 409 `STATUS_BERUBAH`, 404 `NOT_FOUND` | **breaking** respons array → consumer tunggal diubah di phase 8 |
| Kurasi katalog | `katalog/service.js::kurasiProduk` + `rules.js::KURASI_ASAL` | `produk.status_kurasi` | 409 `TRANSISI_KURASI_TIDAK_VALID` | katalog/kurasi.vue | KURASI (provinsi) | — | — | tayang ← [menunggu]; rekomendasi_marketplace ← [menunggu, tayang]; ditolak ← [menunggu, tayang, rekomendasi_marketplace] |
| LOI status | `PATCH /katalog/loi/:id` | `produk_loi.status` | body `{status:"ditindaklanjuti"\|"ditutup"}` → `{id,status}`; transisi baru→ditindaklanjuti, baru→ditutup, ditindaklanjuti→ditutup | katalog/kurasi.vue; tipe `ProdukLoi` + `persetujuanKontak` | KURASI | — | 400 `INVALID_PAYLOAD`, 404 `LOI_NOT_FOUND`, 409 `TRANSISI_LOI_TIDAK_VALID`, 403 non-kurator | route baru |
| Grant katalog login | migration `20261001C` | `directus_permissions` policy aplikasi `9325db4b…` & investor `89167fa4…` | Directus items/assets untuk `produk`, `produk_foto`, `kota`, `faq`, `directus_files` (folder katalog saja), disalin apa adanya dari baris Public saat migration | katalog publik, `ProductCard`, filter wilayah `/katalog`, `/faq` | baca, filter & field identik Public | — | — | idempotent `NOT EXISTS` pada (policy, collection, action, permissions::jsonb); down menghapus persis baris itu |
| Dialog paspor | passport.vue | — | `POST /passport/:id/cabut` & terbitkan ulang (tetap) | — | provinsi | — | error inline di dialog | tanpa perubahan API |

---

## 5. Delta visual/perilaku yang disengaja dan flow screenshot wajib

Semua screenshot disimpan di `docs/qc-diskuk-e2e-plan/evidence/<BUG-ID>-<before|after>-<n>.png` (folder gitignored). "Before" diambil dari baseline sebelum phase; "after" setelah phase.

| Bug | Flow browser wajib (peran) |
|---|---|
| BUG-001 | Infografis tanpa filter → filter Kab. Bogor → filter kecamatan; judul panel berubah per level; klik baris membuka Analitik dengan filter level yang benar (provinsi) |
| BUG-002 | Kartu lima aspek tab Legalitas: NIB menampilkan persen kecil, sub-teks "dari N UMKM" (provinsi) |
| BUG-003/004 | Builder: daftar Kelompokkan & Tambah filter tidak duplikat; tambah Kab. Bekasi lalu Kota Bekasi → chip "Kabupaten/kota salah satu KAB. BEKASI, KOTA BEKASI" → hasil 2 kelompok; reload URL mempertahankan chip (provinsi); kabkota tetap dipaksa kotanya |
| BUG-005 | Spasial: klik kab → kartu, peta tidak zoom; "Lihat rincian kecamatan" → drill; "Buka di Analitik" → Analitik terfilter; Infografis sama; landing: kartu tanpa tombol Analitik |
| BUG-006…010 | Ajukan: isi → Hitung Skor (tetap Draft) → Ajukan (Siap dikurasi, form read-only) → kurasi Tolak dengan alasan (dialog) → buka lagi: alasan tampil → Ajukan ulang (form terisi) → Hitung → Ajukan → BA → tab Ditolak tidak lagi berisi usaha itu; tab Draft tanpa Tolak; kabkota tanpa tombol Tolak |
| BUG-011 | Klik BA → file PDF terunduh, terbuka, berisi nomor & daftar usaha (provinsi); kabkota: daftar tanpa tautan |
| BUG-012 | Tab Disetujui > 25 baris → pager, halaman 2, kembali; ganti tab mereset ke halaman 1 |
| BUG-013 | Review laporan tanpa foto → banner "Laporan ini tidak melampirkan foto bukti transaksi…" → klik Setujui → "Tetap setujui tanpa foto bukti?" → "Ya, setujui tanpa bukti" |
| BUG-014 | Peserta dengan minggu 1–6 capai target & minggu 7 ditolak → checkbox nonaktif + "Rangkaian terbaru: 0 minggu"; label baru |
| BUG-015 | Kartu kepatuhan menampilkan teks penjelasan + jumlah minggu berjalan |
| BUG-016…018 | Kurasi Investor: tab + jumlah; Disetujui tanpa tombol Setujui; Cabut → dialog → pindah ke tab Persetujuan dicabut → Setujui ulang |
| BUG-019/020 | Kurasi Katalog: Lihat di tab Tayang tanpa "Tayangkan", ada "Lihat di katalog"; Ditolak read-only; LOI dialog + ubah status |
| BUG-021 | Login provinsi & umkm → Produk Katalog → "Lihat di katalog" → detail produk tampil dengan foto |
| BUG-022 | Paspor: Cabut → dialog berisi kode & nama, tombol "Memproses…" saat jalan, tidak berubah isi saat menutup |

---

## 6. Phase index

| Phase | Judul | Bug | Bergantung pada | Alasan pemisahan |
|---|---|---|---|---|
| 1 | Infografis: judul level wilayah & lima aspek | 001, 002 | gerbang §9 | dua ekstensi berbeda (analytics web + operasional) tetapi satu halaman; rollback mudah |
| 2 | Analitik: field wilayah tunggal & filter multi-nilai | 003, 004 | 1 (berbagi `index.vue` hanya baca, tidak konflik) | menyentuh QueryBuilder yang baru dimigrasi P6 |
| 3 | Peta: kartu info wilayah | 005 | 1 (`index.vue` diubah lagi untuk `@analyze`) | komponen bersama tiga konsumen; `LandingMap.vue` tidak diubah, perilaku landing berubah lewat komponen bersama |
| 4 | Talent Scouting: alur ajukan, tolak, alasan, tab Ditolak, wajib | 006, 007, 008, 009, 010, TS-15, TS-17 | gerbang §9 | migration + state machine; review & rollback mandiri |
| 5 | Talent Scouting: PDF Berita Acara | 011 | 4 (kurasi.vue diubah di 4) | route + dokumen baru |
| 6 | Panel Pendampingan: paging, peringatan bukti, aturan pitching | 012, 013, 014 | gerbang §9 | kontrak antrean KPI breaking |
| 7 | Monitoring Eksekutif: penjelasan kepatuhan | 015 | 6 (konsep minggu berjalan sama) | kecil, terpisah |
| 8 | Kurasi Investor: status server, tab, guard | 016, 017, 018 | gerbang §9 | migration + kontrak breaking |
| 9 | Kurasi Katalog: aksi per status, LOI, grant login | 019, 020, 021 | gerbang §9 | migration permission + route LOI |
| 10 | Talent Passport: dialog cabut | 022 | gerbang §9 | UI saja |

Urutan eksekusi wajib: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Satu commit per phase.

---

## 7. Risk ledger

| # | Kelas | Lokasi | Input yang mematahkan desain naif | Mitigasi yang diresepkan | Test pembukti | Phase |
|---|---|---|---|---|---|---|
| R1 | Check-then-act | talent ajukan, hitung-skor, tolak, PATCH | Dua tab: tab A Ajukan, tab B PATCH draft yang sama | Semua transisi: `findPengajuan(…,{lock:true})` (`SELECT … FOR UPDATE`) → `requireStatus` → `pastikanUsaha` → `UPDATE` dalam satu transaksi | `test/pg/talent.test.js`: "ajukan paralel: tepat satu 200" (`[200,409,409]`); "ajukan paralel dengan PATCH" (tepat satu 200, status akhir konsisten); PATCH `dinilai` → 409; tolak `draft` → 409 | 4 |
| R2 | Check-then-act | kurasi investor | Tab A Cabut, tab B Setujui berdasar tampilan lama | `UPDATE investor_profil … WHERE usaha=? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL AND disetujui_kurator_pada IS [NOT] NULL RETURNING usaha`; 0 baris → SELECT lanjutan hanya memilih kode galat 409 `STATUS_BERUBAH` / 404 `NOT_FOUND` | `test/pg/investor-kurasi.test.js` kasus 2, 3, 7 (paralel → `[200,409]`) + `test/executive.test.js` | 8 |
| R3 | Check-then-act | kurasi katalog, LOI | Tab A Tolak, tab B Tayangkan produk yang sudah ditolak | `UPDATE produk … WHERE id=? AND status_kurasi IN (SELECT jsonb_array_elements_text(?::jsonb)) RETURNING id` dengan `KURASI_ASAL` di `katalog/rules.js`; bentuk sama untuk `produk_loi` dengan `LOI_ASAL`. Binding teks JSON (Knex mengembangkan array binding, lihat komentar `talent/service.js::ID_LIST`). Foto dipindah hanya setelah update sukses | matriks `test/katalog-rules.test.js` + `test/pg/katalog-transisi.test.js` kasus 1, 2, 5, 7 (paralel → `[200,409]`) | 9 |
| R4 | Async UI ordering | dialog tolak talent, unduh BA, dialog investor, konfirmasi bukti KPI, dialog LOI, dialog paspor | `mutate()` lalu reset sinkron menutup dialog walau request gagal | Reset & tutup **hanya** setelah `await` sukses; gagal → dialog/modal tetap terbuka, input & state konfirmasi dipertahankan, error inline di dalam dialog | talent.spec (500 pada tolak → dialog tetap, alasan utuh); unduh BA gagal → pesan per item, tombol aktif lagi; kpi.spec (500 pada `/review` dalam mode konfirmasi → pesan inline, konfirmasi tetap); `investor-kurasi.spec.ts` test 2 (`state.gagalKurasiInvestor`); katalog.spec LOI (`state.gagalLoi`); passport.spec langkah 3 (`state.gagalCabutPassport`) | 4, 5, 6, 8, 9, 10 |
| R5 | Async UI ordering | Ajukan setelah edit | Ubah kapasitas setelah Hitung Skor lalu Ajukan → skor basi | Klien: `bisaAjukan` = mode draft && skor && `!berubah` (snapshot JSON payload `tersimpan` diperbarui setelah sync/simpan/hitung) && data wajib; server: PATCH menghapus skor, ajukan 409 `SKOR_BELUM_DIHITUNG` | talent.spec "mengubah isian setelah Hitung Skor menonaktifkan Ajukan"; pg "ajukan … tanpa skor 409" | 4 |
| R6 | Reentrancy | semua tombol mutasi | Klik ganda mengirim dua request | Flag sibuk diklaim **sebelum** `await` pertama, tombol `:disabled`: talent satu ref `busy` (`null\|"simpan"\|"hitung"\|"ajukan"\|"ulang"`), `mengunduhBa`; KPI `decide()` (`if (deciding) return`), `setPitching` (`if (saving) return`); investor `memutuskan`; katalog `deciding`/`loiBusy`; paspor `if (busy) return false` | dblclick → satu request (investor-kurasi.spec, talent.spec); passport.spec menghitung 2 request (1 gagal, 1 sukses) | 4, 5, 6, 8, 9, 10 |
| R7 | Resource lifecycle | popup kartu wilayah (`Popup` maplibre + listener tombol) | Klik wilayah lalu filter mengganti `regions`/unmount → popup yatim memanggil handler basi | Satu `closePopup()` idempotent dipanggil dari: klik wilayah lain, klik tombol, watcher `regions`/`level`, `onBeforeUnmount`; handler tombol memeriksa `popup === owner` | e2e `infografis.spec.ts` "BUG-005" (kartu tertutup setelah tombol rincian; tidak ada request drill sebelum tombol) + browser manual Spasial: kartu terbuka → Terapkan filter → kartu hilang | 3 |
| R8 | Resource lifecycle | object URL unduhan PDF BA | URL tidak dicabut | `URL.revokeObjectURL` di `setTimeout` setelah klik (pola passport); flag unduh dilepas di `finally` | talent.spec event download | 5 |
| R9 | Cache | `useAsyncData("kpi:laporan")` (kunci statis, `watch:[tab,page]`) | Ganti tab saat di halaman 3 → halaman 3 tab lain kosong | Tab diganti lewat `pilihTab()` yang mengeset `page=1` dan `tab` pada tick yang sama (satu fetch); setelah keputusan sukses halaman kosong mundur satu | kpi.spec BUG-012: Berikutnya → tab Ditolak → tab Disetujui → "1–25 dari 26" | 6 |
| R10 | Cache | `useAsyncData("talent:pengajuan", watch:[tab])` & `talent:usaha:<id>` | Setelah ajukan/tolak/ajukan ulang data basi | `refresh()` setelah setiap mutasi sukses; watch `syncFrom` menyetel ulang form + snapshot | talent.spec alur ajukan → pill "Siap dikurasi"; tolak → tab Ditolak | 4 |
| R11 | Cache | cache policy Directus (`withCache("policies")`) setelah migration grant | Grant baru tidak terbaca | Restart container Directus setelah migration `20261001C`; bukti runtime: curl `/panel/items/produk/<tayang>` dan `/panel/assets/<file katalog>` sebagai provinsi & umkm → 200; produk draft → 403; unggahan sendiri `/panel/files/<id>` → 200 | bukti runtime phase 9 + `katalog-grant-login.contract.test.mjs` | 9 |
| R12 | Identity/mode | form ajukan per `usahaId` | Navigasi klien usaha A → B membawa isian A | Tanpa kode tambahan: `app.vue` `<NuxtPage/>` tanpa page-key dan `generateRouteKey` memakai path ter-interpolasi sehingga param berbeda me-remount; key `useAsyncData` memuat `usahaId` | talent.spec "pindah usaha lewat navigasi klien me-remount form" | 4 |
| R13 | Identity/mode | matriks mode form ajukan (baru/draft/dinilai/disetujui/ditolak) | Ditolak → isian lama hilang; dinilai masih bisa diedit | Tabel mode `phase_4.md`; ditolak: fieldset nonaktif + "Ajukan ulang" membuat draft baru dari payload lama; dinilai/disetujui read-only | talent.spec "pengajuan ditolak menampilkan alasan dan Ajukan ulang…" + asersi read-only setelah Ajukan | 4 |
| R14 | Identity/mode | dialog konfirmasi investor/LOI/paspor | Isi dialog berganti saat animasi tutup (flip) atau ditutup saat sibuk | `v-if` pada `UiDialogContent` terhadap `cabutTarget`/`loiTarget`/`salinanKonfirmasi`; dialog ditutup hanya setelah sukses; tidak bisa ditutup saat sibuk (`:show-close-button="!busy"` + guard `update:open`) | passport.spec dengan `state.tundaCabutPassport`: judul tetap "Cabut…" selama "Memproses…" | 8, 9, 10 |
| R15 | Fan-out/cost | filter `kota_nama ~in~` pada 5,4 jt baris | `COALESCE(a.kota_nama,…) = ANY(…)` non-sargable | Jalur sama dengan `eq` yang sudah ada; budget/timeout compiler existing; batas 100 nilai; known limitation | unit compiler `in` existing + `analytics-filters.test.ts` | 2 |
| R16 | Fan-out/cost | lima aspek total | — | `COUNT(*)` sudah ada; tanpa query baru | `permen-aspek.test.cjs` | 1 |
| R17 | Fan-out/cost | jumlah per tab investor | Query terpisah per status | Dua statement: daftar (terfilter, `LIMIT 200`) + satu `COUNT(*) FILTER (WHERE …)` atas `STATUS_PROFIL_SQL` yang sama | `test/pg/investor-kurasi.test.js` | 8 |
| R18 | Fan-out/cost | total antrean KPI | `COUNT(*) OVER()` tidak memberi total bila halaman melewati akhir | Satu `SELECT COUNT(*)::integer` dengan WHERE & binding identik dengan query daftar (2 query, tanpa loop) | unit `kpi.test.js` (binding LIMIT/OFFSET) + pg `kpi-alur` (27 baris, 3 halaman) | 6 |
| R19 | Cross-phase | `index.vue` & `infografis.spec.ts` diubah di phase 1 & 3 | Phase 3 menimpa perubahan phase 1 | Phase 3 menyatakan ulang invarian phase 1 (prop `regionLevel`, drill per level) dan hanya menambah `@analyze` | diff review + infografis.spec penuh di phase 3 | 3 |
| R20 | Cross-phase | `kurasi.vue`, `talent/index.js`, `oas.yaml`, test talent diubah di phase 4 & 5 | Phase 5 merusak gate Tolak/dialog/alasan | Phase 5 hanya menambah route PDF (guard `KEPUTUSAN` dari phase 4) dan blok kartu Berita Acara; talent.spec phase 4 wajib tetap hijau | talent.spec penuh + `pnpm test` di phase 5 | 5 |
| R21 | Cross-phase | `mock-program.mjs`, `types/program.ts`, `oas.yaml`, `operasional.directus.spec.ts` disentuh beberapa phase | Phase belakangan menimpa handler/tipe phase sebelumnya | Setiap phase hanya menambah/mengubah blok miliknya; spec phase sebelumnya dijalankan ulang di gerbang phase berikutnya (lihat §8 "regresi") | e2e regresi kumulatif | 4–10 |
| R22 | Waktu | `ditolakAt`, tanggal BA, `completedWeeks` | Browser/server di TZ lain menggeser tanggal | `ditolakAt` `TIMESTAMPTZ` → ISO `Z`, tampil `timeZone: "Asia/Jakarta"`; tanggal BA via `to_char` + format UTC; `completedWeeks` memakai `jakartaDate()` | talent.spec dengan `timezoneId: "America/New_York"`; `TZ=Asia/Tokyo` & `America/Los_Angeles` `node --test test/talent-ba-pdf.test.js`; executive.test batas 2026-10-04T16:59:59Z (4 minggu) vs 17:00:00Z (5 minggu) | 4, 5, 7 |
| R23 | Fan-out/audience | notifikasi | — | Tidak ada notifikasi/broadcast baru di plan ini | n/a | — |

---

## 8. Matriks validasi global

| Lapisan | Perintah / bukti | Phase |
|---|---|---|
| Inspeksi sumber | `git diff --name-only` vs manifest (`python3 docs/qc-diskuk-e2e-plan/scope_guard.py check …`) | semua |
| Static web | `cd apps/web && pnpm lint && pnpm typecheck` | 1–10 |
| Unit web | `cd apps/web && pnpm test:unit` | 1–10 |
| Unit ekstensi program | `cd services/directus/extensions/program && pnpm test` | 4–9 |
| PG ekstensi program | `cd services/directus/extensions/program && DISKUK_TEST_PG_URL=… pnpm test:pg` (DB template `scripts/test-db-template.sh`) | 4, 6, 8, 9 |
| Unit ekstensi analytics | `cd services/directus/extensions/analytics && pnpm test` (regresi saja; phase 1–3 tidak mengubah ekstensi analytics) | 2 |
| Oxlint per file manifest | `pnpm exec oxlint --disable-nested-config <file .ts/.vue/.js manifest>` → exit 0 (oxlint seluruh repo sudah gagal di `data-lapangan/[id].vue` sejak baseline, jadi gerbang hanya file manifest) | semua |
| Unit ekstensi operasional | `cd services/directus/extensions/directus-extension-operasional && pnpm test && pnpm run build` | 1 |
| Kontrak Directus | `cd services/directus && pnpm test` (public-grants, route-manifest, dokumen) | 4, 5, 8, 9 |
| E2E mock | `cd apps/web && pnpm exec playwright test tests/e2e/<spec>` | semua |
| Regresi kumulatif | di akhir tiap phase ≥ 4: `cd apps/web && pnpm exec playwright test tests/e2e/talent.spec.ts tests/e2e/kpi.spec.ts tests/e2e/katalog.spec.ts tests/e2e/passport.spec.ts` (spec yang sudah ada saat itu) + `cd services/directus/extensions/program && pnpm test` | 4–10 |
| Authenticated API | `curl` dengan cookie sesi lokal per peran (lihat phase) | 4, 5, 6, 8, 9 |
| Browser | flow §5 + screenshot | semua |
| Migration | `cd services/directus && pnpm dbm:l` pada stack lokal, lalu `down`/`up` sekali | 4, 8, 9 |
| Provider | tidak ada | — |
| Deploy/produksi | **tidak dalam scope** (prod tanpa backup; butuh keputusan user terpisah) | — |

---

## 9. Batas dirty worktree & operasi berisiko tinggi

1. **Gerbang masuk (wajib):** perubahan P6 UI-audit yang belum di-commit (26 file di `apps/web/**`, termasuk `QueryBuilder.vue`, `talent/ajukan/[usahaId].vue`, `usaha/passport.vue`, `katalog.spec.ts`) harus sudah di-commit oleh pemiliknya. Jalankan `git status --porcelain -- apps services scripts`. Output harus kosong selain `?? AKUN_DUMMY.md`, `?? UI_audit.md`. Jika tidak kosong → **berhenti** dan laporkan.
2. Catat `git rev-parse HEAD` baru sebagai baseline di `execution_log.md`.
3. Jangan pernah commit `docs/`, `AKUN_DUMMY.md`, `UI_audit.md`, `.env*`.
4. Migration hanya dijalankan ke DB lokal/test. **Dilarang** menyentuh server produksi `fuad` (DB 18 GB, tanpa backup).
5. Jangan `git push`, `git reset --hard`, `git checkout -- <file>` pada file yang bukan milik phase.
6. Sebelum tiap phase: `python3 docs/qc-diskuk-e2e-plan/scope_guard.py snapshot --output /tmp/qc-phase-<n>.json`; setelah: `… check --snapshot /tmp/qc-phase-<n>.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase <n>`; `outside` harus kosong.

---

## 10. Prompt masuk eksekutor dan kondisi berhenti

### Prompt masuk

```text
Kamu mengeksekusi docs/qc-diskuk-e2e-plan di repo /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk.
Baca main_plan.md penuh, lalu phase_<n>.md satu per satu sesuai urutan §6. Untuk setiap phase:
1) jalankan gerbang §9 (phase 1) / pastikan phase sebelumnya sudah ter-commit;
2) snapshot scope_guard; 3) kerjakan edit berurutan persis seperti phase file;
4) jalankan semua perintah validasi phase dan cocokkan dengan hasil yang diharapkan;
5) ambil screenshot flow §5 phase itu; 6) scope_guard check (outside kosong);
7) commit satu commit dengan pesan di phase file + trailer Co-Authored-By;
8) tulis ringkasan + bukti ke docs/qc-diskuk-e2e-plan/execution_log.md.
Jangan membuat keputusan produk baru. Jangan menyentuh file di luar manifest.
```

### Kondisi berhenti (laporkan, jangan improvisasi)

- Gerbang §9 gagal.
- Perlu mengubah file di luar manifest phase (aturan scope-amendment).
- Perilaku kode yang ditemukan berbeda dari "kontrak saat ini" di phase file (anchor tidak ditemukan atau logika berbeda).
- Test yang diharapkan hijau tetap merah setelah dua upaya perbaikan dalam scope.
- Bukti runtime grant (phase 9) menunjukkan Directus tidak menggabungkan dua baris permission `directus_files` pada satu policy.
- Perintah memerlukan kredensial/akses yang tidak tersedia (DB test, stack lokal) — catat sebagai "unproven" dan berhenti sebelum commit phase yang membutuhkan bukti itu sebagai gerbang.
