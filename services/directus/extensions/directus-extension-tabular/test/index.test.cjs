const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../dist/index.js");

/** Bangun router tiruan yang menangkap handler per path. */
const captureRouter = () => {
  const routes = {};
  return {
    get: (path, handler) => {
      routes[path] = handler;
    },
    routes,
  };
};

const fakeResponse = () => {
  const res = { json: undefined, statusCode: 200 };
  res.json = (body) => {
    res.body = body;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  return res;
};

const run = async (routes, path, query) => {
  const res = fakeResponse();
  await routes[path](
    { query },
    res,
    (error) => {
      throw error instanceof Error ? error : new Error(String(error));
    },
  );
  return res;
};

const rows = (list) => ({ rows: list });

test("tabular: returns paginated rows with filter count", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) return rows([{ filterCount: "42" }]);
    return rows([
      {
        id: "u1", nama: "Toko Sembako", skala: "micro", produkUtama: null,
        kegiatanUtama: "jualan", kodeKbli: "47112", kategoriKbli: "PERDAGANGAN",
        kota: "KAB. GARUT", kecamatan: "BANJARWANGI", kelurahan: "BANJARWANGI",
      },
    ]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/", {
    page: "2", page_size: "5", kota: "38", skala: "micro", kegiatan: "PERDAGANGAN", kbli: "47112",
  });

  assert.deepEqual(res.body.meta, { filterCount: 42, page: 2, pageSize: 5 });
  assert.equal(res.body.data[0].nama, "Toko Sembako");

  const [selectCall, countCall] = rawCalls;
  assert.match(selectCall.sql, /ORDER BY t\.nama, t\.id/);
  assert.deepEqual(selectCall.params, [38, "micro", "PERDAGANGAN", "47112", 5, 5]);
  assert.deepEqual(countCall.params, [38, "micro", "PERDAGANGAN", "47112"]);
});

test("tabular: ignores invalid filter params and clamps page_size", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) return rows([{ filterCount: "7" }]);
    return rows([]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/", {
    page: "0", page_size: "999999", kota: "abc", skala: "raksasa", kegiatan: "", kbli: "", kelurahan: "-1",
  });

  assert.deepEqual(res.body.meta, { filterCount: 7, page: 1, pageSize: 1000 });
  const [selectCall] = rawCalls;
  assert.deepEqual(selectCall.params, [1000, 0]);
});

test("tabular: returns filter options mapped to camelCase", async () => {
  const router = captureRouter();
  const raw = async (sql) => {
    if (sql.includes("kota ko")) return rows([{ id: 38, nama: "KAB. GARUT" }]);
    if (sql.includes("kecamatan kc")) return rows([{ id: 5, nama: "BANJARWANGI", kotaId: 38 }]);
    if (sql.includes("kategori_kbli AS nama")) return rows([{ nama: "PERDAGANGAN" }]);
    return rows([{ kode: "47112", kategori: "PERDAGANGAN" }]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/options", {});

  assert.deepEqual(res.body.data, {
    kota: [{ id: 38, nama: "KAB. GARUT" }],
    kecamatan: [{ id: 5, nama: "BANJARWANGI", kotaId: 38 }],
    kategori: ["PERDAGANGAN"],
    kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
  });
});

test("tabular: returns kelurahan for a kecamatan", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    return rows([{ id: 12, nama: "BANJARWANGI" }]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/kelurahan", { kecamatan: "5" });

  assert.deepEqual(res.body.data, [{ id: 12, nama: "BANJARWANGI" }]);
  assert.deepEqual(rawCalls[0].params, [5]);
});

test("tabular: requires kecamatan param for kelurahan", async () => {
  const router = captureRouter();
  extension.handler(router, { database: { raw: async () => ({ rows: [] }) }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/kelurahan", {});

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors[0].message.includes("kecamatan"));
});
