/**
 * Enable pg_trgm extension for fast ILIKE and trigram search across businesses and owners.
 * Indexes are created concurrently via scripts/create-operasional-search-indexes.sql
 * to avoid locking tables during startup.
 */
export const up = async (knex) => {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
};

export const down = async () => {
  // No-op: extension may be shared with other database features.
};
