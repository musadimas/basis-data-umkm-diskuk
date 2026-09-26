# Phase 6 — Talent Scouting: pengajuan, kalkulator Talent Index, nominasi, dan Berita Acara

## Objective, dependencies, observable result

- **Dependency:** Phase 4 (`assertUsahaAccess`, atribut Jabar).
- **Objective:** pipeline talenta `diajukan → dinilai → scouting` (+ `ditolak`), rubrik Talent Index v1 server-side, formulir pengajuan dengan data SIDT read-only + input operasional Jabar + unggah surat komitmen, panel persetujuan provinsi yang menerbitkan Berita Acara, aksi "Ajukan ke Talent Scouting" di Tabular, dan infrastruktur unggah/unduh berkas (body biner utuh lewat proxy, folder `operasional`, endpoint berkas berotorisasi domain).
- **Observable result:** kabkota Subang mengajukan "Keripik Nanas Subang", menekan [Hitung Skor] melihat animasi skor dan status rekomendasi, mengirim; provinsi menominasikan lalu menerbitkan Berita Acara `BA-TS/2026/000N`; status berubah menjadi "Talent Pool — Scouting".

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-6-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926E-create-talenta.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/talent-index.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/talenta-service.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/berkas-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/talent-index.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/talenta-service.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/berkas-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `docker-compose.yml` |
| modify | `scripts/seed-dummy-operasional.mjs` |
| modify | `scripts/seed-dummy-operasional.sql` |
| modify | `scripts/cleanup-dummy-operasional.sql` |
| modify | `apps/web/server/utils/directus-proxy.ts` |
| modify | `apps/web/tests/unit/directus-proxy.test.ts` |
| create | `apps/web/app/composables/useBerkasUpload.ts` |
| modify | `apps/web/app/constants/OPERASIONAL.ts` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/ROLES.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| create | `apps/web/app/components/operasional/TalentaStatusBadge.vue` |
| create | `apps/web/app/components/operasional/TalentIndexResult.vue` |
| create | `apps/web/app/pages/(private)/dashboard/talenta/index.vue` |
| create | `apps/web/app/pages/(private)/dashboard/talenta/[id].vue` |
| create | `apps/web/app/pages/(private)/dashboard/talenta/ajukan/[usahaId].vue` |
| modify | `apps/web/app/components/dashboard/TabularData.vue` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| modify | `apps/web/tests/unit/roles.test.ts` |
| create | `apps/web/tests/e2e/talent-scouting.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `apps/web/server/utils/directus-proxy.ts::proxyToDirectus` baris `: await readRawBody(event);`
- `services/directus/analytics-shared/privacy.cjs::maskNik`
- Endpoint context Directus: `handler: (router, { database, logger, services, getSchema })` (`services.AssetsService#getAsset(id, { transformationParams: {} })` → `{ stream, file }`).
- `services/directus/extensions/directus-extension-operasional/src/usaha-service.js::assertUsahaAccess`
- `apps/web/app/components/dashboard/TabularData.vue` item "Ubah Data Lapangan" (Phase 4).

```bash
rg -n "await readRawBody\(event\)" apps/web/server/utils/directus-proxy.ts
rg -n "function maskNik" services/directus/analytics-shared/privacy.cjs
rg -n "async getAsset\(id, transformation, range, deferStream" services/directus/node_modules/.pnpm/@directus+api@*/node_modules/@directus/api/dist/services/assets.js
rg -n "Ubah Data Lapangan" apps/web/app/components/dashboard/TabularData.vue
```

## Current contract and final desired contract

### Current

Tidak ada tabel talenta/BA; proxy mengubah body menjadi string UTF-8 (unggah biner rusak); tidak ada permission `directus_files` untuk role operasional.

### Final

