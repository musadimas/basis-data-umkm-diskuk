# Phase 7 — Monitoring Eksekutif: penjelasan kepatuhan & laporan minggu berjalan

**Bug:** BUG-015 · **Commit:** `fix(program): BUG-015 jelaskan cakupan kepatuhan dan laporan minggu berjalan`

## 1. Tujuan, dependensi, hasil yang dapat diamati

- **Tujuan:** angka kartu "Kepatuhan laporan terverifikasi" dapat direkonsiliasi dengan tab Disetujui Panel Pendampingan tanpa mengubah rumus (keputusan user: rumus minggu selesai dipertahankan).
- **Akar masalah (terverifikasi):** `executive/rules.js::completedWeeks` = `floor((hari ini WIB − tanggal_mulai) / 7)` → minggu yang sedang berjalan tidak dihitung, sedangkan `kpi/service.js::listLaporan` menampilkan semua laporan disetujui termasuk minggu berjalan (`currentWeek` = `floor + 1`). Data QC: 12 peserta × 6 minggu selesai = 72; 67 laporan minggu 1–6 disetujui (screenshot BUG-012 menunjukkan 67 baris minggu 6…1); 3 laporan minggu 7 yang kemudian disetujui menaikkan tab menjadi 70 tetapi tidak masuk kepatuhan.
- **Dependensi:** phase 6 ter-commit (urutan main_plan §6). Tidak ada ketergantungan kode.
- **Hasil yang terlihat:** kartu kepatuhan di `/dashboard/akselerasi` menampilkan "67 dari 72 laporan · Target >95%", lalu "Dihitung dari minggu program yang sudah selesai.", dan — bila ada — "3 laporan disetujui pada minggu berjalan belum dihitung."

## 2. Manifest file tertutup

| Aksi | Path |
|---|---|
| modify | `services/directus/extensions/program/src/endpoints/executive/rules.js` |
| modify | `services/directus/extensions/program/test/executive.test.js` |
| modify | `apps/web/app/types/executive.ts` |
| modify | `apps/web/app/pages/(private)/dashboard/akselerasi/index.vue` |
| modify | `apps/web/tests/fixtures/mock-directus-server.mjs` |
| create | `apps/web/tests/e2e/monitoring.spec.ts` |
| modify | `apps/web/tests/e2e/r02.real.spec.ts` |

Tidak ada migration. `executive/index.js` tidak diubah (`monitoring()` sudah mengembalikan `aggregateProgram(...)` apa adanya).

## 3. Simbol dan anchor

- `executive/rules.js`: `completedWeeks`, `aggregateProgram`, baris `if (week > elapsed || !report || report.realisasi_omzet == null) continue;`, objek `kepatuhan: { terverifikasi: approved, … }`.
- `executive/index.js::monitoring` (hanya baca): laporan sudah difilter `minggu_ke BETWEEN 1 AND 12 AND status = 'disetujui'`.
- `kpi/rules.js::jakartaDate` (hanya baca).
- `test/executive.test.js`: `NOW = new Date("2026-09-28T07:00:00Z")`, `START = "2026-08-31"`, `assert.deepEqual(result.kepatuhan, { terverifikasi: 3, diharapkan: 8, persen: 37.5, targetLebihDari: 95 })`.
- `types/executive.ts`: `kepatuhan: { terverifikasi: number; diharapkan: number; persen: number | null; targetLebihDari: number };`.
- `akselerasi/index.vue`: `{{ data.kepatuhan.terverifikasi }} dari {{ data.kepatuhan.diharapkan }} laporan · Target &gt;95%`.
- `mock-directus-server.mjs`: blok `if (method === "GET" && path === "/v1/analytics/infographic/map")` (sisipkan cabang baru sesudahnya).
- `r02.real.spec.ts`: `await expect(page.getByText(/Target >95%/)).toBeVisible();`.

## 4. Kontrak saat ini → akhir

| | Saat ini | Akhir |
|---|---|---|
| `kepatuhan` | `{ terverifikasi, diharapkan, persen, targetLebihDari }` | + `belumDihitung: number` = jumlah laporan disetujui dengan `completedWeeks < minggu_ke ≤ min(12, jumlah_minggu)` dan `realisasi_omzet` valid (bukan null, finite, ≥ 0), dijumlah semua peserta |
| Rumus `persen` | `round1(terverifikasi / diharapkan × 100)` | tidak berubah |
| UI | satu baris angka | + "Dihitung dari minggu program yang sudah selesai." + kalimat minggu berjalan bila `belumDihitung > 0` |

Kompatibilitas: field tambahan; consumer tunggal (`akselerasi/index.vue`). `recompute` (`/monitoring/recompute`) memakai `atRisk` saja — tidak terdampak.

### Semantik tanggal/waktu (wajib)

