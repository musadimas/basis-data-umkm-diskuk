# UI_audit.md — Rencana Perbaikan Konsistensi UI (siap eksekusi E2E)

> Basis audit: commit `579b667`, 29 September 2026. Seluruh path relatif terhadap
> `apps/web/` kecuali disebut lain. Nomor baris adalah **snapshot** — selalu baca file
> dan cari konteksnya sebelum mengedit; jangan blind-edit berdasar nomor baris.

Dokumen ini hasil audit konsistensi UI penuh (40 halaman + ~60 komponen fitur) dan
ditulis agar **agen lain bisa mengerjakannya end-to-end tanpa konteks percakapan**.
Tulis semua perubahan dalam bahasa Indonesia sesuai glosarium `CONTEXT.md`.

---

## 0. Aturan kerja untuk agen pelaksana

1. **Working tree sedang dipakai sesi lain.** Sebelum mulai, jalankan `git status`.
   Saat audit berlangsung file-file ini sudah modified oleh pihak lain: `.env.example`,
   `app/components/analytics/AnalyticsVisual.client.vue`, `app/pages/(private)/dashboard/index.vue`,
   `nuxt.config.ts`, `tests/e2e/sso-demo.spec.ts`, `docker-compose.yml`, dan dua file di
   `services/directus/extensions/directus-extension-operasional/`. **Jangan ikutkan perubahan
   file-file itu dalam commit audit**; jika temuan audit menyasar file itu, verifikasi dulu
   apakah sudah diperbaiki di versi working tree sebelum mengedit.
2. **Satu paket = satu commit.** Format konvensional: `fix(web): …`, `refactor(web): …`,
   `style(web): …`. Jangan pernah meng-commit `AKUN_DUMMY.md`, `.env.example`,
   `docker-compose.yml`, atau perubahan `services/` yang bukan milikmu.
3. **Lingkup UI saja.** Jangan mengubah kontrak API, endpoint server, aturan otorisasi
   server-side, atau perilaku bisnis. Jika UI perlu data/status yang belum tersedia,
   catat di §9 (Log) dan lanjut — jangan tambah endpoint sendiri.
4. **Pertahankan `data-testid`** dan selector yang dipakai test e2e saat merombak markup.
5. **Verifikasi setiap item** dengan membaca file sebelum edit. Kalau ternyata sudah
   diperbaiki atau temuan tidak akurat, centang dengan catatan di §9.
6. Selesai satu paket: jalankan gerbang verifikasi §8, lalu commit.

---

## 1. Common pattern (spesifikasi "benar" — acuan semua perbaikan)

Halaman & komponen yang **patuh** sebagai rujukan:
`(private)/dashboard/klinik.vue`, `(public)/konsultasi.vue`, `(private)/dashboard/katalog/kurasi.vue`,
`(private)/dashboard/pendampingan/index.vue`, `(private)/dashboard/akun/index.vue`,
`(private)/dashboard/spasial.vue`, `(public)/katalog/[id].vue`.

1. **Halaman privat**: `definePageMeta({ layout: "dashboard" })` + `useSeoMeta({ title: "… – Dashboard UMKM" })`.
2. **Halaman publik**: `definePageMeta({ layout: "landing" })` + header `LandingHeaderMask` + `useSeoMeta` dengan judul spesifik per halaman. Halaman auth memakai `AuthShell` dan **tanpa** `definePageMeta`.
3. **Peran**: selalu dari `auth.user.value?.app_role` (`composables/useAuth.ts`) — BUKAN `user.role` (UUID Directus). Label peran hanya via `appRoleBadge()` / `APP_ROLE_BADGES` (`constants/ROLES.ts`); kunci mentah (`provinsi`, `kabkota`, …) tidak pernah dicetak ke pengguna. Wilayah Admin Kab/Kota terkunci lewat `lockedKotaId()` / `useLockedKota()` dari `constants/ROLES.ts`.
4. **Fetching**: `useDirectus()` + `endpoint<T>()` dari `~/lib/directus` + `useAsyncData` untuk load awal; aksi manual pakai ref `loading/busy` dan tombol `:disabled` saat proses. `useFetch`/`$fetch` mentah = pelanggaran (pengecualian disanksi lihat §2). Error dipetakan via `requestErrorCode`/`requestStatus` (`~/lib/request-error`) ke pesan inline Indonesia — tidak pernah ditelan diam-diam.
5. **UI kit**: shadcn-vue prefix `Ui*` di `app/components/ui/` (UiButton, UiInput, UiSelect, UiCheckbox, UiTextarea, UiTable, UiDialog, UiSheet, UiField, UiSkeleton, UiBadge, …). Form memakai `UiField`/`UiFieldLabel` terikat `for`, bukan placeholder-saja.
6. **Feedback**: inline (ref `pesan`/`message` dengan tone), `role="alert"` untuk gagal, `role="status"` untuk info. **Tidak ada toast.** Status domain pakai `ProgramStatusPill` (`components/program/StatusPill.vue`) + konstanta status di `constants/PROGRAM.ts`.
7. **Aksi destruktif / keputusan ber-alasan**: `UiDialog` + `UiTextarea` alasan bila domain mewajibkan alasan (tolak, cabut outcome), konfirmasi dialog bila tidak. Bukan `window.confirm`/`window.prompt`. Rujukan: `pendampingan/index.vue` (dialog keputusan), `components/klinik/OutcomePanel.vue` (cabut wajib alasan ≥5 karakter).
8. **Copy**: seluruhnya Indonesia, terminologi `CONTEXT.md` (lihat bank copy §6).
9. **Warna**: token tema (`bg-primary`, `text-muted-foreground`, `--brand-blue`, `--brand-green` di `app/assets/css/tailwind.css`). Palet badge peran yang disanksi: `bg-blue-900`/`sky-300`/`emerald-600`/`amber-400` via `appRoleBadge` saja.
10. **Icons** `@lucide/vue`. **A11y dasar**: icon-button ber-`aria-label`, `img` ber-`alt` (`alt=""` untuk dekoratif), dialog ber-Title+Description, heading tidak melompat.

