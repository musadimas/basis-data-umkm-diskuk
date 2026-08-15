<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Infografis UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Dashboard infografis statistik sebaran UMKM, skala usaha, kluster holding UMKM, dan klasifikasi KBLI Provinsi Jawa Barat.",
});
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner -->
    <DashboardBanner
      title="Infografis UMKM"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent dictum tortor eu dictum pulvinar. Fusce pulvinar enim ac dui luctus, ac tempus nisl vestibulum. Sed sit amet ante sit amet sapien dictum ultrices quis at augue. Nulla pharetra ex dictum, venenatis nunc a, tempor lectus."
    />

    <!-- Section 1: Jumlah Usaha Berdasarkan Skala Usaha -->
    <DashboardSectionCard
      title="Jumlah Usaha Berdasarkan Skala Usaha"
      description="Berdasarkan kriteria penjualan tahunan sebagaimana dimaksud dalam Pasal 35 ayat (5) Peraturan Pemerintah Nomor 7 Tahun 2021 tentang Kemudahan, Pelindungan, dan Pemberdayaan Koperasi serta UMKM."
      tooltip-text="Klasifikasi skala usaha berdasarkan kriteria omzet & aset sesuai PP No. 7 Tahun 2021"
      card-class="p-3!"
      header-class="mb-3!"
    >
      <DashboardScaleStatsGrid />
    </DashboardSectionCard>

    <!-- Section 2: Peta Sebaran Usaha Berdasarkan Wilayah -->
    <DashboardSectionCard
      title="Peta Sebaran Usaha Berdasarkan Wilayah"
      description="Menyajikan informasi sebaran jumlah UMKM berdasarkan wilayah."
      tooltip-text="Sebaran data spasial konsentrasi UMKM di 27 Kabupaten/Kota Jawa Barat"
    >
      <DashboardRegionalMapSection />
    </DashboardSectionCard>

    <!-- Section 3: Jumlah UMKM Berdasarkan Kluster UMKM -->
    <DashboardSectionCard
      title="Jumlah UMKM Berdasarkan Kluster UMKM"
      description="Kluster UMKM ini merupakan bagian dari program Holding UMKM, sebagai salah satu strategi inovasi Kementeri UMKM dalam rangka meningkatkan kapasitas Pengusaha UMKM."
      tooltip-text="Kluster Holding UMKM dari Kementerian Koperasi dan UKM RI"
    >
      <DashboardClusterBarChart />
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
        <DashboardTopCategoriesChart />
      </DashboardSectionCard>

      <!-- Gender Distribution -->
      <DashboardSectionCard
        title="Persentase Tenaga Kerja Berdasarkan Gender"
        description="Description"
        tooltip-text="Perbandingan demografi tenaga kerja UMKM"
        card-class="flex flex-col justify-between h-full"
      >
        <DashboardGenderDistributionChart />
      </DashboardSectionCard>
    </div>

    <!-- Section 5: KBLI Accordion List -->
    <DashboardSectionCard
      title="Title"
      description="Description"
      tooltip-text="Daftar Klasifikasi Baku Lapangan Usaha Indonesia (KBLI) per kategori"
    >
      <DashboardKbliAccordionList />
    </DashboardSectionCard>
  </div>
</template>
