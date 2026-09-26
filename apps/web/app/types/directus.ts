import type { AppRole } from "~/composables/useAuth";
import type { SavedAnalysis } from "~/types/analytics";
import type { FaqEntry, Kegiatan, KontakHotline, ProdukPublik } from "~/types/program";

/**
 * Directus schema for the SDK client (`useDirectus()`).
 * List collections are arrays; fields on `directus_users` are merged into the core user type.
 */
export interface DirectusSchema {
  directus_users: {
    app_role: AppRole | null;
    instansi: string | null;
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
  kegiatan: Kegiatan[];
  faq: FaqEntry[];
  kontak_hotline: KontakHotline;
}
