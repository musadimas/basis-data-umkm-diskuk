# Phase 14 — Penutupan: tandai requirement, dokumentasi, dan validasi penuh

## Objective, dependencies, observable result

- **Dependency:** Phase 1–13 berstatus `proven` pada gate lokal.
- **Objective:** menandai poin `docs/new_requirements.md` yang terimplementasi oleh plan ini, memperbarui README dan status ADR-007, lalu menjalankan seluruh gate validasi dan runbook dummy end-to-end (seed → cleanup → verifikasi nol baris) pada disposable stack.
- **Observable result:** `docs/new_requirements.md` memuat penanda ✅ pada poin yang selesai (dan penanda simulasi untuk SSO/CAPTCHA/Lupa Kata Sandi); README memetakan extension `operasional` dan runbook dummy; seluruh suite hijau; cleanup menghasilkan 0 baris `dummy_`.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-14-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| modify | `docs/new_requirements.md` |
| modify | `README.md` |
| modify | `docs/architecture/decisions/0007-operational-multi-role-dashboard.md` |

`docs/new_requirements.md` saat ini **untracked dan ter-ignore** (`docs/` di `.gitignore`); file ini diedit di tempat dan **tidak** di-stage/commit (scope guard tidak melihatnya — verifikasi dengan diff manual di bawah). `docs/architecture/decisions/0007-…` sudah tracked sejak Phase 1.

## Exact symbols and search anchors

Teks jangkar di `docs/new_requirements.md` (dicari persis; setiap jangkar harus ditemukan tepat sekali):

```bash
for a in "Executive Summary (Macro Infographics & KPI Pimpinan)" "Panel Kurasi & Penetapan Talent Scouting (SK Berita Acara)" "Monitoring Progres Program Akselerasi (Talent Lab s.d. Global)" "Dasbor Kewilayahan (Capaian Pendaftaran vs Target Kuota)" "Manajemen Data Lapangan & Verifikasi Legalitas" "Formulir Pengajuan Calon Talenta ke Tingkat Provinsi" "Dasbor Binaan Aktif (Daftar UMKM Fase Accelerator)" "Verifikasi Laporan KPI Mingguan (Review Bukti Nota/Omzet)" "Rekomendasi Kelayakan Pitching / Investment Day" "Beranda Usaha & Profil Bisnis" "Talent Passport Digital (Kartu QR Code & Radar Scorecard)" "Formulir Laporan KPI Mingguan (Offline-First Ready)" "Pengaturan Portofolio Produk (Digital Twin Uploader)" "Widget Pengalih Peran" "User Profile Header" "Penerapan Aspek Permen UMKM No. 2 Tahun 2026" "Tombol Ekspor Eksekutif" "Interaktivitas Pin & Pop-Up Card" "Pencarian global berdasarkan NIK, NIB, Nama Usaha, atau Nama Pemilik" "Formulir Pengajuan Talent Scouting (Regional Parameter)" "Mesin Kalkulator Talenta Otomatis" "Panel Persetujuan Provinsi (DISKUK Approval)" "Tampilan Mobile Pelaku Usaha (Frame Smartphone PWA)" "Dasbor Verifikasi Pendamping (Coach Review Panel)" "Dasbor Pemantauan Eksekutif DISKUK Jabar" "Layar Talent Passport & Portofolio Publik" "Dasbor Pengelolaan Katalog (Sudut Pandang Pelaku Usaha" "Header Logo:" "Field Input Email/Username:" "Tombol Masuk Utama:" "Di bawah formulir disematkan teks kepatuhan" "Tombol opsi SSO Pemprov:" "Panel Kontrol Peta:"; do printf '%s\t' "$a"; grep -cF "$a" docs/new_requirements.md; done
```

Expected: setiap jangkar menghasilkan `1`; tambahan `grep -c '^  \* CAPTCHA' docs/new_requirements.md` → `1`.

## Current contract and final desired contract

### Current

Requirement tanpa penanda status; README tanpa extension operasional; ADR-007 "diimplementasikan bertahap".

### Final

- `docs/new_requirements.md`: pada **akhir baris** yang memuat setiap jangkar dari 27 jangkar pertama (sampai "Dasbor Pengelolaan Katalog"), tambahkan ` ✅ *(Selesai — dashboard operasional Phase N)*` dengan N sesuai pemetaan: Executive Summary → 5, 9; Panel Kurasi → 6; Monitoring Progres → 7, 9; Dasbor Kewilayahan → 3, 5; Manajemen Data Lapangan → 4; Formulir Pengajuan Calon Talenta → 6; Dasbor Binaan Aktif → 8; Verifikasi Laporan KPI → 8; Rekomendasi Kelayakan Pitching → 8; Beranda Usaha → 7; Talent Passport Digital → 11, 12; Formulir Laporan KPI → 7; Pengaturan Portofolio Produk → 10; Widget Pengalih Peran → 2; User Profile Header → 2; Penerapan Aspek Permen → 5; Tombol Ekspor Eksekutif → 12 (PPT; PDF/PNG existing); Interaktivitas Pin & Pop-Up Card → 13; Pencarian global → 13; Formulir Pengajuan Talent Scouting → 6; Mesin Kalkulator Talenta → 6; Panel Persetujuan Provinsi → 6; Tampilan Mobile Pelaku Usaha → 7; Dasbor Verifikasi Pendamping → 8; Dasbor Pemantauan Eksekutif → 9; Layar Talent Passport & Portofolio Publik → 11, 12; Dasbor Pengelolaan Katalog → 10.
  - Baris login Modul 1 (jangkar tambahan, masing-masing tepat sekali): "Header Logo:", "Tombol Masuk Utama:", "Di bawah formulir disematkan teks kepatuhan" → ` ✅ *(Selesai — dashboard operasional Phase 2)*`; "Field Input Email/Username:" → ` ✅ *(Selesai — dashboard operasional Phase 2; tautan "Lupa Kata Sandi?" berupa simulasi)*`; "Tombol opsi SSO Pemprov:" dan baris yang cocok `^  \* CAPTCHA` → ` 🟡 *(Simulasi/dummy — Phase 2)*`.
  - Baris "Panel Kontrol Peta:" → ` 🟡 *(Sebagian — basemap Street/Satellite Phase 13; toggle Klaster KBLI & Sentra Industri belum)*`.
  - Baris "Direktori Matchmaking Investor / Lembaga Pembiayaan:" dan heading Modul 7 → tidak ditandai (di luar scope).
  - Tidak ada perubahan lain pada isi requirement.
