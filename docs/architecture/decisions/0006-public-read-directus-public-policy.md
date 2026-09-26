# ADR-006: Akses Baca Publik melalui Directus Public Policy

- **Status:** Accepted
- **Tanggal:** 26 September 2026
- **Keputusan target:** belum ada grant publik; setiap fase Brief Fitur yang menambah collection publik (katalog, kegiatan, FAQ, hotline) menambahkan grant-nya sendiri di migration yang sama. Lihat [rencana Brief Fitur](../../brief-fitur-plan/main_plan.md).

## Context

Portal publik (Modul 7: katalog produk, agenda kegiatan, FAQ dan hotline, klinik konsultasi) serta verifikasi Talent Passport harus dapat dibaca tanpa login. Sampai sekarang seluruh data berada di balik dashboard privat ([ADR-001](./0001-private-dashboard-directus-auth.md)) dan endpoint custom memeriksa role Application User.

Web mengakses Directus melalui proxy `/panel/**` (`routeRules` di `apps/web/nuxt.config.ts`). Proxy ini tidak memeriksa sesi, sehingga request tanpa cookie sampai ke Directus sebagai akses publik.

Dua opsi dipertimbangkan: endpoint custom dengan allowlist field, atau Public policy bawaan Directus.

## Decision

1. Data publik dibaca melalui **Public policy Directus** (baris `directus_access` dengan `role` dan `user` bernilai NULL) memakai REST/SDK bawaan.
2. Grant dibuat di migration, per collection dan hanya untuk action `read`. Policy ID dicari dari `directus_access`, bukan di-hardcode, karena ID berbeda per instalasi:

   ```sql
   INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
   SELECT 'produk', 'read',
          '{"status_kurasi":{"_in":["tayang","rekomendasi_marketplace"]}}'::jsonb, '{}'::jsonb, '{}'::jsonb,
          'id,nama,deskripsi,kategori,harga_retail,harga_grosir,moq,foto',
          a.policy
     FROM directus_access a
    WHERE a.role IS NULL AND a."user" IS NULL;
   ```

3. `fields` selalu berupa allowlist eksplisit. `*` dilarang.
4. Collection yang punya status tayang/kurasi wajib memakai item filter (`permissions`) sehingga draft tidak terbaca publik.
5. Collection sumber berisi PII tidak pernah mendapat grant publik: `usaha`, `pelaku_usaha`, `alamat`, `usaha_tabular`, `usaha_legalitas`, `directus_users`, dan seluruh read model `analitik_*`. Relasi dari collection publik ke collection tersebut hanya mengembalikan ID.
6. `directus_files` hanya boleh dibaca publik dengan filter folder khusus publik. Berkas legalitas dan bukti KPI berada di folder privat.
7. Tulis dan pencarian berdasarkan identitas tetap endpoint custom, bukan grant publik:
   - verifikasi passport (`GET /v1/program/passport/verify/:kode`) karena harus menghitung ulang signature;
   - lookup NIB/NIK dan pembuatan tiket klinik karena menerima identifier pribadi dan butuh captcha serta rate limit;
   - formulir LOI katalog.
8. Rate limiter Directus (`RATE_LIMITER_ENABLED`) diaktifkan di `docker-compose.yml` bersama grant publik pertama.
9. Respons publik boleh di-cache oleh browser dan CDN hanya untuk collection yang disetujui; `/panel/**` untuk request bersesi tetap `private, no-store`.

## Consequences

### Positive

- Tidak ada kode endpoint baru untuk list, filter, sort, dan paginasi publik; web memakai SDK Directus yang sudah ada.
- Admin dapat melihat dan mengaudit grant di Data Studio (Settings → Access Policies → Public).

### Negative

- Konfigurasi permission menjadi batas privasi. Kesalahan grant di Data Studio langsung membuka data, tanpa code review.
- Query publik dapat memakai operator filter dan `deep` Directus secara bebas, sehingga beban query lebih sulit dibatasi dibanding endpoint custom.
- Filter relasi (mis. katalog berdasarkan wilayah atau skala usaha) tidak dapat membaca `usaha` karena collection itu tidak publik. Kolom yang dibutuhkan untuk filter publik harus didenormalisasi ke collection publik atau disediakan lewat endpoint custom.

## Alternatives rejected

- **Endpoint custom dengan allowlist field untuk semua data publik:** batas privasi berada di kode dan teruji, tetapi setiap list/filter/paginasi harus ditulis ulang. Dipilih hanya untuk kasus pada Decision #7.
- **Bypass sesi di proxy web:** tidak diperlukan karena proxy `/panel/**` tidak memeriksa sesi.

## Acceptance evidence required

- Test kontrak yang memindai migration: setiap grant ke Public policy memakai action `read` dan tidak memakai `fields = '*'`.
- Test kontrak: tidak ada grant publik untuk collection pada Decision #5.
- Pemeriksaan runtime: request anonim ke `/panel/items/usaha` dan `/panel/items/pelaku_usaha` mengembalikan 403.
- Rate limiter aktif sebelum grant publik pertama dideploy.
