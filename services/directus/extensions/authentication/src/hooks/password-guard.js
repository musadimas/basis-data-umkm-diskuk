import { PASSWORD_MIN } from "../lib/constants.js";
import { consumeCaptcha } from "../lib/utils/captcha.js";
import { captchaEnforced, isCaptchaExemptOrigin } from "../lib/utils/env.js";
import { AuthError } from "../lib/utils/errors.js";
import { resolveLoginEmail } from "../lib/utils/identity.js";

/**
 * Guards the native password routes:
 * - POST /auth/password/request (`routes.before` middleware): requires a single-use ALTCHA
 *   payload (except from AUTH_CAPTCHA_EXEMPT_ORIGINS), accepts a NIB in `email`, and pins `reset_url` to AUTH_PASSWORD_RESET_URL.
 *   Directus itself already answers the same way for known and unknown accounts.
 * - PATCH /users/me (`users.update` filter): a user changing their own password must send
 *   `current_password`, which is verified and then stripped before Directus checks field access.
 *   Admins editing in the Data Studio without `current_password` are left as-is.
 */
export default ({ init, filter }, { services, database, env, getSchema }) => {
  init("routes.before", ({ app }) => {
    app.post("/auth/password/request", async (req, _res, next) => {
      try {
        const body = req.body || {};
        // Same-site clients without a captcha widget (Data Studio) are exempt; see captchaExemptOrigins().
        if (captchaEnforced(env) && !isCaptchaExemptOrigin(env, req.get?.("origin") ?? req.headers?.origin)) {
          const result = await consumeCaptcha(database, env, body.captcha);
          if (!result.ok) throw new AuthError(400, "CAPTCHA_INVALID", "Captcha verification failed. Please try again.");
        }
        delete body.captcha;
        body.email = await resolveLoginEmail(database, body.email);
        if (env.AUTH_PASSWORD_RESET_URL) body.reset_url = env.AUTH_PASSWORD_RESET_URL;
        req.body = body;
        next();
      } catch (error) {
        next(error);
      }
    });
  });

  filter("users.update", async (payload, meta, context) => {
    if (!payload || typeof payload !== "object") return payload;
    const { current_password: currentPassword, ...rest } = payload;
    const accountability = context?.accountability;
    const changesOwnPassword =
      payload.password !== undefined &&
      Boolean(accountability?.user) &&
      meta?.keys?.length === 1 &&
      meta.keys[0] === accountability.user;
    if (!changesOwnPassword) return currentPassword === undefined ? payload : rest;

    if (currentPassword === undefined) {
      if (accountability.admin) return rest;
      throw new AuthError(400, "CURRENT_PASSWORD_REQUIRED", "The current password is required.");
    }
    if (typeof payload.password !== "string" || payload.password.length < PASSWORD_MIN) {
      throw new AuthError(400, "NEW_PASSWORD_TOO_SHORT", `The new password must be at least ${PASSWORD_MIN} characters.`);
    }
    if (payload.password === currentPassword) {
      throw new AuthError(400, "NEW_PASSWORD_UNCHANGED", "The new password must differ from the current password.");
    }
    const auth = new services.AuthenticationService({
      knex: context?.database || database,
      schema: context?.schema || (await getSchema()),
      accountability: null,
    });
    try {
      await auth.verifyPassword(accountability.user, String(currentPassword));
    } catch {
      throw new AuthError(400, "CURRENT_PASSWORD_INVALID", "The current password is incorrect.");
    }
    return rest;
  });
};
