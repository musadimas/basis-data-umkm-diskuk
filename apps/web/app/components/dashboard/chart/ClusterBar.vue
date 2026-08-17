<script setup lang="ts">
import type { ClusterItem } from "~/types/dashboard";

interface Props {
  items: ClusterItem[];
}

defineProps<Props>();

const getWidthClass = (pct?: number) => {
  if (!pct) return "w-1/12";
  if (pct >= 90) return "w-11/12";
  if (pct >= 80) return "w-5/6";
  if (pct >= 70) return "w-3/4";
  if (pct >= 60) return "w-2/3";
  if (pct >= 50) return "w-1/2";
  if (pct >= 40) return "w-5/12";
  if (pct >= 30) return "w-1/3";
  if (pct >= 20) return "w-1/4";
  if (pct >= 10) return "w-1/6";
  return "w-1/12";
};
</script>

<template>
  <div class="w-full overflow-x-auto">
    <table class="w-full text-left text-sm" role="table">
      <thead>
        <tr class="border-b border-border/80 text-xs font-bold text-foreground/90">
          <th scope="col" class="pb-3 pr-4 font-bold sm:w-1/3">
            Kategori
          </th>
          <th scope="col" class="pb-3 text-left font-bold sm:w-2/3">
            Jumlah UMKM
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border/40">
        <tr
          v-for="item in items"
          :key="item.id"
          class="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
        >
          <!-- Category Name -->
          <td class="py-1.5 pr-4 text-xs font-semibold text-foreground/90 sm:text-sm">
            {{ item.name }}
          </td>

          <!-- Bar and Formatted Count -->
          <td class="py-1.5">
            <div class="flex items-center gap-3">
              <div class="relative h-3 flex-1 overflow-hidden rounded-full bg-transparent">
                <!-- Bar Fill -->
                <div
                  class="h-full rounded-full bg-emerald-600 transition-all duration-500 hover:bg-emerald-500"
                  :class="getWidthClass(item.percentage)"
                />
              </div>
              <span class="w-16 shrink-0 text-right text-xs font-bold text-foreground sm:w-20 sm:text-sm">
                {{ item.formattedValue || new Intl.NumberFormat('id-ID').format(item.value) }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
