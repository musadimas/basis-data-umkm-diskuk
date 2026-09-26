import assert from "node:assert/strict";
import test from "node:test";
import registerRoutes, * as extension from "../src/endpoints/tabular/index.js";

/** Akun Application User provinsi: id harus UUID karena resolver membaca barisnya. */
const PROVINSI_USER = "33333333-3333-4333-8333-333333333333";

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
  const res = { headers: {}, json: undefined, statusCode: 200 };
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.json = (body) => {
    res.body = body;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.end = (body) => {
    res.body = body;
  };
  return res;
};

const run = async (routes, path, query, request = {}) => {
  const res = fakeResponse();
  await routes[path](
    {
      accountability: {
        user: PROVINSI_USER,
        role: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb",
      },
      ...request,
      query,
    },
    res,
    (error) => {
      throw error instanceof Error ? error : new Error(String(error));
    },
  );
  return res;
};

const rows = (list) => ({ rows: list });

/**
 * Baris operator provinsi: role dibaca dari kolom app_role, jadi setiap mock yang
 * menyimulasikan Application User biasa perlu menjawab query resolusi operator.
 */
const PROVINSI_OPERATOR_ROWS = [
  {
    id: PROVINSI_USER,
    app_role: "provinsi",
    kota: null,
    kota_nama: null,
    usaha: null,
    usaha_nama: null,
    usaha_nib: null,
  },
];
const isOperatorQuery = (sql) => sql.includes("FROM directus_users u");

const runWithError = async (routes, path, query, request = {}) => {
  const res = fakeResponse();
  let error;
  await routes[path]({ ...request, query }, res, (value) => {
    error = value;
  });
  return { res, error };
};

test("tabular: returns paginated rows with filter count", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("COUNT(*)"))
      return rows([
        { filterCount: "42", mikro: "10", kecil: "5", menengah: "2" },
      ]);
    if (sql.includes("payload -> 'scales'")) return rows([]);
    return rows([
      {
        id: "u1",
        nama: "Toko Sembako",
        skala: "micro",
        produkUtama: null,
        kegiatanUtama: "jualan",
        kodeKbli: "47112",
        kategoriKbli: "PERDAGANGAN",
        kota: "KAB. GARUT",
        kecamatan: "BANJARWANGI",
        kelurahan: "BANJARWANGI",
      },
    ]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/", {
    page: "2",
    page_size: "5",
    kota: "38",
    skala: "micro",
    kegiatan: "PERDAGANGAN",
    kbli: "47112",
  });

  assert.equal(res.body.data.meta.filterCount, 42);
  assert.equal(res.body.data.meta.page, 2);
  assert.equal(res.body.data.meta.pageSize, 5);
  assert.equal(res.body.data.meta.mikro, 10);
  assert.equal(res.body.data.rows[0].nama, "Toko Sembako");

  const selectCall = rawCalls.find(
    (c) => /ORDER BY t\.nama, t\.id/.test(c.sql) && c.sql.includes("LIMIT"),
  );
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  assert.ok(selectCall, "select query found");
  assert.ok(countCall, "count query found");
  assert.match(selectCall.sql, /ORDER BY t\.nama, t\.id/);
  assert.deepEqual(selectCall.params, [
    38,
    "micro",
    "PERDAGANGAN",
    "47112",
    5,
    5,
  ]);
  assert.deepEqual(countCall.params, [38, "micro", "PERDAGANGAN", "47112"]);
});

test("tabular: ignores invalid filter params and clamps page_size", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("COUNT(*)"))
      return rows([
        { filterCount: "7", mikro: "0", kecil: "0", menengah: "0" },
      ]);
    if (sql.includes("payload -> 'scales'")) return rows([{ scales: null }]);
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/", {
    page: "0",
    page_size: "999999",
    kota: "abc",
    skala: "raksasa",
    kegiatan: "",
    kbli: "",
    kelurahan: "-1",
  });

  assert.equal(res.body.data.meta.filterCount, 7);
  assert.equal(res.body.data.meta.page, 1);
  assert.equal(res.body.data.meta.pageSize, 1000);
  const selectCall = rawCalls.find((c) =>
    /ORDER BY t\.nama, t\.id/.test(c.sql),
  );
  assert.ok(selectCall);
  assert.deepEqual(selectCall.params, [1000, 0]);
});

