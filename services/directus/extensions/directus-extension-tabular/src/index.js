/**
 * Directus endpoint `tabular` — data tabular UMKM untuk dashboard.
 *
 * Membaca dari tabel materialized `usaha_tabular` (lihat
 * services/directus/migrations/20260816B-create-usaha-tabular.js dan
 * scripts/refresh-usaha-tabular.sql) sehingga paginasi & filter tetap cepat
 * untuk jutaan baris. Endpoint ini publik, sama seperti endpoint `infografis`.
 *
 * Routes:
 *   GET  /tabular/               → { data: rows, meta: { filterCount, page, pageSize } }
 *   GET  /tabular/options        → { data: { kota, kecamatan, kategori, kbli } }
 *   GET  /tabular/kelurahan?kecamatan=<id> → { data: kelurahan }
 */
const rows = (result) => result.rows ?? result[0] ?? [];

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
    // Filter dropdown options (dimuat sekali oleh halaman).
    router.get("/options", async (_req, res, next) => {
      try {
        const [kotaResult, kecamatanResult, kategoriResult, kbliResult] = await Promise.all([
          database.raw(`
            SELECT DISTINCT t.kota_id AS id, ko.nama
            FROM usaha_tabular t
            JOIN kota ko ON ko.id = t.kota_id
            ORDER BY ko.nama
          `),
          database.raw(`
            SELECT DISTINCT t.kecamatan_id AS id, kc.nama, kc.kota AS "kotaId"
            FROM usaha_tabular t
            JOIN kecamatan kc ON kc.id = t.kecamatan_id
            ORDER BY kc.nama
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
            SELECT DISTINCT l.id, l.nama
            FROM kelurahan l
            JOIN usaha_tabular t ON t.kelurahan_id = l.id
            WHERE l.kecamatan = ?
            ORDER BY l.nama
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
                 ko.nama AS kota, kc.nama AS kecamatan, kl.nama AS kelurahan
          FROM usaha_tabular t
          JOIN kota ko ON ko.id = t.kota_id
          JOIN kecamatan kc ON kc.id = t.kecamatan_id
          JOIN kelurahan kl ON kl.id = t.kelurahan_id
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
