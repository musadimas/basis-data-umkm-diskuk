# Receipt R05 — Gate akhir tahap merah dan keseluruhan rencana

- **Tanggal:** 29 September 2026.
- **Verdict gate:** **`blocked`**. Gate ini tidak dapat lulus: dependency [Y10](../stage_1/receipt_Y10_acceptance.md) masih `blocked`, R01–R03 `partial`, dan gate menemukan **empat cacat baru** (D1–D4 di bawah) di luar cakupan R04/R05. Rencana **belum selesai**; jangan menulis `done`.
- **Yang dilakukan:** bukti dikumpulkan ulang dari kode hari ini pada clone terisolasi (`r04_clone` + `r04-directus` :8156 + `nuxt dev` :3120), bukan dari receipt lama. Stack bersama `diskuk-operasional-e2e-*` dan DB `diskuk` tidak diubah. Rincian isolasi: [R04 runtime-evidence](artifacts/R04/runtime-evidence.md).
- **Batas:** R05 menyusun verdict; tidak memperbaiki cacat fase lain. Tidak ada commit, push, atau perubahan production.

## Cacat yang ditemukan gate (perlu keputusan/perbaikan)

| # | Cacat | Bukti | Pemilik dan perbaikan yang disarankan |
| --- | --- | --- | --- |
| D1 | **Oracle keberadaan NIB pada login.** NIB terdaftar + kata sandi salah → `401 INVALID_CREDENTIALS`; NIB tidak terdaftar → `400 INVALID_PAYLOAD "email must be a valid email"`; e-mail tidak terdaftar → 401. Siapa pun tanpa akun dapat menguji apakah suatu NIB milik akun (validasi body Directus berjalan sebelum captcha, jadi ALTCHA tidak mencegahnya). | `r05-smoke.mjs` R05.C1 (FAIL). Penyebab: `unmatchedEmail()` di `authentication/src/lib/utils/identity.js` menghasilkan `nib-<uuid>@unmatched.invalid`, dan TLD `.invalid` ditolak validator e-mail Directus. Tes unit `login-guard.test.js` hanya menyamakan bentuk string sehingga tidak menangkapnya. | Y01 (M1-01/M1-02). Ganti domain dengan TLD valid (mis. `@unmatched.example.com`), ubah regex tes, dan tambahkan tes HTTP. Satu baris + satu tes. |
| D2 | **Aturan Jumat KPI tidak ada di server.** Laporan minggu berjalan diterima `201` pada hari Selasa; M5-03 mensyaratkan "Kamis ditolak, Jumat diterima". Tidak ada rujukan Jumat/`createdAt` offline di `extensions/program` maupun web; receipt Y03 `done` tidak menyebutnya. | R05.D1 (FAIL); kode `kirimLaporan` hanya memeriksa `mingguKe <= minggu berjalan`; `grep -ri jumat` pada `program/src` dan halaman KPI: nihil. | Y03 (M5-02/M5-03). Perlu keputusan produk (Jumat WIB, replay offline Jumat sesudahnya) lalu implementasi + tes; verdict Y03 sebaiknya diturunkan ke `partial` untuk M5-03. |
| D3 | **Cleanup dummy tidak menghasilkan nol.** Setelah clone diisi probe (tiket, produk, passport, KPI, outcome), `cleanup-dummy-operasional.sql` COMMIT, tetapi `seed-dummy-operasional.mjs cleanup` gagal 500 (`directus_files_uploaded_by_foreign`): berkas yang diunggah akun dummy dengan nama bukan `dummy_*` menghalangi penghapusan akun. Tiket klinik, CSAT, dan `klinik_konsultan` tidak dikenal skrip. | [dummy-cleanup-readback.txt](artifacts/R05/dummy-cleanup-readback.txt): sebelum `4 8 8 27 5 5 1 8 | 38 6`, sesudah `1 0 0 0 0 0 0 0 | 38 0`. | Y01 (skrip). Hapus berkas `uploaded_by` akun dummy lebih dulu, tambahkan tabel klinik ke skrip, atau cukup buang volume stack disposable. Batas ini dicatat di runbook. |
| D4 | **Spec real-API lama tidak menjalankan widget ALTCHA.** `auth.directus.spec.ts` gagal (`getByLabel('Kata sandi')` cocok dua elemen), `operasional.directus.spec.ts` Y02 gagal/berubah-ubah (login tanpa widget), lima tes lain di-skip tanpa `DEMO_ACCOUNT_PASSWORD`. | [existing-real-specs-run.log](artifacts/R05/existing-real-specs-run.log): 5 pass (semua `katalog-publik.directus`), 3 fail, 5 skip. | Spec lama perlu memakai helper login ber-widget (contoh: `r04.real.spec.ts`). Bukti runtime Y01–Y03 lama tidak dapat direproduksi oleh spec yang ada; cakupan yang sama dicek ulang di sini oleh `r05.real.spec.ts`. |

