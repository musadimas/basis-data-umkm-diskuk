// Session policy for ADR-001 #5 (idle timeout + absolute lifetime), enforced by the
// authentication extension's session-guard hook. Extends Directus' own session rows:
// - date_created: login time. Directus inserts a new row on every refresh, so the hook copies
//   the value from the previous row (linked via next_token) to keep the lifetime absolute.
// - date_updated: last request made with the session, for the idle timeout.
// Existing sessions get NOW(), so their clocks start at deploy time.
export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE directus_sessions
      ADD COLUMN IF NOT EXISTS date_created   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE directus_sessions
      DROP COLUMN IF EXISTS date_updated,
      DROP COLUMN IF EXISTS date_created;
  `);
};
