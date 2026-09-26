<script setup lang="ts">
const route = useRoute();
const compactAnalytics = computed(() => route.path === "/dashboard/analitik");
// Peta spasial tampil full-bleed: tanpa padding inset agar peta menyentuh tepi viewport.
const fullBleed = computed(() => route.path === "/dashboard/spasial");
onMounted(() => document.documentElement.classList.add("no-scrollbar"));
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <UiSidebarProvider
    :class="
      compactAnalytics || fullBleed
        ? 'md:h-svh md:min-h-0 md:overflow-hidden'
        : undefined
    "
  >
    <NavAppSidebar />
    <UiSidebarInset class="dashboard-surface">
      <NavProfileHeader />
      <div class="flex min-h-0 flex-1 flex-col gap-4" :class="fullBleed ? '' : 'p-4'">
        <slot />
      </div>
    </UiSidebarInset>
  </UiSidebarProvider>
</template>
