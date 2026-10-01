# Phase 3 — Peta: kartu info wilayah sebelum drill-down (BUG-005)

## 1. Objective, dependensi, hasil teramati

- **Objective:** klik poligon wilayah tidak lagi langsung drill-down. Klik membuka kartu (nama, jumlah UMKM, share dari total peta) dengan tombol "Lihat rincian kecamatan" / "Lihat rincian desa/kelurahan" (drill) dan—hanya di dashboard privat—"Buka di Analitik".
- **Dependensi:** Phase 1 ter-commit (`REGION_ANALYTICS_FIELD` dan `InfografisRegionLevel` sudah ada; `index.vue` sudah memuat `:region-level` + `@drill:wilayah="openTopRegion"` pada `<DashboardCardOverview>`).
- **Hasil teramati:**
  - Peta Spasial & peta Infografis: klik kab/kota → kartu; peta tidak bergerak; "Lihat rincian kecamatan" → drill seperti sebelumnya; "Buka di Analitik" → `/dashboard/analitik?…filter=<level>_id~eq~<id>`.
  - Level kelurahan: kartu hanya berisi "Buka di Analitik" (tidak ada rincian lebih dalam). Sebelumnya Spasial/Infografis langsung membuka Analitik saat klik kelurahan.
  - Landing publik (`LandingMap.vue`): kartu dengan "Lihat rincian …"; tanpa tombol Analitik; level kelurahan: kartu info saja (sebelumnya klik kelurahan tidak berbuat apa pun).

## 2. Manifest file (tertutup)

| Path | Aksi |
|---|---|
| `apps/web/app/components/dashboard/map/Choropleth.client.vue` | modify |
| `apps/web/app/components/dashboard/map/Infographic.vue` | modify |
| `apps/web/app/pages/(private)/dashboard/spasial.vue` | modify |
| `apps/web/app/pages/(private)/dashboard/index.vue` | modify |
| `apps/web/tests/e2e/infografis.spec.ts` | modify |

`apps/web/app/components/landing/LandingMap.vue` **tidak diubah**: ia memakai `DashboardMapChoropleth` tanpa `region-analytics`, handler `@select="selectRegion"` tetap dipanggil oleh tombol "Lihat rincian …", dan sudah mengabaikan level kelurahan.

## 3. Simbol & anchor

- `Choropleth.client.vue`: komentar header (`- Poligon wilayah dengan hover highlight & klik untuk drill-down.`), `defineProps` (`pointCard?: boolean;` + default `pointCard: false`), `defineEmits` (`select: [region: InfografisRegion];`), `let popup: Popup | null = null;`, `levelLabel`, `function onRegionClick(event: MapLayerMouseEvent)` (blok `popup?.remove(); const content = …; popup = new Popup({ closeButton: false, offset: 8 }) … emit("select", region);`), `function onPointClick` (`popup?.remove();`), `loadPointCard` (`if (popup !== owner) return;`), `watch(() => props.regions, updateSource, { deep: true });`, `onBeforeUnmount` (`popup?.remove(); … popup = null;`). Impor `formatAnalyticsNumber` dari `~/lib/analytics-format`.
- `Infographic.vue`: `defineEmits` (`select: [region: InfografisRegion];`), `<DashboardMapChoropleth … point-card … @select="emit('select', $event)" />`. Dipakai hanya oleh `index.vue` dan `spasial.vue` (`rg -n "DashboardMapInfographic" apps/web/app` → 2 hit).
- `spasial.vue`: `function openAnalytics`, `function openRegion` (baris `if (level === "kelurahan") return openAnalytics("kelurahan_id", region.id);` + komentar "Level terdalam…"), `<DashboardMapInfographic … @select="openRegion" @back="mapBack" />`, impor `DASHBOARD_SECTIONS` dari `~/constants/DASHBOARD`.
- `index.vue`: `function openRegion` (baris `if (level === "kelurahan") return openAnalytics("kelurahan_id", region.id);`), `<DashboardMapInfographic … @select="openRegion" @back="mapBack" />`, `openTopRegion` (Phase 1).

## 4. Kontrak saat ini → akhir

