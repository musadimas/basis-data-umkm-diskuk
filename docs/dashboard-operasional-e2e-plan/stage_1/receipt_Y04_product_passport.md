# Receipt Y04 — Produk terkurasi, Talent Passport Ed25519, dan Showroom (M6-01…M6-04, M7-06)

- **Tanggal:** 27 September 2026
- **Verdict:** `partial` — seluruh gerbang lokal lulus (unit program 56/56, unit web 42/42, e2e mock `produk-passport.spec.ts` 6/6, typecheck bersih untuk seluruh file Y04), tetapi **bukti runtime disposable (API/browser nyata) belum dijalankan**, sehingga `not runtime-proven` dan tidak boleh dinaikkan ke `done` sesuai aturan main_plan.
- **Scope:** hanya fase Y04. Y03 dikerjakan pengguna paralel pada sesi lain di working tree yang sama; file milik sesi itu tidak disentuh.

## Catatan integritas sesi (penting untuk pembaca receipt)

Selama sesi ini, sebagian output tool (Read/grep terminal panjang) mengalami distorsi transport yang membuat isi file tampil rusak, dan pada tahap akhir sebagian output Bash tampil **terfabrikasi** (nama file/isi yang tidak ada di repo). Konsekuensinya, klaim di receipt ini hanya memuat hal-hal yang terverifikasi berulang lewat jalur kecil yang konsisten: test suite (angka konsisten antar-run), `git diff` per file, smoke script kecil, dan file status berukuran kecil. Kesimpulan yang tidak bisa diverifikasi dua kali dibiarkan di bagian "tidak terbukti".

## Baseline yang dipertahankan

- `git status` awal sesi: `main` pada merge `790559b` (ahead 31), dengan modifikasi bawaan sesi Y01–Y03 dan untracked `handover.md`, `receipt_Y01_identity.md`, `receipt_Y02_talent.md`, `receipt_Y03_kpi.md`. Semua dipertahankan; tidak ada `reset --hard`, `clean`, `stash`, `add -A`, atau push.
- Dependency: Y01 `done` (addendum 27 Sep), Y02 `done`, Y03 receipt ada (sedang dikerjakan paralel pengguna).
- `check_coverage.py` awal → `OK: 35 must-have IDs in Y phases; 14 next-dev IDs in R phases` (exit 0). Snapshot scope diambil **sebelum** edit: `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-Y04-scope.json`.

## Rekonsiliasi manifest Y04

`scope_manifest.json` entri Y04 lama (47 entri) sepenuhnya usang pra-merge: menunjuk `directus-extension-operasional` (passport-signature/scorecard/produk-service), halaman `kurasi-produk.vue`, `verifikasi/[kode].vue`, `server/api/publik/passport/[kode].get.ts`, dan migrasi `20260926G/H` dengan nama yang tidak ada. Direkonsiliasi menjadi **30 entri kanonik** (alasan tertulis di field `note` Y04): migrasi K/L + O/P baru, extension `program` (`passport/{index,service,signing}.js`, `katalog/{index,service}.js`, test), web (`lib/qr-pdf.ts`, `lib/katalog.ts`, `constants/PROGRAM.ts`, `types/program.ts`, `ProdukForm.vue`, halaman kurasi/passport/produk, halaman publik `/passport/[kode].vue`, fixture mock, spec e2e), `docker-compose.yml`, `.env.example`, manifest sendiri, dan receipt. `scope_guard.py check --phase Y04` **belum dijalankan ulang sampai hijau** — tercatat sebagai langkah wajib penerima berikutnya (percobaan pada sesi ini menghasilkan output yang tidak dapat dipercaya).

## Implementasi per butir phase

### 1. Ed25519 menggantikan HMAC (M6-01)

