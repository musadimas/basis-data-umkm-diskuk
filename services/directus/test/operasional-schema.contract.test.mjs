import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

// Nama migrasi pasca-merge: A = fondasi login (kolom app_role + policy aplikasi),
// D = peran operasional (kolom kota/usaha + hak baca), E/F/G = atribut Jabar, talenta, program.
const readMigration = (name) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

const migrationA = readMigration("20260926A-create-auth-login.js");
const migrationD = readMigration("20260926D-operational-roles.js");

const auth = require("../extensions/shared/auth.cjs");
const operator = require("../extensions/shared/operator.cjs");
const berkas = require("../extensions/directus-extension-operasional/src/berkas-service.js");

// Nilai yang harus tetap sinkron antara migrasi, auth.cjs, dan operator.cjs.
const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const APPLICATION_POLICY_ID = "9325db4b-9518-41db-b122-8c667f2ce510";
const APP_ROLES = ["provinsi", "kabkota", "pendamping", "umkm"];
// Bidang directus_users yang boleh dibaca aplikasi (USER_READ_FIELDS di migrasi D).
const USER_READ_FIELDS = "id,email,first_name,last_name,avatar,app_role,instansi,kota,usaha";
const READ_FIELDS_BEFORE = "id,email,first_name,last_name,avatar,app_role,instansi";
// Kata sandi: minimal 12 karakter, NIB 13 digit ditolak.
const PASSWORD_POLICY_SOURCE = String.raw`PASSWORD_POLICY = "^(?!\\d{13}$).{12,}$"`;

const OPERATOR_USER = "22222222-2222-4222-8222-222222222222";
const USAHA_ID = "33333333-3333-4333-8333-333333333333";

const OPERATOR_KEYS = [
  "admin",
  "avatar",
  "email",
  "firstName",
  "kotaId",
  "kotaNama",
  "lastName",
  "role",
  "usahaId",
  "usahaNama",
  "usahaNib",
  "userId",
];

const operatorRow = (overrides = {}) => ({
  id: OPERATOR_USER,
  app_role: "kabkota",
  email: "operator@example.test",
  first_name: "Ope",
  last_name: "Rator",
  avatar: null,
  kota: 7,
  kota_nama: "KABUPATEN SUBANG",
  usaha: null,
  usaha_nama: null,
  usaha_nib: null,
  ...overrides,
});

const databaseWith = (rows) => ({ raw: async () => ({ rows }) });

test("migrasi A: himpunan app_role tertutup dan policy aplikasi", () => {
  const appRoleValues = migrationA
    .match(/app_role IN \(([^)]+)\)/)[1]
    .split(",")
    .map((value) => value.trim().replace(/^'(.*)'$/, "$1"));
  assert.deepEqual(
    appRoleValues,
    APP_ROLES,
    "himpunan app_role di CHECK constraint adalah satu-satunya sumber nilai peran",
  );
  assert.ok(migrationA.includes("app_role TEXT NOT NULL DEFAULT 'provinsi'"), "kolom app_role");
  assert.ok(migrationA.includes(APPLICATION_POLICY_ID), "policy aplikasi tunggal");
  assert.ok(migrationA.includes("directus_users_usaha_unique"), "unique index usaha");
  assert.ok(migrationA.includes(READ_FIELDS_BEFORE), "fields baca awal memuat app_role");
});

test("migrasi D: kontrak kolom penugasan, hak baca, dan policy kata sandi", () => {
  assert.ok(migrationD.includes(APPLICATION_POLICY_ID), "policy aplikasi pada migrasi D");
  // `kota` integer FK ke kota(id) — inilah yang dibaca resolver sebagai kotaId/kotaNama.
  assert.ok(
    migrationD.includes("ADD COLUMN IF NOT EXISTS kota INTEGER REFERENCES kota(id) ON DELETE SET NULL"),
    "kota integer FK ke kota(id)",
  );
  assert.ok(
    migrationD.includes("ADD COLUMN IF NOT EXISTS usaha UUID REFERENCES usaha(id) ON DELETE SET NULL"),
    "usaha UUID FK ke usaha(id)",
  );
  assert.ok(migrationD.includes(USER_READ_FIELDS), "fields baca memuat app_role/kota/usaha");
  assert.ok(
    migrationD.includes("AND collection = 'directus_users' AND action = 'read'"),
    "hak baca directus_users diperbarui, bukan dibuat ulang",
  );
  assert.ok(migrationD.includes(PASSWORD_POLICY_SOURCE), "policy kata sandi menolak NIB 13 digit");
  // down() harus kembali ke keadaan migrasi A, bukan keadaan sebelum A.
  assert.ok(migrationD.includes(READ_FIELDS_BEFORE), "rollback D kembali ke fields baca migrasi A");
  // Identitas peran ada di app_role: D tidak boleh lagi membuat role/policy per peran.
  assert.ok(
    !migrationD.includes("directus_roles") && !migrationD.includes("directus_policies"),
    "tanpa role/policy per peran",
  );
});

