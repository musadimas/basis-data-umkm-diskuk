import { csvRow } from "../../directus/analytics-shared/csv.cjs";
import sharedCompiler from "../../directus/analytics-shared/query-compiler.cjs";
import { createObjectStore, exportKey } from "./storage.js";

export const EXPORT_LIMIT = 50_000;
// Kandidat 03 langkah 2a: definisi tunggal di analytics-shared/query-compiler.cjs.
export const DIMENSIONS = sharedCompiler.DIMENSIONS;
// Kandidat 03 langkah 2e: SQL metrik tunggal di shared (penamaan kanonik
// eligibleSql/missingSql/needsVerificationSql); worker memetakan ke nama
// pendeknya di seam supaya pemakaian internal tidak berubah.
export const METRICS = Object.freeze(
  Object.fromEntries(
    Object.entries(sharedCompiler.METRICS).map(([key, metrik]) => [
      key,
      {
        sql: metrik.sql,
        eligible: metrik.eligibleSql,
        missing: metrik.missingSql,
        needsVerification: metrik.needsVerificationSql,
        label: metrik.label,
        aggregation: metrik.aggregation,
        unit: metrik.unit,
      },
    ]),
  ),
);
// Definisi tunggal ada di analytics-shared/csv.cjs; diekspor ulang agar tes dan pemanggil lama
// memakai implementasi yang sama dengan endpoint Tabular (B09).
export { csvCell, csvRow } from "../../directus/analytics-shared/csv.cjs";
export function extensionFor(type) {
  return (
    {
      detail_csv: "csv",
      aggregate_png: "png",
      aggregate_pdf: "pdf",
      aggregate_pptx: "pptx",
      profile_pdf: "pdf",
    }[type] || "bin"
  );
}

function invalidConfig(message) {
  return Object.assign(new Error(message), { code: "INVALID_ANALYSIS_CONFIG" });
}
// Operator diturunkan dari snapshot `permissionScope` yang disimpan router saat
// submit ("kabkota:7" | "provinsi" | "admin"; K14). Tanpa snapshot pekerjaan
// ditolak (fail-closed), tidak pernah jatuh ke cakupan provinsi.
export function operatorOf(request) {
  const scope = request?.permissionScope;
  if (scope === "provinsi" || scope === "admin") return { role: "provinsi", kotaId: null };
  const kabkota = /^kabkota:(\d+)$/.exec(String(scope || ""));
  if (kabkota) return { role: "kabkota", kotaId: Number(kabkota[1]) };
  throw invalidConfig("OPERATOR_REQUIRED");
}
async function loadRegistry(client) {
  return (
    await client.query("SELECT id,semantic_id,lifecycle_status FROM analitik_field")
  ).rows;
}
// Adapter tipis: error netral `{status, code}` dari compiler shared menjadi
// `INVALID_ANALYSIS_CONFIG` (pesan = kode kompiler), tidak pernah 500 buta.
function kompilasi(fungsi, config, registry, operator) {
  try {
    return fungsi(config, { registry, operator });
  } catch (error) {
    if (error && typeof error.status === "number" && typeof error.code === "string")
      throw invalidConfig(error.code);
    throw error;
  }
}
// Ringkasan filter canvas untuk dicantumkan di PDF/PNG/PPTX (Y05 M2-01): pembaca
// dokumen harus tahu angka ini terfilter apa dan berlaku di cakupan wilayah mana.
const OPERATOR_TEKS = {
  eq: "=",
  neq: "!=",
  in: "dalam",
  not_in: "bukan dalam",
  contains: "memuat",
  starts_with: "diawali",
};
export function ringkasanFilter(config, operator) {
  const semuaFilter = Array.isArray(config?.filters) ? config.filters : [];
  // Untuk kabkota compiler membuang filter kota klien; ringkasan tidak boleh mengklaimnya.
  const filters =
    operator?.role === "kabkota"
      ? semuaFilter.filter((filter) => !sharedCompiler.KOTA_FIELDS.has(filter?.fieldId ?? filter?.field))
      : semuaFilter;
  const bagian = filters.map((filter) => {
    const key = filter?.fieldId ?? filter?.field;
    // `DIMENSIONS[..].label` adalah ekspresi SQL, bukan teks; cukup nama semantik yang terbaca.
    const label = String(key).replaceAll("_", " ");
    const nilai = Array.isArray(filter?.value) ? filter.value.join(", ") : String(filter?.value ?? "");
    return `${label} ${OPERATOR_TEKS[filter?.operator || "eq"] || filter?.operator} ${nilai}`;
  });
  const cakupan =
    operator?.role === "kabkota" && operator.kotaId != null
      ? `Cakupan: kabupaten/kota ID ${operator.kotaId}`
      : "Cakupan: Provinsi Jawa Barat";
  return [bagian.length ? `Filter: ${bagian.join("; ")}` : "Filter: tanpa filter", cakupan].join(" | ");
}

