import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cakupan = require("../analytics-shared/cakupan.cjs");

const {
  APPLICATION_ROLE_ID,
  ALL_ROLES,
  DATA_ROLES,
  CAKUPAN_TANDA,
  CakupanError,
  routeGuard,
  muatPemanggil,
  wajibPeran,
  predikat,
  pastikanUsaha,
  kapabilitas,
  permissionScopeOf,
  terjaga,
  publik,
  tandaCakupan,
} = cakupan;

const UUID_PENGGUNA = "00000000-0000-4000-8000-000000000001";
const UUID_USAHA = "33333333-3333-4333-8333-333333333333";
const akun = (userId) => ({ user: userId, role: APPLICATION_ROLE_ID });

/** Database palsu untuk muatPemanggil: mengembalikan satu baris directus_users. */
const dbBaris = (row) => ({
  async raw(sql, params) {
    assert.match(sql, /FROM directus_users/);
    assert.deepEqual(params, [UUID_PENGGUNA]);
    return { rows: row ? [row] : [] };
  },
});

const baris = (overrides = {}) => ({
  id: UUID_PENGGUNA,
  app_role: "provinsi",
  usaha: null,
  kota_scope: null,
  ...overrides,
});

test("admin dimuat sebagai provinsi tanpa query database", async () => {
  const db = { async raw() { throw new Error("tidak boleh query"); } };
  const pemanggil = await muatPemanggil(db, { user: UUID_PENGGUNA, admin: true });
  assert.equal(pemanggil.admin, true);
  assert.equal(pemanggil.peran, "provinsi");
  assert.equal(pemanggil.id, UUID_PENGGUNA);
});

test("tanpa sesi dan baris hilang ditolak 401", async () => {
  await assert.rejects(muatPemanggil(dbBaris(baris()), {}), (error) => {
    assert.equal(error.name, "DirectusError");
    assert.equal(error.status, 401);
    assert.equal(error.code, "AUTHENTICATION_REQUIRED");
    return true;
  });
  await assert.rejects(muatPemanggil(dbBaris(null), akun(UUID_PENGGUNA)), (error) => {
    assert.equal(error.status, 401);
    return true;
  });
});

test("app_role null atau asing ditolak 403 dan sesi tidak pernah jadi sumber peran", async () => {
  await assert.rejects(muatPemanggil(dbBaris(baris({ app_role: null })), akun(UUID_PENGGUNA)), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, "FORBIDDEN");
    return true;
  });
  await assert.rejects(muatPemanggil(dbBaris(baris({ app_role: "superadmin" })), akun(UUID_PENGGUNA)), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
  // Accountability yang membawa appRole provinsi tidak boleh mengangkat baris umkm.
  const pemanggil = await muatPemanggil(
    dbBaris(baris({ app_role: "umkm", usaha: UUID_USAHA })),
    { user: UUID_PENGGUNA, role: APPLICATION_ROLE_ID, appRole: "provinsi", app_role: "provinsi" },
  );
  assert.equal(pemanggil.peran, "umkm");
  assert.equal(pemanggil.usahaId, UUID_USAHA);
});

test("kabkota membawa kota penugasan; error berbentuk DirectusError", async () => {
  const pemanggil = await muatPemanggil(dbBaris(baris({ app_role: "kabkota", kota_scope: 7 })), akun(UUID_PENGGUNA));
  assert.equal(pemanggil.kotaId, 7);
  assert.ok(pemanggil instanceof CakupanError === false);
  try {
    await muatPemanggil(dbBaris(baris({ app_role: "aneh" })), akun(UUID_PENGGUNA));
    assert.fail("harus menolak");
  } catch (error) {
    assert.equal(error.name, "DirectusError");
    assert.equal(error.statusCode, error.status);
    assert.equal(error.extensions.code, error.code);
  }
});

