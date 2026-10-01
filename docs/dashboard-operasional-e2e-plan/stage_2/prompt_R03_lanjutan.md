# Prompt lanjutan R03 — Pendaftaran kegiatan, e-pass/sertifikat, fasilitasi bantuan

> Salin seluruh isi dokumen ini sebagai prompt untuk sesi agen berikutnya.
> Tanggal sesi sebelumnya: 28 September 2026 (malam). Verdict R03 saat ini: **belum** `partial`/`done` resmi —
> belum ada receipt; gate Y10 masih `blocked`.

## Konteks dan batas

- Repo: `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`, branch `main`, **working tree kotor berisi pekerjaan paralel R01/R02** (demo role, SSO simulasi, halaman investor, endpoint `executive`, dll). Jangan revert, reset, atau memindahkan perubahan itu. Selalu `git status --short --branch` dulu.
- Baca sebelum bekerja: `docs/dashboard-operasional-e2e-plan/main_plan.md`, `stage_2/phase_R03_events_aid.md`, `stage_2/receipt_R02_executive_investor.md` (pola isolasi clone + format bukti), `stage_1/receipt_Y10_acceptance.md` (gate), `stage_1/architecture_review_fixes.md` §2.0/§2.0b, dan `docs/dashboard-operasional-e2e-plan/scope_manifest.json` → `phases.R03`.
- **Gate:** Y10 `blocked`; R03 hanya boleh berakhir `partial`. Jangan menulis klaim `done`, jangan membuka R05, jangan mengubah requirement. Bukti runtime wajib berasal dari stack disposable/clone, bukan database atau container utama yang dipakai agen paralel.
- Jangan menyentuh `.env` nyata, production, atau menjalankan `scripts/seed-dummy-operasional.sql` / cleanup tanpa instruksi pengguna.
- Konvensi wajib: setiap route baru lewat `terjaga()`/`publik()` dari `services/directus/analytics-shared/cakupan.cjs`; PII (NIK) tidak boleh muncul di respons/ekspor/log; migrasi baru memakai nomor berikutnya setelah `20260928G`; jangan menamai ulang migrasi yang sudah terapan.

## Yang sudah dikerjakan sesi sebelumnya (uncommitted, unit test hijau)

**Manifest:** `scope_manifest.json` → `phases.R03` sudah ditulis ulang ke jalur kanonik pasca-`790559b`. Entri lama pra-merge (BFF `apps/web/server/api/publik/*`, `directus-extension-operasional/src/{bantuan,registrasi,sertifikat}-service.js`, migrasi `20260926N/O`) dihapus karena basi. Entry web yang dulu tercantum (`(public)/fasilitasi.vue`, `(public)/kegiatan/[id].vue`, `(private)/dashboard/kegiatan/index.vue`, spec e2e, `mock-directus.mjs`) **belum dikerjakan dan sudah tidak ada di manifest** — tambahkan kembali dengan path final saat mengerjakan web.

**Migrasi** `services/directus/migrations/20260928G-kegiatan-registrasi-bantuan.js` (224 baris, `node --check` hijau, belum diterapkan ke DB mana pun):
- kolom `kegiatan`: `pendaftaran_internal`, `butuh_pakta_integritas`, `jumlah_sesi` (1–60), `butuh_tugas`;
- `kegiatan_pendaftaran` (status `menunggu/diterima/ditolak/daftar_tunggu/batal`, `skor_talent`, `pakta_integritas`, `consent`, `butuh_disabilitas`, `kebutuhan_aksesibilitas`, `epass_token` unik, `tugas_selesai`, partial unique `ux_kegiatan_pendaftaran_aktif` pada status aktif → daftar ulang setelah batal/tolak boleh);
- `kegiatan_presensi` (UNIQUE `(pendaftaran, sesi_ke)` = idempotensi scan);
- `kegiatan_keputusan_audit` (status_dari/ke, skor, alasan, aktor, waktu);
- `kegiatan_sertifikat` (kode unik `SK+10`, `payload_hash`, `signature`, `kid`, status `aktif/dicabut`; partial unique satu aktif per pendaftaran);
- `kegiatan_sertifikat_dampak` (atribut `bukti_pelatihan_manajemen`, capaian `peningkatan_kapasitas_sdm`, `aktif`, `sumber`, `versi`) — dicabut ⇒ `aktif = FALSE`;
- `kegiatan_notifikasi` (outbox WA, `idempotency_key` unik, status `pending/mengirim/terkirim/diterima/gagal/batal`);
- `bantuan_fasilitasi` + seed 8 bentuk berstatus `draft`;
- entri `directus_collections`/`directus_relations`; `down` membalik semuanya (kolom + drop tabel). **Tanpa grant Public.**