export async function activeGenerationId(client) {
  const result = await client.query(
    "SELECT active_generation_id FROM analitik_active_generation WHERE id=1",
  );
  const id = result.rows[0]?.active_generation_id;
  if (!id)
    throw Object.assign(new Error("NO_ACTIVE_GENERATION"), {
      code: "NO_ACTIVE_GENERATION",
    });
  return id;
}
export async function queryAggregate(
  client,
  config,
  generationId = null,
  { operator } = {},
) {
  // Scope, budget filter, dimensi, dan metrik dikompilasi oleh compiler shared
  // yang sama dengan canvas (K14); worker hanya menambah generation_id.
  const plan = kompilasi(
    sharedCompiler.compileAggregate,
    { schemaVersion: 1, ...config, metric: config?.metric ?? "jumlah_umkm" },
    await loadRegistry(client),
    operator,
  );
  const { metric, metricKey } = plan;
  const second = plan.breakdown;
  const generation = generationId || (await activeGenerationId(client));
  const params = [generation, ...plan.params];
  const clauses = [
    "a.generation_id=$1",
    sharedCompiler.parameterize(plan.whereSql, 2),
  ];
  const select = [
    plan.aggregateSelectSql,
    `${metric.sql} AS value`,
    `${metric.eligibleSql} AS eligible`,
    // Sama seperti router: total window dipakai untuk menghitung sisa kelompok (B29).
    `SUM(${metric.sql}) OVER () AS metric_total`,
  ];
  const { groupBySql, limit } = plan;
  const grouped = await client.query(
    `SELECT * FROM (SELECT ${select.join(", ")} FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")} GROUP BY ${groupBySql}) grouped WHERE eligible>0 ORDER BY value DESC, group_key ASC LIMIT ${limit + 1}`,
    params,
  );
  const coverage =
    (
      await client.query(
        `SELECT COUNT(*)::integer AS total,(${metric.eligibleSql})::integer AS matched,(${metric.missingSql})::integer AS missing,(${metric.needsVerificationSql})::integer AS needs_verification,${metric.sql} AS metric_total FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")}`,
        params,
      )
    ).rows[0] || {};
  const matched = Number(coverage.matched || 0);
  const metricTotal = Number(coverage.metric_total || 0);
  const rows = grouped.rows.slice(0, limit);
  // Scan hanya mengambil limit+1 baris, jadi "Lainnya" = total window dikurangi kelompok yang
  // tampil, bukan hanya baris ke-(limit+1) (B29).
  const windowTotal = Number(grouped.rows[0]?.metric_total ?? metricTotal);
  const overflow = Math.max(
    0,
    windowTotal - rows.reduce((sum, row) => sum + Number(row.value || 0), 0),
  );
  const groups = rows.map((row) => {
    const group = {
      key: row.group_key,
      label: row.group_label || "Tidak diketahui",
      value: Number(row.value || 0),
      share: metricTotal
        ? Number(((Number(row.value || 0) * 100) / metricTotal).toFixed(1))
        : 0,
    };
    if (second)
      group.breakdown = {
        key: row.breakdown_key,
        label: row.breakdown_label || "Tidak diketahui",
      };
    return group;
  });
  if (overflow && plan.includeOthers)
    groups.push({
      key: "others",
      label: "Lainnya",
      value: overflow,
      share: metricTotal
        ? Number(((overflow * 100) / metricTotal).toFixed(1))
        : 0,
    });
  const generationRow = (
    await client.query(
      "SELECT data_as_of FROM analitik_generation WHERE id=$1",
      [generation],
    )
  ).rows[0];
  // pg mengembalikan Date; dokumen mencetak teks, jadi selalu ISO (bukan Date.toString()).
  const rawAsOf = generationRow?.data_as_of || null;
  const dataAsOf = rawAsOf instanceof Date ? rawAsOf.toISOString() : rawAsOf;
  return {
    meta: {
      schemaVersion: 1,
      dataAsOf,
      generatedAt: new Date().toISOString(),
      filterSummary: ringkasanFilter(config, operator),
      status: "current",
      source: "Current state UMKM aktif Jawa Barat",
      population: Number(coverage.total || 0),
      matched,
      coverage: {
        matched,
        total: Number(coverage.total || 0),
        missing: Number(coverage.missing || 0),
        needsVerification: Number(coverage.needs_verification || 0),
        unknown:
          metric.unit === "usaha"
            ? groups
                .filter(
                  (group) =>
                    group.key === "unknown" ||
                    group.label === "Tidak diketahui" ||
                    group.label === "Tidak ada kode" ||
                    group.label === "Tidak terpetakan",
                )
                .reduce((sum, group) => sum + group.value, 0)
            : 0,
      },
      warnings: [],
      maskingVersion: 1,
    },
    data: {
      metric: {
        key: metricKey,
        label: metric.label,
        aggregation: metric.aggregation,
        unit: metric.unit,
      },
      total: metricTotal,
      groups,
    },
  };
}