- `program/src/endpoints/passport/signing.js` ditulis ulang: `signingKeys(env)` memuat kunci privat Ed25519 dari `PASSPORT_SIGNING_PRIVATE_KEY_B64` (base64 PEM), menolak kunci non-Ed25519, dan melempar 503 `PASSPORT_NOT_CONFIGURED` bila tidak ada kunci (penerbitan DAN verifikasi gagal keras, bukan dianggap tampered). `sign()` mengembalikan `{ kid, signature }` (base64url, 86 karakter); `verify()` time-safe membandingkan terhadap kunci aktif + kunci `PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64` (jendela rotasi), dengan pengecekan `kid`; kunci lama yang sudah dipensiunkan menghasilkan verifikasi gagal → passport lama harus diterbitkan ulang. `publicKeyInfo(env)` mengekspos `{ kid, jwk, sidikJari }` agar pihak ketiga dapat memverifikasi mandiri.
- Rotasi/kid terdokumentasi di komentar modul, `docker-compose.yml` (env `PASSPORT_SIGNING_PRIVATE_KEY_B64`, `PASSPORT_SIGNING_KID`, `PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64`, `PASSPORT_SIGNING_KID_PREVIOUS` menggantikan `PASSPORT_SIGNING_SECRET`), dan `.env.example` (termasuk perintah generate `openssl genpkey -algorithm ed25519 | base64 | tr -d '\n'`). `docker compose --env-file .env.example config --quiet` lulus setelah edit.
- Migrasi `20260926O-passport-ed25519.js`: `talent_passport.signature` CHAR(64) → VARCHAR(128), kolom baru `kid VARCHAR(64)` + entri `directus_fields` (down: revert).
- Kunci Ed25519 pada `/tmp/operasional-e2e.env` (`PASSPORT_SIGNING_PRIVATE_KEY_B64`) sudah terbukti tipe `ed25519` saat inventaris (divalidasi via `crypto.createPrivateKey` tanpa mencetak nilainya).

### 2. Satu kode: `passport_kode` ↔ `qr_talent_passport_code`

- Kontrak brief `qr_talent_passport_code` dipetakan eksplisit sebagai **alias API** dari kolom kanonik `talent_passport.kode`: `toPassport()` dan respons `/verify/:kode` mengembalikan `qrTalentPassportCode` yang selalu identik dengan `kode`; tidak ada kode kedua yang dihasilkan di mana pun (didokumentasikan di header `signing.js` dan tipe `Passport.qrTalentPassportCode`). Penamaan kolom DB tidak diubah (migrasi terapan tidak boleh diganti nama).

### 3. Radar 5 dimensi, sumber skor, dan badge terverifikasi vs deklarasi (M6-02, M6-03)

- Payload passport yang ditandatangani kini memuat:
  - `sumberSkor`: per dimensi — 4 pilar dari `talent_pengajuan` dengan `rubrik_versi` yang benar-benar dipakai saat penilaian; `kinerja` dari `kpi_laporan` disetujui dengan rincian `met/weeks`, dan **bila usaha belum pernah ikut program sumbernya menyatakan "Belum ada data program"** (skor 0, bukan nilai sempurna) — memenuhi "data kosong tidak otomatis nilai sempurna".
  - `badges`: `pdn` (terverifikasi, sumber "Diverifikasi dinas" dari `usaha.pdn_terverifikasi`) ATAU `pdn_deklarasi` (terverifikasi: false, dari produk tayang ber-`pdn_deklarasi`); `naik_kelas` bila Talent Index (rata-rata 4 pilar) ≥ 75 — ambang yang sama dengan rekomendasi Talent Scouting (`NAIK_KELAS_AMBANG = 75`), sehingga konsisten; per legalitas `terbit` → badge `legalitas_<jenis>` dengan `terverifikasi` hanya bila **berkas sertifikat tercatat**, tanpa berkas berlabel "belum terverifikasi penuh".
