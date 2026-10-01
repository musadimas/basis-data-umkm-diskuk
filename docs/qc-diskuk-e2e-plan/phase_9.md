# Phase 9 — Kurasi Katalog: aksi per status, LOI, grant baca untuk pengguna login (BUG-019, BUG-020, BUG-021)

## 1. Tujuan, dependensi, dan hasil yang dapat diamati

**Tujuan.**
- (a) Dialog "Lihat"/"Kurasi" hanya menawarkan aksi yang valid untuk status produk. Server menolak transisi lain dengan update bersyarat (keputusan §1 #8).
- (b) Tab Letter of Intent punya status, dialog detail, kontak (hanya bila pengirim setuju dihubungi), dan perubahan status Baru → Ditindaklanjuti → Ditutup.
- (c) Pengguna yang sedang login (provinsi, kabkota, pendamping, umkm, dan investor) dapat membuka `/katalog` dan `/katalog/:id`. Grant baca katalog (+`kota`, `faq`) disalin dari Public policy ke policy aplikasi dan policy investor.

**Dependensi.** Phase 8 sudah ter-commit (urutan §6 dan urutan nama migration `20261001B` → `20261001C`). Tidak ada file yang dipakai bersama phase lain.

**Hasil yang dapat diamati.**

| Tempat | Yang terlihat |
|---|---|
| Tab Tayang | Dialog berisi "Rekomendasikan ke Marketplace", "Turunkan", dan tautan "Lihat di katalog". Tidak ada "Tayangkan". |
| Tab Rekomendasi Marketplace | "Turunkan" dan tautan katalog. |
| Tab Ditolak | Read-only dengan catatan kurasi, hanya tombol "Tutup". |
| Server | `ditolak → tayang` mengembalikan 409 `TRANSISI_KURASI_TIDAK_VALID`. |
| Tab LOI | Pill status, tombol "Detail", dialog dengan `mailto:`/`tel:`, tombol "Tandai ditindaklanjuti" dan "Tutup LOI". |
| Login provinsi → Produk Katalog → "Lihat di katalog" | Halaman detail produk lengkap dengan foto, bukan "Produk tidak ditemukan". |

## 2. Manifest file (tertutup)

| Aksi | Path |
|---|---|
| modify | `services/directus/extensions/program/src/endpoints/katalog/rules.js` |
| modify | `services/directus/extensions/program/src/endpoints/katalog/service.js` |
| modify | `services/directus/extensions/program/src/endpoints/katalog/index.js` |
| modify | `services/directus/extensions/program/src/oas.yaml` |
| modify | `services/directus/extensions/program/test/katalog-rules.test.js` |
| modify | `services/directus/extensions/program/test/katalog.test.js` |
| create | `services/directus/extensions/program/test/pg/katalog-transisi.test.js` |
| create | `services/directus/migrations/20261001C-katalog-baca-pengguna-login.js` |
| create | `services/directus/test/katalog-grant-login.contract.test.mjs` |
| modify | `apps/web/app/pages/(private)/dashboard/katalog/kurasi.vue` |
| modify | `apps/web/app/lib/katalog.ts` |
| modify | `apps/web/app/constants/PROGRAM.ts` |
| modify | `apps/web/app/types/program.ts` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| modify | `apps/web/tests/e2e/katalog.spec.ts` |
| modify | `apps/web/tests/e2e/katalog-publik.directus.spec.ts` |

## 3. Simbol dan anchor pencarian

- `katalog/rules.js`: `KURASI_STATUS`, `KURASI_KEPUTUSAN`, `STATUS_TAYANG`, `validasiKurasi`.
- `katalog/service.js`:
  - `async kurasiProduk(pemanggil, produkIdRaw, body)`: `await findProduk(trx, id, { lock: true })` lalu `UPDATE produk SET status_kurasi = ?, … WHERE id = ?`, lalu `pindahkanFoto`.
  - `async daftarLoi(pemanggil)`: SELECT sudah mengembalikan `email`, `telepon`, `"persetujuanKontak"`, `status`.
  - `const isCurator`.
  - Komentar `ID_LIST` di `talent/service.js`: Knex mengembangkan binding array menjadi daftar nilai, jadi daftar dikirim sebagai satu teks JSON. Pola yang sama dipakai di sini.
- `katalog/index.js`: `router.get("/loi", jalur(KELOLA, …))`, `const KURASI = { peran: ["provinsi"] }`, header komentar daftar route.
- `src/oas.yaml`: baris `/katalog/produk/{id}/kurasi:` dan `/katalog/loi:`.
- `migrations/20260926K-create-katalog.js`: `KATALOG_FOLDER_ID = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"`, `PUBLIC_GRANTS` (produk, produk_foto, directus_files).
  - `20260926R-katalog-detail-publik.js` melebarkan field produk dan menambah `kota`.
  - `20260926M-create-kegiatan-faq.js` menambah `faq`, `kegiatan`, `kontak_hotline`.
  - `20260927B-klinik-audit-dan-faq.js` menambah `faq.date_updated`.
- `migrations/20260926I-create-talent-scouting.js`: policy aplikasi sudah punya `directus_files read` dengan `{"uploaded_by":{"_eq":"$CURRENT_USER"}}` dan fields `*`.
- `services/directus/test/public-grants.contract.test.mjs`: hanya menyaring SQL yang cocok dengan `/role IS NULL AND a\."user" IS NULL/i`. Migration baru memakai alias `pub`, sehingga **tidak** terklasifikasi sebagai grant Public.
- `pages/(public)/katalog/[id].vue`: `readItem("produk", id, …)` dengan `catch` → `null` → "Produk tidak ditemukan". Tidak diubah.
- `pages/(public)/katalog/index.vue`: `readItems("produk")`, `aggregate("produk")`, `readItems("kota")`.
- `kurasi.vue`:
  - `useAsyncData("katalog:loi"` (tanpa `pending`/`error`)
  - `function open`, `async function decide`
  - `<UiDialogFooter class="gap-2">` dengan tiga tombol
  - tombol baris `{{ item.statusKurasi === "menunggu" ? "Kurasi" : "Lihat" }}`
- `lib/katalog.ts`: `PESAN_KATALOG`, `katalogApi().daftarLoi`, `putuskanKurasi`, `isTayang`, `KURASI_ANTREAN`.
- `types/program.ts::ProdukLoi`: belum ada `persetujuanKontak`.
- `constants/PROGRAM.ts::KURASI_STATUS`: pola meta `{ label, className }`.
- `tests/fixtures/mock-program.mjs`: handler `POST /katalog/produk/:id/kurasi` (pakai `validasiKurasi`), `GET /katalog/loi`, `POST /katalog/loi` (`state.loi.push`).

## 4. Kontrak saat ini → kontrak akhir

### Transisi kurasi produk

| Keputusan | Status asal yang sah | Catatan |
|---|---|---|
| `tayang` | `menunggu` | — |
| `rekomendasi_marketplace` | `menunggu`, `tayang` | — |
| `ditolak` | `menunggu`, `tayang`, `rekomendasi_marketplace` | catatan wajib (`CATATAN_WAJIB`, tetap) |

- Asal tidak sah → 409 `TRANSISI_KURASI_TIDAK_VALID`, tanpa perubahan apa pun (foto tidak dipindah).
- `ditolak` kembali ke `menunggu` hanya lewat `editProduk` oleh pemilik (tidak berubah).
- Produk tidak ada → 404 `PRODUK_NOT_FOUND` (tetap).

### LOI

**Route baru** `PATCH /v1/program/katalog/loi/:id`. Peran `KURASI` (provinsi). Body `{ status: "ditindaklanjuti" | "ditutup" }`.

| Status tujuan | Status asal yang sah |
|---|---|
| `ditindaklanjuti` | `baru` |
| `ditutup` | `baru`, `ditindaklanjuti` |

Respons dan error:
- Sukses → `{ data: { id, status } }`.
- `id` bukan UUID → 400 `INVALID_ID`.
- `status` di luar dua nilai → 400 `INVALID_PAYLOAD` (`oneOf`).
- LOI tidak ada → 404 `LOI_NOT_FOUND`.
- Asal tidak sah → 409 `TRANSISI_LOI_TIDAK_VALID`.

`GET /loi` tidak berubah. Tipe klien ditambah `persetujuanKontak: boolean`.

### Grant baca untuk pengguna login

Migration `20261001C` menyalin baris `read` milik Public policy untuk koleksi `produk`, `produk_foto`, `kota`, `faq`, dan `directus_files`. Khusus `directus_files`, hanya baris yang `permissions` = `{"folder":{"_eq":"6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"}}` yang disalin.

- Salinan ditempatkan ke policy `9325db4b-9518-41db-b122-8c667f2ce510` (aplikasi) dan `89167fa4-30ad-4aec-9d97-d5256d5518df` (investor).
- `permissions`, `validation`, `presets`, dan `fields` identik dengan baris Public, termasuk pelebaran dari migration R dan 27B karena disalin saat migration berjalan.
- Idempoten lewat `NOT EXISTS` pada (policy, collection, action, permissions).
- `down` menghapus persis baris itu.

**Temuan lain dengan akar masalah sama.**
- `kota` dibaca `katalog/index.vue` (daftar wilayah) dan `faq` dibaca `faq.vue`. Keduanya hanya punya grant Public, sehingga rusak untuk pengguna login dengan cara yang sama.
- `kegiatan`, `kontak_hotline`, `talent_passport` (verifikasi `/passport/:kode`) tidak dibaca lewat `/items` oleh frontend (`rg "readItems?\(|aggregate\(" apps/web/app` hanya menemukan `analitik_view`, `faq`, `produk`, `kota`). Ketiganya **tidak** disentuh.

**Waktu.** Tidak ada kolom waktu baru. `dateCreated` LOI tampil dengan `Intl.DateTimeFormat("id-ID", { dateStyle: "medium" })` (pola yang ada).

## 5. Edit berurutan (keputusan sudah diambil)

### 5.1 `katalog/rules.js`

Tambahkan setelah `STATUS_TAYANG`:

```js
/** Status asal yang sah untuk tiap keputusan kurator (BUG-019). `menunggu` hanya hasil pengajuan/ubah. */
export const KURASI_ASAL = Object.freeze({
  tayang: ["menunggu"],
  rekomendasi_marketplace: ["menunggu", "tayang"],
  ditolak: ["menunggu", "tayang", "rekomendasi_marketplace"],
});
export const LOI_STATUS = ["baru", "ditindaklanjuti", "ditutup"];
/** Status asal yang sah untuk tiap status tujuan LOI (BUG-020); `ditutup` final. */
export const LOI_ASAL = Object.freeze({
  ditindaklanjuti: ["baru"],
  ditutup: ["baru", "ditindaklanjuti"],
});
export function transisiKurasiSah(asal, keputusan) {
  return (KURASI_ASAL[keputusan] ?? []).includes(asal);
}
export function transisiLoiSah(asal, tujuan) {
  return (LOI_ASAL[tujuan] ?? []).includes(asal);
}
```

### 5.2 `katalog/service.js`

1. Ubah import rules: tambahkan `KURASI_ASAL`, `LOI_ASAL`.
2. Di `kurasiProduk`, ganti blok `await trx.raw(\`UPDATE produk SET status_kurasi = ? …\`)` menjadi:

   ```js
   const diubah = rows(await trx.raw(
     `UPDATE produk SET status_kurasi = ?, catatan_kurasi = ?, dikurasi_oleh = ?, dikurasi_at = NOW(), date_updated = NOW()
       WHERE id = ? AND status_kurasi IN (SELECT jsonb_array_elements_text(?::jsonb)) RETURNING id`,
     [keputusan, catatan, pemanggil.id, id, JSON.stringify(KURASI_ASAL[keputusan])],
   ));
   if (!diubah.length) {
     throw new ProgramError(409, "TRANSISI_KURASI_TIDAK_VALID", "The product's curation status no longer allows this decision.");
   }
   ```

   - `findProduk(…, { lock: true })` sebelum update tetap ada, sebagai sumber 404.
   - `pindahkanFoto` dan `return findProduk(trx, id)` tetap setelahnya, sehingga foto hanya dipindah bila update berhasil.
3. Tambahkan method baru tepat setelah `daftarLoi`:

   ```js
   /** Kurator menandai tindak lanjut LOI (BUG-020); transisi dijaga UPDATE bersyarat. */
   async ubahStatusLoi(pemanggil, loiIdRaw, body) {
     const id = uuidParam(loiIdRaw);
     const status = oneOf(objectBody({ body }), "status", Object.keys(LOI_ASAL));
     if (!isCurator(pemanggil)) throw new ProgramError(403, "FORBIDDEN", "Only curators can update letters of intent.");
     const diubah = rows(await db.raw(
       `UPDATE produk_loi SET status = ? WHERE id = ? AND status IN (SELECT jsonb_array_elements_text(?::jsonb))
        RETURNING id, status`,
       [status, id, JSON.stringify(LOI_ASAL[status])],
     ))[0];
     if (diubah) return diubah;
     const ada = rows(await db.raw(`SELECT 1 FROM produk_loi WHERE id = ?`, [id]))[0];
     if (!ada) throw new ProgramError(404, "LOI_NOT_FOUND", "The letter of intent was not found.");
     throw new ProgramError(409, "TRANSISI_LOI_TIDAK_VALID", "The letter of intent can no longer move to this status.");
   },
   ```

   - `oneOf(body, field, choices)` tanpa fallback melempar 400 `INVALID_PAYLOAD` bila nilai tidak cocok (terverifikasi `lib/validate.js:42-46`).

### 5.3 `katalog/index.js`

- Tambahkan baris komentar route `//   PATCH /v1/program/katalog/loi/:id             curator marks follow-up (baru → ditindaklanjuti → ditutup)`.
- Tepat setelah `router.get("/loi", …)`, tambahkan `router.patch("/loi/:id", jalur(KURASI, async (req, res, p) => kirim(res, await katalog.ubahStatusLoi(p, req.params?.id, req.body))));`.

### 5.4 `src/oas.yaml`

- Baris `/katalog/produk/{id}/kurasi`: tambahkan `"409": { description: TRANSISI_KURASI_TIDAK_VALID when the current status does not allow the decision }`.
- Tambahkan entri baru dengan gaya satu baris yang sama, tepat setelah blok `/katalog/loi:`:
  `/katalog/loi/{id}: { patch: { tags: [Katalog], parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: Status updated }, "404": { description: LOI_NOT_FOUND }, "409": { description: TRANSISI_LOI_TIDAK_VALID } } } }`.
- Tidak ada test yang mem-parse `oas.yaml` (`rg -n oas test/manifest.test.js` = 0 hit). Validasi = review diff: YAML flow-style satu baris dengan kurung seimbang.

### 5.5 Migration `services/directus/migrations/20261001C-katalog-baca-pengguna-login.js`

```js
// BUG-021 (QC 2026-10-01): Directus 11 hanya menerapkan Public policy pada request TANPA peran
// (@directus/api permissions/lib/fetch-policies.js). Pengguna login (dashboard & investor) memakai
// policy perannya, sehingga katalog publik, daftar wilayah katalog, dan FAQ gagal (403 → "Produk
// tidak ditemukan"). Baris read Public disalin apa adanya ke policy aplikasi dan investor.
const APP_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const INVESTOR_POLICY_ID = "89167fa4-30ad-4aec-9d97-d5256d5518df";
const TARGETS = [APP_POLICY_ID, INVESTOR_POLICY_ID];
const KOLEKSI = ["produk", "produk_foto", "kota", "faq", "directus_files"];
const FILE_KATALOG = '{"folder":{"_eq":"6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"}}';

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const policy of TARGETS) {
      for (const collection of KOLEKSI) {
        await trx.raw(
          `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
           SELECT p.collection, 'read', p.permissions, p.validation, p.presets, p.fields, ?::uuid
             FROM directus_permissions p
             JOIN directus_access pub ON pub.policy = p.policy AND pub.role IS NULL AND pub."user" IS NULL
            WHERE p.collection = ? AND p.action = 'read'
              AND (p.collection <> 'directus_files' OR p.permissions::jsonb = ?::jsonb)
              AND NOT EXISTS (
                SELECT 1 FROM directus_permissions q
                 WHERE q.policy = ?::uuid AND q.collection = p.collection AND q.action = 'read'
                   AND q.permissions::jsonb IS NOT DISTINCT FROM p.permissions::jsonb
              )`,
          [policy, collection, FILE_KATALOG, policy],
        );
      }
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE policy IN (?::uuid, ?::uuid) AND action = 'read' AND collection IN ('produk', 'produk_foto', 'kota', 'faq')`,
      TARGETS,
    );
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE policy IN (?::uuid, ?::uuid) AND action = 'read' AND collection = 'directus_files'
          AND permissions::jsonb = ?::jsonb`,
      [...TARGETS, FILE_KATALOG],
    );
  });
};
```

