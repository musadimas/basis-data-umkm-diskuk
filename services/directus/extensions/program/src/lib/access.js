import { ProgramError, rows } from "./utils/http.js";

/**
 * The signed-in user as the programme modules see them. Directus admins act as every role
 * (Brief Fitur: "super admin dulu"); other users are limited by app_role.
 */
export async function loadActor(database, accountability) {
  const row = rows(
    await database.raw(`SELECT id, app_role, usaha, kota_scope FROM directus_users WHERE id = ?`, [accountability.user]),
  )[0];
  return {
    id: accountability.user,
    admin: Boolean(accountability.admin),
    appRole: row?.app_role ?? null,
    usaha: row?.usaha ?? null,
    kotaScope: row?.kota_scope ?? null,
  };
}

/** SQL condition (on alias p = program_peserta) limiting participants to what the actor may see. */
export function pesertaScope(actor) {
  if (actor.admin || actor.appRole === "provinsi") return { sql: "TRUE", bindings: [] };
  if (actor.appRole === "kabkota" && actor.kotaScope) {
    return { sql: "EXISTS (SELECT 1 FROM usaha_tabular t WHERE t.id = p.usaha AND t.kota_id = ?)", bindings: [actor.kotaScope] };
  }
  if (actor.appRole === "pendamping") return { sql: "p.pendamping = ?", bindings: [actor.id] };
  if (actor.appRole === "umkm" && actor.usaha) return { sql: "p.usaha = ?", bindings: [actor.usaha] };
  return { sql: "FALSE", bindings: [] };
}

export function canSubmit(actor, peserta) {
  return actor.admin || (actor.usaha !== null && actor.usaha === peserta.usaha);
}

export function canReview(actor, peserta) {
  return actor.admin || actor.appRole === "provinsi" || (peserta.pendamping !== null && peserta.pendamping === actor.id);
}

export function forbidden() {
  return new ProgramError(403, "FORBIDDEN", "You do not have access to this participant.");
}
