import { signDownload, verifyDownload } from "../src/endpoints/analysis/exports-service.js";
import { __resetBudgetForTests } from "../src/endpoints/analysis/query-service.js";
import { __resetAggregateCacheForTests } from "../src/endpoints/analysis/aggregate-cache.js";
import assert from "node:assert/strict";
import test from "node:test";
import registerRoutes from "../src/endpoints/analysis/index.js";

const ROLE = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
/** Akun provinsi: id UUID karena resolver membaca baris directus_users-nya. */
const PROVINSI_USER = "33333333-3333-4333-8333-333333333333";
function router() {
  const routes = {};
  return {
    routes,
    get: (p, h) => (routes[`GET ${p}`] = h),
    post: (p, h) => (routes[`POST ${p}`] = h),
  };
}
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    set(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(v) {
      this.body = v;
    },
  };
}
async function run(
  handler,
  req = { accountability: { user: PROVINSI_USER, role: ROLE }, query: {}, body: {} },
) {
  const res = response();
  let error;
  handler(req, res, (e) => {
    error = e;
  });
  for (let i = 0; i < 10 && !res.body && !error; i++)
    await new Promise((r) => setImmediate(r));
  return { res, error };
}
test("all routes reject anonymous and wrong role before DB", async () => {
  let calls = 0;
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async () => {
        calls++;
      },
    },
    logger: { error() {} },
  });
  // GET /metadata, /templates, /status kini publik (DAFTAR_PUBLIK): tanpa sesi
  // tetap boleh baca, jadi tidak ikut daftar terjaga di sini.
  for (const [method, path] of [
    ["GET", "/metadata/options"],
    ["POST", "/query"],
    ["POST", "/records"],
    ["GET", "/umkm/:id"],
    ["POST", "/exports"],
    ["GET", "/exports/:jobId"],
    ["GET", "/exports/:jobId/download"],
  ]) {
    let out = await run(r.routes[`${method} ${path}`], { query: {}, body: {} });
    assert.equal(out.error.statusCode, 401, path);
    out = await run(r.routes[`${method} ${path}`], {
      accountability: { user: "u", role: "other" },
      query: {},
      body: {},
    });
    assert.equal(out.error.statusCode, 403, path);
  }
  assert.equal(calls, 0);
});
test("Application User can read metadata and templates", async () => {
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async () => ({
        rows: [
          {
            id: "field",
            semantic_id: "kota_nama",
            label: "Kota",
            field_group: "analytics",
            sort_order: 1,
            semantic_role: "dimension",
            data_type: "text",
            lifecycle_status: "active",
            privacy_class: "aggregate",
            aggregation_capabilities: ["group"],
            schema_version: 1,
          },
        ],
      }),
    },
    logger: { error() {} },
  });
  let out = await run(r.routes["GET /metadata"]);
  assert.equal(out.res.body.schemaVersion, 1);
  out = await run(r.routes["GET /templates"]);
  assert.equal(out.res.body.templates[0].workforce.enabled, false);
});

test("profile validates UUID and returns only masked semantic sections", async () => {
  let calls = 0;
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async () => {
        calls++;
        return {
          rows: [
            {
              id: PROVINSI_USER,
              app_role: "provinsi",
              kota: null,
              kota_nama: null,
              kota_scope: null,
              usaha: null,
              usaha_nama: null,
              usaha_nib: null,
              usaha_id: "11111111-1111-4111-8111-111111111111",
              status: "active",
              nama: "Usaha Canari",
              skala: "micro",
              masked_nik: "************1234",
              masked_phone: "08******1234",
              owner_name: "Pemilik",
              age_band: "25–34",
              omzet_quality: "reported",
              aset_quality: "missing",
              omzet_tahunan: 987654321,
              total_aset: null,
              extra_fields: { aman: "x", nik_raw: "1234567890123456" },
              data_as_of: "2026-08-17T00:00:00Z",
            },
          ],
        };
      },
    },
    logger: { error() {} },
  });
  let out = await run(r.routes["GET /umkm/:id"], {
    accountability: { user: PROVINSI_USER, role: ROLE },
    params: { id: "bad" },
  });
  assert.equal(out.res.statusCode, 404);
  assert.equal(calls, 1, "hanya lookup pemanggil milik adapter yang boleh jalan");
  out = await run(r.routes["GET /umkm/:id"], {
    accountability: { user: PROVINSI_USER, role: ROLE },
    params: { id: "11111111-1111-4111-8111-111111111111" },
  });
  assert.equal(out.res.statusCode, 200);
  const text = JSON.stringify(out.res.body);
  assert.equal(text.includes("1234567890123456"), false);
  assert.equal(text.includes("987654321"), false);
  assert.equal(text.includes("raw"), false);
  assert.equal(out.res.body.data.actions.canArchive, true);
  // SDK-safe envelope: meta travels inside data, nothing is left beside it.
  assert.deepEqual(Object.keys(out.res.body), ["data"]);
  assert.equal(out.res.body.data.meta.schemaVersion, 1);
});

