/**
 * Directus endpoint `tabular` — data tabular UMKM untuk dashboard.
 *
 * Membaca hanya dari snapshot publik `usaha_tabular` (lihat
 * scripts/refresh-dashboard-snapshots.sql) sehingga paginasi & filter tetap cepat
 * untuk jutaan baris. Endpoint ini publik, sama seperti endpoint `infografis`.
 *
 * Routes:
 *   GET  /tabular/               → { data: rows, meta: { filterCount, page, pageSize } }
 *   GET  /tabular/spasial        → { data: points, meta: { filterCount, mikro, kecil, menengah, limit } }
 *   GET  /tabular/options        → { data: { kota, kecamatan, kategori, kbli } }
 *   GET  /tabular/kelurahan?kecamatan=<id> → { data: kelurahan }
 *   GET  /tabular/status         → waktu dan total snapshot aktif
 *   POST /tabular/publish        → terbitkan snapshot (Super Admin)
 */
const { routeGuard } = require("../../shared/auth.cjs");
const { buildTabularFilter, positiveInt } = require("../../shared/tabular-filter.cjs");

const rows = (result) => result.rows ?? result[0] ?? [];
const privateHeaders = (res) => { res.setHeader?.("Cache-Control", "private, no-store"); };

const readStatus = async (database) => {
  const result = await database.raw(`
    SELECT refreshed_at AS "refreshedAt",
           (payload -> 'scales' ->> 'total')::integer AS total
    FROM infografis_snapshot
    WHERE id = 1
  `);
  return rows(result)[0] ?? { refreshedAt: null, total: 0 };
};

