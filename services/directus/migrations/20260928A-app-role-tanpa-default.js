// ADR-009 (fail-closed): an account without an explicit app_role has no access. 20260926A gave the
// column DEFAULT 'provinsi', so every account created without a role silently got province-wide
// access. Existing rows are left as they are: an old default cannot be told apart from a deliberate
// 'provinsi', so accounts are reviewed by a person, not rewritten here.

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE directus_users
      ALTER COLUMN app_role DROP DEFAULT,
      ALTER COLUMN app_role DROP NOT NULL;
  `);
};

// Restores the old column shape. SET NOT NULL fails while any account has no role, on purpose:
// rolling back must never hand those accounts 'provinsi'. Assign their roles first.
export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE directus_users
      ALTER COLUMN app_role SET DEFAULT 'provinsi',
      ALTER COLUMN app_role SET NOT NULL;
  `);
};
