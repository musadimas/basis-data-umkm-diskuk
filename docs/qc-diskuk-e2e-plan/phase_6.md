# Phase 6 — Panel Pendampingan: paging antrean, peringatan tanpa bukti, aturan pitching terbaru

**Bug:** BUG-012, BUG-013, BUG-014 · **Commit:** `fix(program): BUG-012/013/014 paging antrean KPI, peringatan tanpa bukti, rangkaian pitching terbaru`

## 1. Tujuan, dependensi, hasil yang dapat diamati

- **Tujuan:** (a) antrean laporan mingguan dipaging di server 25 baris per halaman dengan total; (b) menyetujui laporan tanpa foto bukti memerlukan konfirmasi kedua (server tidak berubah — keputusan user "peringatan saja"); (c) kelayakan rekomendasi pitching dihitung dari rangkaian **terbaru**, bukan rangkaian terpanjang.
- **Dependensi:** gerbang main_plan §9 lulus; phase 5 sudah ter-commit (urutan main_plan §6). Tidak ada ketergantungan kode pada phase 1–5.
- **Hasil yang terlihat:**
  - `/dashboard/pendampingan` tab Disetujui dengan > 25 laporan menampilkan 25 baris + "1–25 dari N" + tombol Sebelumnya/Berikutnya.
  - Modal tinjau laporan tanpa foto menampilkan banner peringatan; klik "Setujui & Verifikasi Laporan" berganti ke konfirmasi "Tetap setujui tanpa foto bukti?".
  - `/dashboard/pendampingan/<peserta>` untuk pola minggu 1–6 capai target + minggu 7 ditolak (kasus screenshot BUG-014): checkbox "Rekomendasikan ke Talent Investment Day / Champion" nonaktif dengan penjelasan.

## 2. Manifest file tertutup

| Aksi | Path |
|---|---|
| modify | `services/directus/extensions/program/src/endpoints/kpi/rules.js` |
| modify | `services/directus/extensions/program/src/endpoints/kpi/service.js` |
| modify | `services/directus/extensions/program/src/oas.yaml` |
| modify | `services/directus/extensions/program/test/kpi.test.js` |
| modify | `services/directus/extensions/program/test/pg/kpi-alur.test.js` |
| modify | `apps/web/app/types/program.ts` |
| modify | `apps/web/app/lib/kpi.ts` |
| modify | `apps/web/app/pages/(private)/dashboard/pendampingan/index.vue` |
| modify | `apps/web/app/pages/(private)/dashboard/pendampingan/[pesertaId].vue` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| modify | `apps/web/tests/fixtures/mock-directus-server.mjs` |
| modify | `apps/web/tests/e2e/kpi.spec.ts` |
| modify | `apps/web/tests/e2e/operasional.directus.spec.ts` |

Tidak ada file dibuat atau dihapus. Tidak ada migration.

## 3. Simbol dan anchor yang wajib dibaca dulu

- `kpi/rules.js`: `PITCHING_STREAK`, `longestTargetStreak`, `pitchingEligible`.
- `kpi/service.js`: import baris 3 (`longestTargetStreak`), `LAPORAN_STATUS`, `LAPORAN_SELECT`, `PESERTA_SELECT`, `createKpi` → `bacaPeserta` (cari `const streak = longestTargetStreak(laporan);`), `listLaporan` (cari `LIMIT 500`), `setPitching` (cari `PITCHING_BELUM_MEMENUHI`).
- `kpi/index.js` (hanya baca): `jalan` menulis `res.json({ data })`; route `router.get("/laporan", …)` meneruskan `req.query`.
- `lib/validate.js` (hanya baca): `oneOf(body, field, choices, fallback)`.
- `oas.yaml` baris `/kpi/laporan:`.
- `apps/web/app/lib/directus.ts::endpoint` — SDK membuka `data`, jadi klien menerima `{ items, meta }`.
- `types/program.ts`: `interface KpiLaporanQueueItem`, `interface KpiPesertaDetail`.
- `lib/kpi.ts`: kunci `PITCHING_BELUM_MEMENUHI`.
- `pendampingan/index.vue`: `useAsyncData<KpiLaporanQueueItem[]>(`, `function decide(`, `UiDialogFooter v-if="active.status === 'menunggu'"`, tablist `@click="tab = item.value"`.
- `[pesertaId].vue`: `Rangkaian terpanjang:`, `Rekomendasikan untuk sesi pitching investor`, `PITCHING_BELUM_MEMENUHI`.
- `mock-program.mjs`: import baris 9 (`longestTargetStreak`), `const streak = (pesertaId) =>`, handler `path === "/kpi/laporan"`.
- `mock-directus-server.mjs`: baris yang memuat `"/v1/program/kpi/laporan"` di array respons `{ data: [] }`.
- `kpi.spec.ts`: `name: "Review"`, `Rekomendasikan untuk sesi pitching investor`, `Rangkaian terpanjang`.
- `operasional.directus.spec.ts`: `/Rangkaian terpanjang:/`, `/Rekomendasikan untuk sesi pitching/`.

