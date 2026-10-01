# Phase 1 — Infografis: judul level wilayah (BUG-001) & penyebut lima aspek (BUG-002)

## 1. Objective, dependensi, hasil teramati

- **Objective:** (a) panel wilayah teratas di Infografis mengikuti `regionLevel` dari API (judul, tooltip, aria-label) dan klik baris membuka Analitik dengan field level yang benar; (b) kartu "Lima aspek perkembangan usaha" menghitung persentase atas seluruh UMKM dalam filter.
- **Dependensi:** gerbang main_plan §9 (P6 sudah di-commit, worktree bersih).
- **Hasil teramati:**
  - Tanpa filter: judul "5 Kabupaten/Kota Teratas"; filter kab/kota: "5 Kecamatan Teratas"; filter kecamatan/kelurahan: "5 Desa/Kelurahan Teratas".
  - Klik baris pada level kecamatan → URL `/dashboard/analitik?…filter=kecamatan_id~eq~<id>` (bukan `kota_id`).
  - Lima aspek: NIB tidak lagi 100%; tiap indikator menampilkan "x ya · y tidak · z belum ada data dari N UMKM".

## 2. Manifest file (tertutup)

| Path | Aksi |
|---|---|
| `apps/web/app/types/infografis.ts` | modify |
| `apps/web/app/constants/DASHBOARD.ts` | modify |
| `apps/web/app/components/dashboard/card/Overview.vue` | modify |
| `apps/web/app/pages/(private)/dashboard/index.vue` | modify |
| `apps/web/app/types/operasional.ts` | modify |
| `apps/web/app/components/dashboard/card/PermenAspek.vue` | modify |
| `services/directus/extensions/directus-extension-operasional/src/permen-aspek.js` | modify |
| `services/directus/extensions/directus-extension-operasional/test/permen-aspek.test.cjs` | modify |
| `apps/web/tests/e2e/infografis.spec.ts` | modify |
| `apps/web/tests/e2e/sso-demo.spec.ts` | modify |

`services/directus/extensions/directus-extension-operasional/dist/**` diabaikan git (`~/.gitignore_global: dist/`); `pnpm run build` di langkah validasi hanya untuk bukti runtime lokal dan tidak muncul di `git status`.

## 3. Simbol & anchor yang harus diperiksa sebelum edit

- `apps/web/app/types/infografis.ts`: baris `regionLevel?: "kota" | "kecamatan" | "kelurahan";` (≈ baris 60).
- `apps/web/app/constants/DASHBOARD.ts`: blok `topRegion: { title: "5 Kabupaten/Kota Teratas", … }` di dalam `DASHBOARD_SECTIONS`.
- `apps/web/app/components/dashboard/card/Overview.vue`: `interface Props`, `defineEmits` dengan `"drill:sektor" | "drill:kota" | "drill:kbli"`, `topRegions`, komentar `<!-- Panel top kabupaten/kota -->`, tiga pemakaian `DASHBOARD_SECTIONS.topRegion.*`, `@click="emit('drill:kota', region.id)"`.
- `apps/web/app/pages/(private)/dashboard/index.vue`: `function openAnalytics(fieldId: string, value: string)`, `<DashboardCardOverview` … `@drill:kota="openAnalytics('kota_id', $event)"`, `function openRegion` (baris `if (level === "kelurahan") return openAnalytics("kelurahan_id", region.id);`).
- `services/directus/extensions/directus-extension-operasional/src/permen-aspek.js`: `definisiVersi: "indikator-operasional-v2"`, objek indikator `persentase: diketahui ? Math.round((ya / diketahui) * 1000) / 10 : null`.
- `apps/web/app/components/dashboard/card/PermenAspek.vue`: dua `<p>` sub-teks (`ya dari … data diketahui` dan `tidak · … belum ada data`) dan footnote `Persentase = jumlah “ya” ÷ data diketahui.`
- Pemeriksaan cepat:
  ```bash
  rg -n 'DASHBOARD_SECTIONS\.topRegion' apps/web/app            # hanya Overview.vue (4 hit: judul, v-if tooltip, aria-label, isi tooltip)
  rg -n "drill:kota" apps/web/app                                # Overview.vue + index.vue
  rg -n "persentase: diketahui" services/directus/extensions/directus-extension-operasional/src/permen-aspek.js
  ```