test("wajibPeran meloloskan peran terdaftar dan menolak yang lain", () => {
  wajibPeran({ admin: false, peran: "kabkota" }, ["provinsi", "kabkota"]);
  wajibPeran({ admin: true, peran: "provinsi" }, ["kabkota"]);
  assert.throws(() => wajibPeran({ admin: false, peran: "umkm" }, ["provinsi", "kabkota"]), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
});

test("predikat: provinsi TRUE, kota null tidak pernah cocok", () => {
  const provinsi = { admin: false, peran: "provinsi", kotaId: null, usahaId: null, id: UUID_PENGGUNA };
  for (const jenis of ["peserta", "tiket", "usaha", "readModel"]) {
    assert.deepEqual(predikat(provinsi, jenis, "x"), { sql: "TRUE", bindings: [] });
  }
  assert.deepEqual(predikat({ admin: false, peran: "umkm", kotaId: null, usahaId: null, id: "u" }, "readModel", "a"), {
    sql: "FALSE",
    bindings: [],
  });
  assert.deepEqual(predikat({ admin: false, peran: "pendamping", kotaId: null, usahaId: null, id: "u" }, "usaha", "u"), {
    sql: "FALSE",
    bindings: [],
  });
  assert.deepEqual(predikat(provinsi, "jenis_asing", "x"), { sql: "FALSE", bindings: [] });
});

test("predikat kabkota memakai usaha_tabular dan menolak tanpa penugasan", () => {
  const kabkota = { admin: false, peran: "kabkota", kotaId: 7, usahaId: null, id: UUID_PENGGUNA };
  assert.deepEqual(predikat(kabkota, "peserta", "p"), {
    sql: "EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = p.usaha AND ut.kota_id = ?)",
    bindings: [7],
  });
  assert.deepEqual(predikat(kabkota, "tiket", "t"), {
    sql: "EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = t.usaha AND ut.kota_id = ?)",
    bindings: [7],
  });
  assert.deepEqual(predikat(kabkota, "usaha", "u"), {
    sql: "EXISTS (SELECT 1 FROM usaha_tabular ut WHERE ut.id = u.id AND ut.kota_id = ?)",
    bindings: [7],
  });
  assert.deepEqual(predikat(kabkota, "readModel", "a"), { sql: "a.kota_id = ?", bindings: [7] });
  const tanpaKota = { admin: false, peran: "kabkota", kotaId: null, usahaId: null, id: UUID_PENGGUNA };
  for (const jenis of ["peserta", "tiket", "usaha", "readModel"]) {
    assert.throws(() => predikat(tanpaKota, jenis, "t"), (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, "KOTA_NOT_ASSIGNED");
      return true;
    });
  }
});

test("predikat pendamping dan umkm", () => {
  const pendamping = { admin: false, peran: "pendamping", kotaId: null, usahaId: null, id: "pendamping-1" };
  assert.deepEqual(predikat(pendamping, "peserta", "p"), { sql: "p.pendamping = ?", bindings: ["pendamping-1"] });
  assert.deepEqual(predikat(pendamping, "tiket", "t"), {
    sql: "(t.pendamping = ? OR t.pendamping IS NULL)",
    bindings: ["pendamping-1"],
  });
  const umkm = { admin: false, peran: "umkm", kotaId: null, usahaId: UUID_USAHA, id: "umkm-1" };
  assert.deepEqual(predikat(umkm, "peserta", "p"), { sql: "p.usaha = ?", bindings: [UUID_USAHA] });
  assert.deepEqual(predikat(umkm, "usaha", "u"), { sql: "u.id = ?", bindings: [UUID_USAHA] });
  assert.deepEqual(
    predikat({ admin: false, peran: "umkm", kotaId: null, usahaId: null, id: "umkm-1" }, "peserta", "p"),
    { sql: "FALSE", bindings: [] },
  );
});