## 2. Pengecualian yang DISANKSI — jangan "diperbaiki"

- Hex literal untuk **chart unovis** dan **paint MapLibre/SVG** (`AnalyticsVisual.client.vue`, `map/Choropleth.client.vue`, `operasional/AtRiskMap.client.vue`) — library-nya menuntut literal. Ekstraksi ke konstanta bersama boleh, mengganti library tidak.
- **Warna brand WhatsApp** `#25D366` di `katalog/[id].vue` dan `components/program/HotlineCard.vue`.
- **`APP_ROLE_BADGES`** di `constants/ROLES.ts` (blue-900/sky-300/emerald-600/amber-400) — satu-satunya palet badge peran.
- **Demo**: `DemoRoleSwitcher` & `DemoKoneksiToggle` sudah terguard `demoMode`; `$fetch("/api/demo/switch")` adalah endpoint Nitro internal demo. Biarkan.
- **SSO** `<a href="/api/auth/sso/start">` di `sign-in.vue` — butuh full-page navigation.
- **Input `type="file"`** tanpa padanan `Ui*` — wajar (kit tidak punya file input); gunakan `program/FileUpload.vue` bila cocok.
- Tab pill kustom dengan `role="tab"` + aria lengkap di halaman landing (`passport/[kode].vue`, `katalog/[id].vue`) — mungkin-wajar.
- `useSeoMeta` tidak ada di `sign-in.vue`, `sso-complete.vue`, `umkm/[id].vue` — pengecualian yang diketahui, boleh dibiarkan.
- **UiTable tidak wajib** untuk migrasi massal: semua tabel repo dibangun `<table>` manual dengan styling konsisten. Migrasi UiTable hanya untuk tabel sederhana (P6, opsional).

---

## 3. P1 — Bug & risiko fungsional (kerjakan pertama)

- [ ] `app/layouts/landing.vue:12` — `<main id="main-content w-dvw! h-dvh!">`: `class` terserap ke `id` (id mengandung spasi) sehingga styling tidak pernah berlaku dan anchor `#main-content` rusak. Pisahkan menjadi `id="main-content" class="w-dvw! h-dvh!"` (cek dulu apakah `w-dvw! h-dvh!` memang dimaksudkan untuk main landing; kalau tujuannya main full-bleed, terapkan sebagai class).
- [ ] `app/pages/(private)/dashboard/usaha/passport.vue` — `cabut()` (cari `async function cabut`) pakai `try/finally` **tanpa `catch`**: gagal jadi unhandled rejection tanpa pesan. Tambah `catch` dengan pesan inline ber-tone seperti `terbitkan()` di file yang sama (pakai `requestErrorCode`).
- [ ] `app/pages/(private)/dashboard/analitik.vue` — `savedApi.load()` dipanggil di setup tanpa penanganan error (`composables/useSavedAnalyses.ts` `load()` hanya try/finally). Kegagalan fetch `analitik_view` bisa mematikan render halaman. Bungkus dengan catch → tampilkan state error inline + tombol coba lagi. Juga pastikan `saveAnalysis`, `removeSaved`, `renameSaved`, `startExport` (di analitik.vue; `useAnalyticsExports.ts` melempar ulang error 401) punya feedback gagal inline, bukan rejection diam.
  - ⚠️ `AnalyticsVisual.client.vue` dan `dashboard/index.vue` sedang dimodifikasi sesi lain — cek dulu versi working tree.
