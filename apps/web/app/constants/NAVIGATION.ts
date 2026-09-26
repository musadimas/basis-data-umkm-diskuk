import {
  ChartColumnDecreasing,
  Map,
  Sparkles,
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
  // Brief Fitur programme modules. Only the super admin uses them for now; the group keys are
  // where role-specific menus split once multi-role access is switched on.
  program: [
    {
      id: "talent-kurasi",
      label: "Kurasi Talent Scouting",
      to: "/dashboard/talent/kurasi",
      icon: Sparkles,
    },
  ],
};
