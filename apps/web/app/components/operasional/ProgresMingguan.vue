<script setup lang="ts">
import { formatTanggalKalender } from "~/lib/program-week";

const props = defineProps<{
  mingguBerjalan: number;
  jumlahMinggu: number | null;
  tanggalMulai?: string | null;
}>();

const segmen = computed(() => {
  const n = props.jumlahMinggu ?? 0;
  return Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);
});
</script>

<template>
  <div>
    <p v-if="(jumlahMinggu ?? 0) > 0" class="text-sm font-semibold">
      Minggu ke-{{ mingguBerjalan }} dari {{ jumlahMinggu }} Minggu Pendampingan
    </p>
    <p v-else-if="tanggalMulai" class="text-sm font-semibold">
      Program dimulai {{ formatTanggalKalender(tanggalMulai) }}
    </p>
    <div v-if="segmen.length > 0" class="mt-2 flex gap-1" aria-hidden="true">
      <span
        v-for="m in segmen"
        :key="m"
        class="h-2 flex-1 rounded-full"
        :class="m < mingguBerjalan ? 'bg-emerald-500' : m === mingguBerjalan ? 'bg-amber-400 ring-1 ring-amber-600' : 'bg-slate-200'"
      />
    </div>
  </div>
</template>
