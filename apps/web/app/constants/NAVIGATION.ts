import type { LucideIcon } from "@lucide/vue";
import {
  ChartColumnDecreasing,
  ClipboardCheck,
  ClipboardList,
  House,
  Map,
  Rocket,
  Table,
  UserCog,
  Users,
} from "@lucide/vue";
import type { AppRole } from "./ROLES";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
}

/** Menu sidebar per role: setiap section punya judul dan daftar item. */
export const NAVIGATION_LINKS = {
  provinsi: [
    {
      title: "dashboard",
      items: [
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
        {
          id: "akselerasi",
          label: "Program Akselerasi",
          to: "/dashboard/akselerasi",
          icon: Rocket,
        },
      ],
    },
  ],
  kabkota: [
    {
      title: "dashboard",
      items: [
        {
          id: "infografis",
          label: "Dasbor Kewilayahan",
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
          label: "Data Lapangan",
          to: "/dashboard/tabular",
          icon: Table,
        },
        {
          id: "spasial",
          label: "Peta Spasial UMKM",
          to: "/dashboard/spasial",
          icon: Map,
        },
        {
          id: "akselerasi",
          label: "Monitoring Akselerasi",
          to: "/dashboard/akselerasi",
          icon: Rocket,
        },
      ],
    },
    {
      title: "akun",
      items: [
        {
          id: "akun",
          label: "Akun Saya",
          to: "/dashboard/akun",
          icon: UserCog,
        },
      ],
    },
  ],
  pendamping: [
    {
      title: "pendampingan",
      items: [
        {
          id: "binaan",
          label: "Dasbor Binaan Aktif",
          to: "/dashboard/binaan",
          icon: Users,
        },
        {
          id: "verifikasi",
          label: "Verifikasi Laporan KPI",
          to: "/dashboard/binaan/verifikasi",
          icon: ClipboardCheck,
        },
      ],
    },
  ],
  umkm: [
    {
      title: "usaha",
      items: [
        {
          id: "beranda",
          label: "Beranda",
          to: "/dashboard/usaha",
          icon: House,
        },
        {
          id: "laporan",
          label: "Laporan KPI",
          to: "/dashboard/usaha/laporan",
          icon: ClipboardList,
        },
      ],
    },
  ],
} satisfies Record<AppRole, { title: string; items: NavItem[] }[]>;
