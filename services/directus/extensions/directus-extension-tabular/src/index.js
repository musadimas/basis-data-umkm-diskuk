/**
 * Directus endpoint `tabular` — data tabular UMKM untuk dashboard.
 *
 * Membaca hanya dari snapshot publik `usaha_tabular` (lihat
 * scripts/refresh-dashboard-snapshots.sql) sehingga paginasi & filter tetap cepat
 * untuk jutaan baris. Endpoint ini publik, sama seperti endpoint `infografis`.
 *
 * Routes:
 *   GET  /tabular/               → { data: rows, meta: { filterCount, page, pageSize } }
 *   GET  /tabular/options        → { data: { kota, kecamatan, kategori, kbli } }
 *   GET  /tabular/kelurahan?kecamatan=<id> → { data: kelurahan }
 *   GET  /tabular/status         → waktu dan total snapshot aktif
 *   POST /tabular/publish        → terbitkan snapshot (Super Admin)
 */
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const rows = (result) => result.rows ?? result[0] ?? [];

const publishSqlPath = [
  join(__dirname, "publish.sql"),
  join(__dirname, "../../../../../scripts/refresh-dashboard-snapshots.sql"),
].find(existsSync);

const publishSql = () => {
  if (!publishSqlPath) throw new Error("Dashboard publish SQL not found");
  return readFileSync(publishSqlPath, "utf8");
};

const readStatus = async (database) => {
  const result = await database.raw(`
    SELECT refreshed_at AS "refreshedAt",
           (payload -> 'scales' ->> 'total')::integer AS total
    FROM infografis_snapshot
    WHERE id = 1
  `);
  return rows(result)[0] ?? { refreshedAt: null, total: 0 };
};

const VALID_SKALA = ["micro", "small", "medium"];

/** Parse bilangan bulat positif; kembalikan fallback bila tidak valid. */
const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Normalisasi string query opsional (null bila kosong/melebihi batas). */
const stringParam = (value, maxLength = 255) =>
  typeof value === "string" && value.length > 0 ? value.slice(0, maxLength) : null;

module.exports = {
  id: "tabular",
  handler: (router, { database, logger }) => {
    router.get("/status", async (_req, res, next) => {
      try {
        res.json({ data: await readStatus(database) });
      } catch (error) {
        logger.error(error, "Unable to read dashboard publish status");
        next(error);
      }
    });

    router.post("/publish", async (req, res, next) => {
      if (req.accountability?.admin !== true) {
        res.status(403).json({ errors: [{ message: "Super Admin access is required." }] });
        return;
      }

      try {
        await database.raw(publishSql());
        res.json({ data: await readStatus(database) });
      } catch (error) {
        logger.error(error, "Unable to publish dashboard snapshots");
        next(error);
      }
    });

    // Filter dropdown options (dimuat sekali oleh halaman).
    router.get("/options", async (_req, res, next) => {
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
      try {
        const q = req.query ?? {};
        const page = positiveInt(q.page, 1);
        const pageSize = Math.min(Math.max(positiveInt(q.page_size, 10), 1), 1000);

        // Bangun WHERE dinamis dengan parameter binding (bebas SQL injection).
        const clauses = [];
        const params = [];
        const push = (column, value) => {
          if (value === null) return;
          params.push(value);
          clauses.push(`${column} = ?`);
        };

        push("t.kota_id", positiveInt(q.kota, null));
        push("t.kecamatan_id", positiveInt(q.kecamatan, null));
        push("t.kelurahan_id", positiveInt(q.kelurahan, null));
        push("t.skala", VALID_SKALA.includes(q.skala) ? q.skala : null);
        push("t.kategori_kbli", stringParam(q.kegiatan));
        push("t.kode_kbli", stringParam(q.kbli));

        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

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
  },
};
