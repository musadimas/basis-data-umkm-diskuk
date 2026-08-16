<script setup lang="ts">
import type {
  ClusterItem,
  GenderDistributionData,
  KbliCategoryItem,
  ScaleStatItem,
  TopCategoryItem,
} from "~/types/dashboard";
import type { InfografisData } from "~/types/infografis";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Infografis UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Dashboard infografis statistik sebaran UMKM, skala usaha, kluster holding UMKM, dan klasifikasi KBLI Provinsi Jawa Barat.",
});

const { data, error } = await useFetch<{ data: InfografisData }>("/panel/infografis/");

const infografis = computed(() => data.value?.data);

const scaleItems = computed<ScaleStatItem[]>(() => {
  const scales = infografis.value?.scales;
  if (!scales) return [];

  return [
    { id: "total", title: "Total UMKM", value: scales.total, category: "total", buttonText: "Lihat Data", buttonHref: "/dashboard/tabular" },
    { id: "mikro", title: "Usaha Mikro", value: scales.mikro, category: "mikro" },
    { id: "kecil", title: "Usaha Kecil", value: scales.kecil, category: "kecil" },
    { id: "menengah", title: "Usaha Menengah", value: scales.menengah, category: "menengah" },
  ];
});

const topCategoryItems = computed<TopCategoryItem[]>(() =>
  (infografis.value?.topKbli ?? []).map(({ code, name, total }) => ({ code, name, value: total }))
);

const sectorItems = computed<ClusterItem[]>(() =>
  (infografis.value?.sectors ?? []).map(({ code, name, total, percentage }) => ({
    id: code,
    name,
    value: total,
    percentage,
  }))
);

const genderData = computed<GenderDistributionData | undefined>(() => {
  const workforce = infografis.value?.workforce;
  return workforce && {
    malePercentage: workforce.malePercentage,
    femalePercentage: workforce.femalePercentage,
    maleCount: workforce.male,
    femaleCount: workforce.female,
    totalWorkers: workforce.total,
  };
});

const kbliItems = computed<KbliCategoryItem[]>(() =>
  (infografis.value?.sectors ?? []).map((item) => ({
    code: item.code,
    title: item.name,
    description: "Sektor lapangan usaha berdasarkan KBLI.",
    totalUmkm: item.total,
    subItems: [
      { title: "Usaha Mikro", value: item.mikro, category: "mikro" },
      { title: "Usaha Kecil", value: item.kecil, category: "kecil" },
      { title: "Usaha Menengah", value: item.menengah, category: "menengah" },
    ],
  }))
);
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner -->
    <DashboardBanner
      title="Infografis UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      Data infografis belum dapat dimuat. Silakan coba lagi.
    </p>

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardSectionCard
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip-text="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
      card-class="p-3!"
      header-class="mb-3!"
    >
      <DashboardScaleStatsGrid :items="scaleItems" />
    </DashboardSectionCard>

    <!-- Section 2: Peta Sebaran Usaha Berdasarkan Wilayah -->
    <DashboardSectionCard
      title="Peta Sebaran Usaha Berdasarkan Wilayah"
      description="Menyajikan informasi sebaran jumlah UMKM berdasarkan wilayah."
      tooltip-text="Sebaran data spasial konsentrasi UMKM di 27 Kabupaten/Kota Jawa Barat"
    >
      <DashboardRegionalMapSection />
    </DashboardSectionCard>

    <!-- Section 3: Jumlah UMKM Berdasarkan Kategori Lapangan Usaha -->
    <DashboardSectionCard
      title="Jumlah UMKM Berdasarkan Kategori Lapangan Usaha"
      description="Dikelompokkan berdasarkan 21 kategori lapangan usaha dalam KBLI."
      tooltip-text="Kategori A–U berdasarkan Klasifikasi Baku Lapangan Usaha Indonesia (KBLI)"
    >
      <DashboardClusterBarChart :items="sectorItems" />
    </DashboardSectionCard>

    <!-- Row with 2 Columns: Top Categories & Gender Distribution -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- 5 Top Categories -->
      <DashboardSectionCard
        title="Lima Kategori Lapangan Usaha Teratas"
        description="Description"
        tooltip-text="5 Kategori KBLI dengan populasi usaha tertinggi"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardTopCategoriesChart :items="topCategoryItems" />
      </DashboardSectionCard>

      <!-- Gender Distribution -->
      <DashboardSectionCard
        title="Persentase Tenaga Kerja Berdasarkan Gender"
        description="Description"
        tooltip-text="Perbandingan demografi tenaga kerja UMKM"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardGenderDistributionChart :data="genderData" />
      </DashboardSectionCard>
    </div>

    <!-- Section 5: Category Accordion List -->
    <DashboardSectionCard
      title="Rincian UMKM Berdasarkan Kategori KBLI"
      description="Dikelompokkan berdasarkan huruf kategori KBLI dan diurutkan dari jumlah UMKM terbanyak."
      tooltip-text="Kategori A–U berdasarkan Klasifikasi Baku Lapangan Usaha Indonesia (KBLI)"
    >
      <DashboardKbliAccordionList :items="kbliItems" />
    </DashboardSectionCard>
  </div>
</template>
