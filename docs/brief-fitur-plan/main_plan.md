# Implementation Plan: Brief Fitur

Source: [`design/Brief Fitur.pdf`](../../design/Brief%20Fitur.pdf) (`design/` is excluded by `.gitignore`, so the PDF is not in the repository)

Status: **In progress**. Phase 0 is implemented; the remaining open decisions are listed at the end.

## Codebase status (checked 26 September 2026)

Parts of this plan were already built before it was written. Each phase below is annotated, but in short:

- **Phase 0:** `directus_users.app_role`, `instansi` and `usaha` already exist (migration `20260926A-create-auth-login.js`). Only `kota_scope` was missing.
- **Phase 0:** there is no `services/directus/extensions/shared/auth.cjs` and no `apps/web/server/middleware/01-panel-proxy.ts`. The dashboard guard is copied into each extension as `src/lib/utils/auth.js`, and `/panel/**` is a Nitro `routeRules` proxy in `apps/web/nuxt.config.ts` with no session check of its own.
- **Phase 1:** already done. Email-or-NIB login, "Lupa Kata Sandi?", captcha (ALTCHA, self-hosted, instead of Turnstile), the real profile header in `nav/User.vue`, the account settings page (`/dashboard/akun`) and the session activity log all exist.

## Scope from the brief's colour code

| Colour | Meaning | Handling in this plan |
|---|---|---|
| Green | Already built | Skipped: executive metric cards, Canvas Analitik pivot, choropleth drill-down, map control panel, tabular search and filters |
| Yellow | Must have now | Everything in Phases 0–6 below |
| Red | Next dev | Not built now (see list below) |

**Deferred (red):** SSO Jabar, floating multi-role switcher, Permen 2/2026 five-aspect tab, offline-simulation toggle, Modul 5 executive monitoring, investor matchmaking directory, event registration with e-pass and e-certificates, the Fasilitasi & Bantuan module (all 8 cards), clinic statistics and consultant list, and the clinic-to-profile score integration.

**Roles:** the brief says multi-role is next dev ("bikin untuk super admin dulu aja"). The data model gets a role field now, but only the super-admin account is used. Every screen is reachable by that admin, and screens are grouped by role in the sidebar so real roles can be switched on later without restructuring.

---

## Phase 0: Foundations (Directus and web) — implemented

### Directus migrations

Migration [`20260926D-create-program-foundation.js`](../../services/directus/migrations/20260926D-create-program-foundation.js), in the raw-SQL style of [`20250801C-create-businesses.js`](../../services/directus/migrations/20250801C-create-businesses.js).

| Collection | Key fields |
|---|---|
| `directus_users` (new field) | `kota_scope` (M2O `kota`). `app_role`, `instansi` and `usaha` already existed. |
| `usaha` (new fields) | `talent_status` (`none` → `nominated` → `scouting` → `talent_pool` → `accelerator` → `champion`), `talent_batch`, `pdn_terverifikasi`, `ramah_disabilitas`, `nomor_whatsapp` |
| `usaha_legalitas` (1-N from `usaha`) | `jenis` (`halal` / `pirt` / `bpom` / `hki` / `sni` / `umku`), `nomor`, `status`, `berlaku_hingga`, `berkas` (file) |

### New extension

[`services/directus/extensions/program`](../../services/directus/extensions/program) holds the domain endpoints for Phases 2–6 under `/v1/program/*`. It carries its own copy of the dashboard guard (like the analytics and authentication bundles) and the server-side masking from [ADR-004](../architecture/decisions/0004-server-side-privacy-masking.md). NIK is always masked in responses. The first endpoint is `GET /v1/program/legalitas/:usahaId`.

### Public read path

The public pages (katalog, kegiatan, FAQ, klinik, passport verification) need data without a login.

- **Decision:** the Directus `public` policy, granted per collection and per field. See [ADR-006](../architecture/decisions/0006-public-read-directus-public-policy.md).
- The `/panel/**` proxy already forwards requests without a session, so the web needs no bypass.
- Each phase that adds a public collection adds its own public-policy grant in the same migration.
- Passport verification is the one exception: it has to recompute a signature, so it stays a custom endpoint.

---

## Phase 1: Modul 1, login and user profile — already built

