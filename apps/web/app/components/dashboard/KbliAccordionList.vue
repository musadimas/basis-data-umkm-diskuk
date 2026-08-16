<script setup lang="ts">
import type { KbliCategoryItem } from "~/types/dashboard";
import { Search } from "@lucide/vue";

interface Props {
  items?: KbliCategoryItem[];
  defaultOpenCode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpenCode: "I",
  items: () => [
    {
      code: "G",
      title: "Perdagangan Besar dan Eceran; Reparasi dan Perawatan Mobil dan Sepeda Motor",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan perdagangan besar dan eceran berbagai jenis barang, serta jasa reparasi dan perawatan kendaraan bermotor.",
      totalUmkm: "9.999.999",
    },
    {
      code: "I",
      title: "Penyediaan Akomodasi dan Penyediaan Makan dan Minum",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan penyediaan layanan penginapan dan penyediaan makanan dan minuman untuk konsumsi langsung.",
      totalUmkm: "9.999.999",
      isExpandedDefault: true,
      subItems: [
        { title: "Title", value: "9.999.999", category: "mikro" },
        { title: "Title", value: "9.999.999", category: "kecil" },
        { title: "Title", value: "9.999.999", category: "menengah" },
      ],
    },
    {
      code: "C",
      title: "Industri Pengolahan",
      description:
        "Kategori ini meliputi kegiatan ekonomi/lapangan usaha di bidang perubahan secara kimia atau fisik dari bahan, unsur atau komponen menjadi produk baru. Bahan baku industri pengolahan berasal dari produk pertanian, kehutanan, perikanan, pertambangan atau penggalian seperti produk dari kegiatan industri pengolahan lainnya. Perubahan, pembaharuan atau rekonstruksi yang pokok dari barang secara umum diperlakukan sebagai industri pengolahan.",
      totalUmkm: "9.999.999",
    },
    {
      code: "S",
      title: "Aktivitas Jasa Lainnya",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang tidak termasuk dalam kategori lainnya, seperti jasa perorangan, jasa rumah tangga, dan jasa lainnya yang mendukung kegiatan ekonomi.",
      totalUmkm: "9.999.999",
    },
    {
      code: "H",
      title: "Pengangkutan dan Pergudangan",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan transportasi penumpang dan barang melalui darat, laut, udara, serta jasa pergudangan dan penyimpanan barang.",
      totalUmkm: "9.999.999",
    },
    {
      code: "J",
      title: "Informasi dan Komunikasi",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan produksi dan distribusi informasi dan komunikasi, termasuk penerbitan, penyiaran, telekomunikasi, dan teknologi informasi.",
      totalUmkm: "9.999.999",
    },
    {
      code: "F",
      title: "Konstruksi",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan pembangunan, perbaikan, dan pemeliharaan bangunan dan infrastruktur, termasuk gedung, jalan, jembatan, dan fasilitas lainnya.",
      totalUmkm: "9.999.999",
    },
    {
      code: "N",
      title:
        "Aktivitas Penyewaan dan Sewa Guna Usaha Tanpa Hak Opsi, Ketenagakerjaan, Agen Perjalanan dan Penunjang Usaha Lainnya",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan penyewaan barang tanpa hak opsi, jasa ketenagakerjaan, agen perjalanan, dan layanan penunjang usaha lainnya.",
      totalUmkm: "9.999.999",
    },
    {
      code: "E",
      title:
        "Pengelolaan Air, Pengelolaan Air Limbah, Pengelolaan dan Daur Ulang Sampah dan Aktivitas Remediasi",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berhubungan dengan pengelolaan air. Kategori ini juga mencakup pengelolaan berbagai bentuk limbah dan sampah, seperti limbah dan sampah padat atau bukan yang berasal dari rumah tangga dan industri, yang dapat mencemari lingkungan. Hasil dari proses pengolahan limbah dan sampah dapat dibuang atau menjadi input dalam proses produksi lainnya.",
      totalUmkm: "9.999.999",
    },
    {
      code: "L",
      title: "Real Estat",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan kepemilikan, penyewaan, dan pengelolaan properti real estat, baik yang dimiliki sendiri maupun disewa.",
      totalUmkm: "9.999.999",
    },
    {
      code: "R",
      title: "Kesenian, Hiburan dan Rekreasi",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan produksi dan penyelenggaraan kesenian, hiburan, dan rekreasi, termasuk pertunjukan seni, bioskop, dan taman rekreasi.",
      totalUmkm: "9.999.999",
    },
    {
      code: "Q",
      title: "Aktivitas Kesehatan Manusia dan Aktivitas Sosial",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan pelayanan kesehatan manusia dan aktivitas sosial, termasuk rumah sakit, klinik, dan layanan sosial lainnya.",
      totalUmkm: "9.999.999",
    },
    {
      code: "P",
      title: "Pendidikan",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan penyelenggaraan pendidikan formal dan non-formal di berbagai jenjang dan bidang studi.",
      totalUmkm: "9.999.999",
    },
    {
      code: "M",
      title: "Aktivitas Profesional, Ilmiah dan Teknis",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan jasa profesional, ilmiah, dan teknis, termasuk layanan hukum, akuntansi, arsitektur, teknik, penelitian dan pengembangan.",
      totalUmkm: "9.999.999",
    },
    {
      code: "D",
      title: "Pengadaan Listrik, Gas, Uap/Air Panas dan Udara Dingin",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha pengadaan tenaga listrik, gas alam, uap panas, air panas dan sejenisnya melalui jaringan, saluran atau pipa infrastruktur permanen. Dimensi jaringan/infrastruktur tidak dapat ditentukan dengan pasti, termasuk kegiatan pendistribusian listrik, gas, uap panas dan air panas serta sejenisnya dalam lokasi pabrik atau bangunan tempat tinggal.",
      totalUmkm: "9.999.999",
    },
    {
      code: "K",
      title: "Aktivitas Keuangan dan Asuransi",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha yang berkaitan dengan jasa keuangan, perbankan, asuransi, dana pensiun, dan lembaga keuangan lainnya.",
      totalUmkm: "9.999.999",
    },
    {
      code: "B",
      title: "Pertambangan dan Penggalian",
      description:
        "Kategori ini mencakup kegiatan ekonomi/lapangan usaha pengambilan mineral dalam bentuk alami, yaitu padat (batu bara dan bijih logam), cair (minyak bumi) atau gas (gas alam). Kegiatan ini dapat dilakukan dengan metode yang berbeda seperti pertambangan dan penggalian di permukaan tanah atau dibawah tanah, pengoperasian sumur pertambangan, penambangan di dasar laut dan lain-lain.",
      totalUmkm: "9.999.999",
    },
  ],
});

