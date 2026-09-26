<script setup lang="ts">
import { TALENTA_ASPEK_LABELS } from "~/constants/OPERASIONAL";
import type { TalentIndexHasil } from "~/types/operasional";

const props = withDefaults(defineProps<{
  hasil: TalentIndexHasil;
  animated?: boolean;
}>(), { animated: true });

const aspek = computed(() => [
  { label: TALENTA_ASPEK_LABELS[0], nilai: props.hasil.finansial },
  { label: TALENTA_ASPEK_LABELS[1], nilai: props.hasil.pasar },
  { label: TALENTA_ASPEK_LABELS[2], nilai: props.hasil.legalitas },
  { label: TALENTA_ASPEK_LABELS[3], nilai: props.hasil.sdm },
]);

// Animasi count-up 800 ms murni menggambarkan kalkulasi server yang selesai.
// Hasil yang ditampilkan selalu nilai persisted dari API, bukan hitungan klien.
const tampil = ref(props.animated ? 0 : props.hasil.total);
let raf = 0;
const prefersReduced = import.meta.client
  && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

watch(() => props.hasil.total, (total) => {
  cancelAnimationFrame(raf);
  if (!props.animated || prefersReduced || !import.meta.client) {
    tampil.value = total;
    return;
  }
  const mulai = performance.now();
  const dari = 0;
  const langkah = (waktu: number) => {
    const p = Math.min(1, (waktu - mulai) / 800);
    tampil.value = Math.round((dari + (total - dari) * p) * 100) / 100;
    if (p < 1) raf = requestAnimationFrame(langkah);
  };
  raf = requestAnimationFrame(langkah);
}, { immediate: true });

onUnmounted(() => cancelAnimationFrame(raf));

const format2 = (v: number) => v.toFixed(2);
</script>

<template>
  <section aria-label="Hasil Talent Index" class="space-y-3 rounded-lg border bg-card p-4">
    <div v-for="a in aspek" :key="a.label" class="space-y-1">
      <div class="flex items-center justify-between text-xs font-medium">
        <span>{{ a.label }}</span>
        <span>{{ format2(a.nilai) }} / 25.00</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" :aria-valuenow="a.nilai" aria-valuemin="0" aria-valuemax="25" :aria-label="a.label">
        <div class="h-full rounded-full bg-brand-green transition-[width]" :style="{ width: `${Math.min(100, (a.nilai / 25) * 100)}%` }" />
      </div>
    </div>
    <p class="text-sm font-bold" role="status">
      Talent Index Score: {{ format2(tampil) }} / 100.00
      <span class="font-medium">(Status: {{ hasil.rekomendasi }})</span>
    </p>
  </section>
</template>