## 4. Kontrak saat ini → kontrak akhir

### 4.1 `GET /v1/program/kpi/laporan`

| | Saat ini | Akhir |
|---|---|---|
| Query | `status` (`menunggu` default) | `status` (sama), `page` (bilangan bulat ≥ 1, default 1). `limit` **tidak** diterima dari klien |
| Ukuran halaman | `LIMIT 500` | konstanta `HALAMAN_ANTREAN = 25` diekspor dari `service.js` |
| Urutan | `l.date_updated ASC` (menunggu) / `DESC` (lain) | sama + tie-breaker: `, l.id ASC` (menunggu) / `, l.id DESC` (lain) |
| Respons `data` | `KpiLaporanQueueItem[]` | `{ items: KpiLaporanQueueItem[], meta: { page, limit: 25, total } }` |
| Total | — | `SELECT COUNT(*)::integer` dengan `WHERE` + scope identik (query kedua, binding identik); halaman melewati akhir → `items: []`, `total` tetap benar |
| Error | 400 `INVALID_PAYLOAD` untuk status salah (via `oneOf`) | + 400 `INVALID_PAGE` bila `page` bukan `^[1-9][0-9]{0,5}$` |
| Izin | REVIEW (provinsi, pendamping) + `predikat` | tidak berubah |

`meta` berada **di dalam** `data` (pola `authentication/src/endpoints/activity/service.js`) karena SDK hanya mengembalikan `data`.

### 4.2 Pitching

| | Saat ini | Akhir |
|---|---|---|
| Fungsi | `longestTargetStreak(reports)` = rangkaian terpanjang di mana pun | `latestTargetStreak(reports)` (baru); `longestTargetStreak` **dihapus** (semua consumer — `service.js`, `mock-program.mjs`, `test/kpi.test.js` — diubah di phase ini) |
| `pitchingEligible` | `longest >= 4` | `latestTargetStreak(reports) >= PITCHING_STREAK` |
| Respons `bacaPeserta.pitching` | `{ streak, dibutuhkan, memenuhi }` | bentuk sama; `streak` = rangkaian terbaru |
| `setPitching(true)` | 409 bila terpanjang < 4 | 409 bila terbaru < 4; `setPitching(false)` selalu boleh (tidak ada auto-revoke) |

**Algoritma `latestTargetStreak` (dikunci):**

```js
/**
 * Rangkaian minggu terbaru yang disetujui dan mencapai target (BUG-014). Laporan `menunggu`
 * di ujung belum dihitung; L = minggu tertinggi di antara laporan yang sudah ditinjau. Berjalan
 * mundur dari L: berhenti pada minggu yang hilang, ditolak, di bawah target, atau masih menunggu.
 */
export function latestTargetStreak(reports) {
  const byWeek = new Map(reports.map((report) => [Number(report.mingguKe), report]));
  const reviewed = reports.filter((report) => report.status !== "menunggu").map((report) => Number(report.mingguKe));
  if (!reviewed.length) return 0;
  let streak = 0;
  for (let week = Math.max(...reviewed); week >= 1; week -= 1) {
    const report = byWeek.get(week);
    if (!report || report.status !== "disetujui" || !(Number(report.realisasiOmzet) >= Number(report.target))) break;
    streak += 1;
  }
  return streak;
}
```

`UNIQUE (peserta, minggu_ke)` menjamin satu laporan per minggu, sehingga `Map` tidak kehilangan data.

### 4.3 Konfirmasi tanpa bukti (klien saja)

Server `reviewLaporan` tidak berubah. State modal: `konfirmasiTanpaBukti: boolean`.

