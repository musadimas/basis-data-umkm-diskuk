import sharedCompiler from "../../../../../analytics-shared/query-compiler.cjs";
import { AnalyticsApiError } from "./errors.js";

const KOTA_FIELDS = sharedCompiler.KOTA_FIELDS;

// Partisi cache aggregate: satu keranjang per kota operator, admin tetap terpisah,
// dan role-key (bukan UUID role) yang dipakai sebagai bagian kunci.
function permissionScopeOf(operator) {
  if (operator?.admin === true) return "admin";
  if (operator?.role === "kabkota" && operator?.kotaId != null) {
    return `kabkota:${operator.kotaId}`;
  }
  return "provinsi";
}

// Profil usaha di luar wilayah operator dijawab 404 (bukan 403) supaya keberadaannya
// tidak bocor lewat perbedaan status.
async function assertUsahaInScope(database, usahaId, operator) {
  if (operator?.role !== "kabkota") return;
  if (operator.kotaId == null) {
    throw new AnalyticsApiError(403, "KOTA_NOT_ASSIGNED");
  }
  const result = await database.raw(
    `SELECT 1 FROM analitik_usaha_current c
     JOIN analitik_active_generation p ON p.id=1 AND p.active_generation_id=c.generation_id
     WHERE c.usaha_id=? AND c.kota_id=?`,
    [usahaId, operator.kotaId],
  );
  const rows = result?.rows ?? result ?? [];
  if (!rows.length) throw new AnalyticsApiError(404, "PROFILE_NOT_FOUND");
}

export { KOTA_FIELDS, permissionScopeOf, assertUsahaInScope };
