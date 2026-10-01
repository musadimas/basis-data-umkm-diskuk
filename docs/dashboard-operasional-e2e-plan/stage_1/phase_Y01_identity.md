# Y01 — Identitas fungsional, login, dan profil

- **Stage:** kuning; **ID:** M1-01, M1-02, M1-03, M1-04.
- **Dependency:** baseline repo dan ADR privasi; tidak perlu phase lain.
- **Rujukan teknis historis:** `../legacy/phase_1.md`, `../legacy/phase_2.md`, `../legacy/phase_3.md`. Ikuti keputusan prioritas `../main_plan.md` bila bertentangan.
- **Scope:** manifest Y01 harus diselaraskan dengan arsitektur pasca-merge sebelum edit; identitas empat peran ada di `directus_users.app_role`, sedangkan `directus_users.role` tetap UUID role Directus bersama. Web memakai SDK/session Directus; jangan menghidupkan kembali BFF Nuxt atau `/api/auth/login-nib`. Jangan membuat widget demo N1-03, SSO N1-02, atau branding N1-01.

**Posisi lanjut 27 September 2026:** kode dasar Y01 sudah ada, tetapi belum ada receipt `done`. Mulai dari perbaikan test/kontrak pasca-merge, lalu proof runtime. Detail frontier dan baseline worktree ada di `../main_plan.md`; jangan mengerjakan ulang migrasi A/D tanpa memeriksa keadaan DB disposable.

## Implementasi

1. Verifikasi matriks empat peran fungsional (provinsi, kab/kota, pendamping, UMKM) pada `directus_users.app_role` dengan atribut `kota` (FK integer), `usaha`, dan peserta yang dimiliki. Semua pengguna operasional memakai satu role/policy aplikasi Directus; `AuthUser.role` adalah UUID dan `AuthUser.app_role` adalah kunci menu/guard. Pertahankan akun provinsi lama serta kontrak session/CSRF Directus. Uji migrasi/rollback A/D dan dummy seed hanya pada stack disposable; jangan membuat role/policy Directus terpisah per peran.
2. Jadikan email/username kedinasan `@jabarprov.go.id` dan NIB sebagai identifier login. Resolve NIB ke tepat satu akun UMKM, tanpa membocorkan apakah NIB/email ada pada pesan gagal. NIB tidak boleh menjadi password. Pertahankan show/hide password yang sudah ada. Tautan “Lupa Kata Sandi?” harus membuka reset yang sungguh berfungsi dengan token sekali pakai, kedaluwarsa, dan pembatasan percobaan; uji pengiriman pada mailer sandbox.
3. Pertahankan implementasi ALTCHA terbaru: `Captcha.client.vue` mengambil challenge dari `/panel/v1/auth/captcha/challenge`; hook login Directus memverifikasi HMAC, expiry, dan pemakaian sekali melalui `auth_captcha_used`, disertai pembatasan percobaan login. Keputusan simulasi dibatalkan pengguna pada 27 September 2026; jangan beri label “Simulasi CAPTCHA” atau mengganti verifikasi server dengan checkbox lokal. Pesan login gagal tetap generik dan payload/token tidak masuk log.
4. Render identitas nyata dari sesi di header: avatar/fallback, nama, instansi/usaha, badge warna dan label sesuai role. Dropdown menyediakan Pengaturan Akun & Keamanan, Log Aktivitas Sesi, Logout. Audit log menampilkan sesi milik akun sendiri dengan waktu/perangkat yang aman.
5. Terapkan scope role pada endpoint data yang akan dipakai Y02–Y09. Admin kab/kota hanya wilayahnya; pendamping hanya peserta tugasnya; UMKM hanya usahanya. UI menyembunyikan menu yang tidak relevan, API tetap menolak akses langsung.

## Acceptance per ID

| ID | Input dan aksi nyata | Hasil yang harus dibuktikan |
| --- | --- | --- |
| M1-01 | Login akun kedinasan dan akun NIB di browser; klik tampil/sembunyi, kirim reset lalu gunakan token | Dua identifier masuk ke dashboard miliknya; password berubah hanya visibilitas; token reset dapat dipakai sekali dan password baru dapat login. |
| M1-02 | Login dengan challenge ALTCHA valid; ulangi tanpa payload, payload salah, kedaluwarsa, dan replay challenge | Challenge sah dipakai sekali; kasus lain ditolak server tanpa enumerasi akun; widget dapat memulihkan challenge dan login berikutnya berhasil. Bukti dari test hook + browser/API nyata, bukan hanya tampilan widget. |
| M1-03 | Login empat role disposable | Nama, organisasi dan badge biru tua/biru muda/hijau/emas konsisten dengan sesi server. |
| M1-04 | Buka tiga menu profil; logout lalu akses URL privat | Pengaturan dan audit sesi milik sendiri; logout menghapus sesi dan private GET ditolak. |

## Kontrak dan failure probes

- Resolver `app_role` dan penugasan harus berjalan pada service/API, bukan hanya route guard. Uji request lintas kota, usaha, dan peserta: 403/404 tanpa payload target. Uji tanpa sesi, sesi kedaluwarsa, dua tab/logout, user tanpa mapping, token reset kedaluwarsa/replay, serta challenge ALTCHA kosong/salah/kedaluwarsa/replay. `lockedKotaId()` di web masih memakai `user.role` dan kota objek; cocokkan dengan `app_role` dan kota angka sebelum mengandalkan kunci UI.
- Jangan pernah menaruh password, token, NIK, atau nomor pribadi di log audit. Migrasi dapat rollback pada database disposable tanpa menghapus data lama.
- Perbarui E2E pasca-merge yang masih mengharapkan `/api/auth/login-nib`, “Menu profil”, dan `/forgot-password`. Pulihkan dependensi `altcha`/`crossws`/`ws` yang belum terpasang di lingkungan lokal, kemudian jalankan test extension authentication dan typecheck web; jangan menganggap kegagalan setup itu proof perilaku.
- Gate: unit kontrak auth dan schema, test hook CAPTCHA, typecheck/build, login browser real API empat role, uji reset lewat Mailpit, dan SQL readback scope. Receipt baru bertanggal menyertakan matriks role, respons yang disamarkan, screenshot, perintah+exit, dan status semua ID; `done` hanya setelah seluruh proof kritis lulus.