| Aspek | Saat ini | Akhir |
|---|---|---|
| `Choropleth` prop | — | `regionAnalytics?: boolean` (default `false`) |
| `Choropleth` emit | `select` saat klik poligon | `select` hanya dari tombol "Lihat rincian …"; baru: `analyze: [region]` dari tombol "Buka di Analitik" |
| Popup wilayah | nama + "N UMKM", `closeButton:false`, langsung drill | kartu `data-testid="region-card"`: nama, `"<n> UMKM · <p> dari total peta"`, tombol `region-card-drill` (bukan level kelurahan) dan `region-card-analytics` (bila `regionAnalytics`); `closeButton: true` |
| Siklus hidup popup | `popup?.remove()` tersebar di 3 tempat | satu `closePopup()` idempoten dipanggil semua jalur keluar (risk R7) |
| `Infographic.vue` | meneruskan `select` | meneruskan `select` dan `analyze`; selalu `region-analytics` (seperti `point-card`) |
| Spasial/Infografis klik kelurahan | langsung Analitik | kartu → "Buka di Analitik" |

## 5. Edit berurutan

1. **`Choropleth.client.vue`**
   - Komentar header: ganti baris drill-down dengan `- Poligon wilayah dengan hover highlight; klik membuka kartu info (rincian level berikutnya dan, di dashboard, Analitik).`
   - Impor: `import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format";`
   - Props: setelah `pointCard?: boolean;` tambah
     ```ts
     /** Kartu wilayah menampilkan tombol "Buka di Analitik" (emit `analyze`). Hanya dashboard yang sudah login. */
     regionAnalytics?: boolean;
     ```
     default `regionAnalytics: false`.
   - Emits: tambah `analyze: [region: InfografisRegion];`.
   - Setelah `levelLabel`, tambah:
     ```ts
     /** Label level berikutnya untuk tombol rincian; level terdalam tidak punya rincian. */
     const NEXT_LEVEL_LABEL = {
       kota: "kecamatan",
       kecamatan: "desa/kelurahan",
       kelurahan: null,
     } as const satisfies Record<"kota" | "kecamatan" | "kelurahan", string | null>;
     const regionTotal = computed(() =>
       props.regions.reduce((sum, region) => sum + (Number(region.value) || 0), 0),
     );

     /** Satu-satunya jalan menutup popup wilayah/titik; idempoten, dipanggil semua jalur keluar (R7). */
     function closePopup() {
       const current = popup;
       popup = null;
       current?.remove();
     }

     /** Tombol aksi kartu wilayah; hanya berlaku selama popup pemiliknya masih yang aktif. */
     function regionAction(label: string, testId: string, owner: Popup, run: () => void) {
       const button = document.createElement("button");
       button.type = "button";
       button.className =
         "w-full rounded-md border border-blue-700 px-2 py-1 text-left text-[12px] font-semibold text-blue-700 hover:bg-blue-50";
       button.dataset.testid = testId;
       button.textContent = label;
       button.addEventListener("click", () => {
         if (popup !== owner) return;
         closePopup();
         run();
       });
       return button;
     }
     ```
   - `onRegionClick` — pertahankan pemeriksaan `pointLayers`/`hitPoints` dan pencarian `region`; ganti sisa badan fungsi mulai `popup?.remove();` sampai `emit("select", region);` dengan:
     ```ts
     closePopup();
     const value = Number(region.value) || 0;
     const content = document.createElement("div");
     content.className = "space-y-1";
     content.dataset.testid = "region-card";
     const title = document.createElement("div");
     title.className = "text-[13px] font-bold leading-snug";
     title.textContent = region.name;
     const total = document.createElement("div");
     total.className = "text-[11px] text-slate-600";
     const share = regionTotal.value > 0 ? (value / regionTotal.value) * 100 : 0;
     total.textContent = `${formatAnalyticsNumber(value)} UMKM · ${formatAnalyticsPercent(share)} dari total peta`;
     content.append(title, total);
     const owner = new Popup({ closeButton: true, offset: 8, maxWidth: "260px" })
       .setLngLat(event.lngLat)
       .setDOMContent(content);
     const actions = document.createElement("div");
     actions.className = "mt-2 grid gap-1";
     const next = NEXT_LEVEL_LABEL[props.level];
     if (next) actions.append(regionAction(`Lihat rincian ${next}`, "region-card-drill", owner, () => emit("select", region)));
     if (props.regionAnalytics) actions.append(regionAction("Buka di Analitik", "region-card-analytics", owner, () => emit("analyze", region)));
     if (actions.childElementCount > 0) content.append(actions);
     // Popup ditutup maplibre (tombol × atau klik peta): lepaskan rujukan agar tombol basi tidak berlaku.
     owner.on("close", () => {
       if (popup === owner) popup = null;
     });
     popup = owner.addTo(event.target);
     ```
   - `onPointClick`: ganti `popup?.remove();` dengan `closePopup();`.
   - Ganti `watch(() => props.regions, updateSource, { deep: true });` dengan
     ```ts
     // Data wilayah berganti (filter, drill, kembali): kartu lama tidak lagi menunjuk data yang tampil.
     watch(() => props.regions, () => {
       closePopup();
       updateSource();
     }, { deep: true });
     watch(() => props.level, closePopup);
     ```
   - `onBeforeUnmount`: ganti `popup?.remove();` dengan `closePopup();` dan hapus baris `popup = null;`.

