<script setup lang="ts">
import {
  TransitionPresets,
  useIntersectionObserver,
  useTransition,
} from "@vueuse/core";

definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  description:
    "Program UMKM Berdaya Saing Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat",
  ogTitle: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  ogDescription:
    "Program unggulan pemberdayaan UMKM Jawa Barat dengan pendampingan dan penguatan kapasitas usaha.",
  ogImage: "/images/og-cover.jpg",
  twitterCard: "summary_large_image",
});

const preloaderDone = ref(false);

interface IconPath {
  d: string;
  opacity?: string;
  fillRule?: "evenodd" | "nonzero";
  clipRule?: "evenodd" | "nonzero";
}

interface StatSplit {
  id: string;
  target: number;
  format?: (n: number) => string;
  label: string;
}

interface StatCard {
  bg: string;
  title: string;
  titleClass?: string;
  icon: IconPath[];
  id?: string;
  target?: number;
  format?: (n: number) => string;
  splits?: StatSplit[];
}

const percent = (n: number) => `${Math.round(n)}%`;
const thousands = (n: number) => Math.round(n).toLocaleString("id-ID");

const cards: StatCard[] = [
  {
    bg: "bg-green-500",
    title: "Total UMKM",
    titleClass: "text-black",
    icon: [
      {
        d: "M17.4659 1.75C18.1014 1.74998 18.6428 1.74995 19.0862 1.80238C19.5603 1.85843 19.9974 1.9811 20.3931 2.27649C20.7867 2.57024 21.0328 2.95546 21.2305 3.39554C21.4172 3.811 21.5873 4.33952 21.789 4.96638L22.4853 7.12954L22.5002 7.17604C22.6763 7.72227 22.8175 8.16018 22.7141 8.82232C22.6713 9.09674 22.6166 9.32192 22.5239 9.53046C22.4367 9.72661 22.328 9.87688 22.2446 9.99204L22.2323 10.0092C21.2481 11.3718 19.4436 12.25 17.7543 12.25C16.6746 12.25 15.6772 11.8933 14.8766 11.2923C14.0759 11.8937 13.0789 12.25 11.9989 12.25C10.9195 12.25 9.92238 11.8935 9.12194 11.2928C8.32127 11.8939 7.32456 12.25 6.24489 12.25C4.55562 12.25 2.75108 11.3718 1.76692 10.0092L1.75455 9.99206C1.67123 9.8769 1.56251 9.72662 1.4753 9.53046C1.38259 9.32192 1.32789 9.09674 1.28506 8.82231C1.18173 8.16018 1.32288 7.72227 1.49895 7.17603L1.51393 7.12954L2.19765 5.0053L2.21018 4.9664L2.21018 4.96639C2.41192 4.33952 2.58202 3.811 2.76865 3.39554C2.96634 2.95546 3.2125 2.57024 3.60604 2.27649C4.00177 1.9811 4.43892 1.85843 4.91299 1.80238C5.35639 1.74995 5.89776 1.74998 6.53326 1.75H6.53329H17.4659H17.4659Z",
        opacity: "0.4",
      },
      {
        d: "M6 17.5C6 16.9477 6.44772 16.5 7 16.5H11C11.5523 16.5 12 16.9477 12 17.5C12 18.0523 11.5523 18.5 11 18.5H7C6.44772 18.5 6 18.0523 6 17.5Z",
        fillRule: "evenodd",
        clipRule: "evenodd",
      },
      {
        d: "M2 10.3056L2 15.3209C1.99997 16.675 1.99994 17.7917 2.11876 18.6754C2.2435 19.6032 2.51547 20.4227 3.17158 21.0788C3.82769 21.7349 4.64711 22.0068 5.57494 22.1316C6.4587 22.2504 7.57531 22.2504 8.92943 22.2503H15.0706C16.4247 22.2504 17.5413 22.2504 18.4251 22.1316C19.3529 22.0068 20.1723 21.7349 20.8284 21.0788C21.4845 20.4227 21.7565 19.6032 21.8813 18.6754C22.0001 17.7916 22 16.675 22 15.3209V10.3047C21.4718 10.923 20.7707 11.4231 20 11.7613V15.2503C20 16.6928 19.9979 17.6741 19.8991 18.4089C19.8042 19.115 19.6368 19.442 19.4142 19.6645C19.1916 19.8871 18.8646 20.0545 18.1586 20.1494C17.4238 20.2482 16.4425 20.2503 15 20.2503H9C7.55752 20.2503 6.57626 20.2482 5.84144 20.1494C5.13538 20.0545 4.80836 19.8871 4.58579 19.6645C4.36322 19.442 4.19585 19.115 4.10092 18.4089C4.00213 17.6741 4 16.6928 4 15.2503V11.7617C3.22942 11.4236 2.52831 10.9238 2 10.3056Z",
      },
    ],
    id: "total-umkm",
    target: 13064,
    format: thousands,
  },
  {
    bg: "bg-yellow-400",
    title: "Jenis Usaha",
    icon: [
      {
        d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
        opacity: "0.4",
      },
      {
        d: "M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z",
      },
      {
        d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
        opacity: "0.6",
      },
    ],
    splits: [
      {
        id: "jenis-usaha-produksi",
        target: 97,
        format: percent,
        label: "Produksi",
      },
      {
        id: "jenis-usaha-reseller",
        target: 3,
        format: percent,
        label: "Reseller",
      },
    ],
  },
  {
    bg: "bg-blue-500",
    title: "Rata-rata Omzet",
    icon: [
      {
        d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
        opacity: "0.4",
      },
      {
        d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.89s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z",
      },
    ],
    id: "rata-rata-omzet",
    target: 495,
    format: (n) => `Rp. ${n.toFixed(1)}jt`,
  },
  {
    bg: "bg-green-500",
    title: "UMKM Siap Ekspor",
    icon: [
      {
        d: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
        opacity: "0.4",
      },
      {
        d: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
      },
    ],
    id: "umkm-siap-ekspor",
    target: 6,
    format: percent,
  },
  {
    bg: "bg-yellow-400",
    title: "Persentase Penjualan",
    icon: [
      {
        d: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
        opacity: "0.4",
      },
      { d: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
    ],
    splits: [
      {
        id: "penjualan-offline",
        target: 68,
        format: percent,
        label: "Offline",
      },
      { id: "penjualan-online", target: 32, format: percent, label: "Online" },
    ],
  },
  {
    bg: "bg-blue-500",
    title: "Total Tenaga Kerja",
    icon: [
      {
        d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
        opacity: "0.4",
      },
      {
        d: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
      },
    ],
    id: "total-tenaga-kerja",
    target: 64133,
    format: thousands,
  },
  {
    bg: "bg-green-500",
    title: "Modal Usaha",
    titleClass: "text-black",
    icon: [
      {
        d: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
        opacity: "0.4",
      },
      {
        d: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
      },
    ],
    splits: [
      { id: "modal-sendiri", target: 90, format: percent, label: "Sendiri" },
      { id: "modal-luar", target: 14, format: percent, label: "Luar" },
    ],
  },
  {
    bg: "bg-yellow-400",
    title: "Legalitas",
    icon: [
      {
        d: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
        opacity: "0.4",
      },
      {
        d: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
      },
    ],
    splits: [
      { id: "legalitas-siup", target: 100, format: percent, label: "SIUP" },
      { id: "legalitas-npwp", target: 100, format: percent, label: "NPWP" },
    ],
  },
];

const started = ref(false);
const statsGridRef = ref<HTMLElement | null>(null);

const { stop } = useIntersectionObserver(
  statsGridRef,
  ([entry]) => {
    if (entry?.isIntersecting) {
      started.value = true;
      stop();
    }
  },
  { threshold: 0.3 },
);

function animate(target: number) {
  return useTransition(
    computed(() => (started.value ? target : 0)),
    { duration: 1500, transition: TransitionPresets.easeOutExpo },
  );
}

const statCards = reactive(
  cards.map((card) => ({
    ...card,
    animated: card.target !== undefined ? animate(card.target) : undefined,
    splits: card.splits?.map((split) => ({
      ...split,
      animated: animate(split.target),
    })),
  })),
);

// Type aliases (not interfaces) satisfy the charts' Record<string, unknown>
// constraint without an unknown-valued dictionary on every row.
type ChartRow = {
  label: string;
  value: number;
};

interface ChartCardConfig {
  title: string;
  type: "bar" | "donut";
  orientation?: "horizontal" | "vertical";
  data: ChartRow[];
  height: string;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showLegend: boolean;
  colSpan: "full" | "half";
}

const UMKM_CHART_COLORS = [
  "#0F3B5F", // dark navy
  "#0873BD", // sky/brand blue
  "#FBBF24", // amber/brand amber
  "#16A75C", // brand green
  "#F97316", // orange
];

const kategoriUsahaData: ChartRow[] = [
  { label: "Makanan", value: 6140 },
  { label: "Kuliner", value: 2040 },
  { label: "Craft", value: 1343 },
  { label: "Fashion", value: 1298 },
  { label: "Minuman", value: 850 },
  { label: "Jasa", value: 354 },
  { label: "Industri", value: 270 },
  { label: "Agribisnis", value: 220 },
  { label: "Konveksi", value: 215 },
  { label: "Obat-obatan", value: 38 },
  { label: "Lainnya", value: 13 },
];

// Institution/legal-entity labels are a placeholder pending real category names.
const kelembagaanData: ChartRow[] = [
  { label: "Perorangan", value: 7031 },
  { label: "CV", value: 2709 },
  { label: "PT", value: 1820 },
  { label: "Koperasi", value: 1236 },
  { label: "Lainnya", value: 254 },
];

const CHART_CATEGORIES: Extract<keyof ChartRow, string>[] = ["value"];

type GenderRow = {
  gender: string;
  tetap: number;
  tidakTetap: number;
};

const tenagaKerjaGenderData: GenderRow[] = [
  { gender: "Laki-laki", tetap: 21989, tidakTetap: 9692 },
  { gender: "Perempuan", tetap: 22650, tidakTetap: 9802 },
];

const GENDER_SERIES: { key: keyof GenderRow; label: string; color: string }[] = [
  { key: "tetap", label: "Tetap", color: "#38BDF8" },
  { key: "tidakTetap", label: "Tidak Tetap", color: "#EC4899" },
];

const chartCards: ChartCardConfig[] = [
  {
    title: "Jumlah UMKM Berdasarkan Kategori Usaha",
    type: "bar",
    orientation: "vertical",
    data: kategoriUsahaData,
    height: "h-[340px]",
    showXAxis: true,
    showYAxis: false,
    showLegend: false,
    colSpan: "full",
  },
  {
    title: "Jumlah UMKM Berdasarkan Kelembagaan",
    type: "donut",
    data: kelembagaanData,
    height: "h-72",
    showLegend: true,
    colSpan: "half",
  },
];

// Wilayah pemasaran only has a handful of buckets — a donut reads better than a
// bar here, unlike the long-tail category lists below.
const wilayahPemasaranData: ChartRow[] = [
  { label: "Lokal", value: 12564 },
  { label: "Regional", value: 4282 },
  { label: "Nasional", value: 686 },
];

// Freetext entries from the source data ("-", "BELUM", "TIDAK ADA", "NIHIL",
// duplicate "MALAYSIA"/"SINGAPURA" rows, duplicate "LAINNYA" rows) are grouped
// into single clean categories here rather than left as separate rows.
const negaraEksporData: ChartRow[] = [
  // { label: "Belum Ekspor", value: 20 },
  { label: "Asia", value: 26 },
  { label: "Asia Tenggara", value: 17 },
  { label: "Timur Tengah", value: 12 },
  { label: "Amerika Serikat", value: 7 },
  { label: "Eropa", value: 5 },
  { label: "Australia", value: 5 },
];

// "BANK"/"KUR BRI"/"BRI" merged into one bank-financing bucket; "SENDIRI" merged
// into "Modal Sendiri"; the "LAINNYA"/"LAINYA" typo duplicate merged into one.
const sumberPembiayaanData: ChartRow[] = [
  { label: "Bank (termasuk KUR)", value: 1000 },
  { label: "Modal Sendiri", value: 700 },
  { label: "Investor", value: 200 },
  { label: "Koperasi", value: 300 },
  { label: "Lainnya", value: 500 },
];

// A handful of clean buckets after merging the freetext one-off entries
// ("ADA, DARI PELATIHAN...", "KOPERASI RIMBA...", "ADA", "BLT KODIM", etc.)
// into "Lainnya" — few enough categories that a donut fits better than a bar.
const dukunganBumdData: ChartRow[] = [
  { label: "BJB", value: 30 },
  { label: "Lainnya", value: 9 },
  { label: "Jamkrida", value: 3 },
  { label: "Bank Patriot", value: 2 },
];

const kinerjaChartCards: ChartCardConfig[] = [
  {
    title: "Jumlah UMKM Berdasarkan Wilayah Pemasaran",
    type: "donut",
    data: wilayahPemasaranData,
    height: "h-72",
    showLegend: true,
    colSpan: "half",
  },
  {
    title: "Jumlah UMKM Berdasarkan Negara Tujuan Ekspor",
    type: "bar",
    orientation: "horizontal",
    data: negaraEksporData,
    height: "h-[340px]",
    showXAxis: false,
    showYAxis: true,
    showLegend: false,
    colSpan: "half",
  },
  {
    title: "Jumlah UMKM Berdasarkan Sumber Pembiayaan",
    type: "bar",
    orientation: "horizontal",
    data: sumberPembiayaanData,
    height: "h-72",
    showXAxis: false,
    showYAxis: true,
    showLegend: false,
    colSpan: "half",
  },
  {
    title: "Jumlah UMKM Berdasarkan Dukungan BUMD",
    type: "donut",
    data: dukunganBumdData,
    height: "h-72",
    showLegend: true,
    colSpan: "half",
  },
];
</script>

<template>
  <LandingPreloader class="overflow-hidden" @done="preloaderDone = true" />
  <div class="min-h-dvh">
    <LandingHeaderMask
      title="Ringkasan"
      subtitle="Dashboard UMKM"
      badge-color="#cbd5e1"
    />
    <section id="page-content">
      <div class="py-20">
        <div class="max-w-7xl mx-auto px-3 | 2xl:px-0">
          <div
            ref="statsGridRef"
            class="grid gap-3 | lg:grid-cols-12 lg:gap-4 mb-5"
          >
            <div
              v-for="card in statCards"
              :key="card.title"
              class="grid-item col-span-full | md:col-span-6 | lg:col-span-3"
            >
              <div
                :class="[
                  card.bg,
                  'aspect-video flex flex-col justify-between rounded-xl p-4 | lg:p-6',
                ]"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="icon icon-fill text-3xl text-black"
                    style="width: 30px; height: 30px"
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        v-for="(path, index) in card.icon"
                        :key="index"
                        :d="path.d"
                        :opacity="path.opacity"
                        :fill-rule="path.fillRule"
                        :clip-rule="path.clipRule"
                        fill="#141B34"
                      />
                    </svg>
                  </div>
                  <h6
                    :class="[
                      'uppercase text-[11px] tracking-wide leading-none w-min font-bold',
                      card.titleClass,
                    ]"
                  >
                    {{ card.title }}
                  </h6>
                </div>

                <h3
                  v-if="card.animated !== undefined"
                  :id="card.id"
                  class="leading-none self-end text-black text-5xl font-black"
                >
                  {{ card.format ? card.format(card.animated) : card.animated }}
                </h3>

                <div v-else class="flex flex-col gap-2 self-end w-full">
                  <div class="flex items-end justify-end gap-6">
                    <h3
                      v-for="split in card.splits"
                      :key="split.id"
                      class="leading-none text-center text-black"
                    >
                      <span :id="split.id" class="block text-4xl font-black">{{
                        split.format
                          ? split.format(split.animated)
                          : split.animated
                      }}</span>
                      <span
                        class="text-[11px] leading-none font-bold text-black"
                        >{{ split.label }}</span
                      >
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-1 gap-4 | lg:mt-6 lg:grid-cols-2">
            <UiCard
              v-for="chart in chartCards"
              :key="chart.title"
              :class="[
                'gap-3 border drop-shadow rounded-xl border-transparent p-5 shadow-sm sm:p-6',
                chart.colSpan === 'full' ? 'lg:col-span-2' : '',
              ]"
            >
              <UiCardHeader class="gap-1 px-0">
                <p
                  class="text-[11px] font-bold uppercase tracking-wide text-primary"
                >
                  Data
                </p>
                <UiCardTitle
                  class="text-sm font-bold leading-snug text-foreground sm:text-base"
                >
                  {{ chart.title }}
                </UiCardTitle>
              </UiCardHeader>
              <UiCardContent class="px-0 pt-5">
                <UiBarChart
                  v-if="chart.type === 'bar'"
                  :class="chart.height"
                  :orientation="chart.orientation"
                  :data="chart.data"
                  :categories="CHART_CATEGORIES"
                  index="label"
                  :colors="UMKM_CHART_COLORS"
                  :show-x-axis="chart.showXAxis"
                  :show-y-axis="chart.showYAxis"
                  :show-legend="chart.showLegend"
                  :value-formatter="(v: number) => v.toLocaleString('id-ID')"
                />
                <UiDonutChart
                  v-else
                  :class="chart.height"
                  :data="chart.data"
                  category="value"
                  index="label"
                  :colors="UMKM_CHART_COLORS"
                  central-sub-label="Total Kelembagaan"
                  :value-formatter="(v: number) => v.toLocaleString('id-ID')"
                />
                <ul
                  v-if="chart.type === 'donut' && chart.showLegend"
                  class="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1"
                >
                  <li
                    v-for="(row, i) in chart.data"
                    :key="row.label"
                    class="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      class="size-2 rounded-full"
                      :style="{
                        background:
                          UMKM_CHART_COLORS[i % UMKM_CHART_COLORS.length],
                      }"
                    />
                    {{ row.label }}
                  </li>
                </ul>
              </UiCardContent>
            </UiCard>

            <UiCard
              class="border drop-shadow gap-3 rounded-xl border-transparent p-5 shadow-sm sm:p-6"
            >
              <UiCardHeader class="gap-1 px-0">
                <p
                  class="text-[11px] font-bold uppercase tracking-wide text-primary"
                >
                  Data
                </p>
                <UiCardTitle
                  class="text-sm font-bold leading-snug text-foreground sm:text-base"
                >
                  Jumlah Tenaga Kerja Tetap / Tidak Tetap Berdasarkan Gender
                </UiCardTitle>
              </UiCardHeader>
              <UiCardContent class="px-0 pt-5">
                <UiGroupedBarChart
                  class="h-auto"
                  :data="tenagaKerjaGenderData"
                  index="gender"
                  :series="GENDER_SERIES"
                  :value-formatter="(v: number) => v.toLocaleString('id-ID')"
                />
              </UiCardContent>
            </UiCard>
          </div>

          <h2 class="mt-10 text-xl font-bold text-foreground | lg:mt-12">
            Kinerja dan Kesiapan Daya Saing UMKM
          </h2>
          <div class="mt-5 grid grid-cols-1 gap-4 | lg:mt-6 lg:grid-cols-2">
            <UiCard
              v-for="chart in kinerjaChartCards"
              :key="chart.title"
              :class="[
                'border drop-shadow gap-3 rounded-xl border-transparent p-5 shadow-sm sm:p-6',
                chart.colSpan === 'full' ? 'lg:col-span-2' : '',
              ]"
            >
              <UiCardHeader class="gap-1 px-0">
                <p
                  class="text-[11px] font-bold uppercase tracking-wide text-primary"
                >
                  Data
                </p>
                <UiCardTitle
                  class="text-sm font-bold leading-snug text-foreground sm:text-base"
                >
                  {{ chart.title }}
                </UiCardTitle>
              </UiCardHeader>
              <UiCardContent class="px-0 pt-5">
                <UiBarChart
                  v-if="chart.type === 'bar'"
                  :class="chart.height"
                  :orientation="chart.orientation"
                  :data="chart.data"
                  :categories="CHART_CATEGORIES"
                  index="label"
                  :colors="UMKM_CHART_COLORS"
                  :show-x-axis="chart.showXAxis"
                  :show-y-axis="chart.showYAxis"
                  :show-legend="chart.showLegend"
                  :value-formatter="(v: number) => v.toLocaleString('id-ID')"
                />
                <UiDonutChart
                  v-else
                  :class="chart.height"
                  :data="chart.data"
                  category="value"
                  index="label"
                  :colors="UMKM_CHART_COLORS"
                  :value-formatter="(v: number) => v.toLocaleString('id-ID')"
                />
                <ul
                  v-if="chart.type === 'donut' && chart.showLegend"
                  class="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1"
                >
                  <li
                    v-for="(row, i) in chart.data"
                    :key="row.label"
                    class="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      class="size-2 rounded-full"
                      :style="{
                        background:
                          UMKM_CHART_COLORS[i % UMKM_CHART_COLORS.length],
                      }"
                    />
                    {{ row.label }}
                  </li>
                </ul>
              </UiCardContent>
            </UiCard>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
