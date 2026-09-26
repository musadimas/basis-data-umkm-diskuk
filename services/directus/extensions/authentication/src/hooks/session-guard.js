import { SESSION_TOUCH_INTERVAL_MS } from "../lib/constants.js";
import { isAllowedRequestOrigin } from "../lib/utils/env.js";
import { sanitizeError } from "../lib/utils/http.js";
import {
  carrySessionStart,
  readSession,
  revokeSession,
  sessionVerdict,
  touchSession,
} from "../lib/utils/session-policy.js";

/** Auth routes that must work with an ended session (sign in again, sign out, reset). */
function isExemptPath(path) {
  return path.startsWith("/auth/") && path !== "/auth/refresh";
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestOrigin(req) {
  return req.get?.("origin") ?? req.headers?.origin;
}

function clearSessionCookie(res, env) {
  res.clearCookie?.(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    domain: env.SESSION_COOKIE_DOMAIN || undefined,
    secure: Boolean(env.SESSION_COOKIE_SECURE),
    sameSite: env.SESSION_COOKIE_SAME_SITE || "strict",
  });
}

/**
 * Session policy on the Directus session itself (ADR-001 #5), enforced server-side:
 * - idle timeout (AUTH_SESSION_IDLE_TIMEOUT, default 30m): no request for that long ends it;
 * - absolute lifetime (AUTH_SESSION_MAX_AGE, default 8h): counted from login and carried
 *   across token refreshes, so refreshing never extends it.
 * Uses directus_sessions.date_created / .date_updated (migration
 * 20260926C-add-session-policy-to-directus-sessions). An ended session is deleted from
 * directus_sessions and answered with 401 TOKEN_EXPIRED.
 *
 * Also CSRF protection (ADR-001 #9): a POST/PUT/PATCH/DELETE authenticated by the session
 * cookie must come from an origin in AUTH_ALLOWED_ORIGINS, otherwise 403 ORIGIN_NOT_ALLOWED.
 */
export default ({ init, filter }, { database, env, logger }) => {
  // Login needs no work (date_created defaults to the insert time); a refresh inherits it.
  filter("auth.jwt", async (payload, meta, context) => {
    if (meta?.type !== "refresh" || !payload?.session) return payload;
    try {
      await carrySessionStart(context?.database || database, payload.session);
    } catch (error) {
      logger.error(sanitizeError(error), "Unable to carry session start across refresh");
    }
    return payload;
  });

  init("routes.before", ({ app }) => {
    app.use(async (req, res, next) => {
      const token = req.accountability?.session;
      if (!token || isExemptPath(req.path)) return next();
      // CSRF: browsers always send Origin on these methods and pages cannot forge it.
      if (MUTATION_METHODS.has(String(req.method).toUpperCase()) && !isAllowedRequestOrigin(env, requestOrigin(req))) {
        res.setHeader?.("Cache-Control", "private, no-store");
        res.status(403).json({
          errors: [{ message: "Request origin not allowed.", extensions: { code: "ORIGIN_NOT_ALLOWED" } }],
        });
        return;
      }
      try {
        const session = await readSession(database, token);
        // Directus already validated the session; a missing row just means nothing to enforce.
        if (!session) return next();
        const verdict = sessionVerdict(session, env);
        if (verdict !== "ok") {
          await revokeSession(database, token);
          clearSessionCookie(res, env);
          res.setHeader?.("Cache-Control", "private, no-store");
          res.status(401).json({
            errors: [{ message: "Your session has ended. Please sign in again.", extensions: { code: "TOKEN_EXPIRED", reason: verdict } }],
          });
          return;
        }
        if (Date.now() - new Date(session.date_updated).getTime() >= SESSION_TOUCH_INTERVAL_MS) {
          await touchSession(database, token);
        }
        next();
      } catch (error) {
        // Fail open on storage errors: Directus still authenticates the request itself.
        logger.error(sanitizeError(error), "Session policy check failed");
        next();
      }
    });
  });
};
