import { createDirectus, rest, authentication, realtime } from "@directus/sdk";
import { defineNuxtPlugin, useState } from "nuxt/app";

export default defineNuxtPlugin(() => {
  const origin = window.location.origin;
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";

  const directus = createDirectus<any>(`${origin}/panel`)
    .with(
      rest({
        // Prevent browser from serving stale API responses from disk cache.
        // Directus sets Cache-Control headers when CACHE_ENABLED=true; without
        // this override, refreshing the page returns cached (stale) data.
        onRequest: (options) => ({ ...options, cache: "no-store" }),
      }),
    )
    .with(
      authentication("session", {
        credentials: "include",
        autoRefresh: true,
      }),
    );

  const directusWS = createDirectus<any>(`${wsProtocol}://${window.location.host}/panel/websocket`).with(
    realtime({
      // "strict" requires a valid session — Directus uses the session cookie
      // sent on the HTTP Upgrade so $CURRENT_USER resolves in filters.
      authMode: "strict",
      reconnect: { delay: 2000, retries: 10 },
      heartbeat: true,
    }),
  );

  let authRedirectPending = false;
  window.addEventListener("auth:unauthorized", async () => {
    if (authRedirectPending) return;
    authRedirectPending = true;
    try {
      await directus.logout();
    } catch {}
    useState("auth:status").value = false;
    window.location.replace("/sign-in");
  });

  return {
    provide: { directus, directusWS },
  };
});
