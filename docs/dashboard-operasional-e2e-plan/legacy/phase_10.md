# Phase 10 — Portofolio produk Digital Twin (UMKM) dan kurasi produk (provinsi)

## Objective, dependencies, observable result

- **Dependency:** Phase 6 (berkas, `useBerkasUpload`, `assertBerkasMilik`).
- **Objective:** Pelaku UMKM mengelola produk sendiri (nama, deskripsi pemasaran, kategori, KBLI, harga retail vs grosir/B2B, MOQ, maks. 5 foto, tautan video, deklarasi % bahan baku lokal untuk PDN, spesifikasi teknis) dengan status kurasi `Menunggu Verifikasi Kurasi → Tayang di Katalog → Rekomendasi Marketplace Mitra` (+ Ditolak) dan pengingat kepatuhan PMSE (Permen No. 3/2026); Admin Provinsi mengkurasi.
- **Observable result:** Wawan menambah produk dengan 2 foto (status "Menunggu Verifikasi Kurasi"); provinsi menayangkannya; foto ke-6 ditolak "Maksimal 5 foto per produk.".

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-10-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926G-create-produk.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/produk-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/berkas-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/produk-service.test.cjs` |
| modify | `services/directus/extensions/directus-extension-operasional/test/berkas-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `scripts/seed-dummy-operasional.mjs` |
| modify | `scripts/seed-dummy-operasional.sql` |
| create | `apps/web/app/lib/video-embed.ts` |
| create | `apps/web/app/components/operasional/ProdukForm.vue` |
| create | `apps/web/app/components/operasional/ProdukFotoManager.vue` |
| create | `apps/web/app/pages/(private)/dashboard/usaha/produk.vue` |
| create | `apps/web/app/pages/(private)/dashboard/kurasi-produk.vue` |
| modify | `apps/web/app/constants/OPERASIONAL.ts` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/ROLES.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| create | `apps/web/tests/unit/video-embed.test.ts` |
| modify | `apps/web/tests/unit/roles.test.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/produk.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/directus-extension-operasional/src/berkas-service.js::BERKAS_RULES`, `assertBerkasMilik`
- `apps/web/app/composables/useBerkasUpload.ts::uploadBerkas`, `berkasUrl`
- `apps/web/app/layouts/umkm.vue` nav UMKM

```bash
rg -n "BERKAS_RULES|function assertBerkasMilik" services/directus/extensions/directus-extension-operasional/src/berkas-service.js
rg -n "export async function uploadBerkas|export function berkasUrl|uploadBerkas|berkasUrl" apps/web/app/composables/useBerkasUpload.ts
```

## Current contract and final desired contract

### Current

Tidak ada entitas produk; halaman publik `/katalog` existing statis (di luar scope, tidak disentuh).

### Final

- Migrasi `20260926G` (transaksi):

  ```sql
  CREATE TABLE IF NOT EXISTS produk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usaha UUID NOT NULL REFERENCES usaha(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    deskripsi TEXT,
    kategori TEXT NOT NULL CHECK (kategori IN ('kuliner','fesyen','kerajinan','kecantikan_herbal','agribisnis')),
    kode_kbli TEXT CHECK (kode_kbli ~ '^[0-9]{5}$'),
    harga_retail BIGINT CHECK (harga_retail >= 0),
    harga_grosir BIGINT CHECK (harga_grosir >= 0),
    moq INTEGER CHECK (moq >= 1),
    video_url TEXT,
    bahan_baku_lokal_persen NUMERIC(5,2) CHECK (bahan_baku_lokal_persen BETWEEN 0 AND 100),
    dimensi TEXT, berat_bersih TEXT, masa_simpan TEXT, bahan_baku_utama TEXT, kapasitas_pasokan_bulanan TEXT, sertifikasi_uji_lab TEXT,
    status_kurasi TEXT NOT NULL DEFAULT 'menunggu' CHECK (status_kurasi IN ('menunggu','tayang','rekomendasi_marketplace','ditolak')),
    catatan_kurasi TEXT,
    dikurasi_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    dikurasi_pada TIMESTAMPTZ,
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_produk_usaha ON produk(usaha);
  CREATE INDEX IF NOT EXISTS idx_produk_status ON produk(status_kurasi);
  CREATE TABLE IF NOT EXISTS produk_foto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produk UUID NOT NULL REFERENCES produk(id) ON DELETE CASCADE,
    berkas UUID NOT NULL REFERENCES directus_files(id) ON DELETE CASCADE,
    urutan SMALLINT NOT NULL CHECK (urutan BETWEEN 1 AND 5),
    UNIQUE (produk, urutan),
    UNIQUE (produk, berkas)
  );
  ```

  + `directus_collections` `produk` (icon `inventory_2`, sort 26), `produk_foto` (icon `photo_library`, sort 27); `down` drop keduanya.
