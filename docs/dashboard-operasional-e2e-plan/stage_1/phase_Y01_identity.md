# Y01 — Identitas fungsional, login, dan profil

- **Stage:** kuning; **ID:** M1-01, M1-02, M1-03, M1-04.
- **Dependency:** baseline repo dan ADR privasi; tidak perlu phase lain.
- **Rujukan teknis historis:** `../legacy/phase_1.md`, `../legacy/phase_2.md`, `../legacy/phase_3.md`. Ikuti keputusan prioritas `../main_plan.md` bila bertentangan.
- **Scope:** manifest Y01; Directus roles/session dan UI auth/dashboard. Jangan membuat widget demo N1-03, SSO N1-02, atau branding N1-01.

## Implementasi

1. Tetapkan matriks empat role fungsional (provinsi, kab/kota, pendamping, UMKM) dengan atribut wilayah, usaha, dan peserta yang dimiliki. Petakan ke akun Directus. Pertahankan akun provinsi lama serta kontrak session/CSRF. Tulis migrasi/rollback dan dummy seed hanya untuk stack disposable.
2. Jadikan email/username kedinasan `@jabarprov.go.id` dan NIB sebagai identifier login. Resolve NIB ke tepat satu akun UMKM, tanpa membocorkan apakah NIB/email ada pada pesan gagal. NIB tidak boleh menjadi password. Pertahankan show/hide password yang sudah ada. Tautan “Lupa Kata Sandi?” harus membuka reset yang sungguh berfungsi dengan token sekali pakai, kedaluwarsa, dan pembatasan percobaan; uji pengiriman pada mailer sandbox.
3. Tambah simulasi CAPTCHA di form dengan label eksplisit “Simulasi CAPTCHA”. Jangan merekam atau mengiklankannya sebagai proteksi bot riil. Server tetap memakai pembatasan percobaan login yang sudah berlaku.
4. Render identitas nyata dari sesi di header: avatar/fallback, nama, instansi/usaha, badge warna dan label sesuai role. Dropdown menyediakan Pengaturan Akun & Keamanan, Log Aktivitas Sesi, Logout. Audit log menampilkan sesi milik akun sendiri dengan waktu/perangkat yang aman.
5. Terapkan scope role pada endpoint data yang akan dipakai Y02–Y09. Admin kab/kota hanya wilayahnya; pendamping hanya peserta tugasnya; UMKM hanya usahanya. UI menyembunyikan menu yang tidak relevan, API tetap menolak akses langsung.

## Acceptance per ID

| ID | Input dan aksi nyata | Hasil yang harus dibuktikan |
| --- | --- | --- |
| M1-01 | Login akun kedinasan dan akun NIB di browser; klik tampil/sembunyi, kirim reset lalu gunakan token | Dua identifier masuk ke dashboard miliknya; password berubah hanya visibilitas; token reset dapat dipakai sekali dan password baru dapat login. |
| M1-02 | Buka login tanpa/ dengan simulasi CAPTCHA | UI menampilkan simulasi; tidak ada klaim verifikasi server palsu. |
| M1-03 | Login empat role disposable | Nama, organisasi dan badge biru tua/biru muda/hijau/emas konsisten dengan sesi server. |
| M1-04 | Buka tiga menu profil; logout lalu akses URL privat | Pengaturan dan audit sesi milik sendiri; logout menghapus sesi dan private GET ditolak. |

## Kontrak dan failure probes

- `requireRole` dan resolver identitas harus berjalan pada service/API, bukan hanya route guard. Uji request lintas kota, usaha, dan peserta: 403/404 tanpa payload target. Uji tanpa sesi, sesi kedaluwarsa, dua tab/logout, user tanpa mapping, token reset kedaluwarsa dan replay.
- Jangan pernah menaruh password, token, NIK, atau nomor pribadi di log audit. Migrasi dapat rollback pada database disposable tanpa menghapus data lama.
- Gate: unit kontrak auth dan schema, typecheck/build, login browser real API empat role, dan SQL readback scope. Receipt menyertakan matriks role, URL/response redacted, screenshot, serta status semua ID.
