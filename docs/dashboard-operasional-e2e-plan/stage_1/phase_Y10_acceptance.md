# Y10 — Gate akhir tahap kuning

- **Stage:** gate, tanpa ID baru. **Dependency:** Y01–Y09.
- **Tujuan:** membuktikan seluruh 35 ID M serta perbaikan hijau pencarian Tabular dan satelit selesai sebelum pekerjaan merah.

## Checklist wajib

1. Jalankan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py`. Periksa semua ID M ada persis sekali di matrix, setiap phase punya receipt, dan belum ada implementasi N yang diklaim selesai.
2. Jalankan migrasi/rollback, seed dummy, seluruh test unit/contract yang relevan, typecheck/build, dan smoke pada stack Docker disposable. Catat perintah, exit code, dan hasil SQL readback. Jangan menyentuh production.
3. Browser real API: empat role, SIDT→Scouting→BA, PWA Jumat offline/sync/verifikasi/tren, produk→kurasi→Passport/Showroom, canvas/map/Tabular, katalog+LOI, agenda+pengingat, klinik+FAQ. Uji desktop/mobile, unauthenticated, wrong-role, wrong-city/owner.
4. Periksa file PDF/PNG/PPT/QR dengan parser dan buka secara visual. Periksa provider WhatsApp/email; butuh receipt sandbox yang cocok, bukan toast atau mock. Tinjau kontrak status verifikasi OSS/PDN/SIDT agar klaim publik ditopang sumber.
5. Scan response publik, log, dan berkas ekspor untuk NIK, telepon pribadi, data tiket/omzet yang tidak berizin. Lakukan race/retry/idempotency pada BA, laporan, kurasi, LOI, slot tiket, dan job. Periksa query budget/indeks katalog dan Tabular.
6. Hapus hanya dummy milik stack disposable sesuai runbook; readback nol row `dummy_`. Simpan laporan akhir Stage 1 dengan verdict `done/partial/blocked` per ID dan bukti path/command. Buka R01 hanya jika **seluruh** 35 M, kedua perbaikan hijau, dan provider yang diperlukan berstatus `done`.

## Stop conditions

Jika provider belum ada, data verifikasi belum bisa ditopang, artefak kosong, source green belum diperbaiki, atau ada kebocoran PII/akses silang, Stage 1 tetap `partial`/`blocked`. Catat alasan dan next action; jangan mengubah requirement atau mengerjakan fitur merah sebagai kompensasi.

## Amendemen 29 September 2026 (keputusan pengguna)

Integrasi WhatsApp ditunda karena sulit diintegrasikan. Akibatnya:

- Provider WhatsApp **bukan lagi syarat pembuka R01** pada butir 4 dan 6. Semua jalur WhatsApp (pengingat kegiatan Y07, notifikasi klinik Y08) tetap berstatus `not provider-proven` dan dicatat sebagai risiko terbuka, tidak dihitung sebagai `done`.
- Email (Mailpit) tetap butuh receipt sandbox seperti semula.
- Notifikasi WhatsApp e-pass pada R03 dihapus dari lingkup: e-pass hanya berupa QR di halaman peserta.
- Syarat lain tidak berubah: seluruh 35 ID M, kedua perbaikan hijau, dan tidak ada kebocoran PII/akses silang. Integrasi OSS tetap tidak ada, dan klaim publik tentang status OSS harus dibatasi pada "NIB tercatat".
