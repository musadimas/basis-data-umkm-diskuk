<script setup lang="ts">
import type { ScaleStatItem } from "~/types/dashboard";

interface Props {
  items?: ScaleStatItem[];
}

withDefaults(defineProps<Props>(), {
  items: () => [
    {
      id: "total",
      title: "Total UMKM",
      value: "9.999.999",
      category: "total",
      buttonText: "Lihat Data",
      buttonHref: "/dashboard#data-tabular",
    },
    {
      id: "mikro",
      title: "Usaha Mikro",
      value: "9.999.999",
      category: "mikro",
    },
    {
      id: "kecil",
      title: "Usaha Kecil",
      value: "9.999.999",
      category: "kecil",
    },
    {
      id: "menengah",
      title: "Usaha Menengah",
      value: "9.999.999",
      category: "menengah",
    },
  ],
});
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <DashboardCardScaleStat
      v-for="item in items"
      :key="item.id"
      :title="item.title"
      :value="item.value"
      :category="item.category"
      :button-text="item.buttonText"
      :button-href="item.buttonHref"
    />
  </div>
</template>
