const { SCHEMA_VERSION, FIELD_STATUSES } = require("../../../analytics-shared/contracts.cjs");
function safeField(row) { return { id: row.id, key: row.semantic_id, label: row.label, description: row.description, group: row.field_group, order: row.sort_order, role: row.semantic_role, type: row.data_type, status: row.lifecycle_status, privacy: row.privacy_class, capabilities: row.aggregation_capabilities, schemaVersion: row.schema_version }; }
async function getMetadata(database) { const result=await database.raw(`SELECT id,semantic_id,label,description,field_group,sort_order,semantic_role,data_type,lifecycle_status,privacy_class,aggregation_capabilities,schema_version FROM analitik_field WHERE lifecycle_status IN ('active','discovered','quarantined','tombstoned') ORDER BY sort_order,semantic_id`); return { schemaVersion: SCHEMA_VERSION, fields: (result.rows??result[0]??[]).map(safeField).filter((field) => FIELD_STATUSES.includes(field.status)), warnings: [] }; }
async function getOptions(database, query = {}) {
  const limit=Math.min(Math.max(Number.parseInt(query.limit || "20",10)||20,1),100);
  const search=typeof query.search === "string" ? query.search.slice(0,100) : "";
  const fieldId=query.fieldId;
  if (!fieldId) return { fieldId:null, options:[] };
  const field=(await database.raw(`SELECT semantic_id,lifecycle_status FROM analitik_field WHERE id=? OR semantic_id=?`,[fieldId,fieldId])).rows?.[0];
  if (!field || field.lifecycle_status !== "active") return { fieldId, options:[] };
  const allowed={
    kota_nama:{id:"a.kota_id::text",label:"a.kota_nama"}, kota_kode:{id:"a.kota_kode",label:"a.kota_nama"},
    kecamatan_id:{id:"a.kecamatan_id::text",label:"a.kecamatan_nama"}, kecamatan_nama:{id:"a.kecamatan_id::text",label:"a.kecamatan_nama"},
    kelurahan_id:{id:"a.kelurahan_id::text",label:"a.kelurahan_nama"}, kelurahan_nama:{id:"a.kelurahan_id::text",label:"a.kelurahan_nama"},
    skala_dilaporkan:{id:"a.skala",label:"CASE a.skala WHEN 'micro' THEN 'Mikro' WHEN 'small' THEN 'Kecil' WHEN 'medium' THEN 'Menengah' ELSE 'Tidak diketahui' END"},
    sektor_kbli:{id:"a.sektor_kbli",label:"a.sektor_kbli"}, kbli_kode:{id:"a.kode_kbli",label:"a.kode_kbli"},
    status_hukum:{id:"a.status_hukum",label:"a.status_hukum"}, status_usaha:{id:"a.status",label:"CASE a.status WHEN 'active' THEN 'Aktif' WHEN 'archived' THEN 'Diarsipkan' ELSE 'Tidak diketahui' END"}
  };
  const columns=allowed[field.semantic_id];
  if (!columns) return { fieldId, options:[] };
  const result=await database.raw(`SELECT DISTINCT COALESCE(${columns.id},'unknown') AS id,COALESCE(${columns.label},'Tidak diketahui') AS label FROM analitik_usaha_current a JOIN analitik_active_generation p ON p.id=1 AND p.active_generation_id=a.generation_id WHERE COALESCE(${columns.label},'Tidak diketahui') ILIKE ? ORDER BY label NULLS LAST LIMIT ?`,[`%${search}%`,limit]);
  return { fieldId, options:(result.rows??result[0]??[]).map((row)=>({id:String(row.id),label:row.label})), nextCursor:null };
}
module.exports = { safeField, getMetadata, getOptions };
