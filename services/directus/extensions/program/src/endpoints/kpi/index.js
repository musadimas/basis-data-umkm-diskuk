import { routeGuard } from "../../lib/utils/http.js";
import { listLaporan, listPeserta, readPeserta, reviewLaporan, setPitching, submitLaporan } from "./service.js";

// Weekly KPI monitoring (Brief Fitur Modul 5), all authenticated and scoped by app_role:
//   GET   /v1/program/kpi/peserta                 active participants with this week's status
//   GET   /v1/program/kpi/peserta/:id             participant, weekly reports, pitching streak
//   POST  /v1/program/kpi/peserta/:id/laporan     submit a week's report (idempotent on clientUuid)
//   PATCH /v1/program/kpi/peserta/:id/pitching    toggle the pitching recommendation
//   GET   /v1/program/kpi/laporan?status=         review queue
//   POST  /v1/program/kpi/laporan/:id/review      approve or reject a report
export default (router, context) => {
  const guarded = (handler) => (req, res, next) => routeGuard(req, next) && handler(context)(req, res);
  router.get("/peserta", guarded(listPeserta));
  router.get("/peserta/:id", guarded(readPeserta));
  router.post("/peserta/:id/laporan", guarded(submitLaporan));
  router.patch("/peserta/:id/pitching", guarded(setPitching));
  router.get("/laporan", guarded(listLaporan));
  router.post("/laporan/:id/review", guarded(reviewLaporan));
};
