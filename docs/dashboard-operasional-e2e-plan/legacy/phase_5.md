# Phase 5 — Executive Summary: 5 aspek Permen UMKM No. 2/2026 dan kuota pendataan

## Objective, dependencies, observable result

- **Dependency:** Phase 4 (`usaha_atribut_jabar`).
- **Objective:** kartu tabulasi tingkat perkembangan usaha 5 aspek Permen No. 2/2026 dan kartu "Capaian Pendataan vs Target Kuota" di `/dashboard` (provinsi: semua kab/kota + edit target; kabkota: wilayahnya, read-only); label menu provinsi menjadi "Executive Summary".
- **Observable result:** provinsi melihat 5 baris aspek (terpenuhi/sebagian/belum + cakupan didata) dan tabel kuota 27 kab/kota yang target-nya dapat diubah; kabkota melihat angka hanya untuk wilayahnya.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-5-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926D-create-kuota-pendataan.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/permen-aspek.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/ringkasan-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/permen-aspek.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/ringkasan-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `scripts/seed-dummy-operasional.sql` |
| modify | `scripts/cleanup-dummy-operasional.sql` |
| create | `apps/web/app/components/dashboard/card/PermenAspek.vue` |
| create | `apps/web/app/components/dashboard/card/KuotaPendataan.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/index.vue` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/executive-summary.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `infografis_snapshot.payload -> 'scales' ->> 'total'` dan `payload -> 'regions'` (entri `{ id, name, value }`, `id` = `kota_id::text`) — lihat `services/directus/extensions/directus-extension-infografis/src/index.js::readMapPayload` dan `services/directus/extensions/directus-extension-tabular/src/index.js` fast path `payload -> 'scales'`.
- `apps/web/app/pages/(private)/dashboard/index.vue` blok `<DashboardCardOverview` (sisipkan kartu baru tepat setelahnya).
- `apps/web/app/constants/NAVIGATION.ts` item `id: "infografis"` provinsi (`label: "Infografis UMKM"`).

```bash
rg -n "payload -> 'scales'|payload->'regions'" services/directus/extensions/directus-extension-tabular/src/index.js services/directus/extensions/directus-extension-infografis/src/index.js
rg -n "<DashboardCardOverview" "apps/web/app/pages/(private)/dashboard/index.vue"
rg -n 'label: "Infografis UMKM"' apps/web/app/constants/NAVIGATION.ts
```

## Current contract and final desired contract

### Current

Infografis menampilkan skala, NIB, pemasaran, gender, sektor; tidak ada aspek Permen maupun kuota.

### Final

- Migrasi `20260926D`:

  ```sql
  CREATE TABLE IF NOT EXISTS kuota_pendataan (
    id SERIAL PRIMARY KEY,
    kode TEXT UNIQUE,
    kota INTEGER NOT NULL REFERENCES kota(id) ON DELETE CASCADE,
    tahun SMALLINT NOT NULL CHECK (tahun BETWEEN 2020 AND 2100),
    target INTEGER NOT NULL CHECK (target >= 0),
    diperbarui_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kota, tahun)
  );
  ```

  + `directus_collections` `('kuota_pendataan','flag','Target kuota pendataan per kab/kota', sort 21)`; `down` drop.
