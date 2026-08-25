<script setup lang="ts">
import type { KbliCategoryItem, KbliCodeItem } from "~/types/dashboard";
import { ArrowUpRight, ChevronDown, Search, SearchX } from "@lucide/vue";
import { kategoriBpsFor } from "~/lib/kbli-sectors";

interface Props {
  items: KbliCategoryItem[];
  /** Kode KBLI dikelompokkan per huruf sektor, untuk drill-down saat baris diklik. */
  codesBySector?: Record<string, KbliCodeItem[]>;
}

const props = withDefaults(defineProps<Props>(), {
  codesBySector: () => ({}),
});

const emit = defineEmits<{
  (e: "view:data", item: KbliCategoryItem): void;
  (e: "drill:kode", code: KbliCodeItem): void;
}>();

const searchQuery = ref("");
const expandedCode = ref<string | null>(null);

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return props.items;
  const q = searchQuery.value.toLowerCase().trim();
  return props.items.filter(
    (item) =>
      item.code.toLowerCase() === q || item.title.toLowerCase().includes(q),
  );
});

/** Total seluruh baris terlihat, untuk proporsi persentase antar-kategori. */
const visibleTotal = computed(() =>
  filteredItems.value.reduce((sum, item) => sum + item.totalUmkm, 0),
);

const scaleMeta = [
  { key: "mikro", label: "Mikro", color: "bg-brand-green" },
  { key: "kecil", label: "Kecil", color: "bg-sky-500" },
  { key: "menengah", label: "Menengah", color: "bg-amber-400" },
] as const;

type ScaleKey = (typeof scaleMeta)[number]["key"];

const formatNumber = (value: number | undefined) =>
  new Intl.NumberFormat("id-ID").format(value ?? 0);

/** Lebar segmen stacked bar (persen), minimal 4% agar tetap terlihat. */
function segmentWidth(value: number | undefined, total: number): number {
  if (!total) return 0;
  return Math.max(4, Math.round(((value ?? 0) / total) * 100));
}

