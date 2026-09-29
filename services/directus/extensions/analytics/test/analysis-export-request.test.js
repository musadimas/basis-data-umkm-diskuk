import assert from "node:assert/strict";
import test from "node:test";
import registerRoutes from "../src/endpoints/analysis/index.js";
import { __resetBudgetForTests } from "../src/endpoints/analysis/query-service.js";
import { __resetAggregateCacheForTests } from "../src/endpoints/analysis/aggregate-cache.js";

const ROLE = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";
const PROVINSI_USER = "33333333-3333-4333-8333-333333333333";

function router() {
  const routes = {};
  return {
    routes,
    get: (p, h) => (routes[`GET ${p}`] = h),
    post: (p, h) => (routes[`POST ${p}`] = h),
  };
}

test("detail_csv menyimpan perkiraan baris dengan kunci yang lolos trigger analitik_job", async () => {
  __resetBudgetForTests();
  __resetAggregateCacheForTests();
  const calls = [];
  const r = router();
  registerRoutes(r, {
    database: {
      raw: async (sql, params = []) => {
        calls.push({ sql, params });
        if (sql.includes("directus_users"))
          return { rows: [{ id: PROVINSI_USER, app_role: "provinsi", kota: null, kota_nama: null, kota_scope: null, usaha: null, usaha_nama: null, usaha_nib: null }] };
        if (sql.includes("FROM analitik_active_generation"))
          return { rows: [{ id: "generation-1", status: "active", data_as_of: "2026-09-26T00:00:00Z", row_count: 3, active_row_count: 3, archived_row_count: 0 }] };
        if (sql.includes("FROM analitik_field"))
          return {
            rows: [
              { id: "metric", semantic_id: "jumlah_umkm", lifecycle_status: "active", semantic_role: "metric" },
              { id: "city", semantic_id: "kota_nama", lifecycle_status: "active", semantic_role: "dimension" },
              { id: "kota", semantic_id: "kota_id", lifecycle_status: "active", semantic_role: "dimension" },
            ],
          };
        if (sql.includes("COUNT(*)")) return { rows: [{ count: 3 }] };
        if (sql.includes("INSERT INTO analitik_job")) return { rows: [{ id: "job-1" }] };
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    logger: { error() {} },
  });

  const out = await dispatch(r, "POST /exports", {
    exportType: "detail_csv",
    title: "  Laporan Café  ",
    config: { schemaVersion: 1, metric: "jumlah_umkm", groupBy: "kota_nama", filters: [] },
  });
  assert.equal(out.res.statusCode, 202, JSON.stringify(out.res.body ?? out.error ?? {}));

  const insert = calls.find(({ sql }) => sql.includes("INSERT INTO analitik_job"));
  const tersimpan = JSON.parse(insert.params[3]);
  assert.equal(tersimpan.rowEstimate, 3);
  // Judul dari pemanggil ikut disimpan supaya worker tidak selalu memakai judul default (B26).
  assert.equal(tersimpan.title, "Laporan Café");
  assert.equal(
    Object.keys(tersimpan).some((key) => /rows/i.test(key)),
    false,
    "kunci request ber-`rows` ditolak trigger analitik_job",
  );
});

async function dispatch(r, routeKey, body) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
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
  let error;
  r.routes[routeKey]({ accountability: { user: PROVINSI_USER, role: ROLE }, query: {}, body }, res, (e) => (error = e));
  for (let i = 0; i < 50 && !res.body && !error; i++) await new Promise((resolve) => setImmediate(resolve));
  return { res, error };
}
