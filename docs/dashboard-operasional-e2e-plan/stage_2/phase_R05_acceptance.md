# R05 — Gate akhir tahap merah dan keseluruhan rencana

- **Stage:** gate, tanpa ID baru. **Dependency:** R01–R04 dan Y10 done.
- **Tujuan:** 14 ID N terbukti, semua 35 ID M tetap lulus, dua perbaikan hijau tidak regresi.

## Checklist wajib

1. Jalankan `check_coverage.py`; cocokkan 14 ID N dengan receipt R01–R04 dan 35 M dengan receipt Stage 1. Jalankan `scope_guard.py` tiap phase. Tidak ada requirement tersembunyi dalam legacy yang menambah prioritas.
2. Jalankan migration/rollback, unit/contract, typecheck/build, browser real API empat role, dan smoke semua alur baru pada stack disposable. Recheck KPI Jumat/offline, katalog publik, Passport, agenda, klinik, pencarian Tabular, satelit, ekspor.
3. SSO dan WhatsApp harus mempunyai provider sandbox receipt; QR e-pass/presensi/sertifikat dan PDF/PPT/XLSX dibuka/parser; agregat/risiko diuji dengan perhitungan independen. Jika provider tidak tersedia, tandai ID `not provider-proven` dan verdict tetap `partial`.
4. Uji privacy dan role: IDOR kota/usaha/tiket, investor tanpa persetujuan, demo switcher di production flag off, NIK/NIB enumeration, sertifikat dicabut, profil hasil konsultasi sensitif. Catat query budget dan dua request konkuren untuk stateful flows.
5. Cleanup dummy hanya pada stack disposable, simpan report akhir dengan verdict per ID, tautan artefak, command/exit, readback, risiko dan pekerjaan yang belum terbukti. Jangan menulis klaim “selesai” hanya dari daftar checklist tanpa bukti runtime.

## Addendum eksekusi 29 September 2026

- **Verdict:** `blocked` (Y10 belum `done`; R01–R03 `partial`; gate menemukan empat cacat D1–D4). Detail per ID dan bukti: [receipt_R05_acceptance.md](receipt_R05_acceptance.md). Gate ini dijalankan atas permintaan pengguna walau dependency belum terpenuhi; hasilnya adalah laporan jujur, bukan kelulusan.
- **Cara bukti dikumpulkan:** semua runtime pada clone (`r04_clone`, `r04-directus`, `nuxt dev`), skrip di `artifacts/R04` dan `artifacts/R05` (`r05-smoke.mjs`, `r05.real.spec.ts`, ulang `y04.mjs`/`y09.mjs` dengan `lib.mjs` yang menunjuk clone). Cleanup dummy hanya diuji pada clone; stack bersama tidak dibersihkan karena masih dipakai sesi paralel.
- **Kegagalan yang tercatat sebagai temuan, bukan disembunyikan:** enumerasi NIB pada login (D1), aturan Jumat KPI tidak ada (D2), cleanup dummy tidak nol (D3), spec real-API lama tidak menjalankan widget ALTCHA (D4).
