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