2. **`Infographic.vue`**
   - `defineEmits`: tambah `analyze: [region: InfografisRegion];`.
   - `<DashboardMapChoropleth>`: tambahkan atribut `region-analytics` tepat setelah `point-card`, dan `@analyze="emit('analyze', $event)"` setelah `@select=…`.

3. **`spasial.vue`**
   - Impor: `import { DASHBOARD_SECTIONS, REGION_ANALYTICS_FIELD } from "~/constants/DASHBOARD";`
   - `openRegion`: ganti komentar + baris kelurahan dengan
     ```ts
     // Level terdalam tidak punya rincian; kartu wilayah hanya menawarkan Analitik.
     if (level === "kelurahan") return;
     ```
   - Tambah setelah `openRegion`:
     ```ts
     /** Tombol "Buka di Analitik" pada kartu wilayah (BUG-005). */
     function analyzeRegion(region: { id: string }) {
       openAnalytics(REGION_ANALYTICS_FIELD[mapInfografis.value?.regionLevel ?? "kota"], region.id);
     }
     ```
   - Template `<DashboardMapInfographic>`: tambah `@analyze="analyzeRegion"` setelah `@select="openRegion"`.

4. **`index.vue`** — invarian Phase 1 dinyatakan ulang dan wajib tetap ada: `<DashboardCardOverview :region-level="infografis?.regionLevel ?? 'kota'" … @drill:wilayah="openTopRegion">` dan `openTopRegion` memakai `REGION_ANALYTICS_FIELD`. Edit phase ini hanya:
   - `openRegion`: ganti `if (level === "kelurahan") return openAnalytics("kelurahan_id", region.id);` dengan komentar + `if (level === "kelurahan") return;` (sama dengan spasial).
   - Tambah setelah `openRegion`:
     ```ts
     /** Tombol "Buka di Analitik" pada kartu wilayah peta (BUG-005). */
     function analyzeRegion(region: { id: string }) {
       openAnalytics(REGION_ANALYTICS_FIELD[mapInfografis.value?.regionLevel ?? "kota"], region.id);
     }
     ```
   - Template `<DashboardMapInfographic>`: tambah `@analyze="analyzeRegion"` setelah `@select="openRegion"`.

5. **`tests/e2e/infografis.spec.ts`** — tambah test (peta Infografis dipakai karena titik UMKM mati secara bawaan di halaman ini, sehingga klik tengah kanvas mengenai poligon, bukan titik; fixture `wilayahPolygons` adalah grid 9×3 sehingga titik tengah bounds jatuh di dalam "Wilayah 14"):
   ```ts
   test("BUG-005: klik wilayah membuka kartu info; drill dan Analitik hanya lewat tombol", async ({ page }) => {
     await installMockDirectus(page, { authenticated: true, renderMap: true });
     const drillRequests: string[] = [];
     page.on("request", (request) => {
       const url = new URL(request.url());
       if (url.pathname === "/panel/v1/analytics/infographic/map" && url.searchParams.get("kota")) drillRequests.push(url.search);
     });
     await loginMock(page, "/dashboard");
     const canvas = page.locator(".maplibregl-canvas");
     await expect(canvas).toBeVisible();
     const card = page.getByTestId("region-card");
     // Kamera beranimasi fitBounds 700 ms; ulangi klik tengah sampai poligon terkena.
     await expect(async () => {
       await canvas.click();
       await expect(card).toBeVisible({ timeout: 1_000 });
     }).toPass({ timeout: 15_000 });
     await expect(card).toContainText(/Wilayah \d+/);
     await expect(card).toContainText("UMKM");
     await expect(card.getByTestId("region-card-analytics")).toHaveText("Buka di Analitik");
     expect(drillRequests).toHaveLength(0);
     await card.getByTestId("region-card-drill").click();
     await expect.poll(() => drillRequests.length).toBeGreaterThan(0);
     await expect(card).toBeHidden();
     await expect(async () => {
       await canvas.click();
       await expect(card).toBeVisible({ timeout: 1_000 });
     }).toPass({ timeout: 15_000 });
     await card.getByTestId("region-card-analytics").click();
     await expect(page).toHaveURL(/\/dashboard\/analitik\?/);
     expect(new URL(page.url()).searchParams.getAll("filter").some((value) => /^kota_id~eq~\d+$/.test(value))).toBe(true);
   });
   ```
   (Mock `/infographic/map` selalu mengembalikan `regionLevel: "kota"`, sehingga klik kedua tetap level kota dan filter Analitik `kota_id`.)

