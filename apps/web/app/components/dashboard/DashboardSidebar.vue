<script setup lang="ts">
import { ChartColumnDecreasing, Table, MapPinned } from "@lucide/vue";

interface SidebarItem {
  id: string;
  label: string;
  to: string;
  icon: any;
}

const items: SidebarItem[] = [
  {
    id: "infografis",
    label: "Infografis UMKM",
    to: "/dashboard",
    icon: ChartColumnDecreasing,
  },
  {
    id: "tabular",
    label: "Data Tabular UMKM",
    to: "/dashboard/tabular",
    icon: Table,
  },
  {
    id: "spasial",
    label: "Peta Spasial UMKM",
    to: "/dashboard/spasial",
    icon: MapPinned,
  },
];

const route = useRoute();

const isItemActive = (to: string) => {
  if (to === "/dashboard") {
    return route.path === "/dashboard" || route.path === "/dashboard/";
  }
  return route.path.startsWith(to);
};
</script>

<template>
  <aside
    class="w-full shrink-0 self-stretch bg-white dark:bg-card md:w-48 xl:w-64"
    aria-label="Navigasi Menu Dashboard"
  >
    <div class="sticky top-20">
      <div class="mb-2 px-1 py-1 text-xs font-medium text-muted-foreground">
        Dashboard
      </div>

      <nav class="flex flex-col gap-0.5" aria-label="Menu Dashboard">
        <NuxtLink
          v-for="item in items"
          :key="item.id"
          :to="item.to"
          class="group flex items-center gap-2 rounded-md px-1 py-2 text-xs font-medium transition-colors"
          :class="[
            isItemActive(item.to)
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:text-foreground',
          ]"
        >
          <component
            :is="item.icon"
            class="h-4 w-4 shrink-0 transition-colors"
            :class="[
              isItemActive(item.to)
                ? 'text-emerald-600 dark:text-emerald-400 stroke-[2.5]'
                : 'text-muted-foreground group-hover:text-foreground',
            ]"
          />
          <span class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </div>
  </aside>
</template>
