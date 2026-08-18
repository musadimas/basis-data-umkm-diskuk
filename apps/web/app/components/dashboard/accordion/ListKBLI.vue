<script setup lang="ts">
import type { KbliCategoryItem } from "~/types/dashboard";
import { Search } from "@lucide/vue";

interface Props {
  items: KbliCategoryItem[];
  defaultOpenCode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpenCode: "I",
});

const searchQuery = ref("");
const openCodes = ref<Set<string>>(new Set([props.defaultOpenCode]));

const toggleItem = (code: string) => {
  if (openCodes.value.has(code)) {
    openCodes.value.delete(code);
  } else {
    openCodes.value.add(code);
  }
};

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return props.items;
  const q = searchQuery.value.toLowerCase().trim();
  return props.items.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
});

const handleSearch = () => {
  // Filters reactively via computed
};
</script>

<template>
  <div class="space-y-4">
    <!-- Search Bar Form -->
    <form
      class="flex items-center gap-2 rounded-xl border border-border/80 bg-white p-1.5 shadow-2xs dark:bg-card"
      @submit.prevent="handleSearch"
    >
      <div class="relative flex flex-1 items-center pl-3">
        <Search class="h-4 w-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Huruf atau nama kategori KBLI"
          class="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        >
      </div>
      <button
        type="submit"
        class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>Cari</span>
      </button>
    </form>

    <!-- Empty search result state -->
    <div
      v-if="filteredItems.length === 0"
      class="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <p class="text-sm font-semibold text-muted-foreground">
        Tidak ditemukan kategori KBLI yang cocok dengan "{{ searchQuery }}"
      </p>
    </div>

    <!-- Accordion Items List -->
    <div v-else class="space-y-3">
      <DashboardAccordionItemKBLI
        v-for="item in filteredItems"
        :key="item.code"
        :item="item"
        :is-open="openCodes.has(item.code)"
        @toggle="toggleItem(item.code)"
      />
    </div>
  </div>
</template>