## 4. Kontrak saat ini → kontrak akhir

| Aspek | Saat ini | Akhir |
|---|---|---|
| `Overview.vue` props | tanpa `regionLevel` | `regionLevel?: InfografisRegionLevel` (default `"kota"`) |
| `Overview.vue` emit wilayah | `drill:kota (id)` | `drill:wilayah (id)`; induk memetakan level → field |
| Judul panel | konstanta tetap | `TOP_REGION_SECTIONS[regionLevel]` |
| Drill infografis | selalu `kota_id` | `REGION_ANALYTICS_FIELD[regionLevel]` (`kota_id`/`kecamatan_id`/`kelurahan_id`) |
| `GET /operasional/aspek-perkembangan` item | `persentase = ya ÷ (ya+tidak)` | `persentase = total ? round1(ya ÷ total × 100) : null`; field baru `total` per item; `definisiVersi = "indikator-operasional-v3"` |
| Field lama `ya, tidak, diketahui, belumAdaData` | ada | tetap ada, nilai sama |

## 5. Edit berurutan

1. **`types/infografis.ts`** — tambahkan dan pakai tipe level:
   ```ts
   /** Level agregasi wilayah pada respons infografis. */
   export type InfografisRegionLevel = "kota" | "kecamatan" | "kelurahan";
   ```
   Ganti `regionLevel?: "kota" | "kecamatan" | "kelurahan";` menjadi `regionLevel?: InfografisRegionLevel;`.

2. **`constants/DASHBOARD.ts`** — hapus entri `topRegion` dari `DASHBOARD_SECTIONS` dan tambahkan dua ekspor baru di file yang sama (impor tipe `InfografisRegionLevel` dari `~/types/infografis`):
   ```ts
   /** Panel wilayah teratas di Infografis: judul mengikuti level agregasi dari API (BUG-001). */
   export const TOP_REGION_SECTIONS = {
     kota: {
       title: "5 Kabupaten/Kota Teratas",
       description: "Lima kabupaten/kota dengan jumlah UMKM terbanyak. Klik untuk membuka analitik wilayah.",
       tooltip: "Peringkat kabupaten/kota berdasarkan jumlah UMKM pada filter aktif",
     },
     kecamatan: {
       title: "5 Kecamatan Teratas",
       description: "Lima kecamatan dengan jumlah UMKM terbanyak pada kabupaten/kota terpilih. Klik untuk membuka analitik wilayah.",
       tooltip: "Peringkat kecamatan berdasarkan jumlah UMKM pada filter aktif",
     },
     kelurahan: {
       title: "5 Desa/Kelurahan Teratas",
       description: "Lima desa/kelurahan dengan jumlah UMKM terbanyak pada kecamatan terpilih. Klik untuk membuka analitik wilayah.",
       tooltip: "Peringkat desa/kelurahan berdasarkan jumlah UMKM pada filter aktif",
     },
   } satisfies Record<InfografisRegionLevel, { title: string; description: string; tooltip: string }>;

   /** Field Analitik untuk membuka satu wilayah sesuai levelnya (dipakai Infografis; Phase 3 menambah Spasial). */
   export const REGION_ANALYTICS_FIELD = {
     kota: "kota_id",
     kecamatan: "kecamatan_id",
     kelurahan: "kelurahan_id",
   } as const satisfies Record<InfografisRegionLevel, string>;
   ```
   Pakai `satisfies`, bukan anotasi `Record<…>` pada binding: aturan oxlint `anti-slop/no-known-value-widening` menolak anotasi dictionary eksplisit (sudah diuji dengan file probe).
   `constants/index.ts` sudah `export * from "./DASHBOARD";` sehingga barrel tidak diubah; konsumen tetap mengimpor dari `~/constants/DASHBOARD` seperti `Overview.vue` saat ini.