**Fakta pendukung.**
- `rg -n "9325db4b|89167fa4" services/directus/migrations` menunjukkan policy aplikasi dan investor tidak memiliki baris read untuk `produk`, `produk_foto`, `kota`, atau `faq`. Karena itu `down` boleh menghapus semua baris read empat koleksi tersebut pada dua policy itu.
- Baris `directus_files` milik policy aplikasi (`uploaded_by`) tidak tersentuh karena filter `permissions`.

### 5.6 Kontrak `services/directus/test/katalog-grant-login.contract.test.mjs`

Ikuti pola recorder di `public-grants.contract.test.mjs`. Import `../migrations/20261001C-katalog-baca-pengguna-login.js`, jalankan `up` dengan recorder, lalu assert:
1. Tepat 10 pernyataan INSERT (2 policy × 5 koleksi), semuanya `INSERT INTO directus_permissions`, memuat `'read'` dan `NOT EXISTS`.
2. Himpunan binding `[policy, collection]` = {aplikasi, investor} × {produk, produk_foto, kota, faq, directus_files}.
3. Tidak ada collection dari daftar `NEVER_PUBLIC` (salin array dari `public-grants.contract.test.mjs`).
4. Binding ketiga selalu `{"folder":{"_eq":"6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"}}`.
5. SQL tidak cocok dengan regex `/role IS NULL AND a\."user" IS NULL/i`, sehingga kontrak Public tetap bermakna.
6. `down` menghasilkan 2 DELETE yang memuat kedua UUID policy.

