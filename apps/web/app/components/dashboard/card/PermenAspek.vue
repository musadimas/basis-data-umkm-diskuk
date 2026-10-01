<script setup lang="ts">
import type { AspekPerkembangan } from "~/types/operasional";

defineProps<{ data: AspekPerkembangan | null; pending?: boolean; error?: boolean }>();
const active = ref("legalitas");
</script>

<template>
  <section class="rounded-xl border bg-card p-5" aria-label="Indikator perkembangan usaha">
    <div class="mb-4">
      <h2 class="text-lg font-bold">Lima aspek perkembangan usaha</h2>
      <p class="text-sm text-muted-foreground">Indikator data operasional, bukan skor resmi atau penilaian kepatuhan regulasi.</p>
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">Indikator belum dapat dimuat.</p>
    <p v-else-if="pending && !data" role="status" class="text-sm text-muted-foreground">Memuat indikator…</p>
    <template v-else-if="data">
      <p class="mb-3 text-xs text-muted-foreground">{{ data.totalUsaha.toLocaleString('id-ID') }} usaha dalam filter wilayah · {{ data.definisiVersi }}</p>
      <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Aspek perkembangan usaha">
        <button
          v-for="aspek in data.aspek"
          :key="aspek.id"
          type="button"
          role="tab"
          :aria-selected="active === aspek.id"
          :class="active === aspek.id ? 'bg-primary text-primary-foreground' : 'border bg-background'"
          class="rounded-lg px-3 py-2 text-xs font-semibold"
          @click="active = aspek.id"
        >{{ aspek.label }}</button>
      </div>
      <div v-for="aspek in data.aspek" v-show="active === aspek.id" :key="aspek.id" role="tabpanel" class="grid gap-3 md:grid-cols-3">
        <div v-for="item in aspek.indikator" :key="item.id" class="rounded-lg border p-4">
          <h3 class="text-sm font-semibold">{{ item.label }}</h3>
          <p class="mt-2 text-2xl font-bold">{{ item.persentase === null ? '—' : `${item.persentase}%` }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ item.ya.toLocaleString('id-ID') }} ya · {{ item.tidak.toLocaleString('id-ID') }} tidak · {{ item.belumAdaData.toLocaleString('id-ID') }} belum ada data dari {{ item.total.toLocaleString('id-ID') }} UMKM</p>
          <p class="mt-2 text-[11px] text-muted-foreground">Sumber: {{ item.sumber }}</p>
        </div>
      </div>
      <p class="mt-4 text-xs text-muted-foreground">Persentase = jumlah “ya” ÷ seluruh UMKM dalam filter wilayah. Data kosong dihitung sebagai “belum ada data”, bukan “tidak”. Field ya/tidak belum membuktikan dokumen verifikatif yang disyaratkan untuk penilaian resmi. {{ data.sumber }}.</p>
      <a class="mt-2 inline-block text-xs text-primary underline" href="https://jdih.umkm.go.id/doc/detail/kdaGwXzTbbXQnHCu4fNxvWoUg8_eQQDh3hRUoD9-tj8qjKHI89VYeSW0ITaDbHP-" target="_blank" rel="noopener noreferrer">Rujukan: Permen UMKM Nomor 2 Tahun 2026</a>
    </template>
  </section>
</template>
