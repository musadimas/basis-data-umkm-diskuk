<script setup lang="ts">
const route = useRoute();
const compactAnalytics = computed(() => route.path === "/dashboard/analitik");
onMounted(() => document.documentElement.classList.add("no-scrollbar"));
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <UiSidebarProvider :class="compactAnalytics ? 'md:h-svh md:min-h-0 md:overflow-hidden' : undefined">
    <NavAppSidebar />
    <UiSidebarInset class="dashboard-surface">
      <div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <slot />
      </div>
    </UiSidebarInset>
  </UiSidebarProvider>
</template>
