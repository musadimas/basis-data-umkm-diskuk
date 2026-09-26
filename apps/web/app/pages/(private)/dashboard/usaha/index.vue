<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";
import { useKoneksi } from "~/composables/useKoneksi";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { talentaStatusLabel } from "~/constants/OPERASIONAL";
import type { UsahaSaya, LaporanSaya } from "~/types/operasional";

definePageMeta({
  layout: "umkm",
});

useSeoMeta({
  title: "Beranda Usaha – Dashboard UMKM DisKUK Jawa Barat",
});

const auth = useAuth();
const { tandaiSukses, tandaiGagalJaringan } = useKoneksi();
const data = ref<UsahaSaya | null>(null);
const riwayat = ref<LaporanSaya[]>([]);
const galat = ref<string | null>(null);

async function muat() {
  galat.value = null;
  try {
    const res = await $fetch<{ data: UsahaSaya }>("/panel/operasional/usaha-saya");
    data.value = res.data;
    tandaiSukses();
    if (import.meta.client) {
      try {
        localStorage.setItem("diskuk:usaha-saya", JSON.stringify(res.data));
      } catch {
        /* storage penuh: abaikan cache */
      }
    }
  } catch (error) {
    const e = error as { data?: unknown };
    if (e?.data === undefined) {
      tandaiGagalJaringan();
      if (import.meta.client) {
        try {
          const cache = localStorage.getItem("diskuk:usaha-saya");
          if (cache) data.value = JSON.parse(cache) as UsahaSaya;
        } catch {
          /* abaikan */
        }
      }
      galat.value = "Tidak dapat menjangkau server. Menampilkan data terakhir di perangkat.";
    } else {
      galat.value = "Gagal memuat profil usaha.";
    }
  }
  try {
    const lap = await $fetch<{ data: LaporanSaya[] }>("/panel/operasional/laporan-saya");
    riwayat.value = lap.data;
  } catch {
    /* riwayat opsional saat offline */
  }
}

onMounted(() => {
  void muat();
});

const talenta = computed(() => data.value?.talenta ?? null);
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-xl border border-border/80 bg-card p-5">
      <h1 class="text-xl font-bold tracking-tight text-foreground">Beranda Usaha</h1>
      <p class="mt-3 text-sm font-semibold text-foreground">
        {{ data?.usaha?.nama || auth.user.value?.instansi || "Usaha Anda" }}
      </p>
      <p v-if="data?.pemilik?.nama" class="mt-1 text-xs text-muted-foreground">
        Pengusaha {{ data.pemilik.nama }}
      </p>
      <p v-if="data?.usaha?.nib" class="mt-1 text-xs text-muted-foreground">
        NIB {{ data.usaha.nib }}
      </p>
      <p v-if="talenta?.batch" class="mt-2 text-xs">
        <span class="font-semibold">Fase {{ talentaStatusLabel(talenta.status) }} — {{ talenta.batch.nama }}</span>
      </p>
      <p v-if="talenta?.pendamping" class="mt-1 text-xs text-muted-foreground">
        Pendamping: {{ talenta.pendamping.nama }}
      </p>
      <OperasionalProgresMingguan
        v-if="talenta?.batch"
        class="mt-3"
        :minggu-berjalan="talenta.mingguBerjalan"
        :jumlah-minggu="talenta.batch.jumlahMinggu"
        :tanggal-mulai="talenta.batch.tanggalMulai"
      />
    </section>

    <p v-if="galat" role="status" class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      {{ galat }}
    </p>

    <section v-if="talenta" class="rounded-xl border border-border/80 bg-card p-5">
      <h2 class="text-sm font-bold">Target KPI Minggu Ini</h2>
      <p class="mt-1 text-lg font-bold">
        {{ talenta.targetMingguan === null ? "Target belum tersedia" : formatAnalyticsCurrency(talenta.targetMingguan) }}
      </p>
      <p v-if="talenta.laporanMingguIni" class="mt-1 text-xs text-muted-foreground">
        Status minggu ini: {{ talenta.laporanMingguIni.status }}
      </p>
      <NuxtLink
        v-else
        to="/dashboard/usaha/laporan"
        class="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Kirim Laporan Minggu Ini
      </NuxtLink>
    </section>
    <section v-else class="rounded-xl border border-border/80 bg-card p-5">
      <p class="text-sm text-muted-foreground">
        Usaha Anda belum terdaftar pada Program Akselerasi Accelerator.
      </p>
    </section>

    <section v-if="riwayat.length > 0" class="rounded-xl border border-border/80 bg-card p-5">
      <h2 class="text-sm font-bold">Riwayat Laporan</h2>
      <ul class="mt-2 space-y-1 text-xs">
        <li v-for="l in riwayat" :key="l.id">
          Minggu {{ l.mingguKe }} — {{ formatAnalyticsCurrency(l.omzet) }} — {{ l.status }}
        </li>
      </ul>
    </section>
  </div>
</template>
