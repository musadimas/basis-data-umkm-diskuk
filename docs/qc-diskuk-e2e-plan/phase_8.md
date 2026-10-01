# Phase 8 — Kurasi Investor: status dihitung server, tab, guard transisi (BUG-016, BUG-017, BUG-018)

## 1. Tujuan, dependensi, hasil yang dapat diamati

**Tujuan.** Halaman `/dashboard/investor-kurasi` mengikuti pola kurasi baku. Profil dipisah ke empat tab berjumlah: Menunggu kurasi, Disetujui, Belum disetujui usaha, Persetujuan dicabut. Status dihitung di server. Tombol muncul sesuai status. Server menolak transisi yang tidak valid. Cabut oleh kurator menghasilkan status "Persetujuan dicabut" yang bisa disetujui ulang (keputusan user §1 #7).

**Dependensi.** Gerbang `main_plan.md` §9 lulus, dan phase 7 sudah ter-commit (urutan §6). Phase ini tidak bergantung pada file phase lain.

**Hasil yang dapat diamati.**
- Login provinsi lalu buka Kurasi Investor. Tablist menampilkan `Menunggu kurasi (n)`, `Disetujui (n)`, `Belum disetujui usaha (n)`, `Persetujuan dicabut (n)`.
- Kartu di tab Disetujui tidak punya tombol "Setujui" dan hanya punya "Cabut persetujuan". Tombol itu membuka dialog, lalu profil pindah ke tab Persetujuan dicabut dan mendapat tombol "Setujui ulang".
- Kartu di tab Belum disetujui usaha tidak punya tombol aksi.
- `POST …/investor/profil/<id>/kurasi {setuju:true}` untuk profil yang sudah Disetujui mengembalikan 409 `STATUS_BERUBAH`.

## 2. Manifest file (tertutup)

| Aksi | Path |
|---|---|
| create | `services/directus/migrations/20261001B-investor-kurator-dicabut.js` |
| modify | `services/directus/extensions/program/src/endpoints/executive/index.js` |
| modify | `services/directus/extensions/program/test/executive.test.js` |
| create | `services/directus/extensions/program/test/pg/investor-kurasi.test.js` |
| modify | `apps/web/app/pages/(private)/dashboard/investor-kurasi.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/usaha/investor.vue` |
| modify | `apps/web/app/types/program.ts` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| create | `apps/web/tests/e2e/investor-kurasi.spec.ts` |

> Nama migration memakai urutan `20261001A` (phase 4), `20261001B` (phase 8), `20261001C` (phase 9). Kalau phase 4 sudah memakai nama lain, pertahankan huruf `B` selama urutan leksikal tetap setelah migration phase 4. Jangan mengganti nama migration yang sudah ter-commit.

## 3. Simbol dan anchor pencarian

- `executive/index.js`:
  - `router.get("/investor/kurasi"` (sekitar baris 159). Query `SELECT ip.usaha AS id, u.nama, ip.jenama, … LIMIT 200`.
  - `router.get("/investor/profil-saya"` (SELECT kolom profil sendiri).
  - `router.post("/investor/profil"`: `ON CONFLICT (usaha) DO UPDATE SET … disetujui_kurator_oleh = NULL, disetujui_kurator_pada = NULL, date_updated = NOW()`.
  - `router.post("/investor/profil/:id/kurasi"`: `UPDATE investor_profil SET disetujui_kurator_oleh = CASE WHEN ? …`.
  - `const fail = (code = "NOT_FOUND")`.
  - `DIRECTORY_FROM`.
  - Query pitch deck `WHERE ip.usaha = ? AND ip.disetujui_berbagi_pada IS NOT NULL AND ip.disetujui_kurator_pada IS NOT NULL AND ip.dicabut_pada IS NULL`.
- `migrations/20260928F-executive-investor.js`: `CREATE TABLE investor_profil`, constraint `investor_profil_approval_pair`. Tabel ini **tidak** didaftarkan di `directus_fields` (tidak ada `INSERT INTO directus_fields`), jadi migration baru juga tidak mendaftarkannya.
- `investor-kurasi.vue`: `interface QueueItem`, `function statusItem`, `async function decide`, `async function verify`, root `<main class="mx-auto max-w-4xl space-y-6 pb-10">`.
- `usaha/investor.vue`: `interface OwnProfile`, `<p v-if="data?.disetujui_kurator_pada && !data?.dicabut_pada"`.
- `constants/PROGRAM.ts::KURASI_INVESTOR_STATUS`: kunci `disetujui`, `menunggu`, `belum_disetujui`, `dicabut` (dipakai apa adanya, tidak diubah).
- Pola baku halaman kurasi ada di `pages/(private)/dashboard/katalog/kurasi.vue`:
  - root `<div class="flex w-full flex-col gap-6 pb-10">`
  - `h1.text-2xl.font-bold.tracking-tight` + `p.mt-1.text-sm.text-muted-foreground`
  - `role="tablist"` dengan tombol `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors`
  - `UiCard > UiCardContent.overflow-x-auto.p-0 > ul.divide-y`
- `tests/fixtures/mock-program.mjs::installMockProgram` (route `**/panel/v1/program/**`, `path` tanpa prefix `/panel/v1/program`), `createProgramState`.

## 4. Kontrak saat ini → kontrak akhir

**Saat ini**

- Status diturunkan di klien (`statusItem`).
  - UMKM yang menarik persetujuan selalu tercatat dengan `dicabut_pada = NOW()`. Akibatnya klien menampilkannya "Persetujuan dicabut", dan `belum_disetujui` hanya muncul dari seed.
- Kurasi tanpa guard:
  - Menyetujui ulang profil Disetujui → 200 (menimpa waktu).
  - Mencabut profil Menunggu → 200 no-op.
  - Cabut oleh kurator mengembalikan profil ke Menunggu.
- `GET /investor/kurasi` mengembalikan array, `LIMIT 200`, tanpa filter.

**Akhir**

| Kontrak | Nilai |
|---|---|
| Kolom baru | `investor_profil.kurator_dicabut_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL`, `kurator_dicabut_pada TIMESTAMPTZ`, constraint `investor_profil_kurator_cabut_pair CHECK ((kurator_dicabut_oleh IS NULL) = (kurator_dicabut_pada IS NULL))` |
| Status (urutan presedensi mengikat) | 1. `belum_disetujui` bila `disetujui_berbagi_pada IS NULL OR dicabut_pada IS NOT NULL`; 2. `dicabut` bila `kurator_dicabut_pada IS NOT NULL`; 3. `disetujui` bila `disetujui_kurator_pada IS NOT NULL`; 4. selain itu `menunggu` |
| `GET /v1/program/executive/investor/kurasi?status=<menunggu\|disetujui\|belum_disetujui\|dicabut>` (opsional) | `res.json({ data: { items, meta: { counts: { menunggu, disetujui, belum_disetujui, dicabut } } } })`. SDK membuka `data`, jadi klien menerima `{ items, meta }`. Item: `{ id, nama, jenama, status, disetujuiKuratorPada, kuratorDicabutPada, dateUpdated }`. Urutan `date_updated DESC`, `LIMIT 200`. `counts` dihitung tanpa filter status. Status di luar empat nilai → 400 `INVALID_STATUS` |
| `POST …/investor/profil/:id/kurasi {setuju:true}` | Prasyarat: persetujuan usaha valid **dan** `disetujui_kurator_pada IS NULL` (dari menunggu atau dicabut). Efek: isi `disetujui_kurator_*`, kosongkan `kurator_dicabut_*` |
| `… {setuju:false}` | Prasyarat: persetujuan usaha valid **dan** `disetujui_kurator_pada IS NOT NULL`. Efek: kosongkan `disetujui_kurator_*`, isi `kurator_dicabut_oleh = aktor`, `kurator_dicabut_pada = NOW()` |
| Gagal prasyarat | 0 baris → `SELECT` kedua. Profil dengan persetujuan valid ada → 409 `STATUS_BERUBAH`. Tidak ada → 404 `NOT_FOUND` (perilaku `fail()` tetap) |
| `POST /investor/profil` (UMKM) | Selain mereset `disetujui_kurator_*`, juga mereset `kurator_dicabut_* = NULL`, sehingga edit profil membuat status kembali Menunggu kurasi (atau Belum disetujui bila `setuju=false`) |
| `GET /investor/profil-saya` | Menambah kolom `kurator_dicabut_pada` |
| Direktori, detail, PDF, pitch deck, LOI investor | **Tidak berubah.** Semua tetap mensyaratkan `disetujui_kurator_pada IS NOT NULL AND dicabut_pada IS NULL`. Cabut oleh kurator mengosongkan `disetujui_kurator_pada`, sehingga profil hilang dari investor |
| Waktu | `TIMESTAMPTZ` disimpan UTC. JSON pg → string ISO dengan offset. UI tidak menampilkan waktu kurasi baru di phase ini |

## 5. Edit berurutan (keputusan sudah diambil)

### 5.1 Migration `services/directus/migrations/20261001B-investor-kurator-dicabut.js`

Ikuti pola `20260929D-kpi-laporan-dibuat-pada-klien.js`: ekspor `up`/`down` dengan `knex.transaction`.

```js
/**
 * BUG-017/018 (QC 2026-10-01): pencabutan oleh kurator adalah status tersendiri
 * ("Persetujuan dicabut"), terpisah dari usaha yang menarik persetujuan berbagi (`dicabut_pada`).
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE investor_profil
        ADD COLUMN IF NOT EXISTS kurator_dicabut_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS kurator_dicabut_pada TIMESTAMPTZ;
      ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
      ALTER TABLE investor_profil ADD CONSTRAINT investor_profil_kurator_cabut_pair
        CHECK ((kurator_dicabut_oleh IS NULL) = (kurator_dicabut_pada IS NULL));
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
      ALTER TABLE investor_profil DROP COLUMN IF EXISTS kurator_dicabut_pada;
      ALTER TABLE investor_profil DROP COLUMN IF EXISTS kurator_dicabut_oleh;
    `);
  });
};
```

Data lama tidak di-backfill. Belum ada riwayat cabut oleh kurator yang tersimpan; cabut oleh kurator sebelumnya hanya mengosongkan persetujuan, jadi profil itu tetap terhitung Menunggu.

### 5.2 `executive/index.js`

1. Di atas `export default`, tambahkan konstanta dan helper status (satu sumber untuk list dan counts):

   ```js
   const KURASI_INVESTOR_STATUS = ["menunggu", "disetujui", "belum_disetujui", "dicabut"];
   // Presedensi mengikat (BUG-017): persetujuan usaha > cabut kurator > setuju kurator > menunggu.
   const STATUS_PROFIL_SQL = `CASE
       WHEN ip.disetujui_berbagi_pada IS NULL OR ip.dicabut_pada IS NOT NULL THEN 'belum_disetujui'
       WHEN ip.kurator_dicabut_pada IS NOT NULL THEN 'dicabut'
       WHEN ip.disetujui_kurator_pada IS NOT NULL THEN 'disetujui'
       ELSE 'menunggu' END`;
   ```

2. Ganti badan handler `router.get("/investor/kurasi", …)`. Gate `terjaga({ peran: ["provinsi"] }, …)` tetap.
   - `status` = `req.query?.status`.
     - Bila ada dan bukan string anggota `KURASI_INVESTOR_STATUS`: `throw new ProgramError(400, "INVALID_STATUS", "Status kurasi tidak valid.")`.
     - Bila tidak ada: `null`.
   - Query 1 (items):

     ```sql
     SELECT * FROM (
       SELECT ip.usaha AS id, u.nama, ip.jenama, ip.disetujui_kurator_pada, ip.kurator_dicabut_pada,
              ip.date_updated, ${STATUS_PROFIL_SQL} AS status
         FROM investor_profil ip JOIN usaha u ON u.id = ip.usaha
     ) s WHERE (?::text IS NULL OR s.status = ?) ORDER BY s.date_updated DESC LIMIT 200
     ```

     Binding `[status, status]`.
   - Query 2 (counts, satu pernyataan, R17):

     ```sql
     SELECT COUNT(*) FILTER (WHERE s.status = 'menunggu')::int AS menunggu,
            COUNT(*) FILTER (WHERE s.status = 'disetujui')::int AS disetujui,
            COUNT(*) FILTER (WHERE s.status = 'belum_disetujui')::int AS belum_disetujui,
            COUNT(*) FILTER (WHERE s.status = 'dicabut')::int AS dicabut
       FROM (SELECT ${STATUS_PROFIL_SQL} AS status FROM investor_profil ip) s
     ```

   - Respons: `noStore(res); res.json({ data: { items: items.map((r) => ({ id: r.id, nama: r.nama, jenama: r.jenama, status: r.status, disetujuiKuratorPada: r.disetujui_kurator_pada, kuratorDicabutPada: r.kurator_dicabut_pada, dateUpdated: r.date_updated })), meta: { counts } } })`.
     - `counts` diambil dari baris pertama query 2, dengan default 0 per kunci.
3. Handler `router.get("/investor/profil-saya", …)`: tambahkan `kurator_dicabut_pada` ke daftar kolom SELECT, setelah `disetujui_kurator_pada`.
4. Handler `router.post("/investor/profil", …)`: pada klausa `ON CONFLICT … DO UPDATE SET`, setelah `disetujui_kurator_oleh = NULL, disetujui_kurator_pada = NULL`, tambahkan `kurator_dicabut_oleh = NULL, kurator_dicabut_pada = NULL`. Binding tidak berubah.
5. Ganti badan handler `router.post("/investor/profil/:id/kurasi", …)`. Validasi `id` dan `approve` tetap.

   ```js
   const result = rows(await inner.database.raw(approve
     ? `UPDATE investor_profil SET disetujui_kurator_oleh = ?, disetujui_kurator_pada = NOW(),
          kurator_dicabut_oleh = NULL, kurator_dicabut_pada = NULL, date_updated = NOW()
        WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL
          AND disetujui_kurator_pada IS NULL RETURNING usaha`
     : `UPDATE investor_profil SET disetujui_kurator_oleh = NULL, disetujui_kurator_pada = NULL,
          kurator_dicabut_oleh = ?, kurator_dicabut_pada = NOW(), date_updated = NOW()
        WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL
          AND disetujui_kurator_pada IS NOT NULL RETURNING usaha`,
     [actor.id, id]));
   if (!result.length) {
     // Klasifikasi saja: profil dengan persetujuan valid ada → status sudah berubah (409), selain itu 404.
     const ada = rows(await inner.database.raw(`SELECT 1 FROM investor_profil
       WHERE usaha = ? AND disetujui_berbagi_pada IS NOT NULL AND dicabut_pada IS NULL`, [id]))[0];
     if (ada) throw new ProgramError(409, "STATUS_BERUBAH", "Status profil sudah berubah. Muat ulang daftar.");
     throw fail();
   }
   noStore(res); res.json({ data: { disetujui: approve } });
   ```

   `UPDATE … RETURNING` yang bersyarat adalah satu-satunya penulis, sehingga dua kurator bersamaan tidak bisa menulis ganda (R2). `SELECT` kedua hanya memilih kode error.

### 5.3 `apps/web/app/types/program.ts`

Tambahkan di akhir blok tipe executive/investor (atau di akhir file bila tidak ada blok tersebut):

```ts
export type KurasiInvestorStatus = "menunggu" | "disetujui" | "belum_disetujui" | "dicabut";
export interface KurasiInvestorItem {
  id: string;
  nama: string;
  jenama: string;
  status: KurasiInvestorStatus;
  disetujuiKuratorPada: string | null;
  kuratorDicabutPada: string | null;
  dateUpdated: string;
}
export interface KurasiInvestorDaftar {
  items: KurasiInvestorItem[];
  meta: { counts: Record<KurasiInvestorStatus, number> };
}
```

### 5.4 `investor-kurasi.vue` (tulis ulang `<script setup>` dan `<template>`)

**Script**

- Hapus `QueueItem` dan `statusItem`.
- Impor `KurasiInvestorDaftar`, `KurasiInvestorItem`, dan `KurasiInvestorStatus` dari `~/types/program`.
- Tab dan data:
  - `const TABS: { value: KurasiInvestorStatus; label: string }[]` berurutan `menunggu`, `disetujui`, `belum_disetujui`, `dicabut`, dengan label dari `KURASI_INVESTOR_STATUS[value].label`.
  - `const tab = ref<KurasiInvestorStatus>("menunggu")`.
  - `useAsyncData("investor:kurasi", () => directus.request(endpoint<KurasiInvestorDaftar>("/v1/program/executive/investor/kurasi", { query: { status: tab.value } })), { watch: [tab] })`. Ambil `data, pending, error, refresh`.
  - `daftar = computed(() => data.value?.items ?? [])`; `counts = computed(() => data.value?.meta.counts)`.
- `memutuskan = ref<string | null>(null)`. Isi `decide(item: KurasiInvestorItem, setuju: boolean)`:
  - `if (memutuskan.value) return; memutuskan.value = item.id;` diklaim sebelum `await` (R6).
  - `feedback.value = null`, lalu `try { await directus.request(endpoint(`/v1/program/executive/investor/profil/${item.id}/kurasi`, { method: "POST", body: { setuju } })) …`.
  - Sukses:
    - `feedback = { tone: "success", text: setuju ? `${item.jenama} disetujui.` : `Persetujuan ${item.jenama} dicabut.` }`
    - `cabutTarget.value = null`
    - `await refresh()`
  - `catch (cause)` memetakan `requestErrorCode(cause)`:
    - `STATUS_BERUBAH` → "Status profil sudah berubah oleh petugas lain. Daftar dimuat ulang.", lalu `cabutTarget.value = null` dan `await refresh()`
    - `FORBIDDEN` → "Anda tidak berwenang memutuskan profil ini."
    - `NOT_FOUND` → "Profil tidak ditemukan atau usaha sudah menarik persetujuan.", lalu `await refresh()`
    - lainnya → "Keputusan tidak dapat disimpan. Coba lagi."
    - Pada error selain `STATUS_BERUBAH`, set `cabutError.value` ke teks yang sama **bila** `cabutTarget.value` tidak null. Dialog tetap terbuka (R4). Kalau dialog tidak terbuka, isi `feedback`.
  - `finally { memutuskan.value = null }`.
- Dialog cabut:
  - `const cabutTarget = ref<KurasiInvestorItem | null>(null); const cabutError = ref("");`
  - `function mintaCabut(item) { cabutTarget.value = item; cabutError.value = ""; }`
  - `function tutupCabut(open: boolean) { if (!open && !memutuskan.value) cabutTarget.value = null; }`
- Fungsi `verify` tetap persis (termasuk regex dan pesan).

**Template** (root mengikuti pola baku):

```html
<div class="flex w-full flex-col gap-6 pb-10">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Kurasi Profil Investor</h1>
    <p class="mt-1 text-sm text-muted-foreground">Setujui profil usaha yang sudah memberi persetujuan berbagi sebelum tampil di Direktori Investor.</p>
  </div>
  <p v-if="feedback" … class="rounded-md border p-3 text-sm" :class="tone error ? 'border-destructive/30 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">…</p>
  <div role="tablist" aria-label="Status kurasi investor" class="flex flex-wrap gap-2">
    <!-- tombol tab persis kelas katalog/kurasi.vue; label: `${item.label}${counts ? ` (${counts[item.value]})` : ""}` -->
  </div>
  <UiCard><UiCardContent class="overflow-x-auto p-0">
    <div v-if="error" role="alert" class="p-6 text-sm text-destructive">Daftar profil tidak dapat dimuat. Coba lagi.</div>
    <div v-else-if="pending && !daftar.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
    <div v-else-if="!daftar.length" class="p-6 text-sm text-muted-foreground">Tidak ada profil dengan status ini.</div>
    <ul v-else class="divide-y">
      <li v-for="item in daftar" :key="item.id" class="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
        <div class="min-w-0 flex-1"><p class="font-medium">{{ item.jenama }}</p><p class="text-xs text-muted-foreground">{{ item.nama }}</p></div>
        <ProgramStatusPill :meta="KURASI_INVESTOR_STATUS[item.status]" />
        <UiButton v-if="item.status === 'menunggu' || item.status === 'dicabut'" size="sm" :disabled="Boolean(memutuskan)" @click="decide(item, true)">
          {{ memutuskan === item.id ? "Memproses…" : item.status === "dicabut" ? "Setujui ulang" : "Setujui" }}</UiButton>
        <UiButton v-else-if="item.status === 'disetujui'" size="sm" variant="outline" :disabled="Boolean(memutuskan)" @click="mintaCabut(item)">Cabut persetujuan</UiButton>
      </li>
    </ul>
  </UiCardContent></UiCard>
  <UiCard>  <!-- verifikasi akun investor dipindah ke bawah daftar -->
    <UiCardHeader><UiCardTitle>Verifikasi akun investor</UiCardTitle>
      <UiCardDescription>Gunakan ID akun Directus yang telah diidentifikasi dan disetujui oleh petugas.</UiCardDescription></UiCardHeader>
    <UiCardContent class="grid gap-2"><!-- UiField + dua UiButton dari markup lama, isi tidak berubah --></UiCardContent>
  </UiCard>
  <UiDialog :open="Boolean(cabutTarget)" @update:open="tutupCabut">
    <UiDialogContent v-if="cabutTarget" class="sm:max-w-md" :show-close-button="!memutuskan">
      <UiDialogHeader>
        <UiDialogTitle class="pr-6">Cabut persetujuan {{ cabutTarget.jenama }}?</UiDialogTitle>
        <UiDialogDescription>Profil berhenti tampil di Direktori Investor dan pindah ke tab Persetujuan dicabut. Anda dapat menyetujuinya ulang.</UiDialogDescription>
      </UiDialogHeader>
      <p v-if="cabutError" role="alert" class="text-sm text-destructive">{{ cabutError }}</p>
      <UiDialogFooter>
        <UiButton variant="outline" :disabled="Boolean(memutuskan)" @click="cabutTarget = null">Batal</UiButton>
        <UiButton variant="destructive" :disabled="Boolean(memutuskan)" @click="decide(cabutTarget, false)">{{ memutuskan ? "Memproses…" : "Ya, cabut" }}</UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</div>
```

`belum_disetujui` tidak menampilkan tombol apa pun. Saat tab berganti, `feedback` tidak dihapus. Dialog tertutup dengan sendirinya karena `cabutTarget` hanya di-set lewat `mintaCabut`.

### 5.5 `usaha/investor.vue` (UMKM)

- `interface OwnProfile`: tambahkan `kurator_dicabut_pada: string | null;`.
- Tepat setelah `<p v-if="data?.disetujui_kurator_pada && !data?.dicabut_pada" …>Profil disetujui untuk dibagikan.</p>`, tambahkan `<p v-else-if="data?.kurator_dicabut_pada && data?.disetujui_berbagi_pada && !data?.dicabut_pada" role="status" class="text-sm text-amber-800">Persetujuan kurator dicabut. Perbarui profil untuk mengajukannya kembali ke kurasi.</p>`.

### 5.6 Mock web `tests/fixtures/mock-program.mjs`

- `createProgramState()`: tambahkan `investorProfil` berisi empat profil, satu per status, masing-masing dengan field DB mentah (`disetujui_berbagi_pada`, `dicabut_pada`, `disetujui_kurator_pada`, `kurator_dicabut_pada`, `date_updated`).
  - `id`: `44444444-4444-4444-8444-00000000000{1..4}`
  - `jenama`: "Keripik Menunggu", "Batik Disetujui", "Kopi Belum Setuju", "Tas Dicabut"
  - `nama`: sama dengan `jenama`
- Di dalam handler `**/panel/v1/program/**`, sebelum blok `/passport`, tambahkan:
  - Helper lokal `statusInvestor(p)` dengan presedensi §4 yang identik.
  - `GET /executive/investor/kurasi` → `json(route, 200, { items, meta: { counts } })`, memfilter `status` dari query.
  - `POST /executive/investor/profil/:id/kurasi`:
    - Profil tidak ada atau persetujuan tidak valid → `json(route, 404, "NOT_FOUND")`.
    - Bila `state.gagalKurasiInvestor` → `json(route, 500, "INTERNAL")`.
    - Bila `body.setuju` dan `disetujui_kurator_pada` sudah terisi, atau `!body.setuju` dan kosong → `json(route, 409, "STATUS_BERUBAH")`.
    - Selain itu ubah field persis seperti SQL §5.2 langkah 5, lalu `json(route, 200, { disetujui: body.setuju })`.

### 5.7 Test

- `services/directus/extensions/program/test/executive.test.js`, tambahkan tiga test berbasis `mountEndpoint` dengan db perekam. Aktor provinsi meniru pola test monitoring yang ada: `sql.includes("FROM directus_users WHERE id")` → `{ id, app_role: "provinsi", … }`.
  1. "kurasi investor: status dihitung server dengan presedensi tetap dan satu query counts". Assert:
     - SQL items memuat `WHEN ip.disetujui_berbagi_pada IS NULL OR ip.dicabut_pada IS NOT NULL THEN 'belum_disetujui'` sebelum `kurator_dicabut_pada IS NOT NULL THEN 'dicabut'`.
     - Binding `[ "dicabut", "dicabut" ]` untuk `?status=dicabut`.
     - Hanya satu query yang memuat `COUNT(*) FILTER`.
     - `?status=x` → 400.
  2. "kurasi investor: setujui hanya dari menunggu/dicabut, cabut hanya dari disetujui". UPDATE mengembalikan `{ rows: [] }`, SELECT klasifikasi mengembalikan `{ rows: [{ "?column?": 1 }] }`. Assert:
     - Status 409 dan `extensions.code` `STATUS_BERUBAH`.
     - SQL `setuju:true` memuat `AND disetujui_kurator_pada IS NULL RETURNING`.
     - SQL `setuju:false` memuat `AND disetujui_kurator_pada IS NOT NULL RETURNING`.
  3. "kurasi investor: profil tanpa persetujuan → 404". UPDATE dan SELECT keduanya kosong → 404.
- `services/directus/extensions/program/test/pg/investor-kurasi.test.js` (baru, `{ skip: pgSkipReason() }`, pola `test/pg/katalog-loi.test.js`):
  - Setup:
    - `withDatabase(t)`, lalu `buatKota(db, { id: 7 })`.
    - Empat usaha via `buatUsaha` dan `kurator = await buatUser(db, { appRole: "provinsi" })`.
    - Insert langsung `investor_profil` per status:
      - menunggu: `disetujui_berbagi_oleh/pada` terisi
      - disetujui: plus `disetujui_kurator_oleh/pada`
      - belum: semua NULL
      - dicabut: berbagi terisi + `kurator_dicabut_oleh/pada`
    - `mountEndpoint(register, { database: db })` dengan `accountability: { user: kurator.id, role: APPLICATION_ROLE_ID }`.
  - Kasus:
    1. `GET /investor/kurasi` → `meta.counts` `{1,1,1,1}`. `?status=dicabut` → 1 item berstatus `dicabut`.
    2. `POST …/<disetujui>/kurasi {setuju:true}` → 409, dan `disetujui_kurator_pada` di DB tidak berubah (bandingkan nilai sebelum/sesudah).
    3. `POST …/<menunggu>/kurasi {setuju:false}` → 409.
    4. `POST …/<disetujui>/kurasi {setuju:false}` → 200. Baris DB memiliki `kurator_dicabut_oleh = kurator.id` dan `disetujui_kurator_pada IS NULL`. `GET ?status=dicabut` memuatnya.
    5. `POST …/<dicabut>/kurasi {setuju:true}` → 200. `kurator_dicabut_pada IS NULL`, status `disetujui`.
    6. `POST …/<belum>/kurasi {setuju:true}` → 404.
    7. Konkurensi (R2): `Promise.all` dua `POST …/<menunggu baru>/kurasi {setuju:true}` → tepat satu 200 dan satu 409.
    8. Reset oleh UMKM: `POST /investor/profil` sebagai `buatUser(db, { appRole: "umkm", usahaId: <usaha profil dicabut> })` dengan body valid (`jenama`, `skema:["kur"]`, `kebutuhanModal: 1000000`, `setuju: true`) → 200, lalu `GET /investor/kurasi` menunjukkan profil itu berstatus `menunggu` dan `kurator_dicabut_pada IS NULL` di DB.
- `apps/web/tests/e2e/investor-kurasi.spec.ts` (baru). Pola `passport.spec.ts`: `installMockDirectus(page, { authenticated: true })`, `installMockProgram(page, state)`, `loginMock(page, "/dashboard/investor-kurasi")`.
  1. "tab investor menampilkan jumlah dan tombol sesuai status":
     - Tab `Menunggu kurasi (1)` aktif, dan kartu "Keripik Menunggu" punya tombol "Setujui".
     - Klik tab `Disetujui (1)`: kartu "Batik Disetujui" tanpa tombol bernama "Setujui" (`toHaveCount(0)`), ada "Cabut persetujuan".
     - Tab `Belum disetujui usaha (1)` tanpa tombol.
     - Tab `Persetujuan dicabut (1)` dengan tombol "Setujui ulang".
  2. "cabut persetujuan lewat dialog, gagal mempertahankan dialog, lalu berhasil":
     - Set `state.gagalKurasiInvestor = true`. Tab Disetujui → "Cabut persetujuan" → dialog judul "Cabut persetujuan Batik Disetujui?" → "Ya, cabut".
     - Dialog tetap terlihat dengan `role=alert` "Keputusan tidak dapat disimpan. Coba lagi." (R4).
     - Set `state.gagalKurasiInvestor = false` lalu klik "Ya, cabut" lagi. Pesan "Persetujuan Batik Disetujui dicabut." tampil, dan tab `Persetujuan dicabut (2)`.
  3. "status berubah di tab lain → pesan dan daftar dimuat ulang": ubah `state.investorProfil` profil menunggu menjadi disetujui setelah halaman dimuat, lalu klik "Setujui". Pesan "Status profil sudah berubah oleh petugas lain. Daftar dimuat ulang." tampil, dan kartu hilang dari tab Menunggu.
  4. "klik ganda Setujui hanya mengirim satu permintaan" (R6): `dblclick` "Setujui", lalu `state.requests.filter(r => r.method === "POST" && /\/executive\/investor\/profil\/.+\/kurasi$/.test(r.path)).length === 1`.

## 6. Kasus campuran, negatif, batas, lintas peran, siklus hidup

- **Presedensi**: profil yang dicabut kurator lalu usaha menarik persetujuan → `belum_disetujui` (unit 1, pg 1 bisa ditambah satu baris).
- **Negatif**:
  - Setujui `disetujui` → 409.
  - Cabut `menunggu`/`dicabut`/`belum` → 409/409/404.
  - `status=x` → 400.
- **Lintas peran**: kabkota/pendamping/umkm memanggil `GET /investor/kurasi` → 403 dari `terjaga` (sudah diuji manifest; e2e tidak perlu).
- **Siklus hidup**: UMKM mengedit profil `dicabut` → `menunggu` (pg 8).
- **Gagal klien**: dialog tetap terbuka dengan pesan inline (e2e 2), dan klik ganda menghasilkan satu request (e2e 4).
- **Konkurensi**: pg 7.
- Halaman `/investor` (direktori publik investor) tetap menyaring profil `dicabut` (tidak berubah). Bukti: unit test lama "investor filters … only approved, active, consented profiles" tetap hijau.

## 7. Perintah validasi dan hasil yang diharapkan

```bash
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk
python3 docs/qc-diskuk-e2e-plan/scope_guard.py snapshot --output /tmp/qc-phase-8.json   # sebelum edit
cd services/directus/extensions/program && node --test test/executive.test.js            # pass semua, termasuk 3 test baru
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk/services/directus && node --test test/route-manifest.contract.test.mjs test/public-grants.contract.test.mjs   # pass
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk && bash scripts/test-db-template.sh   # template dibangun ulang (hash migrations berubah)
cd services/directus/extensions/program && DISKUK_TEST_PG_URL="$DISKUK_TEST_PG_URL" node --test test/pg/investor-kurasi.test.js   # 8 kasus pass, 0 skip
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk/apps/web && pnpm lint && pnpm typecheck   # 0 error/warning
pnpm exec playwright test tests/e2e/investor-kurasi.spec.ts tests/e2e/roles.spec.ts --project=chromium   # pass
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk && python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-8.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 8   # "outside": []
```

Sentinel sumber (harus 0 hit setelah edit): `rg -n "statusItem|QueueItem" "apps/web/app/pages/(private)/dashboard/investor-kurasi.vue"`.

Sentinel kontrak (harus 1 hit): `rg -n "AND disetujui_kurator_pada IS NULL RETURNING usaha" services/directus/extensions/program/src/endpoints/executive/index.js`.

## 8. Bukti runtime/browser/migration

- **Migration**: pada stack lokal (`docker compose` proyek repo), jalankan `cd services/directus && pnpm dbm:l`. Lalu `\d investor_profil` menampilkan dua kolom baru dan constraint. Jalankan `pnpm dbm:d` sekali (kolom hilang), lalu `pnpm dbm:l` lagi.
- **API terautentikasi** (cookie sesi provinsi lokal; `$BASE` = origin aplikasi pada stack lokal):
  - `curl -s -b <cookie> "$BASE/panel/v1/program/executive/investor/kurasi" | jq '.data.meta.counts'` → objek empat kunci.
  - `POST` setujui profil Disetujui → HTTP 409 `STATUS_BERUBAH`.
- **Browser**: flow §5 `main_plan.md` BUG-016…018. Screenshot `evidence/BUG-016-after-1.png` (tab Menunggu), `BUG-018-after-1.png` (tab Disetujui tanpa Setujui), `BUG-017-after-1.png` (tab Persetujuan dicabut setelah cabut). Before diambil dari baseline.
- **Belum terbukti bila stack/DB test tidak tersedia**: konkurensi nyata (pg 7) dan migration up/down. Catat sebagai "unproven". Phase tidak boleh di-commit tanpa pg 2, 4, 5, dan 7 hijau (gerbang R2).

## 9. Rollback dan handoff

- **Rollback**: `git revert <commit phase 8>`. Bila migration sudah dijalankan di DB lokal, jalankan `pnpm dbm:d` sebelum revert. Kolom baru nullable, jadi kode lama tetap jalan walau kolom masih ada.
- **Commit**: `fix(program): BUG-016/017/018 kurasi investor bertab dengan status server dan guard transisi` + trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Handoff ke phase 9**: tidak ada file bersama. Phase 9 memakai migration `20261001C`, yang harus terurut setelah `20261001B`.

## 10. Aturan scope-amendment

Bila edit memerlukan file di luar manifest §2 (misalnya `constants/PROGRAM.ts`, `NAVIGATION.ts`, atau `src/oas.yaml`), **berhenti** dan laporkan file, alasan, dan diff yang diusulkan. Jangan mengedit file tersebut. `scope_guard.py check` harus menghasilkan `"outside": []` sebelum commit.
