const KABKOTA_POLICY_ID = "542bb438-226b-49b6-8792-bcfc614560a5";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(
      `
      INSERT INTO directus_permissions(collection, action, permissions, validation, presets, fields, policy)
      SELECT * FROM (VALUES
        ('analitik_view','read','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,'{}'::jsonb,'id,owner,name,schema_version,config,date_created,date_updated',?::uuid ),
        ('analitik_view','create','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":"$CURRENT_USER"}'::jsonb,'id,owner,name,schema_version,config',?::uuid ),
        ('analitik_view','update','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,'name,config',?::uuid ),
        ('analitik_view','delete','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,NULL,?::uuid )
      ) AS seed(collection, action, permissions, validation, presets, fields, policy)
      WHERE NOT EXISTS (
        SELECT 1 FROM directus_permissions
        WHERE policy = ?::uuid AND collection = 'analitik_view' AND action = seed.action
      );
    `,
      [KABKOTA_POLICY_ID, KABKOTA_POLICY_ID, KABKOTA_POLICY_ID, KABKOTA_POLICY_ID, KABKOTA_POLICY_ID],
    );
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM directus_permissions WHERE policy = ? AND collection = 'analitik_view';`, [
      KABKOTA_POLICY_ID,
    ]);
  });
};
