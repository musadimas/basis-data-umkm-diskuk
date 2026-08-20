<script setup lang="ts">
import type { AnalyticsGroup } from "~/types/analytics"
import { formatAnalyticsNumber, formatAnalyticsPercent } from "~/lib/analytics-format"

const props = defineProps<{ groups: AnalyticsGroup[]; coverage?: number; unknownShare?: number }>()
const emit = defineEmits<{ evidence: [] }>()
const leader = computed(() => props.groups[0])
const lowCoverage = computed(() => typeof props.coverage === "number" && props.coverage < 95)
</script>

<template>
  <aside class="shrink-0 rounded-md border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5 text-[11px]" aria-labelledby="insight-title">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h2 id="insight-title" class="text-[10px] font-bold uppercase tracking-wide text-emerald-900">Insight terukur</h2>
      <p v-if="leader" class="min-w-0 flex-1">
        Share tertinggi pada filter ini: <strong>{{ leader.label }}</strong> — {{ formatAnalyticsNumber(leader.value) }} UMKM
        ({{ formatAnalyticsPercent(leader.share) }} dari total terfilter).
      </p>
      <p v-else class="min-w-0 flex-1">Belum ada kelompok pada filter ini.</p>
      <button type="button" class="shrink-0 font-semibold underline" @click="emit('evidence')">Lihat bukti</button>
    </div>
    <p v-if="lowCoverage" class="mt-1 text-amber-900">
      Peringatan cakupan: {{ formatAnalyticsPercent(coverage) }} record terpetakan<span v-if="unknownShare">, {{ formatAnalyticsPercent(unknownShare) }} masuk kelompok unknown</span>.
    </p>
    <details class="mt-0.5">
      <summary class="cursor-pointer text-muted-foreground">Formula dan batasan</summary>
      <p class="mt-0.5 text-muted-foreground">
        COUNT DISTINCT usaha.id; persentase memakai denominator total hasil filter. Bukan kesimpulan sebab-akibat.
      </p>
    </details>
  </aside>
</template>
