const { AnalyticsApiError } = require("./errors.js");

const KOTA_FIELDS = new Set(["kota_id", "kota_kode", "kota_nama"]);

// kabkota: buang filter kota dari klien lalu paksa satu filter kota_id milik
// wilayah operator, sehingga budget filter tidak bertambah dan hasil selalu
// terkunci pada kota sendiri. Role lain diteruskan apa adanya.
function scopeAnalysisRequest(request, operator) {
  if (operator?.role !== "kabkota") return request ?? {};
  if (operator.kotaId == null) {
    throw new AnalyticsApiError(403, "KOTA_NOT_ASSIGNED");
  }
  const source = request ?? {};
  const filters = Array.isArray(source.filters) ? source.filters : [];
  const kept = filters.filter((filter) => {
    const key = filter?.fieldId ?? filter?.field;
    return !KOTA_FIELDS.has(key);
  });
  return {
    ...source,
    filters: [...kept, { fieldId: "kota_id", operator: "eq", value: String(operator.kotaId) }],
  };
}

function permissionScopeOf(operator) {
  if (operator?.role === "kabkota" && operator?.kotaId != null) {
    return `kabkota:${operator.kotaId}`;
  }
  return "provinsi";
}

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

module.exports = { KOTA_FIELDS, scopeAnalysisRequest, permissionScopeOf, assertUsahaInScope };
