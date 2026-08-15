<script setup lang="ts">
onMounted(() => document.documentElement.classList.add("no-scrollbar"));
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <div class="min-h-screen bg-slate-50/70 dark:bg-background text-foreground flex flex-col">
    <!-- Accessibility Skip Link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:outline-none"
    >
      Lewati ke konten utama
    </a>

    <!-- Top Navigation Header -->
    <DashboardHeader />

    <!-- Main Container: Sidebar + Content -->
    <div class="w-full flex-1 px-2 py-3 xl:px-4">
      <div class="flex flex-col gap-6 md:flex-row md:items-start md:gap-4 xl:gap-8">
        <!-- Sidebar Navigation -->
        <DashboardSidebar />

        <!-- Main Page Content -->
        <main id="main-content" class="min-w-0 flex-1">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
