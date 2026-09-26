const { routeGuard } = require("../../shared/auth.cjs");
const { buildTabularFilter } = require("../../shared/tabular-filter.cjs");
const { DATA_ROLES, resolveOperator, scopeTabularQuery } = require("../../shared/operator.cjs");
const { KBLI_SECTORS } = require("../../../analytics-shared/contracts.cjs");

const rows = (result) => result?.rows ?? result?.[0] ?? [];

const GEOMETRY_SOURCES = {
  kota: {
    name: "Badan Informasi Geospasial (BIG)",
    edition: "September 2023",
    url: "https://geoservices.big.go.id/rbi/rest/services/Hosted/Wilayah_Administrasi_Kabupaten__Kota/FeatureServer/0",
  },
  kecamatan: {
    name: "Peta Nusa / Kepmendagri",
    edition: "Februari 2026 / Kepmendagri 2025",
    url: "https://warga.web.id/files/indonesia/download.html",
  },
  kelurahan: {
    name: "Peta Nusa / Kepmendagri",
    edition: "Februari 2026 / Kepmendagri 2025",
    url: "https://warga.web.id/files/indonesia/download.html",
  },
};

const REGION_COLUMNS = {
  kota: ["kota_id", "kota_nama"],
  kecamatan: ["kecamatan_id", "kecamatan_nama"],
  kelurahan: ["kelurahan_id", "kelurahan_nama"],
};

const REGION_TABLES = {
  kota: "kota",
  kecamatan: "kecamatan",
  kelurahan: "kelurahan",
};

const positiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const regionLevelFor = (query = {}) =>
  positiveId(query.kecamatan) || positiveId(query.kelurahan)
    ? "kelurahan"
    : positiveId(query.kota)
      ? "kecamatan"
      : "kota";

const filteredPayloadSql = (where, regionLevel = "kota") => {
  const [regionId, regionName] =
    REGION_COLUMNS[regionLevel] ?? REGION_COLUMNS.kota;
  return `
  WITH filtered AS MATERIALIZED (
    SELECT t.* FROM usaha_tabular t ${where}
  ),
  scale AS (
    SELECT jsonb_build_object(
      'total', COUNT(*)::integer,
      'mikro', COUNT(*) FILTER (WHERE skala = 'micro')::integer,
      'kecil', COUNT(*) FILTER (WHERE skala = 'small')::integer,
      'menengah', COUNT(*) FILTER (WHERE skala = 'medium')::integer
    ) AS value
    FROM filtered
  ),
  regions AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('id', id, 'name', name, 'value', value)
      ORDER BY value DESC, name ASC
    ), '[]'::jsonb) AS value
    FROM (
      SELECT COALESCE(${regionId}::text, 'unknown') AS id,
             COALESCE(${regionName}, 'Tidak diketahui') AS name,
             COUNT(*)::integer AS value
      FROM filtered
      GROUP BY ${regionId}, ${regionName}
    ) grouped
  ),
  sector_definition AS (
    SELECT *
    FROM jsonb_to_recordset(?::jsonb)
      AS sector(code text, name text, division_start integer, division_end integer)
  ),
  sector_rows AS (
    SELECT sector.code, sector.name,
           COUNT(filtered.id)::integer AS total,
           COUNT(*) FILTER (WHERE filtered.skala = 'micro')::integer AS mikro,
           COUNT(*) FILTER (WHERE filtered.skala = 'small')::integer AS kecil,
           COUNT(*) FILTER (WHERE filtered.skala = 'medium')::integer AS menengah
    FROM sector_definition sector
    LEFT JOIN filtered ON (
      CASE WHEN filtered.kode_kbli ~ '^[0-9]{2,5}$'
        THEN LEFT(filtered.kode_kbli, 2)::integer END
    ) BETWEEN sector.division_start AND sector.division_end
    GROUP BY sector.code, sector.name
  ),
  sector_coverage AS (
    SELECT jsonb_build_object(
      'mapped', COALESCE(SUM(total), 0)::integer,
      'unclassified', ((SELECT COUNT(*) FROM filtered) - COALESCE(SUM(total), 0))::integer
    ) AS value
    FROM sector_rows
  ),
  sectors AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code, 'name', name, 'total', total,
        'mikro', mikro, 'kecil', kecil, 'menengah', menengah,
        'percentage', COALESCE(ROUND(total * 100.0 / NULLIF((SELECT COUNT(*) FROM filtered), 0), 1), 0)
      ) ORDER BY total DESC, code ASC
    ), '[]'::jsonb) AS value
    FROM sector_rows
  ),
  kbli_rows AS (
    SELECT kode_kbli AS code, kategori_kbli AS name, deskripsi_kbli AS description,
           COUNT(*)::integer AS total,
           COUNT(*) FILTER (WHERE skala = 'micro')::integer AS mikro,
           COUNT(*) FILTER (WHERE skala = 'small')::integer AS kecil,
           COUNT(*) FILTER (WHERE skala = 'medium')::integer AS menengah
    FROM filtered
    WHERE kode_kbli IS NOT NULL
    GROUP BY kode_kbli, kategori_kbli, deskripsi_kbli
  ),
  kbli AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code, 'name', name, 'description', description, 'total', total,
        'mikro', mikro, 'kecil', kecil, 'menengah', menengah
      ) ORDER BY total DESC, code ASC
    ), '[]'::jsonb) AS all_rows,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', code, 'name', name, 'description', description, 'total', total,
        'mikro', mikro, 'kecil', kecil, 'menengah', menengah
      ) ORDER BY total DESC, code ASC
    ) FILTER (WHERE rank <= 5), '[]'::jsonb) AS top_rows
    FROM (
      SELECT *, row_number() OVER (ORDER BY total DESC, code ASC) AS rank
      FROM kbli_rows
    ) ranked
  ),
  workforce_numbers AS (
    SELECT COALESCE(SUM(tenaga_kerja_laki_laki), 0)::bigint AS male,
           COALESCE(SUM(tenaga_kerja_perempuan), 0)::bigint AS female
    FROM filtered
  ),
  workforce AS (
    SELECT jsonb_build_object(
      'male', male, 'female', female, 'total', male + female,
      'malePercentage', COALESCE(ROUND(male * 100.0 / NULLIF(male + female, 0), 1), 0),
      'femalePercentage', COALESCE(ROUND(female * 100.0 / NULLIF(male + female, 0), 1), 0)
    ) AS value
    FROM workforce_numbers
  )
  SELECT jsonb_build_object(
    'scales', scale.value,
    'regions', regions.value,
    'sectors', sectors.value,
    'sectorCoverage', sector_coverage.value,
    'topKbli', kbli.top_rows,
    'kbli', kbli.all_rows,
    'workforce', workforce.value
  ) AS payload
  FROM scale, regions, sectors, sector_coverage, kbli, workforce
`;
};

