import { clearPrivateClientState } from "~/lib";

export type AuthUser = { id: string; email?: string; first_name?: string; last_name?: string; role?: string; avatar?: string | null };

type QueryClientLike = { clear: () => void };
type DirectusLike = {
  login: (credentials: { email: string; password: string }, options: { mode: "session" }) => Promise<unknown>;
  logout: () => Promise<unknown>;
};
type InjectedServices = {
  $directus?: DirectusLike;
  $queryClient?: QueryClientLike;
};

function validReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\\") || decoded.startsWith("//")) return "/dashboard";
    const url = new URL(decoded, import.meta.client ? window.location.origin : "https://dashboard.invalid");
    return (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) ? `${url.pathname}${url.search}${url.hash}` : "/dashboard";
  } catch { return "/dashboard"; }
}

export function safeDashboardReturnTo(value: unknown) {
  return validReturnTo(value);
}

export function useAuth() {
  const nuxt = useNuxtApp();
  const services = nuxt as unknown as InjectedServices;
  const user = useState<AuthUser | null>("auth:user", () => null);
  const status = useState<"unknown" | "authenticated" | "anonymous">("auth:status", () => "unknown");
  const pending = useState("auth:pending", () => false);

  async function currentUser() {
    try {
      const response = await $fetch<{ data: AuthUser }>("/panel/users/me", { credentials: "include", headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined });
      if (import.meta.client && user.value?.id && user.value.id !== response.data.id) await clearPrivateClientState(services.$queryClient);
      user.value = response.data;
      status.value = "authenticated";
      return response.data;
    } catch {
      if (import.meta.client) await clearPrivateClientState(services.$queryClient);
      user.value = null;
      status.value = "anonymous";
      return null;
    }
  }

  async function login(email: string, password: string) {
    pending.value = true;
    try {
      const directus = services.$directus;
      if (directus) await directus.login({ email: email.trim(), password }, { mode: "session" });
      else await $fetch("/panel/auth/login", { method: "POST", body: { email: email.trim(), password, mode: "session" }, credentials: "include" });
      const loggedInUser = await currentUser();
      if (!loggedInUser) throw new Error("Authentication could not be verified");
      return true;
    } finally { pending.value = false; }
  }

  async function logout() {
    pending.value = true;
    try { await services.$directus?.logout(); } catch { /* local clearing is mandatory */ }
    await clearPrivateClientState(services.$queryClient);
    user.value = null;
    status.value = "anonymous";
    pending.value = false;
    if (import.meta.client) await navigateTo("/sign-in");
  }

  return { user, status, pending, currentUser, login, logout };
}