1. **Email or NIB field** in `SignInForm.vue`: done (NIB resolved by the authentication extension's login guard).
2. **"Lupa Kata Sandi?"**: done (`/lupa-kata-sandi`, `/reset-kata-sandi`).
3. **CAPTCHA**: done with ALTCHA instead of Turnstile.
4. **Profile header**: done (`nav/User.vue` shows avatar, name, role badge and instansi; dropdown has account settings, activity log and logout).

---

## Phase 2: Modul 2 and 3 gaps

1. **Export Slide PPT** in Canvas Analitik
   - PDF and PNG already exist in [`ExportDialog.vue`](../../apps/web/app/components/analytics/ExportDialog.vue).
   - Add `pptxgenjs` on the client and build the slide from the chart PNG plus the aggregation table.
2. **Map pin pop-up card** in [`Choropleth.client.vue`](../../apps/web/app/components/dashboard/map/Choropleth.client.vue)
   - Clicking a point calls `GET /tabular/spasial/:id/card`.
   - Card contents:
     - Business name and owner
     - Scale badge (Mikro / Kecil / Menengah)
     - KBLI 5-digit code and main activity
     - Annual turnover (Rp)
     - Certification badges from `usaha_legalitas`
     - Talent status and batch
     - **[Buka Profil Lengkap]** link to `/dashboard/umkm/[id]`

---

## Phase 3: Modul 4, Talent Scouting — implemented

> **As built:** migration `20260926E-create-talent-scouting.js`, endpoints under `/v1/program/talent`, pages `/dashboard/talent/ajukan/[usahaId]` and `/dashboard/talent/kurasi`.
> Differences from the text below:
> - `talent_pengajuan.berita_acara` is a many-to-one link. A submission belongs to at most one Berita Acara, so no junction table is needed.
> - Status transitions: submitting sets `nominated`, scoring sets `scouting`, and the Berita Acara sets `talent_pool`. That matches the "Masukkan ke Talent Pool" button. Rejecting returns the business to `none`.
> - The Berita Acara PDF (`berkas`) is empty until open decision 3 (PDF generation) is settled.
> - Scores are stored with `rubrik_versi = 'placeholder-v0'` and the UI warns while that rubric is in use.

### Collections

**`talent_pengajuan`**

- Links: `usaha`, `diajukan_oleh`.
- Jabar fields: `kapasitas_produksi`, `satuan`, `kesiapan_legalitas` (JSON), `literasi_qris`, `literasi_pembukuan_digital`, `surat_komitmen` (file).
- Scores: `skor_finansial`, `skor_pasar`, `skor_legalitas`, `skor_sdm`, `skor_total`.
- `status`: `draft` / `dinilai` / `disetujui` / `ditolak`.

**`talent_berita_acara`**

- `nomor`, `tanggal`, `disetujui_oleh`, the generated PDF, and an M2M link to `talent_pengajuan`.

### Endpoints

- `POST /program/talent/pengajuan`
- `POST /program/talent/pengajuan/:id/hitung-skor`
  - The score is calculated on the server with four weights of 25% each.
  - The formula lives in one module with unit tests.
- `POST /program/talent/berita-acara`
  - Runs in one transaction: creates the Berita Acara, marks the submissions approved, and sets `usaha.talent_status = 'scouting'`.

### Web

- **Row action** in [`TabularData.vue`](../../apps/web/app/components/dashboard/TabularData.vue): add **[Ajukan ke Talent Scouting]** next to "Lihat Profil UMKM".
- **`/dashboard/talent/ajukan/[usahaId]`**
  - SIDT data shown read-only (masked NIK).
  - Jabar fields and the commitment-letter upload.
  - **[Hitung Skor]** button with the calculation animation.
- **`/dashboard/talent/kurasi`**
  - Approval panel with a list of scored submissions and multi-select.
  - **[Terbitkan Berita Acara & Masukkan ke Talent Pool]** button.

> **Open item:** the scoring rubric (how the raw inputs map to each 0–100 sub-score) is not in the brief. It must come from DISKUK or the BI methodology document. Until then a placeholder rubric is used and clearly marked as such.

---

## Phase 4: Modul 5, weekly KPI monitoring — implemented

> **As built:** migration `20260926F-create-kpi-monitoring.js`, endpoints under `/v1/program/kpi`, pages `/dashboard/usaha` (UMKM phone view), `/dashboard/pendampingan` and `/dashboard/pendampingan/[pesertaId]`.
> Notes:
> - Participants are enrolled in the Directus Data Studio (`program_peserta`); there is no enrolment screen yet.
> - Every report goes through the IndexedDB outbox, online or not. It syncs on page load, when the connection returns, and every 30 s while items are queued. There is no service-worker background sync, so the app must be open for queued reports to go out.
> - The outbox is cleared on logout with the other private browser state (ADR-004), so unsent reports are lost if the user signs out first.
> - Access is scoped by `app_role`: admin and Provinsi see all participants, Kab/Kota sees its `kota_scope`, Pendamping sees their assigned participants, and UMKM sees its own business. The super admin opens the UMKM view through a participant picker.
> - Known limit: non-admin users can only read files they uploaded, so a non-admin pendamping cannot open evidence photos yet. This needs a file-access rule before real pendamping accounts are used.

### Collections

**`program_peserta`**

- `usaha`, `batch`, `fase`, `pendamping` (user), `tanggal_mulai`, `jumlah_minggu` (12), `target_mingguan`, `rekomendasi_pitching` (boolean).

**`kpi_laporan`**

- Report: `peserta`, `minggu_ke`, `target`, `realisasi_omzet`, `jumlah_transaksi`, `bukti` (M2M files), `kendala`.
- Offline sync: `client_uuid` (unique), so a report synced twice is stored only once.
- Review: `status` (`menunggu` / `disetujui` / `ditolak`), `catatan_pendamping`, `direview_oleh`, `direview_at`.

**Rule:** `rekomendasi_pitching` can only be enabled after 4 consecutive weeks at or above target. The server enforces this.

### UMKM mobile view

Route group `/dashboard/usaha/*`, shown in a phone-frame layout on desktop.

- Header with business identity, phase, batch and pendamping.
- Week stepper ("Minggu ke-6 dari 12").
- Connectivity banner driven by `navigator.onLine`:
  - Green: "Terhubung - Data Real-Time"
  - Yellow: "Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel"
- Weekly report form: weekly target (read-only), turnover, transaction count, camera or gallery upload, problem notes.
- **Offline-first**
  - The form saves to IndexedDB (`localforage` and [`lib/idb.ts`](../../apps/web/app/lib/idb.ts) already exist) as an outbox.
  - Sync runs when the connection returns or through `@vite-pwa` background sync.
  - `client_uuid` prevents duplicates.

### Coach review panel (`/dashboard/pendampingan`)

- Review queue with filters for Menunggu / Disetujui / Belum Mengirim.
- Evidence modal with image zoom and the automatic "Capaian 112% dari Target" comparison.
- Notes field with **[Tolak & Minta Perbaikan Bukti]** and **[Setujui & Verifikasi Laporan]**.
- Target-vs-actual trend line (Unovis is already installed).
- Pitching-recommendation checkbox.

---

## Phase 5: Modul 6, Talent Passport and Digital Twin — implemented (without PDFs)

> **As built:** migration `20260926H-create-talent-passport.js`, endpoints under `/v1/program/passport`, pages `/dashboard/usaha/passport` and `/passport/[kode]`.
> Notes:
> - The signature is HMAC-SHA256 over a canonical JSON payload, keyed by `PASSPORT_SIGNING_SECRET`, or derived from Directus `SECRET` when that is unset. Rotating either key invalidates every issued passport.
> - Codes look like `TP` plus 10 Crockford base32 characters. Re-issuing revokes the previous passport; verification reports revoked and tampered passports without showing their data.
> - The signed payload holds only business facts (name, scale, kab/kota, KBLI, badge, scores, certificates, PDN). It has no NIB, NIK, owner name or phone.
> - Radar dimensions: the four Talent Index scores from the approved submission, plus "Kinerja Program" (share of started weeks with an approved report on target). Both are placeholders until the official rubric arrives.
> - The public portfolio's photos, videos and specs come from the business's published catalogue products. They are live, not part of the signature.
> - Not built: the Executive Summary & Business Scorecard and Katalog Ekspor PDFs, pending open decision 3.

The investor matchmaking directory is red and is not part of this phase.

### Collection

**`talent_passport`**

- `usaha`, `kode` (random ID), `payload_hash`, `signature`, `diterbitkan_at`.
- The five radar scores (0–100) and `status_badge`.

### Verification

- `GET /program/passport/verify/:kode` is public. It recomputes the signature and returns valid or invalid plus a minimal public profile.
- The QR code points to `/passport/[kode]`.
- The signing key is a Directus environment variable.
- HMAC is enough for tamper detection. If "nirsangkal" (non-repudiation) must be literal, use an Ed25519 key pair instead.

### Web

- **`/dashboard/usaha/passport`** (private)
  - Identity card with the acceleration badge.
  - QR code downloadable as PNG.
  - Radar chart and compliance badges.
- **`/passport/[kode]`** (public portfolio)
  - Video storytelling, photo gallery, technical specification tab.

### PDF documents

These are Executive Summary & Business Scorecard, and Katalog Ekspor.

- The worker's [`export-renderer.js`](../../services/analytics-worker/src/export-renderer.js) builds PDFs by hand and won't handle rich layouts.
- **Recommendation:** print-styled Nuxt routes rendered by a headless Chromium service (e.g. Gotenberg) added to docker-compose.

---

## Phase 6: Modul 7, public portal

Public reads in this phase go through the Directus `public` policy ([ADR-006](../architecture/decisions/0006-public-read-directus-public-policy.md)).

### 6.1 Katalog — implemented

> **As built:** migration `20260926G-create-katalog.js` (`produk`, `produk_foto`, `produk_loi`, a "Katalog Publik" file folder, and the first Public policy grants), endpoints under `/v1/program/katalog`, pages `/katalog`, `/katalog/[id]`, `/dashboard/usaha/produk` and `/dashboard/katalog/kurasi`.
> Notes:
> - Visitors read `produk`, `produk_foto` and files in the "Katalog Publik" folder through the Public policy, with field allowlists and a filter for published products only. `usaha` stays private: the business attributes the catalogue filters on are copied onto `produk` by database triggers whenever the business or its certificates change.
> - A certificate that expires by date alone stays on `produk` until the business or its certificates next change. A daily refresh would close that gap.
> - The LOI form is a public custom endpoint behind the same ALTCHA captcha as login. LOIs are listed on the curation page.
> - The Directus rate limiter is now on (100 requests/s per client IP by default, set in `docker-compose.yml`).
> - "Official sales contact" on the detail page is the LOI form plus the business's WhatsApp. The DISKUK hotline comes with 6.4.
> - `usaha.nomor_whatsapp` is shown publicly for published products. It is a business contact entered for the catalogue, not the owner's personal phone from SIDT.

The current [`katalog.vue`](../../apps/web/app/pages/(public)/katalog.vue) uses hard-coded dummy data.

**Collection `produk`**

- Basics: `usaha`, `nama`, `deskripsi`, `kategori`, `kbli`, `harga_retail`, `harga_grosir`, `moq`.
- Media: `foto` (M2M, max 5, validated on the server), `video_url`.
- Specs: `dimensi`, `berat`, `shelf_life`, `bahan_baku`, `tkdn_persen`, `kapasitas_bulanan`, `lead_time`.
- `persen_bahan_lokal`.
- `status_kurasi`: `menunggu` → `tayang` → `rekomendasi_marketplace`.

**Public reads**

- List with search, quick chips and sidebar filters:
  - Region, scale, talent status, certifications, PDN, disability-friendly.
- Detail.

**Web**

- Rebuild `/katalog` with the new product card:
  - Badges, price range, MOQ, WhatsApp button.
- New `/katalog/[id]` detail page:
  - Image carousel and video.
  - Spec table and legal status card.
  - LOI form and official sales contact.
- UMKM page `/dashboard/usaha/produk`:
  - Product form and PDN self-declaration.
  - Curation status stepper and PMSE compliance notice.
- Admin curation queue.

### 6.2 Kegiatan — implemented

> **As built:** migration `20260926I-create-kegiatan-faq.js` and the public page `/kegiatan`. Events are entered in the Data Studio (`kegiatan`) and appear once `status_publikasi` is "terbit". Filters run in the browser over the published events of the last 90 days onward.

**Collection `kegiatan`**

- `judul`, `kategori`, `penyelenggara`, `kota`, `metode`, `ramah_disabilitas`.
- Date range, `lokasi` or `link`, `kuota`, `terisi`, `batas_registrasi`.
- `silabus`, `narasumber`, `fasilitas`, `syarat`, `dokumentasi`.

**Page `/kegiatan`**

- Month calendar with category colour badges and a hover popover.
- Timeline grouped by status (the status is derived from the dates):
  - Sedang Berjalan / Pendaftaran Dibuka / Segera Datang / Selesai.
- Filter bar: category, organiser, method, disability-friendly.
- Detail modal with event information and requirements.
- The "Daftar" button is not wired up yet because the registration flow is red.

### 6.3 Klinik Konsultasi

The current [`konsultasi.vue`](../../apps/web/app/pages/(public)/konsultasi.vue) is a placeholder.

**Collections**

- `konsultasi_poli`: the 6 poli, seeded.
- `konsultasi_tiket`:
  - Number `KLN-YYYY-MM-NNNN` from a DB sequence.
  - Request: NIB/NIK, poli, `deskripsi`, `lampiran`, `moda`, slot, `prioritas`.
  - Kanban `status`: Tiket Masuk → Jadwal Ditetapkan → Sesi Berjalan → Tindak Lanjut → Selesai.
  - `pendamping`, `link_meet`.
  - Session record: `diagnosis` (JSON, five aspects), `action_plan`, `rujukan`.

**Public 4-step form**

1. Identity: the NIB/NIK lookup returns only the business name, scale, kab/kota and KBLI.
2. Poli, problem description, attachments.
3. Online or in-person, and date/slot picker.
4. Confirmation with the ticket number.

CAPTCHA and rate limiting protect the form. The NIB/NIK lookup and ticket creation are writes and lookups by identifier, so they are custom endpoints rather than public-policy grants.

**Dashboard**

- Kanban and list views with priority badges.
- Session panel with meeting link and consultation minutes.
- Referral buttons: Program Bantuan Sarpras, Pelatihan Vokasi, Mediasi Kementerian/SAPA UMKM, Kurasi Talent Lab.

**WhatsApp notification:** there's no gateway yet. For now the ticket number is shown on screen, with a `notify()` hook left in the code for later.

### 6.4 FAQ & Hotline — implemented

> **As built:** same migration; `/bantuan` page, a hotline card that also appears on the catalogue detail page, and "Kegiatan" and "Bantuan" links in the landing nav. The FAQ is seeded with the six answers the landing page already showed. The hotline starts with only the office address: DISKUK needs to fill in the WhatsApp number, phone, email and hours in the Data Studio.

- Collections: `faq` and `kontak_hotline` (singleton).
- New page `/bantuan` that reuses [`LandingFaq.vue`](../../apps/web/app/components/landing/LandingFaq.vue) fed from Directus, plus a WhatsApp contact button.

---

## Suggested order

1. ~~Phase 0: Foundations~~ (done)
2. ~~Phase 1: Login and profile~~ (already built)
3. ~~Phase 3: Talent Scouting~~ (done)
4. ~~Phase 4: Weekly KPI monitoring~~ (done)
5. ~~Phase 6.1: Katalog~~ (done)
6. ~~Phase 5: Talent Passport~~ (done, except PDFs)
7. Phases 6.2–6.4: Kegiatan, Klinik, FAQ
8. Phase 2: PPT export and map pop-up

Talent status (Phase 3) feeds the map pop-up, katalog badges, passport and KPI modules, so it should be built early.

Each phase ships with:

- Contract tests in the extension (same pattern as the existing extensions' `test/` folders).
- Playwright specs using the existing Directus mock setup.

---

## Open decisions

1. **Scoring rubric** for the Talent Index (Phase 3) and the 5-dimension radar (Phase 5). Not in the brief; placeholders are used until it arrives.
2. ~~**Public data access**~~: decided, Directus `public` policy ([ADR-006](../architecture/decisions/0006-public-read-directus-public-policy.md)).
3. **PDF generation:** add a Gotenberg/Chromium container, or keep generation client-side and accept lower layout quality.
4. **External services:** SMTP details for password reset (the env vars exist in `docker-compose.yml`), and whether a WhatsApp gateway exists. CAPTCHA is settled (ALTCHA).
5. **Roles:** is "super admin only" acceptable for the UMKM and pendamping screens, with the admin opening them as if they were that user? The UMKM view needs a linked `usaha` to show anything.
