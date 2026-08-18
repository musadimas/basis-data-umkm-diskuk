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

test("infografis allows Application User and preserves response shape", async () => {
  const handler = capture();
  let body;
  await handler({ accountability: { user: "u1", role: APPLICATION_ROLE_ID } }, { setHeader() {}, json(value) { body = value; } }, assert.fail);
  assert.deepEqual(body, { data: { scales: { total: 10 } } });
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