test("download signatures are expiring and tamper resistant", async () => {
  const expiry = Date.now() + 60000;
  const sig = signDownload("job", "owner", expiry);
  assert.equal(verifyDownload("job", "owner", expiry, sig), true);
  assert.equal(verifyDownload("job", "other", expiry, sig), false);
  assert.equal(verifyDownload("job", "owner", Date.now() - 1, sig), false);
});

// ---- Y01 multi-role scoping (kabkota / pendamping) ----

// Operator kabkota memakai Application role yang sama dengan provinsi; identitas role
// dan wilayahnya datang dari kolom directus_users.app_role + kota (lihat kabkotaDatabase).
const PENDAMPING_ROLE = "d824230f-46db-407d-b8ea-fb2ed58c6c4f";
const KABKOTA_USER = "22222222-2222-4222-8222-222222222222";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

const profileRow = (overrides = {}) => ({
  usaha_id: PROFILE_ID,
  kota_id: 7,
  kota_nama: "KABUPATEN SUBANG",
  status: "active",
  nama: "Usaha Canari",
  kegiatan_utama: "jualan",
  produk_utama: null,
  status_hukum: null,
  skala: "micro",
  kode_kbli: "47112",
  kategori_kbli: "PERDAGANGAN",
  business_address: null,
  latitude: null,
  longitude: null,
  omzet_quality: "reported",
  aset_quality: "missing",
  masked_nik: "************1234",
  masked_phone: "08******1234",
  owner_name: "Pemilik",
  age_band: "25–34",
  source_updated_at: "2026-08-17T00:00:00Z",
  extra_fields: {},
  data_as_of: "2026-08-17T00:00:00Z",
  ...overrides,
});

