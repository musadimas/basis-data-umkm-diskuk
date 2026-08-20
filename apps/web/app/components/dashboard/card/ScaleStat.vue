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

function isNumber(value: number | string): value is number {
  return typeof value === "number";
}

const formattedValue = computed(() => {
  if (isNumber(props.value)) {
    return new Intl.NumberFormat("id-ID").format(props.value);
  }
  return props.value;
});

const variantClasses = computed(() => {
  switch (props.category) {
    case "mikro":
      return "bg-brand-green border-brand-green text-brand-green-foreground";
    case "kecil":
      return "bg-sky-500 border-sky-500 text-brand-green-foreground";
    case "menengah":
      return "bg-amber-400 border-amber-400 text-brand-green-foreground";
    case "total":
      return "bg-transparent text-brand-green-foreground";
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
      return "text-brand-green-foreground stroke-brand-green-foreground";
    case "kecil":
      return "text-blue-700 stroke-blue-700 dark:text-blue-400";
    case "menengah":
      return "text-orange-500 stroke-orange-500 dark:text-orange-400";
    default:
      return "text-brand-green-foreground stroke-brand-green-foreground";
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
        : 'rounded-lg border hover:shadow-sm',
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
        :class="isFilledCategory || category === 'total' ? 'text-brand-green-foreground' : 'text-foreground/80'"
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
          isFilledCategory || category === 'total'
            ? 'text-brand-green-foreground'
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
          class="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-1.5 text-base font-bold leading-none text-brand-green-foreground shadow-2xs transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        >
          <span>{{ buttonText || "Lihat Data" }}</span>
        </NuxtLink>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-3 py-1.5 text-base font-bold leading-none text-brand-green-foreground shadow-2xs transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          @click="emit('click:action')"
        >
          <span>{{ buttonText || "Lihat Data" }}</span>
        </button>
      </div>
    </div>
  </UiCard>
</template>
