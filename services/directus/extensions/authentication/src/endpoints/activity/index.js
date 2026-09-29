import cakupan from "../../../../../analytics-shared/cakupan.cjs";
import { list } from "./service.js";

const { terjaga, ALL_ROLES } = cakupan;

// GET /v1/auth/activity  (authenticated, semua peran) the current user's session activity log
export default (router, context) => {
  router.get("/", terjaga({ peran: ALL_ROLES }, (ctx) => (req, res) => list(ctx)(req, res))(context));
};