- `permen-aspek.js` (murni): `PERMEN_ASPEK` = `[{ key: "legalitas", label: "Aspek Legalitas dan Formalitas", kolom: ["nib_ada","npwp_usaha","izin_edar"] }, { key: "manajemen", label: "Aspek Manajemen dan Tata Kelola Usaha", kolom: ["rekening_terpisah","sop_tertulis"] }, { key: "pemasaran", label: "Aspek Pemasaran dan Digitalisasi", kolom: ["ecommerce","medsos_bisnis","qris"] }, { key: "keuangan", label: "Aspek Keuangan dan Akses Pembiayaan", kolom: ["pembukuan_digital","akses_kur"] }, { key: "kemitraan", label: "Aspek Kemitraan dan Jejaring Usaha", kolom: ["rantai_pasok_industri","kontrak_offtaker"] }]`; `skorPermen(row)` → rata-rata 5 aspek dari `(jumlah true / jumlah kolom) × 100`, 2 desimal (null = false); `permenAggregateSelect()` → string SELECT dengan, per aspek, `count(*) FILTER (WHERE <semua kolom true>) AS <key>_terpenuhi` dan `count(*) FILTER (WHERE <semua kolom tidak true>) AS <key>_belum` (kolom hanya dari konstanta; `COALESCE(col,false)`).
- `ringkasan-service.js::getRingkasanEksekutif(database, query, operator)` (roles `DATA_ROLES`):
  - `tahun` dari query (integer 2020–2100) atau tahun berjalan `Asia/Jakarta`.
  - Populasi: provinsi → `(payload->'scales'->>'total')::int` dari `infografis_snapshot` id 1 (null → `SELECT count(*) FROM usaha_tabular`); kabkota → nilai `value` entri `payload->'regions'` dengan `id = kotaId::text` (tidak ada → 0).
  - Atribut: `WITH atr AS (SELECT a.*, (NULLIF(btrim(u.nib),'') IS NOT NULL) AS nib_ada FROM usaha_atribut_jabar a JOIN usaha_tabular t ON t.id = a.usaha JOIN usaha u ON u.id = a.usaha WHERE (?::int IS NULL OR t.kota_id = ?)) SELECT count(*) AS didata, <permenAggregateSelect()> FROM atr` (binding kotaId atau null untuk provinsi).
  - Kuota: kota Jawa Barat (`kota k JOIN provinsi p ON p.id = k.provinsi WHERE lower(p.nama) = 'jawa barat'`, kabkota tambah `AND k.id = ?`) LEFT JOIN `kuota_pendataan q ON q.kota = k.id AND q.tahun = ?`; capaian = `value` dari `payload->'regions'` snapshot (0 bila tidak ada); urut `k.nama`.
  - Response:
    ```json
    { "data": {
      "permen": { "populasi": 0, "didata": 0, "aspek": [{ "key": "legalitas", "label": "…", "terpenuhi": 0, "sebagian": 0, "belum": 0 }] },
      "kuota": { "tahun": 2026, "items": [{ "kotaId": 1, "kotaNama": "…", "target": 0, "capaian": 0, "persen": 0.0 }], "total": { "target": 0, "capaian": 0, "persen": 0.0 } },
      "dataAsOf": "ISO | null" } }
    ```
    `sebagian = didata − terpenuhi − belum`; `persen = round(capaian / target × 100, 1)` bila target > 0, selain itu null; `dataAsOf` dari `infografis_snapshot.refreshed_at` (ISO `Z`; tidak ada baris snapshot → `null`).
- `putKuota(database, kotaId, body, operator)` (roles `["provinsi"]`): `body.tahun` 2020–2100, `body.target` integer 0–100.000.000; kota harus di Jawa Barat (selain itu 404); `INSERT … ON CONFLICT (kota, tahun) DO UPDATE SET target, diperbarui_oleh, date_updated = NOW()`; return item kuota.
- Routes: `GET /ringkasan-eksekutif`, `PUT /kuota/:kotaId`.
- Web: `index.vue` memanggil `useFetch("/panel/operasional/ringkasan-eksekutif", { query: { tahun } })` (`tahun` = tahun `Asia/Jakarta` via `Intl.DateTimeFormat("en-CA",{ timeZone:"Asia/Jakarta", year:"numeric" })`) dan merender, tepat setelah `DashboardCardOverview`, `<DashboardCardPermenAspek :data="ringkasan?.permen" />` lalu `<DashboardCardKuotaPendataan :data="ringkasan?.kuota" :editable="auth.user.value?.role === 'provinsi'" @saved="refreshRingkasan" />`; error fetch → pesan "Ringkasan eksekutif belum dapat dimuat. Silakan coba lagi.".
  - `PermenAspek.vue`: judul "Tingkat Perkembangan Usaha (Permen UMKM No. 2 Tahun 2026)"; subjudul "Data 15 Atribut Jabar tersedia untuk {didata} dari {populasi} usaha ({persen}%)"; 5 baris: label + bar bertumpuk horizontal (terpenuhi `bg-emerald-500`, sebagian `bg-amber-400`, belum `bg-slate-300`, lebar proporsional terhadap `didata`) + angka tiap segmen (`formatAnalyticsNumber`); legenda; `didata = 0` → "Belum ada data atribut Jabar pada cakupan ini.".
  - `KuotaPendataan.vue`: judul "Capaian Pendataan vs Target Kuota {tahun}"; tabel Kab/Kota | Target | Terdata | Capaian (progress bar + persen, `formatAnalyticsPercent`; target null → "Target belum ditetapkan"); baris total; bila `editable`, sel Target berupa input number + tombol "Simpan" per baris → `$fetch("/panel/operasional/kuota/<kotaId>", { method: "PUT", body: { tahun, target } })` → emit `saved`; gagal → teks baris "Gagal menyimpan target.".
  - `NAVIGATION_LINKS.provinsi` item `infografis` label → "Executive Summary".