| State | Kondisi | Footer |
|---|---|---|
| normal | `active.status === 'menunggu'` dan (`bukti.length > 0` atau `!konfirmasiTanpaBukti`) | "Tolak & Minta Perbaikan Bukti", "Setujui & Verifikasi Laporan" |
| konfirmasi | `konfirmasiTanpaBukti === true` | teks "Tetap setujui tanpa foto bukti?", "Batal", "Ya, setujui tanpa bukti" |
| hanya-baca | `active.status !== 'menunggu'` | tanpa footer (existing) |

Transisi: `open(item)` → `konfirmasiTanpaBukti=false`; klik Setujui saat `bukti.length===0 && !konfirmasiTanpaBukti` → `konfirmasiTanpaBukti=true` tanpa request; "Batal" → `false`; "Ya, setujui tanpa bukti" → kirim `disetujui`; tutup modal (`active=null`) → `watch(active)` mereset `konfirmasiTanpaBukti=false` dan `reviewError=''`; sukses → existing (`active=null`, refresh); gagal → `active`, `catatan`, `konfirmasiTanpaBukti` dipertahankan, `reviewError` diisi.

## 5. Edit berurutan

### Langkah 1 — `kpi/rules.js`
1. Hapus fungsi `longestTargetStreak` beserta JSDoc-nya.
2. Tambahkan `latestTargetStreak` persis seperti §4.2 di tempat yang sama.
3. Ubah `pitchingEligible` menjadi `return latestTargetStreak(reports) >= PITCHING_STREAK;`.

### Langkah 2 — `kpi/service.js`
1. Import baris 3: ganti `longestTargetStreak` dengan `latestTargetStreak`.
2. Di bawah `const MAX_BUKTI = 5;` tambahkan:
   ```js
   /** Ukuran halaman antrean review (BUG-012); klien hanya mengirim nomor halaman. */
   export const HALAMAN_ANTREAN = 25;
   ```
3. Tambahkan helper modul (di atas `createKpi`):
   ```js
   /** Nomor halaman 1-based dari query; selain bilangan bulat positif → 400. */
   function nomorHalaman(query) {
     const raw = query.page ?? "1";
     if (typeof raw !== "string" || !/^[1-9][0-9]{0,5}$/.test(raw)) {
       throw new ProgramError(400, "INVALID_PAGE", 'The query "page" must be a positive integer.');
     }
     return Number(raw);
   }
   ```
4. `bacaPeserta`: `const streak = latestTargetStreak(laporan);` (bentuk `pitching` tetap).
5. `setPitching`: `const streak = latestTargetStreak(await loadLaporanList(trx, id));` dan pesan 409 menjadi `` `Needs ${PITCHING_STREAK} consecutive approved on-target weeks ending at the latest reviewed week; the latest run is ${streak}.` ``.
6. `listLaporan` diganti menjadi:
   ```js
   /** Antrean review per halaman (BUG-012): `{ items, meta: { page, limit, total } }`. */
   async function listLaporan(pemanggil, query = {}) {
     const status = oneOf(query, "status", LAPORAN_STATUS, "menunggu");
     const page = nomorHalaman(query);
     const scope = predikat(pemanggil, "peserta", "p");
     const arah = status === "menunggu" ? "ASC" : "DESC";
     const where = `WHERE l.status = ? AND (${scope.sql})`;
     const bindings = [status, ...scope.bindings];
     const total = Number(
       rows(await db.raw(`SELECT COUNT(*)::integer AS total FROM kpi_laporan l JOIN program_peserta p ON p.id = l.peserta ${where}`, bindings))[0]?.total ?? 0,
     );
     const result = await db.raw(
       `${LAPORAN_SELECT}
          JOIN program_peserta p ON p.id = l.peserta
         ${where}
         ORDER BY l.date_updated ${arah}, l.id ${arah}
         LIMIT ? OFFSET ?`,
       [...bindings, HALAMAN_ANTREAN, (page - 1) * HALAMAN_ANTREAN],
     );
     const laporan = rows(result).map(toLaporan);
     // … blok pesertaIds/peserta/byId lama tetap persis seperti sekarang …
     return {
       items: laporan.map((item) => ({ ...item, pesertaInfo: byId.get(item.peserta) ?? null })),
       meta: { page, limit: HALAMAN_ANTREAN, total },
     };
   }
   ```
   `kpi/index.js` tidak diubah: `data(kpi.listLaporan(…))` membungkus objek ini sebagai `{ data: { items, meta } }`.

