# Phase 5 — Talent Scouting: PDF Berita Acara on-demand

**Bug:** BUG-011
**Commit:** `fix(talent): BUG-011 Berita Acara dapat dibuka sebagai PDF`

## 1. Objective, dependensi, hasil teramati

**Objective.** Setiap Berita Acara di panel Kurasi Talent Scouting dapat diklik oleh Admin Provinsi dan menghasilkan unduhan PDF yang dibangkitkan server saat itu (tidak disimpan ke `talent_berita_acara.berkas`).

**Dependensi.** Phase 4 sudah di-commit (berbagi `kurasi.vue`, `talent/index.js`, `oas.yaml`, `test/talent.test.js`, `test/pg/talent.test.js`, `mock-program.mjs`, `talent.spec.ts`).

**Hasil teramati.** Provinsi: setiap nomor BA berupa tombol; klik → file `BA-TS-2026-0001.pdf` terunduh berisi nomor, tanggal (WIB), penyetuju, catatan, dan daftar usaha + Talent Index. Kabkota: daftar BA tetap teks tanpa tombol; API menjawab 403.

## 2. Manifest file (tertutup)

| Aksi | Path |
|---|---|
| create | `services/directus/extensions/program/src/endpoints/talent/berita-acara-pdf.js` |
| create | `services/directus/extensions/program/test/talent-ba-pdf.test.js` |
| modify | `services/directus/extensions/program/src/endpoints/talent/index.js` |
| modify | `services/directus/extensions/program/src/oas.yaml` |
| modify | `services/directus/extensions/program/test/talent.test.js` |
| modify | `services/directus/extensions/program/test/pg/talent.test.js` |
| modify | `apps/web/app/pages/(private)/dashboard/talent/kurasi.vue` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| modify | `apps/web/tests/e2e/talent.spec.ts` |

## 3. Simbol & anchor

| File | Anchor |
|---|---|
| `analytics-shared/dokumen.cjs` | `function renderDokumen({ judul = "Dokumen Resmi", subjudul = "", bagian = [], qr = null, meta = {} } = {})`, `module.exports = { INSTANSI, publicUrl, renderDokumen, teksPdf };` — model: `bagian: {judul, baris: string[]}[]`, teks dibungkus 95 karakter, WinAnsi; tanpa tabel |
| `passport/pdf.js` | pola `renderDokumen(…)` → `noStore(res); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", …); res.end(pdf);` dan `})().catch((error) => sendError(res, logger, error));` |
| `kpi/rules.js` | `export function jakartaDate(now = new Date())` |
| `talent/index.js` | `const KEPUTUSAN = { peran: ["provinsi"] };` (dibuat phase 4), `router.get("/berita-acara", …)` |
| `talent/service.js` | `export const listBeritaAcara` (tidak diubah) |
| `kurasi.vue` | `<UiCardTitle>Berita Acara</UiCardTitle>`, `<li v-for="item in beritaAcara"`, `const date = (value: string) =>` |
| `usaha/passport.vue` | `async function unduhDokumen(` (pola unduh blob: `endpoint<Response>` → `response.blob()` → `URL.createObjectURL` → `<a download>` → `setTimeout(() => URL.revokeObjectURL(url), 1000)`) |
| `mock-program.mjs` | blok `"/passport/pdf/summary"` (contoh respons PDF), `if (method === "GET" && path === "/talent/berita-acara")` |
| `test/pg/passport-pdf.test.js` | `const teks = (hasil) => hasil.res.body.toString("latin1");` |

## 4. Kontrak saat ini → akhir

| | Saat ini | Akhir |
|---|---|---|
| Route | tidak ada | `GET /v1/program/talent/berita-acara/:id/pdf`, `terjaga(KEPUTUSAN)` = provinsi |
| Respons sukses | — | `200`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<namaBerkasBa(nomor)>"`, `Cache-Control: private, no-store`, body PDF-1.4 |
| Gagal | — | id bukan UUID → 400 `INVALID_ID`; tidak ada → 404 `BERITA_ACARA_NOT_FOUND`; kabkota → 403; anonim → 401 |
| Nama berkas | — | `namaBerkasBa("BA-TS/2026/0001")` → `"BA-TS-2026-0001.pdf"`; `nomor.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "berita-acara"` + `.pdf` (`dummy_BA-TS/2026/0001` → `dummy_BA-TS-2026-0001.pdf`) |
| Waktu | — | `tanggal` (`DATE`) dibaca sebagai teks `to_char(b.tanggal, 'YYYY-MM-DD')` agar tidak melewati konversi `Date` node-pg ber-TZ server; diformat `new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(\`${tanggal}T00:00:00Z\`))` → `"30 September 2026"` di TZ server mana pun. `meta.generatedAt = jakartaDate()` (WIB). |
| `berkas` | selalu null | tetap null (non-goal) |

