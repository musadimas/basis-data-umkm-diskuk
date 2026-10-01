# Phase 2 — Analitik: satu field per level wilayah (BUG-003) & filter multi-nilai (BUG-004)

## 1. Objective, dependensi, hasil teramati

- **Objective:** builder Analitik hanya menawarkan satu field per level wilayah ("Kabupaten/kota", "Kecamatan", "Kelurahan", backing `kota_nama`/`kecamatan_nama`/`kelurahan_nama`); memilih nilai wilayah dari daftar mengirim **nama** (bukan id) sehingga hasil tidak kosong; menambah nilai kedua pada field yang sama menggabungkannya menjadi operator `in` ("salah satu").
- **Dependensi:** Phase 1 ter-commit (tidak ada file bersama; urutan dijaga demi satu commit per phase).
- **Hasil teramati:**
  - Dropdown "Kelompokkan menurut", "Breakdown opsional", dan "Field filter" tidak lagi memuat "Nama kabupaten/kota", "Kode kabupaten/kota", "Nama kecamatan", "Nama kelurahan" berdampingan dengan "Kabupaten/kota"/"Kecamatan"/"Kelurahan".
  - Tambah filter Kabupaten/kota = KAB. BEKASI lalu = KOTA BEKASI → satu chip "Kabupaten/kota salah satu KAB. BEKASI, KOTA BEKASI", hasil dua kelompok, URL `filter=kota_nama~in~…`, reload mempertahankan chip.
  - Kabkota: server tetap memaksa kotanya (filter kota klien dibuang — perilaku existing `terapkanScope`).

## 2. Manifest file (tertutup)

| Path | Aksi |
|---|---|
| `apps/web/app/lib/analytics-filters.ts` | modify |
| `apps/web/app/lib/analytics-query.ts` | modify |
| `apps/web/app/components/analytics/QueryBuilder.vue` | modify |
| `apps/web/app/components/analytics/FilterChips.vue` | modify |
| `apps/web/app/pages/(private)/dashboard/analitik.vue` | modify |
| `apps/web/tests/unit/analytics-filters.test.ts` | create |
| `apps/web/tests/unit/analytics-query.test.ts` | modify |
| `apps/web/tests/fixtures/mock-directus.mjs` | modify |
| `apps/web/tests/e2e/analytics-canvas.spec.ts` | modify |

Tidak ada perubahan server/registry (`analitik_field`, `metadata.js`, `query-compiler.cjs` tidak disentuh).

## 3. Simbol & anchor

- `lib/analytics-filters.ts`: `EQUALITY_ONLY`, fungsi `filterValue(filters, fieldId)`, `FILTER_FIELDS` (`kota_nama`, `kota_kode`, `kecamatan_nama`, `kelurahan_nama`, …), `filterConfigFor`, `operatorsFor`.
- `lib/analytics-query.ts::parseAnalysisUrl` loop `for (const raw of params.getAll("filter"))` — kondisi `!safeFilterValue(value)` pada string gabungan dan `const values = operator === "in" ? value.split(",") : [value];`.
- `components/analytics/QueryBuilder.vue`: `const dimensions = computed(…)`, `loadOptions()` (map `response.options` → `{ id: String(option.id), label }`), `function addFilter()`, template: tiga `UiSelectItem v-for="field in group.fields"` (Kelompokkan, Breakdown) dan `v-for="field in fields.filter((item) => item.status === 'active' && (item.role === 'filter' || item.role === 'dimension'))"` (Field filter), `{{ field.label }}`.
- `components/analytics/FilterChips.vue::label`.
- `pages/(private)/dashboard/analitik.vue::dimensionLabel` (`fields.value.find((field) => field.key === applied.groupBy)?.label`). `selectGroup`/`drillGroup` → `state.addFilter` (**tidak diubah**, lihat §5.6).
- Server (hanya baca, untuk alasan): `services/directus/extensions/analytics/src/endpoints/analysis/metadata.js::getOptions` (opsi `kota_nama|kecamatan_nama|kelurahan_nama` ber-`id` numerik; `parent` boleh label → `parentName`), `services/directus/analytics-shared/query-compiler.cjs` (`kota_nama` difilter `COALESCE(a.kota_nama,…)`, `kecamatan_nama` → `a.kecamatan_nama`, `kelurahan_nama` → key `COALESCE(a.kelurahan_nama,…)`; `in` teks `= ANY(?::text[])` 1–100 nilai; `KOTA_FIELDS = kota_id,kota_kode,kota_nama`), `templates.js` (`groupBy: "kota_nama"`).

