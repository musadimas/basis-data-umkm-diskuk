# Phase 4 — Talent Scouting: alur Ajukan, Tolak ber-alasan, tab Ditolak, data wajib

**Bug:** BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, TS-15, TS-17
**Commit:** `fix(talent): BUG-006..010 alur ajukan terpisah, tolak ber-alasan, data wajib skor`

## 1. Objective, dependensi, hasil teramati

**Objective.** Memisahkan "Hitung Skor" (menghitung & menyimpan skor, status tetap `draft`) dari "Ajukan ke Kurasi" (`draft → dinilai`); `dinilai` menjadi read-only bagi pengaju; Tolak hanya untuk `dinilai` oleh `provinsi` dengan alasan wajib yang disimpan di kolom sendiri; tab Ditolak hanya memuat penolakan terbaru per usaha; Hitung Skor/Ajukan mensyaratkan kapasitas produksi > 0 dan satuan.

**Dependensi.** Gerbang `main_plan.md` §9 (P6 sudah di-commit). Phase 1–3 sudah di-commit (tidak ada file bersama).

**Hasil teramati.**
- Form ajukan memiliki tombol "Simpan Draft", "Hitung Skor", "Ajukan ke Kurasi"; setelah Hitung Skor pill tetap "Draft"; setelah Ajukan pill "Siap dikurasi" dan form terkunci.
- Tab Draft di panel kurasi tidak memiliki tombol Tolak; Admin Kab/Kota tidak melihat Tolak dan server menjawab 403.
- Menolak meminta alasan di dialog; alasan muncul di tab Ditolak dan di form usaha tsb; tombol "Ajukan ulang" membuat draft baru yang terisi isian lama.
- Usaha yang ditolak lalu diajukan ulang tidak lagi muncul di tab Ditolak.
- Hitung Skor dengan kapasitas kosong menampilkan pesan pada field dan tidak memanggil server; server menolak 422 `DATA_BELUM_LENGKAP`.

## 2. Manifest file (tertutup)

