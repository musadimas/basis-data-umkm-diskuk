const FINANCIAL_FIELDS = ["omzet_tahunan", "total_aset"];

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      ALTER TABLE analitik_dim_aggregate
        ADD COLUMN IF NOT EXISTS omzet_value NUMERIC(30,0) NOT NULL DEFAULT 0 CHECK (omzet_value >= 0),
        ADD COLUMN IF NOT EXISTS omzet_matched BIGINT NOT NULL DEFAULT 0 CHECK (omzet_matched >= 0),
        ADD COLUMN IF NOT EXISTS omzet_missing BIGINT NOT NULL DEFAULT 0 CHECK (omzet_missing >= 0),
        ADD COLUMN IF NOT EXISTS omzet_needs_verification BIGINT NOT NULL DEFAULT 0 CHECK (omzet_needs_verification >= 0),
        ADD COLUMN IF NOT EXISTS aset_value NUMERIC(30,0) NOT NULL DEFAULT 0 CHECK (aset_value >= 0),
        ADD COLUMN IF NOT EXISTS aset_matched BIGINT NOT NULL DEFAULT 0 CHECK (aset_matched >= 0),
        ADD COLUMN IF NOT EXISTS aset_missing BIGINT NOT NULL DEFAULT 0 CHECK (aset_missing >= 0),
        ADD COLUMN IF NOT EXISTS aset_needs_verification BIGINT NOT NULL DEFAULT 0 CHECK (aset_needs_verification >= 0)
    `);
    await trx.raw(`
      UPDATE analitik_field
      SET semantic_role='metric',
          lifecycle_status='quarantined',
          privacy_class='aggregate',
          null_policy='exclude_and_report',
          aggregation_capabilities='["sum"]'::jsonb,
          label=CASE semantic_id
            WHEN 'omzet_tahunan' THEN 'Total omzet tahunan dilaporkan'
            ELSE 'Total aset dilaporkan'
          END,
          error_metadata='{"code":"AWAITING_RECONCILED_FINANCIAL_ROLLUP"}'::jsonb,
          updated_at=NOW()
      WHERE semantic_id IN (?,?)
    `, FINANCIAL_FIELDS);
    await trx.raw(`
      INSERT INTO analitik_job(job_type,dedupe_key,status,priority,request)
      SELECT 'reconcile','activate_financial_metrics','queued',10,'{"reason":"activate_financial_metrics"}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM analitik_job
        WHERE dedupe_key='activate_financial_metrics' AND status IN ('queued','processing','retry')
      )
    `);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      UPDATE analitik_field
      SET semantic_role='profile', lifecycle_status='quarantined', privacy_class='restricted',
          null_policy='explicit_unknown', aggregation_capabilities='[]'::jsonb,
          error_metadata='{}'::jsonb, updated_at=NOW()
      WHERE semantic_id IN (?,?)
    `, FINANCIAL_FIELDS);
    await trx.raw(`
      DELETE FROM analitik_job
      WHERE dedupe_key='activate_financial_metrics' AND status='queued'
        AND request->>'reason'='activate_financial_metrics'
    `);
    await trx.raw(`
      ALTER TABLE analitik_dim_aggregate
        DROP COLUMN IF EXISTS omzet_value,
        DROP COLUMN IF EXISTS omzet_matched,
        DROP COLUMN IF EXISTS omzet_missing,
        DROP COLUMN IF EXISTS omzet_needs_verification,
        DROP COLUMN IF EXISTS aset_value,
        DROP COLUMN IF EXISTS aset_matched,
        DROP COLUMN IF EXISTS aset_missing,
        DROP COLUMN IF EXISTS aset_needs_verification
    `);
  });
};
