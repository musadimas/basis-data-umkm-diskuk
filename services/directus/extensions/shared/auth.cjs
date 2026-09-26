"use strict";

const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const ANALYTICS_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";

// Legacy Directus role UUIDs. Role identity now lives in directus_users.app_role, so every
// operational user carries APPLICATION_ROLE_ID and roleKeyOf() degenerates to "provinsi";
// this map only survives so routeGuard keeps rejecting unknown role UUIDs (see operator.cjs).
const ROLE_IDS = {
  provinsi: APPLICATION_ROLE_ID,
  kabkota: "ade3c009-8725-46ba-a7a0-904eeba89d01",
  pendamping: "d824230f-46db-407d-b8ea-fb2ed58c6c4f",
  umkm: "d821d35e-62e1-4f27-a323-843845d6c965",
};

const ALL_ROLES = ["provinsi", "kabkota", "pendamping", "umkm"];

const ROLE_LABELS = {
  provinsi: "Admin Provinsi",
  kabkota: "Admin Kab/Kota",
  pendamping: "Pendamping",
  umkm: "Pelaku UMKM",
};

function roleKeyOf(accountability) {
  if (!accountability) return null;
  if (accountability.admin) return "provinsi";
  for (const [key, roleId] of Object.entries(ROLE_IDS)) {
    if (accountability.role === roleId) return key;
  }
  return null;
}

class DashboardAuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "DashboardAuthError";
    this.statusCode = statusCode;
    this.code = code;
    this.extensions = { code, status: statusCode };
  }
}

function requireDashboardAccountability(req, { adminOnly = false, roles = ["provinsi"] } = {}) {
  const accountability = req?.accountability;
  if (!accountability?.user) {
    throw new DashboardAuthError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (adminOnly && !accountability.admin) {
    throw new DashboardAuthError(403, "FORBIDDEN", "Administrator access required");
  }
  const role = roleKeyOf(accountability);
  if (!role || !roles.includes(role)) {
    throw new DashboardAuthError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }
  return accountability;
}

function requireRole(req, roles) {
  return requireDashboardAccountability(req, { roles });
}

function requireApplicationUser(req) {
  return requireDashboardAccountability(req);
}

function routeGuard(req, next, options) {
  try {
    requireDashboardAccountability(req, options);
    return true;
  } catch (error) {
    next(error);
    return false;
  }
}

function sanitizeError(error) {
  if (!error || typeof error !== "object") return { code: "INTERNAL_SERVER_ERROR" };
  return { code: error.code || "INTERNAL_SERVER_ERROR", status: error.statusCode || 500 };
}

module.exports = {
  APPLICATION_ROLE_ID,
  ANALYTICS_POLICY_ID,
  ROLE_IDS,
  ALL_ROLES,
  ROLE_LABELS,
  roleKeyOf,
  DashboardAuthError,
  requireDashboardAccountability,
  requireRole,
  requireApplicationUser,
  routeGuard,
  sanitizeError,
};
