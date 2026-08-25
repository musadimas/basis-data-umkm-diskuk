/*
 * Halaman Data Tabular UMKM.
 * Menampilkan data usaha dari Directus (endpoint `/panel/tabular/`) lewat
 * komponen `DashboardTabularData` (kartu skala, filter, paginasi & ekspor
 * server-side), karena jumlah baris mencapai jutaan (snapshot publik
 * `usaha_tabular` yang diterbitkan pasca-ingest SIDT).
 */
<script setup lang="ts">
import { Table } from "@lucide/vue";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Data Tabular UMKM – Dashboard Basis Data UMKM DisKUK Jawa Barat",
  description:
    "Tabel data UMKM Provinsi Jawa Barat dengan filter wilayah, skala usaha, kegiatan usaha, dan kode KBLI.",
});
</script>

<template>
  <div class="space-y-5 pb-8">
    <!-- Top Hero Banner (Data variant) -->
    <DashboardCardBanner
      variant="data"
      :icon="Table"
      title="Data Tabular UMKM"
      description="Telusuri data usaha mikro, kecil, dan menengah di Jawa Barat berdasarkan wilayah, skala usaha, serta klasifikasi KBLI. Gunakan filter untuk mempersempit data, lalu buka profil usaha atau unduh hasilnya sebagai CSV."
    />

    <!-- Kartu skala usaha + filter + tabel data (single fetch di dalam komponen) -->
    <DashboardTabularData show-scale-cards />
  </div>
</template>