- `produk-service.js`:
  - Validasi bersama `validasiProduk(body, parsial)`: `nama` 1–200; `deskripsi` null/≤5000; `kategori` enum; `kodeKbli` null/`/^\d{5}$/`; `hargaRetail`, `hargaGrosir` null/integer 0–1.000.000.000.000; bila keduanya ada `hargaGrosir ≤ hargaRetail` (selain itu `fields.hargaGrosir` "Harga grosir tidak boleh melebihi harga retail."); `moq` null/integer 1–1.000.000; `videoUrl` null atau URL `https:` ≤500 char; `bahanBakuLokalPersen` null/angka 0–100 (2 desimal); field spesifikasi (`dimensi`, `beratBersih`, `masaSimpan`, `bahanBakuUtama`, `kapasitasPasokanBulanan`, `sertifikasiUjiLab`) null/≤500.
  - `listProdukSaya(database, operator)` (umkm) → produk usaha sendiri + `foto: [{ id, berkasId, urutan }]` urut `urutan`.
  - `buatProduk(database, body, operator)` (umkm) → insert `status_kurasi='menunggu'` → 201.
  - `ubahProduk(database, id, body, operator)` (umkm pemilik; lainnya 404) → update parsial + reset `status_kurasi='menunggu', catatan_kurasi=NULL, dikurasi_oleh=NULL, dikurasi_pada=NULL`.
  - `hapusProduk(database, id, operator)` (umkm pemilik) → 204.
  - `tambahFoto(database, id, body, operator)` (umkm pemilik) → `assertBerkasMilik(berkasId)` + tipe berkas harus `image/*` (selain itu 400); jumlah foto = 5 → 409 `PHOTO_LIMIT` "Maksimal 5 foto per produk."; `urutan` = angka terkecil 1–5 yang kosong; return daftar foto.
  - `hapusFoto(database, id, fotoId, operator)` (umkm pemilik) → hapus baris `produk_foto` (berkas tetap).
  - `listKurasi(database, query, operator)` (provinsi) → filter `status` (enum, default `menunggu`), `page`, `pageSize` 1–100; item `{ id, nama, kategori, usaha: { id, nama }, kota, bahanBakuLokalPersen, hargaRetail, statusKurasi, fotoUtama: berkasId | null, diperbaruiPada }` + `meta`.
  - `getProduk(database, id, operator)` (provinsi; umkm pemilik; kabkota bila usaha di kotanya) → detail lengkap + foto.
  - `kurasiProduk(database, id, body, operator)` (provinsi) → `status` `tayang|rekomendasi_marketplace|ditolak`; dari `menunggu` atau `tayang` saja (selain itu 409); `ditolak` wajib `catatan` 3–1000; set `dikurasi_oleh/pada`.
  - Routes: `GET /produk-saya`, `POST /produk`, `GET /produk/:id`, `PATCH /produk/:id`, `DELETE /produk/:id`, `POST /produk/:id/foto`, `DELETE /produk/:id/foto/:fotoId`, `GET /produk` (kurasi), `POST /produk/:id/kurasi`.