- [ ] `app/pages/(private)/dashboard/kegiatan/index.vue` — `muatDaftar()` punya `catch { pendaftar.value = [] }` (cari `catch {` di `muatDaftar`): gagal muat tampil sebagai "Belum ada pendaftar." Bedakan gagal vs kosong: tambah ref error + pesan "Daftar pendaftar gagal dimuat." + tombol coba. Juga: `useAsyncData("kegiatan:panitia", …)` tidak membaca `error` — bila `/v1/program/kegiatan` gagal, select kegiatan kosong tanpa pesan; tampilkan pesan gagal.
- [ ] `app/pages/(private)/dashboard/kegiatan/index.vue` — `pindai()` tidak punya ref loading; tombol "Catat hadir" (`data-testid="tombol-pindai"`) bisa dobel-klik. Tambah ref `memindai` + `:disabled` + label "Memproses…".
- [ ] `app/pages/(private)/dashboard/talent/kurasi.vue` — tombol **Tolak** per baris hanya dicek `v-if="row.status === 'dinilai' || row.status === 'draft'"` tanpa gate peran, padahal tombol Terbitkan Berita Acara di-gate `isProvinsi`. Tambah `&& isProvinsi` pada v-if Tolak (Admin Kab/Kota tidak boleh melihat aksi keputusan kurasi).
- [ ] `app/components/landing/LandingFooter.vue` — `quickLinks` memuat `/galeri` dan `/hubungi-kami` yang tidak ada (404); `socials` semua `href: "/"`. Hapus/arahkan link mati (lihat keputusan P3-B), sembunyikan sosial sampai ada akun resmi (atau beri `aria-disabled` + title "segera").
- [ ] `app/pages/(private)/dashboard/kegiatan/index.vue` — keputusan pendaftar & sertifikat (Terima/Tolak/Batalkan/Cabut) dieksekusi satu-klik tanpa konfirmasi; terutama "Cabut sertifikat". Beri konfirmasi dialog (pola P4) minimal untuk aksi cabut/batal.

## 4. P2 — Halaman pencilan di luar pola → bawa ke pola

Rujukan gaya saat mengonversi: `(public)/katalog/index.vue` (halaman publik), `akun/index.vue` (form UiField), `katalog/kurasi.vue` (aksi + dialog), `klinik.vue` (fetch + error map).

- [ ] **`app/pages/(public)/investor/index.vue`**
  - Tambah `definePageMeta({ layout: "landing" })` + `LandingHeaderMask` (judul "Direktori Investor") — samakan dengan katalog/index.vue.
  - Ganti `<select>` ×2 → `UiSelect`, `<input>` KBLI → `UiInput` (dengan `UiField`/`UiFieldLabel`), tombol → `UiButton`.
  - Pending "Memuat direktori…" → `UiSkeleton`; tambah empty state daftar.
- [ ] **`app/pages/(public)/investor/[id].vue`**
  - Layout landing + header mask; `useSeoMeta` judul spesifik.
  - Tambah cabang `pending` dan `error` lengkap (sekarang hanya `v-if="error"` dan `v-else-if="data"` — layar kosong saat loading).
  - `<textarea>` → `UiTextarea`, `<button>` → `UiButton` (termasuk tombol unduh PDF).
  - `fetch(\`/panel/v1/program/executive/investor/…\`)` native (cari `credentials: "include"`) → unduh blob lewat `directus.request(endpoint(…))` seperti pola `unduhXlsx()` di `(private)/dashboard/kegiatan/index.vue`; jangan hardcode path `/panel`.
- [ ] **`app/pages/(private)/dashboard/data-lapangan/[id].vue`** — pencilan terparah di dashboard.
  - Load: `useFetch("/panel/operasional/usaha/${id}")` → `useDirectus()` + `endpoint<UsahaLapangan>(…)` + `useAsyncData`.
  - Mutasi: dua `$fetch` (PATCH simpan, POST verifikasi) → `directus.request(endpoint(…, { method, body }))`, error via `requestErrorCode` → pesan inline.
  - Form: 10 `<input>` + 16 `<select>` + tombol raw → `UiInput`/`UiSelect`/`UiButton`/`UiField` (rujukan `akun/index.vue`). Pertahankan perilaku & testid.
  - Banner amber (`border-amber-300 bg-amber-50`) boleh tetap tapi pakai kelas bersama P7.
