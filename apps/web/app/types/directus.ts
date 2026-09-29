import type { AppRole } from "~/composables/useAuth";
import type { SavedAnalysis } from "~/types/analytics";
import type { FaqEntry, KegiatanAgenda, KlinikPoli, KontakHotline, ProdukPublik } from "~/types/program";

/**
 * Directus schema for the SDK client (`useDirectus()`).
 * List collections are arrays; fields on `directus_users` are merged into the core user type.
 */
export interface DirectusSchema {
  directus_users: {
    app_role: AppRole | null;
    instansi: string | null;
    /** Integer FK of the assigned wilayah; a plain id, a numeric string, or `{ id }` if expanded. */
    kota_scope: number | string | { id: number | string | null } | null;
    /** UUID FK of the account's own business; a plain id, or `{ id }` if expanded. */
    usaha: string | { id: string | null } | null;
    /**
     * Write-only: required by the authentication extension's password guard when a user
     * changes their own password via PATCH /users/me. Never returned by Directus.
     */
    current_password?: string;
  };
  analitik_view: SavedAnalysis[];
  usaha: { id: string; status: string }[];
  /** Published products, readable through the Public policy (ADR-006). */
  produk: ProdukPublik[];
  /** Region reference (kabupaten/kota) with a public read grant, for the catalogue filter. */
  kota: { id: number; nama: string }[];
  kegiatan: KegiatanAgenda[];
  faq: FaqEntry[];
  kontak_hotline: KontakHotline;
  konsultasi_poli: KlinikPoli[];
}

/** Skalar yang boleh muncul sebagai nilai filter Directus. */
export type FilterScalar = string | number | boolean;

/**
 * Pohon filter Directus (`{ field: { _eq: ... } }` bersarang) yang dibangun dinamis oleh
 * halaman publik (katalog/kegiatan). Nilainya konkret supaya pemanggil punya kontrak nyata.
 */
export interface FilterExpression {
  [operator: string]: FilterValue;
}

export type FilterValue = FilterScalar | FilterScalar[] | FilterExpression | FilterExpression[];

/** Query string URL yang dibangun halaman publik; semua nilainya string. */
export interface UrlQuery {
  [key: string]: string;
}

/** Query URL masuk dari vue-router: satu nilai, daftar nilai, atau kosong. */
export interface QueryValueMap {
  [key: string]: string | null | (string | null)[] | undefined;
}

/** Peta string berkunci runtime: kode error, label aksi, atau alasan yang tidak bisa dijadikan union tertutup. */
export interface RuntimeLabelMap {
  [key: string]: string;
}