test("auth.cjs dan operator.cjs sinkron dengan kontrak app_role", () => {
  assert.equal(auth.APPLICATION_ROLE_ID, APPLICATION_ROLE_ID);
  assert.equal(auth.ANALYTICS_POLICY_ID, APPLICATION_POLICY_ID);
  assert.equal(auth.ROLE_IDS.provinsi, APPLICATION_ROLE_ID);
  assert.deepEqual(auth.ALL_ROLES, APP_ROLES);
  assert.deepEqual(operator.DATA_ROLES, ["provinsi", "kabkota"]);
  assert.equal(auth.ROLE_LABELS.provinsi, "Admin Provinsi");
  for (const role of auth.ALL_ROLES) {
    assert.ok(role in auth.ROLE_LABELS, `label untuk peran ${role}`);
  }
  // Semua pengguna operasional memakai satu UUID role Directus, jadi roleKeyOf() selalu
  // "provinsi": batas peran tidak boleh lagi diharapkan dari routeGuard (lihat resolveOperator).
  assert.equal(auth.roleKeyOf({ role: APPLICATION_ROLE_ID }), "provinsi");
  assert.equal(auth.roleKeyOf({ admin: true }), "provinsi");
  assert.equal(auth.roleKeyOf({ role: "bukan-role" }), null);
  assert.equal(auth.roleKeyOf(undefined), null);
});

test("routeGuard: anonim 401, role asing 403, daftar peran route tidak membedakan peran", () => {
  assert.throws(
    () => auth.requireDashboardAccountability({ accountability: null }),
    (error) => error.statusCode === 401 && error.code === "AUTHENTICATION_REQUIRED",
  );
  assert.throws(
    () => auth.requireDashboardAccountability({ accountability: { user: "u", role: "role-asing" } }),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN",
  );
  assert.doesNotThrow(() =>
    auth.requireDashboardAccountability({ accountability: { user: "u", role: APPLICATION_ROLE_ID } }),
  );
  assert.doesNotThrow(() =>
    auth.requireDashboardAccountability({ accountability: { user: "u", admin: true } }),
  );
  // Pemetaan roleKeyOf yang degeneratif ini sebabnya `roles` per route HARUS diteruskan ke
  // resolveOperator: memasang `roles: ["umkm"]` di routeGuard akan menolak semua pengguna.
  assert.throws(
    () =>
      auth.requireDashboardAccountability(
        { accountability: { user: "u", role: APPLICATION_ROLE_ID } },
        { roles: ["umkm"] },
      ),
    (error) => error.statusCode === 403,
  );
});

test("resolveOperator membaca app_role/kota/usaha dalam satu query", async () => {
  const calls = [];
  const op = await operator.resolveOperator(
    {
      raw: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [operatorRow()] };
      },
    },
    { user: OPERATOR_USER },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM directus_users u/);
  assert.match(calls[0].sql, /u\.app_role/);
  assert.match(calls[0].sql, /LEFT JOIN kota k ON k\.id = u\.kota/);
  assert.match(calls[0].sql, /LEFT JOIN usaha us ON us\.id = u\.usaha/);
  assert.deepEqual(calls[0].params, [OPERATOR_USER]);
  // Resolver hanya boleh membaca kolom yang diizinkan policy aplikasi (USER_READ_FIELDS).
  const columns = [...new Set([...calls[0].sql.matchAll(/\bu\.([a-z_]+)\b/g)].map((m) => m[1]))];
  assert.ok(columns.length > 0);
  for (const column of columns) {
    assert.ok(USER_READ_FIELDS.split(",").includes(column), `kolom u.${column} di USER_READ_FIELDS`);
  }

  assert.equal(op.role, "kabkota");
  assert.equal(op.kotaId, 7);
  assert.equal(op.kotaNama, "KABUPATEN SUBANG");
  assert.equal(op.admin, false);
  assert.equal(op.userId, OPERATOR_USER);
  assert.deepEqual(Object.keys(op).sort(), [...OPERATOR_KEYS].sort(), "bentuk operator tetap");
});

