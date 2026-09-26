<script setup lang="ts">
/** The UMKM screens are designed for phones; on wider screens they render inside a device frame. */
</script>

<template>
  <div class="flex justify-center">
    <div
      class="w-full max-w-[26rem] overflow-hidden bg-background md:rounded-[2.5rem] md:border-8 md:border-slate-900 md:shadow-2xl"
      data-testid="phone-frame"
    >
      <div class="hidden h-6 items-center justify-center bg-slate-900 md:flex" aria-hidden="true">
        <span class="h-1.5 w-16 rounded-full bg-slate-700" />
      </div>
      <div class="md:max-h-[52rem] md:overflow-y-auto">
        <slot />
      </div>
    </div>
  </div>
</template>