- [ ] **`app/pages/(private)/dashboard/investor-kurasi.vue`**
  - Seluruh form raw → `UiInput` (beri **label**, bukan placeholder-saja; placeholder "UUID akun investor" membocorkan konsep teknis ke petugas — minimal ganti label "ID akun investor" + `UiFieldDescription` menjelaskan sumber ID; opsi lebih baik: pilih dari daftar usaha seperti `usaha/produk.vue`).
  - Semua tombol aksi (Verifikasi/Cabut verifikasi/Setujui/Cabut persetujuan) → `UiButton` + `:disabled` saat submit (sekarang bisa dobel-submit).
  - `catch { feedback = "…" }` ×2 → pakai `requestErrorCode`.
  - Daftar profil: tambah pending/empty/error state; status "Disetujui/Menunggu kurasi/Belum disetujui usaha" → badge/`ProgramStatusPill` + konstanta, bukan teks polos.
- [ ] **`app/pages/(private)/dashboard/usaha/investor.vue`**
  - Form raw (jenama/modal/kapasitas/margin/checkbox/file/tombol) → `UiInput`/`UiCheckbox`/`UiButton`/`UiField`.
  - Silent return validasi (`if (… == null || !jenama.trim()) return;`) → pesan inline.
  - `catch { feedback = "Profil tidak dapat disimpan…" }` → `requestErrorCode`; `throw new Error("PDF only")` → pesan Indonesia.
- [ ] **P3-A (keputusan, ada rekomendasi): konsolidasi halaman kata sandi.**
  `forgot-password.vue` ($fetch `/panel/auth/password/*`, min **12** karakter, tanpa `AuthShell`) tumpang-tindih dengan `lupa-kata-sandi.vue` + `reset-kata-sandi.vue` (SDK Directus + captcha, min **10** karakter).
  - **Rekomendasi**: hapus `forgot-password.vue`; pertahankan pasangan lupa-/reset-kata-sandi (pola SDK + captcha lebih benar).
  - Sebelum hapus: grep semua tautan ke `/forgot-password` (SignInForm, dsb.) dan arahkan ke `/lupa-kata-sandi`.
  - Samakan `PASSWORD_MIN` dengan kebijakan server: cek dulu ekstensi auth di `services/directus/extensions/` untuk panjang minimal resmi, lalu pakai satu angka di UI.
- [ ] **P3-B (keputusan, ada rekomendasi): satu route FAQ.** `bantuan.vue` dan `faq.vue` fetch koleksi `faq` sama, judul beda; nav memakai `/bantuan`, footer & `LandingFaq` memakai `/faq`.
  - **Rekomendasi**: pertahankan `/faq`, jadikan `/bantuan` redirect (atau hapus + alihkan tautan nav), samakan judul ("Pusat Bantuan – FAQ & Hotline"). Grep tautan `/bantuan` dan `/faq` sebelum memutuskan.
- [ ] **P3-C: `download.vue` halaman kosong** (hanya preloader + div) tapi ditautkan footer.
  - **Rekomendasi**: hapus route + tautan footer "Download" (ganti label jadi "Unduh" hanya bila halaman dipertahankan dengan isi nyata). Jika ada rencana konten unduhan, biarkan tapi isi minimal (judul + daftar aset) — jangan biarkan kosong.

## 5. P4 — Satukan pola konfirmasi aksi destruktif/keputusan

Standar: **UiDialog + alasan (UiTextarea) bila domain mewajibkan alasan; konfirmasi UiDialog sederhana bila tidak.** Rujukan implementasi: `pendampingan/index.vue` (dialog keputusan dengan alasan + error inline), `katalog/kurasi.vue` (tolak wajib catatan), `components/klinik/OutcomePanel.vue` (cabut wajib alasan ≥5 karakter + peringatan efek).

- [ ] `talent/kurasi.vue` — `window.prompt("Alasan menolak …")` → dialog ber-alasan; buat catatan **wajib** (selaras katalog: penolakan tanpa catatan ditolak server/kurasi).
- [ ] `usaha/passport.vue` — `window.confirm` ×2 (terbitkan ulang, cabut) → dialog konfirmasi sederhana yang menjelaskan efek ("QR lama tidak berlaku lagi").
- [ ] `umkm/[id].vue` — `window.confirm` ×2 (arsipkan/pulihkan, cari `Arsipkan usaha ini?`) → dialog konfirmasi.
- [ ] `kegiatan/index.vue` (private) — keputusan & sertifikat satu-klik → konfirmasi (juga tercakup P1).
- [ ] `SavedAnalysisMenu.vue` — hapus analisis tersimpan tanpa konfirmasi → dialog konfirmasi.
- [ ] Semua aksi destruktif: tombol `:disabled` selama proses + pesan gagal inline.