async function withReadBudget(database, fn, signal) {
  if (signal?.aborted) {
    const e = new Error("Request aborted");
    e.code = "57014";
    e.statusCode = 499;
    throw e;
  }
  if (typeof database.transaction === "function") {
    return database.transaction(async (trx) => {
      await trx.raw("SET LOCAL statement_timeout = '4500ms'");
      await trx.raw("SET LOCAL lock_timeout = '500ms'");
      await trx.raw("SET TRANSACTION READ ONLY");
      if (signal) {
        const onAbort = () => {
          trx.raw("SELECT pg_cancel_backend(pg_backend_pid())").catch(() => {});
        };
        signal.addEventListener?.("abort", onAbort, { once: true });
        try {
          return await fn(trx);
        } finally {
          signal.removeEventListener?.("abort", onAbort);
        }
      }
      return fn(trx);
    });
  }
  return fn(database);
}

async function readMapPayload(database, query, signal) {
  const filter = buildTabularFilter(query);
  if (!filter.hasFilters) {
    const result = await database.raw(
      "SELECT payload->'regions' AS regions FROM infografis_snapshot WHERE id = 1",
    );
    return { regions: rows(result)[0]?.regions ?? [] };
  }

  const level = regionLevelFor(query);
  const [regionId] = REGION_COLUMNS[level] ?? REGION_COLUMNS.kota;
  const table = REGION_TABLES[level] ?? REGION_TABLES.kota;
  const result = await withReadBudget(
    database,
    (trx) =>
      trx.raw(
        `
    WITH counts AS (
      SELECT t.${regionId} AS id, COUNT(*)::integer AS value
      FROM usaha_tabular t ${filter.where}
      GROUP BY t.${regionId}
    )
    SELECT COALESCE(counts.id::text, 'unknown') AS id,
           COALESCE(region.nama, 'Tidak diketahui') AS name,
           counts.value
    FROM counts
    LEFT JOIN ${table} region ON region.id = counts.id
    ORDER BY counts.value DESC, name ASC
  `,
        filter.params,
      ),
    signal,
  );
  return { regions: rows(result) };
}

async function readPayload(database, query, signal) {
  const filter = buildTabularFilter(query);
  if (!filter.hasFilters) {
    const result = await database.raw(
      "SELECT payload FROM infografis_snapshot WHERE id = 1",
    );
    return rows(result)[0]?.payload;
  }
  const sectors = KBLI_SECTORS.map(
    ([code, name, division_start, division_end]) => ({
      code,
      name,
      division_start,
      division_end,
    }),
  );
  try {
    const result = await withReadBudget(
      database,
      (trx) =>
        trx.raw(filteredPayloadSql(filter.where, regionLevelFor(query)), [
          ...filter.params,
          JSON.stringify(sectors),
        ]),
      signal,
    );
    return rows(result)[0]?.payload;
  } catch (error) {
    if (
      error?.code === "57014" ||
      error?.code === "55P03" ||
      /statement timeout/i.test(String(error?.message))
    ) {
      const e = new Error(
        "Query timeout – filter terlalu luas, coba persempit",
      );
      e.statusCode = 504;
      e.code = "QUERY_TIMEOUT";
      throw e;
    }
    throw error;
  }
}

