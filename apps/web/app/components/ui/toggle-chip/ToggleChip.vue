<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

/**
 * Chip alih (toggle) dengan `aria-pressed` — pengganti pola tombol chip yang
 * dikopi di banyak halaman (katalog, konsultasi, klinik, outcome form).
 */
const props = withDefaults(
  defineProps<{
    pressed?: boolean
    variant?: "primary" | "muted" | "danger"
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { pressed: false, variant: "primary" },
)
const emit = defineEmits<{ (e: "toggle"): void }>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="pressed"
    data-slot="toggle-chip"
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? variant === 'danger'
            ? 'border-red-300 bg-red-100 font-semibold text-red-900'
            : variant === 'muted'
              ? 'border-border bg-muted font-semibold text-foreground'
              : 'border-primary bg-primary text-primary-foreground'
          : 'hover:bg-muted',
        props.class,
      )
    "
    @click="emit('toggle')"
  >
    <slot />
  </button>
</template>