test("predikat menolak alias suntikan", () => {
  const provinsi = { admin: false, peran: "kabkota", kotaId: 7, usahaId: null, id: UUID_PENGGUNA };
  assert.throws(() => predikat(provinsi, "peserta", "p; DROP TABLE p; --"), /alias/);
});

/** Database palsu untuk pastikanUsaha: memilah query tabular dan query usaha. */
const dbUsaha = ({ tabular = null, usaha = null } = {}) => ({
  async raw(sql) {
    if (/FROM usaha_tabular/.test(sql)) return { rows: tabular ? [tabular] : [] };
    if (/FROM usaha\b/.test(sql)) return { rows: usaha ? [usaha] : [] };
    throw new Error(`query tak dikenal: ${sql}`);
  },
});

test("pastikanUsaha: 404 seragam bila hilang atau di luar cakupan", async () => {
  const provinsi = { admin: false, peran: "provinsi", kotaId: null, usahaId: null, id: UUID_PENGGUNA };
  await assert.rejects(
    pastikanUsaha(dbUsaha({}), provinsi, UUID_USAHA),
    (error) => error.status === 404 && error.code === "NOT_FOUND",
  );
  await assert.rejects(pastikanUsaha(dbUsaha({}), provinsi, "bukan-uuid"), (error) => error.status === 404);
  const ada = await pastikanUsaha(dbUsaha({ tabular: { kota_id: 7 }, usaha: { id: UUID_USAHA } }), provinsi, UUID_USAHA);
  assert.equal(ada.id, UUID_USAHA);

  const kabkota = { admin: false, peran: "kabkota", kotaId: 7, usahaId: null, id: UUID_PENGGUNA };
  await assert.rejects(
    pastikanUsaha(dbUsaha({ tabular: { kota_id: 9 }, usaha: { id: UUID_USAHA } }), kabkota, UUID_USAHA),
    (error) => error.status === 404,
  );
  await assert.rejects(
    pastikanUsaha(dbUsaha({ tabular: { kota_id: null }, usaha: { id: UUID_USAHA } }), kabkota, UUID_USAHA),
    (error) => error.status === 404,
  );
  const milik = await pastikanUsaha(
    dbUsaha({ tabular: { kota_id: 7 }, usaha: { id: UUID_USAHA } }),
    kabkota,
    UUID_USAHA,
  );
  assert.equal(milik.kotaId, 7);
  await assert.rejects(
    pastikanUsaha(dbUsaha({}), { admin: false, peran: "kabkota", kotaId: null, usahaId: null, id: UUID_PENGGUNA }, UUID_USAHA),
    (error) => error.status === 403 && error.code === "KOTA_NOT_ASSIGNED",
  );

  const umkm = { admin: false, peran: "umkm", kotaId: null, usahaId: UUID_USAHA, id: "umkm-1" };
  await assert.rejects(
    pastikanUsaha(dbUsaha({ tabular: { kota_id: 7 }, usaha: { id: UUID_USAHA } }), umkm, "44444444-4444-4433-8333-444444444444"),
    (error) => error.status === 404,
  );
  await assert.rejects(
    pastikanUsaha(dbUsaha({}), { admin: false, peran: "pendamping", kotaId: null, usahaId: null, id: "p1" }, UUID_USAHA),
    (error) => error.status === 404,
  );
});

test("kapabilitas diturunkan dari peran yang sama", () => {
  const cap = (peran) => kapabilitas({ admin: false, peran, kotaId: null, usahaId: null, id: "x" });
  assert.ok(cap("provinsi").includes("analitik.baca"));
  assert.ok(cap("provinsi").includes("talent.ba"));
  assert.ok(cap("provinsi").includes("katalog.kurasi"));
  assert.ok(!cap("kabkota").includes("talent.ba"));
  assert.ok(cap("kabkota").includes("talent.kelola"));
  assert.ok(cap("kabkota").includes("klinik.petugas"));
  assert.ok(!cap("kabkota").includes("katalog.kurasi"));
  assert.deepEqual(cap("umkm"), ["kpi.kirim"]);
  assert.ok(cap("pendamping").includes("kpi.review"));
  assert.deepEqual(cap("asing"), []);
  assert.deepEqual(kapabilitas({ admin: true, peran: "provinsi", kotaId: null, usahaId: null, id: "x" }), cap("provinsi"));
});

