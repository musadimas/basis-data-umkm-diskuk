import { ProgramError, rows } from "./utils/http.js";

/**
 * The signed-in user as the programme modules see them. Directus admins act as every role
 * (Brief Fitur: "super admin dulu"); other users are limited by the app_role on their account row.
 * Fail-closed (ADR-009): an unreadable row is not signed in, and a row without app_role gets a
 * null role that every scope check rejects. The session never supplies a role.
 */
export async function loadActor(database, accountability) {
  if (accountability?.admin) {
    return {
      id: accountability.user,
      admin: true,
      appRole: "provinsi",
      usaha: null,
      kotaScope: null,
    };
  }
  const row = rows(
    await database.raw(`SELECT id, app_role, usaha, kota_scope FROM directus_users WHERE id = ?`, [accountability?.user]),
  )[0];
  if (!row) throw new ProgramError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return {
    id: accountability.user,
    admin: false,
    appRole: row.app_role ?? null,
    usaha: row.usaha ?? null,
    kotaScope: row.kota_scope ?? null,
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

export function assertTalentAccess(actor) {
  if (actor.admin || actor.appRole === "provinsi" || actor.appRole === "kabkota") {
    return;
  }
  throw new ProgramError(403, "FORBIDDEN", "You do not have access to Talent Scouting.");
}

export function assertBeritaAcaraAccess(actor) {
  if (actor.admin || actor.appRole === "provinsi") {
    return;
  }
  throw new ProgramError(403, "FORBIDDEN", "Only provincial administrators can issue a Berita Acara.");
}

export function assertUsahaInActorScope(actor, usaha) {
  if (actor.admin || actor.appRole === "provinsi") return;
  if (actor.appRole === "kabkota") {
    if (!actor.kotaScope) {
      throw new ProgramError(403, "KOTA_NOT_ASSIGNED", "Petugas kab/kota belum memiliki penugasan kota.");
    }
    // A business whose kota is unknown is outside every kab/kota assignment.
    if (usaha.kotaId === null || usaha.kotaId === undefined || Number(usaha.kotaId) !== Number(actor.kotaScope)) {
      throw new ProgramError(403, "FORBIDDEN", "Usaha berada di luar wilayah penugasan.");
    }
    return;
  }
  if (actor.appRole === "umkm" && actor.usaha && String(actor.usaha) === String(usaha.id)) {
    return;
  }
  throw new ProgramError(403, "FORBIDDEN", "You do not have access to this business.");
}

export function forbidden() {
  return new ProgramError(403, "FORBIDDEN", "You do not have access to this participant.");
}
