// Y04/M6-01: Talent Passport signatures move from HMAC-SHA256 to Ed25519 (non-repudiation). An
// Ed25519 signature is 64 bytes, so base64 (86–88 chars) no longer fits in CHAR(64); kid records
// which signing key produced each passport so rotation is auditable. Rows signed with the old
// HMAC simply fail verification until they are re-issued — verification never pretends an
// unverifiable passport is valid.
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE talent_passport ALTER COLUMN signature TYPE VARCHAR(128);
      ALTER TABLE talent_passport ADD COLUMN IF NOT EXISTS kid VARCHAR(64);

      INSERT INTO directus_fields
        (collection, field, special, interface, options, display, display_options,
         readonly, hidden, sort, width, translations, note, conditions,
         required, "group", validation, validation_message)
      VALUES
        ('talent_passport', 'kid', NULL, 'input', NULL, NULL, NULL, TRUE, TRUE, 17, 'half', NULL,
         'Identifier kunci Ed25519 yang menandatangani passport (rotasi)', NULL, FALSE, NULL, NULL, NULL)
      ON CONFLICT DO NOTHING;
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      DELETE FROM directus_fields WHERE collection = 'talent_passport' AND field = 'kid';
      ALTER TABLE talent_passport DROP COLUMN IF EXISTS kid;
      ALTER TABLE talent_passport ALTER COLUMN signature TYPE CHAR(64);
    `);
  });
};