### 5.7 Web: tipe, konstanta, API

- `types/program.ts::ProdukLoi`: tambahkan `persetujuanKontak: boolean;` setelah `pesan`. Tambahkan `export type LoiStatus = ProdukLoi["status"];`.
- `constants/PROGRAM.ts`: setelah `KURASI_STATUS`, tambahkan:

  ```ts
  export const LOI_STATUS = {
    baru: { label: "Baru", className: "bg-amber-100 text-amber-900" },
    ditindaklanjuti: { label: "Ditindaklanjuti", className: "bg-sky-100 text-sky-800" },
    ditutup: { label: "Ditutup", className: "bg-slate-200 text-slate-700" },
  } satisfies Record<import("~/types/program").ProdukLoi["status"], { label: string; className: string }>;
  ```

- `lib/katalog.ts`:
  - `PESAN_KATALOG` ditambah tiga kunci:
    - `TRANSISI_KURASI_TIDAK_VALID: "Status produk sudah berubah. Antrean dimuat ulang."`
    - `TRANSISI_LOI_TIDAK_VALID: "Status LOI sudah berubah. Daftar dimuat ulang."`
    - `LOI_NOT_FOUND: "Letter of Intent tidak ditemukan."`
  - `katalogApi()` ditambah:
    `ubahStatusLoi: (loiId: string, status: "ditindaklanjuti" | "ditutup") => panggil(() => client.request<{ id: string; status: ProdukLoi["status"] }>(endpoint<{ id: string; status: ProdukLoi["status"] }, { status: "ditindaklanjuti" | "ditutup" }>(\`${dasar}/loi/${loiId}\`, { method: "PATCH", body: { status } })), "Status LOI tidak dapat disimpan. Coba lagi."),`

