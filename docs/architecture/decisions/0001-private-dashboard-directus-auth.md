# ADR-001: Privatkan Dashboard dengan Directus Session Authentication

- **Status:** Accepted
- **Tanggal:** 18 Agustus 2026
- **Keputusan target:** diimplementasikan pada `extensions/shared/auth.cjs`, middleware proxy panel web, dan session policy; verifikasi runtime produksi belum dilakukan

## Context

Folder route Nuxt `(private)` hanya grouping dan bukan security boundary. Pada baseline, sign-in belum menjadi alur autentikasi fungsional dan beberapa custom read endpoint Infografis/Tabular bersifat publik. Produk membutuhkan seluruh dashboard dan data UMKM hanya dapat diakses oleh satu pengguna internal.

## Decision

1. Seluruh `/dashboard/**` memakai Nuxt route middleware untuk UX dan session bootstrap.
2. Seluruh API Infografis, Tabular, Spasial, Analitik, profile, export, CRUD, dan metadata memeriksa Directus accountability/policy server-side.
3. Custom endpoint yang memakai raw Knex melakukan accountability check eksplisit; collection permissions tidak otomatis melindungi raw SQL extension.
4. Gunakan Directus session authentication melalui same-origin `/panel` dengan cookie `HttpOnly`, `Secure`, `SameSite`, dan HTTPS-only.
5. Baseline absolute session delapan jam dan idle timeout 30 menit harus ditegakkan server-side, bukan hanya timer browser.
6. Tidak ada registrasi atau reset password publik.
7. Satu manusia memiliki:
   - Application User least-privilege untuk penggunaan harian;
   - break-glass Super Admin terpisah untuk keadaan darurat.
8. Worker memakai database role/service principal tersendiri, bukan static/session token manusia.
9. Mutasi berbasis cookie harus memiliki CSRF/origin protection.
10. Token tidak boleh berada di URL, local storage, log, atau dokumentasi.

## Consequences

### Positive

- Route dan API memiliki security boundary nyata.
- Session dapat dicabut melalui Directus.
- Akun harian tidak membawa risiko Super Admin.
- Public landing tetap dapat digunakan tanpa mengekspos data dashboard.

### Negative

- Existing endpoint dan frontend fetch harus diubah bersama.
- Session/CSRF/cookie behavior memerlukan test browser dan reverse-proxy.
- Satu manusia tetap perlu mengelola credential akun terpisah.

## Alternatives rejected

- **Nuxt route middleware saja:** mudah dibypass dengan memanggil API.
- **Static token di browser:** credential tidak dapat dijaga dan sulit dicabut aman.
- **Satu akun Super Admin:** blast radius terlalu besar.
- **Empat role produk:** ditolak karena hanya ada satu pengguna pada fase awal.

## Acceptance evidence required

- Request publik ke seluruh UI/API privat gagal `401`/redirect.
- Authenticated least-privilege user dapat melakukan fungsi yang diizinkan.
- Logout/revocation memutus akses API.
- CSRF, IDOR profil, open redirect, dan cache cross-session tests lulus.
- Public landing tidak mengambil payload dashboard.