## 6. P5 — Copy: glosarium CONTEXT.md + bahasa Indonesia

Bank istilah (dari `CONTEXT.md` bagian "Avoid"): agenda/event→Kegiatan · order/pesanan/inquiry (LOI)→minat kemitraan/LOI · staf→Petugas/panitia (per konteks) · mentor/fasilitator→Pendamping · admin (tanpa keterangan)→Admin Provinsi · rating/survei→CSAT/penilaian · notulensi→(hindari) · role→Peran · laporan KPI→Laporan Mingguan · pengingat (untuk langganan)→Langganan Pengingat · binaan/talenta (peserta)→Peserta · hasil konsultasi (record)→Outcome Klinik.

### 5a. Glosarium (wajib)
- [ ] `(public)/kegiatan/index.vue` — `title: "Agenda Kegiatan UMKM …"` (useSeoMeta) → "Kegiatan UMKM …"; `LandingHeaderMask title="Agenda Kegiatan"` → "Kegiatan"; pesan "Agenda tidak dapat dimuat." → "Kegiatan tidak dapat dimuat."; `aria-label=\`Agenda ${day}\`` → "Kegiatan …".
- [ ] `(public)/kegiatan/[id].vue` — fallback title "Agenda Diskuk …" → "Kegiatan Diskuk …"; `subtitle="Agenda UMKM"` → "Kegiatan UMKM"; "Kembali ke agenda" → "Kembali ke daftar kegiatan".
- [ ] `components/landing/LandingFaq.vue` — "…serta agenda pada portal ini." → "…serta kegiatan pada portal ini."
- [ ] `(public)/katalog/[id].vue` — CTA "Ajukan Minat Kemitraan / Order B2B" (2 tempat: tombol & h2 LOI) → "Ajukan Minat Kemitraan (LOI)"; label "Perkiraan jumlah pesanan" → "Perkiraan jumlah (mis. 1.000 pcs per bulan)"; spec "Kapasitas pesanan besar" → "Kapasitas produksi besar"; kartu "Minimum order {{…}}" → "Minimal pemesanan {{…}}" (opsional tapi disarankan).
- [ ] `(private)/dashboard/kegiatan/index.vue` — "[403] Pemindai hanya untuk staf." → "…hanya untuk panitia."; "Panel ini hanya untuk staf provinsi/kabkota." → "Panel ini hanya untuk Admin Provinsi dan Admin Kab/Kota."
- [ ] `klinik.vue` — legend "Notulensi sesi: diagnosis per aspek" → "Diagnosis per aspek" (hindari konotasi catatan sesi; verifikasi konteks form tutup tiket); legend "Hasil konsultasi (outcome), opsional" → "Outcome konsultasi (opsional)" (selaras judul section lain di file yang sama).
- [ ] `(public)/tentang-program.vue` — "akses terhadap mentor profesional" → "…pendamping profesional".
- [ ] `(public)/kegiatan/[id].vue` — `Akun Anda tercatat sebagai {{ user?.app_role }}.` mencetak kunci mentah → pakai label dari `appRoleBadge(user?.app_role).label`.
- [ ] `usaha/index.vue` — SEO title & `UiCardTitle` "Laporan KPI Mingguan" → "Laporan Mingguan"; `akselerasi/index.vue` — "…dari laporan KPI yang telah disetujui" → "…dari laporan mingguan yang telah disetujui".
- [ ] `SignInForm.vue` — "Hubungi admin DISKUK untuk penetapan peran." → "Hubungi Admin Provinsi DISKUK…"; `sso-complete.vue` — "Hubungi admin DISKUK." → sama.
- [ ] (Rendah/opsional) `(public)/kegiatan/index.vue` langganan: "Pengingat aktif" → "Langganan pengingat aktif"; "Simpan pengingat" → "Langganan pengingat"; pesan "Pengingat dibatalkan." → "Langganan pengingat dibatalkan."; `components/katalog/ProdukForm.vue` "Minimum order (MOQ)" → "Jumlah minimal pemesanan (MOQ)"; `Direktori.vue` label "Layanan:" → "Poli & jadwal:" (verifikasi konteks); meta kegiatan "akselerasi talenta" → "akselerasi usaha".