Isi dokumen (model `renderDokumen`):
- `judul: "Berita Acara Kurasi Talent Scouting"`, `subjudul: \`Nomor ${nomor}\``.
- `bagian[0] = { judul: "Keterangan", baris: [\`Nomor: ${nomor}\`, \`Tanggal: ${tanggalBa(tanggal)}\`, \`Disetujui oleh: ${penyetuju || "-"}\`, \`Jumlah usaha: ${items.length}\`, \`Catatan: ${catatan || "-"}\`] }`.
- `bagian[1] = { judul: "Daftar usaha yang masuk Talent Pool", baris: items.map((r, i) => \`${i + 1}. ${r.nama} - NIB ${r.nib || "-"} - ${r.kota_nama || "-"} - Talent Index ${formatSkor(r.skor_total)}\`) }`; bila kosong: `["Tidak ada pengajuan yang terhubung."]`.
- `bagian[2] = { judul: "Keterangan penilaian", baris: [ "Usaha di atas disetujui masuk Talent Pool berdasarkan kurasi Talent Scouting Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat.", …(items.some((r) => r.rubrik_versi === "placeholder-v0") ? ["Skor dihitung dengan rubrik sementara (placeholder-v0); rubrik resmi DISKUK belum tersedia."] : []) ] }`.
- `meta: { generatedAt: jakartaDate(), sumber: "Kurasi Talent Scouting" }`; `qr: null`.
- `formatSkor(v)`: `v === null ? "-" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(v))`.
- `penyetuju`: `NULLIF(BTRIM(CONCAT_WS(' ', du.first_name, du.last_name)), '')` (email tidak dicetak).

## 5. Edit berurutan

### 5.1 `talent/berita-acara-pdf.js` (baru)

```js
import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { uuidParam } from "../../lib/validate.js";
import { jakartaDate } from "../kpi/rules.js";
import dokumen from "../../../../../analytics-shared/dokumen.cjs";

const { renderDokumen } = dokumen;

export function namaBerkasBa(nomor) { … }        // aturan §4
export function tanggalBa(tanggal) { … }         // aturan §4; input "YYYY-MM-DD"
export function modelBeritaAcara(ba, items) { … } // mengembalikan objek model §4 (tanpa memanggil renderDokumen)

/** GET /berita-acara/:id/pdf — BUG-011: PDF Berita Acara dibangkitkan saat diminta, tidak disimpan. */
export const exportBeritaAcaraPdf =
  ({ database, logger }) =>
  (req, res) =>
    (async () => {
      const id = uuidParam(req.params?.id);
      const ba = rows(await database.raw(
        `SELECT b.id, b.nomor, to_char(b.tanggal, 'YYYY-MM-DD') AS tanggal, b.catatan,
                NULLIF(BTRIM(CONCAT_WS(' ', du.first_name, du.last_name)), '') AS penyetuju
           FROM talent_berita_acara b
           LEFT JOIN directus_users du ON du.id = b.disetujui_oleh
          WHERE b.id = ?`, [id]))[0];
      if (!ba) throw new ProgramError(404, "BERITA_ACARA_NOT_FOUND", "The Berita Acara was not found.");
      const items = rows(await database.raw(
        `SELECT u.nama, u.nib, t.kota_nama, p.skor_total, p.rubrik_versi
           FROM talent_pengajuan p
           JOIN usaha u ON u.id = p.usaha
           LEFT JOIN usaha_tabular t ON t.id = p.usaha
          WHERE p.berita_acara = ?
          ORDER BY u.nama`, [id]));
      const pdf = renderDokumen(modelBeritaAcara(ba, items));
      noStore(res);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${namaBerkasBa(ba.nomor)}"`);
      res.end(pdf);
    })().catch((error) => sendError(res, logger, error));
```

Dua query berurutan tanpa loop (biaya: 2 query per unduhan, ≤200 baris).

### 5.2 `talent/index.js`

Import `{ exportBeritaAcaraPdf } from "./berita-acara-pdf.js";`; komentar header tambah `//   GET   /v1/program/talent/berita-acara/:id/pdf     Berita Acara PDF (provinsi, generated on demand)`; tambah `router.get("/berita-acara/:id/pdf", terjaga(KEPUTUSAN, exportBeritaAcaraPdf)(context));` setelah `router.get("/berita-acara", …)`.

