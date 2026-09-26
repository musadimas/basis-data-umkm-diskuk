const { sourceCache } = require("./runtime-cache.js");

const CURRENT_SOURCE = "analitik_usaha_current a";
const SNAPSHOT_SOURCE = `(
  SELECT
    t.id AS usaha_id, 'active'::text AS status, t.nama, t.skala,
    t.kota_id, k.kode AS kota_kode, COALESCE(t.kota_nama, 'Tidak diketahui') AS kota_nama,
    t.kecamatan_id, COALESCE(t.kecamatan_nama, 'Tidak diketahui') AS kecamatan_nama,
    t.kelurahan_id, COALESCE(t.kelurahan_nama, 'Tidak diketahui') AS kelurahan_nama,
    t.kode_kbli, t.kategori_kbli, NULL::text AS status_hukum,
    (SELECT s.code FROM analitik_kbli_sector s
      WHERE s.schema_version = 1 AND t.kode_kbli ~ '^[0-9]{2,5}$'
        AND left(t.kode_kbli, 2)::integer BETWEEN s.division_start AND s.division_end
      LIMIT 1) AS sektor_kbli
  FROM usaha_tabular t
  LEFT JOIN kota k ON k.id = t.kota_id
) a`;

async function resolveAnalyticsSource(database) {
  // Try new columns first, fallback to legacy row_count for older schema
  let generation;
  try {
    const generationResult = await database.raw(
      `SELECT g.id,g.status,g.data_as_of,g.reconciled_at,g.row_count,g.active_row_count,g.archived_row_count FROM analitik_active_generation p JOIN analitik_generation g ON g.id=p.active_generation_id WHERE p.id=1`,
    );
    generation = (generationResult.rows ?? generationResult[0] ?? [])[0];
  } catch {
    const generationResult = await database.raw(
      `SELECT g.id,g.status,g.data_as_of,g.reconciled_at,g.row_count FROM analitik_active_generation p JOIN analitik_generation g ON g.id=p.active_generation_id WHERE p.id=1`,
    );
    generation = (generationResult.rows ?? generationResult[0] ?? [])[0];
  }
  if (generation) {
    const current = generation.status === "active" && generation.reconciled_at;
    const activeCount =
      generation.active_row_count != null
        ? Number(generation.active_row_count)
        : null;
    const archivedCount =
      generation.archived_row_count != null
        ? Number(generation.archived_row_count)
        : null;
    const totalCount = Number(generation.row_count ?? 0) || null;
    return {
      fromSql: CURRENT_SOURCE,
      scopeSql: "a.generation_id = ?",
      scopeParams: [generation.id],
      dataAsOf: generation.data_as_of,
      status: current ? "current" : "stale_last_good",
      warnings: current
        ? []
        : ["Data terakhir yang berhasil diproses sedang ditampilkan."],
      kind: "generation",
      generationId: generation.id,
      rowCount: totalCount,
      activeRowCount: activeCount,
      archivedRowCount: archivedCount,
    };
  }
  const snapshotResult = await database.raw(
    `SELECT refreshed_at,(payload->'scales'->>'total')::integer AS population,payload->'scales' AS scales,payload->'regions' AS regions FROM infografis_snapshot WHERE id = 1`,
  );
  const snapshot = (snapshotResult.rows ?? snapshotResult[0] ?? [])[0];
  if (!snapshot) return null;
  return {
    fromSql: SNAPSHOT_SOURCE,
    scopeSql: "TRUE",
    scopeParams: [],
    dataAsOf: snapshot.refreshed_at,
    status: "stale_last_good",
    warnings: [
      "Read-model analitik belum aktif; snapshot dashboard terpublikasi sedang digunakan.",
    ],
    kind: "snapshot",
    population: Number(snapshot.population || 0),
    scales: snapshot.scales || {},
    regions: Array.isArray(snapshot.regions) ? snapshot.regions : [],
  };
}

// Hot-path wrapper: the active-generation lookup runs on every analytics
// request; a 5s TTL keeps promotion lag negligible while removing one round
// trip per request. Callers must treat the returned object as immutable.
async function resolveAnalyticsSourceCached(database) {
  return sourceCache.getOrLoad(() => resolveAnalyticsSource(database));
}

module.exports = {
  resolveAnalyticsSource,
  resolveAnalyticsSourceCached,
  CURRENT_SOURCE,
  SNAPSHOT_SOURCE,
};
