import type { AppRole } from "~/composables/useAuth";

// Satu definisi tipe `AppRole` tinggal di `useAuth` (kunci kolom `directus_users.app_role`);
// berkas ini memakai ulang tipe itu untuk matriks role Y01.
export type { AppRole };

export const ALL_ROLES: readonly AppRole[] = ["provinsi", "kabkota", "pendamping", "umkm"];

export const DATA_ROLES: readonly AppRole[] = ["provinsi", "kabkota"];

export const ROLE_ROUTES = {
  provinsi: [
    "/dashboard",
    "/dashboard/analitik",
    "/dashboard/tabular",
    "/dashboard/spasial",
    "/dashboard/umkm",
    "/dashboard/data-lapangan",
    "/dashboard/talent",
    "/dashboard/pendampingan",
    "/dashboard/akselerasi",
    "/dashboard/investor-kurasi",
    "/dashboard/kegiatan",
    "/dashboard/katalog",
    // Kurator provinsi mengelola produk dan menerbitkan passport atas nama usaha.
    "/dashboard/usaha/produk",
    "/dashboard/usaha/passport",
    "/dashboard/klinik",
    "/dashboard/akun",
  ],
  kabkota: [
    "/dashboard",
    "/dashboard/analitik",
    "/dashboard/tabular",
    "/dashboard/spasial",
    "/dashboard/umkm",
    "/dashboard/data-lapangan",
    "/dashboard/talent",
    "/dashboard/pendampingan",
    "/dashboard/akselerasi",
    "/dashboard/kegiatan",
    "/dashboard/klinik",
    "/dashboard/akun",
  ],
  pendamping: ["/dashboard/pendampingan", "/dashboard/klinik", "/dashboard/akun"],
  umkm: ["/dashboard/usaha", "/dashboard/klinik", "/dashboard/akun"],
} as const satisfies Record<AppRole, readonly string[]>;

/** Beranda pertama setelah login per role; juga tujuan redirect akses di luar role. */
export const ROLE_HOME = {
  provinsi: "/dashboard",
  kabkota: "/dashboard",
  pendamping: "/dashboard/pendampingan",
  umkm: "/dashboard/usaha",
} as const satisfies Record<AppRole, string>;

/** Id kota terkunci untuk admin kab/kota; null bila bukan kabkota atau tanpa kota. */
type KotaScopeInput = number | string | { id: number | string } | null | undefined;

function isKotaObject(value: KotaScopeInput): value is { id: number | string } {
  return value !== null && typeof value === "object";
}

function isKotaNumber(value: number | string): value is number {
  return typeof value === "number";
}

function isKotaText(value: number | string): value is string {
  return typeof value === "string";
}

export function lockedKotaId(
  user: {
    app_role?: AppRole | string | null;
    role?: string | null;
    kota?: KotaScopeInput;
  } | null,
): string | null {
  if (!user) return null;
  const roleKey = user.app_role ?? (isRoleKey(user.role) ? user.role : null);
  if (roleKey !== "kabkota") return null;
  const raw = isKotaObject(user.kota) ? user.kota.id : user.kota;
  if (raw === null || raw === undefined) return null;
  if (isKotaNumber(raw)) return Number.isInteger(raw) ? String(raw) : null;
  const text = isKotaText(raw) ? raw.trim() : "";
  return /^\d+$/.test(text) ? String(Number(text)) : null;
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

/** Role badges in the profile header (feature brief, module 1.3). */
export const APP_ROLE_BADGES = {
  provinsi: { label: "Provinsi", className: "bg-blue-900 text-white" },
  kabkota: { label: "Kab/Kota", className: "bg-sky-300 text-sky-950" },
  pendamping: { label: "Pendamping", className: "bg-emerald-600 text-white" },
  umkm: { label: "UMKM", className: "bg-amber-400 text-amber-950" },
} satisfies Record<AppRole, { label: string; className: string }>;

const TANPA_PERAN_BADGE = { label: "Peran belum ditetapkan", className: "bg-muted text-muted-foreground" };

/** Badge for the header; an account without a valid app_role is never shown as Provinsi (ADR-009). */
export function appRoleBadge(role: string | null | undefined): { label: string; className: string } {
  return isRoleKey(role) ? APP_ROLE_BADGES[role] : TANPA_PERAN_BADGE;
}

/**
 * Where the dashboard guard sends a signed-in account, or null when `path` may be shown. An account
 * without a valid app_role has no dashboard at all, so it goes to sign-in: sending it to another
 * dashboard route would be refused again by the same guard, forever.
 */
export function dashboardRedirect(role: string | null | undefined, path: string): string | null {
  if (!isRoleKey(role)) return "/sign-in?error=peran";
  return hasRouteAccess(role, path) ? null : ROLE_HOME[role];
}