## Ordered edits

1. Migrasi + kontrak test (tabel, `UNIQUE (kota, tahun)`).
2. `permen-aspek.js` + test (semua true → 100; semua false → 0; baris dummy 01 → 100; baris dummy 07 → 6,67 [hanya medsos: (0+0+33,33+0+0)/5]; `permenAggregateSelect()` hanya memuat nama kolom dari konstanta).
3. `ringkasan-service.js` + routes + test (stub DB: provinsi memakai snapshot total; kabkota binding kotaId pada query atribut dan kuota; `sebagian` dihitung benar; target 0 → `persen: null`; kabkota PUT → 403; target negatif → 400; kota di luar Jabar → 404).
4. Seed: untuk setiap kota Jawa Barat `INSERT INTO kuota_pendataan (kode, kota, tahun, target, diperbarui_oleh) VALUES ('dummy_KUOTA-'||k.id||'-2026', k.id, 2026, 200000, <id dummy_admin>) ON CONFLICT (kota, tahun) DO NOTHING`. Cleanup: tambahkan di bagian atas `DELETE FROM kuota_pendataan WHERE kode LIKE 'dummy\_%';`.
5. Web: tipe `RingkasanEksekutif` di `types/operasional.ts`, dua komponen, `index.vue`, `NAVIGATION.ts`.
6. Mock fixture: route `GET /panel/operasional/ringkasan-eksekutif` (provinsi: populasi 12, didata 7, aspek campuran, kuota 2 kota; kabkota: 1 kota "Kabupaten Bogor") dan `PUT /panel/operasional/kuota/:kotaId` (echo).
7. `executive-summary.spec.ts`: provinsi — heading "Tingkat Perkembangan Usaha (Permen UMKM No. 2 Tahun 2026)" dan 5 label aspek tampil; ubah target baris pertama → request PUT body `{ tahun: <tahun>, target: <nilai> }`; screenshot `infografis-provinsi.png`; kabkota — tabel kuota 1 baris tanpa input, screenshot `infografis-kabkota.png` (menimpa bukti Phase 3 dengan versi berkartu baru).
8. `operasional.directus.spec.ts`: provinsi mengubah target Kabupaten Subang 2026 → reload → nilai tersimpan; kabkota tidak melihat input target.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Snapshot belum pernah di-refresh → populasi fallback `count(*)`, capaian 0 untuk semua kota (UI tetap tampil).
- Usaha dengan baris atribut semua null → dihitung "belum" pada setiap aspek (didata).
- Nilai `nib` spasi saja dihitung tidak ada NIB.
- Tahun query `abc`/`1999` → pakai tahun berjalan (abc) / 400 (di luar rentang) — keputusan: nilai non-integer → tahun berjalan; integer di luar 2020–2100 → 400 `VALIDATION_FAILED`.
- Kabkota tanpa kota → 403 `KOTA_NOT_ASSIGNED`.
- Tablet (America/Los_Angeles) pada 31 Desember 20:00 PST (= 1 Januari WIB) memakai tahun WIB.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/components/dashboard/card/PermenAspek.vue app/components/dashboard/card/KuotaPendataan.vue "app/pages/(private)/dashboard/index.vue" app/types/operasional.ts app/constants/NAVIGATION.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/executive-summary.spec.ts --project=tablet --project=mobile)
```

Expected: semua exit 0; screenshot `infografis-provinsi.png`, `infografis-kabkota.png` tersedia.

## Runtime/API proof and unproven boundary

Disposable stack + seed, tunggu rebuild selesai, jalankan `operasional.directus.spec.ts`, lalu:

```bash
curl -s -b /tmp/kab.cookies "http://127.0.0.1:8055/operasional/ringkasan-eksekutif?tahun=2026" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["permen"]["didata"], len(d["kuota"]["items"]))'
```

Expected (kabkota Subang): `3 1` (usaha 01, 05, 08 punya atribut; 06 belum didata). Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: biaya query join atribut pada data produksi.

## No-advance condition

Jangan lanjut bila angka kabkota memuat usaha di luar kotanya atau kabkota dapat mengubah kuota.

## Required failure probes

- Unit: kabkota `PUT /kuota/:kotaId` → 403.
- Unit: `persen` null saat target 0.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-5-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 5
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; `down` migrasi `20260926D` menghapus `kuota_pendataan`. Handoff: `PERMEN_ASPEK`/`skorPermen` dipakai badge "Siap Naik Kelas" Phase 11; `index.vue` menerima kartu pipeline Phase 9.
