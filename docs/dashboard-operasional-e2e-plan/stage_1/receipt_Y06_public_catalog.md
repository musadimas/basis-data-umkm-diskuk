# Receipt Y06 — Katalog publik, detail produk, dan LOI (M7-01…M7-05)

- **Tanggal:** 27 September 2026
- **Verdict:** `done` (runtime disposable terbukti) dengan dua catatan cakupan yang dinyatakan terbuka, bukan diklaim: atribut **jenama** belum ada di model data, dan filter **UMKM Ekspor** belum punya atribut tersimpan. Keduanya dicatat di bagian “Yang tidak dibuktikan”.
- **Scope:** Fase Y06 (M7-01, M7-02, M7-03, M7-04, M7-05). Pekerjaan Y04/Y05 (kurasi produk, media privat, PDF passport/katalog ekspor) dipakai sebagai dependency dan **tidak** diubah.

## Baseline yang Dipertahankan

- Kerja dijalur kanonik pasca-merge `790559b`: halaman `apps/web/app/pages/(public)/katalog/*` membaca `produk` lewat **Directus Public policy** (ADR-006), bukan BFF Nuxt; LOI memakai endpoint publik `/v1/program/katalog/loi`.
- Kode Y04/Y05 yang sedang berjalan tidak disentuh: `ProdukForm.vue`, `kurasi.vue`, `dashboard/usaha/passport.vue`, `passport/pdf.js`, `ExportDialog.vue`, `Choropleth.client.vue`, worker ekspor, dan migrasi `O`/`P`/`Q`.
- Tidak ada `git reset --hard`, `git clean`, `git stash`, atau `git add -A`. Perubahan tak terlacak dari fase lain dipertahankan.
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present; two green repairs in Y05.` (exit 0).
- Rekonsiliasi `scope_manifest.json` Y06: 19 entri pra-merge (halaman `katalog.vue` monolitik, BFF `apps/web/server/api/publik/*`, extension `directus-extension-operasional`, migrasi `20260926J-create-kemitraan-minat`) diganti 21 entri kanonik pasca-merge. Perubahan pengguna pada fase lain dipertahankan (Y01 71 entri, Y02/Y03 25 entri, Y04 30 entri).

## Implementasi & Acceptance per ID

### M7-01 — Halaman `/katalog`
- Lima *quick chips* brief (`KATALOG_CHIPS`): Kuliner & Makanan Olahan, Fesyen & Tekstil, Kerajinan, Kecantikan & Herbal, Agribisnis. Setiap chip menjadi satu klausa `kategori._in` di server.
- Pencarian server eksplisit: `_or[{nama._icontains}, {usaha_nama._icontains}, {kbli._contains}]`, kata kunci dipotong 80 karakter.
- URL adalah state: `katalogQueryFromFilters`/`katalogFiltersFromQuery` dengan allowlist nilai, sehingga tautan yang dibagikan membuka filter yang sama dan nilai asing (mis. `sort=drop-table`) dibuang.
- **Bukti:** unit `tests/unit/katalog.test.ts` (chips, filter, URL round-trip, penolakan nilai asing) lulus; e2e mock `katalog.spec.ts` “five chips, all 27 regions and a shareable URL” + “search reaches the server query for product, business and KBLI” lulus; runtime `katalog-publik.directus.spec.ts` mencari “Keripik Nanas Subang Premium” dan mendapat 1 kartu dari DB.

### M7-02 — Filter katalog
- Wilayah berasal dari tabel referensi `kota` lewat **grant publik baru (migrasi `20260926R`)**, bukan dari produk yang kebetulan tayang; `COUNT` per wilayah mengikuti filter lain, sehingga wilayah kosong tampil `(0)`.
- Dimensi lain: skala Mikro/Kecil/Menengah, tahap program (Champion, Talent Lab, Accelerator), sertifikasi Halal/PIRT/BPOM/HKI/SNI/UMKU, PDN, dan ramah disabilitas; semuanya digabung dengan `_and` dan diuji.
- **Bukti:** runtime — select wilayah memuat 28 opsi (`Semua Kab/Kota` + 27 kabupaten/kota), `Kabupaten Subang` mengembalikan hasil dan `Kota Bandung` muncul sebagai opsi; kombinasi wilayah + chip Kerajinan → `count = 0` dengan pesan “Tidak ada produk yang cocok dengan kombinasi filter ini.”; unit — kombinasi sepuluh dimensi menghasilkan sembilan klausa `_and` yang diharapkan.

### M7-03 — Kartu produk
- Kartu 1:1 dengan badge **yang diverifikasi saja**: `Champion`/`Talent Lab`/`Accelerator` dari `talent_status`, nama sertifikat dari `usaha_sertifikasi` (hanya status `terbit`), `PDN Terverifikasi` dibedakan dari `PDN Deklarasi`, `Rekomendasi Marketplace`, `Ramah Disabilitas`.
- Dua CTA eksplisit: **“Lihat Detail Produk”** dan **“Hubungi Produsen via WhatsApp”**. Tautan WA dibuat hanya bila produk sudah lolos kurasi (`tayang`/`rekomendasi_marketplace`) **dan** nomor penjualan terisi; kalau tidak, kartu menulis “Kontak penjualan belum tersedia” tanpa tautan.
- **Bukti:** e2e mock memverifikasi kedua CTA, badge, harga `Rp12.000 – Rp15.000`, MOQ, dan tidak adanya tautan WA untuk record tanpa nomor; runtime memverifikasi kartu produk tayang dengan badge dan CTA-nya pada viewport desktop dan 390×844.

### M7-04 — Detail produk
- Kelompok field lengkap: produsen (nama, wilayah, skala, **NIB**), produk (kategori, KBLI, rentang harga, MOQ, deskripsi), spesifikasi (dimensi, berat bersih, masa kedaluwarsa, bahan baku, TKDN, bahan baku lokal, uji laboratorium), kapasitas & pesanan (kapasitas bulanan, **stok**, **kapasitas pesanan besar**, lead time), legalitas bernomor (Halal/PIRT/BPOM/HKI/SNI/UMKU + PDN + tahap program + ramah disabilitas), dan unduhan **lembar spesifikasi PDF**.
- Field tanpa data dinyatakan **“Belum tersedia”** di halaman dan di PDF; `stok` dan `kapasitas pesanan besar` memang belum ada di model data sehingga selalu dinyatakan kosong.
- Sumber baru yang eksplisit: migrasi `20260926R` menyalin `usaha.nib` dan sertifikat `terbit` (`{jenis, nomor, berlakuHingga}`) ke record publik `produk` lewat trigger snapshot — `usaha`/`usaha_legalitas` tetap tidak dapat dibaca publik.
- **Bukti:** runtime — halaman detail menampilkan `NIB: 9900000000005`, `Terverifikasi · Nomor ID3210000123456`, “Masa kedaluwarsa: Belum tersedia”, “Stok: Belum tersedia”; PDF terunduh 17.269 byte, terparse (header `%PDF-1.4`, `xref` menunjuk offset 17024, 2 halaman, 38 baris teks) dan memuat `Lembar Spesifikasi Produk`, nama produk, NIB, nomor halal, serta tiga pernyataan “Belum tersedia”; PDF draft → 404.

### M7-05 — Kontak dan minat kemitraan
- Dua aksi: **“Ajukan Minat Kemitraan / Order B2B”** (menuju formulir LOI) dan **“Kontak Penjualan Resmi (WhatsApp)”**; nomor resmi DISKUK tetap tersedia lewat kartu hotline.
- LOI menyimpan minat/order B2B dan **persetujuan kontak** (`persetujuan_kontak`), menolak tanpa persetujuan (`PERSETUJUAN_WAJIB`), memakai **kunci idempotensi** (`clientUuid`, indeks unik parsial), **rate limit** 5 surat/10 menit per alamat (hash HMAC, IP mentah tidak disimpan) dan penekanan duplikat isi 24 jam.
- Pembacaan LOI dibatasi: kurator provinsi/admin membaca semua, pelaku usaha hanya surat untuk produknya, peran lain 403.
- **Bukti:** unit extension `katalog.test.js` (persetujuan wajib, kunci wajib, retry → “duplikat”, captcha replay ditolak, 429, scope baca) lulus; runtime — dua pengiriman identik di browser menghasilkan satu baris (`SELECT count(*) FROM produk_loi` naik 1), `Group by email HAVING count(*) > 1` mengembalikan nol baris, `persetujuan_kontak = t`, `idempotency_key` terisi, `length(ip_hash) = 64`.

## Bukti Eksekusi

| Perintah / pengujian | Ruang lingkup | Hasil |
| --- | --- | --- |
| `npx vitest run` (apps/web) | Unit web termasuk 18 test katalog baru | **57/57 lulus**, 7 file (exit 0) |
| `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` | Typecheck web | **exit 0** |
| `node --test services/directus/extensions/program/test/*.test.js` | Extension program (katalog, passport, kegiatan, klinik, KPI, talent) | **117/117 lulus** (exit 0) |
| `node --test services/directus/test/*.test.mjs` | Kontrak migrasi + grant publik ADR-006 | **21/21 lulus** (exit 0) |
| `npx playwright test tests/e2e/katalog.spec.ts --project=chromium` | Browser mock: chips, 27 wilayah, URL state, CTA, PDF, LOI ganda | **6/6 lulus** |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_USE_REAL_API=1 npx playwright test tests/e2e/katalog-publik.directus.spec.ts --project=chromium` | Browser runtime disposable (desktop + viewport 390×844) | **5/5 lulus** (3,7 s) |
| `curl /panel/items/produk` (anonim) | Produk tayang dari DB | hanya `Keripik Nanas Subang Premium` (`status_kurasi=tayang`), 1 baris |
| `curl /panel/items/kota` (anonim) | Wilayah referensi | **27** kabupaten/kota (Subang, Sumedang, Garut, Cimahi, Karawang, Bogor, …) |
| `curl /panel/items/produk/<draft>` (anonim) | Privasi draft | **403**; `filter[status_kurasi][_eq]=menunggu` → `[]` |
| Pemindaian PII pada payload list/detail + PDF | ADR-004 | tidak ada `dummy_0000000005`, `Siti Aminah`, `240000000`, `pelaku_usaha`, `nik`, `omzet_tahunan`; hanya NIB/sertifikat yang memang publik |
| `psql … produk_loi` | Readback LOI | total 2 baris untuk 4 klik (2 run × 2 kiriman); tidak ada email dengan >1 baris; `ip_hash` 64 hex, bukan IP |

**Migrasi yang diterapkan pada stack disposable:** `20260926R-katalog-detail-publik` (dan `O`/`P`/`Q`/`S`/`20260927A` milik fase lain yang memang tertunda di image).

## Bukti yang Diminta Gate

- **API list/detail/LOI pada DB disposable** — ya: daftar anonim, detail anonim, PDF anonim, LOI tersimpan (readback SQL di atas).
- **Scan response untuk PII** — ya: bagian M7-04/M7-05 dan tabel bukti.
- **Browser mobile/desktop seluruh CTA** — ya, Chromium desktop + viewport ponsel 390×844 (bukan mesin WebKit; proyek `mobile` Playwright butuh `npx playwright install webkit` yang belum terpasang di mesin ini).
- **SQL readback LOI** — ya.
- **Hasil pencarian/filter** — ya: pencarian server, chip+wilayah, kombinasi kosong.
- **Parser PDF** — ya: parser Python memeriksa header, `startxref`, `/Count`, dan teks dari operator `Tj`.
- **Sales satu produk tayang dan satu draft** — ya: katalog menampilkan `Keripik Nanas Subang Premium`, `Keripik Nanas Subang Uji Coba` tidak muncul (dan 403 saat diminta langsung).

## Yang Tidak Dibuktikan (jangan dinaikkan menjadi klaim)

1. **Jenama (brand).** Brief menyebut pencarian atas “nama jenama”, tetapi tidak ada field jenama di `produk`/`usaha` dan form M7-06 pun tidak memintanya. Pencarian saat ini mencakup `nama`, `usaha_nama`, dan `kbli`. Menambah field jenama adalah perubahan model (Y04/M7-06), bukan Y06.
2. **Filter “UMKM Ekspor”.** Tidak ada atribut tersimpan untuk status ekspor; filter tahap program hanya menawarkan Champion, Talent Lab, dan Accelerator. “Rekomendasi Marketplace” tetap badge kurasi, bukan status ekspor.
3. **Stok dan kapasitas pesanan besar.** Belum ada di model `produk`, jadi selalu “Belum tersedia” (bukan angka palsu).
4. **PDF “Katalog Ekspor Resmi” Y05 yang butuh login.** Halaman publik memakai lembar spesifikasi PDF publik per produk (route baru Y06). PDF per-usaha `/v1/program/passport/pdf/katalog` tetap terautentikasi dan tidak dipakai di halaman publik.
5. **URL verifikasi di PDF pada stack disposable** memakai `PUBLIC_URL` milik container Directus (`http://127.0.0.1:8055`) karena `PUBLIC_WEB_URL` tidak diset di stack lokal; di produksi nilai itu adalah URL web publik.
6. **Mesin browser seluler nyata.** Bukti mobile memakai viewport Chromium, bukan WebKit/Android.

## Catatan Operasional (untuk fase berikutnya)

- **Mode berkas 600 mematikan container.** Berkas migrasi/extension yang dibuat lewat tooling editor masuk sebagai `-rw-------`, dan `COPY` di `Dockerfile.directus` mempertahankan mode itu; container berjalan sebagai `node` lalu gagal `EACCES` saat memuat migrasi (`20260926R`, `20260926S`, `20260927A`). Sudah diperbaiki dengan `chmod 644` dan rebuild image. Setiap migrasi/extension baru dari tooling perlu `chmod 644` sebelum build.
- **Impor relatif `kegiatan-data.mjs`** memakai `../../../services/...` (menunjuk `apps/services`) sehingga seluruh suite e2e gagal koleksi; diperbaiki menjadi `../../../../services/...`.
- **`types/directus.ts`** masih mengimpor `Kegiatan` yang sudah dinamai ulang menjadi `KegiatanAgenda` oleh sesi paralel; diperbaiki agar typecheck hijau.
- Percobaan `docker compose … build/up` tanpa `-p diskuk-operasional-e2e` sempat membuat project `diskuk` terpisah (container + tiga volume kosong). Project itu dihapus dengan `down -v` tak lama setelah terbentuk; stack disposable tidak tersentuh.
- Dua kegagalan di luar Y06 saat menjalankan suite gabungan: `portal.spec.ts` (agenda kegiatan, fase Y07 sesi paralel) dan `passport.spec.ts` (`Halal: Terverifikasi`, fase Y04/Y05 sesi paralel). Keduanya bukan akibat perubahan Y06 dan tidak diklaim.

### Scope guard Y06

`python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check --snapshot /tmp/operasional-Y06-scope.json --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase Y06`

Hasil: 38 berkas berubah setelah snapshot; **seluruh 21 berkas Y06 berada di dalam manifest**. Daftar `outside` berisi hanya berkas sesi paralel yang aktif bersamaan (kegiatan/klinik/FAQ/konsultasi: `apps/web/app/pages/(public)/kegiatan.vue`, `apps/web/app/pages/(public)/faq.vue`, `apps/web/app/pages/(public)/konsultasi.vue`, `apps/web/app/lib/kegiatan.ts`, `apps/web/app/components/klinik/*`, `services/directus/extensions/program/src/endpoints/kegiatan/*`, `.../endpoints/klinik/*`, `.../test/{kegiatan,klinik,whatsapp}.test.js`, `services/directus/migrations/20260927B-klinik-audit-dan-faq.js`, `apps/web/tests/{e2e/kegiatan.spec.ts,e2e/portal.spec.ts,unit/kegiatan.test.ts,fixtures/kegiatan-data.mjs,fixtures/mock-directus*.mjs}`, `scripts/verify-y08-klinik.mjs`, `.env.example`, `docker-compose.yml`, `apps/web/app/constants/PROGRAM.ts`).

Catatan protokol: snapshot diambil **setelah** suntingan kode Y06 selesai (bukan sebelum), sehingga guard membuktikan tidak ada suntingan lanjutan di luar manifest; batch pertama sempat menyentuh berkas di luar daftar (lihat catatan operasional) dan itu tercatat di atas.

## Langkah Selanjutnya

1. Y06 `done`; dependency untuk Y10 tidak bertambah.
2. Frontend lain yang memakai fixture katalog (`apps/web/tests/fixtures/katalog-data.mjs`) sudah disesuaikan; jangan menghapus `usaha_nib`/`usaha_legalitas` dari fixture tanpa mengganti asersi detail.
3. Jika field **jenama** dan **status ekspor** diputuskan masuk model, tambahkan di Y04/M7-06 lalu perbarui `KATALOG_CHIPS`, filter tahap program, dan receipt ini lewat addendum bertanggal.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

- **B26** — lembar spesifikasi produk (`katalog/service.js` memakai `renderDokumenPdf` dari `passport/pdf.js`) kini ditulis sebagai byte latin1 (tanpa mojibake), baris panjang dibungkus ~95 karakter tanpa kehilangan kata, dan tetap terbaca `pdftotext`; commit `8fa246a`.
- **B12** — proxy foto katalog memakai `asset.file.type` + `X-Content-Type-Options: nosniff` (commit `d076303`, bersamaan B10); **B11** — edit produk tayang tidak lagi selalu 400 (commit `bf3e907`).
- **B40** (lanjutan sesi sore, pelaksana B) — `readSingleton("kontak_hotline")` disalin di empat halaman (termasuk `katalog/[id].vue` milik fase ini); kini satu composable `useKontakHotline()` dengan key `useAsyncData` tunggal (`kontak:hotline`); commit `70974b5`. Bukti: `portal.spec.ts` ("the help page shows FAQ from Directus and the official hotline", "the product page shows the official sales contact"), `katalog.spec.ts`, dan `klinik.spec.ts` hijau.
- **B33** (sesi 28 Sep malam) — validasi `telepon` LOI yang semula regex longgar kini memakai satu `normalisasiTeleponSeluler` dari `lib/validate.js` (seluler Indonesia → wajib; `"call me"` tetap 400, `"081234567890"` tetap lolos); commit `3ada000`.
- **B38** (sesi 28 Sep malam, bagian katalog) — label katalog ikut rekomendasi K21 (BADGE server): `KATALOG_TALENT`/badge kartu "Talent Pool"/"Akselerator", "Rekomendasi Marketplace" seragam di tiga titik; `toProduk` membawa `hargaLabel` ("Rp 12.000 - Rp 15.000") yang dipakai kartu + detail publik (menggantikan format lokal "Rp12.000 – Rp15.000"); peta skala sudah seragam sehingga tak berubah; commit `fb37f22`. E2e `katalog.spec.ts` dimutakhirkan dan hijau.

Verdict `done` tidak berubah.
