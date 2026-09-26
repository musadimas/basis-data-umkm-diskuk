import { routeGuard } from "../../lib/utils/http.js";
import { list } from "./service.js";

// GET /v1/auth/activity  (authenticated) the current user's session activity log
export default (router, context) => {
  router.get("/", (req, res, next) => routeGuard(req, next) && list(context)(req, res));
};
