/**
 * Backfill compact scale-filtered rollups for already-published generations.
 * Future generations are populated by the analytics worker before promotion.
 */
const DIMENSIONS = Object.freeze([
  ["kota_id", "COALESCE(a.kota_id::text,'unknown')", "COALESCE(a.kota_nama,'Tidak diketahui')"],
  ["kota_kode", "COALESCE(a.kota_kode,'unknown')", "COALESCE(a.kota_nama,'Tidak diketahui')"],
  ["kota_nama", "COALESCE(a.kota_nama,'Tidak diketahui')", "COALESCE(a.kota_nama,'Tidak diketahui')"],
  ["kecamatan_id", "COALESCE(a.kecamatan_id::text,'unknown')", "COALESCE(a.kecamatan_nama,'Tidak diketahui')"],
  ["kecamatan_nama", "COALESCE(a.kecamatan_nama,'Tidak diketahui')", "COALESCE(a.kecamatan_nama,'Tidak diketahui')"],
  ["kelurahan_id", "COALESCE(a.kelurahan_id::text,'unknown')", "COALESCE(a.kelurahan_nama,'Tidak diketahui')"],
  ["kelurahan_nama", "COALESCE(a.kelurahan_nama,'Tidak diketahui')", "COALESCE(a.kelurahan_nama,'Tidak diketahui')"],
  ["sektor_kbli", "COALESCE(a.sektor_kbli,'unknown')", "COALESCE(a.sektor_kbli,'Tidak diketahui')"],
  ["kbli_kode", "COALESCE(a.kode_kbli,'unknown')", "COALESCE(a.kode_kbli,'Tidak diketahui')"],
  ["skala_dilaporkan", "COALESCE(a.skala,'unknown')", "CASE a.skala WHEN 'micro' THEN 'Mikro' WHEN 'small' THEN 'Kecil' WHEN 'medium' THEN 'Menengah' ELSE 'Tidak diketahui' END"],
  ["status_hukum", "COALESCE(a.status_hukum,'unknown')", "COALESCE(a.status_hukum,'Tidak diketahui')"],
  ["status_usaha", "COALESCE(a.status,'unknown')", "CASE a.status WHEN 'active' THEN 'Aktif' WHEN 'archived' THEN 'Diarsipkan' ELSE 'Tidak diketahui' END"],
  ["quality_geography", "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'unknown' ELSE 'mapped' END", "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'Tidak diketahui' ELSE 'Terpetakan' END"],
  ["quality_kbli", "CASE WHEN a.kode_kbli IS NULL THEN 'missing' WHEN a.sektor_kbli IS NULL THEN 'unmapped' ELSE 'mapped' END", "CASE WHEN a.kode_kbli IS NULL THEN 'Tidak ada kode' WHEN a.sektor_kbli IS NULL THEN 'Tidak terpetakan' ELSE 'Terpetakan' END"],
]);

const SELECTS = DIMENSIONS.map(([dimension, value, label]) => `
  SELECT a.generation_id,
    'scale:' || COALESCE(a.skala,'unknown') || ':${dimension}' AS dimension,
    ${value} AS dimension_value, ${label} AS label,
    a.status, COUNT(*)::bigint AS value
  FROM analitik_usaha_current a
  JOIN analitik_generation g ON g.id=a.generation_id AND g.status IN ('active','previous')
  GROUP BY 1,2,3,4,5
`).join(" UNION ALL ");

export const up = async (knex) => {
  await knex.raw(`
    INSERT INTO analitik_dim_aggregate(generation_id,dimension,dimension_value,label,status,value)
    ${SELECTS}
    ON CONFLICT (generation_id,dimension,dimension_value,status)
    DO UPDATE SET label=EXCLUDED.label,value=EXCLUDED.value
  `);
};

export const down = async (knex) => {
  await knex.raw(`DELETE FROM analitik_dim_aggregate WHERE dimension LIKE 'scale:%'`);
};
