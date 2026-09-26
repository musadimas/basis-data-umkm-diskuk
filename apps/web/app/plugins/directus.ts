import { authentication, createDirectus, rest } from "@directus/sdk";
import { defineNuxtPlugin, useRequestEvent, useState } from "nuxt/app";
import { clearPrivateClientState } from "~/lib";
import type { DirectusSchema } from "~/types/directus";

/** Browser-facing prefix proxied to Directus by the `/panel/**` route rule in nuxt.config.ts. */
const PANEL_PREFIX = "/panel";
/** Placeholder origin for server rendering: requests are routed in-process, never over the network. */
const SSR_ORIGIN = "http://nuxt.internal";

/**
 * The single Directus client for the app, on both server and client. Use it through
 * `useDirectus()`: SDK commands for native routes (readMe, readItems, ...) and
 * `endpoint()` from ~/lib/directus for the custom extension routes under /v1.
 */
export default defineNuxtPlugin(() => {
  const event = import.meta.server ? useRequestEvent() : undefined;
  // On the server, route through Nitro's event.fetch: it stays in-process and forwards
  // the incoming request's cookie, so SSR calls carry the user's Directus session.
  const ssrFetch: typeof fetch | undefined = event
    ? (input, init) => {
        const target = new URL(String(input));
        return event.fetch(`${target.pathname}${target.search}`, init);
      }
    : undefined;
  const origin = import.meta.client ? window.location.origin : SSR_ORIGIN;

  const directus = createDirectus<DirectusSchema>(`${origin}${PANEL_PREFIX}`, {
    globals: ssrFetch ? { fetch: ssrFetch } : {},
  })
    .with(rest({ credentials: "include", onRequest: (options) => ({ ...options, cache: "no-store" }) }))
    .with(authentication("session", { credentials: "include", autoRefresh: import.meta.client }));

  if (import.meta.client) {
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
      useState("auth:status").value = "anonymous";
      window.location.replace("/sign-in");
    });
  }

  return { provide: { directus } };
});
