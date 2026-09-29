import { samaRahasia, sendError } from "../../lib/utils/http.js";
import { cabutSertifikat, daftarKegiatan, eksporPendaftar, epassSaya, listPendaftar, nilaiTugas, pendaftaranSaya, pindaiHadir, prefillRegistrasi, putuskanPendaftar, terbitkanSertifikat, verifikasiSertifikat } from "./service.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";
const { publik, terjaga } = cakupan;
const UMKM = { peran: ["umkm"] };
const STAF = { peran: ["provinsi", "kabkota"] };
const handle = (ctx, res, fn) => fn().catch((error) => sendError(res, ctx.logger, error));
export default (router, ctx) => {
  router.get("/prefill", terjaga(UMKM, prefillRegistrasi)(ctx));
  router.post("/kegiatan/:id/daftar", terjaga(UMKM, daftarKegiatan)(ctx));
  router.get("/kegiatan/:id/saya", terjaga(UMKM, pendaftaranSaya)(ctx));
  router.get("/kegiatan/:id/epass", terjaga(UMKM, epassSaya)(ctx));
  router.get("/kegiatan/:id/pendaftar", terjaga(STAF, listPendaftar)(ctx));
  router.get("/kegiatan/:id/pendaftar/xlsx", terjaga(STAF, eksporPendaftar)(ctx));
  router.post("/pendaftar/:pendaftaranId/keputusan", terjaga(STAF, putuskanPendaftar)(ctx));
  router.post("/pendaftar/:pendaftaranId/tugas", terjaga(STAF, nilaiTugas)(ctx));
  router.post("/pendaftar/:pendaftaranId/sertifikat", terjaga(STAF, terbitkanSertifikat)(ctx));
  router.post("/sertifikat/:sertifikatId/cabut", terjaga(STAF, cabutSertifikat)(ctx));
  router.get("/sertifikat/:kode", publik(verifikasiSertifikat)(ctx));
  router.post("/pindai", publik((inner) => (req, res) => handle(inner, res, async () => {
    const secret = req.headers?.["x-operasional-internal-secret"];
    if (!inner.env?.OPERASIONAL_INTERNAL_SECRET || !samaRahasia(String(secret ?? ""), inner.env.OPERASIONAL_INTERNAL_SECRET)) {
      const { ProgramError } = await import("../../lib/utils/http.js");
      throw new ProgramError(403, "FORBIDDEN", "Scan butuh rahasia internal.");
    }
    await pindaiHadir(inner)(req, res);
  }))(ctx));
};