test("tabular: returns coordinate points with scale recap", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("COUNT(*)")) {
      return rows([
        { filterCount: "42", mikro: "30", kecil: "8", menengah: "4" },
      ]);
    }
    if (sql.includes("payload -> 'scales'")) return rows([]);
    return rows([
      {
        id: "u1",
        nama: "Toko Sembako",
        skala: "micro",
        produkUtama: null,
        kegiatanUtama: "jualan",
        kodeKbli: "47112",
        kategoriKbli: "PERDAGANGAN",
        kota: "KAB. GARUT",
        kecamatan: "BANJARWANGI",
        latitude: -7.0123,
        longitude: 107.9876,
      },
    ]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/spasial", {
    kota: "38",
    skala: "micro",
    limit: "50",
  });

  assert.deepEqual(res.body.data.meta, {
    filterCount: 42,
    mikro: 30,
    kecil: 8,
    menengah: 4,
    limit: 50,
  });
  assert.equal(res.body.data.points[0].latitude, -7.0123);

  const pointCall = rawCalls.find((c) =>
    /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/.test(c.sql),
  );
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  assert.ok(pointCall);
  assert.ok(countCall);
  assert.match(
    pointCall.sql,
    /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/,
  );
  assert.deepEqual(pointCall.params, [38, "micro", 50]);
  assert.deepEqual(countCall.params, [38, "micro"]);
});

test("tabular: spasial ignores invalid filters and clamps limit", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("COUNT(*)"))
      return rows([
        { filterCount: "0", mikro: "0", kecil: "0", menengah: "0" },
      ]);
    if (sql.includes("payload -> 'scales'")) return rows([{ scales: null }]);
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/spasial", {
    kota: "abc",
    skala: "raksasa",
    limit: "99999",
  });

  assert.deepEqual(res.body.data.meta, {
    filterCount: 0,
    mikro: 0,
    kecil: 0,
    menengah: 0,
    limit: 5000,
  });
  const pointCall = rawCalls.find((c) =>
    /t\.latitude IS NOT NULL AND t\.longitude IS NOT NULL/.test(c.sql),
  );
  assert.ok(pointCall);
  assert.deepEqual(pointCall.params, [5000]);
});

