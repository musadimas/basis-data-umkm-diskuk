// Operator dashboard: identitas role dari kolom `directus_users.app_role` (bukan UUID role
// Directus) dan wilayah dari kolom `kota`. Guard masuk tetap di lib/utils/auth.js; berkas ini
// hanya menambahkan scoping wilayah di atasnya.

export const DATA_ROLES = ["provinsi", "kabkota"];

/**
 * Bentuknya mengikuti createError() dari @directus/errors: Directus hanya merender status
 * dari error ber-name "DirectusError". Tipe lain diratakan menjadi 500, sehingga 401/403
 * milik guard wilayah akan hilang saat dilewatkan ke next(error).
 */
export class OperatorError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.extensions = { code, status };
  }
}

// Sinkron dengan CHECK constraint directus_users.app_role (migrasi 20260926A).
export const ALL_ROLES = ["provinsi", "kabkota", "pendamping", "umkm"];

const OPERATOR_COLUMNS = `
  u.id, u.app_role, u.email, u.first_name, u.last_name, u.avatar, u.kota, k.nama AS kota_nama,
  u.usaha, us.nama AS usaha_nama, us.nib AS usaha_nib
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Resolusi operator untuk request dashboard. `app_role` dan `kota` dibaca dalam satu query
 * ke directus_users.
 *
 * Gerbang DATA_ROLES ditaruh di sini, bukan di tiap route, karena seluruh route di bundel
 * analytics memang hanya untuk provinsi/kabkota (lihat ROLE_ROUTES di web): pendamping dan
 * umkm memakai endpoint operasional, bukan analytics. Dengan begitu tidak ada route yang
 * bisa lupa memasang gerbangnya. app_role yang kosong atau asing juga ditolak di sini,
 * supaya tidak pernah diperlakukan sebagai peran dengan akses penuh.
 */
export async function resolveOperator(database, accountability, { requireAssignment = true } = {}) {
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
     LEFT JOIN kota k ON k.id = u.kota
     LEFT JOIN usaha us ON us.id = u.usaha
     WHERE u.id = ?`,
    [accountability.user],
  );
  const operator = mapOperatorRow((result?.rows ?? result)?.[0]);
  if (!operator) {
    throw new OperatorError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  if (!DATA_ROLES.includes(operator.role)) {
    throw new OperatorError(403, "FORBIDDEN", "Dashboard access is not permitted");
  }

  if (requireAssignment) {
    if (operator.role === "kabkota" && operator.kotaId == null) {
      throw new OperatorError(403, "KOTA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
    // Saat ini tidak tercapai karena umkm bukan peran data; tetap ada supaya aturan
    // penugasan ini bertahan bila DATA_ROLES diperluas.
    if (operator.role === "umkm" && operator.usahaId == null) {
      throw new OperatorError(403, "USAHA_NOT_ASSIGNED", "Dashboard access is not permitted");
    }
  }

  return { ...operator, admin };
}

// kabkota: filter `kota` dari klien dibuang dan diganti kota operator, sehingga hasil
// tabular/infografis selalu terkunci pada wilayahnya sendiri. Role lain diteruskan apa adanya.
export function scopeTabularQuery(query, operator) {
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
export function scopeTabularOptions(options, operator) {
  if (operator?.role !== "kabkota" || operator.kotaId == null) {
    return options ?? {};
  }
  return {
    ...options,
    kota: (options?.kota ?? []).filter((kota) => Number(kota?.id) === Number(operator.kotaId)),
    kecamatan: (options?.kecamatan ?? []).filter(
      (kecamatan) => Number(kecamatan?.kotaId) === Number(operator.kotaId),
    ),
  };
}

export { mapOperatorRow };