- Migrasi `20260926E` (transaksi):
  - `talenta_berita_acara(id UUID PK DEFAULT gen_random_uuid(), nomor TEXT NOT NULL UNIQUE, tanggal DATE NOT NULL, catatan TEXT, diterbitkan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, date_created TIMESTAMPTZ NOT NULL DEFAULT NOW())`.
  - `talenta(id UUID PK DEFAULT gen_random_uuid(), usaha UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE, kota INTEGER REFERENCES kota(id) ON DELETE SET NULL, status TEXT NOT NULL CHECK (status IN ('diajukan','dinilai','scouting','talent_lab','accelerator','champion','ditolak')), kapasitas_produksi_bulanan NUMERIC(12,2) NOT NULL CHECK (kapasitas_produksi_bulanan >= 0), satuan_kapasitas TEXT NOT NULL CHECK (satuan_kapasitas IN ('unit','kg')), kesiapan_halal BOOLEAN NOT NULL DEFAULT FALSE, kesiapan_pirt_bpom BOOLEAN NOT NULL DEFAULT FALSE, kesiapan_hki BOOLEAN NOT NULL DEFAULT FALSE, adopsi_qris BOOLEAN NOT NULL DEFAULT FALSE, pencatatan_keuangan_digital BOOLEAN NOT NULL DEFAULT FALSE, surat_komitmen UUID REFERENCES directus_files(id) ON DELETE SET NULL, skor_finansial NUMERIC(5,2) NOT NULL, skor_pasar NUMERIC(5,2) NOT NULL, skor_legalitas NUMERIC(5,2) NOT NULL, skor_sdm NUMERIC(5,2) NOT NULL, skor_total NUMERIC(5,2) NOT NULL, rubrik_versi SMALLINT NOT NULL DEFAULT 1, rekomendasi TEXT NOT NULL, diajukan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, dinominasikan_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, dinominasikan_pada TIMESTAMPTZ, alasan_penolakan TEXT, ditolak_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL, ditolak_pada TIMESTAMPTZ, berita_acara UUID REFERENCES talenta_berita_acara(id) ON DELETE SET NULL, date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(), date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW())`.
  - `CREATE UNIQUE INDEX IF NOT EXISTS ux_talenta_usaha_aktif ON talenta(usaha) WHERE status <> 'ditolak'`; `CREATE INDEX IF NOT EXISTS idx_talenta_status_kota ON talenta(status, kota)`.
  - `directus_collections`: `talenta` (icon `workspace_premium`, sort 22), `talenta_berita_acara` (icon `gavel`, sort 23).
  - `directus_folders`: `INSERT INTO directus_folders (id, name, parent) VALUES ('fa57be17-82ba-480c-b77c-536d42a124d4','operasional',NULL) ON CONFLICT (id) DO NOTHING`.
  - Permission `directus_files` untuk keempat policy (`9325db4b…`, `542bb438…`, `81086586…`, `98524352…`): `create` (permissions `{}`, validation `{"_and":[{"type":{"_in":["image/jpeg","image/png","image/webp","application/pdf"]}},{"folder":{"_eq":"fa57be17-82ba-480c-b77c-536d42a124d4"}}]}`, presets `{"folder":"fa57be17-82ba-480c-b77c-536d42a124d4"}`, fields `*`); `read` (permissions `{"uploaded_by":{"_eq":"$CURRENT_USER"}}`, fields `id,type,filesize,filename_download,title,width,height,uploaded_on`). `WHERE NOT EXISTS` per (policy, collection, action). `down` menghapus semuanya.