### 5b. Bahasa Inggris yang tampil ke pengguna (wajib)
- [ ] `components/umkm/UmkmProfileActions.vue` — tombol 'Archive' → 'Arsipkan', 'Restore' → 'Pulihkan' (konfirmasinya sudah Indonesia).
- [ ] `(public)/public-dashboard.vue` — `LandingHeaderMask title="Overview"` → "Ringkasan".
- [ ] `components/landing/LandingFooter.vue` — link "Download" → "Unduh"; heading "Quick Link" → "Tautan Cepat"; "Support" → "Bantuan".
- [ ] `pendampingan/index.vue` — `item.status === "menunggu" ? "Review" : "Lihat"` → "Tinjau"; pesan "Laporan ini sudah direview." → "…sudah ditinjau."
- [ ] Komponen analitik — `Toolbar.vue` h1 "Canvas analitik" → "Kanvas analitik"; `AnalyticsRecordTable.vue` "Record dalam hasil" → "Baris dalam hasil", "Tidak ada record…" → "Tidak ada baris…"; `GroupList.vue` header "Share" → "Porsi (%)", title/aria "Drill down" → "Telusuri ke bawah"; `MetricSummary.vue` "record dilaporkan" → "baris dilaporkan", "Unknown" → "Tidak diketahui", "share gabungan" → "porsi gabungan"; `InsightPanel.vue` "Share"/"record"/"masuk kelompok unknown" → padanan Indonesia ("Porsi"/"baris"/"tidak diketahui"); `QueryBuilder.vue` "Urutan record"/"Identitas record" → "Urutan baris"/"Identitas baris".
- [ ] `usaha/index.vue` — banner "Terhubung - Data Real-Time" → "Terhubung — data waktu nyata".
- [ ] `components/nav/AppSidebar.vue` — `aria-label="Toggle sidebar"` → "Buka/tutup sidebar".
- [ ] `akun/aktivitas.vue` — "(audit trail)" → "(riwayat aktivitas)".
- [ ] `components/dashboard/accordion/ListKBLI.vue` — `percentOf` menghasilkan "0.0%" (desimal titik) → pakai `formatAnalyticsPercent` (format id, koma).
- [ ] `components/dashboard/card/Banner.vue` — default `description` "Lorem ipsum…" → teks Indonesia netral atau hilangkan fallback.
- [ ] `components/landing/LandingNav.vue` — "Login" (2 tempat) → "Masuk" (konsisten dengan h1 auth).
- [ ] (Rendah/opsional) `LandingHero.vue` "karakteristik entrepreneur" → "karakteristik wirausaha"; `ExportDialog.vue` `<dt>Masking</dt>` & `UmkmProfileHero` "masking v…" → "Penyamaran v…" (verifikasi konteks); `components/umkm/UmkmProfileHero.vue` idem.
- [ ] (Keputusan, biarkan bila nama program) "Deal Card Investor", "Talent Index Score", "Offtaker" di `investor/[id].vue`/`investor/index.vue`; "Executive Summary & Business Scorecard" di `usaha/passport.vue` — nama dokumen/istilah produk; biarkan kecuali pengguna minta dipadankan.

### 5c. Komentar kode (opsional, sekalian)
- [ ] `usaha/index.vue:21,177`, `usaha/produk.vue:17`, `usaha/passport.vue:18` — komentar "super admin" → "Admin Provinsi" (glosarium; bukan copy UI).

## 7. P6 + P7 — Migrasi UI kit & konsolidasi warna

### P6 — Migrasi Ui* (prioritas: form petugas dulu)
Padanan tersedia dan dipakai luas di file lain; ganti elemen mentah → `Ui*`. Pertahankan `data-testid`.

