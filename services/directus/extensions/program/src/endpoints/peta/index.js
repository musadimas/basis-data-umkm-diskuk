import { noStore, routeGuard, sendError } from "../../lib/utils/http.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { uuidParam } from "../../lib/validate.js";

// Map pin card (Brief Fitur Modul 3), authenticated:
//   GET /v1/program/peta/:usahaId   business, owner name, scale, KBLI, turnover, valid certificates, talent status
// ADR-004: owner name and exact turnover are allowed for signed-in dashboard users; NIK is not sent.
export default (router, { database, logger }) => {
  router.get("/:usahaId", (req, res, next) => {
    if (!routeGuard(req, next)) return;
    (async () => {
      const usahaId = uuidParam(req.params?.usahaId, "INVALID_USAHA_ID");
      const usaha = await loadUsahaSummary(database, usahaId);
      const legalitas = await loadLegalitas(database, usahaId);
      noStore(res);
      res.json({
        data: {
          id: usaha.id,
          nama: usaha.nama,
          pemilik: usaha.pemilik.nama,
          skala: usaha.skala,
          kodeKbli: usaha.kodeKbli,
          kegiatanUtama: usaha.kegiatanUtama,
          omzetTahunan: usaha.omzetTahunan,
          sertifikasi: [...new Set(legalitas.filter((item) => item.status === "terbit").map((item) => item.jenis))].sort(),
          talentStatus: usaha.talentStatus,
          talentBatch: usaha.talentBatch,
        },
      });
    })().catch((error) => sendError(res, logger, error));
  });
};