const searchQuery = ref("");
const openCodes = ref<Set<string>>(new Set([props.defaultOpenCode]));

const toggleItem = (code: string) => {
  if (openCodes.value.has(code)) {
    openCodes.value.delete(code);
  } else {
    openCodes.value.add(code);
  }
};

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return props.items;
  const q = searchQuery.value.toLowerCase().trim();
  return props.items.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  );
});

const handleSearch = () => {
  // Filters reactively via computed
};
</script>

<template>
  <div class="space-y-4">
    <!-- Search Bar Form -->
    <form
      class="flex items-center gap-2 rounded-xl border border-border/80 bg-white p-1.5 shadow-2xs dark:bg-card"
      @submit.prevent="handleSearch"
    >
      <div class="relative flex flex-1 items-center pl-3">
        <Search class="h-4 w-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Huruf atau nama kategori KBLI"
          class="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <button
        type="submit"
        class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>Cari</span>
      </button>
    </form>

    <!-- Empty search result state -->
    <div
      v-if="filteredItems.length === 0"
      class="rounded-xl border border-dashed border-border p-8 text-center"
    >
      <p class="text-sm font-semibold text-muted-foreground">
        Tidak ditemukan kategori KBLI yang cocok dengan "{{ searchQuery }}"
      </p>
    </div>

    <!-- Accordion Items List -->
    <div v-else class="space-y-3">
      <DashboardKbliAccordionItem
        v-for="item in filteredItems"
        :key="item.code"
        :item="item"
        :is-open="openCodes.has(item.code)"
        @toggle="toggleItem(item.code)"
      />
    </div>
  </div>
</template>
