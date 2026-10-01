# ADR-009: Cakupan Pemanggil Fail-Closed dengan Gate Wajib per Route

- **Status:** Accepted (28 Sep 2026, malam — kandidat 01 tahap 1, commit `7e774f6`). Arah dan interface diterima; rute lama dimigrasi bertahap (satu fitur per sesi) dengan tes manifest sebagai ratchet. Keputusan produk K1/K4/K8 mengikuti rekomendasi di bawah; keputusan formal tetap milik pemilik produk (preseden K21).
- **Tanggal:** 28 September 2026
- **Keputusan target:** gelombang 3 di dokumen yang sama (Kandidat 01). Perbaikan P0 B01–B06 dikerjakan lebih dulu sebagai patch kecil.

## Context

Pertanyaan "siapa pemanggil ini dan apa yang boleh ia lihat" saat ini dijawab ulang di setiap endpoint:

- ada empat cara memuat pemanggil: `loadActor`, `actorKlinik`, dan dua salinan `resolveOperator`;
- ada tiga sumber kota usaha;
- gate bersifat opt-in, jadi endpoint harus ingat memanggilnya.

Review arsitektur 28 September 2026 menemukan lima kebocoran P0 dari pola ini:

- endpoint tanpa gate (`/legalitas`, daftar Berita Acara);
- usaha dengan kota null yang lolos gate Admin Kab/Kota;
- Admin Kab/Kota tanpa wilayah penugasan yang melihat semua pengajuan talent;
- peran default `provinsi`;
- staf klinik yang bisa membaca berkas apa pun.

Semuanya lolos dari suite tes yang hijau, karena tes memalsukan database.

## Decision (usulan)

1. **Satu module Cakupan Pemanggil** (`services/directus/analytics-shared/cakupan.cjs`) menjadi satu-satunya tempat yang memuat pemanggil dan menjawab pertanyaan cakupan. Module ini dipakai bundle program, analytics, authentication, operasional, dan worker ekspor.
2. **Fail-closed.**
   - Akun tanpa baris → 401.
   - `app_role` NULL atau tidak dikenal → tanpa akses.
   - Tidak ada peran default, dan `accountability` tidak pernah menjadi sumber peran.
   - Migrasi membuang `DEFAULT 'provinsi'` dan `NOT NULL` dari `app_role`.
3. **Kota tidak diketahui berarti di luar cakupan.**
   - Data yang kotanya tidak diketahui berada di luar cakupan setiap Admin Kab/Kota.
   - Admin Kab/Kota tanpa wilayah penugasan → 403 `KOTA_NOT_ASSIGNED`.
4. **Sumber kota usaha adalah `usaha_tabular.kota_id`**, yaitu read model hasil proyeksi yang ber-index. List analitik memakai `kota_id` milik read model yang sedang dibacanya.
5. **Target di luar cakupan → 404 seragam**, supaya keberadaannya tidak bocor. `KOTA_NOT_ASSIGNED` tetap 403. *(Menunggu K1.)*
6. **Gate wajib dideklarasikan.**
   - Setiap route di-mount lewat adapter `terjaga({ peran })` atau `publik()`.
   - Tes manifest menolak route yang di-mount tanpa salah satunya, dan daftar route publik ditulis eksplisit.
7. **Kapabilitas untuk web.** Kapabilitas pemanggil diturunkan oleh module yang sama, sehingga menu dan route web tidak menyalin tabel peran sendiri. *(Menunggu K4.)*

## Consequences

### Positive

- Kelas bug "endpoint lupa gate" menjadi kegagalan tes, bukan kebocoran.
- Tes lintas kota (matriks peran × resource) ditulis sekali terhadap Postgres ter-migrasi, bukan diulang per endpoint dengan fake SQL.
- Router analitik dan worker ekspor menegakkan scope lewat module yang sama.

### Negative

- Usaha yang belum terproyeksi ke `usaha_tabular` ditolak untuk Admin Kab/Kota selama latensi worker.
- Akun `provinsi` yang sudah ada tidak bisa dibedakan dari hasil default lama. Perlu tinjauan manual dari daftar audit migrasi. *(K7.)*
- Pindah dari 403 ke 404 di program dan klinik mengubah kontrak yang dilihat web.
- Folder `analytics-shared` tidak lagi hanya berisi kode analitik. Namanya bisa dirapikan terpisah.

## Alternatives rejected

- **Join live alamat → kelurahan → kecamatan → kota di setiap predikat:** memang lebih segar, tetapi menambah empat join di setiap list. `usaha_tabular.kota_id` diturunkan dari join yang sama oleh projector dan sudah ber-index.
- **Module di `extensions/shared`:** tidak terjangkau worker ekspor, padahal worker membutuhkan scope yang sama (Kandidat 03).
- **Tetap opt-in dengan checklist review:** sudah gagal lima kali pada stage 1.
- **Mempertahankan 403 untuk semua penolakan:** membedakan "tidak ada" dari "bukan milik Anda" membocorkan keberadaan usaha di wilayah lain.

## Catatan implementasi (28 Sep 2026, malam — kandidat 01 tahap 1)

- Module `services/directus/analytics-shared/cakupan.cjs` (commit `7e774f6`): `muatPemanggil` fail-closed, `wajibPeran`, `predikat` (usaha/peserta/tiket/readModel, sumber kota `usaha_tabular.kota_id`), `pastikanUsaha` 404 seragam, `kapabilitas`, `permissionScopeOf` (kompatibel B36), adapter `terjaga({peran})`/`publik()` bertanda `Symbol.for("diskuk.cakupan")`.
- Tes: `services/directus/test/cakupan.contract.test.mjs` (14, fake db), `cakupan-matrix.pg.test.mjs` (3, Postgres ter-migrasi), `route-manifest.contract.test.mjs` (3: 79 route keempat bundle di-mount ke router perekam; yang belum migrasi tercatat di `LEGACY_BELUM_MIGRASI` eksplisit; rute baru tanpa tanda menggagalkan tes; `DAFTAR_PUBLIK` 18 rute eksplisit).
- Keputusan: K1 404 seragam (`KOTA_NOT_ASSIGNED` tetap 403) ikut rekomendasi; K2/K3 diterima (teknis); K4 `kapabilitas()` tersedia, migrasi web (`ROLE_ROUTES` → kapabilitas) menyusul; K5 selesai (`a7cd262`); K6 (`/aktivitas` + `resolve-nib`) ditunda, bukan bagian tahap ini; K7 audit manual (migrasi `20260928A` tanpa default sudah jalan); K8 passport kabkota read-only ditunda ke migrasi passport (belum diiklankan di `kapabilitas`).
- Salinan `lib/utils/auth.js` (tiga bundle) belum dihapus: menunggu migrasi route pertama memakai module (langkah C1-6 lanjutan).

## Acceptance evidence required

- ✅ Tes matriks terhadap Postgres ter-migrasi hijau (`cakupan-matrix.pg.test.mjs`, 3/3, commit `7e774f6`).
  - Peran: admin, provinsi, kabkota(7), kabkota(null), pendamping, umkm pemilik, `app_role` NULL, baris akun hilang.
  - Resource: usaha kota 7, usaha kota 9, usaha kota NULL, peserta, tiket manual tanpa usaha, baris read model.
- ✅ Tes manifest route hijau di keempat bundle (`route-manifest.contract.test.mjs`: 79 route, 18 publik eksplisit, sisanya di `LEGACY_BELUM_MIGRASI`).
- ✅ `information_schema.columns` menunjukkan `app_role` tanpa default (migrasi `20260928A`, commit `0e83667`; pelaksana A).
