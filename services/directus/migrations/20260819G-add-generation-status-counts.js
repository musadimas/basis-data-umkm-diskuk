export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE analitik_generation
      ADD COLUMN IF NOT EXISTS active_row_count BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS archived_row_count BIGINT NOT NULL DEFAULT 0;
    -- Backfill from existing read model where possible
    UPDATE analitik_generation g
    SET active_row_count = COALESCE((SELECT COUNT(*)::bigint FROM analitik_usaha_current a WHERE a.generation_id = g.id AND a.status='active'), 0),
        archived_row_count = COALESCE((SELECT COUNT(*)::bigint FROM analitik_usaha_current a WHERE a.generation_id = g.id AND a.status='archived'), 0)
    WHERE g.active_row_count = 0 AND g.archived_row_count = 0 AND g.row_count > 0;
  `);
};

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE analitik_generation
      DROP COLUMN IF EXISTS active_row_count,
      DROP COLUMN IF EXISTS archived_row_count;
  `);
};
