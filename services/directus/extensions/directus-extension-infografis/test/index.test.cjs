const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../dist/index.js");
const { APPLICATION_ROLE_ID } = require("../../shared/auth.cjs");

function capture() {
  let handler;
  extension.handler({ get: (_path, value) => { handler = value; } }, {
    database: { raw: async () => ({ rows: [{ payload: { scales: { total: 10 } } }] }) },
    logger: { error: () => assert.fail("unexpected query error") },
  });
  return handler;
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

test("authoritative geometry is exposed only when all 27 valid regions are present", async () => {
  const boundaries = Array.from({ length: 27 }, (_, index) => ({
    id: String(index + 1),
    name: `Wilayah ${index + 1}`,
    code: `32.${String(index + 1).padStart(2, "0")}`,
    geometry: { type: "MultiPolygon", coordinates: [] },
  }));
  const payload = { regions: boundaries.map((item, index) => ({ id: item.id, name: item.name, value: index + 1 })) };
  const result = await extension.attachAuthoritativeGeometry({ raw: async () => ({ rows: boundaries }) }, payload);
  assert.equal(result.geometryReady, true);
  assert.equal(result.geometrySource.name, "Badan Informasi Geospasial (BIG)");
  assert.equal(result.regions.filter((item) => item.geometry).length, 27);
});