module.exports = {
  id: "tabular",
  handler: (router, { database, logger }) => {
    router.get("/status", async (req, res, next) => {
      if (!routeGuard(req, next)) return; privateHeaders(res);
      try {
        res.json({ data: await readStatus(database) });
      } catch (error) {
        logger.error(error, "Unable to read dashboard publish status");
        next(error);
      }
    });

    router.post("/publish", async (req, res, next) => {
      if (!routeGuard(req, next, { adminOnly: true })) return;
      try {
        const result = await database.raw("SELECT analitik_enqueue_job('rebuild_current_model', 'rebuild_current_model', NULL) AS id");
        const jobId = rows(result)[0]?.id;
        res.status(202).json({ data: { jobId, status: "queued" } });
      } catch (error) {
        logger.error(error, "Unable to enqueue dashboard rebuild");
        next(error);
      }
    });

    // Filter dropdown options (dimuat sekali oleh halaman).
    router.get("/options", async (req, res, next) => {
      if (!routeGuard(req, next)) return; privateHeaders(res);
      try {
        const [kotaResult, kecamatanResult, kategoriResult, kbliResult] = await Promise.all([
          database.raw(`
            SELECT DISTINCT kota_id AS id, kota_nama AS nama
            FROM usaha_tabular
            ORDER BY kota_nama
          `),
          database.raw(`
            SELECT DISTINCT kecamatan_id AS id, kecamatan_nama AS nama, kota_id AS "kotaId"
            FROM usaha_tabular
            ORDER BY kecamatan_nama
          `),
          database.raw(`
            SELECT DISTINCT kategori_kbli AS nama
            FROM usaha_tabular
            WHERE kategori_kbli IS NOT NULL
            ORDER BY nama
          `),
          database.raw(`
            SELECT DISTINCT kode_kbli AS kode, kategori_kbli AS kategori
            FROM usaha_tabular
            WHERE kode_kbli IS NOT NULL
            ORDER BY kode_kbli
          `),
        ]);

        res.json({
          data: {
            kota: rows(kotaResult),
            kecamatan: rows(kecamatanResult),
            kategori: rows(kategoriResult).map((item) => item.nama),
            kbli: rows(kbliResult),
          },
        });
      } catch (error) {
        logger.error(error, "Unable to read tabular filter options");
        next(error);
      }
    });

    // Kelurahan untuk satu kecamatan (opsi kaskade filter).
    router.get("/kelurahan", async (req, res, next) => {
      if (!routeGuard(req, next)) return; privateHeaders(res);
      const kecamatanId = positiveInt(req.query?.kecamatan, null);
      if (kecamatanId === null) {
        res
          .status(400)
          .json({ errors: [{ message: "Query parameter 'kecamatan' is required." }] });
        return;
      }
      try {
        const result = await database.raw(
          `
            SELECT DISTINCT kelurahan_id AS id, kelurahan_nama AS nama
            FROM usaha_tabular
            WHERE kecamatan_id = ?
            ORDER BY kelurahan_nama
          `,
          [kecamatanId],
        );
        res.json({ data: rows(result) });
      } catch (error) {
        logger.error(error, "Unable to read kelurahan options");
        next(error);
      }
    });

    // Halaman data + jumlah data yang cocok dengan filter.
    router.get("/", async (req, res, next) => {
      if (!routeGuard(req, next)) return; privateHeaders(res);
      try {
        const q = req.query ?? {};
        const page = positiveInt(q.page, 1);
        const pageSize = Math.min(Math.max(positiveInt(q.page_size, 10), 1), 1000);

        const { where, params } = buildTabularFilter(q);

        const selectSql = `
          SELECT t.id, t.nama, t.skala, t.produk_utama AS "produkUtama",
                 t.kegiatan_utama AS "kegiatanUtama",
                 t.kode_kbli AS "kodeKbli", t.kategori_kbli AS "kategoriKbli",
                 t.kota_nama AS kota, t.kecamatan_nama AS kecamatan,
                 t.kelurahan_nama AS kelurahan
          FROM usaha_tabular t
          ${where}
          ORDER BY t.nama, t.id
          LIMIT ? OFFSET ?
        `;
        const countSql = `
          SELECT COUNT(*) AS "filterCount"
          FROM usaha_tabular t
          ${where}
        `;

        const [result, countResult] = await Promise.all([
          database.raw(selectSql, [...params, pageSize, (page - 1) * pageSize]),
          database.raw(countSql, params),
        ]);

        res.json({
          data: rows(result),
          meta: {
            filterCount: Number(rows(countResult)[0]?.filterCount ?? 0),
            page,
            pageSize,
          },
        });
      } catch (error) {
        logger.error(error, "Unable to read tabular rows");
        next(error);
      }
    });

    // Titik spasial (usaha berkoordinat) + rekap skala untuk peta.
    // Count skala dihitung dari semua baris yang cocok filter (bukan hanya
    // yang berkoordinat), sehingga angka kartu skala konsisten dengan tabular.
    router.get("/spasial", async (req, res, next) => {
      if (!routeGuard(req, next)) return; privateHeaders(res);
      try {
        const q = req.query ?? {};
        const limit = Math.min(Math.max(positiveInt(q.limit, 1000), 1), 5000);

        const { where, params } = buildTabularFilter(q);
        const coordClause = "t.latitude IS NOT NULL AND t.longitude IS NOT NULL";
        const pointWhere = where ? `${where} AND ${coordClause}` : `WHERE ${coordClause}`;

        const [result, countResult] = await Promise.all([
          database.raw(
            `
              SELECT t.id, t.nama, t.skala, t.produk_utama AS "produkUtama",
                     t.kegiatan_utama AS "kegiatanUtama",
                     t.kode_kbli AS "kodeKbli", t.kategori_kbli AS "kategoriKbli",
                     t.kota_nama AS kota, t.kecamatan_nama AS kecamatan,
                     t.latitude::float AS latitude, t.longitude::float AS longitude
              FROM usaha_tabular t
              ${pointWhere}
              ORDER BY t.nama, t.id
              LIMIT ?
            `,
            [...params, limit],
          ),
          database.raw(
            `
              SELECT COUNT(*) AS "filterCount",
                     COUNT(*) FILTER (WHERE t.skala = 'micro')::integer AS mikro,
                     COUNT(*) FILTER (WHERE t.skala = 'small')::integer AS kecil,
                     COUNT(*) FILTER (WHERE t.skala = 'medium')::integer AS menengah
              FROM usaha_tabular t
              ${where}
            `,
            params,
          ),
        ]);

        const [countRow] = rows(countResult);
        res.json({
          data: rows(result),
          meta: {
            filterCount: Number(countRow?.filterCount ?? 0),
            mikro: Number(countRow?.mikro ?? 0),
            kecil: Number(countRow?.kecil ?? 0),
            menengah: Number(countRow?.menengah ?? 0),
            limit,
          },
        });
      } catch (error) {
        logger.error(error, "Unable to read tabular points");
        next(error);
      }
    });
  },
};