## 4. Kontrak saat ini → akhir

| Aspek | Saat ini | Akhir |
|---|---|---|
| Field wilayah di builder | 7 field (id, kode, nama) | `kota_nama`, `kecamatan_nama`, `kelurahan_nama` dengan label "Kabupaten/kota", "Kecamatan", "Kelurahan"; `kota_id`, `kota_kode`, `kecamatan_id`, `kelurahan_id` tersembunyi kecuali sedang menjadi `groupBy`/`breakdown` aktif (deep-link Infografis/Spasial) |
| Nilai opsi `*_nama` | `option.id` (angka) | `option.label` (nama), unik per label |
| Tambah filter field sama | mengganti | `eq`/`in` + `eq` baru → `in` gabungan unik (urutan tambah); `neq`/`contains`/`starts_with` tetap mengganti; maks 100 nilai |
| Cascade induk | nilai pertama dari array | hanya bila induk tepat satu nilai; >1 nilai → tanpa scope induk |
| URL `in` | ditolak bila gabungan nilai >100 karakter | tiap nilai divalidasi; jumlah nilai ≤ 100 |
| Chip | label registry | label builder |
| `useAnalysisState.addFilter` (klik grup/drill) | mengganti | **tetap mengganti** (klik grup = fokus ke satu grup) |

## 5. Edit berurutan

1. **`lib/analytics-filters.ts`** — tambahkan (di atas `FILTER_FIELDS`):
   ```ts
   /**
    * Field wilayah duplikat (id/kode) yang tidak ditawarkan builder (BUG-003). Tetap valid bila datang
    * dari URL atau deep-link Infografis/Spasial, sehingga saved analysis lama tetap terbuka.
    */
   export const BUILDER_HIDDEN_FIELDS: ReadonlySet<string> = new Set(["kota_id", "kota_kode", "kecamatan_id", "kelurahan_id"])

   /** Label builder untuk field wilayah kanonik; registry memakai "Nama …". */
   const BUILDER_LABELS: ReadonlyMap<string, string> = new Map([
     ["kota_nama", "Kabupaten/kota"],
     ["kecamatan_nama", "Kecamatan"],
     ["kelurahan_nama", "Kelurahan"],
   ])

   export function builderLabel(field: Pick<AnalyticsField, "key" | "label">): string {
     return BUILDER_LABELS.get(field.key) ?? field.label
   }

   /** Field yang nilainya disaring server berdasarkan nama, sehingga opsi memakai label sebagai nilai (BUG-004). */
   export const LABEL_VALUE_FIELDS: ReadonlySet<string> = new Set(["kota_nama", "kecamatan_nama", "kelurahan_nama"])

   /** Batas nilai `in` yang diterima compiler server (query-compiler.cjs). */
   export const MAX_IN_VALUES = 100

   /**
    * Tambahkan filter ke daftar. `eq` baru pada field yang sudah punya `eq`/`in` digabung menjadi `in`
    * (unik, urutan tambah, posisi chip tetap). Operator lain mengganti filter field itu. Nilai yang
    * mengandung koma tidak digabung (pemisah `in` pada URL) dan mengganti seperti sebelumnya.
    * Gabungan yang melebihi MAX_IN_VALUES mengembalikan daftar semula.
    */
   export function mergeFilter(filters: AnalyticsFilter[], filter: AnalyticsFilter): AnalyticsFilter[] {
     const existing = filters.find((item) => item.fieldId === filter.fieldId)
     const replace = () => [...filters.filter((item) => item.fieldId !== filter.fieldId), filter]
     if (!existing) return [...filters, filter]
     if (filter.operator !== "eq" || (existing.operator !== "eq" && existing.operator !== "in")) return replace()
     const current = Array.isArray(existing.value) ? existing.value : [existing.value]
     const incoming = Array.isArray(filter.value) ? filter.value : [filter.value]
     if ([...current, ...incoming].some((value) => value.includes(","))) return replace()
     const values = [...new Set([...current, ...incoming])]
     if (values.length > MAX_IN_VALUES) return filters
     const [only] = values
     const merged: AnalyticsFilter = values.length === 1 && only !== undefined
       ? { fieldId: filter.fieldId, operator: "eq", value: only }
       : { fieldId: filter.fieldId, operator: "in", value: values }
     return filters.map((item) => (item === existing ? merged : item))
   }
   ```
   Ubah `filterValue` agar cascade hanya memakai induk bernilai tunggal:
   ```ts
   function filterValue(filters: AnalyticsFilter[], fieldId: string): string | undefined {
     const filter = filters.find((item) => item.fieldId === fieldId && item.operator !== "neq")
     if (!filter) return undefined
     if (!Array.isArray(filter.value)) return filter.value
     // Induk multi-nilai (`in`) tidak bisa menjadi satu scope; daftar anak tidak dipersempit.
     return filter.value.length === 1 ? filter.value[0] : undefined
   }
   ```
   `FILTER_FIELDS` **tidak diubah** (region tetap `EQUALITY_ONLY`; `in` hanya muncul lewat penggabungan). Impor `AnalyticsField` sudah ada sebagai tipe; tambahkan `AnalyticsFilter` bila belum (sudah diimpor pada baris 1).

