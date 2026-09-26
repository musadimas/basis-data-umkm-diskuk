# E2E Plan — Prioritas Kuning lalu Merah, Basis Data UMKM DISKUK Jabar

- **Status:** siap sebagai handoff per tahap; provider eksternal tetap mengikuti gate runtime di bawah.
- **Tanggal revisi:** 26 September 2026.
- **Sumber prioritas:** `requirements.md` di root repo, yang menyalin highlight [Brief Fitur](https://docs.google.com/document/d/1FG6eZ2b94300R_FnO_Z09JE-pqo6vBAHIqlOZSSHuSc/edit?tab=t.0).
- **Target:** repo `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`.
- **Aturan eksekusi:** selesaikan dan buktikan seluruh `Y01–Y10` (kuning) sebelum mulai `R01–R05` (merah). Huruf Y/R adalah urutan kerja baru, bukan nomor phase lama.

## Executor brief

Baca `requirements.md`, `priority_coverage.json`, lalu file phase aktif. Implementasikan semua butir kuning terlebih dahulu, termasuk Modul 7. Butir merah hanya dikerjakan setelah gate `Y10`. Dua butir hijau yang ternyata belum ada pada source saat perencanaan—pencarian global Tabular dan basemap satelit—ikut diperbaiki di `Y05` sesuai keputusan pengguna. Jangan memakai `legacy/phase_*.md` sebagai instruksi eksekusi; berkas tersebut hanya jejak rancangan teknis lama.

Selesai berarti setiap ID pada `priority_coverage.json` mempunyai bukti hasil perilaku/API/artifak di phase miliknya; gate Stage 1 dan Stage 2 lulus secara terpisah; migrasi, worker, browser, dan provider diuji pada stack disposable. Tes statis atau mock saja tidak membuktikan alur user atau provider.

## Klarifikasi dan tradeoff yang dikunci

| Keputusan | Dasar dan konsekuensi |
| --- | --- |
| Semua kuning sebelum merah | Instruksi pengguna pada percakapan ini. Stage 2 tidak boleh dimulai dengan alasan file lama sudah menaruhnya di Phase 2/5/7/9. |
| Empat role dasar tetap dibangun di Stage 1 | M5, M6, dan M7 kuning membutuhkan akun UMKM serta pendamping. Widget demo satu klik N1-03 tetap Stage 2. Ini menyelesaikan catatan “admin dulu” dengan membedakan otorisasi fungsional dari kontrol presentasi. |
| Pencarian global Tabular dan basemap satelit ikut Stage 1 | Pengguna mengonfirmasi dua item hijau itu perlu diperbaiki karena belum ada pada source. Proof fase Y05 harus menguji perilaku asli, bukan sekadar tombol. |
| CAPTCHA hanya simulasi prototipe | Pengguna mengonfirmasi. UI harus jelas berlabel “Simulasi CAPTCHA”; tidak boleh mengklaim ada proteksi CAPTCHA server. |
| Laporan KPI mengikuti brief: setiap Jumat | Pengguna mengonfirmasi. Minggu dan hari dihitung di `Asia/Jakarta`. Laporan yang dibuat offline pada Jumat boleh tersinkron setelah Jumat dengan metadata waktu pembuatan dan idempotency key yang valid. |
| Notifikasi/pengingat WhatsApp Stage 1 | Asumsi perencanaan: gateway nyata dan adapter server diperlukan. Nama provider, kredensial, template, dan nomor pengirim belum tersedia; phase Y07/Y08/Y09 harus berhenti pada gate provider dan melapor `not provider-proven` bila sandbox provider tidak dapat diuji. Tidak boleh mengklaim pesan terkirim dari toast/mock. |
| SSO Jabar dan klaim verifikasi eksternal | SSO berada di Stage 2; alur riil perlu kontrak IdP. Status OSS/sertifikasi/PDN pada katalog hanya boleh berlabel “terverifikasi” setelah ada sumber bukti/verifikator; deklarasi mandiri diberi label terpisah. |

Rencana lama berdasar `docs/new_requirements.md` yang tidak mempertahankan warna dan memilih Modul 1–6. Revisi ini menjadikan `requirements.md` sumber prioritas, mempertahankan kontrak keamanan/scoping/worker yang relevan dari plan lama, menambah Modul 7, serta memindahkan seluruh fitur merah ke Stage 2. Direktori `legacy/` disimpan untuk audit keputusan terdahulu dan bukan bagian urutan executor.

## Peta sistem dan baseline yang diperiksa

| Permukaan | Baseline | Konsekuensi phase |
| --- | --- | --- |
| Identitas | `services/directus/extensions/shared/auth.cjs` hanya menerima satu role aplikasi; `apps/web/app/components/auth/SignInForm.vue` sudah punya show/hide password | Y01 menambah role, NIB login, profil dan audit tanpa widget demo. |
| Analitik dan spasial | `apps/web/app/components/dashboard/TabularData.vue` belum punya pencarian global; `Choropleth.client.vue` hanya layer OSM; ekspor PNG agregat lama 1×1 | Y05 memperbaiki pencarian, satelit, popup, dan PNG/PDF/PPT sebagai satu gate artefak. |
| Produk publik | `apps/web/app/pages/(public)/katalog.vue` memakai daftar produk hardcoded; plan lama Phase 10 hanya membuat CRUD privat | Y04 membuat sumber produk terkurasi; Y06 mengganti katalog statis dengan query publik terbatas. |
| Kegiatan | Belum ada route/model kegiatan terstruktur | Y07 membuat koleksi, API baca, kalender/lini masa dan detail; registrasi QR ada di R03. |
| Klinik/FAQ | `/konsultasi` baru pengantar, punya tautan `/sign-uo` yang tidak ada; `LandingFaq.vue` memuat jadwal program 2025 | Y08–Y09 membuat tiket dan alur internal, memperbaiki tautan dan FAQ berbasis konten kurasi. |
| Privasi | ADR-001 dan ADR-004 mewajibkan session, CSRF, scoping serta minimisasi PII | Semua endpoint publik harus memakai DTO allowlist; NIK dan nomor telepon mentah tidak boleh masuk katalog, log, ekspor, atau query publik. |

## Related plan gap scan

| Pertimbangan dari rencana 14 phase lama | Perlakuan revisi |
| --- | --- |
| Auth server-side, scoping kabupaten/kota, outbox analitik, data dummy `dummy_`, rollback migrasi | Dipertahankan sebagai kontrak Stage 1. |
| Talent Index deterministik 4×25%, status `diajukan → dinilai → scouting`, KPI offline IndexedDB, Ed25519, worker ekspor | Dipertahankan, dengan proof produksi-shaped dan perubahan aturan Jumat. |
| Demo switcher, 5 aspek Permen, toggle offline simulasi, agregat eksekutif/at-risk | Dipindah seluruhnya ke Stage 2. Grafik tren per peserta dan pembacaan dasar pimpinan yang diperlukan M5-06 tetap Stage 1. |
| Modul 7, LOI katalog, agenda publik, klinik, FAQ | Ditambahkan ke Stage 1 sesuai highlight kuning; bagian merah modul yang sama berada di Stage 2. |
| PNG agregat 1×1 dan metadata hijau yang belum ada | Diperbaiki di Y05; tidak diwariskan sebagai non-goal. |
| Penandaan selesai di `docs/new_requirements.md` | Diganti coverage berbasis ID `requirements.md`; `docs/new_requirements.md` tidak diberi tanda ✅. |

## Urutan phase dan dependency

| Stage | Phase | File aktif | ID requirement | Dependency dan exit utama |
| --- | --- | --- | --- | --- |
| Kuning | Y01 | [stage_1/phase_Y01_identity.md](stage_1/phase_Y01_identity.md) | M1-01…04 | Role, sesi, scoping, login, profil; foundation. |
| Kuning | Y02 | [stage_1/phase_Y02_talent.md](stage_1/phase_Y02_talent.md) | M4-01…04 | Y01; atribut Jabar dan Talent Scouting sampai BA. |
| Kuning | Y03 | [stage_1/phase_Y03_kpi.md](stage_1/phase_Y03_kpi.md) | M5-01…06 | Y02; laporan Jumat/offline, verifikasi, tren, rekomendasi. |
| Kuning | Y04 | [stage_1/phase_Y04_product_passport.md](stage_1/phase_Y04_product_passport.md) | M6-01…04, M7-06 | Y02; produk terkurasi, Passport, radar, showroom. |
| Kuning | Y05 | [stage_1/phase_Y05_exports_map.md](stage_1/phase_Y05_exports_map.md) | M2-01, M3-01, M6-05; dua perbaikan hijau | Y02, Y04; berkas ekspor valid, popup, pencarian, satelit. |
| Kuning | Y06 | [stage_1/phase_Y06_public_catalog.md](stage_1/phase_Y06_public_catalog.md) | M7-01…05 | Y04, Y05; katalog/produk publik, filter, kontak, LOI. |
| Kuning | Y07 | [stage_1/phase_Y07_events.md](stage_1/phase_Y07_events.md) | M7-07…10 | Y01; agenda dan detail publik, provider pengingat. Bisa dikerjakan paralel Y02–Y06 setelah Y01. |
| Kuning | Y08 | [stage_1/phase_Y08_clinic_backend.md](stage_1/phase_Y08_clinic_backend.md) | M7-11…12 (kontrak) | Y01; data, tiket, slot, lampiran, notifikasi. |
| Kuning | Y09 | [stage_1/phase_Y09_clinic_ui.md](stage_1/phase_Y09_clinic_ui.md) | M7-11…14 (UI) | Y08; form, antrean, sesi, FAQ/hotline. |
| Gate | Y10 | [stage_1/phase_Y10_acceptance.md](stage_1/phase_Y10_acceptance.md) | seluruh M + perbaikan hijau | Semua Y; bukti runtime dan coverage lengkap sebelum merah. |
| Merah | R01 | [stage_2/phase_R01_demo_regulation.md](stage_2/phase_R01_demo_regulation.md) | N1-01…03, N2-01, N5-01 | Y10; branding, SSO, switcher, lima aspek, demo offline. |
| Merah | R02 | [stage_2/phase_R02_executive_investor.md](stage_2/phase_R02_executive_investor.md) | N5-02…03, N6-01…02 | Y10; KPI agregat/at-risk dan direktori investor. |
| Merah | R03 | [stage_2/phase_R03_events_aid.md](stage_2/phase_R03_events_aid.md) | N7-01…03 | Y10, Y07; pendaftaran, QR/presensi/sertifikat, bantuan. |
| Merah | R04 | [stage_2/phase_R04_clinic_extensions.md](stage_2/phase_R04_clinic_extensions.md) | N7-04…05 | Y10, Y09; metrik klinik, coach dan profil usaha. |
| Gate | R05 | [stage_2/phase_R05_acceptance.md](stage_2/phase_R05_acceptance.md) | seluruh N | R01–R04; bukti akhir tanpa mengubah verdict Stage 1. |

Y07 dan Y08 dapat berjalan setelah Y01 tanpa menunggu Y02–Y06; Y09 menunggu Y08. R01–R04 boleh berjalan paralel **hanya setelah** Y10 lulus. Satu phase adalah satu konteks executor dan satu receipt; jangan menggabungkan dua phase dalam satu commit tanpa alasan tertulis.

## Scope ownership dan batas aman

- Baseline pada saat revisi: branch `main`, commit `fc450bb`; `.zcodeignore` dan `requirements.md` belum terlacak. Pertahankan keduanya. `docs/` diabaikan oleh `.gitignore`; saat eksekusi, force-add hanya file docs yang memang tercantum pada phase aktif, bukan seluruh folder.
- `priority_coverage.json` adalah daftar tertutup 49 ID. Jalankan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` sebelum phase dan setelah perubahan requirement. Kegagalan coverage adalah stop condition.
- `scope_manifest.json` membatasi path per phase; jalankan `scope_guard.py snapshot` sebelum edit dan `scope_guard.py check --phase <ID>` sebelum commit. Jika path baru benar-benar perlu, perbarui manifest dan phase aktif melalui amandemen yang dapat ditinjau, bukan edit diam-diam.
- Jangan menjalankan `pnpm dev:direct`, migrasi/seed/index/cleanup ke environment bersama atau production, membaca `.env`/token, melakukan `git reset --hard`, `git clean`, `git stash` seluruh tree, `git add -A`, atau push. Gunakan project Docker disposable `diskuk-operasional-e2e` sesuai runbook lama.
- Pertahankan URL analitik lama, akun provinsi lama, format API `{ data, meta? }`, error `{ errors: [...] }`, private `Cache-Control: no-store`, session policy same-origin, dan privacy ADR-004.
- Public catalog/agenda/FAQ hanya mengeluarkan allowlist field publik. Kontak produsen memakai nomor terverifikasi; NIK/telepon pribadi, omzet pribadi, payload Directus mentah, path berkas privat, dan identitas tiket klinik tidak boleh bocor.

## Contract ledger lintas lapisan

| Kontrak | Penyimpanan/producer | Service/API | UI/consumer | Bukti wajib |
| --- | --- | --- | --- | --- |
| Role dan scope kota/usaha | `directus_users.role/kota/usaha`, policy | `requireRole`/`resolveOperator` pada semua endpoint | menu, header, route, fetch | request silang role/kota/usaha menghasilkan 403/404, bukan data. |
| Scouting | `usaha_atribut_jabar`, `talenta`, `talenta_berita_acara` | kalkulator server 4×25%, transaksi BA | Tabular, form, panel provinsi | skor deterministik, status persisted `scouting`, BA dapat dibaca ulang. |
| Laporan Jumat | `program_batch`, `talenta_laporan_mingguan`, file bukti, `client_uuid` | validasi WIB/Jumat, idempotency, status verifikasi | PWA UMKM, antrean pendamping, tren pimpinan | offline Jumat → sync Sabtu tepat satu laporan; kirim bukan Jumat ditolak kecuali replay antrean valid. |
| Produk/Passport | `produk`, `produk_foto`, legalitas terverifikasi, `passport_kode` | kurasi, skor radar, Ed25519, verifikasi publik | editor UMKM, Passport, showroom | QR/PDF asli valid, data publik minim, tanda tangan berubah invalid saat payload diubah. |
| Ekspor Canvas | `analitik_job` + worker renderer | PNG/PDF/PPT dari filter aktif | dialog dan unduhan | file dapat dibuka dan memuat grafik/tabel/angka nyata, bukan PNG 1×1 atau PDF kosong. |
| Katalog publik dan LOI | produk tayang + data legalitas/verifikasi + `kemitraan_minat` | endpoint baca publik terfilter dan POST minat dengan rate limit | `/katalog`, `/katalog/:id` | data bukan hardcode; filter server, detail, CTA, LOI tersimpan; draft/PII tidak bocor. |
| Agenda | `kegiatan` + penyelenggara/kuota/metode | list/detail publik, pengingat provider | kalender/lini masa/detail | semua kategori/filter/status, CTA terarah, reminder receipt provider atau `not provider-proven`. |
| Klinik | `klinik_tiket`, slot, lampiran, catatan | prefill milik sendiri, workflow, WhatsApp adapter | `/konsultasi` + panel pendamping | tiket/antrean/status/readback, IDOR ditolak, WhatsApp receipt atau `not provider-proven`. |
| FAQ/hotline | konten kurasi + nomor dinas | endpoint baca publik | `/faq`/LandingFaq/footer | tidak ada tanggal 2025 basi dan tautan hotline membuka nomor yang dikonfigurasi. |

## Acceptance proof dan gate runtime

Setiap ID M/N mempunyai phase tepat satu di `priority_coverage.json`. File phase menjabarkan input, aksi, expected output, test, dan artefak bukti. Gate Y10/R05 membaca seluruh receipt dan menolak penanda `done` bila hanya ada typecheck, screenshot mock, request antrean tanpa hasil, atau provider tidak dapat dibuktikan.

| Preflight | Perintah/aksi | Sinyal siap | Bila gagal |
| --- | --- | --- | --- |
| Repo | `git status --short --branch` dan `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` | baseline tercatat, 49/49 ID unik | stop; jangan menyapu dirty file. |
| Env dan port disposable | Mulai dari `.env.example`, buat `/tmp/operasional-e2e.env` dengan secret acak lokal; `DEMO_MODE=false` selama Y01–Y10. Periksa port lokal yang dipakai Compose bebas dan `docker compose --env-file .env.example config --quiet`. Detail pola pembuatan env ada di `legacy/main_plan.md` bagian “Prosedur disposable stack”, tetapi ubah flag demo sesuai stage ini. | Compose config lolos dan tidak ada kredensial production di file sementara | stop; jangan memakai `.env` bersama/production atau menyalin secret ke receipt. |
| Stack disposable | `docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env up -d --build` | Directus `/server/health`, web HTTP 200, Postgres/MinIO/worker sehat | status `not runtime-proven`; hanya test statis tidak menutup phase. |
| Migrasi dan dummy | jalankan migrasi/seed sesuai phase pada stack disposable, hanya data bertanda `dummy_` | query readback, login empat role, cleanup runbook nol baris dummy | stop pada phase stateful. |
| Browser | Playwright real API plus visual desktop/mobile dan akses tanpa login | alur user, filter, popup, PWA, PDF/PNG/PPT terbaca | `not browser-proven`. |
| Provider | sandbox WhatsApp/SSO/OSS sesuai phase, tanpa kredensial di repo | callback/receipt dan readback yang cocok dengan tiket/reminder | `not provider-proven`; tidak mengirim ke nomor riil tanpa fixture izin. |

State matrix wajib pada phase yang menulis: awal, kosong, tidak berizin, valid, gagal jaringan, retry, duplikat/idempotency, stale, dan dua request bersamaan. Keputusan status/BA, upload, LOI, tiket, laporan, registrasi, sertifikat, dan ekspor harus dibuktikan pada service/API + persistensi; UI mock hanya bukti tambahan.

## Kontrak eksekusi setiap phase

1. Baca `main_plan.md` dan file phase aktif, bukan seluruh `legacy/`. Periksa anchor/source dan baseline. Jika kontrak berubah, stop dan amandemen plan.
2. Snapshot scope; edit hanya path phase; jalankan gate unit/contract/typecheck/build yang relevan; jalankan runtime disposable dan browser/provider sesuai phase.
3. Simpan receipt: verdict `done/partial/blocked`, ID kebutuhan, file berubah, perintah+exit, output API/SQL, screenshot atau artefak, provider receipt bila ada, cek yang tidak berjalan, risiko.
4. Phase berikutnya hanya boleh menganggap dependency selesai jika receipt membuktikan semua hasil kritis. `not runtime-proven` tidak boleh dinaikkan menjadi `done`.
5. Di batas Stage 1, Y10 menjalankan coverage, semua test suite relevan, proof runtime, file export scan, security/PII probes, dan cleanup dummy. Stage 2 baru dibuka setelah Y10 `done`.

## Global failure probes

| Probe | Cara | Menangkap |
| --- | --- | --- |
| Prioritas | `check_coverage.py` + cek file Stage 1 terhadap daftar N pada receipt | ID hilang, merah masuk sebelum gate. |
| Batas file | `scope_guard.py check --snapshot <snapshot> --manifest <manifest> --phase <ID>` | edit di luar manifest. |
| Publikasi data | GET katalog/detail/agenda/FAQ tanpa login; scan response untuk NIK, telepon pribadi, raw omzet, directus file privat | bocor PII atau katalog memakai DTO internal. |
| Mutasi | dua POST identik dan dua POST konkuren untuk laporan/LOI/tiket/BA | duplicate write, status stale, email/WA ganda. |
| Export | buka seluruh tipe dengan parser PNG/PDF/PPT; cek ukuran, halaman/slide, angka dan QR | tombol unduh semu, file kosong/1×1. |
| Provider | simulasi 2xx API tanpa callback/receipt tidak boleh menutup gate | klaim notifikasi/SSO/OSS palsu. |
| Browser | desktop dan mobile, authenticated dan unauthenticated | konfigurasi/test statis disalahartikan sebagai UX terbukti. |

## Context refresh dan final checklist

Pada pergantian phase, buka kembali `main_plan.md` dan hanya file phase berikut. Jangan mengulang eksplorasi seluruh repo kecuali anchor gagal. Akhiri dengan:

- [ ] `check_coverage.py`: semua 35 M dan 14 N tepat sekali, M pada Y, N pada R.
- [ ] Semua Y01–Y09 dan Y10 `done` sebelum R01 dimulai.
- [ ] Semua R01–R04 dan R05 `done` untuk menyatakan keseluruhan plan selesai.
- [ ] Setiap artefak browser/API/SQL/worker/provider mempunyai readback yang dapat diperiksa.
- [ ] `scope_guard.py` hijau tiap phase, tidak ada dirty path pengguna tertimpa.
- [ ] Dummy cleanup pada disposable stack menghasilkan nol baris `dummy_`; production tetap tidak berubah.