### 5.8 `kurasi.vue`

**Script**

- Import:
  - `LOI_STATUS` dari `~/constants`
  - `ProdukLoi` dari `~/types/program`
  - `requestErrorCode` tidak diperlukan karena `KatalogError.code` sudah tersedia
- `useAsyncData("katalog:loi", …)` mengambil `{ data: loi, pending: loiPending, error: loiError, refresh: refreshLoi }`.
- `decide(keputusan)`:
  - Guard menjadi `if (!preview.value || deciding.value) return;`. `deciding` di-set sebelum `await` (R6).
  - Di `catch`, bila `cause instanceof KatalogError && cause.code === "TRANSISI_KURASI_TIDAK_VALID"`, set `dialogError` ke `cause.pesan` lalu `await refresh()`. Dialog tetap terbuka (R4).
  - Jalur sukses tidak berubah: tutup dialog **setelah** await berhasil.
- Status preview:
  - `const statusPreview = computed(() => preview.value?.statusKurasi ?? null);`
  - `const bisaUbah = computed(() => statusPreview.value !== null && statusPreview.value !== "ditolak");`
- LOI:
  - `const loiTarget = ref<ProdukLoi | null>(null); const loiBusy = ref(false); const loiDialogError = ref("");`
  - `function bukaLoi(item: ProdukLoi) { loiTarget.value = item; loiDialogError.value = ""; }`
  - `ubahLoi(status)`:
    - `if (!loiTarget.value || loiBusy.value) return; loiBusy.value = true; loiDialogError.value = "";`
    - `try { const id = loiTarget.value.id; await api.ubahStatusLoi(id, status); await refreshLoi(); loiTarget.value = loi.value?.find((x) => x.id === id) ?? null; message.value = { tone: "success", text: \`LOI ${LOI_STATUS[status].label.toLowerCase()}.\` }; }`
    - `catch (cause) { loiDialogError.value = cause instanceof KatalogError ? cause.pesan : "Status LOI tidak dapat disimpan. Coba lagi."; if (cause instanceof KatalogError && cause.code === "TRANSISI_LOI_TIDAK_VALID") await refreshLoi(); }`
    - `finally { loiBusy.value = false; }`

