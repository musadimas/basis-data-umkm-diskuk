import type { AppRole } from "~/composables/useAuth";

/** Role badges in the profile header (feature brief, module 1.3). */
export const APP_ROLE_BADGES: Record<AppRole, { label: string; className: string }> = {
  provinsi: { label: "Provinsi", className: "bg-blue-900 text-white" },
  kabkota: { label: "Kab/Kota", className: "bg-sky-300 text-sky-950" },
  pendamping: { label: "Pendamping", className: "bg-emerald-600 text-white" },
  umkm: { label: "UMKM", className: "bg-amber-400 text-amber-950" },
};

export const DEFAULT_APP_ROLE: AppRole = "provinsi";