- `docker-compose.yml` service `directus.environment` tambah `FILES_MAX_UPLOAD_SIZE: 10mb`.
- `talent-index.js` (murni) mengekspor `RUBRIK_VERSI = 1`, `hitungTalentIndex(input)`; `input = { omzetTahunan, nibAda, totalTenagaKerja, atribut: { npwp_usaha, sertifikat_halal, pirt_bpom, hki_merek, rekening_terpisah, sop_tertulis, ecommerce, medsos_bisnis, akses_kur } (boolean|null), form: { kapasitasProduksiBulanan, kesiapanHalal, kesiapanPirtBpom, kesiapanHki, adopsiQris, pencatatanKeuanganDigital, suratKomitmenAda } }` → `{ finansial, pasar, legalitas, sdm, total, rekomendasi, rubrikVersi }` menurut rumus ledger main plan §4 (setiap aspek dan total dibulatkan `Math.round(x * 100) / 100`; label rekomendasi ≥75 / ≥60 / lainnya).
- `berkas-service.js`:
  - `FOLDER_OPERASIONAL = "fa57be17-82ba-480c-b77c-536d42a124d4"`.
  - `assertBerkasMilik(database, fileId, operator)` → berkas ada, `folder = FOLDER_OPERASIONAL`, `uploaded_by = operator.userId`; selain itu 400 `VALIDATION_FAILED` (`fields.berkas`). Dipakai saat referensi berkas disimpan.
  - `BERKAS_RULES` (array; Phase 7 dan 10 menambah aturan): aturan Phase 6 `surat_komitmen`: berkas direferensikan `talenta.surat_komitmen` dan talenta dapat diakses operator (provinsi: semua; kabkota: `talenta.kota = operator.kotaId`). Selain aturan, pengunggah selalu boleh membaca berkasnya sendiri.
  - `streamBerkas({ database, services, getSchema }, fileId, operator, res)` → UUID invalid/tidak diizinkan → 404 `NOT_FOUND`; selain itu `new services.AssetsService({ schema: await getSchema(), accountability: null }).getAsset(fileId, { transformationParams: {} })`, set `Content-Type` = `file.type`, `Content-Disposition: inline; filename="<filename_download tanpa karakter selain [A-Za-z0-9._-]>"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, lalu `stream.pipe(res)`.
- `talenta-service.js` (semua memakai `resolveOperator`; scoping kabkota via `talenta.kota`):
  - `getPrefill(database, usahaId, operator)` (DATA_ROLES) → `assertUsahaAccess` + `{ data: { usaha: { id, nama, nib, nikTersamar: maskNik(pelaku.nik), omzetTahunan, alamat: "<alamat_jalan>, <kelurahan>, <kecamatan>, <kota>", kota }, talentaAktif: { id, status } | null } }`.
  - `hitungSkor(database, body, operator)` (DATA_ROLES) → validasi form (lihat `ajukan`), muat input (usaha, NIB, total tenaga kerja = jumlah 8 kolom `statistik_tenaga_kerja`, atribut) → `{ data: <hasil hitungTalentIndex> }` tanpa persist.
  - `ajukan(database, body, operator)` (DATA_ROLES) → body `{ usahaId, form: { kapasitasProduksiBulanan: number 0–1.000.000.000, satuanKapasitas: "unit"|"kg", kesiapanHalal, kesiapanPirtBpom, kesiapanHki, adopsiQris, pencatatanKeuanganDigital: boolean, suratKomitmenFileId: UUID|null } }`; `assertUsahaAccess`; surat komitmen → `assertBerkasMilik`; talenta aktif untuk usaha → 409 `TALENTA_SUDAH_ADA`; insert `status='diajukan'`, `kota` = kota usaha, skor dari `hitungTalentIndex`, `diajukan_oleh`; return detail.
  - `listTalenta(database, query, operator)` (DATA_ROLES) → filter opsional `status` (enum), `page` ≥1, `pageSize` 1–100 (default 25); urut `date_created DESC`; `{ data: [{ id, usaha: { id, nama }, kota: { id, nama }, status, skorTotal, rekomendasi, diajukanPada, beritaAcara: { id, nomor } | null }], meta: { total, page, pageSize } }`.
  - `getTalenta(database, id, operator)` (DATA_ROLES) → detail lengkap: field form, skor per aspek, `suratKomitmen: { id, nama } | null`, `riwayat: [{ tahap: "diajukan"|"dinilai"|"ditolak"|"scouting", oleh, pada }]`, `beritaAcara`.
  - `nominasi(database, id, operator)` (provinsi): hanya dari `diajukan` → `dinilai` (+ `dinominasikan_oleh/pada`), selain itu 409 `INVALID_TRANSITION`.
  - `tolak(database, id, body, operator)` (provinsi): `alasan` string 5–1000; dari `diajukan|dinilai` → `ditolak` (+ `alasan_penolakan`, `ditolak_oleh/pada`), selain itu 409.
  - `terbitkanBeritaAcara(database, body, operator)` (provinsi): `talentaIds` array UUID unik 1–100, `catatan` null atau string ≤2000; transaksi: `LOCK TABLE talenta_berita_acara IN SHARE ROW EXCLUSIVE MODE`; semua talenta harus `dinilai` (selain itu 409 `INVALID_TRANSITION` + `extensions.ids`); `tanggal` = tanggal kalender Asia/Jakarta; `nomor = 'BA-TS/' || tahun || '/' || lpad(urutan, 4, '0')` dengan urutan = jumlah BA bernomor `BA-TS/<tahun>/%` + 1; update talenta → `scouting`, `berita_acara`; return `{ data: { id, nomor, tanggal: "YYYY-MM-DD", jumlah } }`.
  - `listBeritaAcara(database, operator)` (provinsi) → `[{ id, nomor, tanggal (to_char), catatan, jumlahTalenta, diterbitkanOleh }]` urut `date_created DESC`.
- Routes `operasional`: `GET /talenta/prefill/:usahaId`, `POST /talenta/skor`, `POST /talenta`, `GET /talenta`, `GET /talenta/:id`, `POST /talenta/:id/nominasi`, `POST /talenta/:id/tolak`, `POST /berita-acara`, `GET /berita-acara`, `GET /berkas/:fileId` (ALL_ROLES; otorisasi di `streamBerkas`). Ambil `services`, `getSchema` dari context handler.
- Proxy: `readRawBody(event, false)` (Buffer; tidak ada konversi UTF-8). Cabang `isStringBody` tetap aman.
- Web:
  - `useBerkasUpload.ts`: `FOLDER_OPERASIONAL` konstanta; `uploadBerkas(file, title)` → tolak klien bila tipe bukan `image/jpeg|image/png|image/webp|application/pdf` ("Format berkas harus JPG, PNG, WEBP, atau PDF.") atau >10 MB ("Ukuran berkas maksimal 10 MB."); `FormData` dengan `folder`, `title`, lalu `file` (urutan field: `file` terakhir — syarat Directus); `$fetch<{ data: { id: string } }>("/panel/files", { method: "POST", body })`; return `{ id }`. Ekspor `berkasUrl(id)` → `/panel/operasional/berkas/${id}`.
  - `OPERASIONAL.ts` tambah `TALENTA_STATUS` (label + kelas badge): diajukan "Diajukan" `bg-slate-200 text-slate-800`; dinilai "Dinilai" `bg-sky-100 text-sky-800`; scouting "Talent Pool — Scouting" `bg-indigo-100 text-indigo-800`; talent_lab "Talent Lab" `bg-violet-100 text-violet-800`; accelerator "Accelerator" `bg-emerald-100 text-emerald-800`; champion "UMKM Champion" `bg-amber-100 text-amber-900`; ditolak "Ditolak" `bg-rose-100 text-rose-800`.
  - `TalentaStatusBadge.vue` (prop `status`); `TalentIndexResult.vue` (props hasil skor; 4 bar aspek berlabel "Aspek Finansial & Omzet (Bobot 25%)", "Kesiapan Pasar & Produk (Bobot 25%)", "Legalitas & Kepatuhan Usaha (Bobot 25%)", "Kapasitas Pengelolaan & SDM (Bobot 25%)"; teks "Talent Index Score: {total 2 desimal} / 100.00" dan "(Status: {rekomendasi})"; animasi count-up 800 ms via `requestAnimationFrame`, dilewati bila `prefers-reduced-motion: reduce`).
  - `talenta/ajukan/[usahaId].vue` (provinsi, kabkota): blok read-only "Data Bawaan SIDT" (Nama Usaha, NIK Terenkripsi, NIB, Omzet Historis `formatAnalyticsCurrency`, Alamat); bila `talentaAktif` → pesan "Usaha ini sudah dalam proses talenta" + tautan detail, form disembunyikan; form "Parameter Operasional Jabar": Kapasitas Produksi Bulanan (angka) + satuan (Unit/Kg), checkbox Sertifikat Halal / BPOM-PIRT / HKI-Merek (kesiapan legalitas lanjutan), checkbox Adopsi QRIS / Pencatatan Keuangan Digital, unggah "Surat Komitmen Keikutsertaan" (`uploadBerkas`, tampil nama berkas + status); tombol [Hitung Skor] → `POST /panel/operasional/talenta/skor` → `TalentIndexResult`; tombol [Ajukan ke Talent Scouting] (aktif setelah skor dihitung) → `POST /panel/operasional/talenta` → `navigateTo("/dashboard/talenta/<id>")`; 409 → "Usaha ini sudah memiliki pengajuan talenta aktif.".
  - `talenta/index.vue` (provinsi, kabkota): filter status (chip: Semua + 7 status), tabel (Usaha, Kab/Kota, Skor, Rekomendasi, Status, Diajukan); provinsi: checkbox pada baris `dinilai` + tombol "Terbitkan Berita Acara & Masukkan ke Talent Pool" (dialog catatan opsional) → sukses "Berita Acara {nomor} terbit. {jumlah} talenta masuk Talent Pool (Scouting)."; bagian "Riwayat Berita Acara" (provinsi) dari `GET /berita-acara`; paginasi.
  - `talenta/[id].vue`: ringkasan usaha, `TalentaStatusBadge`, `TalentIndexResult` (tanpa animasi), parameter form, tautan surat komitmen (`berkasUrl`, target `_blank`), riwayat; provinsi: tombol "Nominasikan" (status diajukan) dan "Tolak" (dialog alasan wajib) untuk diajukan/dinilai.
  - `TabularData.vue`: item menu "Ajukan ke Talent Scouting" (`/dashboard/talenta/ajukan/${r.id}`, ikon `Award`).
  - `ROLE_ROUTES` provinsi & kabkota tambah `/dashboard/talenta`; `NAVIGATION_LINKS` provinsi (grup dashboard) tambah `{ id: "talenta", label: "Talent Scouting", to: "/dashboard/talenta", icon: Award }`; kabkota tambah `{ id: "talenta", label: "Pengajuan Talenta", to: "/dashboard/talenta", icon: Award }`.
- Seed:
  - `.mjs seed`: unggah (admin) `apps/web/public/images/pelaku-umkm.jpg` sebagai `filename_download = "dummy_surat-komitmen.jpg"`, `title = "dummy_surat-komitmen"`, `folder = FOLDER_OPERASIONAL` (skip bila berkas dengan `filename_download` itu sudah ada). `.mjs cleanup`: hapus berkas `filter[filename_download][_starts_with]=dummy_` sebelum menghapus user.
  - `.sql`: upsert talenta (kunci unik `usaha` untuk status aktif; gunakan `INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM talenta WHERE usaha = …)`), satu BA `nomor = 'dummy_BA-TS/2026/0001'`, `tanggal = '2026-08-01'`, `diterbitkan_oleh` = dummy_admin. Nilai literal (skor = hasil rubrik v1 atas data Phase 1/4; `surat` = id berkas `dummy_surat-komitmen.jpg`; `diajukan_oleh` = dummy_admin.subang untuk usaha Subang, dummy_admin untuk lainnya):

    | NN | status | kapasitas | satuan | halal | pirt | hki | qris | pencatatan | surat | finansial | pasar | legalitas | sdm | total | rekomendasi | BA |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 01 | scouting | 1200 | unit | T | T | T | T | T | ada | 100.00 | 100.00 | 100.00 | 91.00 | 97.75 | Direkomendasikan Masuk Talent Pool | ya |
    | 02 | scouting | 3000 | kg | T | T | F | T | F | ada | 64.00 | 100.00 | 80.00 | 68.00 | 78.00 | Direkomendasikan Masuk Talent Pool | ya |
    | 03 | scouting | 800 | kg | T | T | T | T | T | ada | 85.00 | 95.00 | 100.00 | 94.00 | 93.50 | Direkomendasikan Masuk Talent Pool | ya |
    | 04 | diajukan | 150 | unit | F | F | T | T | F | ada | 35.00 | 78.75 | 40.00 | 48.00 | 50.44 | Belum Direkomendasikan | — |
    | 05 | dinilai | 600 | kg | T | T | F | T | T | ada | 43.00 | 90.00 | 80.00 | 82.00 | 73.75 | Dipertimbangkan | — |
    | 07 | ditolak | 100 | unit | F | F | F | F | F | — | 17.50 | 27.50 | 20.00 | 12.00 | 19.25 | Belum Direkomendasikan | — |
    | 08 | scouting | 900 | kg | T | T | T | T | T | ada | 72.00 | 97.50 | 100.00 | 82.00 | 87.88 | Direkomendasikan Masuk Talent Pool | ya |

    Usaha 07: `alasan_penolakan = 'Kapasitas produksi belum memadai'`, `ditolak_oleh` = dummy_admin, `ditolak_pada = '2026-07-25T03:00:00Z'`. Usaha 05: `dinominasikan_oleh` = dummy_admin, `dinominasikan_pada = '2026-09-22T03:00:00Z'`. Usaha 06 tidak punya talenta. Talent-index test wajib memuat assert bahwa `hitungTalentIndex` menghasilkan angka tabel ini untuk input yang sama (vektor seed). Phase 7 memindahkan sebagian ke `talent_lab`/`accelerator`.
  - Cleanup (bagian atas): `DELETE FROM talenta_berita_acara WHERE nomor LIKE 'dummy\_%';` (baris talenta terhapus lewat cascade usaha).

## Ordered edits

1. Migrasi `20260926E` + kontrak test (tabel, indeks parsial, folder UUID, 8 permission `directus_files`).
2. `docker-compose.yml` `FILES_MAX_UPLOAD_SIZE`.
3. `talent-index.js` + `talent-index.test.cjs`: vektor A (usaha dummy 01 dengan form kapasitas 1200 unit, semua kesiapan true, qris true, pencatatan true, surat ada, TK 7) → finansial 100, pasar 100, legalitas 100, sdm 91, total 97.75, "Direkomendasikan Masuk Talent Pool"; vektor B (omzet 300.000.000, pencatatan true, kur false; ecommerce/medsos/qris true, kapasitas 500; nib/npwp/halal/pirt true, hki false; TK 10, rek/sop true, surat ada) → 50, 87.5, 80, 100, total 79.38; vektor C semua null/0 → 0 dan "Belum Direkomendasikan"; batas 60 dan 75 tepat.
4. `berkas-service.js` + test (UUID invalid → 404; berkas milik orang lain tanpa referensi → 404; kabkota membaca surat komitmen talenta kota lain → 404; pengunggah membaca berkasnya → stream; header `nosniff` dan nama berkas disanitasi).
5. `talenta-service.js` + routes + test (kabkota ajukan usaha kota lain → 404; duplikasi aktif → 409; surat komitmen milik user lain → 400; kabkota nominasi → 403; nominasi dari `dinilai` → 409; tolak alasan 3 char → 400; BA dengan satu id berstatus `diajukan` → 409 dan tidak ada perubahan; BA sukses → nomor `BA-TS/<tahun>/0001` pada DB kosong dan tanggal WIB; list kabkota binding `kota`).
6. Proxy `readRawBody(event, false)` + unit test: body biner berisi seluruh byte 0x00–0xFF di-POST ke `/panel/files` diteruskan identik (upstream membandingkan SHA-256).
7. Web: composable, konstanta, tipe (`TalentaRingkas`, `TalentaDetail`, `TalentIndexHasil`, `BeritaAcara`), komponen, 3 halaman, `TabularData.vue`, `ROLES.ts`, `NAVIGATION.ts`, `roles.test.ts`.
8. Mock fixture: routes talenta (prefill usaha "Usaha 01"; skor → vektor B; POST talenta → id `33333333-3333-4333-8333-000000000001`; list berisi 1 `dinilai` + 1 `diajukan`; detail; nominasi/tolak; BA → `{ nomor: "BA-TS/2026/0001", jumlah: 1 }`; list BA) dan `POST /panel/files` → `{ data: { id: "44444444-4444-4444-8444-000000000001" } }`.
9. `talent-scouting.spec.ts`: kabkota dari Tabular → "Ajukan ke Talent Scouting" → isi form, unggah berkas (setInputFiles buffer PNG kecil) → request `/panel/files` multipart; [Hitung Skor] → teks "Talent Index Score: 79.38 / 100.00" dan "(Status: Dipertimbangkan)"; ajukan → URL detail; screenshot `talenta-ajukan.png`; provinsi `/dashboard/talenta` → pilih baris dinilai → terbitkan → teks "Berita Acara BA-TS/2026/0001 terbit"; screenshot `talenta-daftar.png`; kabkota tidak melihat tombol terbitkan.
10. Seed `.mjs`/`.sql`/cleanup sesuai §Final.
11. `operasional.directus.spec.ts`: kabkota mengajukan usaha 06 (Madu Hutan Subang) dengan unggah berkas nyata → detail tampil dan tautan surat komitmen merespons 200 `image/png`; provinsi menominasikan lalu menerbitkan BA → status "Talent Pool — Scouting"; kabkota `GET /panel/operasional/berkas/<surat komitmen talenta Garut>` → 404.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Usaha yang pernah `ditolak` boleh diajukan ulang (indeks parsial mengecualikan `ditolak`).
- Skor dihitung ulang saat `ajukan` (angka pratinjau klien tidak dipercaya).
- Atribut belum didata → aspek terkait 0 (null = false), terlihat dari rincian aspek.
- BA serentak dari dua tab → lock tabel mencegah nomor ganda; tab kedua mendapat 409 bila talenta sudah `scouting`.
- Berkas >10 MB → ditolak klien; bila lolos ke Directus → error Directus 413 ditampilkan "Unggah gagal.".
- Berkas PDF surat komitmen → `Content-Type: application/pdf` inline.
- Pendamping/umkm ke endpoint talenta → 403.
- Tanggal BA dibuat 23:30 UTC 31 Juli → tanggal `2026-08-01` (WIB).

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
docker compose --env-file .env.example config --quiet
node --check scripts/seed-dummy-operasional.mjs
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/composables/useBerkasUpload.ts app/constants/OPERASIONAL.ts app/types/operasional.ts app/constants/ROLES.ts app/constants/NAVIGATION.ts app/components/operasional/TalentaStatusBadge.vue app/components/operasional/TalentIndexResult.vue "app/pages/(private)/dashboard/talenta/index.vue" "app/pages/(private)/dashboard/talenta/[id].vue" "app/pages/(private)/dashboard/talenta/ajukan/[usahaId].vue" app/components/dashboard/TabularData.vue server/utils/directus-proxy.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; unit proxy biner pass; screenshot `talenta-ajukan.png`, `talenta-daftar.png`.

## Runtime/browser proof and unproven boundary

Disposable stack + seed; jalankan `operasional.directus.spec.ts`. Tambahan: `SELECT nomor, tanggal FROM talenta_berita_acara ORDER BY date_created DESC LIMIT 1` menampilkan BA baru. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: unggah multipart ke MinIO lewat proxy nyata, validasi permission `directus_files` Directus, stream `AssetsService`.

## No-advance condition

Jangan lanjut bila unggah biner lewat proxy tidak identik byte-per-byte, atau kabkota dapat membaca berkas/talenta kota lain.

## Required failure probes

- Unit: BA dengan talenta bukan `dinilai` → 409 tanpa perubahan.
- Unit: `/berkas/:id` lintas kota → 404.
- Unit proxy: SHA-256 body biner sama.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-6-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 6
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; `down` migrasi `20260926E` menghapus tabel talenta/BA, folder, dan permission berkas (berkas di storage tetap; pembersihan berkas di luar cakupan rollback). Handoff: `talenta.status` dan `BERKAS_RULES` diperluas Phase 7; `useBerkasUpload` dipakai Phase 7 dan 10; `TalentaStatusBadge` dipakai Phase 8, 9, 11, 13.
