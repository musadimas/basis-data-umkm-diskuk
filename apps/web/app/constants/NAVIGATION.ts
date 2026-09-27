import type { LucideIcon } from "@lucide/vue";
import {
  BadgeCheck,
  ChartColumnDecreasing,
  ClipboardCheck,
  Map,
  PackageCheck,
  Rocket,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Table,
  UserCog,
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
      ],
    },
    {
      title: "program",
      items: [
        {
          id: "talent-kurasi",
          label: "Kurasi Talent Scouting",
          to: "/dashboard/talent/kurasi",
          icon: Sparkles,
        },
        {
          id: "pendampingan",
          label: "Program Akselerasi",
          to: "/dashboard/pendampingan",
          icon: Rocket,
        },
        {
          id: "katalog-kurasi",
          label: "Kurasi Katalog",
          to: "/dashboard/katalog/kurasi",
          icon: PackageCheck,
        },
        {
          id: "produk-umkm",
          label: "Produk Katalog (UMKM)",
          to: "/dashboard/usaha/produk",
          icon: ShoppingBag,
        },
        {
          id: "talent-passport",
          label: "Talent Passport",
          to: "/dashboard/usaha/passport",
          icon: BadgeCheck,
        },
        {
          id: "klinik",
          label: "Klinik Konsultasi",
          to: "/dashboard/klinik",
          icon: Stethoscope,
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
          id: "pendampingan",
          label: "Monitoring Akselerasi",
          to: "/dashboard/pendampingan",
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
          id: "pendampingan",
          label: "Panel Pendampingan",
          to: "/dashboard/pendampingan",
          icon: ClipboardCheck,
        },
        {
          id: "klinik",
          label: "Klinik Konsultasi",
          to: "/dashboard/klinik",
          icon: Stethoscope,
        },
      ],
    },
  ],
  umkm: [
    {
      title: "usaha",
      items: [
        {
          id: "laporan-kpi",
          label: "Laporan KPI",
          to: "/dashboard/usaha",
          icon: Smartphone,
        },
        {
          id: "produk-umkm",
          label: "Produk Katalog",
          to: "/dashboard/usaha/produk",
          icon: ShoppingBag,
        },
        {
          id: "talent-passport",
          label: "Talent Passport",
          to: "/dashboard/usaha/passport",
          icon: BadgeCheck,
        },
        {
          id: "klinik",
          label: "Klinik Konsultasi",
          to: "/dashboard/klinik",
          icon: Stethoscope,
        },
      ],
    },
  ],
} satisfies Record<AppRole, { title: string; items: NavItem[] }[]>;