## Checklist wajib

| # | Butir | Hasil | Bukti |
| --- | --- | --- | --- |
| 1 | `check_coverage.py`; 14 N ↔ receipt R01–R04; 35 M ↔ receipt Stage 1; `scope_guard.py` tiap phase; tanpa requirement tersembunyi di legacy | **Sebagian.** Coverage exit 0 (35 M, 14 N, 15 phase). Semua ID punya receipt (tabel di bawah). `scope_guard` dijalankan untuk R04 dan R05 dari snapshot sebelum edit; snapshot pra-edit fase lain tidak ada sehingga guard fase itu tidak dapat diulang. Pemindaian ID pada `legacy/` menemukan nol ID; audit semantik legacy **tidak** dilakukan. | `check_coverage.py` → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases; 15 phase files and manifests present` |
| 2 | Migrasi/rollback, unit/contract, typecheck/build, browser real API empat role, smoke alur baru; recheck KPI Jumat/offline, katalog, Passport, agenda, klinik, Tabular, satelit, ekspor | **Sebagian.** Migrasi 11 langkah `down` lalu `latest` bersih. Semua suite hijau (tabel perintah). Browser real-API: empat role + NIB + scope + Tabular + flag demo + halaman publik (5/5), katalog publik (5/5), klinik R04 (6/6). Probe API ulang: Passport/produk 77/77, klinik 98/98, R04 66/66, smoke 17/19. **KPI Jumat: gagal (D2).** Offline: hanya tes mock (outbox). **Satelit** dan **ekspor** PNG/PDF/PPT tidak dijalankan ulang (worker tidak berjalan pada stack ini). | [migration-rollback-cycle.txt](artifacts/R05/migration-rollback-cycle.txt), [backend-suites.log](artifacts/R05/backend-suites.log), [r05-browser-run.log](artifacts/R05/r05-browser-run.log), [y04-run.log](artifacts/R05/y04-run.log), [y09-run.log](artifacts/R05/y09-run.log), [r05-smoke-run.log](artifacts/R05/r05-smoke-run.log) |
| 3 | SSO dan WhatsApp sandbox; QR/PDF/PPT/XLSX dibuka parser; agregat/risiko dihitung independen | **Tidak terpenuhi seluruhnya.** SSO: `not provider-proven`. WhatsApp: `not provider-proven` (klinik/pengingat; dilepas dari gate atas keputusan pengguna). Artefak QR/XLSX/PDF diparse pada bukti R02/R03/Y04 lama, tidak diulang di sini. Agregat KPI/risiko: hitungan independen di receipt R02, tidak diulang. Klinik R04: statistik dan direktori dihitung independen pada sesi ini. | receipt R01/R02/R03; R04 runtime-evidence |
| 4 | Privacy/role: IDOR kota/usaha/tiket, investor tanpa persetujuan, demo switcher flag off, enumerasi NIK/NIB, sertifikat dicabut, hasil konsultasi sensitif; query budget; dua request konkuren | **Sebagian, dengan D1.** IDOR usaha, tiket (98 probe), outcome (39), monitoring, KPI: lulus. Investor tanpa sesi: 401. Demo switcher tanpa flag: 403 tanpa cookie sesi. 14 endpoint publik dipindai untuk NIK, kontak tiket, e-mail akun, NIB/WA bisnis: bersih (NIB/WA bisnis sengaja publik hanya di katalog tayang). Koleksi privat tertutup untuk anonim dan umkm. **Enumerasi NIB: gagal (D1).** Sertifikat dicabut: bukti R03. Konkurensi: klinik (slot, CSAT, outcome, verifikasi, penutupan) lulus; query budget: statistik 1 query, direktori 2 query berapa pun jumlah konsultan, p95 4–9 ms. | r05-smoke-run.log, r04-runtime-run.log, pg tes |
| 5 | Cleanup dummy hanya di stack disposable; report akhir per ID | **Cleanup tidak nol (D3).** Dijalankan hanya pada clone. Report ini adalah report akhir; klaim per ID dibatasi pada bukti. | dummy-cleanup-readback.txt |

## Verdict per ID N (14)

| ID | Phase | Verdict | Dasar (receipt) dan hasil recheck R05 |
| --- | --- | --- | --- |
| N1-01 | R01 | `partial` | [R01](receipt_R01_demo_regulation.md): SSR memuat logo/identitas; browser desktop/mobile tidak terbukti. R05: halaman sign-in dirender pada browser real-API (screenshot role). Izin aset merek belum dikonfirmasi. |
| N1-02 | R01 | **`not provider-proven`** | Simulasi lokal; kontrak/sandbox IdP Jabar tidak ada. Tidak dihitung sebagai SSO nyata. |
| N1-03 | R01 | `partial` | Pengalih peran server-side dengan flag: 403 tanpa `DEMO_MODE` (R05 runtime). Empat sesi demo dengan flag menyala tidak terbukti (R01: password demo tidak cocok). |
| N2-01 | R01 | `partial` | Endpoint `aspek-perkembangan` (`indikator-operasional-v2`) berjalan pada clone, kini juga menghitung hasil klinik (R04). Kartu dashboard pada browser real-API tidak dijalankan ulang. |
| N5-01 | R01 | `partial` | Toggle simulasi: bukti mock; koneksi offline real-API tidak diulang. |
| N5-02 | R02 | `partial` | [R02](receipt_R02_executive_investor.md): terbukti pada clone. R05: monitoring 200/200/403/403/401 per role; suite hijau. |
| N5-03 | R02 | `partial` | Idem; peta risiko tidak diulang di browser. |
| N6-01 | R02 | `partial` | Idem; investor tanpa sesi 401 (R05). |
| N6-02 | R02 | `partial` | Idem; PDF/pitch deck diparse pada bukti R02, tidak diulang. |
| N7-01 | R03 | `partial` | [R03](receipt_R03_events_aid.md): API/mock terbukti; browser real-API belum. R05: prefill mengabaikan parameter NIB/usaha, anonim 401, provinsi 403. |
| N7-02 | R03 | `partial` | Idem; e-pass staf 403, pindai tanpa rahasia 403, XLSX umkm 403. QR kamera dan PDF sertifikat tidak ada. |
| N7-03 | R03 | `partial` | Idem; kuota bantuan hanya provinsi (kab/kota 403). |
| N7-04 | R04 | `partial` — runtime-proven (clone) | [R04](receipt_R04_clinic_extensions.md): API 66/66, browser 6/6. |
| N7-05 | R04 | `partial` — runtime-proven (clone) | Idem, termasuk kegagalan integrasi, koreksi, cabut, IDOR, dan kerahasiaan. |

## Verdict per ID M (35)

Verdict fase = kolom "Receipt"; kolom "Recheck R05" hanya memuat apa yang dijalankan ulang hari ini.

| ID | Phase | Receipt | Recheck R05 |
| --- | --- | --- | --- |
| M1-01 | Y01 | `done` | Login NIB dan e-mail via browser (5/5). **D1:** NIB tidak terdaftar memberi respons berbeda. |
| M1-02 | Y01 | `done` | ALTCHA nyata pada login browser; captcha CSAT/tiket nyata pada API. |
| M1-03 | Y01 | `done` | Empat role mendarat di beranda masing-masing (browser); screenshot menunjukkan header dengan nama dan lencana peran (tidak ada assert otomatis atas warna lencana). |
| M1-04 | Y01 | `done` | Menu akun → Keluar berfungsi pada empat role (browser). |
| M2-01 | Y05 | `partial` | Tidak dijalankan ulang (worker tidak jalan; bukti Y05 pada clone terpisah). |
| M3-01 | Y05 | `partial` | Popup pin real-API tetap belum dibuktikan. |
| M4-01…M4-04 | Y02 | `done` | Suite talent hijau; spec real-API Y02 tidak dapat direproduksi (D4). IDOR usaha lintas kota 404 (runtime). |
| M5-01 | Y03 | `done` | Beranda usaha (PWA) memuat nama usaha dan "Minggu" via NIB login (browser). |
| M5-02 | Y03 | `done` (outbox mock) | Offline→sinkron hanya bukti mock; tidak diulang real-API. |
| M5-03 | Y03 | `done` → **tidak terpenuhi** | **D2:** tidak ada aturan Jumat; laporan Selasa diterima. |
| M5-04…M5-06 | Y03 | `done` | Scope daftar peserta KPI cocok SQL (R05.A6); review/pitching dari suite pg hijau. |
| M6-01…M6-04, M7-06 | Y04 | `partial` (+ addendum `runtime-proven`) | Probe Y04 diulang pada kode hari ini: **77/77** (produk → kurasi → passport → verifikasi → tamper → cabut → QR). |
| M6-05 | Y05 | `partial` | PDF ringkasan/katalog: suite passport-pdf hijau; ekspor worker tidak diulang. |
| M7-01…M7-05 | Y06 | `done` | Spec katalog publik real-API diulang: **5/5** (draft tak muncul, bebas PII, 27 wilayah, detail, LOI ganda → satu surat, ponsel). |
| M7-07…M7-10 | Y07 | `partial` | Agenda publik dirender dari API nyata tanpa PII; pengingat WhatsApp `not provider-proven`. |
| M7-11, M7-12 | Y08 | `done` | Probe klinik 98/98 (pemesanan, slot, lampiran, lacak, IDOR). |
| M7-13, M7-14 | Y09 | `partial` (+ addendum `runtime-proven`) | Probe Y09 98/98; kanban ber-scope; FAQ tampil pada halaman publik. Tombol/notifikasi WhatsApp `not provider-proven`. |

## Bukti perintah (hari ini)

| Perintah | Hasil |
| --- | --- |
| `python3 …/check_coverage.py` | exit 0 |
| `node --test services/directus/extensions/program/test/*.test.js` | 119 pass |
| `test/pg/*.test.js` (Postgres nyata) | 141 pass |
| `node --test services/directus/test/*.test.mjs` | 53 pass + 3 skip; dengan PG 56/56 |
| authentication / operasional / analytics / worker | 35 / 25 / 103 pass + 1 skip / 51 |
| `pnpm --dir apps/web typecheck`, `vitest run`, `pnpm build` | lulus; 123/123; sukses |
| `pnpm exec playwright test --project=chromium` (mock penuh) | 107 pass, 19 skip (blok real-API), 0 fail (Y10: 80/8/16) |
| `pnpm lint:oxlint` | exit 0 tanpa peringatan (Y10: 125 error) |
| `r04-runtime.mjs` / `y04.mjs` / `y09.mjs` / `r05-smoke.mjs` | 66/66 / 77/77 / 98/98 / 17/19 (2 = D1, D2) |
| Playwright real-API: `r04.real.spec.ts` / `r05.real.spec.ts` / `katalog-publik.directus` | 6/6 / 5/5 / 5/5 |
| `migrate:down` ×11 lalu `migrate:latest` (`20260928A`–`20260929C`) | semua `down` sukses; tabel 88 → 73 → 88, indeks 218 → 173 → 218 |

## Yang belum terbukti (jangan dibaca sebagai selesai)

SSO Jabar dan WhatsApp (provider); ekspor PNG/PDF/PPT worker dan basemap satelit pada browser; popup pin real-API (M3-01); browser real-API untuk R01–R03; tablet/mobile; pengalih peran demo dengan flag menyala; aturan Jumat KPI (D2); cleanup nol dummy (D3); audit semantik `legacy/`; `scope_guard` untuk fase selain R04/R05.

## Langkah berikutnya yang disarankan

1. Putuskan D1 (satu baris + tes) dan D2 (keputusan produk lalu implementasi) — keduanya menyentuh fase Y yang sudah ditandai `done`.
2. Perbaiki spec real-API lama agar memakai login ber-widget (D4) dan perluas skrip cleanup atau dokumentasikan "buang volume" (D3).
3. Tutup sisa Y10 (Y04/Y05/Y07/Y09) baru kemudian ulangi R05; gate ini tidak boleh dinaikkan selagi Y10 `blocked`.

## Addendum 29 September 2026 — perbaikan D1–D4

Atas permintaan pengguna, keempat cacat diperbaiki. Bukti pada clone disposable baru (`r04_clone` + `r04-directus` :8156 + `nuxt dev` :3120, dibuang sesudahnya); stack bersama tidak disentuh. Log: [fix-D1-D4/](artifacts/R05/fix-D1-D4/).

| # | Perbaikan | Bukti |
| --- | --- | --- |
| D1 | `unmatchedEmail()` memakai `@unmatched.example.com` (lolos Joi); tes unit menolak TLD cadangan. | HTTP clone: NIB terdaftar + sandi salah, NIB tak terdaftar, e-mail tak terdaftar → ketiganya `401 INVALID_CREDENTIALS` identik. |
| D2 | Aturan Jumat WIB di `kpi/service.js`: laporan baru hanya Jumat (`409 BUKAN_HARI_LAPOR`); draf offline membawa `dibuatPada` (jam perangkat) yang sah bila Jumat, ≤ 5 menit di depan server, ≤ 7 hari; disimpan di kolom baru `kpi_laporan.dibuat_pada_klien` (migrasi `20260929D`). Replay `clientUuid` dan revisi laporan ditolak tidak terikat hari. Web: outbox mengirim `createdAt` sebagai `dibuatPada`; form menolak laporan baru di luar Jumat dan menampilkan aturannya. | pg `kpi-jumat.test.js` (4 tes; mutation check: mematikan aturan → 3 gagal). HTTP clone (Selasa): kirim langsung 409, draf hari ini 409, jam +10 menit 400, Jumat 8 hari lalu 400, draf Jumat lalu 201 + `dibuat_pada_klien` tersimpan, replay 200 id sama, laporan kedua 409. Browser: form menolak di hari Selasa (real API). |
| D3 | `cleanup-dummy-operasional.sql` menghapus tiket klinik usaha/pemohon dummy (cascade CSAT/outcome/audit/lampiran), konsultan tertaut akun dummy, dan melepas `modified_by`; `seed-dummy-operasional.mjs cleanup` menghapus berkas unggahan akun dummy sebelum akunnya. | Clone diisi ulang (R04 66/66, Y04 77/77, Y09 98/98) lalu cleanup: sebelum `akun=4 usaha=8 … tiket_dummy=27 outcome=6 csat=3 berkas=2`, sesudah semua `0`. Sisa 11 tiket adalah tiket anonim bawaan DB sumber (bukan dummy). |
| D4 | Helper `tests/e2e/real-login.ts` (isi ulang sampai ALTCHA terverifikasi, tunggu pathname `/dashboard`); `auth.directus` dan `operasional.directus` memakainya; tes reset sandi dan filter wilayah katalog menunggu hidrasi. | Real API: `auth.directus` + `operasional.directus` 8/8 (dua kali), `katalog-publik.directus` 5/5 (filter 3/3 berulang; LOI berulang cepat kena rate limit 429 sesuai desain). |

Suite sesudah perbaikan: program unit 120/120, pg 145/145, authentication 35/35, operasional 25/25, kontrak `services/directus/test` 56/56 (PG) + kontrak migrasi D, vitest 123/123, typecheck dan oxlint bersih, Playwright mock chromium 108 lulus / 19 skip.

Verdict gate tetap **`blocked`**: Y10 masih `blocked` dan batas "yang belum terbukti" di atas tidak berubah, kecuali D1–D4 yang kini tertutup.
