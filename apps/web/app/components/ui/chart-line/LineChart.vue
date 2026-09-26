<script setup lang="ts">
// Grafik garis SVG ringan (tanpa WebGL) untuk tren target vs realisasi.
// Garis realisasi terputus pada minggu tanpa laporan disetujui (null).
// Tabel sr-only menyertakan data untuk aksesibilitas + assert Playwright.

const props = withDefaults(defineProps<{
  data: { x: number; [key: string]: number | null }[];
  series?: { key: string; label: string; color: string; dashed?: boolean; width?: number }[];
  xLabel?: string;
  yFormatter?: (value: number) => string;
}>(), {
  series: () => [],
  xLabel: "Minggu",
  yFormatter: (v: number) => String(v),
});

const W = 560;
const H = 220;
const PAD = { l: 56, r: 12, t: 12, b: 28 };

const maks = computed(() => {
  let m = 0;
  for (const row of props.data) {
    for (const s of props.series) {
      const v = row[s.key];
      if (typeof v === "number" && Number.isFinite(v)) m = Math.max(m, v);
    }
  }
  return m > 0 ? m : 1;
});

function px(i: number): number {
  const n = Math.max(1, props.data.length - 1);
  return PAD.l + (i / n) * (W - PAD.l - PAD.r);
}

function py(v: number): number {
  return PAD.t + (1 - v / maks.value) * (H - PAD.t - PAD.b);
}

function pathUntuk(key: string): string {
  let d = "";
  let mulai = true;
  props.data.forEach((row, i) => {
    const v = row[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      mulai = true;
      return;
    }
    d += `${mulai ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)} `;
    mulai = false;
  });
  return d.trim();
}
</script>

<template>
  <figure>
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" aria-label="Grafik garis target vs realisasi">
      <line :x1="PAD.l" :x2="PAD.l" :y1="PAD.t" :y2="H - PAD.b" stroke="#cbd5e1" />
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="H - PAD.b" :y2="H - PAD.b" stroke="#cbd5e1" />
      <g v-for="s in series" :key="s.key">
        <path :d="pathUntuk(s.key)" fill="none" :stroke="s.color" :stroke-width="s.width ?? 2" :stroke-dasharray="s.dashed ? '6,4' : undefined" />
      </g>
      <g v-for="(row, i) in data" :key="row.x">
        <text :x="px(i)" :y="H - 8" text-anchor="middle" font-size="10" fill="#64748b">{{ row.x }}</text>
      </g>
    </svg>
    <figcaption class="mt-2 flex flex-wrap gap-4 text-xs">
      <span v-for="s in series" :key="s.key" class="flex items-center gap-1.5">
        <span class="inline-block h-0.5 w-6" :style="{ background: s.color }" />
        {{ s.label }}
      </span>
    </figcaption>
    <table class="sr-only">
      <tbody>
        <tr v-for="row in data" :key="row.x">
          <td v-for="s in series" :key="s.key">{{ row[s.key] }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