test("tabular: returns spatial tileset metadata from snapshot", async () => {
  const router = captureRouter();
  const tiles = {
    url: "/tiles/umkm-points-generation-sha256.pmtiles",
    updatedAt: "2026-08-25T00:00:00Z",
    pointCount: 1234,
    generationId: "a5b88170-6c58-4b50-89ba-90b6a4f371f8",
  };
  const raw = async (sql) =>
    rows(
      isOperatorQuery(sql)
        ? PROVINSI_OPERATOR_ROWS
        : sql.includes("payload -> 'spatialTiles'")
          ? [{ tiles }]
          : [],
    );
  registerRoutes(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/spasial/tileset", {});

  assert.deepEqual(res.body.data, tiles);
});

test("tabular: authorizes spatial tile proxy with only the operator lookup", async () => {
  const router = captureRouter();
  const rawCalls = [];
  registerRoutes(router, {
    database: {
      raw: async (sql) => {
        rawCalls.push(sql);
        if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
        assert.fail("only the operator lookup may query the database");
      },
    },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/spasial/authorize", {});

  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
  assert.equal(res.headers["cache-control"], "private, no-store");
  assert.equal(rawCalls.length, 1);
});

test("tabular: returns null tileset until the first tile build", async () => {
  const router = captureRouter();
  const raw = async (sql) => rows(
    isOperatorQuery(sql)
      ? PROVINSI_OPERATOR_ROWS
      : sql.includes("payload -> 'spatialTiles'")
        ? [{ tiles: null }]
        : [],
  );
  registerRoutes(router, { database: { raw }, logger: { error: () => assert.fail("no errors expected") } });

  const res = await run(router.routes, "/spasial/tileset", {});

  assert.equal(res.body.data, null);
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
  const raw = async (sql) => {
    rawCalls.push(sql);
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    return rows([{ options }]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/options", {});

  assert.deepEqual(res.body.data, options);
  assert.equal(rawCalls.length, 2);
  assert.match(rawCalls[1], /payload -> 'options'/);
  assert.doesNotMatch(rawCalls[1], /usaha_tabular/);
});

test("tabular: keeps the live-query fallback until the next snapshot publish", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql) => {
    rawCalls.push(sql);
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("payload -> 'options'")) return rows([{ options: null }]);
    if (sql.includes("kota_nama AS nama"))
      return rows([{ id: 38, nama: "KAB. GARUT" }]);
    if (sql.includes("kecamatan_nama AS nama"))
      return rows([{ id: 5, nama: "BANJARWANGI", kotaId: 38 }]);
    if (sql.includes("kategori_kbli AS nama"))
      return rows([{ nama: "PERDAGANGAN" }]);
    return rows([{ kode: "47112", kategori: "PERDAGANGAN" }]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/options", {});

  assert.equal(rawCalls.length, 6);
  assert.deepEqual(res.body.data.kbli, [
    { kode: "47112", kategori: "PERDAGANGAN" },
  ]);
});

test("tabular: returns kelurahan for a kecamatan", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    return rows([{ id: 12, nama: "BANJARWANGI" }]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/kelurahan", { kecamatan: "5" });

  assert.deepEqual(res.body.data, [{ id: 12, nama: "BANJARWANGI" }]);
  const kelurahanCall = rawCalls.find((call) => call.sql.includes("FROM kelurahan"));
  assert.ok(kelurahanCall, "kelurahan lookup found");
  assert.deepEqual(kelurahanCall.params, [5]);
});

test("tabular: requires kecamatan param for kelurahan", async () => {
  const router = captureRouter();
  registerRoutes(router, {
    database: { raw: async () => ({ rows: [] }) },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/kelurahan", {});

  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors[0].message.includes("kecamatan"));
});

test("tabular: private reads do not join mutable source tables", async () => {
  const router = captureRouter();
  const sqlCalls = [];
  const raw = async (sql) => {
    sqlCalls.push(sql);
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    return rows(sql.includes("COUNT(*)") ? [{ filterCount: "0" }] : []);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  await run(router.routes, "/", {});
  await run(router.routes, "/spasial", {});
  await run(router.routes, "/options", {});
  await run(router.routes, "/kelurahan", { kecamatan: "5" });

  // Query resolusi operator boleh join tabel referensi `kota`; yang dilarang adalah
  // tabel sumber yang bisa berubah (kota/kecamatan/kelurahan/usaha/statistik_tenaga_kerja)
  // ikut terbaca oleh query data.
  const dataCalls = sqlCalls.filter((sql) => !isOperatorQuery(sql));
  assert.ok(
    dataCalls.every(
      (sql) =>
        !/\bJOIN\s+(kota|kecamatan|kelurahan|usaha|statistik_tenaga_kerja)\b/i.test(
          sql,
        ),
    ),
  );
});

test("tabular: rejects publish from non-admin users", async () => {
  const router = captureRouter();
  registerRoutes(router, {
    database: { raw: async () => assert.fail("database must not be called") },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const { error } = await runWithError(
    router.routes,
    "/publish",
    {},
    { accountability: { user: "u1", role: "other", admin: false } },
  );

  assert.equal(error.statusCode, 403);
});

test("tabular: admin publish enqueues a rebuild without running legacy SQL", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql) => {
    rawCalls.push(sql);
    return rows([{ id: "job-1" }]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });
  const res = await run(
    router.routes,
    "/publish",
    {},
    { accountability: { user: "admin", admin: true, role: "admin" } },
  );
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { data: { jobId: "job-1", status: "queued" } });
  assert.match(rawCalls[0], /analitik_enqueue_job/);
  assert.doesNotMatch(rawCalls[0], /TRUNCATE|publish\.sql/i);
});

// ---- Y01 multi-role scoping (kabkota / pendamping) ----

// Operator kabkota memakai Application role yang sama dengan operator provinsi;
// wilayahnya (dan identitas role-nya) berasal dari kolom directus_users.app_role.
const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const PENDAMPING_ROLE = "d824230f-46db-407d-b8ea-fb2ed58c6c4f";
const KABKOTA_USER = "22222222-2222-4222-8222-222222222222";

const kabkotaOperatorRows = (kota = 7) => [
  {
    id: KABKOTA_USER,
    app_role: "kabkota",
    kota,
    kota_nama: kota == null ? null : "KABUPATEN SUBANG",
    usaha: null,
    usaha_nama: null,
    usaha_nib: null,
  },
];

test("tabular: kabkota is scoped to its own kota regardless of client filters", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("FROM directus_users u")) return rows(kabkotaOperatorRows());
    if (sql.includes("COUNT(*)"))
      return rows([{ filterCount: "42", mikro: "10", kecil: "5", menengah: "2" }]);
    if (sql.includes("payload -> 'scales'")) return rows([]);
    return rows([
      {
        id: "u1",
        nama: "Toko Sembako",
        skala: "micro",
        kota: "KABUPATEN SUBANG",
      },
    ]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(
    router.routes,
    "/",
    { page: "1", page_size: "5", kota: "99" },
    { accountability: { user: KABKOTA_USER, role: APPLICATION_ROLE_ID } },
  );

  assert.equal(res.statusCode, 200);
  // `meta` berada di dalam `data` (envelope SDK) pada rute analytics.
  assert.equal(res.body.data.meta.filterCount, 42);
  const operatorCalls = rawCalls.filter((c) =>
    c.sql.includes("FROM directus_users u"),
  );
  assert.equal(operatorCalls.length, 1);
  assert.deepEqual(operatorCalls[0].params, [KABKOTA_USER]);
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  const selectCall = rawCalls.find(
    (c) => /ORDER BY t\.nama, t\.id/.test(c.sql) && c.sql.includes("LIMIT"),
  );
  assert.ok(countCall, "count query found");
  assert.ok(selectCall, "select query found");
  assert.ok(
    countCall.params.includes(7),
    "count query must be bound to the operator kota",
  );
  assert.deepEqual(
    selectCall.params,
    [7, 5, 0],
    "select query must ignore the client kota and use the operator kota",
  );
  for (const call of rawCalls) {
    assert.ok(
      !call.params.includes(99) && !call.params.includes("99"),
      "the client-provided kota=99 must never reach SQL bindings",
    );
  }
});

test("tabular: kabkota tileset is null without touching the snapshot", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (sql.includes("FROM directus_users u")) return rows(kabkotaOperatorRows());
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(
    router.routes,
    "/spasial/tileset",
    {},
    { accountability: { user: KABKOTA_USER, role: APPLICATION_ROLE_ID } },
  );

  assert.deepEqual(res.body, { data: null });
  assert.ok(
    rawCalls.every((c) => !c.sql.includes("payload -> 'spatialTiles'")),
    "provincial tileset snapshot must not be queried for kabkota",
  );
  assert.ok(
    rawCalls.every((c) => !c.sql.includes("infografis_snapshot")),
    "no snapshot table access expected for kabkota tileset",
  );
});

test("tabular: kabkota cannot authorize provincial spatial tiles", async () => {
  const router = captureRouter();
  const rawCalls = [];
  registerRoutes(router, {
    database: {
      raw: async (sql) => {
        rawCalls.push(sql);
        if (isOperatorQuery(sql)) return rows(kabkotaOperatorRows());
        assert.fail("tile proxy authorization must not read any snapshot");
      },
    },
    logger: { error() {} },
  });

  const { error } = await runWithError(
    router.routes,
    "/spasial/authorize",
    {},
    { accountability: { user: KABKOTA_USER, role: APPLICATION_ROLE_ID } },
  );

  assert.equal(error.statusCode, 403);
  assert.equal(
    rawCalls.length,
    1,
    "only the app_role/kota lookup may run before the tile proxy is denied",
  );
});

test("tabular: kabkota filter options are scoped to the assigned kota", async () => {
  const router = captureRouter();
  const options = {
    kota: [
      { id: 7, nama: "KABUPATEN SUBANG" },
      { id: 9, nama: "KOTA BANDUNG" },
    ],
    kecamatan: [
      { id: 11, nama: "BANJARWANGI", kotaId: 7 },
      { id: 12, nama: "CIBINONG", kotaId: 9 },
    ],
    kategori: ["PERDAGANGAN"],
    kbli: [{ kode: "47112", kategori: "PERDAGANGAN" }],
  };
  const raw = async (sql) => {
    if (sql.includes("FROM directus_users u")) return rows(kabkotaOperatorRows());
    if (sql.includes("payload -> 'options'")) return rows([{ options }]);
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(
    router.routes,
    "/options",
    {},
    { accountability: { user: KABKOTA_USER, role: APPLICATION_ROLE_ID } },
  );

  assert.deepEqual(res.body.data.kota, [{ id: 7, nama: "KABUPATEN SUBANG" }]);
  assert.deepEqual(res.body.data.kecamatan, [
    { id: 11, nama: "BANJARWANGI", kotaId: 7 },
  ]);
  assert.deepEqual(res.body.data.kategori, ["PERDAGANGAN"]);
});

test("tabular: kabkota without an assigned kota is rejected with KOTA_NOT_ASSIGNED", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql) => {
    rawCalls.push(sql);
    if (sql.includes("FROM directus_users u")) return rows(kabkotaOperatorRows(null));
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error() {} },
  });

  const { error } = await runWithError(
    router.routes,
    "/",
    {},
    { accountability: { user: KABKOTA_USER, role: APPLICATION_ROLE_ID } },
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.extensions.code, "KOTA_NOT_ASSIGNED");
  assert.ok(
    rawCalls.every((sql) => sql.includes("FROM directus_users u")),
    "no data query may run when the kota assignment is missing",
  );
});

