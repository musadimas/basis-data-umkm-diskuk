<script setup lang="ts">
import TrenTargetRealisasi from "~/components/operasional/TrenTargetRealisasi.vue";
import type { TrenMinggu } from "~/types/operasional";

defineProps<{ tren: TrenMinggu[] }>();
</script>

<template>
  <TrenTargetRealisasi :tren="tren" judul="Grafik Target KPI Mingguan vs Realisasi" />
</template>
