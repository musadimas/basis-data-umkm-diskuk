"use strict";

const { ALL_ROLES, ROLE_LABELS } = require("../../shared/auth.cjs");
const { resolveOperator } = require("../../shared/operator.cjs");

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

module.exports = {
  getMe,
  instansiOf,
  roleLabelOf,
};