/** Persentase relatif terhadap total kategori yang sedang terlihat. */
function percentOf(value: number, total: number): string {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

const headerMeta = [
  { label: "Kategori", align: "" },
  { label: "Mikro", align: "text-right" },
  { label: "Kecil", align: "text-right" },
  { label: "Menengah", align: "text-right" },
  { label: "Total UMKM", align: "text-right" },
  { label: "Persentase", align: "text-right" },
] as const;

/** Buka/tutup baris detail; hanya satu kategori terbuka pada satu waktu. */
function toggleItem(code: string) {
  expandedCode.value = expandedCode.value === code ? null : code;
}

/** Kode KBLI milik sebuah sektor, untuk tampilan drill-down. */
function codesFor(code: string): KbliCodeItem[] {
  return props.codesBySector[code] ?? [];
}

/** Drill-down ke analitik untuk satu kode KBLI. */
function drillCode(code: KbliCodeItem) {
  emit("drill:kode", code);
}

/**
 * Pecahan hierarki KBLI per kode 5 digit: Golongan (3 digit, level 3) dan
 * Sub-Golongan (4 digit, level 4). Diturunkan langsung dari kode untuk
 * membedakan baris yang punya deskripsi panjang identik di referensi KBLI.
 */
function subKategoriOf(code: string) {
  return {
    golongan: code.slice(0, 3),
    subGolongan: code.slice(0, 4),
  };
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toolbar: pencarian + legenda skala -->
    <div
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div
        class="relative flex w-full max-w-72 items-center gap-2 rounded-lg border border-border/80 bg-white px-3 py-1.5 shadow-2xs dark:bg-card"
      >
        <Search class="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Cari huruf atau nama kategori…"
          aria-label="Cari kategori KBLI"
          class="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm"
        />
      </div>

      <div class="flex items-center gap-4 text-xs text-muted-foreground">
        <span
          v-for="scale in scaleMeta"
          :key="scale.key"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="h-2.5 w-2.5 rounded-full"
            :class="scale.color"
            aria-hidden="true"
          />
          {{ scale.label }}
        </span>
      </div>
    </div>

    <!-- Empty search result state -->
    <div
      v-if="filteredItems.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center"
    >
      <SearchX class="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p class="text-sm font-semibold text-muted-foreground">
        Tidak ditemukan kategori KBLI yang cocok dengan "{{ searchQuery }}"
      </p>
    </div>

    <!-- Compact data grid -->
    <div
      v-else
      class="overflow-hidden rounded-xl border border-border/80 bg-white dark:bg-card"
    >
      <table class="w-full text-left text-sm">
        <caption class="sr-only">
          Rincian UMKM per kategori KBLI beserta komposisi skala usaha
        </caption>
        <thead>
          <tr
            class="border-b bg-slate-50/60 text-xs font-semibold text-muted-foreground dark:bg-slate-900/40"
          >
            <th
              v-for="header in headerMeta"
              :key="header.label"
              scope="col"
              class="px-3 py-2 font-semibold whitespace-nowrap"
              :class="[
                header.align,
                header.label === 'Kategori' ? '' : 'hidden md:table-cell',
              ]"
            >
              {{ header.label }}
            </th>
            <th scope="col" class="w-10 px-3 py-2">
              <span class="sr-only">Buka rincian</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in filteredItems" :key="item.code">
            <tr
              class="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-inset dark:hover:bg-slate-900/30"
              :class="
                expandedCode === item.code
                  ? 'bg-slate-50/70 dark:bg-slate-900/30'
                  : ''
              "
              :aria-expanded="expandedCode === item.code"
              tabindex="0"
              @click="toggleItem(item.code)"
              @keydown.enter.prevent="toggleItem(item.code)"
              @keydown.space.prevent="toggleItem(item.code)"
            >
              <!-- Chip huruf + nama kategori -->
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-extrabold text-slate-700 select-none dark:bg-slate-800 dark:text-slate-200"
                    aria-hidden="true"
                  >
                    {{ item.code }}
                  </span>
                  <span class="min-w-0 text-sm font-semibold text-foreground">
                    <span class="line-clamp-2 sm:line-clamp-none">{{
                      item.title
                    }}</span>
                    <span
                      class="block text-xs font-normal text-muted-foreground md:hidden"
                    >
                      {{ formatNumber(item.totalUmkm) }} UMKM
                    </span>
                  </span>
                </div>
              </td>

              <!-- Breakdown skala (desktop) -->
              <td
                class="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell"
              >
                {{ formatNumber(item.mikro) }}
              </td>
              <td
                class="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell"
              >
                {{ formatNumber(item.kecil) }}
              </td>
              <td
                class="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell"
              >
                {{ formatNumber(item.menengah) }}
              </td>

              <!-- Total + bar & persentase (desktop) -->
              <td
                class="hidden px-3 py-2.5 text-right font-bold tabular-nums text-foreground md:table-cell"
              >
                {{ formatNumber(item.totalUmkm) }}
              </td>
              <td class="hidden px-3 py-2.5 md:table-cell">
                <div class="flex items-center justify-end gap-2">
                  <div
                    class="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
                    role="img"
                    :aria-label="`Proporsi kategori ${item.code} dari total ${visibleTotal} UMKM`"
                  >
                    <div
                      class="h-full bg-brand-green transition-all"
                      :style="{
                        width: `${Math.min(100, (item.totalUmkm / (visibleTotal || 1)) * 100)}%`,
                      }"
                    />
                  </div>
                  <span
                    class="w-12 text-right text-xs font-semibold tabular-nums text-muted-foreground"
                  >
                    {{ percentOf(item.totalUmkm, visibleTotal) }}
                  </span>
                </div>
              </td>

              <!-- Chevron -->
              <td class="px-3 py-2.5 text-right">
                <ChevronDown
                  class="ml-auto h-4 w-4 text-muted-foreground transition-transform"
                  :class="expandedCode === item.code ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
              </td>
            </tr>

            <!-- Baris detail yang mengembang -->
            <tr
              v-if="expandedCode === item.code"
              class="border-b border-border/60 bg-slate-50/50 last:border-b-0 dark:bg-slate-900/20"
            >
              <td colspan="7" class="px-3 py-3">
                <div
                  class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div class="min-w-0 flex-1">
                    <p
                      class="mb-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      Komposisi skala usaha
                    </p>
                    <div
                      class="flex h-2.5 w-full max-w-md overflow-hidden rounded-full bg-muted"
                      role="img"
                      :aria-label="`Komposisi skala: ${formatNumber(item.mikro)} mikro, ${formatNumber(item.kecil)} kecil, ${formatNumber(item.menengah)} menengah`"
                    >
                      <div
                        v-if="item.mikro"
                        class="bg-brand-green"
                        :style="{
                          width: `${segmentWidth(item.mikro, item.totalUmkm)}%`,
                        }"
                      />
                      <div
                        v-if="item.kecil"
                        class="bg-sky-500"
                        :style="{
                          width: `${segmentWidth(item.kecil, item.totalUmkm)}%`,
                        }"
                      />
                      <div
                        v-if="item.menengah"
                        class="bg-amber-400"
                        :style="{
                          width: `${segmentWidth(item.menengah, item.totalUmkm)}%`,
                        }"
                      />
                    </div>
                    <div
                      class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                    >
                      <span v-for="scale in scaleMeta" :key="scale.key">
                        <span
                          class="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                          :class="scale.color"
                          aria-hidden="true"
                        />
                        {{ scale.label }}:
                        <strong class="font-semibold text-foreground">
                          {{ formatNumber(item[scale.key as ScaleKey]) }}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center self-start rounded-md bg-brand-green px-4 py-1.5 text-xs font-semibold text-brand-green-foreground shadow-2xs transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                    @click.stop="emit('view:data', item)"
                  >
                    Lihat Data
                  </button>
                </div>

                <!-- Drill-down: kode KBLI dalam sektor ini (full width) -->
                <template v-if="codesFor(item.code).length">
                  <p
                    class="mb-1.5 mt-4 text-xs font-semibold text-muted-foreground"
                  >
                    Kode KBLI dalam sektor ini
                  </p>
                  <ul
                    class="max-h-64 space-y-0.5 divide-y divide-border/40 overflow-y-auto rounded-lg border border-border/60 bg-white dark:bg-card"
                    data-lenis-prevent-wheel
                  >
                    <li
                      v-for="code in codesFor(item.code)"
                      :key="code.code"
                      class="group flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-inset dark:hover:bg-slate-900/30"
                      role="button"
                      tabindex="0"
                      :title="`Lihat data untuk KBLI ${code.code}`"
                      @click="drillCode(code)"
                      @keydown.enter.prevent="drillCode(code)"
                      @keydown.space.prevent="drillCode(code)"
                    >
                      <span
                        class="w-14 shrink-0 font-semibold tabular-nums text-brand-green group-hover:underline"
                      >
                        {{ code.code }}
                      </span>
                      <span
                        class="flex shrink-0 flex-col items-start justify-center leading-tight tabular-nums"
                        :title="`Sub-kategori ${subKategoriOf(code.code).golongan} (golongan) · ${subKategoriOf(code.code).subGolongan} (sub-golongan)`"
                        aria-label="Sub-kategori dan sub-golongan KBLI"
                      >
                        <span class="text-xs font-semibold text-foreground">{{
                          subKategoriOf(code.code).golongan
                        }}</span>
                        <span class="text-[0.65rem] text-muted-foreground">{{
                          subKategoriOf(code.code).subGolongan
                        }}</span>
                      </span>
                      <span
                        class="min-w-0 flex-1 truncate text-muted-foreground"
                      >
                        <span
                          class="block truncate"
                          :title="code.title ?? undefined"
                        >
                          {{ code.title || "Kategori tidak dideskripsikan" }}
                        </span>
                        <span
                          v-if="kategoriBpsFor(code.code)"
                          class="block truncate text-[0.7rem] text-muted-foreground/80"
                          :title="`Kategori BPS resmi: ${kategoriBpsFor(code.code)}`"
                        >
                          {{ kategoriBpsFor(code.code) }}
                        </span>
                      </span>
                      <span
                        class="hidden shrink-0 gap-3 text-xs tabular-nums text-muted-foreground sm:flex"
                      >
                        <span class="w-14 text-right">{{
                          formatNumber(code.mikro)
                        }}</span>
                        <span class="w-14 text-right">{{
                          formatNumber(code.kecil)
                        }}</span>
                        <span class="w-14 text-right">{{
                          formatNumber(code.menengah)
                        }}</span>
                      </span>
                      <span
                        class="w-16 shrink-0 text-right font-bold tabular-nums text-foreground"
                      >
                        {{ formatNumber(code.totalUmkm) }}
                      </span>
                      <ArrowUpRight
                        class="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-green"
                        aria-hidden="true"
                      />
                    </li>
                  </ul>
                </template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