- Respons verify menambahkan `publicKey` (kid/jwk/sidikJari) dan portfolio kini memuat `persenBahanLokal` serta `ujiLab`.
- UI: halaman `dashboard/usaha/passport.vue` dan halaman publik `/passport/[kode].vue` menampilkan badge dengan chip "Terverifikasi" (hijau) vs "Deklarasi" (amber) + baris sumber; daftar sumber skor di bawah radar; banner verifikasi publik menampilkan kid + sidik jari kunci; payload pra-badge tetap didukung lewat fallback turunan (badge yang tidak ada buktinya tidak pernah tampil sebagai terverifikasi).

### 4. Media privat sebelum kurasi (M6-04)

- Ditemukan celah nyata: `ProdukForm.vue` mengunggah foto langsung ke folder publik katalog (`20260926K` memberi Public policy read pada folder itu), sehingga foto pra-kurasi terbaca anonim. Diperbaiki:
  - Migrasi `20260926P-katalog-media.js` membuat folder **"Katalog Kurasi"** (`6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11`, tanpa grant publik) dan kolom `produk.uji_lab VARCHAR(200)` (+ entri field).
  - `ProdukForm.vue` mengunggah ke `KURASI_FOLDER_ID`; `assertKurasiPhotos` (pengganti `assertPublicPhotos`) mewajibkan foto berada di folder kurasi DAN — untuk non-kurator — `uploaded_by` = pemohon (referensi foto milik pemilik lain → 403; foto di luar folder → 400 `FOTO_TIDAK_VALID`).
  - `kurasiProduk` memindahkan berkas foto: `tayang`/`rekomendasi_marketplace` → folder katalog publik; `ditolak` → kembali ke folder kurasi. `updateProduk` mengembalikan foto ke folder kurasi (produk tayang yang diedit otomatis privasi lagi + status kembali `menunggu` — review ulang bila field publik berubah, perilaku yang sudah ada kini konsisten untuk media juga).
  - Karena policy aplikasi hanya memberi `directus_files` read `uploaded_by`, kurator tidak bisa melihat foto calon produk lewat `/assets`; ditambahkan proxy **`GET /v1/program/katalog/foto/:fileId`** (`fotoProduk`, menggunakan `AssetsService` internal) yang hanya melayani kurator/provinsi-admin dan pemilik berkas (`uploaded_by`), hanya untuk berkas di dua folder media produk. Halaman kurasi kini memuat thumbnail lewat `katalogFotoUrl()` (`/panel/v1/program/katalog/foto/:id`).
  - Batas 5 foto tetap: validasi `parseProduk` (400 bila > 5) + trigger DB dari migrasi K; UI menonaktifkan unggahan dengan pesan "Maksimal 5 foto per produk."

### 5. Kurasi, pengingat, showroom (M7-06, M6-04)

- Status kurasi + alasan + timestamp + kurator sudah persisted (`status_kurasi`, `catatan_kurasi`, `dikurasi_oleh`, `dikurasi_at`) dan dibaca kembali; keputusan konkuren diserialisasi `FOR UPDATE OF p` dalam transaksi.
- Pengingat PMSE pada `ProdukForm.vue` diperkuat dengan kalimat larangan manipulasi transaksi/ulasan dan kewajiban mutu.
- Field `ujiLab` ditambahkan ke form, DTO (`toProduk`), kolom INSERT/UPDATE, dan ditampilkan di showroom (tab spesifikasi halaman publik, bersama "Bahan baku lokal %").

## Bukti lokal (perintah + hasil, diverifikasi berulang)

