import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Certificates of one business, for the map card, katalog and passport badges. A permit whose
 * berlaku_hingga has passed is reported as kedaluwarsa even if nobody has updated its status.
 */
export const listForUsaha =
  ({ database, logger }) =>
  async (req, res) => {
    try {
      const usahaId = req.params?.usahaId;
      if (!UUID.test(usahaId ?? "")) throw new ProgramError(400, "INVALID_USAHA_ID", "The business id is not valid.");

      // LEFT JOIN from usaha: no row means the business does not exist, one row with a NULL id
      // means it exists without certificates.
      const result = await database.raw(
        `SELECT l.id, l.jenis, l.nomor,
                CASE WHEN l.status = 'terbit' AND l.berlaku_hingga < CURRENT_DATE THEN 'kedaluwarsa' ELSE l.status END AS status,
                l.berlaku_hingga AS "berlakuHingga", l.berkas
           FROM usaha u
           LEFT JOIN usaha_legalitas l ON l.usaha = u.id
          WHERE u.id = ?
          ORDER BY l.jenis, l.berlaku_hingga DESC NULLS LAST`,
        [usahaId],
      );
      const found = rows(result);
      if (found.length === 0) throw new ProgramError(404, "USAHA_NOT_FOUND", "The business was not found.");

      noStore(res);
      res.json({ data: found.filter((item) => item.id !== null) });
    } catch (error) {
      sendError(res, logger, error);
    }
  };
