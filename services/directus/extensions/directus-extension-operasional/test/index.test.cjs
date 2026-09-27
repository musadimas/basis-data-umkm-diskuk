"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../src/index.js");

// Seluruh pengguna operasional memakai satu UUID role Directus; peran sebenarnya ada di
// kolom directus_users.app_role dan ditegakkan resolveOperator, bukan routeGuard.
const APPLICATION_ROLE = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const OPERATOR_USER = "22222222-2222-4222-8222-000000000001";

function operatorRow(overrides = {}) {
  return {
    id: OPERATOR_USER,
    app_role: "kabkota",
    email: "operator@dummy.test",
    first_name: "Ope",
    last_name: "Rator",
    avatar: null,
    kota: 1,
    kota_nama: "BOGOR",
    usaha: null,
    usaha_nama: null,
    usaha_nib: null,
    ...overrides,
  };
}

function router() {
  const routes = {};
  return {
    routes,
    get: (p, h) => {
      routes[`GET ${p}`] = h;
    },
    post: (p, h) => {
      routes[`POST ${p}`] = h;
    },
    patch: (p, h) => {
      routes[`PATCH ${p}`] = h;
    },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
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

async function run(handler, req) {
  const res = response();
  let error;
  handler(req, res, (e) => {
    error = e;
  });
  for (let i = 0; i < 50 && !res.body && !error; i++) {
    await new Promise((r) => setImmediate(r));
  }
  return { res, error };
}

function mount(dbRaw) {
  const r = router();
  extension.handler(
    r,
    {
      database: {
        raw: dbRaw ?? (async () => ({ rows: [] })),
        transaction: async (fn) => fn({ raw: dbRaw ?? (async () => ({ rows: [] })) }),
      },
      logger: { error() {} },
      services: {},
      getSchema: async () => ({}),
    },
  );
  return r;
}

test("semua route operasional menolak anonim dan role asing sebelum DB", async () => {
  let calls = 0;
  const r = mount(async () => {
    calls++;
    return { rows: [] };
  });
  const paths = [
    ["GET", "/me"],
    ["GET", "/aktivitas"],
    ["POST", "/internal/resolve-nib"],
    ["GET", "/usaha/:id"],
    ["PATCH", "/usaha/:id"],
    ["POST", "/usaha/:id/verifikasi"],
  ];
  for (const [method, path] of paths) {
    const anon = await run(r.routes[`${method} ${path}`], { query: {}, body: {}, headers: {} });
    assert.equal(anon.error?.statusCode ?? anon.res.statusCode, 401, `${method} ${path} anonim`);
    const asing = await run(r.routes[`${method} ${path}`], {
      accountability: { user: "u", role: "role-asing" },
      query: {},
      body: {},
      headers: {},
    });
    assert.equal(asing.error?.statusCode ?? asing.res.statusCode, 403, `${method} ${path} asing`);
  }
  assert.equal(calls, 0);
});

test("/me melayani peran self-scoped tanpa menuntut penugasan", async () => {
  const r = mount(async (sql) => {
    if (sql.includes("FROM directus_users u")) {
      return { rows: [operatorRow({ app_role: "umkm", kota: null, kota_nama: null, usaha: null, usaha_nama: null })] };
    }
    return { rows: [] };
  });
  const out = await run(r.routes["GET /me"], {
    accountability: { user: OPERATOR_USER, role: APPLICATION_ROLE },
    query: {},
    body: {},
    headers: {},
    params: {},
  });
  assert.equal(out.res.statusCode, 200, "umkm harus bisa membaca identitasnya sendiri");
  assert.equal(out.res.body.data.role, "umkm");
  assert.equal(out.res.body.data.kota, null);
  assert.equal(out.res.body.data.usaha, null);
});

test("pendamping ke endpoint data lapangan → 403 dari gerbang app_role tanpa menyentuh domain", async () => {
  const queries = [];
  const r = mount(async (sql) => {
    queries.push(sql);
    if (sql.includes("FROM directus_users u")) {
      return { rows: [operatorRow({ app_role: "pendamping" })] };
    }
    throw new Error("domain tidak boleh tersentuh");
  });
  const out = await run(r.routes["GET /usaha/:id"], {
    accountability: { user: OPERATOR_USER, role: APPLICATION_ROLE },
    query: {},
    body: {},
    headers: {},
    params: { id: "33333333-3333-4333-8333-000000000001" },
  });
  assert.equal(out.res.statusCode, 403);
  assert.equal(out.res.body.errors[0].extensions.code, "FORBIDDEN");
  assert.equal(queries.length, 1, "hanya query resolusi operator yang dijalankan");
});

test("kabkota lolos gerbang route data (roles default DATA_ROLES)", async () => {
  const queries = [];
  const r = mount(async (sql) => {
    queries.push(sql);
    if (sql.includes("FROM directus_users u")) return { rows: [operatorRow()] };
    throw new Error("berhenti tepat setelah gerbang");
  });
  const out = await run(r.routes["GET /usaha/:id"], {
    accountability: { user: OPERATOR_USER, role: APPLICATION_ROLE },
    query: {},
    body: {},
    headers: {},
    params: { id: "33333333-3333-4333-8333-000000000001" },
  });
  assert.notEqual(out.res.statusCode, 403, "kabkota bukan peran yang ditolak route data");
  assert.ok(queries.length > 1, "domain query dijalankan setelah gerbang roles lolos");
});