test("tabular: provinsi keeps client kota filters after one app_role lookup", async () => {
  const router = captureRouter();
  const rawCalls = [];
  const raw = async (sql, params = []) => {
    rawCalls.push({ sql, params });
    if (isOperatorQuery(sql)) return rows(PROVINSI_OPERATOR_ROWS);
    if (sql.includes("COUNT(*)"))
      return rows([{ filterCount: "42", mikro: "10", kecil: "5", menengah: "2" }]);
    if (sql.includes("payload -> 'scales'")) return rows([]);
    return rows([]);
  };
  registerRoutes(router, {
    database: { raw },
    logger: { error: () => assert.fail("no errors expected") },
  });

  const res = await run(router.routes, "/", {
    page: "1",
    page_size: "5",
    kota: "99",
  });

  assert.equal(res.statusCode, 200);
  const operatorCalls = rawCalls.filter((c) => isOperatorQuery(c.sql));
  assert.equal(
    operatorCalls.length,
    1,
    "role comes from directus_users.app_role, so exactly one lookup is expected",
  );
  assert.ok(
    !operatorCalls[0].params.includes(99) && !operatorCalls[0].params.includes("99"),
    "the client kota filter must never reach the operator lookup",
  );
  const countCall = rawCalls.find((c) => c.sql.includes("COUNT(*)"));
  assert.ok(countCall);
  assert.ok(
    countCall.params.includes(99),
    "provinsi may query any kota, including 99",
  );
});

