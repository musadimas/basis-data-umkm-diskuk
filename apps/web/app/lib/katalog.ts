/**
 * Public catalogue query building (Brief Fitur Modul 7.1). Visitors read `produk` through the
 * Directus Public policy (ADR-006), which only returns published products; these helpers turn
 * the catalogue's UI state into a Directus filter and format what the cards show.
 */
import { TALENT_BADGE_STATUS } from "~/constants/PROGRAM";
import type { JenisLegalitas, ProdukPublik } from "~/types/program";

export interface KatalogFilters {
  q: string;
  kategori: string | null;
  kota: number | null;
  skala: string[];
  talent: boolean;
  sertifikasi: JenisLegalitas[];
  pdn: boolean;
  ramahDisabilitas: boolean;
  sort: "terbaru" | "nama" | "harga-rendah" | "harga-tinggi";
}

export const DEFAULT_KATALOG_FILTERS: KatalogFilters = {
  q: "",
  kategori: null,
  kota: null,
  skala: [],
  talent: false,
  sertifikasi: [],
  pdn: false,
  ramahDisabilitas: false,
  sort: "terbaru",
};

export const KATALOG_FIELDS = [
  "id", "nama", "kategori", "harga_retail", "harga_grosir", "moq", "pdn_deklarasi", "status_kurasi",
  "usaha_nama", "usaha_skala", "usaha_talent_status", "usaha_pdn", "usaha_ramah_disabilitas", "usaha_whatsapp",
  "usaha_kota_nama", "usaha_sertifikasi", "foto.directus_files_id",
];

type Filter = Record<string, unknown>;

/** Directus filter for the catalogue's sidebar and chips. Search goes in the separate `search` param. */
export function katalogFilter(filters: KatalogFilters): Filter {
  const and: Filter[] = [];
  if (filters.kategori) and.push({ kategori: { _eq: filters.kategori } });
  if (filters.kota) and.push({ usaha_kota: { _eq: filters.kota } });
  if (filters.skala.length) and.push({ usaha_skala: { _in: filters.skala } });
  if (filters.talent) and.push({ usaha_talent_status: { _in: [...TALENT_BADGE_STATUS] } });
  for (const jenis of filters.sertifikasi) and.push({ usaha_sertifikasi: { _contains: `,${jenis},` } });
  if (filters.pdn) and.push({ _or: [{ pdn_deklarasi: { _eq: true } }, { usaha_pdn: { _eq: true } }] });
  if (filters.ramahDisabilitas) and.push({ usaha_ramah_disabilitas: { _eq: true } });
  return and.length ? { _and: and } : {};
}

export function katalogSort(sort: KatalogFilters["sort"]): string[] {
  switch (sort) {
    case "nama":
      return ["nama"];
    case "harga-rendah":
      return ["harga_retail", "-date_created"];
    case "harga-tinggi":
      return ["-harga_retail", "-date_created"];
    default:
      return ["-date_created"];
  }
}

export function sertifikasiList(value: string | null | undefined): JenisLegalitas[] {
  return (value ?? "").split(",").filter(Boolean) as JenisLegalitas[];
}

/** "Rp12.000 – Rp15.000" from wholesale and retail prices; a single price when only one is set. */
export function hargaRange(produk: Pick<ProdukPublik, "harga_retail" | "harga_grosir">): string | null {
  const format = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
  const prices = [produk.harga_grosir, produk.harga_retail].filter((value): value is number => typeof value === "number");
  if (!prices.length) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? format(low) : `${format(low)} – ${format(high)}`;
}

/** wa.me link with the number in international form and a prefilled message. */
export function whatsappLink(nomor: string | null | undefined, pesan: string): string | null {
  const digits = (nomor ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  const international = digits.startsWith("62") ? digits : digits.startsWith("0") ? `62${digits.slice(1)}` : `62${digits}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(pesan)}`;
}

/** youtube-nocookie embed URL for a YouTube link; null for anything else. */
export function youtubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}