**Template**

1. Blok `tab === 'loi'` diganti menjadi:
   - `loiError` → `<div role="alert" class="p-6 text-sm text-destructive">Letter of Intent tidak dapat dimuat.</div>`
   - `loiPending && !loi?.length` → `Memuat…`
   - kosong → `Belum ada Letter of Intent.`
   - selain itu `<ul class="divide-y">`. Tiap `li` (`flex flex-wrap items-center gap-4 px-4 py-3 text-sm`) berisi:
     - kiri: nama · instansi → produkNama (usahaNama) + baris kecil tanggal
     - `<ProgramStatusPill :meta="LOI_STATUS[item.status]" />`
     - `<button type="button" class="font-semibold underline" @click="bukaLoi(item)">Detail</button>`
2. Dialog produk:
   - Ganti textarea `catatan-kurasi` menjadi `<UiField v-if="bisaUbah" …>` (label tetap, placeholder `"Wajib diisi bila menolak atau menurunkan"`).
   - Untuk `ditolak` tampilkan `<div class="rounded-md bg-muted/40 p-3"><p class="text-xs text-muted-foreground">Catatan kurasi</p><p class="whitespace-pre-line">{{ preview.catatanKurasi || "—" }}</p><p class="mt-2 text-xs text-muted-foreground">Produk kembali ke antrean setelah pelaku usaha mengubahnya.</p></div>`.
3. Footer dialog produk:

   ```html
   <UiDialogFooter>
     <template v-if="statusPreview === 'menunggu'">
       <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">Tolak</UiButton>
       <UiButton variant="outline" :disabled="Boolean(deciding)" @click="decide('rekomendasi_marketplace')">Rekomendasikan ke Marketplace</UiButton>
       <UiButton :disabled="Boolean(deciding)" @click="decide('tayang')">Tayangkan</UiButton>
     </template>
     <template v-else-if="statusPreview === 'tayang' || statusPreview === 'rekomendasi_marketplace'">
       <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">Turunkan</UiButton>
       <UiButton v-if="statusPreview === 'tayang'" variant="outline" :disabled="Boolean(deciding)" @click="decide('rekomendasi_marketplace')">Rekomendasikan ke Marketplace</UiButton>
       <UiButton as-child variant="outline"><NuxtLink :to="`/katalog/${preview.id}`" target="_blank">Lihat di katalog</NuxtLink></UiButton>
     </template>
     <UiButton v-else variant="outline" @click="preview = null">Tutup</UiButton>
   </UiDialogFooter>
   ```

   - Hapus `class="gap-2"` pada footer (basis footer sudah `gap-2`).
   - Catatan copy: untuk produk tayang, tombol "Turunkan" mengirim keputusan `ditolak`, dan `putuskanKurasi` menolak catatan kosong dengan `CATATAN_WAJIB` (sudah ada).
