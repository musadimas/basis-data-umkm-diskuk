# ADR-008: Peran Operasional di `app_role` pada Satu Role Aplikasi

- **Status:** Accepted. Menggantikan ADR-007 Decision 1, Decision 6 (bagian CAPTCHA), Decision 8, dan sebagian Decision 2 (nama kolom dan mekanisme penegakan).
- **Tanggal:** 28 September 2026
- **Keputusan target:** mencatat implementasi yang berlaku sejak migrasi `20260926A`, `20260926D`, `20260926H` dan merge `feat/claude` (commit `790559b`).

## Context

ADR-007 ditulis sebelum implementasi. Isinya:

- empat role Directus dengan UUID tetap;
- kolom `directus_users.kota`;
- penegakan lewat `requireRole`;
- CAPTCHA simulasi;
- identitas sesi dari `GET /panel/operasional/me`.

Implementasi mengambil jalur yang berbeda di kelima hal itu. Review arsitektur 28 September 2026 (`docs/dashboard-operasional-e2e-plan/stage_1/architecture_review_fixes.md`) menemukan akibat nyata dari teks yang basi: `requireRole` di `extensions/shared/auth.cjs` memetakan UUID role ke peran. Fungsi itu tidak punya pemanggil. Kalau dipakai sesuai ADR-007, fungsi itu akan menolak setiap Admin Kab/Kota. ADR ini mencatat model yang berlaku supaya pembaca berikutnya tidak membangun di atas model lama.

## Decision

1. **Satu role Directus aplikasi.**
   - Semua akun operasional memakai `APPLICATION_ROLE_ID` (`7d6d493c-…`, role lama "Admin Provinsi") dengan satu policy aplikasi.
   - Peran dibaca dari `directus_users.app_role` (`provinsi | kabkota | pendamping | umkm`, dijaga CHECK constraint).
   - Admin Directus (break-glass) diperlakukan sebagai `provinsi`.
2. **Penugasan.**
   - Admin Kab/Kota: `directus_users.kota_scope` (INTEGER FK ke `kota(id)`, `ON DELETE SET NULL`).
   - Pelaku UMKM: `directus_users.usaha` (UUID FK, unik).
   - Pendamping tidak ditugaskan di akunnya. Ia ditugaskan per peserta (`program_peserta.pendamping`) dan per tiket (`konsultasi_tiket.pendamping`).
3. **Login dengan NIB** di-resolve oleh hook `routes.before` ekstensi `authentication` (`resolveLoginEmail`) sebelum Directus memvalidasi body `POST /auth/login`. Tidak lewat endpoint server-ke-server.
4. **CAPTCHA login adalah ALTCHA sekali pakai yang diverifikasi server** (filter `auth.login`).
   - Pengecualian hanya untuk origin yang dikonfigurasi (`AUTH_CAPTCHA_EXEMPT_ORIGINS`, misalnya Data Studio).
   - Kegagalan captcha dilaporkan sebagai kredensial salah.
   - Bagian rate limiter per IP di ADR-007 Decision 6 tidak berubah.
5. **Identitas sesi di web dimuat dari `readMe()` Directus.** Field-nya adalah yang boleh dibaca role aplikasi: `app_role`, `instansi`, `usaha`, `kota_scope`, dan field profil. `GET /panel/operasional/me` tidak punya pemanggil produksi.

## Consequences

### Positive

- Peran seorang akun bisa diubah tanpa menyentuh role atau policy Directus.
- Permission Directus tetap satu set untuk semua akun operasional.

### Negative

- Permission Directus tidak membedakan peran maupun wilayah. Seluruh pembatasan per peran dan per wilayah harus ditegakkan ekstensi, dan satu endpoint yang lupa berarti kebocoran. Usulan perbaikannya ada di ADR-009.
- `app_role` saat ini `NOT NULL DEFAULT 'provinsi'`. Akun baru tanpa peran eksplisit mendapat akses provinsi. Usulan perbaikannya juga di ADR-009.
- Kode yang memetakan UUID role ke peran (`roleKeyOf`, `requireRole`, `requireApplicationUser` di `extensions/shared/auth.cjs`) salah untuk model ini dan harus dihapus.

## Alternatives rejected

- **Empat role Directus (ADR-007 Decision 1):** tidak dipakai sejak migrasi `20260926D`. Alasan pemilihannya tidak tercatat di kode. ADR ini mencatat keadaan yang berlaku supaya tidak dibalik tanpa sengaja. Membaliknya butuh ADR baru.
- **Simulasi CAPTCHA (ADR-007 Decision 6):** diganti ALTCHA terverifikasi pada 27 September 2026.

## Acceptance evidence required

- Keempat akun peran dummy memakai `role = APPLICATION_ROLE_ID` dengan `app_role` yang berbeda (SQL readback `directus_users`).
- Login dengan NIB berhasil lewat hook `routes.before`. Login tanpa payload ALTCHA dari origin yang tidak dikecualikan ditolak dengan pesan kredensial generik.
- Header web menampilkan peran dari `readMe()`, bukan dari `/operasional/me`.