### Langkah 3 — `oas.yaml`
Ganti baris `/kpi/laporan:` menjadi:
```yaml
  /kpi/laporan: { get: { tags: [KPI Mingguan], parameters: [{ in: query, name: status, schema: { type: string, enum: [menunggu, disetujui, ditolak] } }, { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }], responses: { "200": { description: "Review queue page: { items, meta: { page, limit: 25, total } }" }, "400": { description: INVALID_PAGE } } } }
```

### Langkah 4 — `types/program.ts`
Setelah `interface KpiLaporanQueueItem`, tambahkan:
```ts
/** Satu halaman antrean review (BUG-012). */
export interface KpiLaporanQueuePage {
  items: KpiLaporanQueueItem[];
  meta: { page: number; limit: number; total: number };
}
```

### Langkah 5 — `lib/kpi.ts`
`PITCHING_BELUM_MEMENUHI: "Rekomendasi membutuhkan 4 minggu terbaru berturut-turut yang disetujui dan mencapai target.",`

### Langkah 6 — `pendampingan/index.vue`
1. Tambahkan `KpiLaporanQueuePage` ke import tipe; `KpiLaporanQueueItem` tetap diimpor (dipakai `active`).
2. Tambahkan `const HALAMAN = 25;` dan `const page = ref(1);`.
3. Ganti `useAsyncData` antrean:
   ```ts
   const KOSONG: KpiLaporanQueuePage = { items: [], meta: { page: 1, limit: HALAMAN, total: 0 } };
   const { data: antrean, pending, error, refresh } = await useAsyncData<KpiLaporanQueuePage>(
     "kpi:laporan",
     () =>
       tab.value === "belum_mengirim"
         ? Promise.resolve(KOSONG)
         : directus.request(endpoint<KpiLaporanQueuePage>("/v1/program/kpi/laporan", { query: { status: tab.value, page: page.value } })),
     { watch: [tab, page] },
   );
   const queue = computed(() => antrean.value?.items ?? []);
   ```
   Semua pemakaian `queue` di template tetap (`queue.length` menggantikan `queue?.length`).
4. Ganti tablist `@click="tab = item.value"` dengan `@click="pilihTab(item.value)"` dan tambahkan:
   ```ts
   /** Ganti tab dan kembali ke halaman 1 pada tick yang sama, sehingga hanya satu fetch (R9). */
   function pilihTab(value: Tab) {
     page.value = 1;
     tab.value = value;
   }
   ```
5. Pager. Tambahkan computed:
   ```ts
   const belumMengirimHalaman = computed(() => belumMengirim.value.slice((page.value - 1) * HALAMAN, page.value * HALAMAN));
   const total = computed(() => (tab.value === "belum_mengirim" ? belumMengirim.value.length : (antrean.value?.meta.total ?? 0)));
   const jumlahHalaman = computed(() => Math.max(1, Math.ceil(total.value / HALAMAN)));
   const awal = computed(() => (total.value ? (page.value - 1) * HALAMAN + 1 : 0));
   const akhir = computed(() => Math.min(page.value * HALAMAN, total.value));
   ```
   - Daftar Belum Mengirim memakai `belumMengirimHalaman` (bukan `belumMengirim`); label tab tetap `({{ belumMengirim.length }})`.
   - Setelah `</table>` dan setelah `</ul>` Belum Mengirim (keduanya di dalam `UiCardContent`), sisipkan satu blok yang tampil bila `total > 0`:
     ```vue
     <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm" data-testid="pager-antrean">
       <p class="text-muted-foreground">{{ awal }}–{{ akhir }} dari {{ total }}</p>
       <div class="flex gap-2">
         <UiButton variant="outline" size="sm" :disabled="page <= 1 || pending" @click="page -= 1">Sebelumnya</UiButton>
         <UiButton variant="outline" size="sm" :disabled="page >= jumlahHalaman || pending" @click="page += 1">Berikutnya</UiButton>
       </div>
     </div>
     ```
     Letakkan blok ini **sekali** di akhir `UiCardContent` (di luar `v-if/v-else` daftar) agar tampil untuk kedua jenis tab.
   - Setelah keputusan sukses (`await Promise.all([refresh(), refreshPeserta()])`), tambahkan: `if (!queue.value.length && page.value > 1) page.value -= 1;` (halaman yang kosong setelah item terakhir pindah tab).
