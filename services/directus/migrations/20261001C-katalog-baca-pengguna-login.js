// BUG-021 (QC 2026-10-01): Directus 11 hanya menerapkan Public policy pada request TANPA peran
// (@directus/api permissions/lib/fetch-policies.js). Pengguna login (dashboard & investor) memakai
// policy perannya, sehingga katalog publik, daftar wilayah katalog, dan FAQ gagal (403 → "Produk
// tidak ditemukan"). Baris read Public disalin apa adanya ke policy aplikasi dan investor.
const APP_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const INVESTOR_POLICY_ID = "89167fa4-30ad-4aec-9d97-d5256d5518df";
const TARGETS = [APP_POLICY_ID, INVESTOR_POLICY_ID];
const KOLEKSI = ["produk", "produk_foto", "kota", "faq", "directus_files"];
const FILE_KATALOG = '{"folder":{"_eq":"6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"}}';

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    for (const policy of TARGETS) {
      for (const collection of KOLEKSI) {
        await trx.raw(
          `INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
           SELECT p.collection, 'read', p.permissions, p.validation, p.presets, p.fields, ?::uuid
             FROM directus_permissions p
             JOIN directus_access pub ON pub.policy = p.policy AND pub.role IS NULL AND pub."user" IS NULL
            WHERE p.collection = ? AND p.action = 'read'
              AND (p.collection <> 'directus_files' OR p.permissions::jsonb = ?::jsonb)
              AND NOT EXISTS (
                SELECT 1 FROM directus_permissions q
                 WHERE q.policy = ?::uuid AND q.collection = p.collection AND q.action = 'read'
                   AND q.permissions::jsonb IS NOT DISTINCT FROM p.permissions::jsonb
              )`,
          [policy, collection, FILE_KATALOG, policy],
        );
      }
    }
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE policy IN (?::uuid, ?::uuid) AND action = 'read' AND collection IN ('produk', 'produk_foto', 'kota', 'faq')`,
      TARGETS,
    );
    await trx.raw(
      `DELETE FROM directus_permissions
        WHERE policy IN (?::uuid, ?::uuid) AND action = 'read' AND collection = 'directus_files'
          AND permissions::jsonb = ?::jsonb`,
      [...TARGETS, FILE_KATALOG],
    );
  });
};