| Perintah | Hasil |
| --- | --- |
| `node --test services/directus/extensions/program/test/*.test.js` | **56/56 pass** (50 lama + 6 baru: 5 test signing Ed25519 & rotasi/kid, 1 penyesuaian rute katalog 9 route) |
| `node --test services/directus/extensions/program/test/katalog-media.test.js` | **5/5 pass** (foto lintas pemilik 403, folder salah 400, pindah folder saat kurasi dua arah, reset ke menunggu saat edit, uji_lab tersimpan, proxy foto kurator/pemilik/403) |
| `node /tmp/y04-smoke.mjs` (smoke signing) | canonical JSON ✓; sign/verify ✓; payload diubah → false; kid salah → false; sig pendek/legacy-HMAC-hex → false; tanpa kunci → 503 `PASSPORT_NOT_CONFIGURED`; kunci RSA → ditolak; jwk `OKP/Ed25519`; kunci sebelumnya masih terverifikasi saat rotasi |
| `cd apps/web && pnpm test:unit` | **42/42 pass** (termasuk `tests/unit/qr-pdf.test.ts` 2 test: struktur PDF/xref/offset, escaping teks) |
| `cd apps/web && pnpm typecheck` | exit 0 pada run pertama; run berikutnya exit 2 dengan **satu-satunya error di `app/pages/(public)/katalog/index.vue`** (`readItems("kota", …)`) — file milik sesi paralel pengguna (168 baris perubahan working-tree, bukan sentuhan Y04). Seluruh file Y04 bersih typecheck. |
| `npx playwright test tests/e2e/produk-passport.spec.ts --project=chromium --workers=1` | **6/6 pass** (umkm kirim produk+uji lab ke folder kurasi + banner PMSE; batas 5 foto; kurasi provinsi tayang + readback; passport: kode, QR, badge deklarasi-vs-terverifikasi, sumber skor, unduh PDF dengan header `%PDF-` + `%%EOF` + ukuran; halaman publik valid tanpa login + spesifikasi uji lab; kode tak dikenal → tidak valid/tidak ditemukan) |
| `node --test services/directus/test/*.test.mjs` | 20/21 — **1 kegagalan BUKAN Y04**: `public-grants.contract.test.mjs` menemuk `20260926R-katalog-detail-publik.js` (migrasi baru milik sesi paralel, dibuat 22:17, `fields must be be bound`). File O/P Y04 lolos. |

## Yang belum terbukti (syarat `done`)