- `README.md`: tabel "Peta paket" baris `services/directus` menyebut extension `Operasional` (multi-role: talenta, program akselerasi, KPI, passport, produk); bagian "Perintah" menambah `pnpm --dir services/directus/extensions/directus-extension-operasional test`; paragraf baru "Data dummy dashboard operasional" menunjuk `docs/operasional/dummy-data-runbook.md` dan menegaskan seed/cleanup tidak untuk production tanpa konfirmasi; paragraf "Batas bukti" tetap.
- ADR-007: bullet "Keputusan target" → "diimplementasikan oleh docs/dashboard-operasional-e2e-plan Phase 1–13; verifikasi runtime produksi belum dilakukan".

## Ordered edits

1. Jalankan jangkar; bila ada jangkar dengan hitungan ≠1 → stop dan laporkan.
2. Edit `docs/new_requirements.md` sesuai §Final (append di akhir baris; pertahankan dua spasi akhir markdown bila ada dengan menaruh penanda sebelum spasi akhir).
3. Edit `README.md` dan ADR-007.
4. Jalankan validasi penuh (di bawah) dan runbook dummy pada disposable stack.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Jangkar ganda/tidak ada → tidak menebak baris; stop.
- `docs/new_requirements.md` tidak ikut commit (ignored); laporkan diff-nya dalam laporan akhir.

## Validation commands

```bash
pnpm lint:oxlint
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus/extensions/directus-extension-analitik test
pnpm --dir services/directus/extensions/directus-extension-tabular test
pnpm --dir services/directus/extensions/directus-extension-infografis test
pnpm --dir services/directus test
pnpm --dir services/analytics-worker test
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/roles.spec.ts tests/e2e/umkm-laporan.spec.ts tests/e2e/executive-summary.spec.ts tests/e2e/pendamping.spec.ts tests/e2e/passport.spec.ts tests/e2e/produk.spec.ts --project=tablet --project=mobile)
pnpm --dir apps/web build
docker compose --env-file .env.example config --quiet
grep -c "✅ \*(Selesai — dashboard operasional Phase" docs/new_requirements.md
grep -c "🟡 \*(" docs/new_requirements.md
```

Expected: semua exit 0; hitungan ✅ = 31; hitungan 🟡 = 3.

## Runtime/deployment proof and unproven boundary

Disposable stack penuh (main plan §7) dari nol → seed → jalankan seluruh `operasional.directus.spec.ts` + `auth.directus.spec.ts` → cleanup sesuai runbook → verifikasi:

```bash
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT (SELECT count(*) FROM usaha WHERE sumber_id LIKE 'dummy\_%') + (SELECT count(*) FROM pelaku_usaha WHERE nik LIKE 'dummy\_%') + (SELECT count(*) FROM directus_users WHERE email LIKE 'dummy\_%') + (SELECT count(*) FROM directus_files WHERE filename_download LIKE 'dummy\_%') + (SELECT count(*) FROM program_batch WHERE kode LIKE 'dummy\_%') + (SELECT count(*) FROM kuota_pendataan WHERE kode LIKE 'dummy\_%') + (SELECT count(*) FROM talenta_berita_acara WHERE nomor LIKE 'dummy\_%') + (SELECT count(*) FROM kota WHERE kode LIKE 'dummy\_%')"
```

Expected: `0`. Deployment dan production: `not applicable` (butuh konfirmasi pengguna). Bila Docker tidak tersedia: `not runtime-proven` untuk seluruh bukti runtime; laporkan daftar phase yang hanya terbukti di mock.

## No-advance condition

Plan dinyatakan selesai hanya bila semua gate lokal hijau; bukti runtime yang tidak dapat dijalankan dilaporkan eksplisit per phase.

## Required failure probes

- Cleanup dijalankan dua kali → kedua kali sukses tanpa error (idempoten).

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-14-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 14
```

Expected: exit `0` dan `outside` adalah array kosong (perubahan `docs/new_requirements.md` tidak terlihat karena ignored).

## Rollback dan handoff

Rollback: revert commit README/ADR; kembalikan `docs/new_requirements.md` dengan menghapus penanda ✅/🟡 (tidak ada salinan git). Handoff: serahkan laporan akhir (daftar phase, status runtime, diff requirement) kepada pengguna.