**Endpoint** `src/endpoints/registrasi/` (`index.js`, `service.js`, `rules.js`, `xlsx.js`, `zip.js`) dan `src/endpoints/fasilitasi/` (`index.js`, `service.js`), didaftarkan di `extensions/program/package.json` sebagai `v1/program/registrasi` dan `v1/program/fasilitasi` (entri `executive` milik sesi R02 dipertahankan).

Rute registrasi (semua bertanda `terjaga`/`publik`):
- `GET /prefill` (umkm; hanya sesi pemilik, bukan oracle NIK/NIB)
- `POST /kegiatan/:id/daftar` (umkm, captcha; tolak 409 `PENDAFTARAN_EKSTERNAL`, 409 `DIBATALKAN`, 409 `DITUTUP`, 422 `TIDAK_ELIGIBLE`, 400 `PAKTA_WAJIB`/`CONSENT_WAJIB`/`AKSESIBILITAS_WAJIB`, 409 `SUDAH_TERDAFTAR`; kuota penuh saat daftar → `daftar_tunggu`; `FOR UPDATE` pada baris kegiatan)
- `GET /kegiatan/:id/saya`, `GET /kegiatan/:id/epass` (hanya `diterima`)
- `GET /kegiatan/:id/pendaftar` + `/pendaftar/xlsx` (staf; kabkota ter-scope `usaha_tabular.kota_id`)
- `POST /pendaftar/:pendaftaranId/keputusan` (diterima/ditolak/daftar_tunggu/batal; `diterima` menolak 409 `KUOTA_PENUH` bila penuh; menulis audit; batal/tolak mempromosikan `daftar_tunggu` tertua; WA e-pass diantrekan hanya bila `whatsappConfigured(env)`)
- `POST /pendaftar/:pendaftaranId/tugas`, `POST /pendaftar/:pendaftaranId/sertifikat` (butuh ≥80% hadir + tugas; idempotent satu aktif; menulis dampak dua indikator dalam satu transaksi)
- `POST /sertifikat/:sertifikatId/cabut` (dampak `aktif = FALSE`)
- `GET /sertifikat/:kode` (publik; verifikasi ulang `payload_hash` + Ed25519 dari `passport/signing.js`; payload kanonik = versi/kode/kegiatan/pendaftaran/usaha/atribut/capaian)
- `POST /pindai` (butuh `x-operasional-internal-secret`; QR `DISKUK-EPASS:<kegiatan>:<pendaftaran>:<token>`; upsert idempotent per sesi)
- `POST /notifikasi/receipt` (butuh `x-diskuk-secret`/`receiptSecret`)
- `kirimNotifikasi` diekspor dari `registrasi/index.js` tetapi **belum dijalankan otomatis oleh hook/route** — pilih hook `schedule` seperti `kegiatan-pengingat.js` atau route internal ber-secret, lalu buktikan.

Rute fasilitasi: `GET /v1/program/fasilitasi` (publik) mengembalikan 8 kartu `status_publikasi='terbit'`, `sisaKuota`, `serverNow` (countdown dari waktu server), `statusPendaftaran` (`dibuka/segera/ditutup`), `petunjuk`, `kanalResmi`; filter `bentuk` dan `jenis` (uang/barang/jasa) divalidasi 400.