2. **`lib/analytics-query.ts::parseAnalysisUrl`** — di dalam loop filter, ganti kondisi validasi string gabungan:
   ```ts
   if (
     !fieldId ||
     !operator ||
     !safeIdentifier(fieldId) ||
     !ALLOWED_OPERATORS.has(operator as AnalyticsFilter["operator"]) ||
     // `in` divalidasi per nilai di bawah; string gabungannya boleh > 100 karakter.
     (operator !== "in" && !safeFilterValue(value))
   ) {
   ```
   dan setelah `const values = …`:
   ```ts
   if (!values.length || values.length > 100 || values.some((item) => !safeFilterValue(item))) {
   ```
   `serializeAnalysisUrl` tidak berubah (sudah memvalidasi per nilai).

3. **`QueryBuilder.vue`**
   - Impor: `import { BUILDER_HIDDEN_FIELDS, LABEL_VALUE_FIELDS, MAX_IN_VALUES, builderLabel, filterConfigFor, mergeFilter, operatorsFor, type FilterOption } from "~/lib/analytics-filters";`
   - `dimensions`:
     ```ts
     const dimensions = computed(() =>
       props.fields.filter(
         (field) =>
           field.status === "active" &&
           field.role === "dimension" &&
           (!BUILDER_HIDDEN_FIELDS.has(field.key) ||
             field.key === props.modelValue.groupBy ||
             field.key === props.modelValue.breakdown),
       ),
     );
     ```
   - Tambah `const filterFields = computed(() => props.fields.filter((item) => item.status === "active" && (item.role === "filter" || item.role === "dimension") && !BUILDER_HIDDEN_FIELDS.has(item.key)));` dan ganti ekspresi inline `fields.filter(…)` pada `UiSelectItem` Field filter dengan `v-for="field in filterFields"`.
   - Ketiga render `{{ field.label }}` di Kelompokkan, Breakdown, Field filter → `{{ builderLabel(field) }}`; placeholder pencarian `` `Cari ${selectedField.label.toLowerCase()}…` `` → `` `Cari ${builderLabel(selectedField).toLowerCase()}…` ``; placeholder input teks `:placeholder="selectedField.label"` → `:placeholder="builderLabel(selectedField)"`.
   - `loadOptions()` — ganti pemetaan opsi:
     ```ts
     const byLabel = LABEL_VALUE_FIELDS.has(filterField.value);
     const seen = new Set<string>();
     optionList.value = response.options.flatMap((option) => {
       // `*_nama` disaring server dengan nama; nama kembar lintas induk cukup muncul sekali.
       const id = byLabel ? option.label : String(option.id);
       if (seen.has(id)) return [];
       seen.add(id);
       return [{ id, label: option.label }];
     });
     ```
   - Tambah `const filterLimitHit = ref(false);` dan ganti `addFilter()`:
     ```ts
     function addFilter() {
       const value = filterValue.value.trim();
       if (!filterField.value || !value) return;
       const next = mergeFilter(props.modelValue.filters, {
         fieldId: filterField.value,
         operator: filterOperator.value,
         value,
       });
       filterLimitHit.value = next === props.modelValue.filters;
       if (filterLimitHit.value) return;
       emit("update", { filters: next });
       filterValue.value = "";
     }
     ```
     dan reset `filterLimitHit.value = false` di dalam `watch(selectedField, …)`.
   - Template: setelah `<p v-if="cascadeHint">`, tambahkan
     `<p v-if="filterLimitHit" role="alert" class="text-[10px] leading-tight text-destructive">Maksimal {{ MAX_IN_VALUES }} nilai per filter.</p>`.