6. BUG-013:
   - `const konfirmasiTanpaBukti = ref(false);`
   - `open(item)`: tambahkan `konfirmasiTanpaBukti.value = false;`.
   - `watch(active, (value) => { if (!value) { konfirmasiTanpaBukti.value = false; reviewError.value = ""; } });`
   - Awal `decide`: `if (!active.value || deciding.value) return;` (klaim guard sebelum `await`, R6). Setelah validasi catatan, sebelum `deciding.value = keputusan`:
     ```ts
     if (keputusan === "disetujui" && !active.value.bukti.length && !konfirmasiTanpaBukti.value) {
       konfirmasiTanpaBukti.value = true;
       return;
     }
     ```
   - Di modal, tepat di bawah `<p v-if="!active.bukti.length" …>Tidak ada foto.</p>` (di dalam blok foto), tambahkan untuk `active.status === 'menunggu'`:
     ```vue
     <p v-if="!active.bukti.length && active.status === 'menunggu'" role="status" data-testid="peringatan-tanpa-bukti" class="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
       Laporan ini tidak melampirkan foto bukti transaksi. Periksa kewajaran omzet sebelum menyetujui.
     </p>
     ```
   - Footer: ubah `UiDialogFooter v-if="active.status === 'menunggu'"` menjadi dua cabang:
     ```vue
     <UiDialogFooter v-if="active.status === 'menunggu' && konfirmasiTanpaBukti" class="items-center gap-2">
       <p class="mr-auto text-sm font-medium">Tetap setujui tanpa foto bukti?</p>
       <UiButton variant="outline" :disabled="Boolean(deciding)" @click="konfirmasiTanpaBukti = false">Batal</UiButton>
       <UiButton :disabled="Boolean(deciding)" @click="decide('disetujui')">{{ deciding === "disetujui" ? "Menyimpan…" : "Ya, setujui tanpa bukti" }}</UiButton>
     </UiDialogFooter>
     <UiDialogFooter v-else-if="active.status === 'menunggu'" class="gap-2"> …dua tombol existing tanpa perubahan… </UiDialogFooter>
     ```
   - Gagal: blok `catch` existing tidak mereset `konfirmasiTanpaBukti` (state dipertahankan, R4).

### Langkah 7 — `[pesertaId].vue`
1. `UiCardDescription` pitching: `Rangkaian terbaru: {{ data.pitching.streak }} minggu berturut-turut disetujui dan mencapai target (dibutuhkan {{ data.pitching.dibutuhkan }}).`
2. Label checkbox: `Rekomendasikan ke Talent Investment Day / Champion`. Ekspresi `:disabled` tidak berubah (sudah mengizinkan mencabut rekomendasi yang tercentang).
3. Petunjuk saat `!memenuhi && !rekomendasiPitching`: `Aktif bila {{ data.pitching.dibutuhkan }} minggu terbaru berturut-turut disetujui dan mencapai target. Laporan terbaru yang ditolak atau minggu yang terlewat memutus rangkaian; laporan yang masih menunggu belum dihitung.`
4. Tambahkan setelahnya:
   ```vue
   <p v-if="!data.pitching.memenuhi && data.peserta.rekomendasiPitching" role="status" class="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
     Syarat rekomendasi tidak lagi terpenuhi (rangkaian terbaru {{ data.pitching.streak }} minggu). Rekomendasi tetap tersimpan sampai dicabut.
   </p>
   ```
5. Pesan `PITCHING_BELUM_MEMENUHI` lokal: samakan dengan Langkah 5.
6. `setPitching`: tambahkan `if (saving.value) return;` sebelum `saving.value = true` (R6).

### Langkah 8 — `mock-program.mjs`
1. Import baris 9: `longestTargetStreak` → `latestTargetStreak`; `const streak = (pesertaId) => latestTargetStreak(laporanOf(pesertaId));`.
2. Handler `GET /kpi/laporan`:
   ```js
   const params = new URL(request.url()).searchParams;
   const status = params.get("status") ?? "menunggu";
   const page = Number(params.get("page") ?? "1");
   const semua = state.laporan.filter((item) => item.status === status).map((item) => ({ ...item, pesertaInfo: state.peserta.find((p) => p.id === item.peserta) }));
   return json(route, 200, { items: semua.slice((page - 1) * 25, page * 25), meta: { page, limit: 25, total: semua.length } });
   ```