- [ ] **Tinggi** — `components/analytics/QueryBuilder.vue`: ~7 `<select>` + beberapa `<input>` + ~15 `<button>` → UiSelect/UiInput/UiButton (file terbesar; kerjakan hati-hati, uji analitik manual).
- [ ] **Tinggi** — `klinik.vue`: 2 select (status, prioritas) → UiSelect; checkbox "tampil batal" → UiCheckbox; tombol filter/toggle kanban → UiButton (variant outline/ghost).
- [ ] **Tinggi** — `kegiatan/index.vue` (private): 4 `<select>` (kategori, penyelenggara, metode, kanal) → UiSelect; input QR & kuota → UiInput.
- [ ] **Sedang** — komponen analitik: `ExportDialog.vue` (tombol Tutup/submit + select), `SaveAnalysisDialog.vue`, `SavedAnalysisMenu.vue`, `TemplatePicker.vue`, `GroupList.vue`, `InsightPanel.vue`, `AnalyticsState.vue`, `Toolbar.vue`, `AnalyticsRecordTable.vue`, `AnalyticsVisual.client.vue` (chip ✕, select) → UiButton/UiInput/UiSelect. ⚠️ `AnalyticsVisual.client.vue` sedang dimodifikasi sesi lain — cek dulu.
- [ ] **Sedang** — auth: `SignInForm.vue`, `lupa-kata-sandi.vue`, `reset-kata-sandi.vue` tombol submit (kelas dikopi 4×, `h-11 w-full rounded-xl`) → `UiButton` size konsisten.
- [ ] **Sedang** — `(public)/katalog/index.vue` 2 select → UiSelect; `(public)/kegiatan/[id].vue` checkbox+textarea → Ui*; `(public)/konsultasi.vue` radio/checkbox → UiCheckbox (radio group bintang CSAT boleh kustom); `ProdukForm.vue` select kategori → UiSelect; `usaha/index.vue` select mingguKe → UiSelect; `talent/ajukan/[usahaId].vue` select kesiapan legalitas → UiSelect.
- [ ] **Sedang** — `akselerasi/index.vue` tombol "Buat tugas pendamping" → UiButton; `usaha/passport.vue` tombol unduh QR PDF tanpa gaya → UiButton variant outline/link.
- [ ] **Sedang** — `components/umkm/UmkmProfileActions.vue` → UiButton variant outline (sekalian P5b).
- [ ] **Ekstraksi komponen bersama** — chip toggle `aria-pressed` dikopi di 5 tempat: `katalog/index.vue`, `fasilitasi.vue`, `konsultasi.vue`, `klinik.vue`, `components/klinik/OutcomeForm.vue` → buat satu komponen (mis. `components/ui/ToggleChip.vue`) lalu pakai di kelima tempat.
- [ ] **Opsional/rendah** — UiTable hanya untuk tabel sederhana (`akun/aktivitas.vue`, `akselerasi/index.vue`); JANGAN migrasi massal tabel kompleks (TabularData, analytics) — raw `<table>` styling-nya konsisten dan berisiko regre.

### P7 — Warna → satu sumber
- [ ] Buat satu modul konstanta warna non-token (mis. `app/constants/UI.ts` atau tambah token ke `tailwind.css` `@theme`):
  - Badge skala usaha (kini hex di `TabularData.vue` `skalaBadgeClasses`: `#c3e9d0/#006430`, `#bbdefb/#0d47a1`, `#ffeeb4/#ff7500`).
  - Palet chart dashboard: `NIB_COLORS`, `GENDER_COLORS` (duplikat di `card/Overview.vue` dan `chart/GenderDistribution.vue` — satukan), `COVERAGE_COLORS`, warna header kartu `bg-[#1E88E5]` (duplikat di `card/Banner.vue`) → pakai token `--brand-blue`.
  - Palet chart program: `akselerasi/index.vue` `["#64748b","#16a34a"]`, `KpiTrend.client.vue` `["#94a3b8","#16a34a"]` → satukan + `text-green-600/700` → token brand-green.
  - `PengantarKlinik.vue` `text-[#128c3e]` → token brand-green.
  - Palet chart publik `public-dashboard.vue` `UMKM_CHART_COLORS` + `#38BDF8`/`#EC4899`/`fill="#141B34"` → konstanta bersama (sebagian nilainya sama dengan token brand — tambahkan komentar "sinkron dengan --brand-blue/green").
- [ ] Banner peringatan amber berulang (`data-lapangan/[id].vue`, `AnalyticsState.vue`, `map/Infographic.vue`, dst.) → satu kelas/utilitas bersama (mis. konstanta kelas `WARNING_BANNER` atau komponen kecil).
- [ ] Badge status ad-hoc meniru palet peran (`usaha/index.vue` `stepClass()`, `usaha/produk.vue`, `usaha/passport.vue`, `(public)/passport/[kode].vue`, `fasilitasi.vue` `STATUS_CLASS`) → pindahkan peta warna status ke `constants/PROGRAM.ts`/`UI.ts` satu sumber. `(public)/passport/[kode].vue` konsisten dengan badge UMKM — selaraskan nilainya lewat konstanta yang sama.
- [ ] Jangan sentuh: hex MapLibre/SVG/unovis, `#25D366` WhatsApp (lihat §2).

## 8. P8 — Dead code, duplikasi, a11y kecil