4. **`FilterChips.vue`** — impor `builderLabel` dari `~/lib/analytics-filters`; ubah `label`:
   ```ts
   const label = (id: string) => {
     const field = props.fields.find((item) => item.key === id || item.id === id);
     return field ? builderLabel(field) : "Filter";
   };
   ```
   Pemisah nilai array tetap `", "`.

5. **`analitik.vue`** — impor `builderLabel`; `dimensionLabel`:
   ```ts
   const dimensionLabel = computed(() => {
     const field = fields.value.find((item) => item.key === applied.groupBy);
     return field ? builderLabel(field) : "kelompok";
   });
   ```

6. **Keputusan eksplisit — `useAnalysisState.addFilter` tidak diubah.** `selectGroup`/`drillGroup` (klik bar/baris kanvas) tetap mengganti filter field itu, karena klik grup berarti "fokus ke grup ini" dan drill menambah level baru. Jangan menyentuh `composables/useAnalysisState.ts`.

7. **`tests/fixtures/mock-directus.mjs`**
   - Metadata (`/panel/v1/analytics/analysis/metadata`): ubah label `kota_nama` menjadi `"Nama kabupaten/kota"` (meniru registry nyata) dan tambahkan field aktif berikut setelahnya (bentuk sama dengan entri lain, `privacy: "aggregate"`, `schemaVersion: 1`): `kota_id` (label "Kabupaten/kota", role `dimension`, type `integer`), `kota_kode` (label "Kode kabupaten/kota", role `filter`, type `text`), `kecamatan_id` (label "Kecamatan", role `dimension`, type `integer`), `kecamatan_nama` (label "Nama kecamatan", role `dimension`, type `text`).
   - Options: biarkan `kota_nama` → `[{id:"1",label:"Kabupaten Bogor"},{id:"2",label:"Kota Depok"}]`.

8. **`tests/unit/analytics-filters.test.ts`** (baru):
   ```ts
   import { describe, expect, it } from "vitest";
   import { BUILDER_HIDDEN_FIELDS, builderLabel, mergeFilter, MAX_IN_VALUES } from "~/lib/analytics-filters";
   const eq = (fieldId: string, value: string) => ({ fieldId, operator: "eq" as const, value });
   describe("mergeFilter", () => {
     it("menggabungkan eq kedua pada field sama menjadi in, posisi chip tetap", () => {
       const filters = [eq("kota_nama", "KAB. BEKASI"), eq("skala_dilaporkan", "micro")];
       expect(mergeFilter(filters, eq("kota_nama", "KOTA BEKASI"))).toEqual([
         { fieldId: "kota_nama", operator: "in", value: ["KAB. BEKASI", "KOTA BEKASI"] },
         eq("skala_dilaporkan", "micro"),
       ]);
     });
     it("nilai sama tidak menggandakan dan tetap eq", () => {
       expect(mergeFilter([eq("kota_nama", "A")], eq("kota_nama", "A"))).toEqual([eq("kota_nama", "A")]);
     });
     it("menambah ke in yang sudah ada", () => {
       const start = [{ fieldId: "kota_nama", operator: "in" as const, value: ["A", "B"] }];
       expect(mergeFilter(start, eq("kota_nama", "C"))[0]).toEqual({ fieldId: "kota_nama", operator: "in", value: ["A", "B", "C"] });
     });
     it("neq dan operator teks mengganti", () => {
       const start = [eq("kota_nama", "A")];
       expect(mergeFilter(start, { fieldId: "kota_nama", operator: "neq", value: "B" })).toEqual([{ fieldId: "kota_nama", operator: "neq", value: "B" }]);
       expect(mergeFilter([{ fieldId: "kbli_kode", operator: "contains", value: "56" }], eq("kbli_kode", "56103"))).toEqual([eq("kbli_kode", "56103")]);
     });
     it("nilai berkoma mengganti, tidak digabung", () => {
       expect(mergeFilter([eq("kecamatan_nama", "A")], eq("kecamatan_nama", "B, C"))).toEqual([eq("kecamatan_nama", "B, C")]);
     });
     it("melebihi batas mengembalikan daftar yang sama", () => {
       const start = [{ fieldId: "kelurahan_nama", operator: "in" as const, value: Array.from({ length: MAX_IN_VALUES }, (_, i) => `K${i}`) }];
       expect(mergeFilter(start, eq("kelurahan_nama", "baru"))).toBe(start);
     });
     it("field baru ditambahkan di akhir", () => {
       expect(mergeFilter([eq("skala_dilaporkan", "micro")], eq("kota_nama", "A"))).toHaveLength(2);
     });
   });
   describe("field wilayah builder", () => {
     it("menyembunyikan id/kode dan memberi label tunggal", () => {
       expect([...BUILDER_HIDDEN_FIELDS].sort()).toEqual(["kecamatan_id", "kelurahan_id", "kota_id", "kota_kode"]);
       expect(builderLabel({ key: "kota_nama", label: "Nama kabupaten/kota" })).toBe("Kabupaten/kota");
       expect(builderLabel({ key: "skala_dilaporkan", label: "Skala" })).toBe("Skala");
     });
   });
   ```

