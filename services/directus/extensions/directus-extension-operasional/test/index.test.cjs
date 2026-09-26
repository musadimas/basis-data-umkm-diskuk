"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const extension = require("../src/index.js");

const KABKOTA_ROLE = "ade3c009-8725-46ba-a7a0-904eeba89d01";
const PENDAMPING_ROLE = "d824230f-46db-407d-b8ea-fb2ed58c6c4f";

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
    ["GET", "/talenta/prefill/:usahaId"],
    ["POST", "/talenta/skor"],
    ["POST", "/talenta"],
    ["GET", "/talenta"],
    ["GET", "/talenta/:id"],
    ["POST", "/talenta/:id/nominasi"],
    ["POST", "/talenta/:id/tolak"],
    ["POST", "/berita-acara"],
    ["GET", "/berita-acara"],
    ["GET", "/berkas/:fileId"],
    ["GET", "/batch"],
    ["POST", "/batch"],
    ["GET", "/pendamping"],
    ["GET", "/akselerasi/peserta"],
    ["POST", "/talenta/:id/tahap"],
    ["PATCH", "/talenta/:id/program"],
    ["GET", "/usaha-saya"],
    ["GET", "/laporan-saya"],
    ["POST", "/laporan"],
    ["GET", "/binaan"],
    ["GET", "/binaan/antrean"],
    ["GET", "/binaan/:talentaId"],
    ["POST", "/binaan/:talentaId/rekomendasi"],
    ["GET", "/laporan/:id"],
    ["POST", "/laporan/:id/verifikasi"],
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

test("pendamping ke endpoint talenta → 403 tanpa menyentuh domain", async () => {
  let calls = 0;
  const r = mount(async () => {
    calls++;
    return { rows: [] };
  });
  const out = await run(r.routes["GET /talenta"], {
    accountability: { user: "11111111-1111-4111-8111-000000000001", role: PENDAMPING_ROLE },
    query: {},
    body: {},
    headers: {},
    params: {},
  });
  assert.equal(out.error?.statusCode, 403);
  assert.equal(calls, 0);
});

test("kabkota nominasi → 403 dari service", async () => {
  const dbRaw = async (sql) => {
    if (sql.includes("FROM directus_users")) {
      return { rows: [{ id: "u-kab", kota: 1, kota_nama: "Bogor", usaha: null, usaha_nama: null, usaha_nib: null, email: "k@x", first_name: "K", last_name: null, avatar: null }] };
    }
    if (sql.includes("t.*, ko.nama")) {
      return {
        rows: [
          {
            id: "t-1",
            usaha: "u-1",
            kota: 1,
            status: "diajukan",
            kapasitas_produksi_bulanan: "1",
            satuan_kapasitas: "unit",
            kesiapan_halal: false,
            kesiapan_pirt_bpom: false,
            kesiapan_hki: false,
            adopsi_qris: false,
            pencatatan_keuangan_digital: false,
            surat_komitmen: null,
            skor_finansial: "0",
            skor_pasar: "0",
            skor_legalitas: "0",
            skor_sdm: "0",
            skor_total: "0",
            rubrik_versi: 1,
            rekomendasi: "Belum Direkomendasikan",
            date_created: "2026-09-20T00:00:00.000Z",
            berita_acara: null,
          },
        ],
      };
    }
    return { rows: [] };
  };
  const r = mount(dbRaw);
  const out = await run(r.routes["POST /talenta/:id/nominasi"], {
    accountability: { user: "22222222-2222-4222-8222-000000000001", role: KABKOTA_ROLE },
    query: {},
    body: {},
    headers: {},
    params: { id: "33333333-3333-4333-8333-000000000001" },
  });
  assert.equal(out.res.statusCode, 403);
  assert.equal(out.res.body.errors[0].extensions.code, "FORBIDDEN");
  assert.equal(out.res.headers["cache-control"], "private, no-store");
});
