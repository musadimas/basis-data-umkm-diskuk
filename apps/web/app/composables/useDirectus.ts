/** The app's Directus SDK client (see app/plugins/directus.ts). Works during SSR and in the browser. */
export function useDirectus() {
  return useNuxtApp().$directus;
}
