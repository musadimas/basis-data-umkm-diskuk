/**
 * BUG-017/018 (QC 2026-10-01): pencabutan oleh kurator adalah status tersendiri
 * ("Persetujuan dicabut"), terpisah dari usaha yang menarik persetujuan berbagi (`dicabut_pada`).
 */
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE investor_profil
        ADD COLUMN IF NOT EXISTS kurator_dicabut_oleh UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS kurator_dicabut_pada TIMESTAMPTZ;
      ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
      ALTER TABLE investor_profil ADD CONSTRAINT investor_profil_kurator_cabut_pair
        CHECK ((kurator_dicabut_oleh IS NULL) = (kurator_dicabut_pada IS NULL));
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE investor_profil DROP CONSTRAINT IF EXISTS investor_profil_kurator_cabut_pair;
      ALTER TABLE investor_profil DROP COLUMN IF EXISTS kurator_dicabut_pada;
      ALTER TABLE investor_profil DROP COLUMN IF EXISTS kurator_dicabut_oleh;
    `);
  });
};
