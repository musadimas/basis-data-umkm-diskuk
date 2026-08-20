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
    post: (path, handler) => {
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

const run = async (routes, path, query, request = {}) => {
  const res = fakeResponse();
  await routes[path](
    { accountability: { user: "test-user", role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb" }, ...request, query },
    res,
    (error) => {
      throw error instanceof Error ? error : new Error(String(error));
    },
  );
  return res;
};

const rows = (list) => ({ rows: list });

const runWithError = async (routes, path, query, request = {}) => {
  const res = fakeResponse();
  let error;
  await routes[path]({ ...request, query }, res, (value) => { error = value; });
  return { res, error };
};

test("tabular: returns paginated rows with filter count", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) return rows([{ filterCount: "42", mikro: "10", kecil: "5", menengah: "2" }]);
    if (sql.includes("payload -> 'scales'")) return rows([]);
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

  assert.equal(res.body.meta.filterCount, 42);
  assert.equal(res.body.meta.page, 2);
  assert.equal(res.body.meta.pageSize, 5);
  assert.equal(res.body.meta.mikro, 10);
  assert.equal(res.body.data[0].nama, "Toko Sembako");

  const selectCall = rawCalls.find((c) => /ORDER BY t\.nama, t\.id/.test(c.sql) && c.sql.includes("LIMIT"));
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  assert.ok(selectCall, "select query found");
  assert.ok(countCall, "count query found");
  assert.match(selectCall.sql, /ORDER BY t\.nama, t\.id/);
  assert.deepEqual(selectCall.params, [38, "micro", "PERDAGANGAN", "47112", 5, 5]);
  assert.deepEqual(countCall.params, [38, "micro", "PERDAGANGAN", "47112"]);
});

test("tabular: ignores invalid filter params and clamps page_size", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) return rows([{ filterCount: "7", mikro: "0", kecil: "0", menengah: "0" }]);
    if (sql.includes("payload -> 'scales'")) return rows([{ scales: null }]);
    return rows([]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/", {
    page: "0", page_size: "999999", kota: "abc", skala: "raksasa", kegiatan: "", kbli: "", kelurahan: "-1",
  });

  assert.equal(res.body.meta.filterCount, 7);
  assert.equal(res.body.meta.page, 1);
  assert.equal(res.body.meta.pageSize, 1000);
  const selectCall = rawCalls.find((c) => /ORDER BY t\.nama, t\.id/.test(c.sql));
  assert.ok(selectCall);
  assert.deepEqual(selectCall.params, [1000, 0]);
});

test("tabular: returns coordinate points with scale recap", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) {
      return rows([{ filterCount: "42", mikro: "30", kecil: "8", menengah: "4" }]);
    }
    if (sql.includes("payload -> 'scales'")) return rows([]);
    return rows([
      {
        id: "u1", nama: "Toko Sembako", skala: "micro", produkUtama: null,
        kegiatanUtama: "jualan", kodeKbli: "47112", kategoriKbli: "PERDAGANGAN",
        kota: "KAB. GARUT", kecamatan: "BANJARWANGI",
        latitude: -7.0123, longitude: 107.9876,
      },
    ]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/spasial", {
    kota: "38", skala: "micro", limit: "50",
  });

  assert.deepEqual(res.body.meta, { filterCount: 42, mikro: 30, kecil: 8, menengah: 4, limit: 50 });
  assert.equal(res.body.data[0].latitude, -7.0123);

  const pointCall = rawCalls.find((c) => /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/.test(c.sql));
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  assert.ok(pointCall);
  assert.ok(countCall);
  assert.match(pointCall.sql, /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/);
  assert.deepEqual(pointCall.params, [38, "micro", 50]);
  assert.deepEqual(countCall.params, [38, "micro"]);
});

test("tabular: spasial ignores invalid filters and clamps limit", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("COUNT(*)")) return rows([{ filterCount: "0", mikro: "0", kecil: "0", menengah: "0" }]);
    if (sql.includes("payload -> 'scales'")) return rows([{ scales: null }]);
    return rows([]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/spasial", {
    kota: "abc", skala: "raksasa", limit: "99999",
  });

  assert.deepEqual(res.body.meta, { filterCount: 0, mikro: 0, kecil: 0, menengah: 0, limit: 5000 });
  const pointCall = rawCalls.find((c) => /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/.test(c.sql));
  assert.ok(pointCall);
  assert.deepEqual(pointCall.params, [5000]);
});

