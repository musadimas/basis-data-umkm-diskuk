const { routeGuard } = require("../../shared/auth.cjs");

const rows = (result) => result?.rows ?? result?.[0] ?? [];

const GEOMETRY_SOURCE = {
  name: "Badan Informasi Geospasial (BIG)",
  edition: "September 2023",
  url: "https://geoservices.big.go.id/rbi/rest/services/Hosted/Wilayah_Administrasi_Kabupaten__Kota/FeatureServer/0",
};

async function attachAuthoritativeGeometry(database, payload) {
  const result = await database.raw(`
    SELECT
      k.id::text AS id,
      k.nama AS name,
      k.kode AS code,
      ST_AsGeoJSON(k.geom, 6)::json AS geometry
    FROM kota k
    JOIN provinsi p ON p.id = k.provinsi
    WHERE lower(p.nama) = 'jawa barat'
      AND lower(k.nama) <> 'tidak diketahui'
      AND nullif(btrim(k.kode), '') IS NOT NULL
      AND k.geom IS NOT NULL
      AND ST_IsValid(k.geom)
    ORDER BY k.kode
  `);
  const boundaries = rows(result);
  const geometryReady = boundaries.length === 27 && new Set(boundaries.map((item) => item.code)).size === 27;
  if (!geometryReady) {
    return {
      ...payload,
      geometryReady: false,
      geometrySource: { ...GEOMETRY_SOURCE, regions: boundaries.length },
    };
  }

  const counts = new Map((payload.regions ?? []).map((item) => [String(item.id), Number(item.value) || 0]));
  const unknown = (payload.regions ?? []).filter((item) => !boundaries.some((boundary) => boundary.id === String(item.id)));
  return {
    ...payload,
    regions: [
      ...boundaries.map((boundary) => ({ ...boundary, value: counts.get(boundary.id) ?? 0 })),
      ...unknown,
    ],
    geometryReady: true,
    geometrySource: { ...GEOMETRY_SOURCE, regions: 27 },
  };
}

module.exports = {
  id: "infografis",
  handler: (router, { database, logger }) => {
    router.get("/", async (req, res, next) => {
      if (!routeGuard(req, next)) return;
      try {
        const result = await database.raw("SELECT payload FROM infografis_snapshot WHERE id = 1");
        const payload = rows(result)[0]?.payload;
        if (!payload) throw new Error("Infographic snapshot has not been refreshed");
        const response = await attachAuthoritativeGeometry(database, payload);
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ data: response });
      } catch (error) {
        logger.error(error, "Unable to read infographic snapshot");
        next(error);
      }
    });
  },
};

module.exports.attachAuthoritativeGeometry = attachAuthoritativeGeometry;