- **Penyimpanan:** `program_peserta.tanggal_mulai` bertipe `DATE` (tanpa zona); dibaca `p.tanggal_mulai::text` → `"YYYY-MM-DD"`.
- **Parsing:** `completedWeeks` mem-parse `tanggal_mulai` sebagai `T00:00:00Z` dan "hari ini" sebagai `jakartaDate(now)` (`Intl` `Asia/Jakarta`) + `T00:00:00Z` → selisih hari kalender WIB, bebas zona server.
- **Serialisasi:** respons hanya angka; tidak ada timestamp baru.
- **Tampilan:** angka `Intl.NumberFormat("id-ID")` existing; tidak ada tanggal ditampilkan.
- **Uji lintas zona:** `START = "2026-08-31"`; `now = 2026-10-04T16:59:59Z` (= 2026-10-04 23:59:59 WIB) → `completedWeeks = 4`; `now = 2026-10-04T17:00:00Z` (= 2026-10-05 00:00 WIB) → `5`. Laporan disetujui minggu 5 berpindah dari `belumDihitung` ke `terverifikasi` tepat di batas itu.

## 5. Edit berurutan

### Langkah 1 — `executive/rules.js::aggregateProgram`
1. Di samping `let approved = 0;` tambahkan `let belumDihitung = 0;`.
2. Tepat **sebelum** baris `if (week > elapsed || !report || report.realisasi_omzet == null) continue;` sisipkan:
   ```js
   if (week > elapsed) {
     // Minggu berjalan/mendatang: belum masuk kepatuhan, tetapi ditampilkan agar angka dapat direkonsiliasi (BUG-015).
     const amount = report?.realisasi_omzet == null ? NaN : Number(report.realisasi_omzet);
     if (Number.isFinite(amount) && amount >= 0) belumDihitung++;
     continue;
   }
   ```
   Baris `if (week > elapsed || …) continue;` lama dibiarkan apa adanya.
3. Objek kembalian: `kepatuhan: { terverifikasi: approved, diharapkan: expected, persen: …, targetLebihDari: 95, belumDihitung },`.

### Langkah 2 — `types/executive.ts`
`kepatuhan: { terverifikasi: number; diharapkan: number; persen: number | null; targetLebihDari: number; belumDihitung: number };`

### Langkah 3 — `akselerasi/index.vue`
Di `UiCardContent` kartu kepatuhan, setelah paragraf "… laporan · Target &gt;95%", tambahkan:
```vue
<p class="mt-1 text-xs text-muted-foreground" data-testid="kepatuhan-cakupan">Dihitung dari minggu program yang sudah selesai.</p>
<p v-if="data.kepatuhan.belumDihitung > 0" class="text-xs text-muted-foreground" data-testid="kepatuhan-minggu-berjalan">
  {{ data.kepatuhan.belumDihitung }} laporan disetujui pada minggu berjalan belum dihitung.
</p>
```
Jangan mengubah baris lain (file juga memuat perubahan P6 yang sudah ter-commit).

### Langkah 4 — `test/executive.test.js`
1. Test pertama: assertion `deepEqual(result.kepatuhan, …)` menjadi `{ terverifikasi: 3, diharapkan: 8, persen: 37.5, targetLebihDari: 95, belumDihitung: 0 }`.
2. Tambahkan:
   ```js
   test("laporan disetujui minggu berjalan tidak masuk kepatuhan tetapi dihitung terpisah (BUG-015)", () => {
     const weeks = (list) => list.map((w) => report(w, 1_000_000));
     const result = aggregateProgram([participant({ laporan: weeks([1, 2, 3, 4, 5]) })], NOW);
     assert.equal(completedWeeks(START, 12, NOW), 4);
     assert.deepEqual(result.kepatuhan, { terverifikasi: 4, diharapkan: 4, persen: 100, targetLebihDari: 95, belumDihitung: 1 });
     const pendek = aggregateProgram([participant({ jumlah_minggu: 4, laporan: weeks([1, 2, 3, 4, 5]) })], NOW);
     assert.equal(pendek.kepatuhan.belumDihitung, 0, "minggu di luar jumlah_minggu tidak dihitung");
     const kosong = aggregateProgram([participant({ laporan: [report(5, null)] })], NOW);
     assert.equal(kosong.kepatuhan.belumDihitung, 0, "realisasi tidak valid tidak dihitung");
   });

   test("batas minggu selesai mengikuti tanggal WIB, bukan UTC", () => {
     const laporan = [1, 2, 3, 4, 5].map((w) => report(w, 1_000_000));
     const sebelum = aggregateProgram([participant({ laporan })], new Date("2026-10-04T16:59:59Z"));
     const sesudah = aggregateProgram([participant({ laporan })], new Date("2026-10-04T17:00:00Z"));
     assert.equal(completedWeeks(START, 12, new Date("2026-10-04T16:59:59Z")), 4);
     assert.equal(completedWeeks(START, 12, new Date("2026-10-04T17:00:00Z")), 5);
     assert.deepEqual([sebelum.kepatuhan.terverifikasi, sebelum.kepatuhan.belumDihitung], [4, 1]);
     assert.deepEqual([sesudah.kepatuhan.terverifikasi, sesudah.kepatuhan.belumDihitung], [5, 0]);
   });
   ```

