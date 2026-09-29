import { clearPrivateClientState } from "~/lib";

export type DemoRole = "provinsi" | "kabkota" | "pendamping" | "umkm";

/** One-click demo login through a server-owned, loopback-only dummy session endpoint. */
export function useDemoRoleSwitch() {
  const auth = useAuth();
  const directus = useDirectus();
  const { $queryClient } = useNuxtApp();
  const busy = ref(false);
  const error = ref("");

  async function switchRole(role: DemoRole) {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("diskuk-demo-session");
        channel.postMessage({ type: "switch" });
        channel.close();
      }
      if (auth.status.value === "authenticated") {
        try { await directus.logout(); } catch { /* stale session; local state still cleared */ }
      }
      await clearPrivateClientState($queryClient);
      const response = await $fetch<{ data: { role: DemoRole } }>("/api/demo/switch", { method: "POST", body: { role } });
      if (response.data.role !== role) throw new Error("Unexpected demo role");
      auth.user.value = null;
      auth.status.value = "unknown";
      window.location.assign("/dashboard");
    } catch {
      error.value = "Akun demo belum dapat dibuka. Periksa konfigurasi stack disposable.";
      busy.value = false;
    }
  }
  return { busy, error, switchRole };
}
