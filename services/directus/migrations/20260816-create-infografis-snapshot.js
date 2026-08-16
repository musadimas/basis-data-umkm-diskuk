export const up = async (knex) => {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS infografis_snapshot (
      id           SMALLINT PRIMARY KEY CHECK (id = 1),
      payload      JSONB NOT NULL,
      refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

export const down = async (knex) => {
  await knex.raw('DROP TABLE IF EXISTS infografis_snapshot;');
};