**Tes yang sudah hijau (jalankan ulang untuk memastikan):**
- `node --test services/directus/extensions/program/test/*.test.js` → **167 pass** (registrasi 8, fasilitasi 3, sisanya suite lama).
- `node --test services/directus/extensions/program/test/manifest.test.js` → 3/3 (termasuk entri `executive` milik R02).
- `python3 docs/dashboard-operasional-e2e-plan/check_coverage.py` → OK (35 M, 14 N).
- Diketahui merah **pra-ada** (bukan R03): `node --test services/directus/test/route-manifest.contract.test.mjs` → 2 pass/1 fail pada `operasional|GET|/aspek-perkembangan` (milik pekerjaan paralel; tercatat di receipt Y10).

## Sisa pekerjaan (urut disarankan)

1. **Kontrak & build (manifest R03 sudah mencantumkannya sebagai `modify`):**
   - `pnpm --dir services/directus/extensions/program build` (rebuild `dist/` agar 2 endpoint baru terpaket).
   - `services/directus/test/operasional-schema.contract.test.mjs`: tambahkan assertion migrasi G (nama tabel, partial unique aktif, CHECK status, kolom dampak `aktif/sumber/versi`, `down` membalik).
   - `services/directus/test/route-manifest.contract.test.mjs`: tambahkan rute publik baru ke `DAFTAR_PUBLIK` (`v1/program/fasilitasi|GET|/`, `v1/program/registrasi|GET|/sertifikat/:kode`, `v1/program/registrasi|POST|/pindai`, `v1/program/registrasi|POST|/notifikasi/receipt`) bila ingin eksplisit; jangan perbaiki failure pra-ada milik agen lain.
   - `services/directus/extensions/program/src/oas.yaml`: dokumentasikan rute baru.
2. **Bukti runtime terisolasi (ikuti pola R02):** clone DB (`r03_*`), container Directus sementara dari source terbaru, `migrate:latest` → `migrate:down` → `migrate:latest`; catat SQL readback. **Catatan:** container utama `diskuk-operasional-e2e-directus-1` saat ini memakai image 18 jam yang **belum** memuat endpoint/migrasi baru — bukti harus dari clone/container sementara, jangan mengganggu stack bersama.
3. **N7-01** — buktikan: prefill hanya sesi pemilik; event `registration_url` eksternal → 409 `PENDAFTARAN_EKSTERNAL`; syarat skala/wilayah/NIB 422; pakta bersyarat, consent, aksesibilitas; **dua pendaftar untuk slot terakhir** (satu `menunggu`/`diterima`, kedua → `daftar_tunggu`); daftar ulang 409; kuota ditegakkan server (bukan UI).
4. **N7-02** — buktikan: keputusan + audit; `KUOTA_PENUH` saat menerima di kuota penuh; daftar tunggu naik saat batal; WA: isi `WHATSAPP_GATEWAY_URL` ke mock/sandbox lokal, jalankan dispatcher, simpan **resi** (`provider_message_id`/`provider_status`); tanpa gateway → status jujur `not provider-proven`; **scan QR dua kali** → tetap satu presensi; hadir **79.9%** → terbit ditolak; tugas gagal → ditolak; terbit sertifikat → readback `kegiatan_sertifikat_dampak` (`bukti_pelatihan_manajemen` + `peningkatan_kapasitas_sdm` aktif) **tepat sekali** (retry idempotent); cabut → `aktif=FALSE`, verifikasi publik `dicabut`; XLSX dibuka parser (mis. `unzip -l`, atau `openpyxl` bila ada) dan **tanpa NIK**; role: umkm 403, kabkota hanya kota sendiri.
5. **IP-UMKM:** `permen-aspek.js` (`/panel/operasional/aspek-perkembangan`) belum membaca `kegiatan_sertifikat_dampak`. Putuskan: tambah indikator (mis. "bukti pelatihan manajemen", "peningkatan kapasitas SDM") atau cukup dokumentasikan sumber/versi di receipt. Jangan mengklaim skor resmi Permen.
6. **N7-03 web + N7-01/02 web (belum ada, butuh amendemen manifest):**
   - `apps/web/app/pages/(public)/fasilitasi.vue` — 8 kartu, filter uang/barang/jasa, progress sisa kuota, countdown dari `serverNow` (bukan jam klien), CTA `petunjuk`/`kanalResmi`; tanpa form fiktif.
   - Form pendaftaran + e-pass + halaman panitia — mis. `(public)/kegiatan/[id].vue` dan `(private)/dashboard/kegiatan/index.vue` (daftar pendaftar, keputusan, ekspor XLSX, scan QR). Pakai komponen/pola yang ada (`kegiatan.vue`, klinik, `AuthCaptcha`), tipe di `apps/web/app/types/program.ts`, helper `apps/web/app/lib/*`, fixture `apps/web/tests/fixtures/`, spec e2e (`registrasi-kegiatan.spec.ts`, `fasilitasi.spec.ts`). Jalankan `pnpm --dir apps/web typecheck` + e2e mock; browser real-API hanya bila web disposable tersedia.