- [ ] Hapus komponen tak terpakai (grep import dulu sebelum hapus): `components/dashboard/chart/MarketingMethods.vue`, `chart/NibOwnership.vue` (digantikan implementasi inline Overview), `components/analytics/AnalyticsHeader.vue`, `components/nav/TeamSwitcher.vue`.
- [ ] `lib/klinik.ts` — `batalkan()` & `jadwalkanUlang()` tidak diimpor halaman mana pun → hapus atau pakai (cek dulu server extension tidak bergantung).
- [ ] `LandingPreloader.vue` — class nonsens `oce` → hapus (typo).
- [ ] Duplikasi render gender: `card/Overview.vue` punya donut+legenda inline SEKALIGUS `chart/GenderDistribution.vue` dipakai `dashboard/index.vue` — pastikan hanya satu implementasi yang dipakai (⚠️ `dashboard/index.vue` sedang dimodifikasi sesi lain; koordinasikan).
- [ ] Triplikasi konversi skala UI→API (`useTabularFilters.ts`, `dashboard/index.vue`, `TabularData.vue`) → satu fungsi di composable.
- [ ] A11y: `AnalyticsVisual.client.vue` chip filter aktif `✕` hanya `title` → tambah `aria-label="Hapus filter {{label}}"`; `map/Infographic.vue` `role="button"` hanya `keydown.enter` → tambah `keydown.space` (rujukan ListKBLI); `(public)/public-dashboard.vue` hierarki heading h1→h6→h3 → rapikan ke h1→h2→h3; `tentang-program.vue` artikel mulai h3 tanpa h2 → perbaiki; `pendampingan/index.vue` dialog zoom foto → tambah `UiDialogDescription`; baris tabel `klinik.vue` yang klik-buka → tambah penanganan keyboard (tabindex + enter/space) atau tombol eksplisit.
- [ ] (Opsional) `kegiatan/index.vue` (publik) kartu kegiatan dibungkus `<button>` blok besar — boleh dibiarkan; catat saja.

## 9. Verifikasi & definisi selesai

Gerbang per paket (dari `apps/web/`):

```bash
pnpm lint          # --max-warnings 0
pnpm typecheck
pnpm test:unit
pnpm test:e2e      # lihat gotchas di bawah
```

Gotchas e2e (pengalaman repo):
- Server basi di port 3100 menghasilkan 404 massal — bunuh proses lama sebelum menjalankan e2e.
- Test auth flaky saat paralel → jalankan `pnpm test:e2e --workers=1` bila perlu.
- Browser Playwright harus terpasang (`npx playwright install`) bila environment baru.

Gerbang grep final (semua harus kosong/bersih di `apps/web/app`, kecuali pengecualian §2):

```bash
grep -rn "Agenda Kegiatan\|Order B2B\|Hubungi admin\|Quick Link\|'Archive'\|'Restore'\|\"Review\"" apps/web/app
grep -rn "window.confirm\|window.prompt" apps/web/app
grep -rn "useFetch(\|\$fetch(" apps/web/app/pages   # hanya sign-in SSO (disanksi)
grep -rn "Lorem ipsum" apps/web/app
grep -rn "bg-[#\"#]" apps/web/app --include="*.vue" | grep -v components/ui | grep -v "Choropleth\|AtRiskMap\|AnalyticsVisual"   # sisa hex di luar konstanta
```

Smoke manual (route yang tersentuh): `/`, `/investor`, `/investor/<id>`, `/faq`, `/bantuan`, `/katalog`, `/katalog/<id>` (alur LOI), `/kegiatan` (publik + filter + langganan), `/dashboard` (infografis), `/dashboard/analitik` (load tersimpan, gagal simpan tampil pesan), `/dashboard/tabular` (badge skala, paginasi), `/dashboard/data-lapangan/<id>` (simpan, verifikasi), `/dashboard/klinik` (filter, sheet detail, form tutup tiket), `/dashboard/kegiatan` (panitia: muat pendaftar, gagal muat ≠ kosong, pindai), `/dashboard/talent/kurasi` (Tolak hidden untuk kabkota), `/dashboard/usaha/passport` (cabut gagal tampil pesan), `/dashboard/investor-kurasi`, `/dashboard/usaha/investor`, `/dashboard/umkm/<id>`, `/passport/<kode>`, sign-in + lupa-kata-sandi + reset.

**Definisi selesai**: semua kotak P1–P8 dicentang (kecuali bertanda opsional/keputusan yang diputuskan lain dan dicatat di §10), gerbang §9 hijau, commit per paket sudah masuk `main` lokal.

## 10. Log pelaksanaan

*(diisi agen pelaksana: tanggal, commit hash, item yang disimpang/keputusan yang diambil, temuan baru saat eksekusi)*

- [ ] P1 selesai (commit: …)
- [ ] P2 selesai (commit: …)
- [ ] P3 keputusan A/B/C + eksekusi (commit: …)
- [ ] P4 selesai (commit: …)
- [ ] P5 selesai (commit: …)
- [ ] P6 selesai (commit: …)
- [ ] P7 selesai (commit: …)
- [ ] P8 selesai (commit: …)
