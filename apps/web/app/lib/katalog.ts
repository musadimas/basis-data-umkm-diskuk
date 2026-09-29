/**
 * Public catalogue query building (Brief Fitur Modul 7.1). Visitors read `produk` through the
 * Directus Public policy (ADR-006), which only returns published products; these helpers turn
 * the catalogue's UI state into a Directus filter and format what the cards show.
 *
 * The catalogue state is shareable: `katalogQueryFromFilters` / `katalogFiltersFromQuery` are the
 * only translation between the URL and the filter object, and both sides whitelist values, so a
 * hand-edited URL cannot widen a query.
 */
import { JENIS_LEGALITAS, KURASI_STATUS } from "~/constants/PROGRAM";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { FilterExpression, QueryValueMap, UrlQuery } from "~/types/directus";
import type { JenisLegalitas, KurasiStatus, Produk, ProdukInput, ProdukLegalitas, ProdukLoi, ProdukPublik, UsahaPilihan } from "~/types/program";

/** Bentuk nilai JSON untuk kolom teks yang menyimpan larik (mis. `usaha_sertifikasi`). */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface KatalogFilters {
  q: string;
  /** Quick chip key (KATALOG_CHIPS), not a raw kategori value. */
  kategori: string | null;
  kota: number | null;
  skala: string[];
  /** Selected talent stages; empty means "any". */
  talent: string[];
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
  talent: [],
  sertifikasi: [],
  pdn: false,
  ramahDisabilitas: false,
  sort: "terbaru",
};

/** The brief's five quick chips; each one groups one or more stored kategori values. */
export const KATALOG_CHIPS: { key: string; label: string; kategori: string[] }[] = [
  { key: "kuliner", label: "Kuliner & Makanan Olahan", kategori: ["makanan", "minuman"] },
  { key: "fesyen", label: "Fesyen & Tekstil", kategori: ["fashion"] },
  { key: "kerajinan", label: "Kerajinan", kategori: ["kerajinan"] },
  { key: "kecantikan", label: "Kecantikan & Herbal", kategori: ["kesehatan_kecantikan"] },
  { key: "agribisnis", label: "Agribisnis", kategori: ["agribisnis"] },
];

export const KATALOG_SKALA: { value: string; label: string }[] = [
  { value: "micro", label: "Mikro" },
  { value: "small", label: "Kecil" },
  { value: "medium", label: "Menengah" },
];

/** Talent stages the brief asks visitors to filter on. "UMKM Ekspor" has no stored attribute yet. */
export const KATALOG_TALENT: { value: string; label: string }[] = [
  { value: "champion", label: "Champion" },
  { value: "talent_pool", label: "Talent Pool" },
  { value: "accelerator", label: "Akselerator" },
];

export const KATALOG_SORT: { value: KatalogFilters["sort"]; label: string }[] = [
  { value: "terbaru", label: "Terbaru" },
  { value: "nama", label: "Nama A-Z" },
  { value: "harga-rendah", label: "Harga Terendah" },
  { value: "harga-tinggi", label: "Harga Tertinggi" },
];

export const KATALOG_PAGE_SIZE = 12;
/** Server query bound: a linked URL cannot ask the catalogue for unbounded rows. */
export const KATALOG_MAX_LIMIT = 48;
const MAX_QUERY_LENGTH = 80;

/** Fields the Public policy grants on `produk`; see migration 20260926K and 20260926R. */
export const KATALOG_FIELDS = [
  "id", "nama", "kategori", "harga_retail", "harga_grosir", "moq", "pdn_deklarasi", "status_kurasi",
  "usaha_nama", "usaha_skala", "usaha_talent_status", "usaha_pdn", "usaha_ramah_disabilitas", "usaha_whatsapp",
  "usaha_kota", "usaha_kota_nama", "usaha_sertifikasi", "usaha_nib", "usaha_legalitas", "foto.directus_files_id",
];

/** A product without a value says so instead of inventing one (M7-04). */
export const BELUM_TERSEDIA = "Belum tersedia";

export function teksAtauBelum(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return BELUM_TERSEDIA;
  return String(value);
}

const chipByKey = (key: string | null) => KATALOG_CHIPS.find((chip) => chip.key === key);