### Langkah 5 — `mock-directus-server.mjs`
Setelah cabang `"/v1/analytics/infographic/map"`, sisipkan:
```js
if (method === "GET" && path === "/v1/program/executive/monitoring") {
  response.end(JSON.stringify({ data: {
    kepatuhan: { terverifikasi: 67, diharapkan: 72, persen: 93.1, targetLebihDari: 95, belumDihitung: 3 },
    kenaikanOmzet: { persen: 19.5, pesertaDihitung: 12, sumber: "SIDT tahunan / 52 vs rata-rata laporan disetujui" },
    tren: Array.from({ length: 12 }, (_, i) => ({ minggu: i + 1, target: 100_000_000, realisasi: i < 6 ? 100_000_000 : null })),
    atRisk: [],
  } }));
  return;
}
```

### Langkah 6 — `tests/e2e/monitoring.spec.ts` (baru)
```ts
import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("BUG-015: kartu kepatuhan menjelaskan cakupan dan laporan minggu berjalan", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard/akselerasi");
  await expect(page.getByRole("heading", { name: "Monitoring Program Akselerasi" })).toBeVisible();
  await expect(page.getByText("67 dari 72 laporan · Target >95%")).toBeVisible();
  await expect(page.getByTestId("kepatuhan-cakupan")).toHaveText("Dihitung dari minggu program yang sudah selesai.");
  await expect(page.getByTestId("kepatuhan-minggu-berjalan")).toHaveText("3 laporan disetujui pada minggu berjalan belum dihitung.");
});
```
Halaman di-SSR, sehingga data berasal dari `mock-directus-server.mjs` (Langkah 5), bukan `page.route`.

### Langkah 7 — `r02.real.spec.ts`
Setelah `await expect(page.getByText(/Target >95%/)).toBeVisible();` tambahkan `await expect(page.getByTestId("kepatuhan-cakupan")).toBeVisible();`.

## 6. Kasus

| Kasus | Harapan | Bukti |
|---|---|---|
| minggu 1–4 selesai + minggu 5 disetujui | 4/4, belumDihitung 1 | unit Langkah 4.2 |
| `jumlah_minggu` 4, laporan minggu 5 | belumDihitung 0 | unit |
| realisasi null minggu berjalan | belumDihitung 0 | unit |
| batas tengah malam WIB vs UTC | 4→5 tepat 17:00Z | unit lintas zona |
| belumDihitung 0 | kalimat minggu berjalan tidak dirender | review kode `v-if` |
| kabkota | scope existing `predikat` tidak berubah; `belumDihitung` hanya dari peserta ter-scope | `executive.test.js` "monitoring refuses UMKM and binds the officer's kota scope" tetap lulus |
| peserta `keluar` | tidak ikut (filter SQL existing) | — |
| MON-06 rekonsiliasi | setujui 3 laporan minggu 6 → 70/72 (rumus lama, tetap) | catatan QC uji ulang |

Tidak ada mutasi klien baru; kelas async/reentrancy/cache tidak berlaku (halaman hanya baca, `noStore`).

## 7. Validasi

```bash
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk
cd services/directus/extensions/program && node --test test/executive.test.js && pnpm test    # semua lulus
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit
cd apps/web && pnpm exec playwright test tests/e2e/monitoring.spec.ts                          # 1 lulus
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-7.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 7   # outside: []
```
Baseline terverifikasi saat menyusun plan: `node --test test/kpi.test.js test/executive.test.js` → 16 pass.

## 8. Bukti runtime/browser

- Screenshot `BUG-015-after-1.png` dari stack lokal dengan seed `scripts/seed-dummy-program.sql` (12 peserta, mulai hari ini − 45 hari): setujui satu laporan minggu 7 di Panel Pendampingan → kartu menampilkan "… 1 laporan disetujui pada minggu berjalan belum dihitung."
- `curl -s -b <cookie provinsi> http://localhost:<port>/panel/v1/program/executive/monitoring | jq '.data.kepatuhan'` → memuat `belumDihitung`.
- `r02.real.spec.ts` hanya jalan dengan stack R02 (env); bila tidak tersedia catat "unproven" di `execution_log.md`.

## 9. Rollback dan handoff

- Rollback: `git revert <commit phase 7>`; tanpa data/migration.
- Handoff ke phase 8: tidak ada state bersama. Phase 8 juga memodifikasi `executive/index.js` (route investor) — phase 7 tidak menyentuh file itu.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar §2 (termasuk `executive/index.js`, `kpi/rules.js`, `pendampingan/*.vue`). Mengubah rumus `persen`/`diharapkan` adalah keputusan produk yang sudah ditolak — jangan dilakukan.