## 6. Kasus uji

| Kasus | Bukti |
|---|---|
| Klik poligon → kartu, tanpa request drill | e2e BUG-005 (`drillRequests` 0) |
| Tombol rincian → drill (request `kota`) dan kartu tertutup | e2e BUG-005 |
| Tombol Analitik → URL Analitik dengan field level | e2e BUG-005 (kota); level kecamatan/kelurahan: browser manual |
| Identity change (R7): kartu terbuka lalu data wilayah berganti (filter FAB / tombol Kembali) → kartu hilang | browser manual Spasial: buka kartu → Terapkan filter skala → kartu hilang (screenshot `BUG-005-after-lifecycle.png`); kode: watcher `regions`/`level` → `closePopup` |
| Klik titik setelah kartu wilayah | `onPointClick` memanggil `closePopup()` → hanya satu popup; browser manual Spasial (titik aktif bawaan) |
| Klik titik di atas poligon tidak membuka kartu wilayah | perilaku `hitPoints` existing tetap; browser manual |
| Unmount saat kartu terbuka (navigasi ke Analitik) | `onBeforeUnmount` → `closePopup()`; tidak ada error konsol pada e2e BUG-005 (Playwright `page.on("pageerror")` tidak dipakai; cek manual console bersih) |
| Landing: kartu tanpa Analitik; kelurahan tanpa tombol | browser manual `/` peta landing (screenshot `BUG-005-after-landing.png`) |
| Klik tombol popup basi | `regionAction` memeriksa `popup !== owner`; tidak diuji otomatis (popup basi sudah dihapus dari DOM) |

## 7. Validasi

```bash
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit                       # 0 error; semua pass
pnpm exec oxlint --disable-nested-config apps/web/app/components/dashboard/map/Choropleth.client.vue apps/web/app/components/dashboard/map/Infographic.vue "apps/web/app/pages/(private)/dashboard/spasial.vue" "apps/web/app/pages/(private)/dashboard/index.vue"   # exit 0
cd apps/web && pnpm exec playwright test tests/e2e/infografis.spec.ts tests/e2e/spasial.spec.ts tests/e2e/tabular-search-peta.spec.ts tests/e2e/portal.spec.ts   # pass
rg -n "popup\?\.remove\(\)" apps/web/app/components/dashboard/map/Choropleth.client.vue   # 0 hit (semua lewat closePopup)
rg -n "openAnalytics\(\"kelurahan_id\"" apps/web/app/pages   # 0 hit
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-3.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 3   # outside: []
```

## 8. Bukti runtime/browser

- Stack lokal, login provinsi: `evidence/BUG-005-after-1.png` (kartu Spasial kab/kota), `-2.png` (setelah "Lihat rincian kecamatan"), `-3.png` (Analitik dari kartu kecamatan: chip `kecamatan_id`), `-kelurahan.png` (kartu kelurahan hanya tombol Analitik), `-landing.png`, `-lifecycle.png`.
- E2E bergantung pada WebGL headless Chromium (SwiftShader) untuk `queryRenderedFeatures`. Jika test BUG-005 tidak pernah mengenai poligon dalam 15 detik di mesin eksekutor, **berhenti** dan laporkan (jangan `test.skip`, jangan menambah test hook ke komponen — tidak ada preseden hook peta di repo).

## 9. Rollback & handoff

- Rollback: `git revert <commit phase 3>` (UI saja). Phase 1 tetap utuh karena phase ini tidak mengubah baris `<DashboardCardOverview>`.
- Handoff: tidak ada phase lain yang menyentuh berkas peta.
- Commit: `fix(peta): BUG-005 klik wilayah membuka kartu info sebelum drill-down`.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar §2 — termasuk `LandingMap.vue` (perilaku landing berubah hanya lewat komponen bersama) dan fixture `analytics-data.mjs`.
