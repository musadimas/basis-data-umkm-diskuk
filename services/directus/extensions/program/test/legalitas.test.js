import assert from "node:assert/strict";
import test from "node:test";
import registerRoutes from "../src/endpoints/legalitas/index.js";
import { APPLICATION_ROLE_ID } from "../src/lib/utils/auth.js";

const USAHA_ID = "5b0c3a52-6c1f-4f8e-9a54-0c6f1f2d7a11";
const APP_USER = { user: "u1", role: APPLICATION_ROLE_ID };

function setup(resultRows = []) {
  const calls = [];
  let handler;
  registerRoutes({ get: (_path, value) => { handler = value; } }, {
    database: { raw: async (sql, bindings) => { calls.push({ sql, bindings }); return { rows: resultRows }; } },
    logger: { error: () => {} },
  });
  const call = async (req) => {
    const res = { statusCode: 200, headers: {}, body: undefined };
    res.setHeader = (key, value) => { res.headers[key] = value; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.body = value; };
    let nextError;
    await handler(req, res, (error) => { nextError = error; });
    return { res, nextError };
  };
  return { calls, call };
}

test("anonymous and wrong-role requests are rejected before database access", async () => {
  const { calls, call } = setup();
  const anonymous = await call({ accountability: null, params: { usahaId: USAHA_ID } });
  assert.equal(anonymous.nextError.statusCode, 401);
  const wrongRole = await call({ accountability: { user: "u1", role: "other" }, params: { usahaId: USAHA_ID } });
  assert.equal(wrongRole.nextError.statusCode, 403);
  assert.equal(calls.length, 0);
});

test("a malformed business id is a 400 without a query", async () => {
  const { calls, call } = setup();
  const { res } = await call({ accountability: APP_USER, params: { usahaId: "1 OR 1=1" } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.errors[0].extensions.code, "INVALID_USAHA_ID");
  assert.equal(calls.length, 0);
});

test("an unknown business is a 404", async () => {
  const { call } = setup([]);
  const { res } = await call({ accountability: APP_USER, params: { usahaId: USAHA_ID } });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.errors[0].extensions.code, "USAHA_NOT_FOUND");
});

test("a business without certificates returns an empty list", async () => {
  const { call } = setup([{ id: null, jenis: null, nomor: null, status: null, berlakuHingga: null, berkas: null }]);
  const { res } = await call({ accountability: APP_USER, params: { usahaId: USAHA_ID } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { data: [] });
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("certificates are returned with the id bound as a parameter", async () => {
  const item = { id: "c1", jenis: "halal", nomor: "ID321", status: "terbit", berlakuHingga: "2030-01-01", berkas: null };
  const { calls, call } = setup([item]);
  const { res } = await call({ accountability: APP_USER, params: { usahaId: USAHA_ID } });
  assert.deepEqual(res.body, { data: [item] });
  assert.deepEqual(calls[0].bindings, [USAHA_ID]);
  assert.match(calls[0].sql, /berlaku_hingga < CURRENT_DATE THEN 'kedaluwarsa'/);
});

test("database failures return a generic 500", async () => {
  let handler;
  const logged = [];
  registerRoutes({ get: (_path, value) => { handler = value; } }, {
    database: { raw: async () => { throw Object.assign(new Error("relation does not exist"), { code: "42P01" }); } },
    logger: { error: (payload) => logged.push(payload) },
  });
  const res = { headers: {} };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (value) => { res.body = value; };
  await handler({ accountability: APP_USER, params: { usahaId: USAHA_ID } }, res, assert.fail);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.errors[0].extensions.code, "INTERNAL_SERVER_ERROR");
  assert.doesNotMatch(JSON.stringify(res.body), /relation/);
  assert.deepEqual(logged, [{ code: "42P01", status: 500 }]);
});

test("the map card never sends the owner's NIK", async () => {
  const { default: registerPeta } = await import("../src/endpoints/peta/index.js");
  let handler;
  registerPeta({ get: (_path, value) => (handler = value) }, {
    database: {
      raw: async (sql) =>
        sql.includes("FROM usaha u")
          ? { rows: [{ id: USAHA_ID, nama: "Keripik", nama_lengkap: "Siti", nik: "3201234567890123", skala: "micro", kode_kbli: "10794", omzet_tahunan: "150000000", talent_status: "talent_pool", talent_batch: "2026-1", tenaga_kerja: 2 }] }
          : { rows: [{ jenis: "pirt", status: "terbit" }, { jenis: "halal", status: "kedaluwarsa" }] },
    },
    logger: { error: () => {} },
  });
  const res = { headers: {} };
  res.setHeader = (key, value) => (res.headers[key] = value);
  res.json = (value) => (res.body = value);
  await handler({ accountability: APP_USER, params: { usahaId: USAHA_ID } }, res, assert.fail);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(res.body.data, {
    id: USAHA_ID, nama: "Keripik", pemilik: "Siti", skala: "micro", kodeKbli: "10794", kegiatanUtama: undefined,
    omzetTahunan: 150000000, sertifikasi: ["pirt"], talentStatus: "talent_pool", talentBatch: "2026-1",
  });
  assert.doesNotMatch(JSON.stringify(res.body), /3201234567890123/);
});
