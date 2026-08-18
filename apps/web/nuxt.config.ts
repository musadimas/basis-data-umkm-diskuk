import { readFileSync, realpathSync, statSync } from "node:fs";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  pages: true,
  css: ["~/assets/css/tailwind.css"],
  modules: ["@nuxt/eslint", "@nuxtjs/tailwindcss", "shadcn-nuxt", "@nuxt/image", "@pinia/nuxt", "@vite-pwa/nuxt", "nuxt-svgo"],
  runtimeConfig: {
    directusInternalUrl: process.env.NUXT_DIRECTUS_INTERNAL_URL || "http://directus:8055",
    sessionPolicySecret: process.env.NUXT_SESSION_POLICY_SECRET || "",
    public: {
      panelUrl: process.env.NUXT_PUBLIC_PANEL_URL || "/panel",
      enableWorkforce: process.env.ANALYTICS_ENABLE_WORKFORCE === "true",
    },
  },
  pwa: {
    // Pure caching layer — no install prompt or web app manifest
    manifest: false,
    registerType: "autoUpdate",
    injectRegister: "auto",
    workbox: {
      // Skip precaching build assets; we only want runtime image caching
      globPatterns: [],
      // Nuxt handles routing server-side — no SPA fallback needed
      navigateFallback: undefined,
      runtimeCaching: [
        {
          // Static app images (/images/…)
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/images/"),
          handler: "CacheFirst" as const,
          options: {
            cacheName: "app-images",
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // External flag CDN images
          urlPattern: ({ url }: { url: URL }) => url.hostname === "flagcdn.com",
          handler: "CacheFirst" as const,
          options: {
            cacheName: "flag-images",
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  },
  vite: {
    vue: {
      script: {
        fs: {
          fileExists: (path: string) => {
            try {
              return statSync(path).isFile();
            } catch {
              return false;
            }
          },
          readFile: (path: string) => {
            try {
              return readFileSync(path, "utf-8");
            } catch {
              return undefined;
            }
          },
          realpath: (path: string) => {
            try {
              return realpathSync(path);
            } catch {
              return path;
            }
          },
        },
      },
    },
  },
});
