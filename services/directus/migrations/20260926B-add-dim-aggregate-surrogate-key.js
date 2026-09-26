// Directus only recognizes single-column primary keys; analitik_dim_aggregate had a composite
// one, so Directus logged "doesn't have a primary key column and will be ignored" on every
// schema load. Give it a surrogate identity key and keep the rollup identity as a UNIQUE
// constraint with the same columns, so the worker's
// `ON CONFLICT (generation_id, dimension, dimension_value, status)` upserts keep working.
//
// analitik_usaha_current cannot get the same fix: it is partitioned by generation_id, and
// PostgreSQL requires every primary key/unique constraint on a partitioned table to include
// the partition key. It is excluded from Directus via DB_EXCLUDE_TABLES instead (see
// docker-compose.yml); the analytics extensions and worker only reach it through raw SQL.

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE analitik_dim_aggregate
        ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY;

      ALTER TABLE analitik_dim_aggregate
        ADD CONSTRAINT analitik_dim_aggregate_rollup_key
          UNIQUE (generation_id, dimension, dimension_value, status);

      ALTER TABLE analitik_dim_aggregate DROP CONSTRAINT analitik_dim_aggregate_pkey;
      ALTER TABLE analitik_dim_aggregate ADD CONSTRAINT analitik_dim_aggregate_pkey PRIMARY KEY (id);
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE analitik_dim_aggregate DROP CONSTRAINT analitik_dim_aggregate_pkey;
      ALTER TABLE analitik_dim_aggregate
        ADD CONSTRAINT analitik_dim_aggregate_pkey
          PRIMARY KEY (generation_id, dimension, dimension_value, status);
      ALTER TABLE analitik_dim_aggregate DROP CONSTRAINT IF EXISTS analitik_dim_aggregate_rollup_key;
      ALTER TABLE analitik_dim_aggregate DROP COLUMN IF EXISTS id;
    `);
  });
};
