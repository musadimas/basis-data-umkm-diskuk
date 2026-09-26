<script setup lang="ts">
import { PLACEHOLDER_RUBRIK, SKOR_DIMENSI } from "~/constants";
import type { TalentSkor } from "~/types/program";

defineProps<{ skor: TalentSkor }>();
const format = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
</script>

<template>
  <div class="grid gap-4">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-xs text-muted-foreground">Talent Index</p>
        <p class="text-4xl font-bold tabular-nums" data-testid="skor-total">{{ format(skor.total) }}</p>
      </div>
      <p class="text-right text-xs text-muted-foreground">Bobot 25% per dimensi</p>
    </div>
    <ul class="grid gap-3">
      <li v-for="dim in SKOR_DIMENSI" :key="dim.key" class="grid gap-1">
        <div class="flex justify-between text-sm">
          <span>{{ dim.label }}</span>
          <span class="font-semibold tabular-nums">{{ format(skor[dim.key]) }}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
          <div class="h-full rounded-full bg-primary transition-[width] duration-700" :style="{ width: `${skor[dim.key]}%` }" />
        </div>
      </li>
    </ul>
    <p v-if="skor.rubrikVersi === PLACEHOLDER_RUBRIK" class="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
      Skor dihitung dengan rubrik sementara. Rubrik resmi dari DISKUK belum tersedia, jadi skor ini belum dapat dipakai sebagai dasar keputusan.
    </p>
  </div>
</template>
