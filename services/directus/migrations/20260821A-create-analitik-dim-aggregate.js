// Per-generation dimension rollup for the Analitik read model.
//
// The analytics API answers unfiltered single-dimension GROUP BYs from this
// table instead of scanning analitik_usaha_current (~5.4M rows) per request.
// Cardinality is bounded by reference data (kota/kecamatan/kelurahan, KBLI
// codes, enum scales/statuses), so the rollup stays in the tens of thousands
// of rows per generation — not a filter-combination cube (see ADR-0002 #7).
//
// Populated by services/analytics-worker during rebuildCurrentModel before
// promotion; removed automatically with its generation via ON DELETE CASCADE.

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS analitik_dim_aggregate (
        generation_id UUID NOT NULL REFERENCES analitik_generation(id) ON DELETE CASCADE,
        dimension TEXT NOT NULL,
        dimension_value TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        value BIGINT NOT NULL,
        PRIMARY KEY (generation_id, dimension, dimension_value, status),
        CHECK (value >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_analitik_dim_agg_scan
        ON analitik_dim_aggregate(generation_id, dimension);
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DROP TABLE IF EXISTS analitik_dim_aggregate`);
  });
};
