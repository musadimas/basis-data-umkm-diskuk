<script setup lang="ts">
onMounted(() => document.documentElement.classList.add("no-scrollbar"));
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <div class="h-fit">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-99999 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none">
      Lewati ke konten utama
    </a>
    <LandingNav />
    <main id="main-content">
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>
