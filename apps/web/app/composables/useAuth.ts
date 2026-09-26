import { readMe } from "@directus/sdk";
import { clearPrivateClientState } from "~/lib";

export type AppRole = "provinsi" | "kabkota" | "pendamping" | "umkm";

export type AuthUser = {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string;
  avatar?: string | null;
  app_role?: AppRole | null;
  instansi?: string | null;
  /** `directus_users.kota`: integer FK of the assigned wilayah, id only. */
  kota?: number | null;
  /** `directus_users.usaha`: UUID FK of the account's business, id only. */
  usaha?: string | null;
};

/** Nilai mentah `returnTo` dari route query vue-router sebelum divalidasi. */
type ReturnToInput = string | null | (string | null)[] | undefined;

function isReturnToString(value: ReturnToInput): value is string {
  return typeof value === "string";
}

function validReturnTo(value: ReturnToInput) {
  if (
    !isReturnToString(value) ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\\") || decoded.startsWith("//")) return "/dashboard";
    const url = new URL(
      decoded,
      import.meta.client ? window.location.origin : "https://dashboard.invalid",
    );
    return url.pathname === "/dashboard" ||
      url.pathname.startsWith("/dashboard/")
      ? `${url.pathname}${url.search}${url.hash}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function safeDashboardReturnTo(value: ReturnToInput) {
  return validReturnTo(value);
}

function isRelationId<T>(value: T | string | null | undefined): value is string {
  return typeof value === "string";
}

/** Relation fields come back as ids unless expanded; keep only the id. */
function relationId<T>(value: T | string | null | undefined): string | null {
  return isRelationId(value) ? value : null;
}

/**
 * `directus_users.kota` is an INTEGER FK, so its raw value is a number, a numeric string,
 * or an expanded `{ id }` object. `relationId` only accepts strings — it would drop the
 * native number — so integer FKs need their own resolver.
 */
function integerRelationId(
  value: number | string | { id: number | string | null } | null | undefined,
): number | null {
  const raw = value !== null && typeof value === "object" ? value.id : value;
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  const text = typeof raw === "string" ? raw.trim() : "";
  return /^\d+$/.test(text) ? Number(text) : null;
}

export function useAuth() {
  const { $directus: directus, $queryClient: queryClient } = useNuxtApp();
  const user = useState<AuthUser | null>("auth:user", () => null);
  const status = useState<"unknown" | "authenticated" | "anonymous">(
    "auth:status",
    () => "unknown",
  );
  const pending = useState("auth:pending", () => false);

  async function currentUser() {
    try {
      // No explicit field list: Directus returns exactly the fields this role may read.
      const me = await directus.request(readMe());
      const current: AuthUser = {
        id: me.id,
        email: me.email ?? undefined,
        first_name: me.first_name,
        last_name: me.last_name,
        role: relationId(me.role) ?? undefined,
        avatar: relationId(me.avatar),
        app_role: me.app_role,
        instansi: me.instansi,
        kota: integerRelationId(me.kota),
        usaha: relationId(me.usaha),
      };
      if (import.meta.client && user.value?.id && user.value.id !== current.id)
        await clearPrivateClientState(queryClient);
      user.value = current;
      status.value = "authenticated";
      return current;
    } catch {
      if (import.meta.client) await clearPrivateClientState(queryClient);
      user.value = null;
      status.value = "anonymous";
      return null;
    }
  }

  /**
   * Logs in through the native Directus /auth/login with an official email or a 13-digit
   * NIB in `email`. `captcha` is the single-use captcha payload; the authentication
   * extension's login guard resolves the NIB and verifies the captcha.
   */
  async function login(identifier: string, password: string, captcha: string) {
    pending.value = true;
    try {
      // `captcha` rides along in the login payload for the extension's auth.login guard.
      const credentials = { email: identifier.trim(), password, captcha };
      await directus.login(credentials, { mode: "session" });
      const loggedInUser = await currentUser();
      if (!loggedInUser)
        throw new Error("Authentication could not be verified");
      return true;
    } finally {
      pending.value = false;
    }
  }

  async function logout() {
    pending.value = true;
    try {
      await directus.logout();
    } catch {
      /* local clearing is mandatory */
    }
    await clearPrivateClientState(queryClient);
    user.value = null;
    status.value = "anonymous";
    pending.value = false;
    if (import.meta.client) await navigateTo("/sign-in");
  }

  return { user, status, pending, currentUser, login, logout };
}