// Serves the kabkota operator lookup plus the queryAnalytics internals
// (active generation, field registry, live aggregate scan) and, when
// profileRow is given, the /umkm/:id profile lookup.
function kabkotaDatabase(calls, { kota = 7, profileRow: row = null } = {}) {
  return {
    raw: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM directus_users"))
        return {
          rows: [
            {
              id: KABKOTA_USER,
              app_role: "kabkota",
              kota,
              kota_nama: kota == null ? null : "KABUPATEN SUBANG",
              kota_scope: kota,
              usaha: null,
              usaha_nama: null,
              usaha_nib: null,
            },
          ],
        };
      if (sql.includes("FROM analitik_active_generation"))
        return {
          rows: [
            {
              id: "generation-1",
              status: "active",
              data_as_of: "2026-09-26T00:00:00Z",
              reconciled_at: "2026-09-26T01:00:00Z",
              row_count: 10,
              active_row_count: 10,
              archived_row_count: 0,
            },
          ],
        };
      if (sql.includes("FROM analitik_field"))
        return {
          rows: [
            {
              id: "metric",
              semantic_id: "jumlah_umkm",
              lifecycle_status: "active",
              semantic_role: "metric",
            },
            {
              id: "city",
              semantic_id: "kota_nama",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
            {
              id: "kota",
              semantic_id: "kota_id",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
            {
              id: "sector",
              semantic_id: "sektor_kbli",
              lifecycle_status: "active",
              semantic_role: "dimension",
            },
          ],
        };
      if (sql.includes("FROM analitik_usaha_current") && row)
        return { rows: [row] };
      if (sql.includes("group_key"))
        return {
          rows: [
            {
              group_key: "7",
              group_label: "KABUPATEN SUBANG",
              value: 10,
              eligible: 10,
              matched: 10,
              missing: 0,
              needs_verification: 0,
              metric_total: 10,
            },
          ],
        };
      if (sql.includes("INSERT INTO analitik_job"))
        return { rows: [{ id: "job-export-1" }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

test("kabkota query is forced onto its own kota before compilation", async () => {
  __resetBudgetForTests();
  const calls = [];
  const r = router();
  registerRoutes(r, { database: kabkotaDatabase(calls), logger: { error() {} } });

  const out = await run(r.routes["POST /query"], {
    accountability: { user: KABKOTA_USER, role: ROLE },
    query: {},
    body: {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "kota_nama",
      filters: [{ field: "kota_nama", operator: "eq", value: "OTHER" }],
    },
  });

  assert.equal(out.error, undefined);
  assert.equal(out.res.statusCode, 200);
  assert.equal(out.res.body.data.total, 10);
  assert.deepEqual(out.res.body.data.normalizedFilters.filters, [
    { fieldId: "kota_id", operator: "eq", value: "7" },
  ]);
  const scan = calls.find(
    ({ sql }) =>
      sql.includes("group_key") && sql.includes("FROM analitik_usaha_current"),
  );
  assert.ok(scan, "live aggregate scan must run for the filtered request");
  assert.match(scan.sql, /a\.kota_id = \?::integer/);
  assert.ok(scan.params.includes(7), "SQL must bind the operator kota 7");
  assert.ok(
    !scan.params.includes("OTHER"),
    "client kota_nama filter must be dropped before compilation",
  );
});

test("kabkota profile access outside its kota is a 404 PROFILE_NOT_FOUND", async () => {
  const calls = [];
  const r = router();
  registerRoutes(r, {
    database: kabkotaDatabase(calls, {
      profileRow: profileRow({ kota_id: 9, kota_nama: "KOTA BANDUNG" }),
    }),
    logger: { error() {} },
  });

  const out = await run(r.routes["GET /umkm/:id"], {
    accountability: { user: KABKOTA_USER, role: ROLE },
    params: { id: PROFILE_ID },
  });

  assert.equal(out.res.statusCode, 404);
  assert.equal(out.res.body.errors[0].extensions.code, "PROFILE_NOT_FOUND");
});

test("kabkota can open a profile inside its kota without province actions", async () => {
  const calls = [];
  const r = router();
  registerRoutes(r, {
    database: kabkotaDatabase(calls, { profileRow: profileRow() }),
    logger: { error() {} },
  });

  const out = await run(r.routes["GET /umkm/:id"], {
    accountability: { user: KABKOTA_USER, role: ROLE },
    params: { id: PROFILE_ID },
  });

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.res.body.data.id, PROFILE_ID);
  // Y02 keeps edit available for provinsi + kabkota; archive/restore remain
  // provinsi-only decisions per Y01.
  assert.equal(out.res.body.data.actions.canEdit, true);
  assert.equal(out.res.body.data.actions.canArchive, false);
  assert.equal(out.res.body.data.actions.canRestore, false);
});

test("provinsi keeps full profile actions", async () => {
  const r = router();
  registerRoutes(r, {
    database: { raw: async () => ({ rows: [profileRow({ app_role: "provinsi" })] }) },
    logger: { error() {} },
  });

  const out = await run(r.routes["GET /umkm/:id"], {
    accountability: { user: PROVINSI_USER, role: ROLE },
    params: { id: PROFILE_ID },
  });

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.res.body.data.actions.canEdit, true);
  assert.equal(out.res.body.data.actions.canArchive, true);
  assert.equal(out.res.body.data.actions.canRestore, false);
});

test("pendamping is rejected at the guard before any database access", async () => {
  let calls = 0;
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async () => {
        calls += 1;
      },
    },
    logger: { error() {} },
  });

  const out = await run(r.routes["POST /query"], {
    accountability: { user: "u", role: PENDAMPING_ROLE },
    query: {},
    body: { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama" },
  });

  assert.equal(out.error.statusCode, 403);
  assert.equal(calls, 0);
});

test("kabkota export with more than the budgeted client filters is rejected before a job is queued", async () => {
  const calls = [];
  const r = router();
  registerRoutes(r, { database: kabkotaDatabase(calls), logger: { error() {} } });
  const nine = Array.from({ length: 9 }, (_, index) => ({
    field: "sektor_kbli",
    operator: "eq",
    value: `sector-${index}`,
  }));

  const out = await run(r.routes["POST /exports"], {
    accountability: { user: KABKOTA_USER, role: ROLE },
    query: {},
    body: {
      exportType: "aggregate_pdf",
      config: {
        schemaVersion: 1,
        metric: "jumlah_umkm",
        groupBy: "kota_nama",
        filters: nine,
      },
    },
  });

  assert.equal(out.res.statusCode, 422);
  assert.equal(out.res.body.errors[0].extensions.code, "QUERY_COMPLEXITY");
  assert.equal(
    calls.some(({ sql }) => sql.includes("INSERT INTO analitik_job")),
    false,
  );
});

test("kabkota export at the budget queues the client config and the scope snapshot (K14)", async () => {
  const calls = [];
  const r = router();
  registerRoutes(r, { database: kabkotaDatabase(calls), logger: { error() {} } });
  const eight = Array.from({ length: 8 }, (_, index) => ({
    field: "sektor_kbli",
    operator: "eq",
    value: `sector-${index}`,
  }));

  const out = await run(r.routes["POST /exports"], {
    accountability: { user: KABKOTA_USER, role: ROLE },
    query: {},
    body: {
      exportType: "aggregate_pdf",
      config: {
        schemaVersion: 1,
        metric: "jumlah_umkm",
        groupBy: "kota_nama",
        filters: eight,
      },
    },
  });

  assert.equal(out.res.statusCode, 202);
  const insert = calls.find(({ sql }) =>
    sql.includes("INSERT INTO analitik_job"),
  );
  assert.ok(insert, "a job must be queued when the client config fits the budget");
  const stored = JSON.parse(insert.params[3]);
  // Config klien disimpan apa adanya; worker menambah kota paksa dari snapshot scope
  // dengan compiler yang sama, sehingga tidak ada filter kota di config tersimpan.
  assert.deepEqual(stored.config.filters, eight);
  assert.equal(stored.permissionScope, "kabkota:7");
});

test("the Lainnya group of a truncated scan carries every remaining group (B29)", async () => {
  __resetBudgetForTests();
  __resetAggregateCacheForTests();
  const calls = [];
  // Lima grup, tetapi scan hanya mengirim limit+1 baris (di sini limit=2): tiga baris pertama.
  const groups = [
    { group_key: "a", group_label: "KAB. A", value: 5, eligible: 5, matched: 15, missing: 0, needs_verification: 0, metric_total: 15 },
    { group_key: "b", group_label: "KAB. B", value: 4, eligible: 4, matched: 15, missing: 0, needs_verification: 0, metric_total: 15 },
    { group_key: "c", group_label: "KAB. C", value: 3, eligible: 3, matched: 15, missing: 0, needs_verification: 0, metric_total: 15 },
  ];
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async (sql) => {
        calls.push({ sql });
        if (sql.includes("directus_users"))
          return { rows: [{ id: PROVINSI_USER, app_role: "provinsi", kota: null, kota_nama: null, kota_scope: null, usaha: null, usaha_nama: null, usaha_nib: null }] };
        if (sql.includes("FROM analitik_active_generation"))
          return { rows: [{ id: "generation-1", status: "active", data_as_of: "2026-09-26T00:00:00Z", reconciled_at: "2026-09-26T01:00:00Z", row_count: 15, active_row_count: 15, archived_row_count: 0 }] };
        if (sql.includes("FROM analitik_field"))
          return {
            rows: [
              { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
              { id: "city", semantic_id: "kota_nama", lifecycle_status: "active", semantic_role: "dimension" },
              { id: "kota", semantic_id: "kota_id", lifecycle_status: "active", semantic_role: "dimension" },
              { id: "sector", semantic_id: "sektor_kbli", lifecycle_status: "active", semantic_role: "dimension" },
            ],
          };
        if (sql.includes("group_key")) return { rows: groups };
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    logger: { error() {} },
  });

  const out = await run(r.routes["POST /query"], {
    accountability: { user: PROVINSI_USER, role: ROLE },
    query: {},
    body: {
      schemaVersion: 1,
      metric: "jumlah_umkm",
      groupBy: "kota_nama",
      limit: 2,
      filters: [{ field: "sektor_kbli", operator: "eq", value: "A" }],
    },
  });

  assert.equal(out.error, undefined);
  assert.equal(out.res.statusCode, 200, JSON.stringify(out.res.body));
  assert.deepEqual(
    out.res.body.data.groups.map((group) => [group.key, group.value]),
    [["a", 5], ["b", 4], ["others", 6]],
  );
  assert.equal(out.res.body.data.groups.at(-1).share, 40);
  assert.equal(out.res.body.data.total, 15);
  assert.equal(out.res.body.data.conservedTotal, true);
});

test("an unsafe export config is a 400, not a 500 (B30)", async () => {
  const calls = [];
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async (sql) => {
        calls.push({ sql });
        return {
          rows: [
            {
              id: PROVINSI_USER,
              app_role: "provinsi",
              kota: null,
              kota_nama: null,
              kota_scope: null,
              usaha: null,
              usaha_nama: null,
              usaha_nib: null,
            },
          ],
        };
      },
    },
    logger: { error() {} },
  });

  const out = await run(r.routes["POST /exports"], {
    accountability: { user: PROVINSI_USER, role: ROLE },
    query: {},
    body: {
      exportType: "aggregate_pdf",
      config: {
        schemaVersion: 1,
        metric: "jumlah_umkm",
        groupBy: "kota_nama",
        // NIK mentah tidak boleh masuk config ekspor; assertSafeAnalysisConfig menolaknya.
        filters: [{ field: "nik", operator: "eq", value: "3273012345678901" }],
      },
    },
  });

  assert.equal(out.res.statusCode, 400, JSON.stringify(out.res.body ?? out.error));
  assert.equal(out.res.body.errors[0].extensions.code, "INVALID_ANALYSIS_CONFIG");
  assert.equal(
    calls.some(({ sql }) => sql.includes("INSERT INTO analitik_job")),
    false,
  );
});