4. Dialog LOI baru, setelah dialog produk:

   ```html
   <UiDialog :open="Boolean(loiTarget)" @update:open="(v) => !v && !loiBusy && (loiTarget = null)">
     <UiDialogContent v-if="loiTarget" class="sm:max-w-lg" :show-close-button="!loiBusy">
       <UiDialogHeader>
         <UiDialogTitle class="pr-6">LOI dari {{ loiTarget.nama }}</UiDialogTitle>
         <UiDialogDescription>{{ loiTarget.instansi || "Perorangan" }} · {{ date(loiTarget.dateCreated) }}</UiDialogDescription>
       </UiDialogHeader>
       <dl class="grid gap-2 text-sm">
         <div><dt class="text-xs text-muted-foreground">Produk</dt><dd><NuxtLink :to="`/katalog/${loiTarget.produk}`" target="_blank" class="underline">{{ loiTarget.produkNama }}</NuxtLink> · {{ loiTarget.usahaNama || "—" }}</dd></div>
         <div><dt class="text-xs text-muted-foreground">Perkiraan jumlah</dt><dd>{{ loiTarget.jumlah || "—" }}</dd></div>
         <div><dt class="text-xs text-muted-foreground">Pesan</dt><dd class="whitespace-pre-line">{{ loiTarget.pesan }}</dd></div>
         <div><dt class="text-xs text-muted-foreground">Kontak</dt>
           <dd v-if="loiTarget.persetujuanKontak" class="flex flex-wrap gap-3">
             <a :href="`mailto:${loiTarget.email}`" class="underline">{{ loiTarget.email }}</a>
             <a v-if="loiTarget.telepon" :href="`tel:${loiTarget.telepon}`" class="underline">{{ loiTarget.telepon }}</a>
           </dd>
           <dd v-else class="text-muted-foreground">Pengirim tidak menyetujui kontaknya dibagikan.</dd></div>
         <div><dt class="text-xs text-muted-foreground">Status</dt><dd><ProgramStatusPill :meta="LOI_STATUS[loiTarget.status]" /></dd></div>
       </dl>
       <p v-if="loiDialogError" role="alert" class="text-sm text-destructive">{{ loiDialogError }}</p>
       <UiDialogFooter>
         <UiButton v-if="loiTarget.status === 'baru'" variant="outline" :disabled="loiBusy" @click="ubahLoi('ditindaklanjuti')">{{ loiBusy ? "Memproses…" : "Tandai ditindaklanjuti" }}</UiButton>
         <UiButton v-if="loiTarget.status !== 'ditutup'" :disabled="loiBusy" @click="ubahLoi('ditutup')">{{ loiBusy ? "Memproses…" : "Tutup LOI" }}</UiButton>
         <UiButton v-else variant="outline" @click="loiTarget = null">Tutup</UiButton>
       </UiDialogFooter>
     </UiDialogContent>
   </UiDialog>
   ```

   Jangan menambah import `isTayang`: cabang template sudah memilih status `tayang`/`rekomendasi_marketplace` secara eksplisit.

### 5.9 Mock `tests/fixtures/mock-program.mjs`

- Import `KURASI_ASAL` dan `LOI_ASAL` dari rules (baris import katalog yang ada).
- Handler `POST /katalog/produk/:id/kurasi`: setelah `if (!item) return json(route, 404, …)`, tambahkan `if (!KURASI_ASAL[keputusan.keputusan].includes(item.statusKurasi)) return json(route, 409, "TRANSISI_KURASI_TIDAK_VALID");`.
- `POST /katalog/loi`: push menjadi:
  `state.loi.push({ id: \`77777777-7777-4777-8777-${String(state.loi.length + 1).padStart(12, "0")}\`, status: "baru", produkNama: "Produk", usahaNama: state.usaha.nama, ...body, dateCreated: new Date().toISOString() });`
  Spread `body` mempertahankan `persetujuanKontak` dan field yang sudah diperiksa `toMatchObject`.
- Handler baru `PATCH /katalog/loi/:id`:
  - Tidak ditemukan → 404 `LOI_NOT_FOUND`.
  - `state.gagalLoi` → 500.
  - Asal tidak sah menurut `LOI_ASAL` → 409 `TRANSISI_LOI_TIDAK_VALID`.
  - Selain itu set `item.status`, lalu `json(route, 200, { id, status })`.

### 5.10 Test

**`test/katalog-rules.test.js`** (import `KURASI_ASAL`, `LOI_ASAL`, `transisiKurasiSah`, `transisiLoiSah`):
- "transisi kurasi: tayang hanya dari menunggu; rekomendasi dari menunggu/tayang; tolak dari semua kecuali ditolak". Matriks 4 asal × 3 keputusan, assert persis (12 asersi).
- "transisi LOI: ditutup final, baru → ditindaklanjuti → ditutup". Matriks 3 asal × 2 tujuan, plus `transisiLoiSah("baru", "baru") === false`.

**`test/katalog.test.js`**, test "semua route katalog bertanda…":
- `routes.length` menjadi 11.
- Tambahkan `["PATCH", "/loi/:id", "terjaga", ["provinsi"]]`.

**`test/pg/katalog-transisi.test.js`** (baru, `{ skip: pgSkipReason() }`, pola `test/pg/katalog-edit.test.js`). Setup:
- `withDatabase`
- `buatKota`, `buatUsaha`
- `kurator = buatUser(db, { appRole: "provinsi" })`
- `owner = buatUser(db, { appRole: "umkm", usahaId })`
- satu produk per status via `buatProduk({ statusKurasi })`
- `mountEndpoint(registerKatalog, { database: db })` (pola `katalog-edit.test.js`; route kurasi dan LOI tidak memakai `services`).

Kasus:
1. `ditolak → tayang` = 409 dan `status_kurasi` tetap `ditolak`.
2. `tayang → tayang` = 409, `dikurasi_at` tidak berubah.
3. `tayang → rekomendasi_marketplace` = 200.
4. `rekomendasi_marketplace → ditolak {catatan:"Foto buram"}` = 200.
5. Konkurensi (R3): `Promise.all` dua `POST /produk/<menunggu>/kurasi {keputusan:"tayang"}` menghasilkan [200, 409].
6. LOI: insert `produk_loi` (`produk`, `nama`, `email`, `pesan`) lalu:
   - PATCH `ditindaklanjuti` = 200
   - PATCH `ditindaklanjuti` lagi = 409
   - PATCH `ditutup` = 200
   - PATCH `ditindaklanjuti` = 409
   - PATCH UUID acak = 404
   - PATCH sebagai `owner` (umkm) = 403
