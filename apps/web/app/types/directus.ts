import type { AppRole } from "~/composables/useAuth";
import type { SavedAnalysis } from "~/types/analytics";

/**
 * Directus schema for the SDK client (`useDirectus()`).
 * List collections are arrays; fields on `directus_users` are merged into the core user type.
 */
export interface DirectusSchema {
  directus_users: {
    app_role: AppRole | null;
    instansi: string | null;
    /** Integer FK of the assigned wilayah; a plain id, a numeric string, or `{ id }` if expanded. */
    kota: number | string | { id: number | string | null } | null;
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
}