/** Directus filter for the catalogue's sidebar, chips and search box. */
export function katalogFilter(filters: KatalogFilters): FilterExpression {
  const and: FilterExpression[] = [];
  const q = filters.q.trim().slice(0, MAX_QUERY_LENGTH);
  // Search covers product name, business (UMKM) name and the 5-digit KBLI, as the brief asks.
  if (q) {
    and.push({ _or: [{ nama: { _icontains: q } }, { usaha_nama: { _icontains: q } }, { kbli: { _contains: q } }] });
  }
  const chip = chipByKey(filters.kategori);
  if (chip) and.push({ kategori: { _in: [...chip.kategori] } });
  if (filters.kota) and.push({ usaha_kota: { _eq: filters.kota } });
  if (filters.skala.length) and.push({ usaha_skala: { _in: [...filters.skala] } });
  if (filters.talent.length) and.push({ usaha_talent_status: { _in: [...filters.talent] } });
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

/** The shareable URL state: only non-default values, and only whitelisted ones. */
export function katalogQueryFromFilters(filters: KatalogFilters): UrlQuery {
  const query: UrlQuery = {};
  const q = filters.q.trim().slice(0, MAX_QUERY_LENGTH);
  if (q) query.q = q;
  if (chipByKey(filters.kategori)) query.kategori = filters.kategori!;
  if (filters.kota) query.kota = String(filters.kota);
  if (filters.skala.length) query.skala = filters.skala.join(",");
  if (filters.talent.length) query.talent = filters.talent.join(",");
  if (filters.sertifikasi.length) query.sertifikasi = filters.sertifikasi.join(",");
  if (filters.pdn) query.pdn = "1";
  if (filters.ramahDisabilitas) query.disabilitas = "1";
  if (filters.sort !== DEFAULT_KATALOG_FILTERS.sort) query.sort = filters.sort;
  return query;
}

const list = <T extends string>(value: QueryValueMap[string], allowed: readonly T[]): T[] => {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  const known = new Set<string>(allowed);
  return [...new Set(raw.split(",").map((item) => item.trim()))].filter((item): item is T => known.has(item));
};

/** Hydrates the filter object from a (possibly hand-edited) URL query. */
export function katalogFiltersFromQuery(query: QueryValueMap): KatalogFilters {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sort = String(one("sort") ?? "");
  const kota = Number(one("kota"));
  const jenis = JENIS_LEGALITAS.map((item) => item.value);
  const sortDikenal = (value: string): value is KatalogFilters["sort"] =>
    KATALOG_SORT.some((item) => item.value === value);
  return {
    q: String(one("q") ?? "").slice(0, MAX_QUERY_LENGTH),
    kategori: chipByKey(String(one("kategori") ?? ""))?.key ?? null,
    kota: Number.isInteger(kota) && kota > 0 ? kota : null,
    skala: list(one("skala"), KATALOG_SKALA.map((item) => item.value)),
    talent: list(one("talent"), KATALOG_TALENT.map((item) => item.value)),
    sertifikasi: list(one("sertifikasi"), jenis),
    pdn: one("pdn") === "1",
    ramahDisabilitas: one("disabilitas") === "1",
    sort: sortDikenal(sort) ? sort : "terbaru",
  };
}

export function sertifikasiList(value: string | null | undefined): JenisLegalitas[] {
  // SAFETY: kolom snapshot `usaha_sertifikasi` hanya menyalin jenis legalitas dari tabel sertifikat dinas.
  return (value ?? "").split(",").filter(Boolean) as JenisLegalitas[];
}

function isJsonText(value: ProdukLegalitas[] | string | null | undefined): value is string {
  return typeof value === "string";
}

/** Valid certificates copied onto the product by the snapshot trigger (migration 20260926R). */
export function usahaLegalitas(value: ProdukLegalitas[] | string | null | undefined): ProdukLegalitas[] {
  if (!value) return [];
  const parsed = isJsonText(value) ? safeParse(value) : value;
  // SAFETY: kolom snapshot menyalin larik sertifikat; bentuk selain larik ditolak agar badge tidak menebak.
  return Array.isArray(parsed) ? (parsed as ProdukLegalitas[]) : [];
}

function safeParse(value: string): JsonValue {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
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

/**
 * WhatsApp CTA for a published product. A number only counts once the product passed curation
 * (status tayang / rekomendasi marketplace) and the business actually set a sales number; an
 * unapproved or empty contact yields no link at all (Y06: jangan buat tautan WA bila kontak
 * belum disetujui).
 */
export function kontakPenjualan(produk: Pick<ProdukPublik, "usaha_whatsapp" | "status_kurasi">, pesan: string): string | null {
  return isTayang(produk.status_kurasi) ? whatsappLink(produk.usaha_whatsapp, pesan) : null;
}

/** youtube-nocookie embed URL for a YouTube link; null for anything else. */
export function youtubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

/** The public spec-sheet PDF of one published product (Y06/M7-04). */
export function specPdfUrl(produkId: string): string {
  return `/panel/v1/program/katalog/produk/${encodeURIComponent(produkId)}/pdf`;
}

/**
 * Product photo through the katalog endpoint's authenticated proxy. Pre-curation photos sit in a
 * folder the Public policy cannot read and the app policy only grants uploaded_by, so curators
 * (and owners, through the same check) load the bytes via /v1/program/katalog/foto/:fileId.
 */
export function katalogFotoUrl(fileId: string): string {
  return `/panel/v1/program/katalog/foto/${encodeURIComponent(fileId)}`;
}

// ── Kurasi: satu sumber label dan urutan (cermin katalog/rules.js di backend) ─────────────────

/** Status yang layak tayang di katalog publik; cermin `STATUS_TAYANG` backend. */
export const KURASI_TAYANG: readonly KurasiStatus[] = ["tayang", "rekomendasi_marketplace"];

export function isTayang(status: KurasiStatus): boolean {
  return KURASI_TAYANG.includes(status);
}

/** Tahap yang dilalui produk (penolakan mengembalikannya ke tahap pertama). */
export const KURASI_TAHAP: readonly KurasiStatus[] = ["menunggu", "tayang", "rekomendasi_marketplace"];

/** Urutan tab antrean kurator; labelnya selalu dari KURASI_STATUS. */
export const KURASI_ANTREAN: readonly KurasiStatus[] = ["menunggu", "tayang", "rekomendasi_marketplace", "ditolak"];

export const kurasiLabel = (status: KurasiStatus): string => KURASI_STATUS[status].label;

export type KurasiKeputusan = "tayang" | "rekomendasi_marketplace" | "ditolak";

/** Tahap `tahap` sudah dilewati produk berstatus `status`? */
export function tahapKurasiSelesai(status: KurasiStatus, tahap: KurasiStatus): boolean {
  if (status === "ditolak") return tahap === "menunggu";
  return KURASI_TAHAP.indexOf(tahap) <= KURASI_TAHAP.indexOf(status);
}

// ── Kegagalan: satu peta pesan untuk setiap kode yang bisa dikirim endpoint katalog ────────────

/** Kode error server (`ProgramError`) → pesan untuk pengguna. Tes penjaga memastikan tak ada kode yang terlewat. */
export const PESAN_KATALOG = {
  INVALID_PAYLOAD: "Periksa kembali isian formulir (mis. tautan video harus https).",
  INVALID_USAHA_ID: "Usaha tidak valid. Pilih ulang usaha.",
  INVALID_PRODUK_ID: "Produk tidak valid.",
  INVALID_FILE_ID: "Berkas foto tidak valid.",
  INVALID_ID: "Data tidak valid.",
  AUTHENTICATION_REQUIRED: "Sesi berakhir. Masuk kembali lalu coba lagi.",
  KOTA_NOT_ASSIGNED: "Akun ini belum ditetapkan ke kabupaten/kota.",
  FORBIDDEN: "Akun ini tidak dapat mengelola produk usaha tersebut.",
  PRODUK_NOT_FOUND: "Produk tidak ditemukan.",
  FOTO_TIDAK_DITEMUKAN: "Foto tidak ditemukan.",
  FOTO_TIDAK_VALID: "Foto harus diunggah ulang melalui formulir ini.",
  CATATAN_WAJIB: "Tulis alasan penolakan untuk pelaku usaha.",
  PERSETUJUAN_WAJIB: "Persetujuan kontak wajib dicentang.",
  CAPTCHA_INVALID: "Captcha kedaluwarsa. Centang ulang lalu kirim.",
  CAPTCHA_NOT_CONFIGURED: "Verifikasi captcha belum tersedia. Coba lagi nanti.",
  TERLALU_BANYAK_PERMINTAAN: "Terlalu banyak pengiriman dari jaringan ini. Coba lagi beberapa saat.",
} satisfies Record<string, string>;

/** Pesan untuk kode server; `khusus` menimpa peta umum. */
function pesanUntuk(code: string, khusus: Record<string, string>): string | undefined {
  // SAFETY: Object.hasOwn memastikan `code` adalah kunci PESAN_KATALOG.
  return khusus[code] ?? (Object.hasOwn(PESAN_KATALOG, code) ? PESAN_KATALOG[code as keyof typeof PESAN_KATALOG] : undefined);
}

export class KatalogError extends Error {
  constructor(
    readonly code: string,
    readonly pesan: string,
  ) {
    super(pesan);
    this.name = "KatalogError";
  }
}

/** Client Directus sekecil yang dibutuhkan module ini; tes memakai stub `request`. */
export type KatalogClient = Pick<ReturnType<typeof useDirectus>, "request">;

/** `khusus` menimpa pesan umum untuk kode yang artinya bergantung pada operasi (mis. INVALID_PAYLOAD). */
async function panggil<T>(fn: () => Promise<T>, fallback: string, khusus: Record<string, string> = {}): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    const code = requestErrorCode(cause) ?? "UNKNOWN";
    throw new KatalogError(code, pesanUntuk(code, khusus) ?? fallback);
  }
}