3. **`Overview.vue`**
   - Impor: `import { DASHBOARD_SECTIONS, TOP_REGION_SECTIONS } from "~/constants/DASHBOARD";` dan tambahkan `InfografisRegionLevel` ke impor tipe dari `~/types/infografis`.
   - `interface Props`: setelah `regions?`, tambah
     ```ts
     /** Level agregasi `regions` dari API; menentukan judul panel wilayah teratas. */
     regionLevel?: InfografisRegionLevel;
     ```
     dan ubah komentar `regions?` menjadi `/** Wilayah terurut desc dari API, untuk panel wilayah teratas. */`. Default di `withDefaults`: `regionLevel: "kota"`.
   - `defineEmits`: `(e: "drill:sektor" | "drill:wilayah" | "drill:kbli", value: string): void;`
   - Tambah `const topRegionSection = computed(() => TOP_REGION_SECTIONS[props.regionLevel]);` di dekat `topRegions`; ubah docstring `topRegions` menjadi "Lima wilayah (level mengikuti `regionLevel`) dengan jumlah UMKM terbanyak …".
   - Template: komentar menjadi `<!-- Panel wilayah teratas (level mengikuti regionLevel) -->`; ganti keempat `DASHBOARD_SECTIONS.topRegion.title|tooltip` (judul, `v-if` tooltip, `aria-label`, isi tooltip) menjadi `topRegionSection.title|tooltip`; `@click="emit('drill:wilayah', region.id)"`.

4. **`pages/(private)/dashboard/index.vue`**
   - Impor `REGION_ANALYTICS_FIELD` dari `~/constants/DASHBOARD` (gabungkan dengan impor `DASHBOARD_SECTIONS` yang sudah ada).
   - Tambah tepat setelah `openAnalytics`:
     ```ts
     /** Baris panel wilayah teratas: field Analitik mengikuti level agregasi Infografis (BUG-001). */
     function openTopRegion(id: string) {
       openAnalytics(REGION_ANALYTICS_FIELD[infografis.value?.regionLevel ?? "kota"], id);
     }
     ```
     (`infografis` adalah `computed` yang didefinisikan setelah fungsi; aman karena hanya dibaca saat klik.)
   - `<DashboardCardOverview>`: tambah `:region-level="infografis?.regionLevel ?? 'kota'"`; ganti `@drill:kota="openAnalytics('kota_id', $event)"` dengan `@drill:wilayah="openTopRegion"`.
   - `openRegion` (peta) **tidak diubah** di phase ini.

5. **`permen-aspek.js`** — pada `indikator: aspek.indicators.map(...)` ganti objek kembalian menjadi:
   ```js
   return {
     id, label, sumber, ya, tidak, diketahui,
     belumAdaData: Math.max(0, total - diketahui),
     total,
     // BUG-002: penyebut = seluruh UMKM dalam filter, sehingga indikator yang hanya bisa "ya"
     // (NIB, sertifikat dampak) tidak lagi tampil 100%.
     persentase: total ? Math.round((ya / total) * 1000) / 10 : null,
   };
   ```
   dan ubah `definisiVersi: "indikator-operasional-v2"` → `"indikator-operasional-v3"`. SQL tidak berubah (kolom `total` sudah dihitung `COUNT(*)`).

6. **`types/operasional.ts`** — di `AspekPerkembangan.aspek[].indikator[]` tambah `total: number;` (setelah `belumAdaData`).

