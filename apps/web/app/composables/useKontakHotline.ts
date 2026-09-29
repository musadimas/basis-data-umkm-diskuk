/*
 * Kontak resmi DISKUK dari singleton `kontak_hotline` (publik, ADR-006) untuk
 * halaman klinik, bantuan, FAQ, dan katalog. Satu key `useAsyncData`, jadi
 * keempat halaman berbagi satu permintaan dan tidak menyimpan salinan aturan
 * pembacaannya masing-masing (B40).
 */
import { readSingleton } from "@directus/sdk";
import { isKontakHotline } from "~/lib/directus";

export function useKontakHotline() {
  const directus = useDirectus();
  return useAsyncData("kontak:hotline", async () => {
    try {
      const item = await directus.request(readSingleton("kontak_hotline"));
      return isKontakHotline(item) ? item : null;
    } catch {
      return null;
    }
  });
}
