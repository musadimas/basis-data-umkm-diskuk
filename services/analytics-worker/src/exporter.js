import { createObjectStore, exportKey } from "./storage.js";

export const EXPORT_LIMIT = 50_000;
const DIMENSIONS = Object.freeze({
  kota_id: { key: "COALESCE(a.kota_id::text,'unknown')", label: "COALESCE(a.kota_nama,'Tidak diketahui')" },
  kota_kode: { key: "COALESCE(a.kota_kode,'unknown')", label: "COALESCE(a.kota_nama,'Tidak diketahui')" },
  kota_nama: { key: "COALESCE(a.kota_nama,'Tidak diketahui')", label: "COALESCE(a.kota_nama,'Tidak diketahui')" },
  kecamatan_id: { key: "COALESCE(a.kecamatan_id::text,'unknown')", label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')" },
  kecamatan_nama: { key: "COALESCE(a.kecamatan_nama,'Tidak diketahui')", label: "COALESCE(a.kecamatan_nama,'Tidak diketahui')" },
  kelurahan_id: { key: "COALESCE(a.kelurahan_id::text,'unknown')", label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')" },
  kelurahan_nama: { key: "COALESCE(a.kelurahan_nama,'Tidak diketahui')", label: "COALESCE(a.kelurahan_nama,'Tidak diketahui')" },
  sektor_kbli: { key: "COALESCE(a.sektor_kbli,'unknown')", label: "COALESCE(a.sektor_kbli,'Tidak diketahui')" },
  kbli_kode: { key: "COALESCE(a.kode_kbli,'unknown')", label: "COALESCE(a.kode_kbli,'Tidak diketahui')" },
  skala_dilaporkan: { key: "COALESCE(a.skala,'unknown')", label: "CASE a.skala WHEN 'micro' THEN 'Mikro' WHEN 'small' THEN 'Kecil' WHEN 'medium' THEN 'Menengah' ELSE 'Tidak diketahui' END" },
  status_hukum: { key: "COALESCE(a.status_hukum,'unknown')", label: "COALESCE(a.status_hukum,'Tidak diketahui')" },
  status_usaha: { key: "COALESCE(a.status,'unknown')", label: "CASE a.status WHEN 'active' THEN 'Aktif' WHEN 'archived' THEN 'Diarsipkan' ELSE 'Tidak diketahui' END" },
  quality_geography: { key: "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'unknown' ELSE 'mapped' END", label: "CASE WHEN a.kota_id IS NULL OR a.kecamatan_id IS NULL OR a.kelurahan_id IS NULL THEN 'Tidak diketahui' ELSE 'Terpetakan' END" },
  quality_kbli: { key: "CASE WHEN a.kode_kbli IS NULL THEN 'missing' WHEN a.sektor_kbli IS NULL THEN 'unmapped' ELSE 'mapped' END", label: "CASE WHEN a.kode_kbli IS NULL THEN 'Tidak ada kode' WHEN a.sektor_kbli IS NULL THEN 'Tidak terpetakan' ELSE 'Terpetakan' END" },
});
const FILTER_KEYS = Object.freeze(Object.fromEntries(Object.entries(DIMENSIONS).map(([key, value]) => [key, value.key])));
function identifier(value) { return typeof value === "string" && Object.hasOwn(DIMENSIONS, value) ? value : null; }
export function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
export function csvRow(values) { return values.map(csvCell).join(",") + "\r\n"; }
export function aggregateCsv({ groups = [], meta = {}, title = "Analitik UMKM" } = {}) {
  const header = "\ufeff" + csvRow(["Kelompok", "Jumlah UMKM", "Bagian dari total terfilter"]);
  const body = groups.map((group) => csvRow([group.label, group.value, `${group.share || 0}%`])).join("");
  return header + csvRow(["Judul", title]) + csvRow(["Data per", meta.dataAsOf || "Belum tersedia"]) + body;
}
export function extensionFor(type) { return ({ aggregate_csv: "csv", detail_csv: "csv", aggregate_png: "png", aggregate_pdf: "pdf", profile_pdf: "pdf" })[type] || "bin"; }

function configOf(request) { return request?.config && typeof request.config === "object" ? request.config : request || {}; }
function filterSql(filters, params) {
  const clauses = [];
  for (const filter of Array.isArray(filters) ? filters.slice(0, 8) : []) {
    const key = identifier(filter?.fieldId || filter?.field);
    if (!key || !["eq", "neq", "in", "contains", "starts_with"].includes(filter?.operator || "eq")) throw Object.assign(new Error("FILTER_NOT_ALLOWED"), { code: "INVALID_ANALYSIS_CONFIG" });
    const expression = FILTER_KEYS[key];
    const operator = filter.operator || "eq";
    if (operator === "in") {
      if (!Array.isArray(filter.value) || !filter.value.length || filter.value.length > 100) throw Object.assign(new Error("FILTER_VALUE_INVALID"), { code: "INVALID_ANALYSIS_CONFIG" });
      params.push(filter.value.map((item) => String(item).slice(0, 100)));
      clauses.push(`${expression} = ANY($${params.length}::text[])`);
    } else {
      if (Array.isArray(filter.value) || filter.value === undefined || filter.value === null) throw Object.assign(new Error("FILTER_VALUE_INVALID"), { code: "INVALID_ANALYSIS_CONFIG" });
      const value = String(filter.value).slice(0, 100);
      params.push(operator === "contains" ? `%${value}%` : operator === "starts_with" ? `${value}%` : value);
      clauses.push(`${expression} ${operator === "neq" ? "<>" : operator === "contains" || operator === "starts_with" ? "ILIKE" : "="} $${params.length}`);
    }
  }
  return clauses;
}
export async function activeGenerationId(client) {
  const result = await client.query("SELECT active_generation_id FROM analitik_active_generation WHERE id=1");
  const id = result.rows[0]?.active_generation_id;
  if (!id) throw Object.assign(new Error("NO_ACTIVE_GENERATION"), { code: "NO_ACTIVE_GENERATION" });
  return id;
}
export async function queryAggregate(client, config, generationId = null) {
  const currentConfig = configOf({ config });
  const groupBy = identifier(currentConfig.groupBy || "kota_nama"); if (!groupBy) throw Object.assign(new Error("GROUP_NOT_ALLOWED"), { code: "INVALID_ANALYSIS_CONFIG" });
  const breakdown = currentConfig.breakdown ? identifier(currentConfig.breakdown) : null;
  if (currentConfig.breakdown && !breakdown) throw Object.assign(new Error("BREAKDOWN_NOT_ALLOWED"), { code: "INVALID_ANALYSIS_CONFIG" });
  if (breakdown === groupBy) throw Object.assign(new Error("BREAKDOWN_NOT_ALLOWED"), { code: "INVALID_ANALYSIS_CONFIG" });
  const generation = generationId || await activeGenerationId(client);
  const params = [generation];
  const clauses = ["a.generation_id=$1", "a.status='active'", ...filterSql(currentConfig.filters, params)];
  const first = DIMENSIONS[groupBy];
  const second = breakdown ? DIMENSIONS[breakdown] : null;
  const select = [`${first.key} AS group_key`, `${first.label} AS group_label`];
  if (second) select.push(`${second.key} AS breakdown_key`, `${second.label} AS breakdown_label`);
  select.push("COUNT(DISTINCT a.usaha_id)::integer AS value");
  const groupBySql = select.slice(0, second ? 4 : 2).map((_, index) => String(index + 1)).join(", ");
  const limit = Math.min(Math.max(Number(currentConfig.limit || 20), 1), 20);
  const grouped = await client.query(`SELECT ${select.join(", ")} FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")} GROUP BY ${groupBySql} ORDER BY value DESC, group_key ASC LIMIT ${limit + 1}`, params);
  const matched = Number((await client.query(`SELECT COUNT(DISTINCT a.usaha_id)::integer AS count FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")}`, params)).rows[0]?.count || 0);
  const rows = grouped.rows.slice(0, limit);
  const overflow = grouped.rows.slice(limit).reduce((sum, row) => sum + Number(row.value || 0), 0);
  const groups = rows.map((row) => ({ key: row.group_key, label: row.group_label || "Tidak diketahui", value: Number(row.value || 0), share: matched ? Number((Number(row.value || 0) * 100 / matched).toFixed(1)) : 0, ...(second ? { breakdown: { key: row.breakdown_key, label: row.breakdown_label || "Tidak diketahui" } } : {}) }));
  if (overflow && currentConfig.includeOthers !== false) groups.push({ key: "others", label: "Lainnya", value: overflow, share: matched ? Number((overflow * 100 / matched).toFixed(1)) : 0 });
  const generationRow = (await client.query("SELECT data_as_of FROM analitik_generation WHERE id=$1", [generation])).rows[0];
  const dataAsOf = generationRow?.data_as_of || null;
  return { meta: { schemaVersion: 1, dataAsOf, generatedAt: new Date().toISOString(), status: "current", source: "Current state UMKM aktif Jawa Barat", population: matched, matched, coverage: { matched, total: matched, unknown: groups.filter((group) => group.key === "unknown" || group.label === "Tidak diketahui" || group.label === "Tidak ada kode" || group.label === "Tidak terpetakan").reduce((sum, group) => sum + group.value, 0) }, warnings: [], maskingVersion: 1 }, data: { metric: { key: currentConfig.metric || "jumlah_umkm", label: "Jumlah UMKM", aggregation: "count_distinct" }, groups } };
}

async function profilePdf(client, profileId, generationId) {
  const result = await client.query("SELECT c.nama,c.status,c.kota_nama,c.kecamatan_nama,c.skala,c.kode_kbli,c.kategori_kbli,c.masked_nik,c.masked_phone,c.age_band,g.data_as_of FROM analitik_usaha_current c JOIN analitik_generation g ON g.id=c.generation_id WHERE c.generation_id=$1 AND c.usaha_id=$2", [generationId, profileId]);
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("PROFILE_NOT_FOUND"), { code: "PROFILE_NOT_FOUND" });
  return { title: row.nama || "Profil UMKM", groups: [{ label: "Status", value: row.status || "Belum tersedia", share: 0 }, { label: "Lokasi usaha", value: `${row.kota_nama || "Tidak diketahui"} · ${row.kecamatan_nama || "Tidak diketahui"}`, share: 0 }, { label: "Skala", value: row.skala || "Tidak diketahui", share: 0 }, { label: "KBLI", value: row.kode_kbli || "Tidak diketahui", share: 0 }, { label: "NIK", value: row.masked_nik || "Belum tersedia", share: 0 }, { label: "Telepon", value: row.masked_phone || "Belum tersedia", share: 0 }, { label: "Kelompok usia", value: row.age_band || "Belum tersedia", share: 0 }], meta: { dataAsOf: row.data_as_of, generatedAt: new Date().toISOString(), maskingVersion: 1 } };
}

export async function processExport(client, job, { store = createObjectStore(), renderAggregateFn = null } = {}) {
  const request = job.request || {};
  const type = job.export_type || request.exportType;
  const extension = extensionFor(type);
  const owner = job.owner || "system";
  const key = exportKey(owner, job.id, extension);
  let artifact;
  let rowCount = 0;
  const generationId = request.generationId || await activeGenerationId(client);
  if (type === "aggregate_csv" || type === "aggregate_png" || type === "aggregate_pdf") {
    const result = request.result || await queryAggregate(client, request.config || request, generationId);
    if (type === "aggregate_csv") artifact = Buffer.from(aggregateCsv({ ...result, title: request.title || "Analitik UMKM" }));
    else {
      const render = renderAggregateFn || ((await import("./export-renderer.js")).renderAggregate);
      const rendered = render({ title: request.title || "Analitik UMKM", groups: result.data.groups, meta: result.meta });
      artifact = type.endsWith("png") ? rendered.png : rendered.pdf;
    }
    rowCount = result.data.groups.length;
  } else if (type === "detail_csv") {
    const params = [generationId]; const statusFilter = Array.isArray(request.config?.filters) && request.config.filters.some((filter) => identifier(filter?.fieldId || filter?.field) === "status_usaha"); const clauses = [`a.generation_id=$1`, ...(statusFilter ? [] : ["a.status='active'"]), ...filterSql(request.config?.filters, params)];
    const rows = (await client.query(`SELECT a.usaha_id AS id,a.nama,a.skala,a.kota_nama AS kota,a.kecamatan_nama AS kecamatan,a.kode_kbli AS kbli FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")} ORDER BY a.usaha_id LIMIT ${EXPORT_LIMIT + 1}`, params)).rows;
    if (rows.length > EXPORT_LIMIT) throw Object.assign(new Error("EXPORT_LIMIT"), { code: "EXPORT_LIMIT" });
    artifact = Buffer.from("\ufeff" + csvRow(["ID", "Nama usaha", "Skala", "Kabupaten/kota", "Kecamatan", "KBLI"]) + rows.map((row) => csvRow([row.id, row.nama, row.skala, row.kota, row.kecamatan, row.kbli])).join(""));
    rowCount = rows.length;
  } else if (type === "profile_pdf") {
    const render = renderAggregateFn || ((await import("./export-renderer.js")).renderAggregate);
    const result = await profilePdf(client, request.profileId, generationId);
    const rendered = render(result);
    artifact = rendered.pdf;
    rowCount = result.groups.length;
  } else throw Object.assign(new Error("EXPORT_TYPE"), { code: "EXPORT_TYPE" });
  await store.put(key, artifact);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const next = { ...request, artifact: { key, contentType: type.endsWith("csv") ? "text/csv; charset=utf-8" : type.endsWith("png") ? "image/png" : "application/pdf", rowCount, expiresAt } };
  await client.query("UPDATE analitik_job SET status='completed',request=$2,lease_until=NULL,lease_owner=NULL,error_code=NULL,error_message=NULL,updated_at=NOW() WHERE id=$1", [job.id, next]);
  return { key, rowCount, expiresAt };
}

export async function cleanupExpiredExports(client, { store = createObjectStore(), now = new Date() } = {}) {
  const result = await client.query("SELECT id,request FROM analitik_job WHERE job_type='export' AND status='completed'");
  let count = 0;
  for (const job of result.rows) {
    const request = job.request || {};
    const artifact = request.artifact;
    if (artifact?.expiresAt && new Date(artifact.expiresAt) <= now) {
      await store.remove(artifact.key);
      await client.query("UPDATE analitik_job SET status='expired',error_code='EXPORT_EXPIRED',request=request-'artifact',updated_at=NOW() WHERE id=$1", [job.id]);
      count++;
    }
  }
  return count;
}