export interface LoiInput {
  produk: string;
  nama: string;
  instansi: string | null;
  email: string;
  telepon: string | null;
  jumlah: string | null;
  pesan: string;
  clientUuid: string;
  captcha: string;
}

/** Satu-satunya tempat yang mengenal `/v1/program/katalog/*` (kecuali PDF/foto: lihat `specPdfUrl`/`katalogFotoUrl`). */
export function katalogApi(client: KatalogClient) {
  const dasar = "/v1/program/katalog";
  return {
    cariUsaha: (q: string) =>
      panggil(() => client.request<UsahaPilihan[]>(endpoint<UsahaPilihan[]>(`${dasar}/usaha`, { query: { q } })), "Usaha tidak dapat dicari. Coba lagi."),
    produkUsaha: (usahaId: string) =>
      panggil(() => client.request<Produk[]>(endpoint<Produk[]>(`${dasar}/produk`, { query: { usaha: usahaId } })), "Produk tidak dapat dimuat."),
    /** `produkId` mengubah produk yang ada (kembali ke kurasi); tanpa itu membuat produk baru. */
    simpanProduk: (usahaId: string, input: ProdukInput, produkId?: string) =>
      panggil(
        () =>
          produkId
            ? client.request<Produk>(endpoint<Produk, ProdukInput>(`${dasar}/produk/${produkId}`, { method: "PATCH", body: input }))
            : client.request<Produk>(endpoint<Produk, ProdukInput & { usaha: string }>(`${dasar}/produk`, { method: "POST", body: { ...input, usaha: usahaId } })),
        "Produk tidak dapat disimpan. Coba lagi.",
      ),
    antreanKurasi: (status: KurasiStatus) =>
      panggil(() => client.request<Produk[]>(endpoint<Produk[]>(`${dasar}/kurasi`, { query: { status } })), "Antrean kurasi tidak dapat dimuat."),
    /** Penolakan tanpa catatan ditolak di klien dengan pesan yang sama seperti server (CATATAN_WAJIB). */
    putuskanKurasi: (produkId: string, keputusan: KurasiKeputusan, catatan: string) => {
      const isi = catatan.trim();
      if (keputusan === "ditolak" && !isi) return Promise.reject(new KatalogError("CATATAN_WAJIB", PESAN_KATALOG.CATATAN_WAJIB));
      return panggil(
        () =>
          client.request<Produk>(
            endpoint<Produk, { keputusan: KurasiKeputusan; catatan: string | null }>(`${dasar}/produk/${produkId}/kurasi`, {
              method: "POST",
              body: { keputusan, catatan: isi || null },
            }),
          ),
        "Keputusan tidak dapat disimpan. Coba lagi.",
      );
    },
    daftarLoi: () => panggil(() => client.request<ProdukLoi[]>(endpoint<ProdukLoi[]>(`${dasar}/loi`)), "Letter of Intent tidak dapat dimuat."),
    kirimLoi: (input: LoiInput) =>
      panggil(
        () =>
          client.request<{ diterima: boolean; duplikat?: boolean }>(
            endpoint<{ diterima: boolean; duplikat?: boolean }, LoiInput & { persetujuanKontak: true }>(`${dasar}/loi`, {
              method: "POST",
              body: { ...input, persetujuanKontak: true },
            }),
          ),
        "Letter of Intent tidak dapat dikirim. Periksa isian lalu coba lagi.",
        { INVALID_PAYLOAD: "Letter of Intent tidak dapat dikirim. Periksa isian lalu coba lagi.", PRODUK_NOT_FOUND: "Produk ini belum tayang atau sudah tidak tersedia." },
      ),
  };
}
