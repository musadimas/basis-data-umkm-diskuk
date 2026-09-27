"use strict";

// Resolver operator dashboard operasional: identitas peran dari kolom `directus_users.app_role`
// (bukan UUID role Directus, karena semua pengguna operasional memakai satu role aplikasi) dan
// wilayah dari kolom `kota_scope`. Batas peran per route ditegakkan di sini, bukan di routeGuard.
const { ALL_ROLES } = require("./auth.cjs");

const DATA_ROLES = ["provinsi", "kabkota"];

const OPERATOR_COLUMNS = `
  u.id, u.app_role, u.email, u.first_name, u.last_name, u.avatar, u.kota_scope AS kota, k.nama AS kota_nama,
  u.usaha, us.nama AS usaha_nama, us.nib AS usaha_nib
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bentuknya mengikuti createError() dari @directus/errors: Directus hanya merender status dari
// error ber-name "DirectusError"; tipe lain diratakan menjadi 500 sehingga 401/403 gerbang
// wilayah hilang saat error dilewatkan ke next(error).
class OperatorError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.extensions = { code, status };
  }
}

function mapOperatorRow(row) {
  if (!row) return null;
  return {
    userId: row.id,
    role: row.app_role ?? null,
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

/**
 * `app_role` dan penugasan (`kota`/`usaha`) dibaca dalam satu query ke directus_users.
 * `roles` adalah peran yang boleh memakai route pemanggil (default DATA_ROLES).
 */
async function resolveOperator(database, accountability, { requireAssignment = true, roles = DATA_ROLES } = {}) {
  if (!accountability?.user) {
    throw new OperatorError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const admin = accountability.admin === true;
  // Admin Directus tidak terikat wilayah, jadi tidak perlu baris operator di database.
  if (admin) {
    return {
      userId: accountability.user,
      role: "provinsi",
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
    throw new OperatorError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }

  const result = await database.raw(
    `SELECT ${OPERATOR_COLUMNS}
     FROM directus_users u
     LEFT JOIN kota k ON k.id = u.kota_scope
     LEFT JOIN usaha us ON us.id = u.usaha
     WHERE u.id = ?`,
    [accountability.user],
  );
  const operator = mapOperatorRow((result?.rows ?? result)?.[0]);
  if (!operator) {
    throw new OperatorError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  // app_role kosong/asing dan peran di luar daftar route ditolak sebelum aturan penugasan:
  // nilai yang tidak dikenal tidak boleh pernah dianggap sebagai peran dengan akses penuh.
  if (!ALL_ROLES.includes(operator.role) || !roles.includes(operator.role)) {
    throw new OperatorError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }

  if (requireAssignment) {
    if (operator.role === "kabkota" && operator.kotaId == null) {
      throw new OperatorError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
    if (operator.role === "umkm" && operator.usahaId == null) {
      throw new OperatorError(403, "USAHA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
  }

  return { ...operator, admin };
}

// kabkota: filter `kota` dari klien dibuang dan diganti kota operator, sehingga hasil
// tabular/infografis selalu terkunci pada wilayahnya sendiri. Role lain diteruskan apa adanya.
function scopeTabularQuery(query, operator) {
  if (operator?.role === "kabkota") {
    if (operator.kotaId == null) {
      throw new OperatorError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
    return { ...query, kota: String(operator.kotaId) };
  }
  return { ...query };
}

// kabkota: opsi filter kota/kecamatan dipersempit ke kota operator supaya UI tidak
// menawarkan pilihan di luar wilayahnya.
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
  OperatorError,
  resolveOperator,
  scopeTabularQuery,
  scopeTabularOptions,
};
