<script setup lang="ts">
onMounted(() => document.documentElement.classList.add("no-scrollbar"));
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <NavHeader />
  <UiSidebarProvider>
    <NavAppSidebar />
    <UiSidebarInset>
      <div class="flex flex-1 flex-col gap-4 p-4">
        <slot />
      </div>
    </UiSidebarInset>
  </UiSidebarProvider>
</template>