7. **Dokumen:** tambahkan "Addendum implementasi 28/29 September 2026" di `phase_R03_events_aid.md` (kontrak aktif) dan tulis `receipt_R03_events_aid.md` dengan verdict **`partial`**, bukti per N7-01…N7-03, perintah+exit code, artefak, dan sisa gate (Y10 `blocked`).
8. **Penutup:** `python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check --snapshot /tmp/operasional-R03-scope.json --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json --phase R03` (snapshot sesi sebelumnya sudah ada; path "outside" milik agen paralel jangan disentuh), `check_coverage.py`, seluruh suite program + contract test; catat semuanya di receipt.

## Keputusan yang wajib diambil (jangan diasumsikan)

1. **Batas ekspor XLSX.** Teks fase: "dibatasi admin". Implementasi sekarang: `terjaga({peran:["provinsi","kabkota"]})` dengan kabkota ter-scope kota sendiri. Konfirmasi ke pengguna bila ingin diperketat jadi provinsi saja.
2. **Pemicu dispatcher WA e-pass** (`kirimNotifikasi`): hook `schedule` (pola `kegiatan-pengingat.js`) atau route internal ber-secret + `epass_dikirim_pada` diisi saat kirim sukses.
3. **Permukaan pendaftaran internal di agenda publik:** event `pendaftaran_internal=true` sebaiknya mengganti CTA "Daftar Sekarang" (sekarang mengarah ke `registration_url` bila ada) menjadi form internal; event eksternal tetap memakai URL resmi — jangan mengubah sejarah.
4. **Indikator IP-UMKM** (butir 5 di atas): tambah indikator di `permen-aspek.js` atau dokumentasikan saja.
5. **`terisi` pada `bantuan_fasilitasi`** belum ada alur yang menaikkannya; putuskan apakah di luar R03 atau perlu aksi kurasi.

## Perintah cepat & lingkungan

- Stack disposable berjalan: Directus `127.0.0.1:8055`, web `127.0.0.1:3000`, PostGIS `127.0.0.1:15432`, Mailpit `127.0.0.1:8025` (`docker ps | grep diskuk-operasional-e2e`). Image Directus yang berjalan **belum** memuat kode R03.
- Verifikasi cepat sesi ini: `node --test services/directus/extensions/program/test/*.test.js` (167 pass), `node --test services/directus/extensions/program/test/manifest.test.js` (3/3), `check_coverage.py` (OK), `docker compose --env-file .env.example config --quiet` (exit 0).
- Jebakan yang sudah ditemukan sesi ini: (a) `git checkout` satu file bisa menghapus pekerjaan agen paralel — jangan pakai tanpa memeriksa diff dulu; (b) entri `executive` di `program/package.json` milik sesi R02 harus dipertahankan; (c) guard `42P01` di `hooks/kegiatan-pengingat.js` adalah perubahan yang sudah ada sebelum sesi R03 — jangan dihapus.
