import {
  ChartColumnDecreasing,
  Download,
  Info,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  Store,
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
      icon: MapPinned,
    },
  ],
  website: [
    {
      id: "tentang-program",
      label: "Tentang Program",
      to: "/tentang-program",
      icon: Info,
    },
    {
      id: "dashboard",
      label: "Dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
    },
    { id: "katalog", label: "Katalog", to: "/katalog", icon: Store },
    {
      id: "konsultasi",
      label: "Konsultasi",
      to: "/konsultasi",
      icon: MessageCircle,
    },
    { id: "download", label: "Download", to: "/download", icon: Download },
  ],
};
