"use strict";

const crypto = require("node:crypto");

const { ALL_ROLES, ROLE_LABELS } = require("../../shared/auth.cjs");
const { resolveOperator } = require("../../shared/operator.cjs");
const { OperasionalError, validationFailed } = require("./errors.js");

const NIB_PATTERN = /^\d{13}$/;
const INTERNAL_SECRET_HEADER = "x-operasional-internal-secret";
const AKTIVITAS_LIMIT = 50;

function roleLabelOf(role) {
  return ROLE_LABELS[role] ?? role;
}

function instansiOf(role, { kotaNama = null, usahaNama = null } = {}) {
  switch (role) {
    case "provinsi":
      return "DISKUK Provinsi Jawa Barat";
    case "kabkota":
      return kotaNama ? `Dinas KUK ${kotaNama}` : "Dinas KUK Kabupaten/Kota";
    case "pendamping":
      return "Pendamping Program Akselerasi";
    case "umkm":
      return usahaNama ?? "Pelaku UMKM";
    default:
      return "Pengguna";
  }
}

async function getMe(database, accountability) {
  // /me tidak menuntut penugasan: kabkota/umkm tanpa mapping tetap boleh
  // melihat identitas dasarnya (kota/usaha null) agar UI bisa mengarahkan.
  const operator = await resolveOperator(database, accountability, {
    requireAssignment: false,
    roles: ALL_ROLES,
  });
  const instansi = instansiOf(operator.role, {
    kotaNama: operator.kotaNama,
    usahaNama: operator.usahaNama,
  });
  return {
    id: operator.userId,
    email: operator.email,
    firstName: operator.firstName,
    lastName: operator.lastName,
    avatar: operator.avatar,
    role: operator.role,
    roleLabel: roleLabelOf(operator.role),
    instansi,
    kota:
      operator.kotaId != null
        ? { id: operator.kotaId, nama: operator.kotaNama }
        : null,
    usaha:
      operator.usahaId != null
        ? { id: operator.usahaId, nama: operator.usahaNama, nib: operator.usahaNib }
        : null,
  };
}

function assertInternalSecret(headers) {
  const secret = process.env.OPERASIONAL_INTERNAL_SECRET;
  if (!secret || secret.length < 16) {
    throw new OperasionalError(
      503,
      "INTERNAL_SECRET_UNAVAILABLE",
      "Layanan internal belum dikonfigurasi.",
    );
  }
  const provided = String(headers?.[INTERNAL_SECRET_HEADER] ?? "");
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new OperasionalError(403, "FORBIDDEN", "Akses ditolak.");
  }
}

async function resolveNib(database, headers, body) {
  assertInternalSecret(headers);
  const nib = body?.nib;
  if (typeof nib !== "string" || !NIB_PATTERN.test(nib)) {
    throw validationFailed(
      { nib: "NIB harus berupa 13 digit angka." },
      "Payload tidak valid.",
    );
  }
  const result = await database.raw(
    `SELECT u.email FROM directus_users u
     JOIN usaha us ON us.id = u.usaha
     WHERE us.nib = ? AND u.app_role = ? AND u.status = 'active'
     LIMIT 1`,
    [nib, "umkm"],
  );
  const rows = result?.rows ?? result ?? [];
  if (!rows.length) {
    throw new OperasionalError(404, "NOT_FOUND", "Data tidak ditemukan.");
  }
  return { email: rows[0].email };
}

async function listAktivitas(database, accountability) {
  if (!accountability?.user) {
    throw new OperasionalError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const result = await database.raw(
    `SELECT id, action, collection, item, "timestamp", ip, user_agent
     FROM directus_activity
     WHERE "user" = ?
     ORDER BY "timestamp" DESC
     LIMIT ?`,
    [accountability.user, AKTIVITAS_LIMIT],
  );
  const rows = result?.rows ?? result ?? [];
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    collection: row.collection,
    item: row.item,
    timestamp: new Date(row.timestamp).toISOString(),
    ip: row.ip ?? null,
    userAgent: row.user_agent ?? null,
  }));
}

module.exports = {
  NIB_PATTERN,
  INTERNAL_SECRET_HEADER,
  getMe,
  resolveNib,
  listAktivitas,
  assertInternalSecret,
  instansiOf,
  roleLabelOf,
};
