# ADR-007: Dashboard Operasional Multi-Role dengan Scoping Server-Side

- **Status:** Accepted — menggantikan sebagian ADR-001 (alternatif "Empat role produk" dan Decision 7 satu Application User); Decision 1, 6 (CAPTCHA), 8, dan sebagian Decision 2 digantikan [ADR-008](./0008-app-role-single-application-role.md). Usulan penegakan cakupan: [ADR-009](./0009-cakupan-pemanggil-fail-closed.md) (Proposed).
- **Tanggal:** 26 September 2026
- **Keputusan target:** diimplementasikan bertahap oleh docs/dashboard-operasional-e2e-plan (dimulai fase Y01)

## Context

Brief fitur meminta dashboard operasional untuk empat peran fungsional: Admin Provinsi, Admin Kabupaten/Kota, Pendamping, dan Pelaku UMKM. ADR-001 menolak empat role produk karena pada fase awal hanya ada satu pengguna; kebutuhan kini berubah (laporan mingguan UMKM, antrean pendamping, dan katalog membutuhkan akun per peran). Identitas login juga melebar: akun kedinasan memakai email/username `@jabarprov.go.id`, sedangkan pelaku UMKM login dengan NIB usaha. Reset kata sandi yang sebelumnya dinyatakan tidak ada (ADR-001 Decision 6) kini harus sungguhan berfungsi agar alur pemulihan akun dapat diuji.

## Decision

1. Empat role Directus dengan UUID tetap (`provinsi` = role lama `7d6d493c-…` yang di-rename "Admin Provinsi", `kabkota`, `pendamping`, `umkm`); admin Directus (break-glass) diperlakukan sebagai `provinsi`.
2. Penugasan wilayah/usaha disimpan pada `directus_users.kota` / `directus_users.usaha` (kolom baru, FK ke tabel wilayah/usaha); scoping diegakkan di service/API melalui `requireRole` + `resolveOperator`, bukan hanya route guard UI.
3. Endpoint data yang ada (tabular, infografis, analitik, spasial) membuka akses ke `provinsi` + `kabkota` dengan filter `kota` yang dipaksa server-side; permintaan lintas kota tetap menghasilkan data kota sendiri, dan endpoint lain menolak role tanpa penugasan (403/404 tanpa payload target).
4. Login memakai email/username kedinasan atau NIB 13 digit; NIB di-resolve server-ke-server ke tepat satu akun UMKM aktif; pesan gagal selalu generik sehingga keberadaan NIB/email tidak terbocor; NIB tidak pernah dijadikan kata sandi (ditegakkan `auth_password_policy`).
5. Reset kata sandi memakai alur Directus `/auth/password/request` + `/auth/password/reset`: token sekali pakai terikat hash password saat request, kedaluwarsa 1 hari, selalu merespons tanpa membocorkan keberadaan email, dengan tautan menuju halaman web `/forgot-password` yang diizinkan lewat `PASSWORD_RESET_URL_ALLOW_LIST`.
6. CAPTCHA pada form login hanyalah simulasi berlabel eksplisit "Simulasi CAPTCHA" tanpa klaim proteksi server; proteksi brute-force riil berupa rate limiter per IP di Directus yang diaktifkan lewat konfigurasi (`RATE_LIMITER_ENABLED`) dan proxy yang meneruskan `X-Forwarded-For` per klien.
7. Data dummy untuk stack disposable selalu bertanda `dummy_` (email akun `dummy_…`, `usaha.sumber_id = dummy_usaha_NN`, kode wilayah `dummy_*`), dengan seed/cleanup idempoten; dilarang menjalankannya pada environment bersama atau produksi.
8. Identitas sesi dirender di header (avatar/inisial, nama, instansi/usaha, badge warna peran) dari `GET /panel/operasional/me`, dan log aktivitas sesi hanya menampilkan milik akun sendiri tanpa pernah merekam password, token, NIK, atau nomor pribadi.
9. SSO Jabar, widget pengalih peran demo, dan branding portal tetap berada di tahap berikutnya (ADR-001 Decision 6 soal registrasi publik tetap berlaku: tidak ada registrasi mandiri).

## Consequences

### Positive

- Otorisasi fungsional dapat diuji per peran pada stack disposable dengan bukti SQL readback.
- Scoping server-side mencegah kebocoran data lintas wilayah/usaha meskipun UI dimanipulasi.
- Pemulihan akun berfungsi tanpa membangun penyimpanan token sendiri (token Directus terbukti sekali pakai).

### Negative

- Setiap endpoint baru wajib memakai pola `requireRole`/`resolveOperator`; kelalaian satu endpoint membuka lintas kota.
- Rate limiter global per IP menuntut proxy meneruskan IP klien secara benar agar tidak saling mengunci.

## Alternatives rejected

- **Empat akun Directus admin terpisah:** blast radius terlalu besar dan tidak memenuhi scoping.
- **Role di sisi UI saja:** mudah dilewati dengan memanggil API langsung.
- **Token reset dikelola sendiri di tabel baru:** duplikasi alur bawaan yang sudah sekali pakai dan terikat hash; ditunda sampai ada kebutuhan yang tidak dipenuhi core.
- **CAPTCHA pihak ketiga:** butuh provider dan kredensial; simulasi dilarang diiklankan sebagai proteksi.

## Acceptance evidence required

- Login empat akun peran di browser memuat dashboard dengan identitas dan badge yang konsisten dengan sesi server.
- NIB masuk ke dashboard usaha miliknya; pesan gagal identik untuk NIB/sandi salah.
- Token reset dipakai tepat sekali, kedaluwarsa/bermain ulang ditolak, kata sandi baru dapat login, dan NIB ditolak sebagai kata sandi.
- Request lintas kota mengembalikan hanya wilayah sendiri (SQL readback), dan endpoint tanpa sesi/kedaluwarsa ditolak 401/403.