test("resolveOperator gagal-tertutup untuk app_role kosong atau asing", async () => {
  for (const app_role of [null, "", "superadmin", undefined]) {
    await assert.rejects(
      () => operator.resolveOperator(databaseWith([operatorRow({ app_role })]), { user: OPERATOR_USER }),
      (error) =>
        error.statusCode === 403 &&
        error.code === "FORBIDDEN" &&
        // Directus hanya merender status dari error ber-name "DirectusError".
        error.name === "DirectusError" &&
        error.status === 403 &&
        error.extensions?.status === 403 &&
        error.extensions?.code === "FORBIDDEN",
      `app_role ${String(app_role)} tidak boleh diperlakukan sebagai peran dengan akses penuh`,
    );
  }
});

test("resolveOperator menegakkan roles milik route pemanggil", async () => {
  // Peran data pada route data.
  const kabkota = await operator.resolveOperator(databaseWith([operatorRow()]), { user: OPERATOR_USER });
  assert.equal(kabkota.role, "kabkota");

  // pendamping ditolak route data meski routeGuard sudah meloloskannya.
  await assert.rejects(
    () =>
      operator.resolveOperator(
        databaseWith([operatorRow({ app_role: "pendamping" })]),
        { user: OPERATOR_USER },
      ),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN",
  );

  // Route self-scoped hanya menerima perannya sendiri.
  await assert.rejects(
    () =>
      operator.resolveOperator(databaseWith([operatorRow()]), { user: OPERATOR_USER }, { roles: ["umkm"] }),
    (error) => error.statusCode === 403 && error.code === "FORBIDDEN",
  );
  const pendamping = await operator.resolveOperator(
    databaseWith([operatorRow({ app_role: "pendamping" })]),
    { user: OPERATOR_USER },
    { roles: ["pendamping"] },
  );
  assert.equal(pendamping.role, "pendamping");
  const umkm = await operator.resolveOperator(
    databaseWith([operatorRow({ app_role: "umkm", kota: null, usaha: USAHA_ID, usaha_nama: "Wawan Leather", usaha_nib: "9900000000001" })]),
    { user: OPERATOR_USER },
    { roles: ["umkm"] },
  );
  assert.equal(umkm.usahaId, USAHA_ID);
  assert.equal(umkm.usahaNama, "Wawan Leather");
  assert.equal(umkm.usahaNib, "9900000000001");
});

