// Dashboard access guard: signed-in Application User role, or a Directus admin.
// The authentication bundle keeps an identical copy (src/lib/utils/auth.js); change both together.

export const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
export const ANALYTICS_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

export class DashboardAuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "DashboardAuthError";
    this.statusCode = statusCode;
    this.code = code;
    this.extensions = { code, status: statusCode };
  }
}

export function requireDashboardAccountability(req, { adminOnly = false } = {}) {
  const accountability = req?.accountability;
  if (!accountability?.user) {
    throw new DashboardAuthError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (adminOnly && !accountability.admin) {
    throw new DashboardAuthError(403, "FORBIDDEN", "Administrator access required");
  }
  if (!accountability.admin && accountability.role !== APPLICATION_ROLE_ID) {
    throw new DashboardAuthError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }
  return accountability;
}

export function requireApplicationUser(req) {
  return requireDashboardAccountability(req);
}

/** Express-style guard: passes the auth error to next() and returns false when access is denied. */
export function routeGuard(req, next, options) {
  try {
    requireDashboardAccountability(req, options);
    return true;
  } catch (error) {
    next(error);
    return false;
  }
}

/** Log-safe error summary (code + status only, never messages or stacks). */
export function sanitizeError(error) {
  if (!error || typeof error !== "object") return { code: "INTERNAL_SERVER_ERROR" };
  return { code: error.code || "INTERNAL_SERVER_ERROR", status: error.statusCode || 500 };
}
