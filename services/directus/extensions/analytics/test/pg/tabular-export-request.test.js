import assert from "node:assert/strict";
import test from "node:test";
import registerTabularRoutes from "../../src/endpoints/tabular/index.js";
import { buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

const APPLICATION_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";

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
    status(c) {
      return (this.statusCode = c), this;
    },
    json(v) {
      this.body = v;
    },
    end(v) {
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
  for (let i = 0; i < 500 && !res.body && !error; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return { res, error };
}

test("job ekspor Tabular tersimpan dengan ringkasan aman, bukan query mentah (B08 + trigger)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const user = await buatUser(db, { appRole: "provinsi" });
  const r = router();
  registerTabularRoutes(r, { database: db, logger: { error() {}, warn() {} } });

  // Body seperti yang dikirim web: `max_rows` dan pencarian NIK 16 digit.
  const kirim = await run(r.routes["POST /export"], {
    accountability: { user: user.id, role: APPLICATION_ROLE_ID },
    query: {},
    body: { max_rows: 50000, q: "3273012345678901" },
    headers: {},
  });
  assert.equal(kirim.res.statusCode, 202, JSON.stringify(kirim.res.body ?? kirim.error ?? {}));

  // Job harus benar-benar tersimpan: trigger `analitik_job` menolak request yang memuat kata
  // terlarang (`rows`, `nik`, …), dan dulu `maxRows` membuat insert ini gagal diam-diam.
  const job = await db("analitik_job").where({ id: kirim.res.body.data.jobId }).first();
  assert.ok(job, "job ekspor harus tersimpan di analitik_job");
  const tersimpan = JSON.parse(typeof job.request === "string" ? job.request : JSON.stringify(job.request));
  assert.equal(tersimpan.limit, 50000);
  assert.doesNotMatch(JSON.stringify(tersimpan), /\d{16}/, "request job tidak boleh memuat NIK (ADR-004 #10)");
  assert.equal(
    Object.keys(tersimpan).some((key) => /rows/i.test(key)),
    false,
    "kunci ber-`rows` ditolak trigger analitik_job",
  );
});