### Langkah 9 — `mock-directus-server.mjs`
Keluarkan `"/v1/program/kpi/laporan"` dari array yang menjawab `{ data: [] }` dan tambahkan cabang tepat sesudahnya:
```js
if (method === "GET" && path === "/v1/program/kpi/laporan") {
  response.end(JSON.stringify({ data: { items: [], meta: { page: 1, limit: 25, total: 0 } } }));
  return;
}
```

### Langkah 10 — test ekstensi
1. `test/kpi.test.js`: import `latestTargetStreak` (hapus `longestTargetStreak`). Ganti test streak dengan:
   ```js
   test("pitching memakai rangkaian terbaru yang disetujui dan mencapai target (BUG-014)", () => {
     const r = report;
     assert.equal(latestTargetStreak([r(1, 100), r(2, 100), r(3, 100)]), 3, "PDP-020: 3 pekan");
     assert.equal(pitchingEligible([r(1, 100), r(2, 100), r(3, 100)]), false);
     assert.equal(pitchingEligible([r(1, 100), r(2, 100), r(3, 100), r(4, 100)]), true, "PDP-021: tepat 4");
     assert.equal(latestTargetStreak([r(1, 100), r(2, 100), r(3, 99), r(4, 100), r(5, 100)]), 2, "PDP-022: streak terputus");
     const enamPlusDitolak = [1, 2, 3, 4, 5, 6].map((w) => r(w, 110)).concat(r(7, 120, "ditolak"));
     assert.equal(latestTargetStreak(enamPlusDitolak), 0, "laporan terbaru ditolak");
     const enamPlusMenunggu = [1, 2, 3, 4, 5, 6].map((w) => r(w, 110)).concat(r(7, 120, "menunggu"));
     assert.equal(latestTargetStreak(enamPlusMenunggu), 6, "menunggu di ujung belum dihitung");
     assert.equal(latestTargetStreak([r(1, 100), r(2, 100, "menunggu"), r(3, 100), r(4, 100)]), 2, "menunggu di tengah memutus");
     assert.equal(latestTargetStreak([r(1, 100), r(2, 100), r(4, 100), r(5, 100)]), 2, "minggu hilang memutus");
     assert.equal(latestTargetStreak([r(1, 100), r(2, 100), r(3, 100), r(4, 100), r(5, 50)]), 0, "terbaru di bawah target");
     assert.equal(latestTargetStreak([r(5, 100), r(3, 100), r(4, 100), r(6, 100)]), 4, "urutan input tidak berpengaruh");
     assert.equal(latestTargetStreak([r(1, 100, "menunggu")]), 0);
     assert.equal(latestTargetStreak([]), 0);
   });
   ```
2. Tambahkan test unit paging (fake db merekam SQL):
   ```js
   test("antrean review dipaging 25 per halaman dengan total (BUG-012)", async () => {
     const calls = [];
     const db = { raw: withUsers(async (sql, bindings) => { calls.push({ sql, bindings }); return sql.includes("COUNT(*)") ? { rows: [{ total: 26 }] } : { rows: [] }; }) };
     const { call } = mountEndpoint(registerKpi, { database: db });
     const page2 = await call("GET", "/laporan", { query: { status: "disetujui", page: "2" } });
     assert.equal(page2.res.statusCode, 200);
     assert.deepEqual(page2.res.body.data, { items: [], meta: { page: 2, limit: 25, total: 26 } });
     const list = calls.find((c) => c.sql.includes("LIMIT ? OFFSET ?"));
     assert.deepEqual(list.bindings.slice(-2), [25, 25]);
     assert.match(list.sql, /ORDER BY l\.date_updated DESC, l\.id DESC/);
     for (const bad of ["0", "-1", "abc", "1.5"]) {
       const res = await call("GET", "/laporan", { query: { status: "disetujui", page: bad } });
       assert.equal(res.res.statusCode, 400, bad);
       assert.equal(res.res.body.errors[0].extensions.code, "INVALID_PAGE");
     }
   });
   ```
   `test/helpers.js::mountEndpoint` sudah meneruskan opsi `query` dan `accountability` ke request (default `query: {}`, `accountability: APP_USER`); `withUsers` di `kpi.test.js` menjawab lookup `directus_users` dengan akun provinsi.
