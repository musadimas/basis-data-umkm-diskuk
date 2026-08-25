const {
  SCHEMA_VERSION,
  FIELD_STATUSES,
  QUERY_BUDGET,
} = require("../../../analytics-shared/contracts.cjs");
function safeField(row) {
  return {
    id: row.id,
    key: row.semantic_id,
    label: row.label,
    description: row.description,
    group: row.field_group,
    order: row.sort_order,
    role: row.semantic_role,
    type: row.data_type,
    status: row.lifecycle_status,
    privacy: row.privacy_class,
    capabilities: row.aggregation_capabilities,
    schemaVersion: row.schema_version,
  };
}
async function getMetadata(database) {
  const result = await database.raw(
    `SELECT id,semantic_id,label,description,field_group,sort_order,semantic_role,data_type,lifecycle_status,privacy_class,aggregation_capabilities,schema_version FROM analitik_field WHERE lifecycle_status IN ('active','discovered','quarantined','tombstoned') ORDER BY sort_order,semantic_id`,
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    fields: (result.rows ?? result[0] ?? [])
      .map(safeField)
      .filter((field) => FIELD_STATUSES.includes(field.status)),
    warnings: [],
  };
}

async function withBudgetTransaction(database, fn) {
  if (typeof database.transaction === "function") {
    return database.transaction(async (trx) => {
      await trx.raw(
        `SET LOCAL statement_timeout = '${QUERY_BUDGET.statementTimeoutMs}ms'`,
      );
      await trx.raw(
        `SET LOCAL lock_timeout = '${QUERY_BUDGET.lockTimeoutMs}ms'`,
      );
      await trx.raw(`SET TRANSACTION READ ONLY`);
      return fn(trx);
    });
  }
  return fn(database);
}