function geometryQuery(query = {}) {
  const level = regionLevelFor(query);
  if (level === "kecamatan") {
    return {
      level,
      sql: `SELECT r.id::text AS id,r.nama AS name,r.kode AS code,ST_AsGeoJSON(r.geom,6)::json AS geometry
        FROM kecamatan r JOIN kota k ON k.id=r.kota JOIN provinsi p ON p.id=k.provinsi
        WHERE lower(p.nama)='jawa barat' AND r.kota=? AND lower(r.nama)<>'tidak diketahui'
          AND nullif(btrim(r.kode),'') IS NOT NULL AND r.geom IS NOT NULL AND ST_IsValid(r.geom)
        ORDER BY r.kode`,
      params: [positiveId(query.kota)],
    };
  }
  if (level === "kelurahan") {
    const selected = positiveId(query.kelurahan);
    return {
      level,
      sql: `SELECT r.id::text AS id,r.nama AS name,r.kode AS code,ST_AsGeoJSON(r.geom,6)::json AS geometry
        FROM kelurahan r JOIN kecamatan kc ON kc.id=r.kecamatan JOIN kota k ON k.id=kc.kota JOIN provinsi p ON p.id=k.provinsi
        WHERE lower(p.nama)='jawa barat' AND ${selected ? "r.id" : "r.kecamatan"}=?
          AND lower(r.nama)<>'tidak diketahui' AND nullif(btrim(r.kode),'') IS NOT NULL
          AND r.geom IS NOT NULL AND ST_IsValid(r.geom)
        ORDER BY r.kode`,
      params: [selected ?? positiveId(query.kecamatan)],
    };
  }
  return {
    level,
    sql: `SELECT r.id::text AS id,r.nama AS name,r.kode AS code,ST_AsGeoJSON(r.geom,6)::json AS geometry
      FROM kota r JOIN provinsi p ON p.id=r.provinsi
      WHERE lower(p.nama)='jawa barat' AND lower(r.nama)<>'tidak diketahui'
        AND nullif(btrim(r.kode),'') IS NOT NULL AND r.geom IS NOT NULL AND ST_IsValid(r.geom)
      ORDER BY r.kode`,
    params: [],
  };
}

async function attachAuthoritativeGeometry(database, payload, query = {}) {
  const boundaryQuery = geometryQuery(query);
  const result = await database.raw(boundaryQuery.sql, boundaryQuery.params);
  const boundaries = rows(result);
  const geometrySource = GEOMETRY_SOURCES[boundaryQuery.level];
  if (!boundaries.length) {
    return {
      ...payload,
      regionLevel: boundaryQuery.level,
      geometryReady: false,
      geometryMissing: (payload.regions ?? []).filter(
        (item) => item.id !== "unknown" && item.value > 0,
      ).length,
      geometrySource: { ...geometrySource, regions: 0 },
    };
  }

  const counts = new Map(
    (payload.regions ?? []).map((item) => [
      String(item.id),
      Number(item.value) || 0,
    ]),
  );
  const unknown = (payload.regions ?? []).filter(
    (item) => !boundaries.some((boundary) => boundary.id === String(item.id)),
  );
  const geometryMissing = unknown.filter(
    (item) => item.id !== "unknown" && item.value > 0,
  ).length;
  return {
    ...payload,
    regionLevel: boundaryQuery.level,
    regions: [
      ...boundaries.map((boundary) => ({
        ...boundary,
        value: counts.get(boundary.id) ?? 0,
      })),
      ...unknown,
    ],
    geometryReady: true,
    geometryMissing,
    geometrySource: { ...geometrySource, regions: boundaries.length },
  };
}

module.exports = {
  id: "infografis",
  handler: (router, { database, logger }) => {
    router.get("/", async (req, res, next) => {
      if (!routeGuard(req, next, { roles: DATA_ROLES })) return;
      try {
        const operator = await resolveOperator(database, req.accountability);
        const q = scopeTabularQuery(req.query ?? {}, operator);
        const payload = await readPayload(database, q, req.signal);
        if (!payload)
          throw new Error("Infographic snapshot has not been refreshed");
        const response = await attachAuthoritativeGeometry(database, payload, q);
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ data: response });
      } catch (error) {
        logger.error(error, "Unable to read infographic snapshot");
        next(error);
      }
    });
    router.get("/map", async (req, res, next) => {
      if (!routeGuard(req, next, { roles: DATA_ROLES })) return;
      try {
        const operator = await resolveOperator(database, req.accountability);
        const q = scopeTabularQuery(req.query ?? {}, operator);
        const payload = await readMapPayload(database, q, req.signal);
        const response = await attachAuthoritativeGeometry(database, payload, q);
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ data: response });
      } catch (error) {
        logger.error(error, "Unable to read infographic map");
        next(error);
      }
    });
  },
};

module.exports.attachAuthoritativeGeometry = attachAuthoritativeGeometry;
module.exports.readPayload = readPayload;
module.exports.readMapPayload = readMapPayload;
module.exports.regionLevelFor = regionLevelFor;