3. `test/pg/kpi-alur.test.js` — tambahkan:
   ```js
   test("antrean disetujui dipaging 25/halaman, stabil, dan halaman lewat akhir kosong", { skip: pgSkipReason() }, async (t) => {
     const { db } = await withDatabase(t);
     const a = await siapkan(db, { nama: "Usaha A" });
     const b = await siapkan(db, { nama: "Usaha B" });
     const c = await siapkan(db, { nama: "Usaha C" });
     const { call } = mountEndpoint(registerKpi, { database: db });
     const stamp = "2026-09-20T00:00:00Z"; // date_updated identik → urutan ditentukan tie-breaker id
     for (const { peserta } of [a, b, c]) {
       for (let minggu = 1; minggu <= 9; minggu += 1) {
         await db("kpi_laporan").insert({ peserta: peserta.id, minggu_ke: minggu, target: 4, realisasi_omzet: 5, jumlah_transaksi: 1, client_uuid: uuid(), status: "disetujui", date_updated: stamp });
       }
     }
     const ambil = (page) => call("GET", "/laporan", { accountability: akun(a.provinsi.id), query: { status: "disetujui", page: String(page) } });
     const satu = await ambil(1);
     const dua = await ambil(2);
     const lewat = await ambil(3);
     assert.equal(satu.res.body.data.meta.total, 27);
     assert.equal(satu.res.body.data.items.length, 25);
     assert.equal(dua.res.body.data.items.length, 2);
     assert.equal(lewat.res.body.data.items.length, 0);
     assert.equal(lewat.res.body.data.meta.total, 27);
     const ids = [...satu.res.body.data.items, ...dua.res.body.data.items].map((item) => item.id);
     assert.equal(new Set(ids).size, 27, "tidak ada baris ganda/hilang antar halaman");
   });
   ```
   `siapkan` dipanggil tiga kali dengan aman: `test-support/fixtures.mjs::buatKota` memakai `onConflict("id").ignore()`. Akun `a.provinsi` melihat semua peserta (predikat provinsi).

### Langkah 11 — e2e mock
1. `kpi.spec.ts`:
   - `name: "Review"` → `name: "Tinjau"` (tombol baris sejak commit d35158d).
   - Test pitching: checkbox name → `"Rekomendasikan ke Talent Investment Day / Champion"`; teks `"Rangkaian terpanjang: 3 minggu"` → `"Rangkaian terbaru: 3 minggu"`, `…4 minggu` sama.
   - Tambahkan test **BUG-013**: laporan `menunggu` dengan `bukti: []` → klik "Tinjau" → `getByTestId("peringatan-tanpa-bukti")` terlihat → klik "Setujui & Verifikasi Laporan" → tidak ada request `/review` (cek `state.requests`) dan teks "Tetap setujui tanpa foto bukti?" terlihat → "Batal" → kembali ke dua tombol → Setujui lagi → "Ya, setujui tanpa bukti" → pesan "minggu ke-5 disetujui".
   - Tambahkan test **BUG-013 gagal mempertahankan state**: `page.route("**/panel/v1/program/kpi/laporan/*/review", r => r.fulfill({ status: 500, … }))` **sebelum** `installMockProgram`-route review dipakai (daftarkan setelah `installMockProgram` agar menang), → konfirmasi → "Ya, setujui tanpa bukti" → pesan "Keputusan tidak dapat disimpan. Coba lagi." terlihat, modal tetap terbuka, teks konfirmasi masih terlihat.
   - Tambahkan test **BUG-012**: 26 laporan `disetujui` (id `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`, `mingguKe` n, `clientUuid` unik) → buka tab Disetujui → `getByTestId("pager-antrean")` berisi "1–25 dari 26"; 25 baris `tbody tr`; Berikutnya → "26–26 dari 26", 1 baris, Berikutnya nonaktif; klik tab Ditolak lalu Disetujui lagi → "1–25 dari 26" (reset halaman, R9).
   - Tambahkan test **BUG-014**: laporan minggu 1–6 `disetujui` capai target + minggu 7 status `ditolak` (helper `laporan` diperluas menerima `"ditolak"`) → halaman peserta → "Rangkaian terbaru: 0 minggu", checkbox nonaktif; variasi `rekomendasiPitching = true` pada `state.peserta[0]` → banner "Syarat rekomendasi tidak lagi terpenuhi" terlihat dan checkbox aktif (dapat dicabut).
2. `operasional.directus.spec.ts`: `/Rangkaian terpanjang:/` → `/Rangkaian terbaru:/`; `/Rekomendasikan untuk sesi pitching/` → `/Rekomendasikan ke Talent Investment Day/`.

## 6. Kasus campuran, negatif, batas, lintas peran, siklus hidup, gagal

