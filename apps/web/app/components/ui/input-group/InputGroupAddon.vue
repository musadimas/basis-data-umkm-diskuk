<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { InputGroupVariants } from "."
import { cn } from "@/lib/utils"
import { inputGroupAddonVariants } from "."

const props = withDefaults(defineProps<{
  align?: InputGroupVariants["align"]
  class?: HTMLAttributes["class"]
}>(), {
  align: "inline-start",
})

function handleInputGroupAddonClick(e: MouseEvent) {
  // SAFETY: this handler is bound to the addon's root <div>, so currentTarget is always an HTMLElement (or null).
  const currentTarget = e.currentTarget as HTMLElement | null
  // SAFETY: clicks originate from DOM elements inside the addon, so target is an HTMLElement (or null).
  const target = e.target as HTMLElement | null
  if (target && target.closest("button")) {
    return
  }
  if (currentTarget && currentTarget?.parentElement) {
    currentTarget.parentElement?.querySelector("input")?.focus()
  }
}
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="handleInputGroupAddonClick"
  >
    <slot />
  </div>
</template>
