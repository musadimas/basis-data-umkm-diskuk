const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../dist/index.js");

test("returns the stored infographic snapshot", async () => {
  let handler;
  const snapshot = {
    scales: { total: 10, mikro: 4, kecil: 3, menengah: 2 },
    regions: [{ id: "32", name: "Kota Bandung", value: 10 }],
    topKbli: [],
    kbli: [],
    workforce: { male: 7, female: 5, total: 12, malePercentage: 58.3, femalePercentage: 41.7 },
  };

  extension.handler({ get: (_path, value) => (handler = value) }, {
    database: { raw: async () => ({ rows: [{ payload: snapshot }] }) },
    logger: { error: () => assert.fail("unexpected query error") },
  });

  let payload;
  await handler({}, { json: (value) => (payload = value) }, assert.fail);
  assert.deepEqual(payload, { data: snapshot });
});
