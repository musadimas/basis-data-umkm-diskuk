<script setup lang="ts">
onMounted(() => {
  document.documentElement.classList.add("no-scrollbar");
  useLenis().scrollTo(0, { immediate: true });
});
onUnmounted(() => document.documentElement.classList.remove("no-scrollbar"));
</script>

<template>
  <div class="h-fit no-scrollbar">
    <LandingNav />
    <main id="main-content">
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>