test("permissionScopeOf menandai snapshot unduhan (B36)", () => {
  assert.equal(permissionScopeOf({ admin: true, peran: "provinsi" }), "admin");
  assert.equal(permissionScopeOf({ admin: false, peran: "kabkota", kotaId: 7 }), "kabkota:7");
  assert.equal(permissionScopeOf({ admin: false, peran: "provinsi", kotaId: null }), "provinsi");
});

test("routeGuard hanya menerima UUID peran aplikasi atau admin", () => {
  const next = (error) => next.calls.push(error);
  next.calls = [];
  assert.equal(routeGuard({ accountability: akun(UUID_PENGGUNA) }, next), true);
  assert.equal(routeGuard({ accountability: { user: UUID_PENGGUNA, admin: true } }, next), true);
  assert.equal(next.calls.length, 0);
  assert.equal(routeGuard({ accountability: { user: UUID_PENGGUNA, role: "peran-lain" } }, next), false);
  assert.equal(next.calls[0].status, 403);
  assert.equal(routeGuard({}, next), false);
  assert.equal(next.calls[1].status, 401);
});

test("terjaga dan publik menandai handler dengan Symbol", async () => {
  assert.ok(ALL_ROLES.includes("kabkota"));
  assert.deepEqual(DATA_ROLES, ["provinsi", "kabkota"]);
  const resPerekam = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; };
    return res;
  };
  const db = dbBaris(baris({ app_role: "kabkota", kota_scope: 7 }));
  const ctx = { database: db };
  const handler = (c) => async (req, res, pemanggil) => {
    assert.equal(c, ctx);
    res.json({ data: { peran: pemanggil.peran } });
  };
  const dijaga = terjaga({ peran: ["kabkota"] }, handler);
  assert.deepEqual(tandaCakupan(dijaga), { jenis: "terjaga", peran: ["kabkota"] });
  assert.equal(tandaCakupan(() => {}), null);
  const errors = [];
  const res = resPerekam();
  await dijaga(ctx)({ accountability: akun(UUID_PENGGUNA) }, res, (error) => error && errors.push(error));
  assert.equal(errors.length, 0);
  assert.equal(res.body.data.peran, "kabkota");

  const ditolak = terjaga({ peran: ["provinsi"] }, handler);
  const errors2 = [];
  await ditolak(ctx)({ accountability: akun(UUID_PENGGUNA) }, resPerekam(), (error) => error && errors2.push(error));
  assert.equal(errors2[0].status, 403);

  const terbuka = publik(() => async (req, res) => res.json({ data: { ok: true } }));
  assert.deepEqual(tandaCakupan(terbuka), { jenis: "publik", peran: [] });
  const res2 = resPerekam();
  await terbuka(ctx)({}, res2, () => {});
  assert.equal(res2.body.data.ok, true);
  assert.ok(dijaga[CAKUPAN_TANDA]);
});

test("sanitizeError meringkas error tanpa pesan atau stack (log-safe)", () => {
  const { sanitizeError } = cakupan;
  assert.deepEqual(sanitizeError(null), { code: "INTERNAL_SERVER_ERROR" });
  assert.deepEqual(sanitizeError("boom"), { code: "INTERNAL_SERVER_ERROR" });
  assert.deepEqual(sanitizeError({ code: "KOTA_NOT_ASSIGNED", statusCode: 403 }), {
    code: "KOTA_NOT_ASSIGNED",
    status: 403,
  });
  assert.deepEqual(sanitizeError(new Error("rahasia")), { code: "INTERNAL_SERVER_ERROR", status: 500 });
});
