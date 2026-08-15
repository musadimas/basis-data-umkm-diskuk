<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";

interface Props {
  title: string;
  description?: string;
  tooltipText?: string;
  cardClass?: string;
  headerClass?: string;
}

withDefaults(defineProps<Props>(), {
  description: "",
  tooltipText: "",
  cardClass: "",
  headerClass: "",
});
</script>

<template>
  <section
    class="rounded-lg border border-border/80 bg-white p-4 shadow-xs"
    :class="cardClass"
  >
    <!-- Header -->
    <div class="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-start" :class="headerClass">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-bold text-foreground sm:text-base">
            {{ title }}
          </h2>
          
          <!-- Tooltip trigger -->
          <UiTooltipProvider v-if="tooltipText">
            <UiTooltip>
              <UiTooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  :aria-label="`Informasi tentang ${title}`"
                >
                  <CircleHelp class="h-4 w-4" />
                </button>
              </UiTooltipTrigger>
              <UiTooltipContent class="max-w-xs text-xs font-normal">
                <p>{{ tooltipText }}</p>
              </UiTooltipContent>
            </UiTooltip>
          </UiTooltipProvider>
        </div>

        <p v-if="description" class="max-w-4xl text-xs font-normal leading-relaxed text-muted-foreground">
          {{ description }}
        </p>
      </div>

      <!-- Action slot (e.g. Filters, Export button) -->
      <div v-if="$slots.actions" class="shrink-0 pt-1">
        <slot name="actions" />
      </div>
    </div>

    <!-- Content Slot -->
    <div>
      <slot />
    </div>
  </section>
</template>