async function getOptions(database, query = {}) {
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit || "20", 10) || 20, 1),
    100,
  );
  const search =
    typeof query.search === "string" ? query.search.slice(0, 100) : "";
  const fieldId = query.fieldId;
  if (!fieldId) return { fieldId: null, options: [] };
  const field = (
    await database.raw(
      `SELECT semantic_id,lifecycle_status FROM analitik_field WHERE id=? OR semantic_id=?`,
      [fieldId, fieldId],
    )
  ).rows?.[0];
  if (!field || field.lifecycle_status !== "active")
    return { fieldId, options: [] };

  // Prefer small reference tables / snapshot over scanning 5.4M fact rows.
  // Only use fact-distinct as last resort with prefix filter and budget.
  const likeParam = search ? `${search}%` : null;

  // Optional cascade parent: narrows kecamatan/kelurahan listings to the
  // chosen kota/kecamatan so result sets stay small and relevant. Accepts the
  // reference id (numeric) or the exact human label stored in filter chips;
  // anything longer than 100 chars is rejected outright.
  const parentRaw =
    typeof query.parent === "string" || typeof query.parent === "number"
      ? String(query.parent).slice(0, 100)
      : "";
  const parentId =
    /^(0|[1-9][0-9]*)$/.test(parentRaw) &&
    Number(parentRaw) <= 2147483647 &&
    Number(parentRaw) > 0
      ? Number(parentRaw)
      : null;
  const parentName = !parentId && parentRaw ? parentRaw.toLowerCase() : null;

  // Helper to wrap reference queries with timeout budget
  const runRefQuery = async (sql, params) => {
    const exec = (db) => db.raw(sql, params);
    try {
      const result = await withBudgetTransaction(database, exec);
      return result.rows ?? result[0] ?? [];
    } catch (e) {
      if (e?.code === "57014" || e?.code === "55P03")
        throw Object.assign(new Error("Query timeout"), {
          statusCode: 504,
          code: "QUERY_TIMEOUT",
        });
      throw e;
    }
  };

  // Skala is static small enum – no DB scan needed
  if (field.semantic_id === "skala_dilaporkan") {
    const skalaEnum = [
      { id: "micro", label: "Mikro" },
      { id: "small", label: "Kecil" },
      { id: "medium", label: "Menengah" },
    ];
    const filtered = likeParam
      ? skalaEnum.filter((o) =>
          o.label.toLowerCase().startsWith(search.toLowerCase()),
        )
      : skalaEnum;
    return { fieldId, options: filtered.slice(0, limit), nextCursor: null };
  }

  // Kota – from reference table `kota` (Jawa Barat only), ~27 rows
  if (field.semantic_id === "kota_nama" || field.semantic_id === "kota_kode") {
    const sql = likeParam
      ? `SELECT k.id::text AS id, k.nama AS label FROM kota k JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat' AND k.nama ILIKE ? ORDER BY k.nama LIMIT ?`
      : `SELECT k.id::text AS id, k.nama AS label FROM kota k JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat' ORDER BY k.nama LIMIT ?`;
    const params = likeParam ? [likeParam, limit] : [limit];
    const rows = await runRefQuery(sql, params);
    return {
      fieldId,
      options: rows.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // Kecamatan – reference table, scoped to the parent kota when cascading.
  // Unscoped listings stay bounded by LIMIT and never touch the fact table.
  if (
    field.semantic_id === "kecamatan_id" ||
    field.semantic_id === "kecamatan_nama"
  ) {
    const scopeSql = parentId
      ? " AND kc.kota=?"
      : parentName
        ? " AND EXISTS (SELECT 1 FROM kota k2 WHERE k2.id=kc.kota AND lower(k2.nama)=?)"
        : "";
    const sql = likeParam
      ? `SELECT kc.id::text AS id, kc.nama AS label FROM kecamatan kc JOIN kota k ON k.id=kc.kota JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat'${scopeSql} AND kc.nama ILIKE ? ORDER BY kc.nama LIMIT ?`
      : `SELECT kc.id::text AS id, kc.nama AS label FROM kecamatan kc JOIN kota k ON k.id=kc.kota JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat'${scopeSql} ORDER BY kc.nama LIMIT ?`;
    const scopeParams = parentId || parentName ? [parentId ?? parentName] : [];
    const params = [...scopeParams, ...(likeParam ? [likeParam] : []), limit];
    const rows = await runRefQuery(sql, params);
    return {
      fieldId,
      options: rows.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // Kelurahan – reference table, scoped to the parent kecamatan when cascading.
  if (
    field.semantic_id === "kelurahan_id" ||
    field.semantic_id === "kelurahan_nama"
  ) {
    const scopeSql = parentId
      ? " AND kl.kecamatan=?"
      : parentName
        ? " AND EXISTS (SELECT 1 FROM kecamatan kc2 WHERE kc2.id=kl.kecamatan AND lower(kc2.nama)=?)"
        : "";
    const sql = likeParam
      ? `SELECT kl.id::text AS id, kl.nama AS label FROM kelurahan kl JOIN kecamatan kc ON kc.id=kl.kecamatan JOIN kota k ON k.id=kc.kota JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat'${scopeSql} AND kl.nama ILIKE ? ORDER BY kl.nama LIMIT ?`
      : `SELECT kl.id::text AS id, kl.nama AS label FROM kelurahan kl JOIN kecamatan kc ON kc.id=kl.kecamatan JOIN kota k ON k.id=kc.kota JOIN provinsi p ON p.id=k.provinsi WHERE lower(p.nama)='jawa barat'${scopeSql} ORDER BY kl.nama LIMIT ?`;
    const scopeParams = parentId || parentName ? [parentId ?? parentName] : [];
    const params = [...scopeParams, ...(likeParam ? [likeParam] : []), limit];
    const rows = await runRefQuery(sql, params);
    return {
      fieldId,
      options: rows.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // Sektor KBLI – small lookup table ~21 rows
  if (field.semantic_id === "sektor_kbli") {
    const sql = likeParam
      ? `SELECT code AS id, name AS label FROM analitik_kbli_sector WHERE schema_version=1 AND name ILIKE ? ORDER BY code LIMIT ?`
      : `SELECT code AS id, name AS label FROM analitik_kbli_sector WHERE schema_version=1 ORDER BY code LIMIT ?`;
    const params = likeParam ? [likeParam, limit] : [limit];
    const rows = await runRefQuery(sql, params);
    return {
      fieldId,
      options: rows.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // KBLI kode – klasifikasi_usaha reference (small). When a parent sektor
  // letter (A–U) is given, resolve its two-digit division range from the
  // 21-row sector lookup so the listing follows the KBLI hierarchy.
  if (field.semantic_id === "kbli_kode") {
    const parentSector = parentRaw ? parentRaw.slice(0, 8) : "";
    if (parentSector) {
      const sectorRow = (
        await database.raw(
          `SELECT division_start,division_end FROM analitik_kbli_sector WHERE schema_version=1 AND code=?`,
          [parentSector],
        )
      ).rows?.[0];
      if (!sectorRow) return { fieldId, options: [], nextCursor: null };
      const scopedSql = likeParam
        ? `SELECT ku.kode AS id, ku.kode AS label FROM klasifikasi_usaha ku JOIN analitik_kbli_sector s ON s.schema_version=1 AND s.code=? WHERE SUBSTRING(ku.kode,1,2) BETWEEN s.division_start AND s.division_end AND ku.kode ILIKE ? ORDER BY ku.kode LIMIT ?`
        : `SELECT ku.kode AS id, ku.kode AS label FROM klasifikasi_usaha ku JOIN analitik_kbli_sector s ON s.schema_version=1 AND s.code=? WHERE SUBSTRING(ku.kode,1,2) BETWEEN s.division_start AND s.division_end ORDER BY ku.kode LIMIT ?`;
      const scopedParams = likeParam
        ? [parentSector, likeParam, limit]
        : [parentSector, limit];
      const scopedRows = await runRefQuery(scopedSql, scopedParams);
      return {
        fieldId,
        options: scopedRows.map((r) => ({ id: String(r.id), label: r.label })),
        nextCursor: null,
      };
    }
    const sql = likeParam
      ? `SELECT kode AS id, kode AS label FROM klasifikasi_usaha WHERE kode ILIKE ? ORDER BY kode LIMIT ?`
      : `SELECT kode AS id, kode AS label FROM klasifikasi_usaha ORDER BY kode LIMIT ?`;
    const params = likeParam ? [likeParam, limit] : [limit];
    const rows = await runRefQuery(sql, params);
    return {
      fieldId,
      options: rows.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // Status fields – static enum, no DB
  if (field.semantic_id === "status_usaha") {
    const opts = [
      { id: "active", label: "Aktif" },
      { id: "archived", label: "Diarsipkan" },
    ];
    const filtered = likeParam
      ? opts.filter(
          (o) =>
            o.label.toLowerCase().startsWith(search.toLowerCase()) ||
            o.id.startsWith(search.toLowerCase()),
        )
      : opts;
    return { fieldId, options: filtered.slice(0, limit), nextCursor: null };
  }
  if (field.semantic_id === "status_hukum") {
    // Distinct from small set, but fallback to reference not available – use snapshot options or distinct on small distinct set
    // Use a bounded DISTINCT on fact only with prefix and budget, but limit to 100
    if (!likeParam) {
      // Without search, return empty to avoid % scan; caller should provide search
      return { fieldId, options: [], nextCursor: null };
    }
    const result = await runRefQuery(
      `SELECT DISTINCT COALESCE(a.status_hukum,'Tidak diketahui') AS label, COALESCE(a.status_hukum,'Tidak diketahui') AS id FROM analitik_usaha_current a JOIN analitik_active_generation p ON p.id=1 AND p.active_generation_id=a.generation_id WHERE COALESCE(a.status_hukum,'Tidak diketahui') ILIKE ? ORDER BY label LIMIT ?`,
      [likeParam, limit],
    );
    return {
      fieldId,
      options: result.map((r) => ({ id: String(r.id), label: r.label })),
      nextCursor: null,
    };
  }

  // Fallback: for any other allowed field, require prefix search to avoid full scan
  if (!likeParam) return { fieldId, options: [], nextCursor: null };
  // Should not reach here for known fields
  return { fieldId, options: [], nextCursor: null };
}
module.exports = { safeField, getMetadata, getOptions };
