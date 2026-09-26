import { AUDIT_RETENTION } from "../lib/constants.js";
import { consumeCaptcha, purgeExpiredCaptcha } from "../lib/utils/captcha.js";
import { clip, stall } from "../lib/utils/common.js";
import { captchaEnforced, isCaptchaExemptOrigin, loginStallMs } from "../lib/utils/env.js";
import { invalidCredentials } from "../lib/utils/errors.js";
import { sanitizeError } from "../lib/utils/http.js";
import { resolveLoginEmail } from "../lib/utils/identity.js";

async function recordLogin(database, { status, user, reason, accountability }) {
  await database.raw(
    `INSERT INTO auth_login_audit (user_id, status, reason, ip, user_agent, origin)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user || null,
      status,
      clip(reason, 64),
      clip(accountability?.ip, 64),
      clip(accountability?.userAgent, 1024),
      clip(accountability?.origin, 255),
    ],
  );
}

/**
 * Guards the native POST /auth/login:
 * - `routes.before` middleware: lets users sign in with a NIB in the `email` field by
 *   resolving it to the linked account's email before Directus validates the body.
 * - `auth.login` filter: requires a single-use ALTCHA payload before the password is checked
 *   (except from AUTH_CAPTCHA_EXEMPT_ORIGINS, e.g. the Data Studio);
 *   captcha failures are reported as INVALID_CREDENTIALS so they never reveal whether an
 *   account exists.
 * - `auth.login` action: success/failure audit trail for the session activity log.
 */
export default ({ init, filter, action, schedule }, { database, env, logger }) => {
  init("routes.before", ({ app }) => {
    app.post("/auth/login", async (req, _res, next) => {
      try {
        if (req.body) req.body.email = await resolveLoginEmail(database, req.body.email);
        next();
      } catch (error) {
        next(error);
      }
    });
  });

  filter("auth.login", async (payload, meta, context) => {
    const { captcha, ...rest } = payload || {};
    if (!captchaEnforced(env) || meta?.provider !== "default") return rest;
    // Same-site clients without a captcha widget (Data Studio); see captchaExemptOrigins().
    if (isCaptchaExemptOrigin(env, context?.accountability?.origin)) return rest;
    const db = context?.database || database;
    const result = await consumeCaptcha(db, env, captcha);
    if (result.ok) return rest;
    try {
      await recordLogin(db, {
        status: "fail",
        user: meta?.user,
        reason: result.reason,
        accountability: context?.accountability,
      });
    } catch (error) {
      logger.error(sanitizeError(error), "Unable to record captcha login failure");
    }
    await stall(loginStallMs(env));
    throw invalidCredentials();
  });

  action("auth.login", async (meta, context) => {
    try {
      await recordLogin(context?.database || database, {
        status: meta?.status === "success" ? "success" : "fail",
        user: meta?.user,
        reason: meta?.status === "success" ? null : meta?.error?.code || "LOGIN_FAILED",
        accountability: context?.accountability,
      });
    } catch (error) {
      logger.error(sanitizeError(error), "Unable to record login audit");
    }
  });

  const cleanup = async () => {
    try {
      await purgeExpiredCaptcha(database);
      await database.raw(`DELETE FROM auth_login_audit WHERE created_at < NOW() - INTERVAL '${AUDIT_RETENTION}'`);
      return { status: "completed" };
    } catch (error) {
      logger.error(sanitizeError(error), "Auth login cleanup failed");
      return { status: "failed" };
    }
  };
  schedule("*/10 * * * *", cleanup);

  return { cleanup };
};
