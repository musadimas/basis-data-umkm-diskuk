// Shared operator identities for both mocks: the browser mock (mock-directus.mjs, page.route)
// and the SSR mock server (mock-directus-server.mjs). One source keeps SSR and client renders
// of the same role identical (badge, instansi, kota_scope, usaha).

/** The single Directus application role every operational account uses (ADR-008). */
export const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";

/** Profil operator per role dari kontrak `GET /panel/operasional/me` (Y01). */
export const OPERATOR_FIXTURES = {
  provinsi: {
    id: "user-1",
    email: "analyst@example.invalid",
    firstName: "Analis",
    lastName: "Provinsi",
    avatar: null,
    role: "provinsi",
    roleLabel: "Admin Provinsi",
    instansi: "DISKUK Provinsi Jawa Barat",
    kota: null,
    usaha: null,
  },
  kabkota: {
    id: "user-2",
    email: "dummy_admin.subang@jabarprov.go.id",
    firstName: "Analis",
    lastName: "Daerah",
    avatar: null,
    role: "kabkota",
    roleLabel: "Admin Kab/Kota",
    instansi: "Dinas KUK Kabupaten Bogor",
    kota: { id: 1, nama: "Kabupaten Bogor" },
    usaha: null,
  },
  pendamping: {
    id: "user-3",
    email: "dummy_coach.pendamping@jabarprov.go.id",
    firstName: "Pendamping",
    lastName: null,
    avatar: null,
    role: "pendamping",
    roleLabel: "Pendamping",
    instansi: "Program Pendampingan UMKM",
    kota: null,
    usaha: null,
  },
  umkm: {
    id: "user-4",
    email: "dummy_wawan.leathercraft@gmail.com",
    firstName: "Wawan",
    lastName: null,
    avatar: null,
    role: "umkm",
    roleLabel: "Pelaku UMKM",
    instansi: "Pelaku UMKM",
    kota: null,
    usaha: {
      id: "11111111-1111-4111-8111-000000000001",
      nama: "Wawan Leathercraft",
      nib: "9900000000001",
    },
  },
};

/**
 * Bentuk Directus /users/me untuk role mock aktif (Y01 pasca-merge):
 * satu UUID role aplikasi, app_role sebagai kunci peran, kota_scope angka,
 * usaha UUID. Dipetakan dari OPERATOR_FIXTURES agar badge/instansi per role
 * terbaca konsisten dengan sesi server.
 */
export function mockUserMe(activeRole) {
  const fixture = OPERATOR_FIXTURES[activeRole] ?? OPERATOR_FIXTURES.provinsi;
  return {
    id: fixture.id,
    email: fixture.email,
    first_name: fixture.firstName,
    last_name: fixture.lastName,
    role: APPLICATION_ROLE_ID,
    app_role: activeRole,
    instansi: fixture.instansi,
    avatar: fixture.avatar,
    kota_scope: fixture.kota?.id ?? null,
    usaha: fixture.usaha?.id ?? null,
  };
}

/** Role aktif dari header cookie `mock_role`; `fallbackRole` bila tidak ada atau tidak dikenal. */
export function roleFromCookieHeader(cookieHeader, fallbackRole) {
  for (const cookie of String(cookieHeader || "").split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === "mock_role") {
      const value = rest.join("=");
      if (value && value in OPERATOR_FIXTURES) return value;
    }
  }
  return fallbackRole;
}