### 5.3 `oas.yaml`

Tambah setelah `/talent/berita-acara:` blok:
`/talent/berita-acara/{id}/pdf: { get: { tags: [Talent Scouting], parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: Berita Acara PDF (provinsi only, generated on demand), content: { application/pdf: {} } }, "404": { description: BERITA_ACARA_NOT_FOUND } } } }`

### 5.4 `test/talent.test.js`

`routes.length` 9 → 10 (dua tempat); `ekspektasi` tambah `["GET", "/berita-acara/:id/pdf", ["provinsi"]]`.

### 5.5 `test/talent-ba-pdf.test.js` (baru, unit tanpa DB)

- `namaBerkasBa`: `"BA-TS/2026/0001"` → `"BA-TS-2026-0001.pdf"`; `"dummy_BA-TS/2026/0002"` → `"dummy_BA-TS-2026-0002.pdf"`; `'a"b\r\nc'` → `"a-b-c.pdf"`; `"///"` → `"berita-acara.pdf"`.
- `tanggalBa("2026-09-30")` → `"30 September 2026"`.
- `modelBeritaAcara` dengan 2 item (satu `skor_total: null`) → `bagian[1].baris[1]` berakhir `"Talent Index -"`; dengan rubrik `placeholder-v0` → baris rubrik sementara ada; items kosong → `"Tidak ada pengajuan yang terhubung."`.
- `renderDokumen(modelBeritaAcara(...)).toString("latin1")` diawali `"%PDF-1.4"` dan memuat `"BA-TS/2026/0001"`.
- Jalankan juga dengan TZ berbeda (lihat §7) — hasil `tanggalBa` identik.

### 5.6 `test/pg/talent.test.js`

Baru `"PDF Berita Acara: provinsi 200 berisi nomor dan usaha; kabkota 403; id asing 404; id rusak 400"`: buat dua pengajuan `dinilai` berskor, terbitkan BA via `POST /berita-acara` (provinsi), lalu `GET /berita-acara/<id>/pdf`:
- provinsi → 200, header `Content-Type` `application/pdf`, `Content-Disposition` memuat `BA-TS-`, body latin1 diawali `%PDF-1.4`, memuat nomor, `"Usaha Subang"`, `"Usaha Bandung"`.
- kabkota → `nextError?.statusCode ?? res.statusCode` = 403.
- `uuid()` asing → 404 `BERITA_ACARA_NOT_FOUND`; `"x"` → 400.

### 5.7 `kurasi.vue`

Script:
```ts
const mengunduhBa = ref<string | null>(null);
const galatBa = ref<{ id: string; text: string } | null>(null);
const namaBerkasBa = (nomor: string) => `${nomor.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "berita-acara"}.pdf`;
async function unduhBeritaAcara(item: BeritaAcara) {
  if (mengunduhBa.value) return;
  mengunduhBa.value = item.id;
  galatBa.value = null;
  try {
    const response = await directus.request(endpoint<Response>(`/v1/program/talent/berita-acara/${item.id}/pdf`));
    const url = URL.createObjectURL(await response.blob());
    const tautan = document.createElement("a");
    tautan.href = url;
    tautan.download = namaBerkasBa(item.nomor);
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    galatBa.value = { id: item.id, text: `Berita Acara ${item.nomor} tidak dapat diunduh. Coba lagi.` };
  } finally {
    mengunduhBa.value = null;
  }
}
```
Template `<li v-for="item in beritaAcara" …>`: ganti `<span class="font-mono font-semibold">{{ item.nomor }}</span>` dengan
```vue
<UiButton v-if="isProvinsi" type="button" variant="link" class="h-auto gap-1 p-0 font-mono font-semibold"
  :disabled="mengunduhBa !== null" :aria-label="`Unduh PDF Berita Acara ${item.nomor}`" @click="unduhBeritaAcara(item)">
  <FileDown class="size-4" /> {{ mengunduhBa === item.id ? "Menyiapkan PDF…" : item.nomor }}
</UiButton>
<span v-else class="font-mono font-semibold">{{ item.nomor }}</span>
```
dan setelah span tanggal tambahkan `<p v-if="galatBa?.id === item.id" role="alert" class="w-full text-xs text-destructive">{{ galatBa.text }}</p>`. Import `FileDown` dari `@lucide/vue` (gabung dengan import `FileCheck2`). Jangan mengubah bagian lain halaman (R20).

### 5.8 `mock-program.mjs`

