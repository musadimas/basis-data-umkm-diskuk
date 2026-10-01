# Receipt R02 — Agregasi eksekutif dan direktori investor

- **Tanggal:** 28 September 2026.
- **Verdict:** `partial`. Source R02, migrasi dan rollback resmi pada clone, API nyata, parser PDF, dan empat uji browser desktop/seluler lulus. Gate Y10 masih `blocked`; R02 belum boleh dinyatakan `done` atau membuka fase berikutnya.
- **Isolasi:** seluruh mutasi R02 dijalankan pada salinan database dan container `r02-*`. Tiga clone (`r02_api_clone`, `r02_migrator_clone`, `r02_final_clone`), container, image, dan kredensial browser sementara telah dihapus. Objek PDF uji dihapus melalui Directus (`DELETE /files/:id` → 204, baris file 0). Database dan container utama `diskuk-operasional-e2e` tetap berjalan tanpa penerapan migrasi R02.

## Hasil per requirement

| ID | Bukti perilaku pada clone | Status fase |
| --- | --- | --- |
| N5-02 | Baseline SIDT tahunan/52, laporan disetujui saja, nilai kosong tidak dihitung, 12 titik tren, target kepatuhan `>95%` sebagai ambang. API menghasilkan 4/4 laporan terverifikasi. Grafik, tabel, dan metrik tampil di desktop serta seluler. | Terverifikasi pada clone; R02 `partial` karena gate Y10. |
| N5-03 | Dua minggu selesai terakhir `≤70%` baseline menghasilkan satu risiko. Minggu hilang atau omzet `null` memutus alert. Recompute pertama membuat satu tugas, ulangannya nol; akun kota lain melihat nol risiko. Pin merah dan daftar peserta terlihat di browser. Pada runner tanpa WebGL2, peta memakai grafik koordinat fallback. | Terverifikasi pada clone; R02 `partial` karena gate Y10. |
| N6-01 | Persetujuan usaha dan kurator, pencabutan langsung, verifikasi investor, filter modal/skema/KBLI pada SQL server. Batas Rp49.999.999, Rp50 juta, Rp500 juta, dan Rp500.000.001 tepat. Akun investor memakai role Directus khusus dengan satu izin baca `/users/me`; `GET /items/usaha` dan `/items/investor_profil` ditolak 403. Anonim 401, akun tidak diverifikasi 403, pencabutan membuat detail 404. Filter gabungan lulus di browser. | Terverifikasi pada clone; R02 `partial` karena gate Y10. |
| N6-02 | Deal card mengambil data SIDT/Talent/KPI sesuai status persetujuan, membedakan margin deklarasi. Executive Summary PDF valid (`pdfinfo`: A4, satu halaman); upload PDF melalui Directus, kurasi, dan unduh pitch deck privat lewat endpoint menghasilkan 200 dan `%PDF-`. LOI dari desktop dan seluler tersimpan (read-back 3 baris dari beberapa run browser), dua POST serentak dengan kunci sama menghasilkan satu baris dan flag duplikat. Akses list/detail/PDF/pitch deck/LOI diaudit. | API dan browser utama terverifikasi pada clone; UI upload pitch deck pemilik belum diuji di browser. R02 `partial` karena gate Y10. |

## Source dan artefak

- Migrasi `services/directus/migrations/20260928F-executive-investor.js`: tabel investor privat, tugas risiko, kolom LOI, serta role/policy investor khusus. Tidak ada grant Public.
- API `services/directus/extensions/program/src/endpoints/executive/{index,rules}.js`; bundle di `extensions/program/package.json`.
- Web: `/dashboard/akselerasi`, `/dashboard/usaha/investor`, `/dashboard/investor-kurasi`, `/investor`, `/investor/:id`; peta `AtRiskMap.client.vue`; `tests/e2e/r02.real.spec.ts`.
- Screenshot nyata: [monitoring desktop](artifacts/R02/monitoring-desktop.png), [monitoring seluler](artifacts/R02/monitoring-mobile.png), [deal card desktop](artifacts/R02/deal-card-desktop.png), [deal card seluler](artifacts/R02/deal-card-mobile.png). Semua memakai data fixture pada clone.

## Pemeriksaan

| Perintah/probe | Hasil |
| --- | --- |
| `node --test test/*.test.js` di `services/directus/extensions/program` | 156/156 pass, termasuk tujuh tes R02. |
| `pnpm --dir apps/web typecheck`, build web dan bundle Directus R02, ESLint terarah `--max-warnings 0`, `git diff --check` | Lulus. Image web dan Directus isolasi dibangun dari source terbaru. |
| `check_coverage.py` | Exit 0: 35 ID M di Y, 14 ID N di R. Ini bukti pemetaan, bukan bukti runtime. |
| Migrator resmi pada `r02_final_clone`: `migrate:latest` → `migrate:down` → `migrate:latest` → `migrate:down` | Migrasi R02 diterapkan dan dibatalkan dengan bersih. Role, policy, dan tabel R02 hilang setelah rollback. Bootstrap A–E pada clone memerlukan pengguna root karena mode berkas B–E; migrasi F sendiri lulus memakai pengguna runtime `node` setelah A–E tercatat. |
| API isolasi dan SQL read-back | Monitoring 200 untuk provinsi/kota, 403 UMKM; risiko satu, tugas recompute 1 lalu 0. Direktori anonim 401, belum diverifikasi 403, profil disetujui 200, dicabut 404. Empat batas modal tepat. `/users/me` investor 200; dua koleksi langsung 403. |
| PDF dan LOI | `pdfinfo` satu halaman A4; pitch deck upload/unduh 200 `%PDF-`; LOI retry 200/200 satu baris; dua POST konkuren 200/200 satu baris; LOI browser persisted. |
| Playwright Chromium real API via runner Linux pada clone, desktop + iPhone 13 viewport | **4/4 pass**: monitoring, pin merah, filter tiga parameter, detail, unduhan Executive Summary, dan LOI. Runner macOS lokal menolak launch Chromium karena izin MachPort; runner Linux menyelesaikan bukti browser. |
| `scope_guard.py check --snapshot /tmp/operasional-R02-scope.json --manifest ... --phase R02` | Exit 1 karena delapan path di luar R02 berubah setelah snapshot oleh pekerjaan paralel: receipt/review Y10, analytics tabular/infographic beserta tes, tes katalog media, dan tes route manifest. File itu tidak diubah sebagai bagian pekerjaan R02. |
| `node --test services/directus/test/route-manifest.contract.test.mjs` | 2 pass, 1 fail pada route R01 `operasional|GET|/aspek-perkembangan` yang belum bertanda adapter; tidak berasal dari R02. |

## Gate yang tersisa

1. Tuntaskan Y10 `blocked` berdasarkan `stage_1/receipt_Y10_acceptance.md` sebelum menaikkan verdict R02.
2. Jalur deployment Directus masih harus dibereskan: Dockerfile saat ini menemui `pnpm-workspace.yaml` authentication tanpa `packages`; image uji memakai Dockerfile sementara yang menghapus file itu. Migrator pada pengguna `node` juga terhalang mode berkas migrasi B–E (`0600`) saat memulai dari baseline utama. Perbaikan kedua hal ini milik pekerjaan Y10/bersama dan belum diterapkan ke stack utama.
3. Uji alur upload pitch deck dari UI pemilik ke kurator di browser; endpoint upload, kurasi, dan proxy PDF sudah lulus. Ulangi `scope_guard` setelah file pekerjaan paralel stabil dan selesaikan kegagalan contract test R01.
