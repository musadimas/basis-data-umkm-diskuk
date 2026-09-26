<script setup lang="ts">
import OperasionalTrenTargetRealisasi from "~/components/operasional/TrenTargetRealisasi.vue";
import { formatAnalyticsCurrency, formatAnalyticsPercent } from "~/lib/analytics-format";
import { laporanStatusLabel } from "~/constants/OPERASIONAL";
import type { BinaanDetail } from "~/types/operasional";

definePageMeta({
  layout: "dashboard",
});

const route = useRoute();
const talentaId = route.params.talentaId as string;
const detail = ref<BinaanDetail | null>(null);
const pesan = ref<string | null>(null);

async function muat() {
  const res = await $fetch<{ data: BinaanDetail }>(`/panel/operasional/binaan/${talentaId}`);
  detail.value = res.data;
}

onMounted(() => {
  void muat();
});

async function toggleRekomendasi(ev: Event) {
  const aktif = (ev.target as HTMLInputElement).checked;
  pesan.value = null;
  try {
    const res = await $fetch<{ data: BinaanDetail }>(`/panel/operasional/binaan/${talentaId}/rekomendasi`, {
      method: "POST",
      body: { aktif },
    });
    detail.value = res.data;
    pesan.value = aktif ? "Rekomendasi tersimpan." : "Rekomendasi dicabut.";
  } catch (error) {
    const msg = (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.[0]?.message;
    pesan.value = msg ?? "Gagal menyimpan rekomendasi.";
    await muat();
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 pb-8">
    <h1 class="text-2xl font-bold">Detail Binaan</h1>
    <section v-if="detail" class="space-y-4">
      <div class="rounded border bg-card p-4">
        <h2 class="font-bold">{{ detail.usaha.nama }}</h2>
        <p class="text-xs text-muted-foreground">{{ detail.pemilik }} — {{ detail.batch?.nama }} — {{ detail.status }}</p>
        <OperasionalProgresMingguan :minggu-berjalan="detail.mingguBerjalan" :jumlah-minggu="detail.jumlahMinggu" class="mt-2" />
      </div>

      <OperasionalTrenTargetRealisasi :tren="detail.tren" judul="Grafik Target KPI Mingguan vs Realisasi" />

      <div class="overflow-x-auto rounded border bg-card">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b text-left">
              <th class="p-2">Minggu</th>
              <th class="p-2">Omzet</th>
              <th class="p-2">Target</th>
              <th class="p-2">Capaian</th>
              <th class="p-2">Status</th>
              <th class="p-2">Catatan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in detail.laporan" :key="l.id" class="border-b">
              <td class="p-2">{{ l.mingguKe }}</td>
              <td class="p-2">{{ formatAnalyticsCurrency(l.omzet) }}</td>
              <td class="p-2">{{ l.target === null ? "—" : formatAnalyticsCurrency(l.target) }}</td>
              <td class="p-2">{{ l.capaianPersen === null ? "—" : formatAnalyticsPercent(l.capaianPersen) }}</td>
              <td class="p-2">{{ laporanStatusLabel(l.status) }}</td>
              <td class="p-2">{{ l.catatanPendamping ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section class="rounded border bg-card p-4">
        <h3 class="font-bold">Rekomendasi Kelayakan Pitching</h3>
        <p class="text-xs text-muted-foreground">Aktif setelah 4 pekan berturut-turut mencapai target.</p>
        <label class="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="detail.rekomendasiPitching"
            :disabled="!detail.layakRekomendasi && !detail.rekomendasiPitching"
            @change="toggleRekomendasi"
          >
          Rekomendasikan ke Talent Investment Day / Champion
        </label>
        <p v-if="pesan" role="status" class="mt-2 text-sm">{{ pesan }}</p>
      </section>
    </section>
  </div>
</template>
