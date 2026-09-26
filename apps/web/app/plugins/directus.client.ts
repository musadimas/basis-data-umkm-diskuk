import { createDirectus, rest, authentication } from "@directus/sdk";
import { defineNuxtPlugin, useState } from "nuxt/app";
import { clearPrivateClientState } from "~/lib";

export default defineNuxtPlugin(() => {
  const directus = createDirectus<unknown>(`${window.location.origin}/panel`)
    .with(
      rest({
        onRequest: (options) => ({
          ...options,
          cache: "no-store",
          credentials: "include",
        }),
      }),
    )
    .with(
      authentication("session", { credentials: "include", autoRefresh: true }),
    );

  let authRedirectPending = false;
  window.addEventListener("auth:unauthorized", async () => {
    if (authRedirectPending) return;
    authRedirectPending = true;
    try {
      await directus.logout();
    } catch {
      // Revocation/offline logout must still clear the local boundary.
    }
    await clearPrivateClientState();
    useState("auth:status").value = false;
    window.location.replace("/sign-in");
  });

  // HTTP is deliberately the only realtime/policy-enforced transport in MVP.
  return { provide: { directus, directusWS: undefined } };
});
