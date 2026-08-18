const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS analitik_kbli_sector (
        id BIGSERIAL PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
        code CHAR(1) NOT NULL, name TEXT NOT NULL, division_start SMALLINT NOT NULL,
        division_end SMALLINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(schema_version, code), CHECK (division_start BETWEEN 1 AND 99), CHECK (division_end >= division_start)
      );
      CREATE TABLE IF NOT EXISTS analitik_field (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), semantic_id TEXT NOT NULL UNIQUE,
        source_collection TEXT NOT NULL, source_field TEXT NOT NULL, label TEXT NOT NULL,
        description TEXT, field_group TEXT NOT NULL DEFAULT 'lainnya', sort_order INTEGER NOT NULL DEFAULT 0,
        semantic_role TEXT NOT NULL CHECK (semantic_role IN ('metric','dimension','filter','profile','quality')),
        data_type TEXT NOT NULL CHECK (data_type IN ('count','text','number','date','boolean','enum','geometry')),
        lifecycle_status TEXT NOT NULL DEFAULT 'discovered' CHECK (lifecycle_status IN ('discovered','quarantined','active','tombstoned')),
        privacy_class TEXT NOT NULL DEFAULT 'aggregate' CHECK (privacy_class IN ('aggregate','profile_masked','profile_safe','restricted')),
        masking_policy TEXT NOT NULL DEFAULT 'none', null_policy TEXT NOT NULL DEFAULT 'explicit_unknown',
        aggregation_capabilities JSONB NOT NULL DEFAULT '[]', expression_key TEXT NOT NULL,
        projection_state TEXT NOT NULL DEFAULT 'pending' CHECK (projection_state IN ('pending','projected','indexed','failed')),
        aliases JSONB NOT NULL DEFAULT '[]', schema_version INTEGER NOT NULL DEFAULT 1,
        error_metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analitik_field_active ON analitik_field(lifecycle_status, projection_state);
      CREATE TABLE IF NOT EXISTS analitik_view (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner UUID NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120), schema_version INTEGER NOT NULL DEFAULT 1,
        config JSONB NOT NULL, date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(), date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_analitik_view_owner_name ON analitik_view(owner, lower(name));
      CREATE TABLE IF NOT EXISTS analitik_job (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sequence BIGSERIAL UNIQUE,
        job_type TEXT NOT NULL CHECK (job_type IN ('project_record_change','rebuild_current_model','reconcile','registry_sync','export')),
        dedupe_key TEXT NOT NULL, entity_id UUID, status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','retry','completed','dead','cancelled')),
        priority SMALLINT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100), attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5), max_attempts SMALLINT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 5),
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lease_until TIMESTAMPTZ, lease_owner TEXT, checkpoint JSONB,
        source_high_water BIGINT, correlation_id UUID, request JSONB, owner UUID REFERENCES directus_users(id) ON DELETE SET NULL,
        schema_version INTEGER NOT NULL DEFAULT 1, masking_version INTEGER NOT NULL DEFAULT 1, export_type TEXT,
        error_code TEXT, error_message TEXT, request_hash CHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_analitik_job_live_dedupe ON analitik_job(dedupe_key) WHERE status IN ('queued','processing','retry');
      CREATE INDEX IF NOT EXISTS idx_analitik_job_claim ON analitik_job(status, available_at, priority DESC, sequence);
      CREATE TABLE IF NOT EXISTS analitik_health (
        id BIGSERIAL PRIMARY KEY, health_kind TEXT NOT NULL CHECK (health_kind IN ('component_status','incident','reconciliation')),
        component TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('healthy','degraded','stale','critical','open','resolved','passed','failed')),
        fingerprint TEXT, heartbeat_at TIMESTAMPTZ, last_success_at TIMESTAMPTZ, queue_age_seconds INTEGER,
        freshness_seconds INTEGER, api_p50_ms INTEGER, api_p95_ms INTEGER, api_p99_ms INTEGER,
        request_count INTEGER, error_count INTEGER, timeout_count INTEGER, check_name TEXT, check_data JSONB NOT NULL DEFAULT '{}',
        error_code TEXT, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_analitik_health_component ON analitik_health(health_kind, component) WHERE health_kind='component_status';
      CREATE UNIQUE INDEX IF NOT EXISTS ux_analitik_health_incident ON analitik_health(health_kind, component, fingerprint) WHERE health_kind='incident' AND status='open';
      CREATE TABLE IF NOT EXISTS analitik_generation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status TEXT NOT NULL CHECK (status IN ('candidate','active','previous','failed')),
        schema_version INTEGER NOT NULL DEFAULT 1, registry_version INTEGER NOT NULL DEFAULT 1, masking_version INTEGER NOT NULL DEFAULT 1,
        source_high_water BIGINT, outbox_high_water BIGINT, row_count BIGINT NOT NULL DEFAULT 0,
        data_as_of TIMESTAMPTZ, build_started_at TIMESTAMPTZ, build_finished_at TIMESTAMPTZ,
        reconciled_at TIMESTAMPTZ, reconciliation_status TEXT CHECK (reconciliation_status IN ('pending','passed','failed')),
        error_code TEXT, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analitik_generation_status ON analitik_generation(status, created_at DESC);
      CREATE TABLE IF NOT EXISTS analitik_active_generation (
        id SMALLINT PRIMARY KEY CHECK (id=1), active_generation_id UUID REFERENCES analitik_generation(id), previous_generation_id UUID REFERENCES analitik_generation(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO analitik_active_generation(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS analitik_usaha_current (
        generation_id UUID NOT NULL REFERENCES analitik_generation(id) ON DELETE CASCADE, usaha_id UUID NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','archived')), nama TEXT NOT NULL, kegiatan_utama TEXT, produk_utama TEXT,
        status_hukum TEXT, skala TEXT, kota_id INTEGER, kota_kode TEXT, kota_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
        kecamatan_id INTEGER, kecamatan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui', kelurahan_id INTEGER, kelurahan_nama TEXT NOT NULL DEFAULT 'Tidak diketahui',
        kode_kbli TEXT, kategori_kbli TEXT, sektor_kbli CHAR(1), omzet_tahunan BIGINT, total_aset BIGINT,
        omzet_quality TEXT NOT NULL DEFAULT 'missing' CHECK (omzet_quality IN ('reported','missing','needs_verification')),
        aset_quality TEXT NOT NULL DEFAULT 'missing' CHECK (aset_quality IN ('reported','missing','needs_verification')),
        masked_nik TEXT, masked_phone TEXT, owner_name TEXT, age_band TEXT,
        business_address TEXT, latitude NUMERIC(10,8), longitude NUMERIC(11,8), extra_fields JSONB NOT NULL DEFAULT '{}',
        source_hash CHAR(64), source_updated_at TIMESTAMPTZ, projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (generation_id, usaha_id)
      );
      CREATE INDEX IF NOT EXISTS idx_analitik_current_city ON analitik_usaha_current(generation_id, kota_id);
      CREATE INDEX IF NOT EXISTS idx_analitik_current_sector ON analitik_usaha_current(generation_id, sektor_kbli);
      CREATE INDEX IF NOT EXISTS idx_analitik_current_scale ON analitik_usaha_current(generation_id, skala);
      CREATE INDEX IF NOT EXISTS idx_analitik_current_status ON analitik_usaha_current(generation_id, status);
    `);
    await trx.raw(`
      CREATE OR REPLACE FUNCTION analitik_validate_json_config() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      BEGIN
        IF TG_TABLE_NAME = 'analitik_view' AND COALESCE(NEW.config::text, '') ~* '(nik|telepon|phone|birth_date|password|secret|token|cookie|result|rows|record_id|signed_url)' THEN
          RAISE EXCEPTION 'analytics config contains restricted data' USING ERRCODE='check_violation';
        ELSIF TG_TABLE_NAME = 'analitik_job' AND COALESCE(NEW.request::text, '') ~* '(nik|telepon|phone|birth_date|password|secret|token|cookie|result|rows|record_id|signed_url)' THEN
          RAISE EXCEPTION 'analytics request contains restricted data' USING ERRCODE='check_violation';
        END IF;
        RETURN NEW;
      END; $$;
      DROP TRIGGER IF EXISTS trg_analitik_view_config ON analitik_view;
      CREATE TRIGGER trg_analitik_view_config BEFORE INSERT OR UPDATE ON analitik_view
        FOR EACH ROW EXECUTE FUNCTION analitik_validate_json_config();
      DROP TRIGGER IF EXISTS trg_analitik_job_request ON analitik_job;
      CREATE TRIGGER trg_analitik_job_request BEFORE INSERT OR UPDATE ON analitik_job
        FOR EACH ROW EXECUTE FUNCTION analitik_validate_json_config();

      CREATE OR REPLACE FUNCTION analitik_require_reconciled_generation() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      DECLARE state TEXT; reconciled TEXT;
      BEGIN
        IF NEW.active_generation_id IS NULL THEN RETURN NEW; END IF;
        SELECT status, reconciliation_status INTO state, reconciled FROM analitik_generation WHERE id=NEW.active_generation_id;
        IF state IS DISTINCT FROM 'active' OR reconciled IS DISTINCT FROM 'passed' THEN RAISE EXCEPTION 'active generation must be reconciled' USING ERRCODE='check_violation'; END IF;
        RETURN NEW;
      END; $$;
      DROP TRIGGER IF EXISTS trg_analitik_active_generation ON analitik_active_generation;
      CREATE TRIGGER trg_analitik_active_generation BEFORE INSERT OR UPDATE ON analitik_active_generation
        FOR EACH ROW EXECUTE FUNCTION analitik_require_reconciled_generation();

      CREATE OR REPLACE FUNCTION analitik_enqueue_job(p_type TEXT, p_dedupe TEXT, p_entity UUID DEFAULT NULL)
      RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      DECLARE result_id UUID;
      BEGIN
        INSERT INTO analitik_job(job_type, dedupe_key, entity_id, status, available_at)
        VALUES (p_type, p_dedupe, p_entity, 'queued', NOW())
        ON CONFLICT (dedupe_key) WHERE status IN ('queued','processing','retry')
        DO UPDATE SET available_at=LEAST(analitik_job.available_at, EXCLUDED.available_at), updated_at=NOW()
        RETURNING id INTO result_id;
        RETURN result_id;
      END; $$;

      CREATE OR REPLACE FUNCTION analitik_capture_source_change() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      DECLARE source_id UUID;
      BEGIN
        IF current_setting('diskuk.analytics_bulk_ingest', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
        IF TG_TABLE_NAME = 'usaha' THEN
          source_id := COALESCE(NEW.id, OLD.id);
          PERFORM analitik_enqueue_job('project_record_change', 'project_record:' || source_id::text, source_id);
        ELSE
          PERFORM analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL);
        END IF;
        RETURN COALESCE(NEW, OLD);
      END; $$;
    `);
    for (const table of ["usaha", "pelaku_usaha", "alamat", "provinsi", "kota", "kecamatan", "kelurahan", "klasifikasi_usaha", "statistik_tenaga_kerja"]) {
      const trigger = `trg_analitik_capture_${table}`;
      await trx.raw(`DROP TRIGGER IF EXISTS ?? ON ??; CREATE TRIGGER ?? AFTER INSERT OR UPDATE OR DELETE ON ?? FOR EACH ROW EXECUTE FUNCTION analitik_capture_source_change();`, [trigger, table, trigger, table]);
    }
    await trx.raw(`
      INSERT INTO directus_collections(collection, icon, note, display_template, hidden, singleton, archive_app_filter, sort)
      VALUES
        ('analitik_field','tune','Server-owned semantic field registry',NULL,TRUE,FALSE,TRUE,100),
        ('analitik_view','dashboard','Saved private analysis', '{{name}}',FALSE,FALSE,TRUE,101),
        ('analitik_job','sync','Analytics jobs and exports',NULL,TRUE,FALSE,TRUE,102),
        ('analitik_health','monitor_heart','Internal analytics health',NULL,TRUE,FALSE,TRUE,103),
        ('analitik_generation','layers','Analytics read-model generations',NULL,TRUE,FALSE,TRUE,104)
      ON CONFLICT (collection) DO NOTHING;
      INSERT INTO directus_permissions(collection, action, permissions, validation, presets, fields, policy)
      VALUES
        ('analitik_view','read','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,'{}'::jsonb,'id,owner,name,schema_version,config,date_created,date_updated',? ),
        ('analitik_view','create','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":"$CURRENT_USER"}'::jsonb,'id,owner,name,schema_version,config',? ),
        ('analitik_view','update','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,'name,config',? ),
        ('analitik_view','delete','{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{"owner":{"_eq":"$CURRENT_USER"}}'::jsonb,'{}'::jsonb,NULL,? ),
        ('usaha','read','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'id,sumber_id,nama,kegiatan_utama,produk_utama,status_hukum,skala,alamat,latitude,longitude,status',? ),
        ('usaha','update','{}'::jsonb,'{"status":{"_in":["active","archived"]}}'::jsonb,'{}'::jsonb,'status',? )
      ON CONFLICT DO NOTHING;
    `, [POLICY_ID,POLICY_ID,POLICY_ID,POLICY_ID,POLICY_ID,POLICY_ID]);
  });
};

export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    const result = await trx.raw(`SELECT (SELECT COUNT(*) FROM analitik_job)+(SELECT COUNT(*) FROM analitik_view)+(SELECT COUNT(*) FROM analitik_generation)+(SELECT COUNT(*) FROM analitik_usaha_current) AS count`);
    const count = Number(result.rows?.[0]?.count ?? result[0]?.count ?? 0);
    if (count > 0) throw new Error("Refusing analytics foundation rollback while analytics data exists");
    await trx.raw(`
      DROP TRIGGER IF EXISTS trg_analitik_capture_usaha ON usaha;
      DROP TRIGGER IF EXISTS trg_analitik_capture_pelaku_usaha ON pelaku_usaha;
      DROP TRIGGER IF EXISTS trg_analitik_capture_alamat ON alamat;
      DROP TRIGGER IF EXISTS trg_analitik_capture_provinsi ON provinsi;
      DROP TRIGGER IF EXISTS trg_analitik_capture_kota ON kota;
      DROP TRIGGER IF EXISTS trg_analitik_capture_kecamatan ON kecamatan;
      DROP TRIGGER IF EXISTS trg_analitik_capture_kelurahan ON kelurahan;
      DROP TRIGGER IF EXISTS trg_analitik_capture_klasifikasi_usaha ON klasifikasi_usaha;
      DROP TRIGGER IF EXISTS trg_analitik_capture_statistik_tenaga_kerja ON statistik_tenaga_kerja;
      DROP FUNCTION IF EXISTS analitik_capture_source_change();
      DROP FUNCTION IF EXISTS analitik_enqueue_job(TEXT,TEXT,UUID);
      DROP FUNCTION IF EXISTS analitik_require_reconciled_generation();
      DROP FUNCTION IF EXISTS analitik_validate_json_config();
      DELETE FROM directus_permissions WHERE policy = ? AND collection IN ('analitik_view','usaha');
      DELETE FROM directus_collections WHERE collection IN ('analitik_field','analitik_view','analitik_job','analitik_health','analitik_generation');
      DROP TABLE IF EXISTS analitik_usaha_current;
      DROP TABLE IF EXISTS analitik_active_generation;
      DROP TABLE IF EXISTS analitik_generation;
      DROP TABLE IF EXISTS analitik_health;
      DROP TABLE IF EXISTS analitik_job;
      DROP TABLE IF EXISTS analitik_view;
      DROP TABLE IF EXISTS analitik_field;
      DROP TABLE IF EXISTS analitik_kbli_sector;
    `, [POLICY_ID]);
  });
};