9. **`tests/unit/analytics-query.test.ts`** — tambah di `describe("analytics query URL contract")`:
   ```ts
   it("round trips in-filters whose joined value exceeds 100 characters", () => {
     const names = ["KAB. BOGOR", "KAB. SUKABUMI", "KAB. CIANJUR", "KAB. BANDUNG", "KAB. GARUT", "KAB. TASIKMALAYA", "KAB. CIAMIS", "KAB. KUNINGAN", "KAB. CIREBON"];
     const config = { ...defaultAnalysis, filters: [{ fieldId: "kota_nama", operator: "in" as const, value: names }] };
     const parsed = parseAnalysisUrl(serializeAnalysisUrl(config));
     expect(names.join(",").length).toBeGreaterThan(100);
     expect(parsed.warning).toBe(false);
     expect(parsed.config.filters).toEqual(config.filters);
   });
   it("rejects in-filters with more than 100 values", () => {
     const value = Array.from({ length: 101 }, (_, i) => `K${i}`).join(",");
     expect(parseAnalysisUrl(`filter=kota_nama~in~${encodeURIComponent(value)}`).warning).toBe(true);
   });
   ```

10. **`tests/e2e/analytics-canvas.spec.ts`** — tambah dua test di `describe("canvas analitik")`:
    ```ts
    test("BUG-003: builder menampilkan satu field per level wilayah", async ({ page }) => {
      await installMockDirectus(page, { authenticated: true });
      await loginMock(page, "/dashboard/analitik");
      await page.getByLabel("Kelompokkan menurut").click();
      await expect(page.getByRole("option", { name: "Kabupaten/kota", exact: true })).toHaveCount(1);
      await expect(page.getByRole("option", { name: "Kecamatan", exact: true })).toHaveCount(1);
      await expect(page.getByRole("option", { name: /Nama kabupaten|Kode kabupaten|Nama kecamatan/ })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.getByLabel("Field filter").click();
      await expect(page.getByRole("option", { name: "Kabupaten/kota", exact: true })).toHaveCount(1);
      await expect(page.getByRole("option", { name: /Kode kabupaten/ })).toHaveCount(0);
    });
    test("BUG-004: dua kabupaten/kota digabung menjadi filter salah satu", async ({ page }) => {
      await installMockDirectus(page, { authenticated: true });
      const queryBodies: Array<{ filters?: Array<{ fieldId: string; operator: string; value: unknown }> }> = [];
      page.on("request", (request) => {
        if (request.url().includes("/panel/v1/analytics/analysis/query")) queryBodies.push(request.postDataJSON() || {});
      });
      await loginMock(page, "/dashboard/analitik");
      for (const name of ["Kabupaten Bogor", "Kota Depok"]) {
        await page.getByLabel("Field filter").click();
        await page.getByRole("option", { name: "Kabupaten/kota", exact: true }).click();
        await page.getByLabel("Nilai filter").click();
        await page.getByRole("option", { name, exact: true }).click();
        await page.getByRole("button", { name: "Tambah", exact: true }).click();
      }
      await expect(page.getByLabel("Filter aktif")).toContainText("Kabupaten/kota salah satu Kabupaten Bogor, Kota Depok");
      await page.getByRole("button", { name: "Terapkan" }).click();
      await expect.poll(() => queryBodies.some((body) => body.filters?.some((f) =>
        f.fieldId === "kota_nama" && f.operator === "in" && JSON.stringify(f.value) === JSON.stringify(["Kabupaten Bogor", "Kota Depok"])))).toBe(true);
      await expect.poll(() => new URL(page.url()).searchParams.getAll("filter")).toContain("kota_nama~in~Kabupaten%20Bogor%2CKota%20Depok");
      await page.reload();
      await expect(page.getByLabel("Filter aktif")).toContainText("Kabupaten Bogor, Kota Depok");
    });
    ```
    Pada test kedua, `Field filter` di-reset ke kosong setelah `Tambah`? Tidak — `filterField` tetap terpilih; klik ulang field yang sama tidak memicu `watch(selectedField)`. Karena itu loop memilih field setiap iterasi (idempoten) lalu nilai.

