import {
  ChartColumnDecreasing,
  Map,
  Table,
} from "@lucide/vue";

export const NAVIGATION_LINKS = {
  dashboard: [
    {
      id: "infografis",
      label: "Infografis UMKM",
      to: "/dashboard",
      icon: ChartColumnDecreasing,
    },
    {
      id: "analitik",
      label: "Analitik",
      to: "/dashboard/analitik",
      icon: ChartColumnDecreasing,
    },
    {
      id: "tabular",
      label: "Data Tabular UMKM",
      to: "/dashboard/tabular",
      icon: Table,
    },
    {
      id: "spasial",
      label: "Peta Spasial UMKM",
      to: "/dashboard/spasial",
      icon: Map,
    },
  ],
};