- `BERKAS_RULES` tambah `foto_produk`: berkas = `produk_foto.berkas` dan (provinsi) atau (kabkota: kota usaha produk = operator.kotaId) atau (umkm: `produk.usaha = operator.usahaId`) atau (pendamping: usaha produk memiliki talenta dengan `pendamping = operator.userId`).
- Web:
  - `lib/video-embed.ts`: `videoEmbed(url)` → `{ jenis: "youtube", src: "https://www.youtube-nocookie.com/embed/<id>" }` untuk `youtube.com/watch?v=<id>`, `youtu.be/<id>`, `youtube.com/shorts/<id>` (id `[A-Za-z0-9_-]{11}`); `{ jenis: "file", src: url }` untuk path berakhiran `.mp4`/`.webm`; selain itu `{ jenis: "tautan", src: url }`; input tidak valid/null → null.
  - `OPERASIONAL.ts` tambah `PRODUK_KATEGORI` (kuliner "Kuliner & Makanan Olahan", fesyen "Fesyen & Tekstil", kerajinan "Kerajinan (Craft)", kecantikan_herbal "Kecantikan & Herbal", agribisnis "Agribisnis") dan `KURASI_STATUS` (menunggu "Menunggu Verifikasi Kurasi" amber, tayang "Tayang di Katalog" emerald, rekomendasi_marketplace "Rekomendasi Marketplace Mitra" indigo, ditolak "Ditolak Kurasi" rose).
  - `ProdukForm.vue`: seluruh field §Final, label Indonesia, "Deklarasi Mandiri Asal Bahan Baku (% bahan baku lokal)", pratinjau `videoEmbed`; emit `submit` dengan body camelCase; tampilkan `fields` error server per input.
  - `ProdukFotoManager.vue`: grid 5 slot; unggah (`uploadBerkas`, hanya `image/*`) → `POST /produk/:id/foto`; hapus → `DELETE`; slot penuh → tombol unggah disabled + teks "Maksimal 5 foto per produk."; gambar via `berkasUrl`.
  - `usaha/produk.vue` (layout `umkm`): judul "Portofolio Produk (Digital Twin)"; banner kepatuhan PMSE: "Pengingat Permen UMKM No. 3 Tahun 2026: dilarang memanipulasi transaksi maupun ulasan, dan wajib menjaga standar mutu barang yang ditawarkan."; daftar kartu produk (foto utama, nama, kategori, harga retail/grosir `formatAnalyticsCurrency`, MOQ, badge `KURASI_STATUS`, catatan kurasi bila ditolak, bahan baku lokal %); tombol "Tambah Produk" → sheet `ProdukForm` → `POST /produk` → lalu `ProdukFotoManager`; aksi "Ubah" (sheet, simpan → `PATCH`, info "Perubahan akan dikurasi ulang."), "Hapus" (konfirmasi).
  - `kurasi-produk.vue` (layout `dashboard`, provinsi): judul "Kurasi Produk UMKM"; filter status chip; tabel; dialog detail (galeri foto, spesifikasi, harga, bahan lokal, video) dengan tombol "Tayangkan di Katalog", "Rekomendasikan ke Marketplace Mitra", "Tolak" (catatan wajib).
  - `ROLE_ROUTES.provinsi` tambah `/dashboard/kurasi-produk`; `NAVIGATION_LINKS` umkm tambah `{ id: "produk", label: "Produk", to: "/dashboard/usaha/produk", icon: Package }`, provinsi tambah `{ id: "kurasi-produk", label: "Kurasi Produk", to: "/dashboard/kurasi-produk", icon: PackageCheck }`.
- Seed:
  - `.mjs`: unggah `apps/web/public/images/produk-1.jpg` → `dummy_produk-1.jpg`, `apps/web/public/images/pameran-umkm.jpg` → `dummy_produk-2.jpg`, `apps/web/public/images/kegiatan-umkm.jpg` → `dummy_produk-3.jpg` (folder operasional, skip bila ada).
  - `.sql` (produk dengan UUID tetap `d2000000-0000-4000-8000-0000000000NN`):

    | NN | usaha | nama | kategori | kbli | retail | grosir | moq | lokal % | status | foto |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | 01 | 01 | Tas Selempang Kulit "Wawan Classic" | fesyen | 15121 | 450000 | 360000 | 10 | 100 | rekomendasi_marketplace | 1, 2, 3 |
    | 02 | 01 | Dompet Kulit Lipat | fesyen | 15121 | 175000 | 140000 | 20 | 100 | tayang | 2 |
    | 03 | 01 | Ikat Pinggang Kulit Sapi | fesyen | 15121 | 225000 | 180000 | 15 | 85 | menunggu | 3 |
    | 04 | 02 | Tahu Sumedang Kemasan Vakum | kuliner | 10792 | 25000 | 20000 | 50 | 100 | tayang | 1 |
    | 05 | 08 | Sambal Cumi Subang 150g | kuliner | 10779 | 38000 | 30000 | 24 | 95 | menunggu | 1 |

    Spesifikasi produk 01: dimensi "28 × 20 × 8 cm", berat "650 g", bahan baku utama "Kulit sapi nabati Garut", kapasitas "300 unit/bulan", sertifikasi uji "—"; `dikurasi_oleh` = dummy_admin untuk status tayang/rekomendasi. Foto memakai berkas `dummy_produk-<n>.jpg` sesuai kolom foto (urutan sesuai urutan daftar). Cleanup tidak berubah (cascade usaha; berkas dihapus `.mjs cleanup`).