async function profilePdf(client, profileId, generationId) {
  const result = await client.query(
    "SELECT c.nama,c.status,c.kota_nama,c.kecamatan_nama,c.skala,c.kode_kbli,c.kategori_kbli,c.masked_nik,c.masked_phone,c.age_band,g.data_as_of FROM analitik_usaha_current c JOIN analitik_generation g ON g.id=c.generation_id WHERE c.generation_id=$1 AND c.usaha_id=$2",
    [generationId, profileId],
  );
  const row = result.rows[0];
  if (!row)
    throw Object.assign(new Error("PROFILE_NOT_FOUND"), {
      code: "PROFILE_NOT_FOUND",
    });
  return {
    title: row.nama || "Profil UMKM",
    groups: [
      { label: "Status", value: row.status || "Belum tersedia", share: 0 },
      {
        label: "Lokasi usaha",
        value: `${row.kota_nama || "Tidak diketahui"} · ${row.kecamatan_nama || "Tidak diketahui"}`,
        share: 0,
      },
      { label: "Skala", value: row.skala || "Tidak diketahui", share: 0 },
      { label: "KBLI", value: row.kode_kbli || "Tidak diketahui", share: 0 },
      { label: "NIK", value: row.masked_nik || "Belum tersedia", share: 0 },
      {
        label: "Telepon",
        value: row.masked_phone || "Belum tersedia",
        share: 0,
      },
      {
        label: "Kelompok usia",
        value: row.age_band || "Belum tersedia",
        share: 0,
      },
    ],
    meta: {
      dataAsOf: row.data_as_of instanceof Date ? row.data_as_of.toISOString() : row.data_as_of,
      generatedAt: new Date().toISOString(),
      maskingVersion: 1,
    },
  };
}

