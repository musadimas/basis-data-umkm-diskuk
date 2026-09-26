import { routeGuard } from "../../lib/utils/http.js";
import { issuePassport, readPassport, revokePassport, verifyPassport } from "./service.js";

// Talent Passport (Brief Fitur Modul 6):
//   GET  /v1/program/passport?usaha=        active passport and eligibility (authenticated)
//   POST /v1/program/passport               issue or re-issue (province/admin)
//   POST /v1/program/passport/:id/cabut     revoke (province/admin)
//   GET  /v1/program/passport/verify/:kode  PUBLIC signature check and public portfolio
export default (router, context) => {
  const guarded = (handler) => (req, res, next) => routeGuard(req, next) && handler(context)(req, res);
  router.get("/verify/:kode", verifyPassport(context));
  router.get("/", guarded(readPassport));
  router.post("/", guarded(issuePassport));
  router.post("/:id/cabut", guarded(revokePassport));
};
