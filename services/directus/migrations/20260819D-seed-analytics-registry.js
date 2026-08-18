import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { KBLI_SECTORS, SCHEMA_VERSION, MASKING_VERSION } = require("../analytics-shared/contracts.cjs");
const FIELD_SEEDS = [
  ["5d84d56b-1538-4b2c-9ec7-000000000001","jumlah_umkm","usaha","id","Jumlah UMKM","metric","count","aggregate","COUNT_DISTINCT_USAHA",["count"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000002","usaha_id","usaha","id","ID usaha (internal)","profile","text","profile_safe","USAHA_ID",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000003","usaha_nama","usaha","nama","Nama usaha","profile","text","profile_safe","USAHA_NAMA",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000004","kota_id","kota","id","Kabupaten/kota","dimension","text","aggregate","KOTA_ID",["group"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000005","kota_kode","kota","kode","Kode kabupaten/kota","filter","text","aggregate","KOTA_KODE",["filter"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000006","kota_nama","kota","nama","Nama kabupaten/kota","dimension","text","aggregate","KOTA_NAMA",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000007","kecamatan_id","kecamatan","id","Kecamatan","dimension","text","aggregate","KECAMATAN_ID",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000008","kecamatan_nama","kecamatan","nama","Nama kecamatan","dimension","text","aggregate","KECAMATAN_NAMA",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000009","kelurahan_id","kelurahan","id","Kelurahan","dimension","text","aggregate","KELURAHAN_ID",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000a","kelurahan_nama","kelurahan","nama","Nama kelurahan","dimension","text","aggregate","KELURAHAN_NAMA",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000b","kbli_kode","klasifikasi_usaha","kode","Kode KBLI","dimension","text","aggregate","KBLI_KODE",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000c","sektor_kbli","klasifikasi_usaha","kategori","Sektor KBLI","dimension","text","aggregate","SEKTOR_KBLI",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000d","skala_dilaporkan","usaha","skala","Skala yang dilaporkan","dimension","enum","aggregate","SKALA",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000e","quality_geography","usaha","alamat","Kualitas geografi","quality","enum","aggregate","QUALITY_GEOGRAPHY",["group"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000000f","quality_kbli","klasifikasi_usaha","kode","Kualitas KBLI","quality","enum","aggregate","QUALITY_KBLI",["group"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000010","status_hukum","usaha","status_hukum","Status badan usaha","dimension","enum","aggregate","STATUS_HUKUM",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-00000000001a","status_usaha","usaha","status","Status usaha","dimension","enum","aggregate","STATUS_USAHA",["group","filter"]],
  ["5d84d56b-1538-4b2c-9ec7-000000000011","owner_name","pelaku_usaha","nama_lengkap","Nama pelaku usaha","profile","text","profile_safe","OWNER_NAME",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000012","masked_nik","pelaku_usaha","nik","NIK (termasking)","profile","text","profile_masked","MASKED_NIK",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000013","masked_phone","pelaku_usaha","telepon","Telepon (termasking)","profile","text","profile_masked","MASKED_PHONE",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000014","age_band","pelaku_usaha","birth_date","Kelompok usia","profile","text","profile_safe","AGE_BAND",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000015","business_address","alamat","alamat_jalan","Alamat usaha","profile","text","profile_safe","BUSINESS_ADDRESS",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000016","latitude","usaha","latitude","Lintang lokasi usaha","profile","number","profile_safe","LATITUDE",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000017","longitude","usaha","longitude","Bujur lokasi usaha","profile","number","profile_safe","LONGITUDE",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000018","omzet_tahunan","usaha","omzet_tahunan","Omzet tahunan yang dilaporkan","profile","number","restricted","OMZET_TAHUNAN",[]],
  ["5d84d56b-1538-4b2c-9ec7-000000000019","total_aset","usaha","total_aset","Total aset yang dilaporkan","profile","number","restricted","TOTAL_ASET",[]],
];
export const up = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`
      CREATE OR REPLACE FUNCTION analitik_validate_json_config() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      BEGIN
        IF TG_TABLE_NAME = 'analitik_view' AND COALESCE(to_jsonb(NEW)->>'config', '') ~* '(nik|telepon|phone|birth_date|password|secret|token|cookie|result|rows|record_id|signed_url)' THEN
          RAISE EXCEPTION 'analytics config contains restricted data' USING ERRCODE='check_violation';
        ELSIF TG_TABLE_NAME = 'analitik_job' AND COALESCE(to_jsonb(NEW)->>'request', '') ~* '(nik|telepon|phone|birth_date|password|secret|token|cookie|result|rows|record_id|signed_url)' THEN
          RAISE EXCEPTION 'analytics request contains restricted data' USING ERRCODE='check_violation';
        END IF;
        RETURN NEW;
      END; $$;
    `);
    for (const [code,name,lo,hi] of KBLI_SECTORS) {
      await trx.raw(`INSERT INTO analitik_kbli_sector(schema_version,code,name,division_start,division_end) VALUES (?,?,?,?,?) ON CONFLICT(schema_version,code) DO UPDATE SET name=EXCLUDED.name,division_start=EXCLUDED.division_start,division_end=EXCLUDED.division_end`, [SCHEMA_VERSION, code, name, lo, hi]);
    }
    for (const [id,semantic,sourceCollection,sourceField,label,role,type,privacy,expression,capabilities] of FIELD_SEEDS) {
      const status = ["omzet_tahunan","total_aset"].includes(semantic) ? "quarantined" : "active";
      const caps = JSON.stringify(capabilities);
      await trx.raw(`INSERT INTO analitik_field(id,semantic_id,source_collection,source_field,label,field_group,semantic_role,data_type,lifecycle_status,privacy_class,masking_policy,aggregation_capabilities,expression_key,projection_state,schema_version) VALUES (?,?,?,?,?,'analytics',?,?,?,?,?,?::jsonb,?,'pending',?) ON CONFLICT(semantic_id) DO UPDATE SET label=EXCLUDED.label,source_collection=EXCLUDED.source_collection,source_field=EXCLUDED.source_field,lifecycle_status=EXCLUDED.lifecycle_status,privacy_class=EXCLUDED.privacy_class,aggregation_capabilities=EXCLUDED.aggregation_capabilities,expression_key=EXCLUDED.expression_key,updated_at=NOW()`, [id,semantic,sourceCollection,sourceField,label,role,type,status,privacy,privacy === "profile_masked" ? "server_mask" : "none",caps,expression,SCHEMA_VERSION]);
    }
    await trx.raw(`INSERT INTO analitik_job(job_type,dedupe_key,status,priority) SELECT 'rebuild_current_model','rebuild_current_model','queued',10 WHERE NOT EXISTS (SELECT 1 FROM analitik_active_generation WHERE active_generation_id IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM analitik_job WHERE dedupe_key='rebuild_current_model' AND status IN ('queued','processing','retry'));`);
  });
};
export const down = async (knex) => {
  await knex.transaction(async (trx) => {
    await trx.raw(`DELETE FROM analitik_job WHERE dedupe_key='rebuild_current_model' AND status='queued'`);
    await trx.raw(`DELETE FROM analitik_field WHERE semantic_id IN (${FIELD_SEEDS.map(() => '?').join(',')})`, FIELD_SEEDS.map((row) => row[1]));
    await trx.raw(`DELETE FROM analitik_kbli_sector WHERE schema_version=?`, [SCHEMA_VERSION]);
  });
};
