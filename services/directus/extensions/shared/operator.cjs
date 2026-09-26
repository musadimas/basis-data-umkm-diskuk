"use strict";

const { DashboardAuthError, roleKeyOf } = require("./auth.cjs");

const DATA_ROLES = ["provinsi", "kabkota"];

const OPERATOR_COLUMNS = `
  u.id, u.email, u.first_name, u.last_name, u.avatar, u.kota, k.nama AS kota_nama,
  u.usaha, us.nama AS usaha_nama, us.nib AS usaha_nib
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapOperatorRow(row) {
  if (!row) return null;
  return {
    userId: row.id,
    email: row.email ?? null,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    avatar: row.avatar ?? null,
    kotaId: row.kota ?? null,
    kotaNama: row.kota_nama ?? null,
    usahaId: row.usaha ?? null,
    usahaNama: row.usaha_nama ?? null,
    usahaNib: row.usaha_nib ?? null,
  };
}

async function resolveOperator(database, accountability, { requireAssignment = true } = {}) {
  const role = roleKeyOf(accountability);
  if (!accountability?.user || !role) {
    throw new DashboardAuthError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const admin = accountability.admin === true;
  if (role === "provinsi" && requireAssignment) {
    return {
      userId: accountability.user,
      role,
      admin,
      email: null,
      firstName: null,
      lastName: null,
      avatar: null,
      kotaId: null,
      kotaNama: null,
      usahaId: null,
      usahaNama: null,
      usahaNib: null,
    };
  }

  if (!UUID_PATTERN.test(accountability.user)) {
    throw new DashboardAuthError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }

  const result = await database.raw(
    `SELECT ${OPERATOR_COLUMNS}
     FROM directus_users u
     LEFT JOIN kota k ON k.id = u.kota
     LEFT JOIN usaha us ON us.id = u.usaha
     WHERE u.id = ?`,
    [accountability.user],
  );
  const rows = result?.rows ?? result;
  const operator = mapOperatorRow(rows?.[0]);
  if (!operator) {
    throw new DashboardAuthError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }

  if (requireAssignment) {
    if (role === "kabkota" && operator.kotaId == null) {
      throw new DashboardAuthError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
    if (role === "umkm" && operator.usahaId == null) {
      throw new DashboardAuthError(403, "USAHA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
  }

  return { role, admin, ...operator };
}

function scopeTabularQuery(query, operator) {
  if (operator?.role === "kabkota") {
    if (operator.kotaId == null) {
      throw new DashboardAuthError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
    return { ...query, kota: String(operator.kotaId) };
  }
  return { ...query };
}

function scopeTabularOptions(options, operator) {
  if (operator?.role !== "kabkota" || operator.kotaId == null) {
    return options ?? {};
  }
  return {
    ...options,
    kota: (options?.kota ?? []).filter((kota) => Number(kota?.id) === Number(operator.kotaId)),
    kecamatan: (options?.kecamatan ?? []).filter((kecamatan) => Number(kecamatan?.kotaId) === Number(operator.kotaId)),
  };
}

module.exports = {
  DATA_ROLES,
  resolveOperator,
  scopeTabularQuery,
  scopeTabularOptions,
};