## Ordered edits

1. Migrasi + kontrak test.
2. `produk-service.js` + routes + `BERKAS_RULES` + test (umkm lain ubah/hapus → 404; foto ke-6 → 409; foto berkas PDF → 400; berkas milik user lain → 400; grosir > retail → 400; `videoUrl` `http://` → 400; edit mereset status; kurasi dari `rekomendasi_marketplace` → 409; tolak tanpa catatan → 400; kabkota `GET /produk/:id` usaha kota lain → 404; provinsi `POST /produk` → 403).
3. Web: `video-embed.ts` + `video-embed.test.ts` (watch, youtu.be, shorts, mp4, tautan lain, `javascript:` → null, id bukan 11 char → tautan); komponen; halaman; konstanta; tipe; ROLES; NAVIGATION; `roles.test.ts`.
4. Mock fixture: `produk-saya` (2 produk), `POST /produk` (201 id `55555555-5555-4555-8555-000000000001`), `PATCH`, `DELETE`, `POST /produk/:id/foto` (menambah; setelah 5 → 409 `{ errors:[{ message:"Maksimal 5 foto per produk.", extensions:{ code:"PHOTO_LIMIT" } }] }`), `GET /produk` (kurasi), `POST /produk/:id/kurasi`.
5. `produk.spec.ts`: umkm (chromium + mobile) tambah produk + 2 foto → kartu "Menunggu Verifikasi Kurasi", banner PMSE tampil, screenshot `produk-umkm.png`; unggah hingga 5 → tombol unggah disabled + teks batas; provinsi kurasi → "Tayangkan di Katalog" → request `{ status: "tayang" }`, screenshot `kurasi-produk.png`.
6. Seed `.mjs`/`.sql`.
7. `operasional.directus.spec.ts`: Wawan menambah produk "Gantungan Kunci Kulit" + 1 foto nyata → status menunggu; provinsi menayangkan → Wawan melihat "Tayang di Katalog"; Wawan `GET /panel/operasional/produk/d2000000-0000-4000-8000-000000000004` (milik usaha 02) → 404.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Hapus produk dengan foto → baris foto terhapus (cascade), berkas tetap di storage (dicatat; pembersihan berkas yatim di luar scope).
- Urutan foto setelah hapus foto tengah → slot kosong diisi unggahan berikutnya.
- Harga null (belum ditentukan) diperbolehkan; kartu menampilkan "Harga belum ditentukan".
- Deklarasi bahan lokal 100 → memenuhi syarat badge PDN di Phase 11 hanya bila produk berstatus `tayang`/`rekomendasi_marketplace`.
- Produk usaha yang talentanya dihapus tetap milik usaha.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
node --check scripts/seed-dummy-operasional.mjs
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 app/lib/video-embed.ts app/components/operasional/ProdukForm.vue app/components/operasional/ProdukFotoManager.vue "app/pages/(private)/dashboard/usaha/produk.vue" "app/pages/(private)/dashboard/kurasi-produk.vue" app/constants/OPERASIONAL.ts app/types/operasional.ts app/constants/ROLES.ts app/constants/NAVIGATION.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/produk.spec.ts --project=mobile)
```

Expected: semua exit 0; screenshot `produk-umkm.png`, `kurasi-produk.png`.

## Runtime/browser proof and unproven boundary

Disposable stack + seed; jalankan `operasional.directus.spec.ts`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: unggah gambar resolusi tinggi ke MinIO, embed YouTube di jaringan kantor.

## No-advance condition

Jangan lanjut bila UMKM dapat mengubah produk usaha lain atau batas 5 foto dapat dilewati.

## Required failure probes

- Unit: foto ke-6 → 409.
- Unit: umkm lain `PATCH /produk/:id` → 404.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-10-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 10
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit; `down` migrasi `20260926G` menghapus produk/foto. Handoff: produk `tayang|rekomendasi_marketplace` dan `bahan_baku_lokal_persen` dipakai radar/badge/showroom Phase 11; `videoEmbed` dipakai showroom.