1. **Migrasi O/P belum diterapkan** pada stack disposable (container directus berjalan masih image pra-Y04). Runbook: `docker compose --env-file /tmp/operasional-e2e.env --project-name diskuk-operasional-e2e build directus web && up -d`, verifikasi `directus_migrations` memuat `20260926O-passport-ed25519` & `20260926P-katalog-media`, cek kolom `talent_passport.kid`/`signature VARCHAR(128)`/`produk.uji_lab`/folder "Katalog Kurasi".
2. **API runtime:** issue passport oleh provinsi pada usaha talent_pool (dari BA Y02), `GET /verify/:kode` → `valid:true` + `qrTalentPassportCode === kode` + `publicKey.kid`; tamper probe (`UPDATE payload` satu byte di DB → verify → `valid:false`); cabut → `status:"dicabut"`; unggah foto pemilik A direferensikan pemilik B → 403; anonim `GET /panel/assets/<foto-kurasi>` → 403, setelah tayang → 200; flip `pdn_terverifikasi` + re-issue → badge PDN muncul/hilang; legalitas tanpa berkas → badge tidak terverifikasi; PII scan respons publik (tanpa NIK/telepon/omzet).
3. **Browser runtime** (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`, `PLAYWRIGHT_USE_REAL_API=1`): editor produk UMKM (unggah foto nyata ke MinIO), kurasi provinsi, unduh QR PNG/PDF, halaman `/passport/<kode>` tanpa sesi; PDF dibuka (mis. `sips -s format png` untuk bukti raster).
4. **Scope guard hijau:** `scope_guard.py check --snapshot /tmp/operasional-Y04-scope.json --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase Y04` sampai `outside` hanya berisi file milik sesi paralel pengguna.

## Risiko / keadaan lintas sesi yang tercatat

- Sesi paralel pengguna (Y03/katalog) aktif mengubah file bersama selama sesi ini: migrasi baru `20260926Q-enable-pg-trgm.js` dan `20260926R-katalog-detail-publik.js` (R mematahkan 1 test kontrak), `katalog/index.vue` (mematahkan typecheck), `mock-directus.mjs`/`mock-directus-server.mjs`, dan spec lain. Run e2e penuh pada saat bersamaan melaporkan banyak kegagalan lintas spec yang tidak dapat dipisahkan dari perubahan in-flight mereka; **klaim hijau Y04 dibatasi pada suite ter-scope di atas.**
- Passport lama bergaya HMAC (bila ada di DB lain) akan berstatus `tidak_valid` setelah perubahan ini sampai diterbitkan ulang — perilaku aman yang disengaja (rotasi).
- `seed-dummy-operasional.{mjs,sql}` tidak diubah (hindari konflik dengan sesi paralel); data kurasi/passport untuk runtime dibuat lewat API, bukan seed.
- Distorsi output tool pada sesi ini dicatat di bagian integritas; angka test di atas adalah yang terbaca konsisten.

---

## Addendum 28 Sep 2026 — perbaikan pasca-review arsitektur

Review arsitektur pasca-Y10 (`architecture_review_fixes.md`) menemukan bug yang tidak terlihat tes lama. Yang menyentuh phase ini:

- **B03** — `GET /legalitas/:usahaId` hanya memakai `routeGuard`, sehingga usaha siapa pun bisa dibaca pengguna mana pun; endpoint dihapus (tidak ada pemanggil) dan tes kartu petanya dipindah; commit `a7cd262`.
- **B10+B12** — unggahan foto tidak dicek tipe/ukuran di server, dan proxy foto selalu 500 karena membaca `asset.file.mimetype`; kini `image/jpeg|png|webp` ≤5 MB + `Content-Type` dari `asset.file.type` dengan nosniff; commit `d076303`.
- **B11** — edit produk tayang selalu 400 `FOTO_TIDAK_VALID` karena validasi berjalan sebelum `pindahkanFoto`; commit `bf3e907`.
- **B22** — tanggal kedaluwarsa legalitas dan trigger snapshot dihitung UTC; kini `Asia/Jakarta` (`lib/usaha.js`, migrasi `20260928D`); commit `927948b`.
- **B27** — ringkasan PDF: Talent Index = rata-rata 4 pilar (kinerja program di luar), ambang/label dari `NAIK_KELAS_AMBANG` ("Siap Naik Kelas"), tanpa lencana palsu "Talent Pool", dan tanpa QR/tautan `/passport/DRAFT` saat belum ada passport; commit `26a711f`.
- **B26** — PDF ditulis latin1 (tanpa mojibake), baris dibungkus ~95 karakter, paginasi penuh; commit `8fa246a`.
- **B28** (lanjutan sesi sore, pelaksana B) — QR PDF passport di web (`apps/web/app/lib/qr-pdf.ts`): kalimat catatan ditulis mentah di luar `BT…Tj` sehingga content stream tidak valid; kini dibungkus `textLine(24, 58, "F1", 7, …)`; commit `0350ebc`. Tes baru di `tests/unit/qr-pdf.test.ts` memastikan setiap baris content stream hanya berisi operator yang dikenal. Lanjutan `2ea59a1`: kedua font PDF kini mendeklarasikan `/Encoding /WinAnsiEncoding` (sebelumnya byte latin1 dibaca StandardEncoding: "·" jadi bullet dan "Café" jadi "CafØ"); `pdftotext` membaca keduanya dengan benar.
- **B38** (sesi 28 Sep malam, bagian dokumen) — satu konstanta `INSTANSI` ("Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat") di worker (`export-renderer.js`: kepala PNG caps, footer PDF, cover PPT; ekor bitmap PNG yang terpotong dihapus karena kepala sudah memuat nama penuh) dan satu di web (`OPERASIONAL.ts`: baris penerbit QR, footer slide); commit `fb37f22`.

Bukti baru: tes unit/byte-level di `program/test/{dokumen-pdf,passport-pdf}.test.js` dan `pdftotext` ("Café", "·", 120 baris → 3 halaman), plus pg harness untuk B11. Verdict `partial` **tidak berubah**: daftar "Yang belum terbukti" di atas tetap menjadi syarat naik ke `done`.

---

## Addendum 29 Sep 2026 — bukti runtime API + browser (isolasi klon `y49`)

**Verdict: `runtime-proven` untuk alur produk → kurasi → passport → verifikasi → tamper → cabut → QR (API 77/77 probe, browser 5/5).** Verdict phase tetap dinaikkan/diputuskan oleh gate Y10, bukan di sini. Tidak ditemukan bug baru pada kode Y04; tidak ada perubahan kode.

**Isolasi.** DB `y49_clone` (`pg_dump diskuk | psql`), container sementara `y49-directus` di `127.0.0.1:8255` memakai image `diskuk-operasional-e2e-directus:latest` dengan extension + migrasi SAAT INI (bind-mount read-only dari salinan scratch, mode 0644, `program`/`authentication`/`analytics` dibangun ulang dari sumber terkini) sehingga migrasi `20260928A–H` ikut terterap pada klon. Captcha `/auth/login` dimatikan hanya di container klon; storage `local` (bukan MinIO bersama). Web = `nuxt dev` dari salinan scratch `apps/web` di `127.0.0.1:3255` dengan `PANEL_URL` ke klon (tanpa rebuild image web bersama). Klon-only: password argon2 dikenal untuk semua user, plus user `y49_umkm6` (usaha 6 talent_pool), `y49_umkm2` (Sumedang), `y49_kab_sumedang` (kota 2). Cleanup: container, DB, direktori scratch, proses nuxt dihapus; DB `diskuk` dibaca ulang: `talent_passport`=0, `konsultasi_tiket`=12, migrasi maks `20260927B`, `produk`=2 (tidak berubah).

Bukti mentah: `stage_1/artifacts/Y04-Y09/` (`y04.mjs` + `y04-run.log` + `y04-results.json`, spec `y49.real.spec.ts` + `playwright.y49.config.ts` + `browser-run.log`, screenshot `y04-browser-*.png`, `y04-qr-download.png`, PDF QR + rasternya).

### API (Directus klon, HTTP nyata + readback SQL)

| Probe | Hasil |
| --- | --- |
| umkm unggah foto ke folder "Katalog Kurasi" → `POST /katalog/produk` | 201, `menunggu`; `/assets/<foto>` anonim 403 sebelum kurasi |
| IDOR produk: umkm lain merujuk foto milik pemilik A / membuat produk untuk usaha A / PATCH produk A / list produk usaha A | 403 / 403 / 403 / 403 |
| self-approve umkm, kabkota `GET /kurasi` | 403 / 403; proxy `/katalog/foto` umkm lain 403/404, kurator 200 `image/png` |
| Kurasi: tolak tanpa catatan → 400 `CATATAN_WAJIB`; tolak+catatan → SQL `ditolak|catatan`, foto tetap di folder kurasi; tayang → SQL `tayang`, `dikurasi_oleh` terisi, foto pindah ke folder publik; `/assets` anonim 200; produk muncul di `/items/produk` publik | lulus |
| Issue passport: umkm / kabkota Subang / kabkota Sumedang 403, anonim 401; usaha non-talent 409 `PASSPORT_BELUM_MEMENUHI`; usaha champion dengan pengajuan hanya `dinilai` 409; UUID rusak 400; 0 baris dibuat oleh panggilan yang ditolak | lulus |
| Provinsi issue usaha talent_pool | 201, kode `TP…`, `qrTalentPassportCode === kode`, `kid` terisi, signature 86 karakter, 1 baris aktif |
| `GET /verify/:kode` anonim | 200 `valid:true aktif`, `publicKey.kid` = kid baris, portofolio memuat produk yang tayang; kode huruf kecil dinormalisasi; scan PII body publik (16 digit, e-mail, telepon, kunci nik/omzet/whatsapp) 0 hit |
| Verifikasi pihak ketiga | hash payload dihitung ulang = `payload_hash`; Ed25519 verify dengan JWK publik = true; pesan diubah = false |
| Kode tak dikenal/format salah/`../../etc/passwd`/`TP0000000000` | 404 semua |
| Tamper (SQL langsung di klon) | ubah `skor.finansial`→99: `valid:false tidak_valid`, payload tidak bocor; payload+hash dihitung ulang penyerang (tanpa kunci): `tidak_valid`; signature diubah 1 karakter: `tidak_valid`; `kid` diganti: `tidak_valid`; setelah dipulihkan: `valid:true` lagi; signature dari passport lain ditempel: `tidak_valid` (bukan `dicabut`) |
| Konkurensi issue | 6 `POST` paralel → 201 ×6, SQL: tepat 1 aktif, 7 baris total (6 dicabut), kode lama berstatus `dicabut` |
| Cabut | umkm 403, kabkota 403, anonim 401, id tak dikenal 404, provinsi 200, cabut kedua 404; verify → `valid:false dicabut` + `dicabutAt`; state pemilik `passport:null`; terbit ulang 201 |
| Badge jujur | `pdn_terverifikasi=true` + terbit ulang → badge `pdn:true` (tanpa `pdn_deklarasi`); flag dimatikan + terbit ulang → hanya `pdn_deklarasi:false` |

### Browser (Playwright chromium, real API klon, 5/5 pass, log `browser-run.log`)

| Langkah | Bukti |
| --- | --- |
| umkm login (altcha widget nyata) → tambah produk, unggah foto PNG nyata, "Ajukan ke Kurasi" | banner sukses; SQL `menunggu`, foto di folder kurasi `…2f11` |
| provinsi buka `/dashboard/katalog/kurasi`, "Tayangkan" | banner "Madu Browser Y49: Tayang."; SQL `tayang`, foto pindah ke `…2f10` |
| provinsi klik "Terbitkan Talent Passport" di UI | kode `TP…` tampil, badge `pdn_deklarasi` `data-terverifikasi=false`, SQL 1 aktif |
| Unduh QR PNG dan QR PDF (dirasterkan dengan `sips`, di-decode dengan jsQR) | kedua isi QR = `http://127.0.0.1:3255/passport/<kode>` (parse konten QR terbukti; PDF `%PDF-`) |
| Halaman publik dari konteks anonim (tanpa sesi) yang dibuka dari URL hasil decode | "Tanda tangan digital DISKUK Jawa Barat valid"; setelah tamper SQL → "Talent Passport tidak valid"; setelah cabut lewat tombol UI "Cabut passport" → "Talent Passport sudah dicabut" |

### Belum terbukti / catatan

- Foto dan berkas hanya diuji dengan storage `local` di klon (bukan MinIO/S3 bersama); perilaku S3 tidak diuji ulang di sini.
- QR di-decode dari raster (PNG dan PDF); pemindaian kamera fisik/ponsel tidak diuji.
- Legalitas tanpa berkas → badge belum-terverifikasi hanya tercakup unit test (bukan diprobe runtime pada klon).
- Rotasi kunci (`PASSPORT_SIGNING_PRIVATE_KEY_PREVIOUS_B64`) tidak diuji runtime; unit test tetap satu-satunya bukti.
- Web diuji sebagai `nuxt dev` dari sumber terkini, bukan image web produksi.
- Scope guard `check --phase Y04` masih perlu dijalankan penerima berikutnya (butir 4 daftar lama).
- Ringkasan test lokal: `node --test services/directus/extensions/program/test/*.test.js` 162/162; `node --test services/directus/test/*.test.mjs` 51 pass, 3 skip, 0 fail.
