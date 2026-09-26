export const ALL_ROLES = ["provinsi", "kabkota", "pendamping", "umkm"] as const;

export type AppRole = (typeof ALL_ROLES)[number];

export const DATA_ROLES: readonly AppRole[] = ["provinsi", "kabkota"];

export const ROLE_LABELS = {
  provinsi: "Admin Provinsi",
  kabkota: "Admin Kab/Kota",
  pendamping: "Pendamping",
  umkm: "Pelaku UMKM",
} as const satisfies Record<AppRole, string>;

export const ROLE_BADGE_CLASSES = {
  provinsi: "bg-blue-900 text-white",
  kabkota: "bg-sky-400 text-sky-950",
  pendamping: "bg-emerald-600 text-white",
  umkm: "bg-amber-400 text-amber-950",
} as const satisfies Record<AppRole, string>;

export const ROLE_ROUTES = {
  provinsi: [
    "/dashboard",
    "/dashboard/analitik",
    "/dashboard/tabular",
    "/dashboard/spasial",
    "/dashboard/umkm",
    "/dashboard/data-lapangan",
    "/dashboard/talenta",
    "/dashboard/akselerasi",
    "/dashboard/binaan",
    "/dashboard/akun",
    "/dashboard/audit-sesi",
  ],
  kabkota: [
    "/dashboard",
    "/dashboard/analitik",
    "/dashboard/tabular",
    "/dashboard/spasial",
    "/dashboard/umkm",
    "/dashboard/data-lapangan",
    "/dashboard/talenta",
    "/dashboard/akselerasi",
    "/dashboard/binaan",
    "/dashboard/akun",
    "/dashboard/audit-sesi",
  ],
  pendamping: ["/dashboard/binaan", "/dashboard/akun", "/dashboard/audit-sesi"],
  umkm: ["/dashboard/usaha", "/dashboard/akun", "/dashboard/audit-sesi"],
} as const satisfies Record<AppRole, readonly string[]>;

/** Beranda pertama setelah login per role; juga tujuan redirect akses di luar role. */
export const ROLE_HOME = {
  provinsi: "/dashboard",
  kabkota: "/dashboard",
  pendamping: "/dashboard/binaan",
  umkm: "/dashboard/usaha",
} as const satisfies Record<AppRole, string>;

/** Id kota terkunci untuk admin kab/kota; null bila bukan kabkota atau tanpa kota. */
export function lockedKotaId(
  user: { role?: string | null; kota?: { id: number } | null } | null,
): string | null {
  if (!user || user.role !== "kabkota" || !user.kota) return null;
  return String(user.kota.id);
}

export function isRoleKey(value: string | null | undefined): value is AppRole {
  return value != null && ALL_ROLES.some((role) => role === value);
}

export function hasRouteAccess(role: string | null | undefined, path: string): boolean {
  if (!role || !(role in ROLE_ROUTES)) return false;
  // SAFETY: keanggotaan role sudah dipastikan oleh cek `in` di atas; assertion hanya memulihkan narrowing.
  const routes = ROLE_ROUTES[role as AppRole];
  return routes.some((base) => {
    if (path === base) return true;
    if (base === "/dashboard") return false;
    return path.startsWith(`${base}/`);
  });
}
