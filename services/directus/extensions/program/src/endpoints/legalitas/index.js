import { routeGuard } from "../../lib/utils/http.js";
import { listForUsaha } from "./service.js";

// GET /v1/program/legalitas/:usahaId  (authenticated) certificates and permits of one business
export default (router, context) => {
  router.get("/:usahaId", (req, res, next) => routeGuard(req, next) && listForUsaha(context)(req, res));
};