## 6. Kasus uji

| Kasus | Bukti |
|---|---|
| Tiap level wilayah sekali di Kelompokkan/Breakdown/Field filter | e2e BUG-003 |
| Deep-link `groupBy=kota_id` dari Infografis tetap tampil di Kelompokkan | browser manual: buka `/dashboard/analitik?groupBy=kota_id&filter=kota_id~eq~1` → trigger "Kabupaten/kota" (label registry `kota_id`); screenshot |
| Nilai picker = nama → hasil tidak kosong | e2e BUG-004 (body filter berisi nama) + runtime lokal |
| eq+eq → in; dedupe; neq mengganti; batas 100; koma | unit `analytics-filters.test.ts` |
| URL `in` > 100 karakter round-trip; > 100 nilai ditolak | unit `analytics-query.test.ts` |
| Reload mempertahankan chip `in` | e2e BUG-004 |
| Cascade: kecamatan dengan induk dua kota → daftar tidak dipersempit (tanpa `parent`) | unit tidak langsung; browser manual + request `metadata/options` tanpa `parent` (cek Network) |
| Kabkota | perilaku server existing (`terapkanScope` membuang `kota_nama` klien); tidak ada perubahan; regresi `tests/e2e/kabkota-scope.spec.ts` dijalankan |
| Klik grup kanvas tetap mengganti | e2e existing `"manual controls wait for Terapkan…"` tetap hijau |
| Risk R15 | jalur SQL `kota_nama` `in` = jalur `eq` existing (non-sargable `COALESCE`); dicatat known limitation di `execution_log.md` |

## 7. Validasi

```bash
cd apps/web && pnpm exec vitest run tests/unit/analytics-filters.test.ts tests/unit/analytics-query.test.ts   # pass
cd apps/web && pnpm lint && pnpm typecheck && pnpm test:unit                                               # 0 error; semua pass
pnpm exec oxlint --disable-nested-config apps/web/app/lib/analytics-filters.ts apps/web/app/lib/analytics-query.ts apps/web/app/components/analytics/QueryBuilder.vue apps/web/app/components/analytics/FilterChips.vue "apps/web/app/pages/(private)/dashboard/analitik.vue" apps/web/tests/unit/analytics-filters.test.ts   # exit 0
cd apps/web && pnpm exec playwright test tests/e2e/analytics-canvas.spec.ts tests/e2e/kabkota-scope.spec.ts tests/e2e/saved-export.spec.ts   # pass
rg -n "item.role === 'filter' \|\| item.role === 'dimension'" apps/web/app/components/analytics/QueryBuilder.vue   # 1 hit (di dalam computed filterFields)
rg -n ":value=\"option.id\"" apps/web/app/components/analytics/QueryBuilder.vue   # tetap 1 hit (id opsi kini = label untuk *_nama)
python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-2.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 2   # outside: []
```

## 8. Bukti runtime/browser

- Stack lokal + login provinsi: `evidence/BUG-003-after-1.png` (dropdown Kelompokkan & Field filter), `evidence/BUG-004-after-1.png` (chip "salah satu" KAB. BEKASI, KOTA BEKASI + 2 kelompok), `-2.png` (setelah reload).
- Login kabkota: tambah dua kota → chip tampil, hasil tetap kota akun (screenshot `BUG-004-after-kabkota.png`).
- Jika stack lokal tidak tersedia: hasil server terhadap nama riil (mis. "KAB. BEKASI") belum dibuktikan; catat sebagai unproven.

## 9. Rollback & handoff

- Rollback: `git revert <commit phase 2>`; tidak ada migration, URL `in` tetap kompatibel ke belakang (versi lama menolak gabungan > 100 karakter dengan warning, bukan crash).
- Handoff: Phase 3 tidak menyentuh berkas Analitik; deep-link peta tetap memakai `*_id` (tersembunyi tetapi tampil bila terpilih).
- Commit: `fix(analitik): BUG-003 satu field per level wilayah, BUG-004 filter wilayah multi-nilai`.

## 10. Aturan scope-amendment

Berhenti dan laporkan sebelum menyentuh file di luar §2 — khususnya `composables/useAnalysisState.ts`, `metadata.js`, `query-compiler.cjs`, atau migration registry.