7. Konkurensi LOI: dua PATCH `ditutup` paralel pada LOI `baru` menghasilkan [200, 409].

**`apps/web/tests/e2e/katalog.spec.ts`**, tambahkan dua test di describe yang ada. Pola: `installMockDirectus(page, { authenticated: true })`, `installMockProgram(page, state)`, `loginMock(page, "/dashboard/katalog/kurasi")`. `state.produk` berisi tiga produk (`tayang`, `rekomendasi_marketplace`, `ditolak` dengan `catatanKurasi: "Foto buram"`), lengkap field `Produk` seperti objek `created` di handler mock.
1. "kurator hanya melihat aksi yang sah untuk tiap status":
   - Tab Tayang → "Lihat": tombol "Tayangkan" `toHaveCount(0)`, "Turunkan" terlihat, tautan "Lihat di katalog" `href` `/katalog/<id>`.
   - "Turunkan" dengan catatan kosong menampilkan "Tulis alasan penolakan untuk pelaku usaha.".
   - Isi catatan lalu "Turunkan": pesan `… : Ditolak.`.
   - Tab Ditolak → "Lihat": teks "Foto buram", tanpa textbox "Catatan kurasi", tombol "Tutup".
2. "LOI dapat dibuka, dihubungi, dan ditindaklanjuti":
   - `state.loi` berisi satu LOI `baru` dengan `persetujuanKontak: true`, `telepon: "08123"`.
   - Tab "Letter of Intent" → "Detail": tautan `mailto:` dan `tel:08123`.
   - "Tandai ditindaklanjuti": pill "Ditindaklanjuti". Lalu "Tutup LOI": pill "Ditutup", tombol "Tutup".
   - Kasus gagal: `state.gagalLoi = true` pada LOI kedua. Dialog tetap terbuka dengan `role=alert` "Status LOI tidak dapat disimpan. Coba lagi." (R4).

Test lama baris 216-221 (Kurasi → Tolak → Tayangkan pada `menunggu`) harus tetap lulus tanpa perubahan.

**`apps/web/tests/e2e/katalog-publik.directus.spec.ts`** (real stack), tambahkan test:

```ts
test("pengguna login (provinsi) tetap dapat membuka detail produk tayang beserta fotonya (BUG-021)", async ({ page }) => {
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  await loginReal(page, process.env.DUMMY_PROVINSI_EMAIL || "dummy_admin@diskuk.jabarprov.go.id", process.env.DEMO_ACCOUNT_PASSWORD!);
  expect((await page.request.get(`/panel/items/produk/${PRODUK_TAYANG}`)).status()).toBe(200);
  expect((await page.request.get(`/panel/items/produk/${PRODUK_DRAFT}`)).status()).toBe(403);
  await page.goto(`/katalog/${PRODUK_TAYANG}`);
  await expect(page.getByRole("heading", { name: PRODUK_TAYANG_NAMA })).toBeVisible();
  await expect(page.getByText("Produk tidak ditemukan")).toHaveCount(0);
  await page.goto("/katalog");
  await expect(page.getByTestId("katalog-total")).not.toHaveText("0");
});
```

Gunakan `import { loginReal } from "./real-login";`. Lakukan hal yang sama untuk akun UMKM (`DUMMY_UMKM_EMAIL`) pada test kedua dengan isi identik. Asersi foto ada pada bukti runtime §8.

## 6. Kasus campuran, negatif, batas, lintas peran, siklus hidup

| Kategori | Kasus |
|---|---|
| Matriks transisi | 12 kasus produk dan 6 kasus LOI (unit), plus jalur DB (pg 1–7) |
| Negatif | Catatan kosong saat Turunkan (klien `CATATAN_WAJIB` dan server 400), `status=baru` pada PATCH LOI (400), LOI asing (404) |
| Lintas peran | UMKM PATCH LOI (403, pg 6); route manifest provinsi saja (unit) |
| Data campuran | LOI lama dari seed dengan `persetujuan_kontak = false` → dialog menampilkan "Pengirim tidak menyetujui kontaknya dibagikan." (e2e: tambah LOI kedua `persetujuanKontak: false` di test 2, assert teks dan tidak ada `mailto:`) |
| Siklus hidup | Produk `ditolak` kembali ke `menunggu` hanya lewat `PATCH /produk/:id` pemilik (`test/pg/katalog-edit.test.js` tetap hijau) |
| Grant | Anonim tetap: draft 403 dan PII tidak muncul (test lama `katalog-publik.directus.spec.ts` tetap hijau); login: tayang 200, draft 403 (test baru) |
| Gagal klien | Dialog tetap terbuka (R4) dan klik ganda dicegah oleh guard `deciding`/`loiBusy` (R6) |

## 7. Perintah validasi dan hasil yang diharapkan

