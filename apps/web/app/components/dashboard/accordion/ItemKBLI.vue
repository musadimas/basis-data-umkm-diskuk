<script setup lang="ts">
import type { KbliCategoryItem } from "~/types/dashboard";
import { ChevronDown, ChevronUp } from "@lucide/vue";

interface Props {
  item: KbliCategoryItem;
  isOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
});

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "view:data", item: KbliCategoryItem): void;
}>();

const formattedTotal = computed(() => {
  if (typeof props.item.totalUmkm === "number") {
    return new Intl.NumberFormat("id-ID").format(props.item.totalUmkm);
  }
  return props.item.totalUmkm;
});

const defaultSubItems = computed(() => {
  return (
    props.item.subItems || [
      { title: "Title", value: "9.999.999", category: "mikro" as const },
      { title: "Title", value: "9.999.999", category: "kecil" as const },
      { title: "Title", value: "9.999.999", category: "menengah" as const },
    ]
  );
});
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-border/80 bg-white transition-all hover:border-slate-300 dark:bg-card"
  >
    <!-- Accordion Header Button -->
    <button
      type="button"
      class="flex min-h-45 w-full items-start justify-between gap-4 p-4 text-left sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      :aria-expanded="isOpen"
      @click="emit('toggle')"
    >
      <div class="flex items-start gap-4 sm:gap-5">
        <!-- Big Letter Badge -->
        <div
          class="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-extrabold text-2xl sm:text-3xl text-slate-700 select-none dark:bg-slate-800 dark:text-slate-200"
        >
          {{ item.code }}
        </div>

        <!-- Title & Description -->
        <div class="space-y-1 pr-2">
          <h3 class="text-sm font-bold text-foreground sm:text-base">
            {{ item.title }}
          </h3>
          <p
            class="max-w-3xl text-xs leading-relaxed text-muted-foreground font-normal sm:text-sm line-clamp-2 sm:line-clamp-none"
          >
            {{ item.description }}
          </p>
        </div>
      </div>

      <!-- Right Column: Total UMKM & Chevron -->
      <div
        class="flex shrink-0 items-center gap-3 sm:gap-4 self-center sm:self-start"
      >
        <div class="text-right">
          <div
            class="text-[10px] sm:text-xs font-semibold text-muted-foreground"
          >
            Total UMKM
          </div>
          <div
            class="text-base sm:text-xl font-extrabold text-emerald-700 tracking-tight"
          >
            {{ formattedTotal }}
          </div>
        </div>

        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <ChevronUp v-if="isOpen" class="h-5 w-5 stroke-[2.5]" />
          <ChevronDown v-else class="h-5 w-5 stroke-[2.5]" />
        </div>
      </div>
    </button>

    <!-- Expanded Body Content -->
    <div
      v-if="isOpen"
      class="border-t border-border/60 bg-slate-50/40 p-4 sm:p-6 dark:bg-slate-900/30 transition-all"
    >
      <div
        class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <!-- 3 Sub Scale Cards -->
        <div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <DashboardCardScaleStat
            v-for="(sub, idx) in defaultSubItems"
            :key="idx"
            :title="sub.title"
            :value="sub.value"
            :category="sub.category"
            size="sm"
          />
        </div>

        <!-- Right Side: Total + Action Button -->
        <div
          class="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40"
        >
          <div class="text-left lg:text-right">
            <div
              class="text-[10px] sm:text-xs font-semibold text-muted-foreground"
            >
              Total UMKM
            </div>
            <div
              class="text-lg sm:text-2xl font-extrabold text-emerald-700 tracking-tight"
            >
              {{ formattedTotal }}
            </div>
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            @click="emit('view:data', item)"
          >
            <span>Lihat Data</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
