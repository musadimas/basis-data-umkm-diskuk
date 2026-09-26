import { readFileSync, realpathSync, statSync } from "node:fs";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  pages: true,
  css: ["~/assets/css/tailwind.css"],
  modules: ["@nuxt/eslint", "@nuxtjs/tailwindcss", "shadcn-nuxt", "@nuxt/image", "@pinia/nuxt", "@vite-pwa/nuxt", "nuxt-svgo"],
  runtimeConfig: {
    public: {
      enableWorkforce: process.env.ANALYTICS_ENABLE_WORKFORCE === "true",
    },
  },
  routeRules: {
    // Same-origin gateway to Directus for the SDK plugin (app/plugins/directus.ts):
    // /panel/<path> -> PANEL_URL/<path>. Read at build time, so set PANEL_URL before `nuxt build`.
    "/panel/**": {
      proxy: `${(process.env.PANEL_URL || "http://directus:8055").replace(/\/$/, "")}/**`,
      headers: { "cache-control": "private, no-store" },
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
  vue: {
    compilerOptions: {
      // ALTCHA web component (login and forgot-password captcha).
      isCustomElement: (tag: string) => tag === "altcha-widget",
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
