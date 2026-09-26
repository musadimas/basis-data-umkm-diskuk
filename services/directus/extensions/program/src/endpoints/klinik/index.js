import { routeGuard } from "../../lib/utils/http.js";
import { createTiket, listTiket, lookup, slots, updateTiket } from "./service.js";

// Klinik Konsultasi (Brief Fitur Modul 7.3):
//   POST  /v1/program/klinik/lookup      PUBLIC, captcha: NIB/NIK → business summary
//   GET   /v1/program/klinik/slot        PUBLIC: free slots for a poli and date
//   POST  /v1/program/klinik/tiket       PUBLIC, captcha, multipart: book a consultation
//   GET   /v1/program/klinik/tiket       staff: kanban
//   PATCH /v1/program/klinik/tiket/:id   staff: status, assignment, session record, referrals
export default (router, context) => {
  const guarded = (handler) => (req, res, next) => routeGuard(req, next) && handler(context)(req, res);
  router.post("/lookup", lookup(context));
  router.get("/slot", slots(context));
  router.post("/tiket", createTiket(context));
  router.get("/tiket", guarded(listTiket));
  router.patch("/tiket/:id", guarded(updateTiket));
};
