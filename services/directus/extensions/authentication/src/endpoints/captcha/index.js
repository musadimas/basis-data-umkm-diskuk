import { challenge } from "./service.js";

// GET /v1/auth/captcha/challenge
export default (router, { env, logger }) => {
  router.get("/challenge", challenge({ env, logger }));
};
