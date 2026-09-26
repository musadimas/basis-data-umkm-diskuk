# Phase 11 — Talent Passport, QR bertanda tangan Ed25519, radar scorecard, badge, showroom, dan verifikasi publik

## Objective, dependencies, observable result

- **Dependency:** Phase 7 (tahap program), Phase 10 (produk).
- **Objective:** Talent Passport lengkap sesuai Modul 6 bagian 1: kartu identitas digital dengan badge status akselerasi, QR dinamis ber-kode unik (`passport_kode`) yang dapat disimpan sebagai gambar, tombol verifikasi tanda tangan kriptografis (Ed25519), radar chart 5 dimensi, lencana akreditasi (PDN, Siap Naik Kelas, legalitas), showroom Digital Twin (galeri foto, video, tab spesifikasi teknis), dan halaman verifikasi publik `/verifikasi/<kode>`. Unduhan PDF menyusul di Phase 12.
- **Observable result:** Wawan membuka `/dashboard/usaha/passport` → kartu "Fase Accelerator — Batch 1", QR, radar, badge "100% Produk Dalam Negeri (PDN) Terverifikasi" dan "Tahapan Perkembangan: Siap Naik Kelas"; klik "Verifikasi Tanda Tangan" → "Tanda tangan kriptografis valid"; memindai/membuka URL QR tanpa login menampilkan kartu publik tervalidasi.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-11-before.json
```

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `services/directus/migrations/20260926H-add-passport-kode.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/passport-signature.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/passport-scorecard.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/passport-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/talenta-service.js` |
| modify | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/passport-signature.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/passport-scorecard.test.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/test/passport-service.test.cjs` |
| modify | `services/directus/extensions/directus-extension-operasional/test/talenta-service.test.cjs` |
| modify | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `docker-compose.yml` |
| modify | `.env.example` |
| modify | `scripts/seed-dummy-operasional.sql` |
| modify | `apps/web/package.json` |
| modify | `apps/web/pnpm-lock.yaml` |
| create | `apps/web/server/api/publik/passport/[kode].get.ts` |
| create | `apps/web/app/components/operasional/PassportQr.vue` |
| create | `apps/web/app/components/operasional/RadarScorecard.vue` |
| create | `apps/web/app/components/operasional/TalentPassportView.vue` |
| create | `apps/web/app/pages/(private)/dashboard/usaha/passport.vue` |
| create | `apps/web/app/pages/(private)/dashboard/talenta/passport/[talentaId].vue` |
| modify | `apps/web/app/pages/(private)/dashboard/talenta/[id].vue` |
| create | `apps/web/app/pages/(public)/verifikasi/[kode].vue` |
| modify | `apps/web/app/types/operasional.ts` |
| modify | `apps/web/app/constants/NAVIGATION.ts` |
| modify | `apps/web/tests/fixtures/mock-directus.mjs` |
| modify | `apps/web/tests/fixtures/mock-directus-server.mjs` |
| create | `apps/web/tests/e2e/passport.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

## Exact symbols and search anchors

- `services/directus/extensions/directus-extension-operasional/src/talenta-service.js::terbitkanBeritaAcara` (update status `scouting`)
- `services/directus/extensions/directus-extension-operasional/src/permen-aspek.js::skorPermen`
- `apps/web/server/utils/directus-session-login.ts::directusTarget`
- `apps/web/app/lib/video-embed.ts::videoEmbed`; `apps/web/app/components/ui/carousel/index.ts`
- `apps/web/app/middleware/auth.global.ts` (hanya `/dashboard*` dilindungi → `/verifikasi/*` publik)
- `uqr@0.1.3` API: `encode(text, { border })` → `{ size, data: boolean[][] }` (terverifikasi saat perencanaan: `encode('https://x.test/verifikasi/abc').size === 27`).

```bash
rg -n "function terbitkanBeritaAcara|'scouting'" services/directus/extensions/directus-extension-operasional/src/talenta-service.js
rg -n "function skorPermen" services/directus/extensions/directus-extension-operasional/src/permen-aspek.js
rg -n "export function directusTarget" apps/web/server/utils/directus-session-login.ts
rg -n "export function videoEmbed" apps/web/app/lib/video-embed.ts
rg -n 'to.path === "/dashboard" \|\| to.path.startsWith\("/dashboard/"\)' apps/web/app/middleware/auth.global.ts
```

## Current contract and final desired contract

### Current

Talenta tanpa identitas digital; tidak ada kunci tanda tangan; tidak ada halaman publik verifikasi.

### Final

- Migrasi `20260926H`: `ALTER TABLE talenta ADD COLUMN IF NOT EXISTS passport_kode TEXT UNIQUE CHECK (passport_kode ~ '^[0-9a-f]{32}$')`; backfill `UPDATE talenta SET passport_kode = replace(gen_random_uuid()::text, '-', '') WHERE passport_kode IS NULL AND status IN ('scouting','talent_lab','accelerator','champion')`; `down` drop kolom.
- `talenta-service.js::terbitkanBeritaAcara` juga mengisi `passport_kode = replace(gen_random_uuid()::text,'-','')` untuk talenta yang dipindah ke `scouting` bila masih null.
- `passport-signature.js` (murni, `node:crypto`):
  - `loadSigningKey(env)` → `crypto.createPrivateKey(Buffer.from(env.PASSPORT_SIGNING_PRIVATE_KEY_B64, "base64").toString("utf8"))`; env kosong, gagal parse, atau `asymmetricKeyType !== "ed25519"` → `null`.
  - `canonicalJson(value)` → JSON dengan kunci objek terurut rekursif, tanpa spasi.
  - `signPayload(payload, key)` → `crypto.sign(null, Buffer.from(canonicalJson(payload)), key).toString("base64url")`.
  - `verifyPayload(payload, signature, publicKey)` → `crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature, "base64url"))` (signature tidak valid → false, tanpa throw).
  - `publicKeyInfo(key)` → `{ jwk: crypto.createPublicKey(key).export({ format: "jwk" }), sidikJari: sha256(jwk.x) hex 16 char pertama }`.
- `passport-scorecard.js` (murni):
  - `RADAR_DIMENSI` label: "Model Bisnis & Diferensiasi Produk", "Kapasitas Manajemen Keuangan & Profitabilitas", "Kesiapan Legalitas, Tata Kelola & SOP", "Kesiapan Digitalisasi & Akses Pasar PMSE", "Potensi Eskalasi & Dampak Rantai Pasok/TKDN".
  - `hitungRadar({ skorFinansial, skorPasar, skorLegalitas, atribut, jumlahProdukLayak, rataBahanLokal })` → 5 nilai 0–100 (2 desimal) menurut ledger main plan §4 (null = false/0; `rataBahanLokal` null → 0).
  - `hitungBadges({ nibAda, atribut, terverifikasi, skorPermen, produkLayak, status, batchNama })` → array `{ key, label, terverifikasi }`: `status` ("UMKM Champion Jawa Barat — {batch}" bila champion, selain itu "Fase {label status} — {batch}"; tanpa batch → tanpa sufiks); `pdn` "100% Produk Dalam Negeri (PDN) Terverifikasi (Permen No. 3/2026)" bila ≥1 produk layak dan semua produk layak `bahan_baku_lokal_persen = 100`; `naik_kelas` "Tahapan Perkembangan: Siap Naik Kelas (Skor > 75% Permen No. 2/2026)" bila `skorPermen > 75`; `nib` "NIB Terverifikasi OSS-RBA" bila `nibAda`; `halal` "Sertifikat Halal" bila `sertifikat_halal`; `pirt_bpom` "PIRT/BPOM" bila `pirt_bpom`; `hki` "Hak Merek (HKI)" bila `hki_merek`; `terverifikasi` = atribut sudah diverifikasi dinas (`terverifikasi_pada` tidak null) untuk badge halal/pirt/hki, `true` untuk nib.
  - "Produk layak" = produk `status_kurasi IN ('tayang','rekomendasi_marketplace')`.
- `passport-service.js`:
  - `STATUS_PASSPORT = ["scouting","talent_lab","accelerator","champion"]`.
  - `bangunPassport(database, talentaId)` → muat talenta + usaha + atribut + batch + BA + produk layak (dengan foto dan spesifikasi); payload bertanda tangan `{ v: 1, kode, usahaId, namaUsaha, kota, nibTersamar (2 digit awal + "*********" + 2 digit akhir; null bila tanpa NIB), status, statusLabel, batch, skorTalentIndex, tanggalBeritaAcara (YYYY-MM-DD | null), badges: [key…], ditandatanganiPada: ISO }`; kunci null → `OperasionalError(503, "PASSPORT_SIGNING_UNAVAILABLE")`.
  - Response lengkap `{ data: { payload, signature, publicKey: { jwk, sidikJari }, verifikasiPath: "/verifikasi/<kode>", usaha: { id, nama, pemilik, kota, skala }, skor: { finansial, pasar, legalitas, sdm, total }, radar: [{ key, label, nilai }], badges: [...], showroom: [{ id, nama, kategori, deskripsi, hargaRetail, hargaGrosir, moq, videoUrl, bahanBakuLokalPersen, spesifikasi: { dimensi, beratBersih, masaSimpan, bahanBakuUtama, kapasitasPasokanBulanan, sertifikasiUjiLab }, foto: [berkasId…] }] } }`.
  - `getPassportSaya(database, operator)` (umkm) → talenta usaha sendiri berstatus `STATUS_PASSPORT`; tidak ada → 404 `PASSPORT_BELUM_TERSEDIA`.
  - `getPassportTalenta(database, talentaId, operator)` (DATA_ROLES, kabkota `talenta.kota`).
  - `getPassportPublik(database, kode)` (tanpa autentikasi) → `kode` `/^[0-9a-f]{32}$/` (selain itu 404); response `{ data: { payload, signature, publicKey, valid: verifyPayload(...) } }` — **tanpa** showroom, foto, pemilik, atau data SIDT lain.
  - Routes: `GET /passport`, `GET /passport/talenta/:talentaId`, `GET /publik/passport/:kode` (tidak memanggil `requireRole`).
- Env: `docker-compose.yml` service `directus.environment` tambah `PASSPORT_SIGNING_PRIVATE_KEY_B64: ${PASSPORT_SIGNING_PRIVATE_KEY_B64:-}`; `.env.example` tambah `# Ed25519 PEM (base64 satu baris): openssl genpkey -algorithm ed25519 | base64 | tr -d '\n'` dan `PASSPORT_SIGNING_PRIVATE_KEY_B64=` (kosong).
- Web:
  - Dependency `uqr` (`pnpm --dir apps/web add uqr@0.1.3`).
  - `server/api/publik/passport/[kode].get.ts`: validasi `kode` regex; `fetch(`${base}${prefix}/operasional/publik/passport/${kode}`)` memakai `directusTarget()`; teruskan status 200/404/503 dan body JSON; header `Cache-Control: no-store`. Mode passthrough (`NUXT_DIRECTUS_PROXY_TARGET`) tidak didukung untuk route publik ini (dicatat).
  - `PassportQr.vue`: props `value`, `nama`; `encode(value, { border: 2 })` → satu `<path>` SVG (`M{x} {y}h1v1h-1z` per modul gelap) dalam `<svg role="img" :aria-label="'QR Talent Passport ' + nama" viewBox="0 0 size size" shape-rendering="crispEdges">`; tombol "Simpan QR sebagai Gambar" → serialisasi SVG (`XMLSerializer`) → `Image` → canvas 512×512 → `toBlob("image/png")` → unduh `talent-passport-qr-<kode>.png`.
  - `RadarScorecard.vue`: props `radar`; SVG 320×320, 5 sumbu, cincin 25/50/75/100, poligon `fill-amber-400/40 stroke-amber-600`, label sumbu dan nilai; tabel `sr-only`.
  - `TalentPassportView.vue` (dipakai 2 halaman): props `passport`; kartu identitas (logo DISKUK, nama usaha, pemilik, kota, badge status), `PassportQr` (value = `window.location.origin + verifikasiPath`), tombol "Verifikasi Tanda Tangan Kriptografis" → `$fetch("/api/publik/passport/<kode>")` → hasil `valid` true: panel hijau "Tanda tangan kriptografis valid — data terikat dengan basis data resmi DISKUK Jabar & SIDT." + "Sidik jari kunci publik: {sidikJari}"; false/404: panel merah "Tanda tangan tidak valid."; `RadarScorecard` berjudul "Business Scorecard (5 Dimensi Penilaian Bank Indonesia)"; daftar badge (warna: pdn `bg-gradient-to-r from-emerald-500 to-amber-400 text-white`, naik_kelas `bg-sky-600 text-white`, legalitas `bg-emerald-600 text-white`, status `bg-amber-400 text-amber-950`; badge belum diverifikasi dinas diberi sufiks " (deklarasi)"); bagian "Showroom Digital Twin": per produk carousel foto (`ui/carousel`, `berkasUrl`), video (`videoEmbed`: iframe youtube-nocookie `allow="encrypted-media; picture-in-picture"` `referrerpolicy="strict-origin-when-cross-origin"`, `<video controls>` untuk file, tautan untuk lainnya; null → "Video profil belum tersedia"), tab "Deskripsi" / "Spesifikasi Teknis" (dimensi, bahan baku lokal, kapasitas pasokan bulanan, sertifikasi uji laboratorium); slot `#aksi` untuk tombol unduh (Phase 12).
  - `usaha/passport.vue` (layout `umkm`): `GET /panel/operasional/passport` → `TalentPassportView`; 404 → "Talent Passport tersedia setelah usaha Anda masuk Talent Pool."; 503 → "Layanan tanda tangan passport belum dikonfigurasi.".
  - `talenta/passport/[talentaId].vue` (layout `dashboard`, provinsi/kabkota) → `GET /panel/operasional/passport/talenta/:id` → `TalentPassportView`.
  - `talenta/[id].vue`: tombol "Lihat Talent Passport" (status di `STATUS_PASSPORT`) → `/dashboard/talenta/passport/<id>`.
  - `(public)/verifikasi/[kode].vue` (layout `landing`): `useFetch("/api/publik/passport/<kode>")`; kartu publik: nama usaha, kota, badge status, skor Talent Index, batch, tanggal Berita Acara, badge (label dari payload `badges` key → label lokal), banner validasi (hijau "Tanda tangan kriptografis valid" / merah "Passport tidak ditemukan atau tanda tangan tidak valid"), sidik jari kunci, teks "Diterbitkan oleh Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat"; `useSeoMeta({ robots: "noindex" })`.
  - `NAVIGATION_LINKS.umkm` tambah `{ id: "passport", label: "Passport", to: "/dashboard/usaha/passport", icon: IdCard }` (urutan akhir tab UMKM: Beranda, Passport, Laporan KPI, Produk).
- Seed: di akhir `.sql` `UPDATE talenta SET passport_kode = replace(gen_random_uuid()::text,'-','') WHERE passport_kode IS NULL AND status IN ('scouting','talent_lab','accelerator','champion');` (baris dummy terhapus via cascade usaha).

## Ordered edits

1. Migrasi + kontrak test (kolom, CHECK regex, backfill hanya status passport).
2. `passport-signature.js` + test: kunci dibangkitkan di test (`crypto.generateKeyPairSync("ed25519")`, ekspor PEM, base64) → sign/verify true; payload diubah satu field → false; urutan kunci berbeda → signature sama (kanonik); env kosong/RSA key → `loadSigningKey` null; signature rusak → false tanpa throw.
3. `passport-scorecard.js` + test: data Wawan (atribut Phase 4, skor talenta Phase 6 01, 2 produk layak bahan lokal 100, 100; produk menunggu 85% diabaikan) → radar berurutan `[86.67, 100, 100, 100, 100]` (Model Bisnis = 40×min(2/3,1)+30+30 = 86.67; Keuangan = 100; Legalitas & SOP = (100+50+50)/2 = 100; Digitalisasi = 100; Eskalasi = 40+30+30 = 100); badges memuat `pdn`, `naik_kelas` (skorPermen 100), `nib`, `halal`, `pirt_bpom`, `hki` dengan `terverifikasi: true`; usaha 02 (produk layak 100% tetapi hki false) → tanpa `hki`; tanpa produk layak → tanpa `pdn`.
4. `passport-service.js` + routes + test (umkm tanpa talenta → 404; umkm talenta `diajukan` → 404; kabkota talenta kota lain → 404; kunci tidak ada → 503; publik kode salah format → 404; publik tidak memuat `showroom`/`usaha.pemilik`; nibTersamar `99*********01`).
5. `talenta-service.js` BA mengisi `passport_kode` + update test.
6. Env compose/.env.example; seed.
7. Web: dependency `uqr`, server route publik, komponen, halaman, tipe (`TalentPassport`, `PassportPublik`), NAVIGATION.
8. Fixtures: `mock-directus.mjs` route `/panel/operasional/passport` dan `/panel/operasional/passport/talenta/:id` (payload contoh, radar, badges, 1 produk showroom dengan 2 foto); browser route `/api/publik/passport/*` **tidak** di-mock di browser (dilayani server Nuxt) — `mock-directus-server.mjs` menjawab `GET /operasional/publik/passport/0123456789abcdef0123456789abcdef` → `{ data: { payload: {...}, signature: "sig", publicKey: { jwk: {...}, sidikJari: "a1b2c3d4e5f60718" }, valid: true } }` dan kode lain → 404.
9. `passport.spec.ts`: umkm (chromium + mobile) → kartu, QR `svg path` ada, radar 5 label, badge PDN; klik "Verifikasi Tanda Tangan Kriptografis" → panel valid + sidik jari `a1b2c3d4e5f60718`; "Simpan QR sebagai Gambar" → event download berakhiran `.png`; screenshot `passport-umkm.png`; halaman publik `/verifikasi/0123456789abcdef0123456789abcdef` tanpa login → "Tanda tangan kriptografis valid", screenshot `verifikasi-publik.png`; kode lain → pesan tidak ditemukan; provinsi `/dashboard/talenta/passport/<id>` tampil.
10. `operasional.directus.spec.ts`: Wawan → passport → verifikasi valid; buka `verifikasiPath` di context browser baru tanpa cookie → valid; ubah satu huruf kode → tidak ditemukan.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Talenta turun ke `ditolak` tidak mungkin dari status passport (transisi Phase 6/7 mencegah) → kode tetap berlaku.
- Kunci diganti (rotasi) → signature lama tidak lagi diverifikasi, tetapi setiap permintaan menandatangani ulang dengan kunci baru → verifikasi tetap valid (dicatat: tidak ada histori tanda tangan).
- Produk ditayangkan belakangan → badge/radar berubah pada permintaan berikutnya.
- Halaman publik tidak pernah menampilkan pemilik, NIK, telepon, foto.
- Pemindaian QR di browser lain tanpa sesi → tidak dialihkan ke `/sign-in`.
- 503 kunci hilang → UI pesan konfigurasi, tanpa stack trace.

## Validation commands

```bash
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus test
pnpm lint:oxlint
docker compose --env-file .env.example config --quiet
pnpm --dir apps/web install --frozen-lockfile
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
(cd apps/web && pnpm exec eslint --max-warnings 0 "server/api/publik/passport/[kode].get.ts" app/components/operasional/PassportQr.vue app/components/operasional/RadarScorecard.vue app/components/operasional/TalentPassportView.vue "app/pages/(private)/dashboard/usaha/passport.vue" "app/pages/(private)/dashboard/talenta/passport/[talentaId].vue" "app/pages/(private)/dashboard/talenta/[id].vue" "app/pages/(public)/verifikasi/[kode].vue" app/types/operasional.ts app/constants/NAVIGATION.ts)
(cd apps/web && pnpm exec playwright test --project=chromium)
(cd apps/web && pnpm exec playwright test tests/e2e/passport.spec.ts --project=mobile)
pnpm --dir apps/web build
```

Expected: semua exit 0; lockfile konsisten (`--frozen-lockfile` sukses); screenshot `passport-umkm.png`, `verifikasi-publik.png`.

## Runtime/provider proof and unproven boundary

Disposable stack dengan `PASSPORT_SIGNING_PRIVATE_KEY_B64` terisi (prosedur §7) + seed; jalankan `operasional.directus.spec.ts`; `curl -s http://127.0.0.1:3000/api/publik/passport/<kode dari DB> | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["valid"])'` → `True`. Bila Docker tidak tersedia: `not runtime-proven` — yang tidak terbukti: pemindaian QR dengan kamera ponsel, embed YouTube, verifikasi independen di luar server (tidak disediakan).

## No-advance condition

Jangan lanjut bila endpoint publik membocorkan data di luar payload yang ditetapkan, atau signature tetap valid setelah payload diubah.

## Required failure probes

- Unit: payload dimodifikasi → `verifyPayload` false.
- Unit: kunci hilang → 503.
- E2E: kode tidak dikenal → halaman publik "tidak ditemukan".

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak.

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-11-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 11
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit (termasuk dependency `uqr`); `down` migrasi `20260926H` menghapus `passport_kode` (QR lama tidak lagi valid). Handoff: `bangunPassport` dan slot `#aksi` `TalentPassportView` dipakai Phase 12 untuk PDF; badge/label status dipakai popup peta Phase 13.
