# Phase 4 — 15 Atribut Jabar, data lapangan, dan verifikasi legalitas

## Objective, dependencies, observable result

- **Dependency:** Phase 3 (scoping + `DATA_ROLES`).
- **Objective:** tabel `usaha_atribut_jabar` (15 atribut nullable), endpoint baca/ubah data lapangan (kolom SIDT terpilih + atribut) dan verifikasi, refresh `usaha_tabular` per-record oleh worker agar edit langsung terlihat di Tabular/Spasial, halaman "Ubah Data Lapangan", aksi Tabular/profil in-app.
- **Observable result:** Admin Kab/Kota Subang membuka `/dashboard/data-lapangan/<usaha Subang>`, mengubah nama/omzet/atribut, menyimpan, menandai terverifikasi; setelah worker memproses job, Tabular menampilkan nama baru; usaha di luar Subang → 404.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-4-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926C-create-usaha-atribut-jabar.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/usaha-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/usaha-service.test.cjs` |
| modify | `services/directus/extensions/directus-extension-analitik/src/profile-service.js` |
| modify | `services/directus/extensions/directus-extension-analitik/test/index.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| create | `services/analytics-worker/src/legacy-tabular.js` |
| modify | `services/analytics-worker/src/rebuild.js` |
| modify | `services/analytics-worker/src/projector.js` |
| create | `services/analytics-worker/test/legacy-tabular.test.js` |
| modify | `scripts/seed-dummy-operasional.sql` |
| create | `apps/web/app/constants/OPERASIONAL.ts` |
| modify | `apps/web/app/constants/index.ts` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/ROLES.ts` |
| create | `apps/web/app/pages/(private)/dashboard/data-lapangan/[id].vue` |
| modify | `apps/web/app/components/dashboard/TabularData.vue` |
| modify | `apps/web/app/components/umkm/UmkmProfileActions.vue` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| modify | `apps/web/tests/unit/roles.test.ts` |
| create | `apps/web/tests/e2e/data-lapangan.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/analytics-worker/src/rebuild.js::refreshLegacySnapshots` (blok `INSERT INTO usaha_tabular (` … `WHERE u.status = 'active' AND (p.id IS NULL OR LOWER(p.nama) = 'jawa barat')`)
- `services/analytics-worker/src/projector.js::projectRecord` (cabang `if (!row)` delete dan upsert `analitik_usaha_current`)
- `services/directus/extensions/directus-extension-analitik/src/profile-service.js::getProfile` (`editPath`)
- `apps/web/app/components/dashboard/TabularData.vue` menu item "Lihat Profil UMKM"
- `apps/web/app/components/umkm/UmkmProfileActions.vue` anchor "Edit di Directus"
- `apps/web/tests/fixtures/mock-directus.mjs` blok `canEdit: true` / `editPath`

```bash
rg -n "TRUNCATE usaha_tabular|INSERT INTO usaha_tabular \(|WHERE u.status = 'active' AND \(p.id IS NULL" services/analytics-worker/src/rebuild.js
rg -n "export async function projectRecord|DELETE FROM analitik_usaha_current" services/analytics-worker/src/projector.js
rg -n "editPath" services/directus/extensions/directus-extension-analitik/src/profile-service.js apps/web/tests/fixtures/mock-directus.mjs
rg -n "Lihat Profil UMKM" apps/web/app/components/dashboard/TabularData.vue
rg -n "Edit di Directus" apps/web/app/components/umkm/UmkmProfileActions.vue
```

## Current contract and final desired contract

### Current

Tidak ada atribut regional; edit hanya lewat Directus Studio (`/admin/content/usaha/:id`) untuk provinsi; `usaha_tabular` hanya diperbarui saat rebuild penuh.

### Final

- Migrasi `20260926C` (transaksi): tabel

  ```sql
  CREATE TABLE IF NOT EXISTS usaha_atribut_jabar (
    usaha UUID PRIMARY KEY REFERENCES usaha(id) ON DELETE CASCADE,
    npwp_usaha BOOLEAN, izin_edar BOOLEAN, sertifikat_halal BOOLEAN, pirt_bpom BOOLEAN, hki_merek BOOLEAN, sni BOOLEAN,
    rekening_terpisah BOOLEAN, sop_tertulis BOOLEAN, ecommerce BOOLEAN, medsos_bisnis BOOLEAN, qris BOOLEAN,
    pembukuan_digital BOOLEAN, akses_kur BOOLEAN, rantai_pasok_industri BOOLEAN, kontrak_offtaker BOOLEAN,
    diperbarui_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    terverifikasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    terverifikasi_pada TIMESTAMPTZ,
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

  + `directus_collections` `('usaha_atribut_jabar','verified','15 atribut regional Jawa Barat', hidden FALSE, sort 20)` `ON CONFLICT DO NOTHING`; `down` drop tabel + hapus collection.
- `usaha-service.js` mengekspor konstanta `ATRIBUT_COLUMNS` (15 nama kolom snake_case, urutan §1 main plan) dan fungsi:
  - `assertUsahaAccess(database, usahaId, operator)` → validasi UUID (bukan UUID → 404), query usaha + wilayah (`usaha u LEFT JOIN alamat a … LEFT JOIN kota ko`); tidak ada atau (kabkota dan `ko.id !== operator.kotaId`) → `OperasionalError(404, "NOT_FOUND")`; return `{ id, nama, nib, kotaId, kotaNama, kecamatanNama, kelurahanNama, omzetTahunan, totalAset, skala, pemilikNama }`. Dipakai ulang Phase 6/11/13.
  - `getUsahaLapangan(database, usahaId, operator)` → `{ data: { id, sidt: { nama, nib, kegiatanUtama, produkUtama, kodeKbli, skala, omzetTahunan, totalAset, latitude, longitude, status }, wilayah: { kota, kecamatan, kelurahan }, pemilik: { nama }, atribut: { npwpUsaha, izinEdar, sertifikatHalal, pirtBpom, hkiMerek, sni, rekeningTerpisah, sopTertulis, ecommerce, medsosBisnis, qris, pembukuanDigital, aksesKur, rantaiPasokIndustri, kontrakOfftaker } (boolean|null), verifikasi: { terverifikasiOleh: { id, nama } | null, terverifikasiPada: ISO | null }, diperbaruiPada: ISO | null } }`.
  - `updateUsahaLapangan(database, usahaId, body, operator)` → validasi (semua error dikumpulkan ke `fields`, 400 `VALIDATION_FAILED`): `sidt.nama` string 1–255 (trim); `sidt.nib` null atau `/^\d{13}$/`; `sidt.kegiatanUtama`/`produkUtama` null atau string ≤2000; `sidt.kodeKbli` `/^\d{5}$/` dan ada di `klasifikasi_usaha.kode` → set `usaha.klasifikasi`; `sidt.skala` `micro|small|medium`; `sidt.omzetTahunan`/`totalAset` null atau integer 0…9.000.000.000.000.000; `sidt.latitude`/`longitude` keduanya null atau keduanya angka dalam kotak Jawa Barat (lat −8,0…−5,8; lng 106,3…108,9); `atribut.<key>` boolean atau null untuk 15 key camelCase. Satu transaksi: `UPDATE usaha SET <kolom berubah>, date_updated = NOW() WHERE id = ?` (hanya bila ada field `sidt`); upsert `usaha_atribut_jabar` (hanya bila ada `atribut`) dengan `diperbarui_oleh = operator.userId`, `date_updated = NOW()`, dan `terverifikasi_oleh = NULL, terverifikasi_pada = NULL` bila nilai atribut berubah. Unique violation `23505` pada `nib` → 409 `NIB_CONFLICT`. Return bentuk `getUsahaLapangan`.
  - `verifikasiUsaha(database, usahaId, operator)` → tidak ada baris atribut → 409 `ATRIBUT_BELUM_DIISI`; set `terverifikasi_oleh = operator.userId, terverifikasi_pada = NOW()`; return bentuk `getUsahaLapangan`.
- Routes `operasional` (roles `DATA_ROLES`, `resolveOperator`): `GET /usaha/:id`, `PATCH /usaha/:id`, `POST /usaha/:id/verifikasi`.
- Worker:
  - `legacy-tabular.js` mengekspor `LEGACY_TABULAR_COLUMNS` (daftar kolom insert existing), `legacyTabularInsertSql(extraWhere)` (mengembalikan `INSERT INTO usaha_tabular (<kolom>) SELECT <ekspresi existing> FROM usaha u LEFT JOIN … WHERE u.status = 'active' AND (p.id IS NULL OR LOWER(p.nama) = 'jawa barat')` + `extraWhere`), dan `refreshLegacyTabularRow(client, usahaId)` (`DELETE FROM usaha_tabular WHERE id = $1` lalu `client.query(legacyTabularInsertSql(" AND u.id = $1"), [usahaId])`).
  - `rebuild.js::refreshLegacySnapshots` memakai `legacyTabularInsertSql("")` setelah `TRUNCATE usaha_tabular` (SQL hasil identik byte-demi-byte secara semantik dengan blok lama).
  - `projector.js::projectRecord` memanggil `await refreshLegacyTabularRow(client, job.entity_id)` pada kedua cabang (setelah delete baris hilang dan setelah upsert), setelah cek generasi aktif.
- `profile-service.js`: `canEdit = ["provinsi","kabkota"].includes(operator.role)`, `editPath = "/dashboard/data-lapangan/" + usaha_id`.
- Web:
  - `constants/OPERASIONAL.ts`: `ATRIBUT_JABAR` = array `{ key, label }` dengan key camelCase dan label: NPWP Usaha, Izin Edar, Sertifikat Halal, PIRT/BPOM, HKI/Merek, SNI, Rekening Usaha Terpisah, SOP Tertulis, Pemanfaatan E-commerce, Media Sosial Bisnis, QRIS, Pembukuan Digital, Akses KUR/Perbankan, Rantai Pasok Industri, Kontrak Offtaker.
  - `ROLE_ROUTES` provinsi & kabkota tambah `/dashboard/data-lapangan`.
  - Halaman `data-lapangan/[id].vue` (layout `dashboard`): judul "Ubah Data Lapangan — <nama>"; banner amber "Perubahan kolom SIDT dapat tertimpa oleh sinkronisasi SIDT berikutnya bila data sumber lebih baru."; bagian "Data SIDT" (input per field §Final, skala select Mikro/Kecil/Menengah, KBLI 5 digit); bagian "15 Atribut Jabar" (grid; setiap atribut select "Ya"/"Tidak"/"Belum didata" ↔ true/false/null); bagian "Verifikasi Legalitas" (status "Terverifikasi oleh <nama> pada <formatAnalyticsWib>" atau "Belum diverifikasi"; tombol "Tandai Terverifikasi" → POST verifikasi); tombol "Simpan Perubahan" → PATCH hanya field yang berubah; error field tampil di bawah input dari `errors[0].extensions.fields`; sukses `role="status"` "Data lapangan tersimpan."; 404 → "Data usaha tidak ditemukan atau di luar wilayah Anda.".
  - `TabularData.vue`: menu aksi baris tambah item "Ubah Data Lapangan" (`/dashboard/data-lapangan/${r.id}`, ikon `Pencil`).
  - `UmkmProfileActions.vue`: ganti `<a … >Edit di Directus</a>` dengan `<NuxtLink v-if="canEdit" :to="editPath">Ubah Data Lapangan</NuxtLink>` (class sama).
- Seed: atribut untuk usaha dummy (tabel ordered edit 9).

## Ordered edits

1. Migrasi `20260926C` + kontrak test (assert `CREATE TABLE IF NOT EXISTS usaha_atribut_jabar`, 15 kolom, `ON DELETE CASCADE`).
2. `usaha-service.js` + routes di `index.js`.
3. `usaha-service.test.cjs`: stub `database.raw`/`database.transaction` (pola `trx.raw`) — kasus: kabkota akses usaha kota lain → 404; UUID invalid → 404; PATCH `sidt.nib = "123"` → 400 `fields.nib`; `kodeKbli` tidak ada → 400 `fields.kodeKbli`; koordinat di luar Jabar → 400; hanya satu dari lat/lng → 400; atribut berubah → SQL memuat `terverifikasi_oleh = NULL`; verifikasi tanpa baris atribut → 409; `23505` → 409 `NIB_CONFLICT`; pendamping → 403.
4. Worker `legacy-tabular.js`, `rebuild.js`, `projector.js`; test `legacy-tabular.test.js`: (a) `legacyTabularInsertSql("")` memuat setiap nama di `LEGACY_TABULAR_COLUMNS` dan klausa JB; (b) `refreshLegacyTabularRow` pada fake client merekam `DELETE FROM usaha_tabular WHERE id = $1` lalu INSERT dengan `AND u.id = $1` dan parameter `[usahaId]`; (c) `projectRecord` dengan fake client (sourceRow null) memanggil delete `analitik_usaha_current` lalu `DELETE FROM usaha_tabular`; (d) teks `rebuild.js` tidak lagi memuat literal `INSERT INTO usaha_tabular (` (dipindah ke modul).
5. `profile-service.js` + update assert test analitik terkait `editPath`/`canEdit` bila ada (tambahkan assert kabkota `canEdit === true`, `canArchive === false`).
6. Web: `OPERASIONAL.ts` (ekspor dari `constants/index.ts`), tipe `UsahaLapangan` di `types/operasional.ts`, `ROLES.ts`, halaman, `TabularData.vue`, `UmkmProfileActions.vue`.
7. Mock fixture: `editPath` → `/dashboard/data-lapangan/11111111-1111-4111-8111-000000000001`; route `GET/PATCH /panel/operasional/usaha/:id` (fixture "Usaha 01", kota "Kabupaten Bogor", atribut campuran true/false/null; PATCH mengembalikan body yang digabung; `sidt.nib = "123"` → 400 `{ errors:[{ message:"Validasi gagal", extensions:{ code:"VALIDATION_FAILED", fields:{ nib:"NIB harus 13 digit" } } }] }`), `POST …/verifikasi` → verifikasi terisi.
8. `data-lapangan.spec.ts` (mock, kabkota): dari Tabular klik "Aksi untuk Usaha 01" → "Ubah Data Lapangan" → halaman; ubah atribut "QRIS" ke "Ya" dan simpan → request PATCH body berisi `atribut.qris === true` → teks "Data lapangan tersimpan."; isi NIB `123` → pesan "NIB harus 13 digit"; klik "Tandai Terverifikasi" → teks "Terverifikasi oleh"; screenshot `data-lapangan.png`. Profil `/dashboard/umkm/<id>` menampilkan tautan "Ubah Data Lapangan"; screenshot `umkm-profile-actions.png`.
9. Seed `seed-dummy-operasional.sql` (upsert `usaha_atribut_jabar`; urutan kolom sesuai migrasi; `T`=true, `F`=false):

   | NN | npwp | izin | halal | pirt | hki | sni | rek | sop | ecom | medsos | qris | buku | kur | rantai | offtaker | verifikasi |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | 01 | T | T | T | T | T | F | T | T | T | T | T | T | T | T | T | dummy_admin.subang, `2026-09-20T03:00:00Z` |
   | 02 | T | T | T | T | F | F | T | F | T | T | T | F | T | F | F | — |
   | 03 | T | T | T | T | T | F | T | T | T | T | T | T | F | T | T | dummy_admin (provinsi), `2026-09-20T03:00:00Z` |
   | 04 | F | F | F | F | T | F | F | F | T | T | T | F | F | F | F | — |
   | 05 | T | T | T | T | F | F | T | T | T | T | T | T | F | T | F | — |
   | 06 | (tidak ada baris — "belum didata") | | | | | | | | | | | | | | | |
   | 07 | F | F | F | F | F | F | F | F | F | T | F | F | F | F | F | — |
   | 08 | T | T | T | T | T | F | T | T | T | T | T | T | T | T | T | dummy_admin.subang, `2026-09-20T03:00:00Z` |

   `diperbarui_oleh` = akun verifikator (atau dummy_admin bila kosong). Cleanup tidak berubah (cascade dari `usaha`).
10. `operasional.directus.spec.ts`: kabkota membuka `/dashboard/data-lapangan/d0000000-0000-4000-8000-000000000005`, ubah "Pembukuan Digital" ke "Tidak", simpan → sukses; `page.request.get("/panel/operasional/usaha/d0000000-0000-4000-8000-000000000003")` (Garut) → 404.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Nilai atribut `null` ↔ "Belum didata" dipertahankan (tidak dikonversi ke false).
- PATCH hanya atribut → tidak menyentuh `usaha` (tidak memicu outbox); PATCH sidt → trigger `project_record_change` → worker memperbarui `analitik_usaha_current` + `usaha_tabular`.
- Usaha diarsipkan → `usaha_tabular` baris dihapus oleh refresh per-record (klausa `status = 'active'`).
- Omzet negatif, string angka dengan titik, `NaN` → 400.
- Dua admin menyimpan bersamaan → last-write-wins (diterima; tidak ada optimistic locking).
- Ingest SIDT berikutnya dengan sumber lebih baru menimpa edit SIDT (keputusan §1 butir 8); atribut Jabar tidak disentuh ingest.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus/extensions/directus-extension-analitik test
pnpm --dir services/directus test
pnpm --dir services/analytics-worker test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/constants/OPERASIONAL.ts app/constants/ROLES.ts app/types/operasional.ts "app/pages/(private)/dashboard/data-lapangan/[id].vue" app/components/dashboard/TabularData.vue app/components/umkm/UmkmProfileActions.vue)
(cd apps/web && pnpm exec playwright test --project=chromium)
```

Expected: semua exit 0; worker 21 baseline + ≥4 test baru pass; Playwright chromium pass.

## Runtime/worker proof and unproven boundary

Disposable stack + seed, lalu jalankan `operasional.directus.spec.ts` dan:

```bash
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "UPDATE usaha SET nama='Keripik Nanas Subang Jaya' WHERE id='d0000000-0000-4000-8000-000000000005'"
sleep 5
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT nama FROM usaha_tabular WHERE id='d0000000-0000-4000-8000-000000000005'"
```

Expected: `Keripik Nanas Subang Jaya` (worker memproses `project_record_change` dan menyegarkan baris). Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: latensi worker nyata dan interaksi dengan rebuild yang sedang berjalan.

## No-advance condition

Jangan lanjut bila refresh per-record tidak terbukti di unit test worker atau bila kabkota dapat membaca/mengubah usaha di luar kotanya.

## Required failure probes

- Unit: kabkota PATCH usaha kota lain → 404.
- Unit worker: `projectRecord` baris hilang → `DELETE FROM usaha_tabular`.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-4-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 4
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; migrasi `20260926C` `down` menghapus tabel atribut (data atribut hilang — jalankan hanya di disposable/konfirmasi pengguna). Handoff: `assertUsahaAccess`, `ATRIBUT_COLUMNS`, `ATRIBUT_JABAR` dipakai Phase 5, 6, 11, 13.
