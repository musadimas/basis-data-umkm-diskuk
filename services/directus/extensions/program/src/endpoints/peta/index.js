import { noStore, sendError } from "../../lib/utils/http.js";
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { uuidParam } from "../../lib/validate.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { terjaga, pastikanUsaha } = cakupan;

// Map pin card (Brief Fitur Modul 3), authenticated:
//   GET /v1/program/peta/:usahaId   business, owner name, scale, KBLI, turnover, valid certificates, talent status
// ADR-004: owner name and exact turnover are allowed for signed-in dashboard users; NIK is not sent.
// Kandidat 01 (pilot): gate lewat module Cakupan Pemanggil — muatPemanggil
// fail-closed + pastikanUsaha 404 seragam (K1). Peran yang boleh: provinsi,
// kabkota, umkm (pendamping tidak punya akses usaha).
export default (router, ctx) => {
  router.get(
    "/:usahaId",
    terjaga({ peran: ["provinsi", "kabkota", "umkm"] }, (inner) => async (req, res, pemanggil) => {
      try {
        const usahaId = uuidParam(req.params?.usahaId, "INVALID_USAHA_ID");
        await pastikanUsaha(inner.database, pemanggil, usahaId);
        const usaha = await loadUsahaSummary(inner.database, usahaId);
        const legalitas = await loadLegalitas(inner.database, usahaId);
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
      } catch (error) {
        sendError(res, inner.logger, error);
      }
    })(ctx),
  );
};
