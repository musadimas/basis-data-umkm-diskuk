import { issuePassport, readPassport, revokePassport, verifyPassport } from "./service.js";
import { exportSummaryPdf, exportKatalogPdf } from "./pdf.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { publik, terjaga } = cakupan;

// Talent Passport (Brief Fitur Modul 6):
//   GET  /v1/program/passport?usaha=        active passport and eligibility (authenticated)
//   POST /v1/program/passport               issue or re-issue (province/admin)
//   POST /v1/program/passport/:id/cabut     revoke (province/admin)
//   GET  /v1/program/passport/verify/:kode  PUBLIC signature check and public portfolio
//   GET  /v1/program/passport/pdf/summary   download Executive Summary & Scorecard PDF
//   GET  /v1/program/passport/pdf/katalog   download Katalog Ekspor Resmi PDF
// Kandidat 01: baca + PDF untuk provinsi/kabkota (K8 read-only, konsisten
// dengan PDF)/umkm sendiri; terbit/cabut provinsi saja; verifikasi publik.
const BACA = { peran: ["provinsi", "kabkota", "umkm"] };
const TERBIT = { peran: ["provinsi"] };

export default (router, context) => {
  router.get("/verify/:kode", publik(verifyPassport)(context));
  router.get("/pdf/summary", terjaga(BACA, exportSummaryPdf)(context));
  router.get("/pdf/katalog", terjaga(BACA, exportKatalogPdf)(context));
  router.get("/", terjaga(BACA, readPassport)(context));
  router.post("/", terjaga(TERBIT, issuePassport)(context));
  router.post("/:id/cabut", terjaga(TERBIT, revokePassport)(context));
};