Sebelum `if (method === "GET" && path === "/talent/berita-acara")`, tambahkan handler regex `^\/talent\/berita-acara\/([^/]+)\/pdf$` (GET): bila `state.failNext?.[path]` → hapus flag, 500; bila BA tidak ada di `state.beritaAcara` → 404 `BERITA_ACARA_NOT_FOUND`; selain itu `route.fulfill({ status: 200, headers: { "content-type": "application/pdf", "content-disposition": \`attachment; filename="${ba.nomor.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf"\` }, body: "%PDF-1.4\n%%EOF" })`.

### 5.9 `talent.spec.ts`

- Baru `"provinsi mengunduh PDF Berita Acara; gagal menampilkan pesan per item"`: `state.beritaAcara.push({ id: "ba-1", nomor: "BA-TS/2026/0001", tanggal: "2026-09-30", catatan: null, berkas: null, dateCreated: "2026-09-30T03:00:00Z", jumlahPengajuan: 1 })`; `const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Unduh PDF Berita Acara BA-TS/2026/0001" }).click(); expect((await download).suggestedFilename()).toBe("BA-TS-2026-0001.pdf");`. Lalu `state.failNext["/talent/berita-acara/ba-1/pdf"] = true`, klik lagi → `getByRole("alert")` memuat "tidak dapat diunduh"; tombol aktif kembali.
- Baru `"kabkota melihat daftar BA tanpa tombol unduh"`: role kabkota → teks `"BA-TS/2026/0001"` tampil, `getByRole("button", { name: /Unduh PDF Berita Acara/ })` `toHaveCount(0)`.
- R20: seluruh test phase 4 di file ini tetap dijalankan dan hijau.

## 6. Kasus campuran/negatif/batas/lintas peran/lifecycle/gagal

| Kasus | Bukti |
|---|---|
| BA dummy `dummy_BA-TS/…` | nama berkas `dummy_BA-TS-…pdf` (unit) |
| Penyetuju terhapus (`disetujui_oleh` null) | `Disetujui oleh: -` (unit `modelBeritaAcara` dengan `penyetuju: null`) |
| Nama usaha non-ASCII (é, “”) | `teksPdf` mengganti/escape (kontrak `dokumen.contract.test.mjs` existing) |
| 200 usaha | `paginasi` membuat halaman sambungan (existing) |
| Kabkota via URL langsung | 403 (pg) |
| Unduh gagal | pesan per item, `mengunduhBa` kembali null di `finally`; object URL dicabut hanya bila dibuat (R8) |
| Klik ganda | `if (mengunduhBa.value) return` sebelum await + tombol `:disabled` |

## 7. Perintah validasi dan hasil

```bash
cd services/directus/extensions/program && pnpm test                         # hijau; talent.test.js 10 route
cd services/directus/extensions/program && TZ=Asia/Tokyo node --test test/talent-ba-pdf.test.js   # hijau (lintas TZ)
cd services/directus/extensions/program && TZ=America/Los_Angeles node --test test/talent-ba-pdf.test.js   # hijau
cd services/directus && pnpm test                                            # route-manifest & dokumen kontrak hijau
DISKUK_TEST_PG_URL="postgres://<DB_USER>:<DB_PASSWORD>@127.0.0.1:15432/postgres" \
  node --test services/directus/extensions/program/test/pg/talent.test.js     # hijau
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit
cd apps/web && pnpm exec playwright test tests/e2e/talent.spec.ts             # hijau (termasuk test phase 4)
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-5.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 5   # outside: []
```

## 8. Bukti runtime/browser

- Stack lokal, provinsi: klik BA hasil phase 4 → buka PDF di viewer → screenshot `evidence/BUG-011-after-1.png` (daftar BA bertombol) dan `BUG-011-after-2.png` (PDF terbuka). Kabkota: `BUG-011-after-3.png`.
- `curl -b <cookie provinsi> -o /tmp/ba.pdf /panel/v1/program/talent/berita-acara/<id>/pdf && file /tmp/ba.pdf` → `PDF document, version 1.4`; dengan cookie kabkota → HTTP 403.
- Bila stack tidak tersedia: catat "runtime PDF unproven" di `execution_log.md`; unit + pg test tetap wajib hijau sebelum commit.

## 9. Rollback & handoff

Rollback: `git revert <commit phase 5>` (tanpa migration). Handoff: phase 6 tidak menyentuh file talent; `mock-program.mjs` kini memiliki `failNext` yang dapat dipakai phase berikutnya.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar §2 (termasuk `talent/service.js` dan `dokumen.cjs`, yang tidak boleh diubah di phase ini).
