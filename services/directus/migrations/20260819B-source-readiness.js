const newFields = [
  ["status", "select-dropdown", false, false, 22, "Status current-state: active atau archived"],
  ["source_pulled_at", "datetime", true, true, 23, "Waktu data ditarik dari SIDT (UTC)"],
  ["source_updated_at", "datetime", true, true, 24, "Waktu perubahan sumber (UTC)"],
  ["source_hash", "input", true, true, 25, "Hash sumber internal"],
];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await trx.raw(`
      ALTER TABLE usaha
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS source_pulled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS source_hash CHAR(64);
      UPDATE usaha SET status = 'active' WHERE status IS NULL;
      ALTER TABLE usaha DROP CONSTRAINT IF EXISTS usaha_status_check;
      ALTER TABLE usaha ADD CONSTRAINT usaha_status_check CHECK (status IN ('active', 'archived'));
      CREATE INDEX IF NOT EXISTS idx_usaha_status ON usaha(status);
      CREATE INDEX IF NOT EXISTS idx_usaha_source_updated_at ON usaha(source_updated_at);
      CREATE INDEX IF NOT EXISTS idx_usaha_source_pulled_at ON usaha(source_pulled_at);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_usaha_sumber_id_nonnull ON usaha(sumber_id) WHERE sumber_id IS NOT NULL;

      ALTER TABLE usaha_tabular
        ALTER COLUMN kota_id DROP NOT NULL,
        ALTER COLUMN kecamatan_id DROP NOT NULL,
        ALTER COLUMN kelurahan_id DROP NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_usaha_tabular_nullable_geography ON usaha_tabular(kota_id, kecamatan_id, kelurahan_id);
    `);
    await trx.raw(`
      UPDATE directus_collections
      SET archive_field = 'status', archive_app_filter = TRUE, archive_value = 'archived', unarchive_value = 'active'
      WHERE collection = 'usaha';
    `);
    for (const [field, iface, readonly, hidden, sort, note] of newFields) {
      await trx.raw(`
        UPDATE directus_fields
        SET interface = ?, readonly = ?, hidden = ?, sort = ?, note = ?
        WHERE collection = 'usaha' AND field = ?;
      `, [iface, readonly, hidden, sort, note, field]);
      await trx.raw(`
        INSERT INTO directus_fields
          (collection, field, interface, readonly, hidden, sort, width, note, required)
        SELECT 'usaha', ?, ?, ?, ?, ?, 'half', ?, FALSE
        WHERE NOT EXISTS (
          SELECT 1 FROM directus_fields
          WHERE collection = 'usaha' AND field = ?
        );
      `, [field, iface, readonly, hidden, sort, note, field]);
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    const result = await trx.raw(`SELECT COUNT(*)::integer AS count FROM usaha`);
    const count = Number(result.rows?.[0]?.count ?? result[0]?.count ?? 0);
    if (count > 0) throw new Error("Refusing source-readiness rollback while usaha contains data; use an empty ephemeral database");
    await trx.raw(`
      DELETE FROM directus_fields WHERE collection = 'usaha' AND field IN ('status','source_pulled_at','source_updated_at','source_hash');
      ALTER TABLE usaha_tabular
        ALTER COLUMN kota_id SET NOT NULL,
        ALTER COLUMN kecamatan_id SET NOT NULL,
        ALTER COLUMN kelurahan_id SET NOT NULL;
      DROP INDEX IF EXISTS idx_usaha_tabular_nullable_geography;
      DROP INDEX IF EXISTS ux_usaha_sumber_id_nonnull;
      DROP INDEX IF EXISTS idx_usaha_source_updated_at;
      DROP INDEX IF EXISTS idx_usaha_source_pulled_at;
      DROP INDEX IF EXISTS idx_usaha_status;
      ALTER TABLE usaha DROP CONSTRAINT IF EXISTS usaha_status_check;
      ALTER TABLE usaha
        DROP COLUMN IF EXISTS source_hash,
        DROP COLUMN IF EXISTS source_updated_at,
        DROP COLUMN IF EXISTS source_pulled_at,
        DROP COLUMN IF EXISTS status;
      UPDATE directus_collections
      SET archive_field = NULL, archive_value = NULL, unarchive_value = NULL
      WHERE collection = 'usaha';
    `);
  });
};
