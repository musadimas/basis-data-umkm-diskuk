const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../dist/index.js");
const { APPLICATION_ROLE_ID } = require("../../shared/auth.cjs");

function capture() {
  const handlers = {};
  extension.handler({ get: (path, value) => { handlers[path] = value; } }, {
    database: { raw: async (sql) => ({ rows: sql.includes("SELECT payload") ? [{ payload: { scales: { total: 10 } } }] : [] }) },
    logger: { error: () => assert.fail("unexpected query error") },
  });
  return handlers["/"];
}

test("infografis rejects anonymous before database access", async () => {
  let calls = 0;
  let handler;
  extension.handler({ get: (_path, value) => { handler = value; } }, { database: { raw: async () => { calls += 1; } }, logger: { error() {} } });
  let nextError;
  await handler({ accountability: null }, {}, (error) => { nextError = error; });
  assert.equal(nextError.statusCode, 401);
  assert.equal(calls, 0);
});

test("infografis allows Application User and preserves snapshot metrics", async () => {
  const handler = capture();
  let body;
  await handler({ accountability: { user: "u1", role: APPLICATION_ROLE_ID } }, { setHeader() {}, json(value) { body = value; } }, assert.fail);
  assert.deepEqual(body.data.scales, { total: 10 });
  assert.equal(body.data.geometryReady, false);
});

test("infografis rejects wrong role before database access", async () => {
  let calls = 0;
  let handler;
  extension.handler({ get: (_path, value) => { handler = value; } }, { database: { raw: async () => { calls += 1; } }, logger: { error() {} } });
  let nextError;
  await handler({ accountability: { user: "u1", role: "other" } }, {}, (error) => { nextError = error; });
  assert.equal(nextError.statusCode, 403);
  assert.equal(calls, 0);
});

test("authoritative city geometry is exposed when valid regions are present", async () => {
  const boundaries = Array.from({ length: 27 }, (_, index) => ({
    id: String(index + 1),
    name: `Wilayah ${index + 1}`,
    code: `32.${String(index + 1).padStart(2, "0")}`,
    geometry: { type: "MultiPolygon", coordinates: [] },
  }));
  const payload = { regions: boundaries.map((item, index) => ({ id: item.id, name: item.name, value: index + 1 })) };
  const result = await extension.attachAuthoritativeGeometry({ raw: async () => ({ rows: boundaries }) }, payload);
  assert.equal(result.geometryReady, true);
  assert.equal(result.regionLevel, "kota");
  assert.equal(result.geometrySource.name, "Badan Informasi Geospasial (BIG)");
  assert.equal(result.regions.filter((item) => item.geometry).length, 27);
});

test("geometry drills from kota to kecamatan and binds the selected parent", async () => {
  const calls = [];
  const result = await extension.attachAuthoritativeGeometry({ raw: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "11", name: "Cibinong", code: "32.01.01", geometry: { type: "MultiPolygon", coordinates: [] } }] };
  } }, { regions: [{ id: "11", name: "Cibinong", value: 5 }] }, { kota: "7" });

  assert.equal(result.regionLevel, "kecamatan");
  assert.equal(result.regions[0].value, 5);
  assert.match(calls[0].sql, /FROM kecamatan/);
  assert.deepEqual(calls[0].params, [7]);
});

test("infografis aggregates a filtered snapshot with bound parameters", async () => {
  const calls = [];
  const handlers = {};
  extension.handler({ get: (path, value) => { handlers[path] = value; } }, {
    database: { raw: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("WITH filtered AS MATERIALIZED")) {
        return { rows: [{ payload: { scales: { total: 1 }, regions: [] } }] };
      }
      return { rows: [] };
    } },
    logger: { error: () => assert.fail("unexpected query error") },
  });

  let body;
  await handlers["/"](
    {
      accountability: { user: "u1", role: APPLICATION_ROLE_ID },
      query: { kota: "38", kecamatan: "5", kelurahan: "12", skala: "micro", kegiatan: "PERDAGANGAN", kbli: "47112" },
    },
    { setHeader() {}, json(value) { body = value; } },
    assert.fail,
  );

  assert.equal(body.data.scales.total, 1);
  assert.match(calls[0].sql, /t\.kota_id = \?.*t\.kode_kbli = \?/s);
  assert.match(calls[0].sql, /GROUP BY kelurahan_id, kelurahan_nama/);
  assert.deepEqual(calls[0].params.slice(0, 6), [38, 5, 12, "micro", "PERDAGANGAN", "47112"]);
  assert.equal(JSON.parse(calls[0].params[6]).length, 21);
});