test("tabular: pendamping is rejected before any database access", async () => {
  const router = captureRouter();
  let calls = 0;
  registerRoutes(router, {
    database: {
      raw: async () => {
        calls += 1;
      },
    },
    logger: { error() {} },
  });

  const { error } = await runWithError(
    router.routes,
    "/",
    {},
    { accountability: { user: "u1", role: PENDAMPING_ROLE } },
  );

  assert.equal(error.statusCode, 403);
  assert.equal(calls, 0);
});

test("tabular: rejects anonymous and wrong-role requests before any query", async () => {
  const router = captureRouter();
  let calls = 0;
  registerRoutes(router, {
    database: {
      raw: async () => {
        calls += 1;
      },
    },
    logger: { error() {} },
  });
  for (const path of [
    "/status",
    "/",
    "/spasial",
    "/spasial/authorize",
    "/spasial/tileset",
    "/options",
    "/kelurahan",
    "/publish",
  ]) {
    const anonymous = await runWithError(router.routes, path, {}, {});
    assert.equal(anonymous.error.statusCode, 401, path);
    const wrongRole = await runWithError(
      router.routes,
      path,
      {},
      { accountability: { user: "u1", role: "other", admin: false } },
    );
    assert.equal(wrongRole.error.statusCode, 403, path);
  }
  assert.equal(calls, 0);
});
