import cakupan from "../../../../../analytics-shared/cakupan.cjs";
import { challenge } from "./service.js";

const { publik } = cakupan;

// GET /v1/auth/captcha/challenge (publik: tanpa sesi, dilindungi ALTCHA + batas login)
export default (router, context) => {
  router.get("/challenge", publik((ctx) => challenge(ctx))(context));
};