test("map drill groups indexed ids without materializing full rows", async () => {
  const calls = [];
  const payload = await extension.readMapPayload({ raw: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "11", name: "Cibinong", value: 5 }] };
  } }, { kota: "7" });

  assert.deepEqual(payload.regions, [{ id: "11", name: "Cibinong", value: 5 }]);
  assert.match(calls[0].sql, /SELECT t\.kecamatan_id AS id, COUNT\(\*\)/);
  assert.doesNotMatch(calls[0].sql, /SELECT t\.\*/);
  assert.deepEqual(calls[0].params, [7]);
});

// ---- Y01 multi-role scoping (kabkota / pendamping) ----

const KABKOTA_ROLE = "ade3c009-8725-46ba-a7a0-904eeba89d01";
const PENDAMPING_ROLE = "d824230f-46db-407d-b8ea-fb2ed58c6c4f";
const KABKOTA_USER = "22222222-2222-4222-8222-222222222222";

function captureRoute(database) {
  const handlers = {};
  extension.handler(
    { get: (path, value) => { handlers[path] = value; } },
    { database, logger: { error() {} } },
  );
  return handlers;
}

const kabkotaOperatorRow = (kota = 7) => ({
  id: KABKOTA_USER,
  kota,
  kota_nama: kota == null ? null : "KABUPATEN SUBANG",
  usaha: null,
  usaha_nama: null,
  usaha_nib: null,
});

test("kabkota infographic is forced to the operator kota and skips the snapshot fast path", async () => {
  const calls = [];
  const handlers = captureRoute({
    raw: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM directus_users u"))
        return { rows: [kabkotaOperatorRow()] };
      if (sql.includes("WITH filtered AS MATERIALIZED"))
        return { rows: [{ payload: { scales: { total: 3 }, regions: [] } }] };
      return { rows: [] };
    },
  });

  let body;
  await handlers["/"](
    {
      accountability: { user: KABKOTA_USER, role: KABKOTA_ROLE },
      query: { kota: "99" },
    },
    { setHeader() {}, json(value) { body = value; } },
    assert.fail,
  );

  assert.equal(body.data.scales.total, 3);
  assert.equal(
    calls.some((c) =>
      c.sql.includes("SELECT payload FROM infografis_snapshot WHERE id = 1"),
    ),
    false,
    "the forced kota filter must bypass the unfiltered snapshot fast path",
  );
  const filtered = calls.find((c) =>
    c.sql.includes("WITH filtered AS MATERIALIZED"),
  );
  assert.ok(filtered, "filtered aggregate SQL must run when filters are forced");
  assert.equal(filtered.params[0], 7);
  assert.ok(
    filtered.params.every((param) => param !== 99 && param !== "99"),
    "the client-provided kota=99 must never reach SQL bindings",
  );
});

test("kabkota without an assigned kota is rejected with KOTA_NOT_ASSIGNED", async () => {
  let calls = 0;
  const handlers = captureRoute({
    raw: async () => {
      calls += 1;
      if (calls === 1) return { rows: [kabkotaOperatorRow(null)] };
      return { rows: [] };
    },
  });

  let nextError;
  await handlers["/"](
    { accountability: { user: KABKOTA_USER, role: KABKOTA_ROLE }, query: {} },
    {},
    (error) => { nextError = error; },
  );

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.extensions.code, "KOTA_NOT_ASSIGNED");
  assert.equal(calls, 1, "only the operator lookup may run");
});

test("infografis rejects pendamping before database access", async () => {
  let calls = 0;
  const handlers = captureRoute({
    raw: async () => {
      calls += 1;
    },
  });

  let nextError;
  await handlers["/"](
    { accountability: { user: "u1", role: PENDAMPING_ROLE }, query: {} },
    {},
    (error) => { nextError = error; },
  );

  assert.equal(nextError.statusCode, 403);
  assert.equal(calls, 0);
});