| Kasus | Harapan | Bukti |
|---|---|---|
| `page` = 0, -1, `abc`, `1.5` | 400 `INVALID_PAGE` | unit Langkah 10.2 |
| halaman lewat akhir | `items: []`, `total` benar | pg Langkah 10.3 |
| tanggal `date_updated` sama | urutan stabil via `l.id` | pg (27 id unik) |
| pendamping hanya melihat peserta binaannya | `total` terhitung dengan scope yang sama (binding identik) | review kode: `bindings` dipakai untuk COUNT dan list |
| kabkota | tetap 403 di route (REVIEW) — tidak berubah | `kpi.test.js` matriks peran existing |
| ganti tab di halaman 2 | halaman 1 tab baru (R9) | e2e BUG-012 |
| item terakhir halaman 2 disetujui | halaman mundur ke 1 | review kode Langkah 6.5 |
| klik ganda Setujui | satu request (`deciding` diklaim sebelum `await`, R6) | review kode + e2e konfirmasi |
| review gagal 500 dalam mode konfirmasi | modal & konfirmasi tetap, pesan inline (R4) | e2e gagal |
| buka laporan lain setelah konfirmasi | `open()` mereset konfirmasi | review kode; e2e tutup-buka |
| pitching: 3/4/terputus/terbaru ditolak/menunggu ujung/menunggu tengah/gap | lihat test | unit Langkah 10.1 |
| rekomendasi lama tak lagi memenuhi | tetap tersimpan, banner, dapat dicabut; mencentang lagi → 409 | e2e BUG-014 + pg pitching existing |
| pg existing "pitching menolak 409 …" (minggu 4 masih menunggu) | tetap 409 (menunggu ujung diabaikan → streak 3) lalu 200 setelah disetujui | `pnpm test:pg` |

## 7. Validasi

```bash
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk
grep -rn "longestTargetStreak" apps/web/app apps/web/tests services/directus/extensions/program/src services/directus/extensions/program/test   # harus kosong
cd services/directus/extensions/program && pnpm test                                    # semua lulus (kpi.test.js termasuk test baru)
cd services/directus/extensions/program && DISKUK_TEST_PG_URL=<url-db-test> pnpm test:pg   # semua lulus; tanpa URL → semua skip (catat sebagai unproven)
cd services/directus && pnpm test                                                        # route-manifest tetap lulus (tidak ada route baru)
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit                             # 0 warning, 0 error
cd apps/web && pnpm exec playwright test tests/e2e/kpi.spec.ts tests/e2e/roles.spec.ts   # semua lulus
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-6.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 6   # outside: []
```

Baseline yang sudah diverifikasi saat menyusun plan: `node --test test/kpi.test.js test/executive.test.js` → 16 pass, 0 fail.

## 8. Bukti runtime/browser

- Screenshot (stack lokal atau mock): `BUG-012-after-1.png` (pager "1–25 dari N"), `BUG-013-after-1.png` (banner peringatan), `BUG-013-after-2.png` (konfirmasi), `BUG-014-after-1.png` (checkbox nonaktif + penjelasan, label baru).
- API terautentikasi (stack lokal, sesi pendamping): `curl -s -b <cookie> 'http://localhost:<port>/panel/v1/program/kpi/laporan?status=disetujui&page=2' | jq '.data.meta'` → `{ "page": 2, "limit": 25, "total": <n> }`; `page=0` → 400 `INVALID_PAGE`.
- Tidak terbukti bila stack/DB test tidak tersedia: paging pada data nyata 5,4 jt (tidak relevan — tabel `kpi_laporan` kecil), urutan stabil di Postgres (pg test). Catat di `execution_log.md`.

## 9. Rollback dan handoff

- Rollback: `git revert <commit phase 6>` — tanpa migration, tanpa data. Bentuk respons `/kpi/laporan` kembali ke array; semua consumer ikut kembali dalam commit yang sama.
- Handoff ke phase 7: konsep "minggu berjalan" (`currentWeek`) tidak diubah di phase ini; phase 7 hanya membaca `kpi/rules.js::jakartaDate`.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar §2 (termasuk `test/helpers.js`, `test-support/fixtures.mjs`, `kpi/index.js`, komponen UI bersama). Bila consumer lain dari `/kpi/laporan` atau `longestTargetStreak` ditemukan di luar manifest, berhenti — itu kontradiksi dengan inventaris plan.
