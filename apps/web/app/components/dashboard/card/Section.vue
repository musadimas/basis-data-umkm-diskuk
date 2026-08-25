<script setup lang="ts">
import { CircleHelp } from "@lucide/vue";

interface Props {
  title: string;
  description?: string;
  tooltip?: string;
  cardClass?: string;
  headerClass?: string;
  contentClass?: string;
}

withDefaults(defineProps<Props>(), {
  description: "",
  tooltip: "",
  cardClass: "",
  headerClass: "",
  contentClass: "",
});
</script>

<template>
  <UiCard class="gap-4 rounded-lg p-4 shadow-xs" :class="cardClass">
    <UiCardHeader class="px-0" :class="headerClass">
      <UiCardTitle
        class="flex items-center gap-2 text-sm font-bold sm:text-base"
      >
        {{ title }}

        <!-- Tooltip trigger -->
        <UiTooltipProvider v-if="tooltip">
          <UiTooltip>
            <UiTooltipTrigger as-child>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                :aria-label="`Informasi tentang ${title}`"
              >
                <CircleHelp class="h-4 w-4" />
              </button>
            </UiTooltipTrigger>
            <UiTooltipContent
              class="text-justify max-w-2xs text-xs font-normal"
            >
              <p>{{ tooltip }}</p>
            </UiTooltipContent>
          </UiTooltip>
        </UiTooltipProvider>
      </UiCardTitle>

      <UiCardDescription
        v-if="description"
        class="text-justify text-xs font-normal leading-relaxed"
      >
        {{ description }}
      </UiCardDescription>

      <!-- Action slot (e.g. Filters, Export button) -->
      <UiCardAction v-if="$slots.actions">
        <slot name="actions" />
      </UiCardAction>
    </UiCardHeader>

    <!-- Content Slot -->
    <UiCardContent class="px-0" :class="contentClass">
      <slot />
    </UiCardContent>
  </UiCard>
</template>
