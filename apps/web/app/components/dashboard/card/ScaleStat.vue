<script setup lang="ts">
import type { ScaleCategory } from "~/types/dashboard";

interface Props {
  title: string;
  value: number | string;
  category?: ScaleCategory;
  buttonText?: string;
  buttonHref?: string;
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  category: "neutral",
  size: "md",
});

const emit = defineEmits<{
  (e: "click:action"): void;
}>();

const formattedValue = computed(() => {
  if (typeof props.value === "number") {
    return new Intl.NumberFormat("id-ID").format(props.value);
  }
  return props.value;
});

const variantClasses = computed(() => {
  switch (props.category) {
    case "mikro":
      return "bg-emerald-500 border-emerald-500 text-emerald-950";
    case "kecil":
      return "bg-sky-500 border-sky-500 text-sky-950";
    case "menengah":
      return "bg-amber-400 border-amber-400 text-amber-950";
    case "total":
      return "bg-transparent text-foreground";
    default:
      return "bg-white border-border text-foreground shadow-2xs dark:bg-card";
  }
});

const isFilledCategory = computed(() =>
  ["mikro", "kecil", "menengah"].includes(props.category),
);

const iconColorClasses = computed(() => {
  switch (props.category) {
    case "mikro":
      return "text-emerald-700 stroke-emerald-700 dark:text-emerald-400";
    case "kecil":
      return "text-blue-700 stroke-blue-700 dark:text-blue-400";
    case "menengah":
      return "text-orange-500 stroke-orange-500 dark:text-orange-400";
    default:
      return "text-emerald-600 stroke-emerald-600";
  }
});
</script>

<template>
  <UiCard
    class="flex-col justify-between gap-0 p-3 transition-all"
    :class="[
      variantClasses,
      category === 'total'
        ? 'rounded-none border-0 shadow-none hover:shadow-none'
        : 'rounded-xl border hover:shadow-sm',
      size === 'sm' ? 'min-h-37.5' : 'min-h-26.25',
    ]"
  >
    <!-- Icon and title -->
    <div
      class="flex"
      :class="
        category === 'total' ? 'items-center' : 'flex-col items-start gap-2'
      "
    >
      <!-- Icon based on category -->
      <div
        v-if="category === 'mikro'"
        class="shrink-0"
        :class="iconColorClasses"
      >
        <svg
          class="h-6 w-6 fill-none stroke-current stroke-[2.2]"
          viewBox="0 0 24 24"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="1.5" />
        </svg>
      </div>

      <div
        v-else-if="category === 'kecil'"
        class="shrink-0"
        :class="iconColorClasses"
      >
        <svg
          class="h-6 w-6 fill-none stroke-current stroke-[2.2]"
          viewBox="0 0 24 24"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 3h10l5 9-5 9H7l-5-9 5-9Z" />
        </svg>
      </div>

      <div
        v-else-if="category === 'menengah'"
        class="shrink-0"
        :class="iconColorClasses"
      >
        <svg
          class="h-6 w-6 fill-none stroke-current stroke-[2.2]"
          viewBox="0 0 24 24"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          />
        </svg>
      </div>

      <span
        class="text-base font-bold leading-none tracking-normal"
        :class="isFilledCategory ? 'text-white' : 'text-foreground/80'"
      >
        {{ title }}
      </span>
    </div>

    <!-- Bottom Row: Value + optional Button -->
    <div
      class="mt-3 flex gap-2"
      :class="
        category === 'total' ? 'flex-col items-start' : 'justify-end text-right'
      "
    >
      <div
        class="text-[36px] font-bold leading-none tracking-normal"
        :class="[
          isFilledCategory
            ? 'text-white'
            : category === 'total'
              ? 'text-emerald-700'
              : 'text-foreground',
        ]"
      >
        {{ formattedValue }}
      </div>

      <!-- Action Button for Total UMKM -->
      <div v-if="buttonText || category === 'total'" class="mt-1">
        <NuxtLink
          v-if="buttonHref"
          :to="buttonHref"
          class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-base font-bold leading-none text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span>{{ buttonText || "Lihat Data" }}</span>
        </NuxtLink>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-base font-bold leading-none text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          @click="emit('click:action')"
        >
          <span>{{ buttonText || "Lihat Data" }}</span>
        </button>
      </div>
    </div>
  </UiCard>
</template>