| Aksi | Path |
|---|---|
| create | `services/directus/migrations/20261001A-talent-alasan-tolak.js` |
| modify | `services/directus/extensions/program/src/endpoints/talent/service.js` |
| modify | `services/directus/extensions/program/src/endpoints/talent/index.js` |
| modify | `services/directus/extensions/program/src/oas.yaml` |
| modify | `services/directus/extensions/program/test/talent.test.js` |
| modify | `services/directus/extensions/program/test/pg/talent.test.js` |
| modify | `services/directus/extensions/program/test/pg/talent-support.mjs` |
| modify | `scripts/seed-dummy-program.sql` |
| modify | `apps/web/app/pages/(private)/dashboard/talent/ajukan/[usahaId].vue` |
| modify | `apps/web/app/pages/(private)/dashboard/talent/kurasi.vue` |
| modify | `apps/web/app/types/program.ts` |
| modify | `apps/web/app/constants/PROGRAM.ts` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| modify | `apps/web/tests/e2e/talent.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

Huruf migration `A` dipesan untuk phase ini. Phase 8 memakai `20261001B-…`, phase 9 `20261001C-…`.

## 3. Simbol & anchor yang wajib diinspeksi sebelum edit

| File | Anchor (cari teks persis) |
|---|---|
| `talent/service.js` | `const OPEN_STATUS = ["draft", "dinilai"];`, `function requireOpen(row)`, `const PENGAJUAN_COLUMNS`, `export function toPengajuan(row)`, `export const listPengajuan`, `WHERE (?::text IS NULL OR p.status = ?)`, `export const updatePengajuan`, `export const scorePengajuan`, `rubrik_versi = ?, dinilai_at = NOW(), status = 'dinilai'`, `UPDATE usaha SET talent_status = 'scouting'`, `export const rejectPengajuan`, `catatan = COALESCE(?, catatan)` |
| `talent/index.js` | `const KELOLA = { peran: ["provinsi", "kabkota"] };`, `router.post("/pengajuan/:id/tolak", terjaga(KELOLA, rejectPengajuan)(context));` |
| `oas.yaml` | baris `/talent/pengajuan/{id}:`, `/talent/pengajuan/{id}/hitung-skor:`, `/talent/pengajuan/{id}/tolak:` |
| `test/talent.test.js` | `assert.equal(routes.length, 8);` (dua kali), array `ekspektasi` |
| `test/pg/talent.test.js` | test `"ubah pengajuan menghapus skor lama…"`, `"hitung-skor: skor tersimpan…"`, `"tolak: pengajuan ditolak…"` |
| `test/pg/talent-support.mjs` | `export async function buatPengajuan(db, { usahaId, status = "draft", skor = null } = {})` |
| `scripts/seed-dummy-program.sql` | `INSERT INTO talent_pengajuan (usaha, diajukan_oleh, …` dan `CASE WHEN d.n > 15 THEN 'dummy_Kapasitas produksi belum stabil; ajukan kembali batch berikutnya' END,` |
| `ajukan/[usahaId].vue` | `const ERRORS: RuntimeLabelMap`, `function syncFrom(`, `const readOnly = computed(`, `const rejected = computed(`, `const saving = ref(false);`, `const scoring = ref(false);`, `async function saveDraft()`, `async function hitungSkor()`, `<fieldset :disabled="readOnly || saving || scoring"`, `<div v-if="!readOnly" class="flex flex-wrap gap-3">`, `<ProgramScoreBars v-else-if="pengajuan?.skor"` |
| `kurasi.vue` | `async function tolak()`, `body: { catatan: alasanTolak.value.trim() }`, `v-if="isProvinsi && (row.status === 'dinilai' || row.status === 'draft')"`, `<UiDialogContent v-if="tolakTarget" class="max-w-md">` |
| `types/program.ts` | `export interface TalentPengajuan {` |
| `constants/PROGRAM.ts` | `dinilai: { label: "Dinilai", className: "bg-indigo-100 text-indigo-800" },` |
| `mock-program.mjs` | blok `if (method === "GET" && path.startsWith("/talent/usaha/"))` s.d. `if (method === "GET" && path === "/talent/berita-acara")` |
| `talent.spec.ts` | `page.locator('select[name="kesiapan-bpom"]').selectOption("dalam_proses");` |
| `operasional.directus.spec.ts` | `await hitungBtn.click();` dalam test `"Y02 talent scouting…"` |

Konsumen lain `talent_pengajuan` (diperiksa, **tidak berubah**): `passport/service.js::eligibility` dan `executive/index.js` (subquery `talent_index`) hanya membaca baris `status = 'disetujui'` terbaru; kolom baru dan transisi baru tidak mengubah baris `disetujui`. `test/pg/passport.test.js` menyisipkan baris langsung dan tidak bergantung pada transisi.

## 4. Kontrak saat ini → kontrak akhir

### State machine `talent_pengajuan.status`

| Aksi | Route | Peran | Saat ini | Akhir |
|---|---|---|---|---|
| Buat | `POST /pengajuan` | provinsi, kabkota | `draft`; usaha `none→nominated` | tidak berubah |
| Ubah | `PATCH /pengajuan/:id` | provinsi, kabkota | dari `draft`/`dinilai` → `draft`, skor dihapus | **hanya dari `draft`** (409 `PENGAJUAN_CLOSED` untuk lainnya); skor dihapus |
| Hitung skor | `POST /pengajuan/:id/hitung-skor` | provinsi, kabkota | dari `draft`/`dinilai` → `dinilai`; usaha → `scouting` | **hanya dari `draft`**; wajib `kapasitas_produksi > 0` dan `satuan` terisi (422 `DATA_BELUM_LENGKAP`); simpan skor + `dinilai_at`; **status tetap `draft`**; `talent_status` tidak berubah |
| Ajukan (baru) | `POST /pengajuan/:id/ajukan` | provinsi, kabkota | — | hanya dari `draft` (409 `PENGAJUAN_CLOSED`); data lengkap (422 `DATA_BELUM_LENGKAP`); `skor_total IS NOT NULL` (409 `SKOR_BELUM_DIHITUNG`); → `dinilai`; usaha `none/nominated → scouting` |
| Tolak | `POST /pengajuan/:id/tolak` | **provinsi** (sebelumnya + kabkota) | dari `draft`/`dinilai`; `catatan = COALESCE(alasan, catatan)` | body `{ alasan }` wajib (400 `ALASAN_WAJIB`; >2000 → 400 `INVALID_PAYLOAD`); hanya dari `dinilai` (409 `PENGAJUAN_TIDAK_SIAP_DIKURASI`); tulis `alasan_tolak`, `ditolak_oleh`, `ditolak_at`; `catatan` tidak disentuh; usaha → `none` |
| BA | `POST /berita-acara` | provinsi | dari `dinilai` | tidak berubah |

### DTO `TalentPengajuan` (JSON)

Tambahan: `alasanTolak: string | null`, `ditolakAt: string | null` (ISO-8601 dengan `Z`, dari `TIMESTAMPTZ`). Field lain tetap.

### Daftar `GET /pengajuan?status=`

Baris `ditolak` hanya dikembalikan bila tidak ada pengajuan lebih baru (`date_created` lebih besar) untuk usaha yang sama. Status lain tidak berubah.

### Waktu

`ditolak_at TIMESTAMPTZ DEFAULT NULL` diisi `NOW()` (UTC di storage). Serialisasi node-pg → `Date` → JSON `…Z`. Tampilan: `new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })`. Kasus lintas zona: `2026-09-30T18:30:00Z` tampil `1 Okt 2026, 01.30` di browser ber-TZ apa pun (diuji di e2e dengan `timezoneId: "America/New_York"` pada `test.use`).

### Peran UI

| Kontrol | provinsi | kabkota |
|---|---|---|
| Form ajukan (semua mode) | ya | ya |
| Tombol Tolak di kurasi | tab Siap dikurasi saja | tidak ada |
| Checkbox & tombol BA | existing | existing (tidak ada) |

## 5. Edit berurutan

### 5.1 Migration `services/directus/migrations/20261001A-talent-alasan-tolak.js`

Ikuti pola `20260929D-kpi-laporan-dibuat-pada-klien.js` (ESM, `knex.transaction`, `trx.raw`):

```js
/**
 * BUG-008: alasan penolakan kurasi Talent Scouting disimpan terpisah dari catatan pengaju.
 * Baris yang sudah ditolak sebelum migration ini memakai `catatan` sebagai alasan (perilaku lama
 * menimpanya dengan COALESCE), jadi nilainya disalin sebagai alasan_tolak.
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE talent_pengajuan
        ADD COLUMN IF NOT EXISTS alasan_tolak TEXT,
        ADD COLUMN IF NOT EXISTS ditolak_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ditolak_at TIMESTAMPTZ;

      UPDATE talent_pengajuan
         SET alasan_tolak = catatan, ditolak_at = date_updated
       WHERE status = 'ditolak' AND alasan_tolak IS NULL;

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      SELECT v.collection, v.field, v.special, v.interface, NULL, v.display, NULL, TRUE, FALSE, v.sort, v.width, NULL,
             v.note, NULL, FALSE, NULL, NULL, NULL
        FROM (VALUES
          ('talent_pengajuan', 'alasan_tolak', NULL, 'input-multiline', NULL, 22, 'full', 'Alasan penolakan kurasi'),
          ('talent_pengajuan', 'ditolak_oleh', 'm2o', 'select-dropdown-m2o', 'user', 23, 'half', NULL),
          ('talent_pengajuan', 'ditolak_at', NULL, 'datetime', 'datetime', 24, 'half', NULL)
        ) AS v(collection, field, special, interface, display, sort, width, note)
       WHERE NOT EXISTS (SELECT 1 FROM directus_fields f WHERE f.collection = v.collection AND f.field = v.field);

      INSERT INTO directus_relations
        (many_collection, many_field, one_collection, one_field, one_collection_field,
         one_allowed_collections, junction_field, sort_field, one_deselect_action)
      SELECT 'talent_pengajuan', 'ditolak_oleh', 'directus_users', NULL, NULL, NULL, NULL, NULL, 'nullify'
       WHERE NOT EXISTS (SELECT 1 FROM directus_relations WHERE many_collection = 'talent_pengajuan' AND many_field = 'ditolak_oleh');
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_relations WHERE many_collection = 'talent_pengajuan' AND many_field = 'ditolak_oleh';
      DELETE FROM directus_fields WHERE collection = 'talent_pengajuan' AND field IN ('alasan_tolak', 'ditolak_oleh', 'ditolak_at');
      ALTER TABLE talent_pengajuan
        DROP COLUMN IF EXISTS ditolak_at,
        DROP COLUMN IF EXISTS ditolak_oleh,
        DROP COLUMN IF EXISTS alasan_tolak;
    `);
  });
};
```

Catatan: `display` untuk `alasan_tolak` = `NULL` (nilai ke-5 dalam VALUES). Migration tidak memberi grant apa pun (kontrak `test/public-grants.contract.test.mjs` tetap hijau; `talent_pengajuan` ada di `NEVER_PUBLIC`).

### 5.2 `talent/service.js`

1. Hapus `const OPEN_STATUS = ["draft", "dinilai"];` dan `function requireOpen(row)`. Tambahkan:
   ```js
   function requireStatus(row, status, code) {
     if (row.status !== status) {
       throw new ProgramError(409, code, "The submission is not in the required status.");
     }
   }
   /** TS-15/TS-17: skor dan pengajuan butuh kapasitas produksi > 0 dan satuan. */
   function requireLengkap(row) {
     const kapasitas = num(row.kapasitas_produksi);
     if (!(kapasitas > 0) || !String(row.satuan ?? "").trim()) {
       throw new ProgramError(422, "DATA_BELUM_LENGKAP", "Kapasitas produksi dan satuan wajib diisi.");
     }
   }
   ```
   `requireStatus` dipanggil dengan kode: PATCH/hitung-skor/ajukan → `requireStatus(row, "draft", "PENGAJUAN_CLOSED")`; tolak → `requireStatus(row, "dinilai", "PENGAJUAN_TIDAK_SIAP_DIKURASI")`. `num` sudah didefinisikan di atas `toPengajuan`; letakkan dua fungsi baru **setelah** `findPengajuan`.
2. `PENGAJUAN_COLUMNS`: tambahkan `p.alasan_tolak, p.ditolak_at,` setelah `p.catatan,`.
3. `toPengajuan`: setelah `catatan: row.catatan,` tambah `alasanTolak: row.alasan_tolak ?? null,` dan `ditolakAt: row.ditolak_at ?? null,`.
4. `listPengajuan`: ganti klausa `WHERE` menjadi
   ```sql
   WHERE (?::text IS NULL OR p.status = ?)
     AND (?::integer IS NULL OR t.kota_id = ?)
     AND (p.status <> 'ditolak' OR NOT EXISTS (
           SELECT 1 FROM talent_pengajuan baru
            WHERE baru.usaha = p.usaha AND baru.date_created > p.date_created))
   ```
   Binding tidak berubah.
5. `updatePengajuan`: ganti `requireOpen(existing);` → `requireStatus(existing, "draft", "PENGAJUAN_CLOSED");`. SQL `UPDATE` tetap (sudah menghapus skor dan menyetel `status = 'draft'`).
6. `scorePengajuan`: ganti `requireOpen(row);` → `requireStatus(row, "draft", "PENGAJUAN_CLOSED"); requireLengkap(row);` (keduanya **setelah** `findPengajuan(trx, id, { lock: true })` dan sebelum `pastikanUsaha`). Ubah SQL update menjadi `… rubrik_versi = ?, dinilai_at = NOW(), date_updated = NOW() WHERE id = ?` (hapus `status = 'dinilai'`). **Hapus** blok `UPDATE usaha SET talent_status = 'scouting' …` dari fungsi ini. Ubah JSDoc menjadi `/** POST /pengajuan/:id/hitung-skor — score a draft on the server; the status stays draft. */`.
7. Tambahkan export baru setelah `scorePengajuan`:
   ```js
   /** POST /pengajuan/:id/ajukan — submit a complete, scored draft to curation (BUG-006). */
   export const submitPengajuan =
     ({ database, logger }) =>
     (req, res, pemanggil) =>
       handle(logger, res, async () => {
         const id = uuidParam(req.params?.id);
         const submitted = await database.transaction(async (trx) => {
           const row = await findPengajuan(trx, id, { lock: true });
           requireStatus(row, "draft", "PENGAJUAN_CLOSED");
           await pastikanUsaha(trx, pemanggil, row.usaha);
           requireLengkap(row);
           if (row.skor_total === null || row.skor_total === undefined) {
             throw new ProgramError(409, "SKOR_BELUM_DIHITUNG", "Score the submission before submitting it.");
           }
           await trx.raw(`UPDATE talent_pengajuan SET status = 'dinilai', date_updated = NOW() WHERE id = ?`, [id]);
           await trx.raw(
             `UPDATE usaha SET talent_status = 'scouting' WHERE id = ? AND talent_status IN ('none', 'nominated')`,
             [row.usaha],
           );
           return findPengajuan(trx, id);
         });
         noStore(res);
         res.json({ data: toPengajuan(submitted) });
       });
   ```
8. `rejectPengajuan`: ganti baris `const catatan = optionalText(objectBody(req), "catatan", 2000);` dengan
   ```js
   const alasan = optionalText(objectBody(req), "alasan", 2000);
   if (!alasan) throw new ProgramError(400, "ALASAN_WAJIB", "A rejection reason is required.");
   ```
   Ganti `requireOpen(row);` → `requireStatus(row, "dinilai", "PENGAJUAN_TIDAK_SIAP_DIKURASI");`. Ganti SQL update menjadi
   ```sql
   UPDATE talent_pengajuan
      SET status = 'ditolak', alasan_tolak = ?, ditolak_oleh = ?, ditolak_at = NOW(), date_updated = NOW()
    WHERE id = ?
   ```
   dengan binding `[alasan, pemanggil.id, id]`. JSDoc: `/** POST /pengajuan/:id/tolak — reject a submitted application with a reason; the business returns to "none". */`.

Urutan transaksi semua transisi: `findPengajuan(…, { lock: true })` (`SELECT … FOR UPDATE`) → pemeriksaan status → `pastikanUsaha` → `UPDATE`. Lock baris menserialkan request paralel (R1); request kedua membaca status yang sudah berubah dan gagal 409.

### 5.3 `talent/index.js`

- Import `submitPengajuan` (urut alfabet di daftar import).
- Komentar header: tambah baris `//   POST  /v1/program/talent/pengajuan/:id/ajukan       submit a scored draft to curation`; ubah baris hitung-skor menjadi `score a draft on the server (status stays draft)`; ubah baris tolak menjadi `reject a submitted application (provinsi, reason required)`.
- Ganti `const TERBIT_BA = { peran: ["provinsi"] };` menjadi `const KEPUTUSAN = { peran: ["provinsi"] };` dan perbarui komentar `// … BA & tolak = provinsi saja …`; pakai `KEPUTUSAN` untuk `POST /berita-acara` dan `POST /pengajuan/:id/tolak`.
- Tambah `router.post("/pengajuan/:id/ajukan", terjaga(KELOLA, submitPengajuan)(context));` tepat setelah route `hitung-skor`.

### 5.4 `oas.yaml`

- `/talent/pengajuan/{id}`: deskripsi 409 → `PENGAJUAN_CLOSED (only drafts can be edited)`.
- `/talent/pengajuan/{id}/hitung-skor`: `"200": Scored draft (status stays draft)`, tambah `"409": PENGAJUAN_CLOSED`, `"422": DATA_BELUM_LENGKAP`.
- Tambah setelahnya: `/talent/pengajuan/{id}/ajukan: { post: { tags: [Talent Scouting], parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: Submitted to curation (dinilai) }, "409": { description: PENGAJUAN_CLOSED or SKOR_BELUM_DIHITUNG }, "422": { description: DATA_BELUM_LENGKAP } } } }`
- `/talent/pengajuan/{id}/tolak`: tambah `requestBody: { required: true, content: { application/json: { schema: { type: object, required: [alasan], properties: { alasan: { type: string, maxLength: 2000 } } } } } }`, response `"400": ALASAN_WAJIB`, `"409": PENGAJUAN_TIDAK_SIAP_DIKURASI`, dan catatan `provinsi only`.

### 5.5 `scripts/seed-dummy-program.sql`

Pada `INSERT INTO talent_pengajuan (…)`: tambah kolom `alasan_tolak, ditolak_at` di akhir daftar kolom (setelah `date_updated`); ubah ekspresi `catatan` menjadi `NULL`; tambah dua ekspresi di akhir `SELECT`:
`CASE WHEN d.n > 15 THEN 'dummy_Kapasitas produksi belum stabil; ajukan kembali batch berikutnya' END,`
`CASE WHEN d.n > 15 THEN now() - make_interval(days => 30 - d.n) END`.
(Nilai `ditolak_at` sama dengan `date_updated` baris itu.)

### 5.6 `apps/web/app/types/program.ts`

Pada `TalentPengajuan`, setelah `catatan: string | null;` tambah `alasanTolak: string | null;` dan `ditolakAt: string | null;`.

### 5.7 `apps/web/app/constants/PROGRAM.ts`

`PENGAJUAN_STATUS.dinilai.label` → `"Siap dikurasi"` (pill selaras label tab; "Dinilai" kini tidak berarti apa-apa karena draft juga dapat berskor).

### 5.8 `ajukan/[usahaId].vue`

**Matriks mode** (`mode` computed):

| Mode | Syarat | Fieldset | Simpan Draft | Hitung Skor | Ajukan ke Kurasi | Ajukan ulang | Banner |
|---|---|---|---|---|---|---|---|
| `baru` | `data.pengajuan === null` | aktif | tampil | tampil | tampil, nonaktif (belum ada skor) | — | — |
| `draft` | `pengajuan.status === "draft"` | aktif | tampil | tampil | tampil, aktif bila `bisaAjukan` | — | — |
| `dinilai` | `pengajuan.status === "dinilai"` | nonaktif | — | — | — | — | info: "Pengajuan sudah diajukan dan menunggu kurasi Admin Provinsi. Isian tidak dapat diubah." |
| `disetujui` | `pengajuan.status === "disetujui"` | nonaktif | — | — | — | — | existing ("…sudah disetujui melalui Berita Acara…") |
| `ditolak` | `data.pengajuan.status === "ditolak"` | nonaktif | — | — | — | tampil | merah, `role="alert"`: "Pengajuan ditolak pada {ditolakAt WIB}. Alasan: {alasanTolak ?? 'tidak dicatat'}" + "Ajukan ulang membuat draft baru berisi isian di bawah." |

State yang terbawa antar mode: `ditolak → Ajukan ulang` sengaja menyalin seluruh isian (termasuk `suratKomitmen` uuid dan `catatan`) ke `POST /talent/pengajuan`; setelah sukses mode menjadi `draft`. Pindah usaha (param route berbeda) me-remount halaman (lihat R12).

Edit berurutan:
1. `ERRORS`: ubah `PENGAJUAN_CLOSED` → `"Pengajuan ini sudah diajukan atau diputuskan sehingga tidak dapat diubah."`; tambah `DATA_BELUM_LENGKAP: "Lengkapi kapasitas produksi (lebih dari 0) dan satuan terlebih dahulu."`, `SKOR_BELUM_DIHITUNG: "Hitung skor dari isian terbaru sebelum mengajukan."`.
2. Pisahkan pengisian form: buat `function isiForm(source: TalentPengajuan)` berisi semua baris penugasan `form.* = source.*` dari `syncFrom` lama (termasuk `suratName`). `syncFrom(value)`:
   ```ts
   function syncFrom(value: TalentPengajuan | null) {
     pengajuan.value = value && value.status !== "ditolak" ? value : null;
     if (value) isiForm(value);
     tersimpan.value = JSON.stringify(payload());
   }
   ```
   Deklarasikan `const tersimpan = ref("");` **sebelum** `watch(… syncFrom, { immediate: true })` dan `payload()` dipindah ke atas `syncFrom` (fungsi hoisted — cukup pastikan `tersimpan` dideklarasikan sebelum watch).
3. Ganti `readOnly`/`rejected` dengan:
   ```ts
   type Mode = "baru" | "draft" | "dinilai" | "disetujui" | "ditolak";
   const mode = computed<Mode>(() => {
     if (data.value?.pengajuan?.status === "ditolak") return "ditolak";
     return pengajuan.value ? pengajuan.value.status as Exclude<Mode, "baru" | "ditolak"> : "baru";
   });
   const readOnly = computed(() => ["dinilai", "disetujui", "ditolak"].includes(mode.value));
   const berubah = computed(() => JSON.stringify(payload()) !== tersimpan.value);
   ```
   `pengajuan.value.status` di sini tidak pernah `ditolak` (difilter di `syncFrom`); bila typecheck menolak cast, gunakan peta eksplisit `{ draft: "draft", dinilai: "dinilai", disetujui: "disetujui" }[pengajuan.value.status]`.
4. Validasi field: 
   ```ts
   const galat = reactive<{ kapasitas: string; satuan: string }>({ kapasitas: "", satuan: "" });
   function validasiWajib(): boolean {
     const kapasitas = Number(String(form.kapasitasProduksi).trim());
     galat.kapasitas = String(form.kapasitasProduksi).trim() !== "" && kapasitas > 0 ? "" : "Kapasitas produksi wajib diisi dan lebih dari 0.";
     galat.satuan = form.satuan.trim() ? "" : "Satuan wajib diisi.";
     return !galat.kapasitas && !galat.satuan;
   }
   watch(() => form.kapasitasProduksi, () => (galat.kapasitas = ""));
   watch(() => form.satuan, () => (galat.satuan = ""));
   const bisaAjukan = computed(() =>
     mode.value === "draft" && Boolean(pengajuan.value?.skor) && !berubah.value &&
     Number(String(form.kapasitasProduksi).trim()) > 0 && Boolean(form.satuan.trim()));
   ```
   Pada `UiInput` kapasitas: `:aria-invalid="Boolean(galat.kapasitas)" aria-describedby="kapasitas-galat"` + `<p v-if="galat.kapasitas" id="kapasitas-galat" class="text-xs text-destructive">{{ galat.kapasitas }}</p>`; sama untuk satuan (`satuan-galat`). Ubah label menjadi "Kapasitas produksi per bulan (wajib)" dan "Satuan (wajib)" — **jangan** ubah `id` input; test memakai `getByLabel("Kapasitas produksi per bulan")` yang tetap cocok sebagai substring.
5. Busy tunggal (R6): hapus `saving`/`scoring`; tambah `const busy = ref<null | "simpan" | "hitung" | "ajukan" | "ulang">(null);`. Setiap aksi dimulai `if (busy.value) return; busy.value = "<aksi>"; message.value = null;` **sebelum** `await` pertama, dan `finally { busy.value = null; }`.
   - `saveDraft()`: busy `"simpan"`; `await save()`; sukses → `tersimpan.value = JSON.stringify(payload())`; pesan existing.
   - `hitungSkor()`: `if (!validasiWajib()) return;` (sebelum klaim busy); busy `"hitung"`; `save()` → `hitung-skor` (pola `Promise.all` 900 ms tetap) → `pengajuan.value = scored; tersimpan.value = JSON.stringify(payload()); await refresh();` → pesan sukses `"Skor dihitung. Periksa hasilnya, lalu tekan Ajukan ke Kurasi."`.
   - Baru `ajukan()`: `if (!pengajuan.value || !bisaAjukan.value) return;` busy `"ajukan"`; `const submitted = await directus.request(endpoint<TalentPengajuan>(\`/v1/program/talent/pengajuan/${pengajuan.value.id}/ajukan\`, { method: "POST" }))`; `pengajuan.value = submitted; await refresh();` → pesan sukses `"Pengajuan dikirim ke kurasi dan berstatus Siap dikurasi."`; gagal → `fail(cause, "Pengajuan tidak dapat diajukan. Coba lagi.")`.
   - Baru `ajukanUlang()`: busy `"ulang"`; `const created = await directus.request(endpoint<TalentPengajuan, TalentPengajuanInput & { usaha: string }>("/v1/program/talent/pengajuan", { method: "POST", body: { ...payload(), usaha: usahaId } }))`; `await refresh();` (watch `syncFrom` lalu memuat draft baru dan me-reset `tersimpan`) → pesan `"Draft baru dibuat dari pengajuan yang ditolak. Perbarui isian, hitung skor, lalu ajukan."`; gagal → `fail(cause, "Draft baru tidak dapat dibuat. Coba lagi.")`.
   - Reset pesan/state hanya setelah `await` sukses (R4).
6. Template:
   - `UiCardDescription` diganti per `mode` sesuai matriks (banner `ditolak` memakai `<p role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">`; tanggal via `waktuWib(data.pengajuan.ditolakAt)` dengan `const waktuWib = (iso: string | null) => iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "—";`). Mode `draft`/`baru` tetap memakai teks "Mengubah isian akan menghapus skor sebelumnya sampai skor dihitung ulang."
   - `<fieldset :disabled="readOnly || busy !== null" …>`.
   - Tombol: blok `v-if="mode === 'baru' || mode === 'draft'"` berisi Simpan Draft (`:disabled="busy !== null"`, label `busy === 'simpan' ? 'Menyimpan…' : 'Simpan Draft'`), Hitung Skor (`type="submit"`, spinner bila `busy === 'hitung'`), dan `UiButton type="button" :disabled="busy !== null || !bisaAjukan" @click="ajukan"` berlabel `busy === 'ajukan' ? 'Mengajukan…' : 'Ajukan ke Kurasi'` dengan ikon `Send` dari `@lucide/vue`. Di bawahnya `<p v-if="mode === 'draft' && pengajuan?.skor && berubah" class="text-xs text-muted-foreground">Isian berubah sejak skor dihitung. Hitung ulang skor sebelum mengajukan.</p>`.
   - Blok `v-if="mode === 'ditolak'"`: `UiButton type="button" :disabled="busy !== null" @click="ajukanUlang"` berlabel `busy === 'ulang' ? 'Membuat draft…' : 'Ajukan ulang'`.
   - Kartu skor: `v-if="busy === 'hitung'"` menggantikan `v-if="scoring"`. Setelah `<ProgramScoreBars …/>` tambahkan `<p v-if="pengajuan?.skor" class="mt-3 text-xs text-muted-foreground">Skor Finansial memakai omzet tahunan dari data SIDT, Legalitas memakai NIB dan sertifikat dari data SIDT, SDM memakai jumlah tenaga kerja SIDT. Karena itu skor dapat bernilai walau isian formulir masih sedikit.</p>`. Teks kosong: "Belum dihitung. Lengkapi data wajib lalu tekan **Hitung Skor**."

### 5.9 `kurasi.vue`

1. Tombol Tolak per baris: `v-if="isProvinsi && row.status === 'dinilai'"`.
2. Tab Ditolak: dalam sel Status, setelah pill, tambahkan `<p v-if="row.status === 'ditolak' && row.alasanTolak" class="mt-1 max-w-[16rem] text-xs text-muted-foreground line-clamp-2" :title="row.alasanTolak">Alasan: {{ row.alasanTolak }}</p>`.
3. State dialog: tambah `const tolakGalatServer = ref("");`. `mintaTolak(row)` juga mengosongkan `tolakGalatServer`. `watch(alasanTolak, () => { tolakError.value = ""; tolakGalatServer.value = ""; });`.
4. `tolak()`:
   ```ts
   async function tolak() {
     const row = tolakTarget.value;
     if (!row || rejecting.value) return;
     const alasan = alasanTolak.value.trim();
     if (!alasan) { tolakError.value = "Alasan penolakan wajib diisi."; return; }
     rejecting.value = row.id;
     tolakGalatServer.value = "";
     try {
       await directus.request(endpoint<TalentPengajuan, { alasan: string }>(`/v1/program/talent/pengajuan/${row.id}/tolak`, { method: "POST", body: { alasan } }));
       tolakTarget.value = null;
       message.value = { tone: "success", text: `Pengajuan ${row.usahaInfo.nama} ditolak.` };
       await refresh();
     } catch (cause) {
       const code = requestErrorCode(cause);
       tolakGalatServer.value =
         code === "PENGAJUAN_TIDAK_SIAP_DIKURASI" ? "Pengajuan ini sudah diputuskan atau belum diajukan. Tutup dialog lalu muat ulang daftar."
         : code === "ALASAN_WAJIB" ? "Alasan penolakan wajib diisi."
         : "Pengajuan tidak dapat ditolak. Coba lagi.";
     } finally {
       rejecting.value = null;
     }
   }
   ```
   Dialog tetap terbuka saat gagal; alasan dipertahankan (R4).
5. Dialog (BUG-010):
   - `<UiDialog :open="Boolean(tolakTarget)" @update:open="(value) => !value && rejecting === null && (tolakTarget = null)">` (tidak dapat ditutup lewat X/overlay/Escape saat proses).
   - `<UiDialogContent v-if="tolakTarget" class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">`.
   - `<UiDialogTitle class="pr-8 leading-snug break-words">Tolak pengajuan {{ tolakTarget.usahaInfo.nama }}?</UiDialogTitle>`.
   - Deskripsi: `"Pengajuan berpindah ke tab Ditolak dan usaha kembali berstatus Belum diajukan. Petugas pengaju dapat melihat alasan ini dan mengajukan ulang."`
   - Textarea: `class="max-h-40"`, placeholder `"Jelaskan alasan penolakan untuk petugas pengaju"`, `:aria-invalid="Boolean(tolakError)"`, `aria-describedby="alasan-tolak-galat"`; `<p v-if="tolakError" id="alasan-tolak-galat" role="alert" …>`.
   - Di atas footer: `<p v-if="tolakGalatServer" role="alert" class="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{{ tolakGalatServer }}</p>`.
   - Footer: hapus `class="gap-2"` (sudah di kelas dasar). Batal `:disabled="rejecting !== null"`; konfirmasi `:disabled="rejecting !== null || !alasanTolak.trim()"`.

### 5.10 `mock-program.mjs` (blok talent)

- `POST /talent/pengajuan`: objek `created` tambah `alasanTolak: null, ditolakAt: null`.
- `PATCH /talent/pengajuan/:id`: `if (item.status !== "draft") return json(route, 409, "PENGAJUAN_CLOSED");` lalu `Object.assign(item, body, { status: "draft", skor: null });`.
- `POST …/hitung-skor`: `if (item.status !== "draft") return json(route, 409, "PENGAJUAN_CLOSED"); if (!(Number(item.kapasitasProduksi) > 0) || !String(item.satuan ?? "").trim()) return json(route, 422, "DATA_BELUM_LENGKAP");` set `item.skor` (nilai sama) dan `item.dinilaiAt`; **jangan** ubah `item.status` maupun `state.usaha.talentStatus`.
- Baru `POST …/ajukan` (regex `^\/talent\/pengajuan\/([^/]+)\/ajukan$`): `draft` wajib (409 `PENGAJUAN_CLOSED`), `skor` wajib (409 `SKOR_BELUM_DIHITUNG`), lalu `item.status = "dinilai"; state.usaha.talentStatus = "scouting";` → 200 item. Letakkan **sebelum** regex `/tolak`.
- `POST …/tolak`: `if (!String(body?.alasan ?? "").trim()) return json(route, 400, "ALASAN_WAJIB"); if (item.status !== "dinilai") return json(route, 409, "PENGAJUAN_TIDAK_SIAP_DIKURASI"); Object.assign(item, { status: "ditolak", alasanTolak: body.alasan.trim(), ditolakAt: new Date().toISOString() }); state.usaha.talentStatus = "none";`. Tambahkan dukungan injeksi kegagalan: `if (state.failNext?.[path]) { delete state.failNext[path]; return json(route, 500, "INTERNAL_SERVER_ERROR"); }` di awal handler tolak, dan inisialisasi `failNext: {}` di `createProgramState`.
- `GET /talent/usaha/…`: `latest` = baris dengan `dateCreated` terbesar (`[...].sort((a, b) => a.dateCreated.localeCompare(b.dateCreated)).at(-1)`).
- `GET /talent/pengajuan`: setelah filter status, buang baris `ditolak` yang memiliki baris lain untuk usaha sama dengan `dateCreated` lebih besar.

### 5.11 `test/talent.test.js`

- Kedua `assert.equal(routes.length, 8);` → `9`.
- `ekspektasi`: tambah `["POST", "/pengajuan/:id/ajukan", ["kabkota", "provinsi"]]`; ubah tolak menjadi `["POST", "/pengajuan/:id/tolak", ["provinsi"]]`.

### 5.12 `test/pg/talent-support.mjs`

`buatPengajuan(db, { usahaId, status = "draft", skor = null, kapasitas = null, satuan = null, dateCreated = null, catatan = null } = {})`: tambahkan `kapasitas_produksi`, `satuan`, `catatan` ke `row`; bila `dateCreated` diberikan set `row.date_created = dateCreated`.

### 5.13 `test/pg/talent.test.js`

- Konstanta `const LENGKAP = { kapasitas: 10, satuan: "kg" };`.
- `"ubah pengajuan…"`: baris awal → `buatPengajuan(db, { usahaId: subang.id, status: "draft", skor: SKOR })`; PATCH 200 skor null status draft. Tambah: `buatPengajuan(db, { usahaId: bandung.id, status: "dinilai", skor: SKOR })` (pakai `provinsi`) PATCH → 409 `PENGAJUAN_CLOSED`. Sisa kasus tetap.
- Ganti `"hitung-skor…"` menjadi `"hitung-skor: skor tersimpan, status tetap draft, usaha tetap nominated; data tak lengkap 422"`: kasus body tanpa `satuan` → hitung 422 `DATA_BELUM_LENGKAP` dan `skor_total` tetap null; lalu PATCH `{ kapasitasProduksi: 10, satuan: "kg", literasiQris: true, literasiPembukuanDigital: true, suratKomitmen: surat.id }` → hitung 200, `status === "draft"`, `skor.pasar === 100`, `talent_status === "nominated"`. Kapasitas `0` → 422.
- Baru `"ajukan: draft berskor menjadi dinilai dan usaha scouting; tanpa skor 409; dinilai 409; tak lengkap 422"`: `buatPengajuan({…, status: "draft", ...LENGKAP})` tanpa skor → 409 `SKOR_BELUM_DIHITUNG`; dengan skor → 200 `dinilai` + `scouting`; ulang → 409 `PENGAJUAN_CLOSED`; draft berskor tanpa satuan → 422.
- Baru (R1) `"ajukan paralel: tepat satu 200"`: draft berskor lengkap; `Promise.all([ajukan, ajukan, ajukan])` → status `[200, 409, 409]`.
- Baru (R1/R5) `"ajukan paralel dengan PATCH: tepat satu berhasil dan status konsisten"`: draft berskor lengkap; `Promise.all([ajukan, patch({kapasitasProduksi: 20, satuan: "kg"})])`; tepat satu 200; baris akhir memenuhi `(status === "dinilai" && skor_total !== null) || (status === "draft" && skor_total === null)`.
- Ganti `"tolak…"` menjadi `"tolak: hanya provinsi, alasan wajib, hanya dinilai; catatan pengaju utuh"`: `buatPengajuan({ status: "dinilai", skor: SKOR, catatan: "catatan pengaju" })`; kabkota → 403 (`hasil.nextError?.statusCode ?? hasil.res.statusCode`); provinsi body `{}` → 400 `ALASAN_WAJIB`; body `{ alasan: "   " }` → 400 `ALASAN_WAJIB`; draft → 409 `PENGAJUAN_TIDAK_SIAP_DIKURASI`; dinilai + `{ alasan: "belum siap" }` → 200, `alasanTolak === "belum siap"`, `ditolakAt` string, `catatan === "catatan pengaju"`, kolom `ditolak_oleh === provinsi.id`, usaha `none`; ulang → 409 `PENGAJUAN_TIDAK_SIAP_DIKURASI`.
- Baru (BUG-009) `"daftar ditolak hanya penolakan terbaru per usaha"`: subang: `ditolak` (`dateCreated: 2026-09-01`) + `disetujui` (`2026-09-10`, skor); bandung: `ditolak` (`2026-09-05`). Provinsi `GET /pengajuan?status=ditolak` → hanya id bandung.

### 5.14 `talent.spec.ts`

1. Ganti `page.locator('select[name="kesiapan-bpom"]').selectOption("dalam_proses");` dengan
   ```ts
   await page.getByRole("combobox", { name: /BPOM/ }).click();
   await page.getByRole("option", { name: "Dalam proses" }).click();
   ```
   (UiSelect P6 merender `SelectTrigger role="combobox"` di dalam `<label>` "BPOM"; `<select>` tersembunyi BubbleSelect tidak lolos actionability.)
2. Test submission yang ada: setelah asersi skor, tambah `await expect(page.getByText("Draft", { exact: true })).toBeVisible();` lalu klik `getByRole("button", { name: "Ajukan ke Kurasi" })`, asersi request `POST /talent/pengajuan/<id>/ajukan` tercatat, pill `"Siap dikurasi"` tampil, `getByLabel("Kapasitas produksi per bulan")` `toBeDisabled()`, dan tombol "Simpan Draft" `toHaveCount(0)`.
3. Baru `"TS-15/TS-17: Hitung Skor tanpa kapasitas menampilkan pesan per field dan tidak memanggil server"`: kosongkan kapasitas, isi satuan, klik Hitung Skor → teks "Kapasitas produksi wajib diisi dan lebih dari 0." tampil, input `aria-invalid="true"`, tidak ada request `/hitung-skor`.
4. Baru (R5) `"mengubah isian setelah Hitung Skor menonaktifkan Ajukan"`: hitung → ubah kapasitas → Ajukan `toBeDisabled()` + teks "Isian berubah sejak skor dihitung…".
5. Baru (R6) `"klik ganda Ajukan hanya mengirim satu request"`: setelah hitung, `dblclick` Ajukan → jumlah request `/ajukan` = 1.
6. Baru (BUG-008/006) `"pengajuan ditolak menampilkan alasan dan Ajukan ulang membuat draft terisi"`: `state.pengajuan.push({ …status: "ditolak", kapasitasProduksi: 300, satuan: "pcs", alasanTolak: "Kapasitas belum stabil", ditolakAt: "2026-09-30T18:30:00Z", … })` dengan `test.use({ timezoneId: "America/New_York" })` di dalam `test.describe` kecil → alert berisi "Kapasitas belum stabil" dan "1 Okt 2026"; input kapasitas berisi "300" dan nonaktif; klik "Ajukan ulang" → request `POST /talent/pengajuan` body `toMatchObject({ kapasitasProduksi: 300, satuan: "pcs" })`; kapasitas menjadi aktif.
7. Baru (BUG-007/009/010, R4) `"kurasi: Tolak hanya di Siap dikurasi, alasan wajib, gagal tetap di dialog, tab Ditolak menampilkan alasan terbaru"` (provinsi): tab Draft (baris draft) → `getByRole("button", { name: "Tolak" })` `toHaveCount(0)`; tab Siap dikurasi → Tolak → konfirmasi `toBeDisabled()`; isi alasan; set `state.failNext["/talent/pengajuan/<id>/tolak"] = true`; konfirmasi → dialog tetap tampil, alert "Pengajuan tidak dapat ditolak. Coba lagi." di dalam `getByRole("dialog")`, textarea masih berisi alasan; konfirmasi lagi → dialog tertutup; tab Ditolak → "Alasan: …" tampil. Lalu tambah baris `disetujui` lebih baru untuk usaha sama dan `reload` → tab Ditolak menampilkan "Belum ada pengajuan dengan status ini."
8. Baru `"kabkota tidak melihat Tolak"`: role kabkota, baris dinilai → `getByRole("button", { name: "Tolak" })` `toHaveCount(0)`.
9. Baru (R12) `"pindah usaha lewat navigasi klien me-remount form"`: buka ajukan `USAHA_ID`, isi kapasitas "777"; `await page.evaluate((path) => { history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, "/dashboard/talent/ajukan/00000000-0000-0000-0000-000000000099");` → alert "Data usaha tidak tersedia…" tampil dan `page.getByLabel("Kapasitas produksi per bulan")` `toHaveCount(0)` (form usaha pertama tidak tertinggal). Asersi `expect(page.url()).toContain("000000000099")` memastikan navigasi klien terjadi tanpa reload penuh (`page.on("load")` tidak terpicu — catat counter load sebelum/sesudah dan harus sama).
   Dasar keputusan R12: `app.vue` merender `<NuxtPage />` tanpa `page-key`; halaman tidak menyetel `definePageMeta({ key })`; Nuxt `generateRouteKey` (`node_modules/nuxt/dist/pages/runtime/utils.js`) memakai path ter-interpolasi param, sehingga `usahaId` berbeda = komponen baru; key `useAsyncData` juga memuat `usahaId`.
10. Data seed baris `dinilai` di dua test lama: tambahkan `alasanTolak: null, ditolakAt: null`.

### 5.15 `operasional.directus.spec.ts`

Dalam blok `if (await hitungBtn.isVisible()) { … }`, setelah asersi `skor-rekomendasi`: 
```ts
await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();
await expect(page.getByText("Siap dikurasi", { exact: true })).toBeVisible();
```

## 6. Kasus campuran/negatif/batas/lintas peran/lifecycle/gagal

| Kasus | Bukti |
|---|---|
| Data lama `dinilai` (sebelum deploy) | tetap di Siap dikurasi; dapat ditolak/di-BA (pg test BA existing) |
| Data lama `ditolak` dengan `catatan` | backfill → `alasan_tolak` (migration up pada DB seed; cek SQL §7) |
| Draft lama tanpa skor | Ajukan nonaktif; server 409 `SKOR_BELUM_DIHITUNG` |
| Kapasitas 0 / kosong / satuan spasi | 422 server, pesan field klien |
| Alasan spasi saja / 2001 karakter | 400 `ALASAN_WAJIB` / 400 `INVALID_PAYLOAD` (maxlength 2000 di klien) |
| Kabkota tolak via API | 403 |
| Dua tab: Ajukan vs PATCH | R1 test |
| Gagal jaringan saat tolak | dialog tetap, alasan utuh (e2e 7) |
| Ditolak dua kali untuk usaha sama | hanya yang terbaru tampil (NOT EXISTS) |
| Surat komitmen dari pengajuan lama | uuid disalin; bila file sudah dihapus, FK `ON DELETE SET NULL` membuat uuid lama null sebelum disalin |

## 7. Perintah validasi dan hasil yang diharapkan

```bash
# anchor sebelum edit (harus menemukan tepat 1 baris masing-masing)
grep -n "const OPEN_STATUS" services/directus/extensions/program/src/endpoints/talent/service.js
grep -n "catatan = COALESCE(?, catatan)" services/directus/extensions/program/src/endpoints/talent/service.js
grep -n "row.status === 'dinilai' || row.status === 'draft'" "apps/web/app/pages/(private)/dashboard/talent/kurasi.vue"
grep -n 'selectOption("dalam_proses")' apps/web/tests/e2e/talent.spec.ts

# setelah edit
cd services/directus/extensions/program && pnpm test            # semua hijau; talent.test.js 9 route
cd services/directus && pnpm test                               # route-manifest, public-grants, cakupan hijau
bash scripts/test-db-template.sh                                # template ulang (migration baru)
DISKUK_TEST_PG_URL="postgres://<DB_USER>:<DB_PASSWORD>@127.0.0.1:15432/postgres" \
  node --test services/directus/extensions/program/test/pg/talent.test.js services/directus/extensions/program/test/pg/passport.test.js
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit
cd apps/web && pnpm exec playwright test tests/e2e/talent.spec.ts   # semua hijau
grep -n "requireOpen\|OPEN_STATUS" services/directus/extensions/program/src/endpoints/talent/service.js   # 0 baris
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-4.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 4   # outside: []
```

Migration pada stack lokal: `cd services/directus && pnpm dbm:l` → lalu
`psql … -c "SELECT status, count(*) FILTER (WHERE alasan_tolak IS NOT NULL) FROM talent_pengajuan GROUP BY status"` → setiap baris `ditolak` ber-`catatan` non-null kini punya `alasan_tolak`. Uji `pnpm dbm:d` sekali lalu `pnpm dbm:u` (kolom hilang lalu kembali).

## 8. Bukti runtime/browser/migration

- Browser (stack lokal, akun dummy provinsi & kabkota): flow §5 baris BUG-006…010 di `main_plan.md`; simpan `evidence/BUG-006-after-1.png` (form draft + tombol Ajukan), `BUG-006-after-2.png` (Siap dikurasi read-only), `BUG-007-after-1.png` (tab Draft tanpa Tolak), `BUG-008-after-1.png` (banner alasan), `BUG-009-after-1.png` (tab Ditolak setelah ajukan ulang & BA), `BUG-010-after-1.png` (dialog 375 px dan 1280 px), `TS-15-after-1.png`.
- Authenticated API: `curl -b <cookie kabkota> -X POST /panel/v1/program/talent/pengajuan/<id>/tolak -d '{"alasan":"x"}'` → 403.
- Bila stack/DB test tidak tersedia: catat "pg test & migration unproven" di `execution_log.md` dan **jangan commit** (kondisi berhenti main_plan §10).

## 9. Rollback & handoff

Rollback: `git revert <commit phase 4>`; pada DB lokal jalankan `pnpm dbm:d` sekali sebelum revert (menghapus tiga kolom; alasan yang tersimpan sejak migration hilang — catat). Handoff ke phase 5: `kurasi.vue` kini memiliki `tolakGalatServer`, gate Tolak `dinilai` saja, dan pill "Siap dikurasi"; phase 5 hanya boleh mengubah blok kartu "Berita Acara" dan script yang menyertainya.

## 10. Aturan scope-amendment

Sebelum menyentuh file di luar §2, berhenti dan laporkan (path, alasan, diff yang dibutuhkan). `scope_guard.py check` harus `outside: []` sebelum commit.
