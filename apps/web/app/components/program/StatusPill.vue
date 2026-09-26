<script setup lang="ts">
defineProps<{ meta: { label: string; className: string } | undefined }>();
</script>

<template>
  <span
    v-if="meta"
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
    :class="meta.className"
  >{{ meta.label }}</span>
</template>