export async function processExport(
  client,
  job,
  { store = createObjectStore(), renderAggregateFn = null } = {},
) {
  const request = job.request || {};
  const type = job.export_type || request.exportType;
  const extension = extensionFor(type);
  const owner = job.owner || "system";
  const key = exportKey(owner, job.id, extension);
  let artifact;
  let rowCount = 0;
  const needsGenerationId =
    type === "detail_csv" ||
    type === "profile_pdf" ||
    type === "aggregate_png" ||
    type === "aggregate_pdf" ||
    type === "aggregate_pptx";
  const generationId = needsGenerationId
    ? request.generationId || (await activeGenerationId(client))
    : null;
  if (type === "aggregate_png" || type === "aggregate_pdf") {
    const result = await queryAggregate(
      client,
      request.config || request,
      generationId,
      { operator: operatorOf(request) },
    );
    const render =
      renderAggregateFn ||
      (await import("./export-renderer.js")).renderAggregate;
    const rendered = render({
      title: request.title || "Analitik UMKM",
      groups: result.data.groups,
      meta: result.meta,
    });
    artifact = type.endsWith("png") ? rendered.png : rendered.pdf;
    rowCount = result.data.groups.length;
  } else if (type === "detail_csv") {
    // Filter dan scope dikompilasi compiler shared yang sama dengan canvas.
    const filters = kompilasi(
      sharedCompiler.compileFilters,
      { schemaVersion: 1, metric: "jumlah_umkm", ...request.config },
      await loadRegistry(client),
      operatorOf(request),
    );
    const params = [generationId, ...filters.params];
    const clauses = [
      `a.generation_id=$1`,
      sharedCompiler.parameterize(filters.whereSql, 2),
    ];
    const rows = (
      await client.query(
        `SELECT a.usaha_id AS id,a.nama,a.skala,a.kota_nama AS kota,a.kecamatan_nama AS kecamatan,a.kode_kbli AS kbli FROM analitik_usaha_current a WHERE ${clauses.join(" AND ")} ORDER BY a.usaha_id LIMIT ${EXPORT_LIMIT + 1}`,
        params,
      )
    ).rows;
    if (rows.length > EXPORT_LIMIT)
      throw Object.assign(new Error("EXPORT_LIMIT"), { code: "EXPORT_LIMIT" });
    artifact = Buffer.from(
      "\ufeff" +
        csvRow([
          "ID",
          "Nama usaha",
          "Skala",
          "Kabupaten/kota",
          "Kecamatan",
          "KBLI",
        ]) +
        rows
          .map((row) =>
            csvRow([
              row.id,
              row.nama,
              row.skala,
              row.kota,
              row.kecamatan,
              row.kbli,
            ]),
          )
          .join(""),
    );
    rowCount = rows.length;
  } else if (type === "profile_pdf") {
    const render =
      renderAggregateFn ||
      (await import("./export-renderer.js")).renderAggregate;
    const result = await profilePdf(client, request.profileId, generationId);
    const rendered = render(result);
    artifact = rendered.pdf;
    rowCount = result.groups.length;
  } else if (type === "aggregate_pptx") {
    const result = await queryAggregate(
      client,
      request.config || request,
      generationId,
      { operator: operatorOf(request) },
    );
    const renderPptx =
      (await import("./export-renderer.js")).renderAggregatePptx;
    artifact = await renderPptx({
      judul: request.title || "Analitik UMKM",
      dataAsOf: result.meta?.dataAsOf || "Belum tersedia",
      visual: request.config?.visual || "bar",
      filterSummary: result.meta?.filterSummary,
      groups: result.data?.groups || [],
    });
    rowCount = result.data?.groups?.length || 0;
  } else throw Object.assign(new Error("EXPORT_TYPE"), { code: "EXPORT_TYPE" });
  await store.put(key, artifact);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const next = {
    ...request,
    artifact: {
      key,
      contentType: type.endsWith("csv")
        ? "text/csv; charset=utf-8"
        : type.endsWith("png")
          ? "image/png"
          : type.endsWith("pptx")
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : "application/pdf",
      rowCount,
      expiresAt,
    },
  };
  await client.query(
    "UPDATE analitik_job SET status='completed',request=$2,lease_until=NULL,lease_owner=NULL,error_code=NULL,error_message=NULL,updated_at=NOW() WHERE id=$1",
    [job.id, next],
  );
  return { key, rowCount, expiresAt };
}

export async function cleanupExpiredExports(
  client,
  { store = createObjectStore(), now = new Date() } = {},
) {
  const result = await client.query(
    "SELECT id,request FROM analitik_job WHERE job_type='export' AND status='completed'",
  );
  let count = 0;
  for (const job of result.rows) {
    const request = job.request || {};
    const artifact = request.artifact;
    if (artifact?.expiresAt && new Date(artifact.expiresAt) <= now) {
      await store.remove(artifact.key);
      await client.query(
        "UPDATE analitik_job SET status='expired',error_code='EXPORT_EXPIRED',request=request-'artifact',updated_at=NOW() WHERE id=$1",
        [job.id],
      );
      count++;
    }
  }
  return count;
}