test("resolveOperator menjaga aturan penugasan kota/usaha", async () => {
  await assert.rejects(
    () => operator.resolveOperator(databaseWith([operatorRow({ kota: null, kota_nama: null })]), { user: OPERATOR_USER }),
    (error) => error.statusCode === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
  await assert.rejects(
    () =>
      operator.resolveOperator(
        databaseWith([operatorRow({ app_role: "umkm", kota: null, usaha: null })]),
        { user: OPERATOR_USER },
        { roles: ["umkm"] },
      ),
    (error) => error.statusCode === 403 && error.code === "USAHA_NOT_ASSIGNED",
  );
  // /me dan /berkas tidak menuntut penugasan.
  const tanpaPenugasan = await operator.resolveOperator(
    databaseWith([operatorRow({ app_role: "umkm", usaha: null })]),
    { user: OPERATOR_USER },
    { requireAssignment: false, roles: ["umkm"] },
  );
  assert.equal(tanpaPenugasan.usahaId, null);
});

test("resolveOperator meloloskan admin Directus tanpa menyentuh DB", async () => {
  let calls = 0;
  const op = await operator.resolveOperator(
    {
      raw: async () => {
        calls += 1;
        return { rows: [] };
      },
    },
    { user: OPERATOR_USER, admin: true },
  );

  assert.equal(calls, 0);
  assert.equal(op.admin, true);
  assert.equal(op.role, "provinsi");
  assert.equal(op.kotaId, null);
});

test("resolveOperator menolak anonim, id rusak, dan akun tanpa baris operator", async () => {
  await assert.rejects(
    () => operator.resolveOperator(databaseWith([]), { user: null }),
    (error) => error.statusCode === 401 && error.code === "AUTHENTICATION_REQUIRED",
  );
  await assert.rejects(
    () => operator.resolveOperator(databaseWith([]), { user: "not-a-uuid" }),
    (error) => error.statusCode === 401,
    "id rusak tidak boleh sampai ke database",
  );
  await assert.rejects(
    () => operator.resolveOperator(databaseWith([]), { user: OPERATOR_USER }),
    (error) => error.statusCode === 401,
    "akun tanpa baris directus_users bukan pengguna terautentikasi",
  );
});

test("kontrak silang: resolver operasional mencerminkan bundel analytics", async () => {
  const analytics = await import("../extensions/analytics/src/lib/utils/operator.js");
  assert.deepEqual(operator.DATA_ROLES, analytics.DATA_ROLES);
  assert.deepEqual(auth.ALL_ROLES, analytics.ALL_ROLES);
  const mirrored = new operator.OperatorError(403, "FORBIDDEN", "Dashboard access is not permitted");
  const reference = new analytics.OperatorError(403, "FORBIDDEN", "Dashboard access is not permitted");
  assert.equal(mirrored.name, reference.name);
  assert.equal(mirrored.status, reference.status);
  assert.equal(mirrored.statusCode, reference.statusCode);
  assert.equal(mirrored.code, reference.code);
  assert.deepEqual(mirrored.extensions, reference.extensions);
});

test("scopeTabularQuery memaksa kota kabkota dan scopeTabularOptions memfilter", () => {
  const operatorRow = { role: "kabkota", kotaId: 7 };
  assert.deepEqual(operator.scopeTabularQuery({ kota: "99", page: "2" }, operatorRow), { kota: "7", page: "2" });
  assert.deepEqual(operator.scopeTabularQuery({ kota: "99" }, { role: "provinsi", kotaId: null }), { kota: "99" });
  assert.throws(
    () => operator.scopeTabularQuery({ kota: "99" }, { role: "kabkota", kotaId: null }),
    (error) => error.statusCode === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );
  const options = {
    kota: [{ id: 7, nama: "Subang" }, { id: 9, nama: "Bogor" }],
    kecamatan: [{ id: 1, kotaId: 7 }, { id: 2, kotaId: 9 }],
  };
  const scoped = operator.scopeTabularOptions(options, operatorRow);
  assert.deepEqual(scoped.kota, [{ id: 7, nama: "Subang" }]);
  assert.deepEqual(scoped.kecamatan, [{ id: 1, kotaId: 7 }]);
  assert.deepEqual(operator.scopeTabularOptions(options, { role: "provinsi", kotaId: null }), options);
});

test("extension operasional terdaftar sebagai endpoint", () => {
  const pkg = JSON.parse(readFileSync(new URL("../extensions/directus-extension-operasional/package.json", import.meta.url), "utf8"));
  assert.equal(pkg["directus:extension"].type, "endpoint");
});

// ── Y02: atribut Jabar + talenta/BA + kontrak skor (jangan hapus saat Y01 berubah) ──
const migrationE = readMigration("20260926E-create-usaha-atribut-jabar.js");
const migrationF = readMigration("20260926F-create-talenta.js");
const talentIndex = require("../extensions/directus-extension-operasional/src/talent-index.js");

const ATRIBUT_15 = [
  "npwp_usaha",
  "izin_edar",
  "sertifikat_halal",
  "pirt_bpom",
  "hki_merek",
  "sni",
  "rekening_terpisah",
  "sop_tertulis",
  "ecommerce",
  "medsos_bisnis",
  "qris",
  "pembukuan_digital",
  "akses_kur",
  "rantai_pasok_industri",
  "kontrak_offtaker",
];

test("migrasi E: 15 atribut Jabar nullable, cascade, rollback disposable", () => {
  assert.ok(migrationE.includes("CREATE TABLE IF NOT EXISTS usaha_atribut_jabar"));
  for (const col of ATRIBUT_15) {
    assert.ok(migrationE.includes(`${col} BOOLEAN`), `kolom ${col}`);
  }
  assert.ok(migrationE.includes("REFERENCES usaha(id) ON DELETE CASCADE"));
  assert.ok(migrationE.includes("DROP TABLE IF EXISTS usaha_atribut_jabar"));
});

test("migrasi F: talenta + BA + indeks parsial + folder + berkas hanya untuk policy aplikasi", () => {
  assert.ok(migrationF.includes("CREATE TABLE IF NOT EXISTS talenta_berita_acara"));
  assert.ok(migrationF.includes("CREATE TABLE IF NOT EXISTS talenta"));
  assert.ok(migrationF.includes("ux_talenta_usaha_aktif"));
  assert.ok(migrationF.includes("WHERE status <> 'ditolak'"));
  assert.ok(migrationF.includes("idx_talenta_status_kota"));
  assert.ok(migrationF.includes("DROP TABLE IF EXISTS talenta"));

  // Folder berkas operasional harus sama dengan yang dipakai berkas-service saat menulis/membaca.
  const folderMigration = migrationF.match(/const FOLDER_OPERASIONAL = "([0-9a-f-]+)"/)[1];
  assert.equal(berkas.FOLDER_OPERASIONAL, folderMigration, "folder operasional sinkron dengan migrasi F");
  // Peran operasional memakai satu policy aplikasi: berkas tidak lagi dibuka per peran.
  const filePolicies = JSON.parse(migrationF.match(/const FILE_POLICIES = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(filePolicies, [APPLICATION_POLICY_ID]);
});

test("kontrak skor Y02: fixture angka hasil hitung manual", () => {
  const seed01 = talentIndex.hitungTalentIndex({
    omzetTahunan: 600_000_000,
    nibAda: true,
    totalTenagaKerja: 7,
    atribut: {
      npwp_usaha: true,
      sertifikat_halal: true,
      pirt_bpom: true,
      hki_merek: true,
      rekening_terpisah: true,
      sop_tertulis: true,
      ecommerce: true,
      medsos_bisnis: true,
      akses_kur: true,
    },
    form: {
      kapasitasProduksiBulanan: 1200,
      kesiapanHalal: true,
      kesiapanPirtBpom: true,
      kesiapanHki: true,
      adopsiQris: true,
      pencatatanKeuanganDigital: true,
      suratKomitmenAda: true,
    },
  });
  assert.deepEqual(
    [seed01.finansial, seed01.pasar, seed01.legalitas, seed01.sdm, seed01.total],
    [100, 100, 100, 91, 97.75],
  );
  assert.equal(talentIndex.RUBRIK_VERSI, 1);
});

// ── Y03: program akselerasi + laporan Jumat + verifikasi (jangan hapus) ──
const migrationG = readMigration("20260926G-create-program-akselerasi.js");
const programWeek = require("../extensions/directus-extension-operasional/src/program-week.js");
const kpiEvaluasi = require("../extensions/directus-extension-operasional/src/kpi-evaluasi.js");

test("migrasi G: batch + kolom talenta + laporan mingguan + provenance + rollback", () => {
  assert.ok(migrationG.includes("CREATE TABLE IF NOT EXISTS program_batch"));
  assert.ok(migrationG.includes("talent_lab','accelerator"));
  assert.ok(migrationG.includes("ADD COLUMN IF NOT EXISTS batch"));
  assert.ok(migrationG.includes("ADD COLUMN IF NOT EXISTS pendamping"));
  assert.ok(migrationG.includes("target_mingguan_override"));
  assert.ok(migrationG.includes("rekomendasi_pitching"));
  assert.ok(migrationG.includes("CREATE TABLE IF NOT EXISTS talenta_laporan_mingguan"));
  assert.ok(migrationG.includes("client_uuid UUID NOT NULL UNIQUE"));
  assert.ok(migrationG.includes("UNIQUE (talenta, minggu_ke)"));
  assert.ok(migrationG.includes("provenance"));
  assert.ok(migrationG.includes("offline-replay"));
  assert.ok(migrationG.includes("DROP TABLE IF EXISTS talenta_laporan_mingguan"));
  assert.ok(migrationG.includes("DROP TABLE IF EXISTS program_batch"));
});

test("kontrak Y03: vektor minggu + Jumat + capaian + rekomendasi", () => {
  assert.equal(programWeek.mingguKe("2026-09-28", new Date("2026-09-27T16:59:59Z")), 0);
  assert.equal(programWeek.mingguKe("2026-09-28", new Date("2026-09-27T17:00:00Z")), 1);
  assert.equal(programWeek.targetMingguan(780000000, 1.2, null), 18000000);
  assert.equal(programWeek.isJumatJakarta(new Date("2026-10-02T05:00:00Z")), true);
  assert.equal(programWeek.isJumatJakarta(new Date("2026-10-01T05:00:00Z")), false);
  assert.equal(kpiEvaluasi.capaianPersen(21000000, 18000000), 116.7);
  assert.equal(kpiEvaluasi.capaianPersen(5000, 0), null);
  assert.equal(
    kpiEvaluasi.layakRekomendasi(
      [1, 2, 3, 4].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" })),
    ),
    true,
  );
  assert.equal(
    kpiEvaluasi.layakRekomendasi(
      [2, 3, 5, 6].map((m) => ({ mingguKe: m, omzet: 19000000, target: 18000000, status: "disetujui" })),
    ),
    false,
  );
});