7. **`PermenAspek.vue`** — ganti dua `<p>` sub-teks per indikator dengan satu:
   ```vue
   <p class="mt-1 text-xs text-muted-foreground">{{ item.ya.toLocaleString('id-ID') }} ya · {{ item.tidak.toLocaleString('id-ID') }} tidak · {{ item.belumAdaData.toLocaleString('id-ID') }} belum ada data dari {{ item.total.toLocaleString('id-ID') }} UMKM</p>
   ```
   Footnote menjadi: `Persentase = jumlah “ya” ÷ seluruh UMKM dalam filter wilayah. Data kosong dihitung sebagai “belum ada data”, bukan “tidak”. Field ya/tidak belum membuktikan dokumen verifikatif yang disyaratkan untuk penilaian resmi. {{ data.sumber }}.`

8. **`permen-aspek.test.cjs`** — perbarui ekspektasi:
   - test pertama: `npwp_usaha` → `{ …, ya: 20, tidak: 10, diketahui: 30, belumAdaData: 70, total: 100, persentase: 20 }`; tambah `assert.equal(result.data.aspek[0].indikator[0].persentase, 80)` (NIB 80 dari 100) dan `assert.equal(result.data.definisiVersi, "indikator-operasional-v3")`.
   - test R03: `pelatihan` → `{ …, ya: 4, tidak: 0, diketahui: 4, belumAdaData: 6, total: 10, persentase: 40 }`.
   - test baru: `"total nol menghasilkan persentase null"` → mock `{ total: 0 }`, setiap indikator `persentase === null`, `total === 0`.
   - Ganti judul test pertama menjadi `"lima aspek menghitung ya atas seluruh UMKM dalam filter dan memisahkan data kosong"`.

9. **`sso-demo.spec.ts`** (test `N2-01`) — mock: tambah `total: 100` pada kedua indikator; `nib.persentase: 80`, `akses_kur.persentase: 20`; `definisiVersi: "indikator-operasional-v3"`. Assersi: ganti `"66.7%"` → `"20%"`; tambah `await expect(page.getByText("dari 100 UMKM").first()).toBeVisible();`. Ganti judul test → `"N2-01: lima aspek menampilkan numerator, total UMKM, dan data kosong"`.

10. **`infografis.spec.ts`** — tambah impor `import { infographicResponse } from "../fixtures/analytics-data.mjs";` dan test berikut. Route didaftarkan **setelah** `installMockDirectus` sehingga diprioritaskan Playwright; body dibangun dari fixture (bukan `route.fetch()`, karena mock adalah route handler, bukan server).
    ```ts
    test("BUG-001: panel wilayah teratas mengikuti level dan membuka analitik level yang benar", async ({ page }) => {
      await installMockDirectus(page, { authenticated: true });
      await page.route((url) => url.pathname === "/panel/v1/analytics/infographic/", async (route) => {
        const body = infographicResponse();
        body.data.regionLevel = "kecamatan";
        body.data.regions = [
          { id: "11", name: "Cibinong", value: 2 },
          { id: "12", name: "Bojonggede", value: 1 },
        ];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await loginMock(page, "/dashboard");
      await expect(page.getByRole("heading", { name: "5 Kecamatan Teratas" })).toBeVisible();
      await expect(page.getByText("5 Kabupaten/Kota Teratas")).toHaveCount(0);
      await page.getByRole("button", { name: /Cibinong/ }).click(); // nama aksesibel dari isi tombol, bukan atribut title
      await expect.poll(() => new URL(page.url()).searchParams.getAll("filter")).toContain("kecamatan_id~eq~11");
    });
    ```
    Tambah juga assersi di test pertama file (`"infografis renders the combined …"`, fixture tanpa `regionLevel`): `await expect(page.getByRole("heading", { name: "5 Kabupaten/Kota Teratas" })).toBeVisible();`.

## 6. Kasus uji