```bash
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk
python3 docs/qc-diskuk-e2e-plan/scope_guard.py snapshot --output /tmp/qc-phase-9.json   # sebelum edit
cd services/directus/extensions/program && node --test test/katalog-rules.test.js test/katalog.test.js test/manifest.test.js   # pass
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk/services/directus && node --test test/public-grants.contract.test.mjs test/katalog-grant-login.contract.test.mjs test/route-manifest.contract.test.mjs   # pass
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk && bash scripts/test-db-template.sh
cd services/directus/extensions/program && DISKUK_TEST_PG_URL="$DISKUK_TEST_PG_URL" node --test test/pg/katalog-transisi.test.js test/pg/katalog-edit.test.js test/pg/katalog-loi.test.js   # pass, 0 skip
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk/apps/web && pnpm lint && pnpm typecheck && pnpm test:unit
pnpm exec playwright test tests/e2e/katalog.spec.ts tests/e2e/produk-passport.spec.ts --project=chromium   # pass
PLAYWRIGHT_USE_REAL_API=1 PLAYWRIGHT_BASE_URL=<origin stack lokal> DEMO_ACCOUNT_PASSWORD=<…> pnpm exec playwright test tests/e2e/katalog-publik.directus.spec.ts --project=chromium   # pass (lihat §8)
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk && python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-9.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 9   # "outside": []
```

**Sentinel.**
- `rg -n "status_kurasi IN \(SELECT jsonb_array_elements_text" services/directus/extensions/program/src/endpoints/katalog/service.js` → 1 hit.
- `rg -n "Tayangkan" "apps/web/app/pages/(private)/dashboard/katalog/kurasi.vue"` → tepat 1 hit, di dalam `<template v-if="statusPreview === 'menunggu'">`. Verifikasi dengan membaca konteks hit.

## 8. Bukti runtime, browser, dan migration

**Migration.** Pada stack lokal, `cd services/directus && pnpm dbm:l`, lalu jalankan:

```sql
SELECT policy, collection, permissions FROM directus_permissions
 WHERE policy IN ('9325db4b-9518-41db-b122-8c667f2ce510','89167fa4-30ad-4aec-9d97-d5256d5518df')
   AND collection IN ('produk','produk_foto','kota','faq','directus_files') AND action='read' ORDER BY 1,2;
```

Hasilnya: 10 baris, ditambah baris `directus_files` `uploaded_by` milik aplikasi yang sudah ada. Setelah itu jalankan `pnpm dbm:d` (10 baris hilang, baris `uploaded_by` tetap), lalu `pnpm dbm:l` lagi.

**Restart Directus.** Restart container Directus setelah migration (R11, cache policy kosong).

**Runtime terautentikasi.** Gunakan cookie sesi provinsi dan cookie umkm lokal. Ambil `<file>` dari `GET /panel/items/produk/<tayang>?fields=foto.directus_files_id`.
- `GET $BASE/panel/items/produk/<id tayang>` → 200.
- `GET $BASE/panel/assets/<file>` → 200 `image/*`.
- `GET $BASE/panel/items/produk/<id draft>` → 403.
- `GET $BASE/panel/items/faq?limit=1` → 200.
- File unggahan milik sendiri tetap terbaca: `GET $BASE/panel/files/<id unggahan sendiri>` → 200.

**Kondisi berhenti.** Phase dihentikan sebelum commit bila salah satu terjadi:
- `/panel/assets/<file katalog>` atau `/panel/files/<unggahan sendiri>` mengembalikan 403 setelah migration (Directus tidak menggabungkan dua baris `directus_files read` pada satu policy).
- `/panel/items/produk/<draft>` mengembalikan 200 (bocor).

Laporkan hasil curl lengkap, lalu rollback migration (`pnpm dbm:d`).

**Browser.** Ambil flow §5 `main_plan.md` BUG-019/020/021, lalu simpan screenshot:
- `evidence/BUG-019-after-1.png`: dialog Tayang tanpa Tayangkan
- `evidence/BUG-019-after-2.png`: Ditolak read-only
- `evidence/BUG-020-after-1.png`: dialog LOI
- `evidence/BUG-021-after-1.png`: detail produk saat login provinsi
- `evidence/BUG-021-after-2.png`: detail produk saat login umkm

**Belum terbukti bila stack lokal tidak tersedia.** Grant runtime (R11), aset foto, dan test `.directus.spec.ts`. Kontrak migration dan unit tetap wajib hijau. Commit **tidak** boleh dilakukan tanpa bukti runtime grant (gerbang BUG-021).

## 9. Rollback dan handoff

**Rollback.** Bila migration sudah jalan, jalankan `pnpm dbm:d` di DB lokal, lalu `git revert <commit phase 9>`. Revert kode tanpa down-migration juga aman, karena grant tambahan tidak membuka data di luar allowlist Public.

**Commit.** `fix(program): BUG-019/020/021 aksi kurasi katalog per status, tindak lanjut LOI, katalog terbaca saat login`, dengan trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Handoff ke phase 10.** Tidak ada file bersama. Pola dialog (`v-if` pada content, tombol nonaktif saat proses, error di dalam dialog, `sm:max-w-*`) dipakai ulang di phase 10.

## 10. Aturan scope-amendment

Berhenti dan laporkan bila perlu menyentuh file di luar §2. Contohnya:
- `pages/(public)/katalog/[id].vue`, untuk membedakan 403 dan 404
- `components/katalog/ProductCard.vue`
- `pages/(private)/dashboard/usaha/produk.vue`
- migration lama

Mengedit migration yang sudah ada **dilarang**. `scope_guard.py check` harus menghasilkan `"outside": []` sebelum commit.