test("tabular: returns materialized filter options with one snapshot query", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const options = {
    kota: [{ id: 38, nama: "KAB. GARUT" }],
    kecamatan: [{ id: 5, nama: "BANJARWANGI", kotaId: 38 }],
    kategori: ["PERDAGANGAN"],
    kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
  };
  const raw = async (sql) => { rawCalls.push(sql); return rows([{ options }]); };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/options", {});

  assert.deepEqual(res.body.data, options);
  assert.equal(rawCalls.length, 1);
  assert.match(rawCalls[0], /payload -> 'options'/);
  assert.doesNotMatch(rawCalls[0], /usaha_tabular/);
});

test("tabular: keeps the live-query fallback until the next snapshot publish", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql) => {
    rawCalls.push(sql);
    if (sql.includes("payload -> 'options'")) return rows([{ options: null }]);
    if (sql.includes("kota_nama AS nama")) return rows([{ id: 38, nama: "KAB. GARUT" }]);
    if (sql.includes("kecamatan_nama AS nama")) return rows([{ id: 5, nama: "BANJARWANGI", kotaId: 38 }]);
    if (sql.includes("kategori_kbli AS nama")) return rows([{ nama: "PERDAGANGAN" }]);
    return rows([{ kode: "47112", kategori: "PERDAGANGAN" }]);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/options", {});

  assert.equal(rawCalls.length, 5);
  assert.deepEqual(res.body.data.kbli, [{ kode: "47112", kategori: "PERDAGANGAN" }]);
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

test("tabular: private reads do not join mutable source tables", async () => {
  const router = captureRouter();
  const sqlCalls = [];
  const raw = async (sql) => {
    sqlCalls.push(sql);
    return rows(sql.includes("COUNT(*)") ? [{ filterCount: "0" }] : []);
  };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  await run(router.routes, "/", {});
  await run(router.routes, "/spasial", {});
  await run(router.routes, "/options", {});
  await run(router.routes, "/kelurahan", { kecamatan: "5" });

  assert.ok(sqlCalls.every((sql) => !/\bJOIN\s+(kota|kecamatan|kelurahan|usaha|statistik_tenaga_kerja)\b/i.test(sql)));
});

test("tabular: rejects publish from non-admin users", async () => {
  const router = captureRouter();
  extension.handler(router, {
    database: { raw: async () => assert.fail("database must not be called") },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const { error } = await runWithError(router.routes, "/publish", {}, { accountability: { user: "u1", role: "other", admin: false } });

  assert.equal(error.statusCode, 403);
});

test("tabular: admin publish enqueues a rebuild without running legacy SQL", async () => {
  const router = captureRouter(); const rawCalls = [];
  const raw = async (sql) => { rawCalls.push(sql); return rows([{ id: "job-1" }]); };
  extension.handler(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });
  const res = await run(router.routes, "/publish", {}, { accountability: { user: "admin", admin: true, role: "admin" } });
  assert.equal(res.statusCode, 202); assert.deepEqual(res.body, { data: { jobId: "job-1", status: "queued" } });
  assert.match(rawCalls[0], /analitik_enqueue_job/); assert.doesNotMatch(rawCalls[0], /TRUNCATE|publish\.sql/i);
});



test("tabular: rejects anonymous and wrong-role requests before any query", async () => {
  const router = captureRouter();
  let calls = 0;
  extension.handler(router, { database: { raw: async () => { calls += 1; } }, logger: { error() {} } });
  for (const path of ["/status", "/", "/spasial", "/options", "/kelurahan", "/publish"]) {
    const anonymous = await runWithError(router.routes, path, {}, {});
    assert.equal(anonymous.error.statusCode, 401, path);
    const wrongRole = await runWithError(router.routes, path, {}, { accountability: { user: "u1", role: "other", admin: false } });
    assert.equal(wrongRole.error.statusCode, 403, path);
  }
  assert.equal(calls, 0);
});