test("GET /metadata, /templates, /status publik tanpa sesi (DAFTAR_PUBLIK)", async () => {
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async (sql) => {
        if (sql.includes("analitik_field"))
          return {
            rows: [
              {
                id: "field",
                semantic_id: "kota_nama",
                label: "Kota",
                field_group: "analytics",
                sort_order: 1,
                semantic_role: "dimension",
                data_type: "text",
                lifecycle_status: "active",
                privacy_class: "aggregate",
                aggregation_capabilities: ["group"],
                schema_version: 1,
              },
            ],
          };
        if (sql.includes("analitik_active_generation"))
          return { rows: [] };
        return { rows: [] };
      },
    },
    logger: { error() {} },
  });
  for (const path of ["GET /metadata", "GET /templates", "GET /status"]) {
    const out = await run(r.routes[path], { query: {}, body: {} });
    assert.equal(out.error, undefined, path);
    assert.ok(out.res.body, path);
  }
});

test("kesepuluh route analysis bertanda cakupan (01)", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const cakupan = require("../../../analytics-shared/cakupan.cjs");
  const tercatat = [];
  const rec = {
    get: (path, handler) => tercatat.push({ method: "GET", path, handler }),
    post: (path, handler) => tercatat.push({ method: "POST", path, handler }),
  };
  registerRoutes(rec, {
    database: { raw: async () => ({ rows: [] }) },
    logger: { error() {} },
  });
  const kunci = (m, p) => `${m} ${p}`;
  const peta = new Map(tercatat.map((item) => [kunci(item.method, item.path), item.handler]));
  // 10 route: 3 publik (DAFTAR_PUBLIK) + 7 terjaga DATA provinsi/kabkota.
  const ekspektasi = [
    ["GET", "/metadata", "publik", []],
    ["GET", "/metadata/options", "terjaga", ["provinsi", "kabkota"]],
    ["GET", "/templates", "publik", []],
    ["GET", "/status", "publik", []],
    ["POST", "/query", "terjaga", ["provinsi", "kabkota"]],
    ["POST", "/records", "terjaga", ["provinsi", "kabkota"]],
    ["GET", "/umkm/:id", "terjaga", ["provinsi", "kabkota"]],
    ["POST", "/exports", "terjaga", ["provinsi", "kabkota"]],
    ["GET", "/exports/:jobId", "terjaga", ["provinsi", "kabkota"]],
    ["GET", "/exports/:jobId/download", "terjaga", ["provinsi", "kabkota"]],
  ];
  assert.equal(tercatat.length, 10, `tercatat ${tercatat.length} route`);
  for (const [method, path, jenis, peran] of ekspektasi) {
    const handler = peta.get(kunci(method, path));
    assert.ok(handler, `route ${method} ${path} terdaftar`);
    const tanda = cakupan.tandaCakupan(handler);
    assert.equal(tanda?.jenis, jenis, `${method} ${path}`);
    if (jenis === "terjaga") {
      assert.deepEqual([...tanda.peran].sort(), [...peran].sort(), `${method} ${path}`);
    }
  }
});