| Kasus | Bukti |
|---|---|
| Level kota (tanpa filter) → judul kab/kota | e2e test pertama infografis |
| Level kecamatan → judul & drill `kecamatan_id` | e2e BUG-001 |
| Level kelurahan → "5 Desa/Kelurahan Teratas" | browser manual (filter kecamatan) + screenshot |
| `regionLevel` absen di respons → default kota | e2e test pertama (fixture tidak mengirim `regionLevel`) |
| Persentase atas total; total 0 → `null` → "—" | unit `permen-aspek.test.cjs` |
| Indikator TRUE/NULL (NIB, pelatihan) tidak 100% | unit (NIB 80/100, pelatihan 4/10=40) |
| Kabkota tetap dipaksa kotanya | unit existing `"kabkota memaksa kota_scope…"` tetap hijau |
| Cache 10 menit per filter | unit existing tetap hijau; bentuk payload baru otomatis setelah restart Directus (cache in-memory) |
| Risk R16 (fan-out) | tidak ada query baru — `COUNT(*)` sudah ada; dibuktikan diff SQL kosong |

## 7. Perintah validasi & hasil yang diharapkan

```bash
cd services/directus/extensions/directus-extension-operasional && pnpm test          # 28 pass, 0 fail
cd services/directus/extensions/directus-extension-operasional && pnpm run build     # dist/ tersalin (gitignored)
cd apps/web && pnpm lint && pnpm typecheck                                            # 0 error, 0 warning
pnpm exec oxlint --disable-nested-config apps/web/app/types/infografis.ts apps/web/app/constants/DASHBOARD.ts apps/web/app/components/dashboard/card/Overview.vue "apps/web/app/pages/(private)/dashboard/index.vue" apps/web/app/types/operasional.ts apps/web/app/components/dashboard/card/PermenAspek.vue services/directus/extensions/directus-extension-operasional/src/permen-aspek.js   # exit 0 (oxlint seluruh repo sudah punya error lama di data-lapangan/[id].vue; gerbang hanya untuk file manifest)
cd apps/web && pnpm test:unit                                                         # semua pass
cd apps/web && pnpm exec playwright test tests/e2e/infografis.spec.ts tests/e2e/sso-demo.spec.ts   # pass (N5-01 skip sesuai env)
rg -n "DASHBOARD_SECTIONS\.topRegion|drill:kota" apps/web/app                         # 0 hit
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-1.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 1   # outside: []
```

## 8. Bukti runtime/browser

- Stack lokal (Directus dengan ekstensi operasional hasil `pnpm run build`, restart container agar cache in-memory kosong) + login provinsi:
  - `evidence/BUG-001-after-1.png` (tanpa filter), `-2.png` (filter Kab. Bogor → "5 Kecamatan Teratas"), `-3.png` (Analitik setelah klik baris, chip filter kecamatan).
  - `evidence/BUG-002-after-1.png` tab Legalitas: NIB persen kecil + "dari N UMKM".
  - `curl` terautentikasi `GET /panel/operasional/aspek-perkembangan` → `definisiVersi: "indikator-operasional-v3"`, setiap indikator punya `total`.
- Jika stack lokal tidak tersedia: bukti terbatas pada unit + e2e mock; catat "runtime Directus operasional belum dibuktikan" di `execution_log.md`.

## 9. Rollback & handoff

- Rollback: `git revert <commit phase 1>`; tidak ada migration. Operasional `dist/` dibangun ulang dari `src/` saat build image.
- Handoff ke Phase 2/3: `REGION_ANALYTICS_FIELD` dan `InfografisRegionLevel` tersedia di `constants/DASHBOARD.ts`/`types/infografis.ts`; Phase 3 wajib mempertahankan `:region-level` dan `@drill:wilayah="openTopRegion"` pada `<DashboardCardOverview>`.
- Commit: `fix(dashboard): BUG-001 judul panel wilayah ikut level, BUG-002 lima aspek dibagi total UMKM`.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar manifest §2 (mis. `constants/index.ts`, `Infographic.vue`, ekstensi analytics). Tidak boleh mengubah SQL `permen-aspek.js` selain bentuk objek indikator dan `definisiVersi`.
