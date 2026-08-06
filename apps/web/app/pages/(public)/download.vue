<script setup lang="ts">
definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  description: "Program UMKM Berdaya Saing Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat",
  ogTitle: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  ogDescription: "Program unggulan pemberdayaan UMKM Jawa Barat dengan pendampingan dan penguatan kapasitas usaha.",
  ogImage: "/images/og-cover.jpg",
  twitterCard: "summary_large_image",
});

const preloaderDone = ref(false);
</script>

<template>
  <LandingPreloader @done="preloaderDone = true" />
  <div class="h-dvh"></div>
</template>
