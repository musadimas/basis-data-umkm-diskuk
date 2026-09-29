import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import registerTabularRoutes from "../../src/endpoints/tabular/index.js";
import { buatKota, buatUsaha, buatUser } from "../../../../test-support/fixtures.mjs";
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
      this.statusCode = c;
      return this;
    },
    json(v) {
      this.body = v;
    },
    end(v) {
      this.body = v;
      this.ended = true;
    },
  };
}

async function run(handler, req) {
  const res = response();
  let error;
  handler(req, res, (e) => {
    error = e;
  });
  // Handler ini benar-benar menulis berkas ke disk; beri waktu event loop untuk I/O.
  for (let i = 0; i < 500 && !res.body && !error; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return { res, error };
}

test("ekspor Tabular menetralkan formula spreadsheet (B09)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const root = await mkdtemp(path.join(tmpdir(), "diskuk-tabular-csv-"));
  const sebelumnya = process.env.TABULAR_EXPORT_DIR;
  process.env.TABULAR_EXPORT_DIR = root;
  t.after(async () => {
    if (sebelumnya === undefined) delete process.env.TABULAR_EXPORT_DIR;
    else process.env.TABULAR_EXPORT_DIR = sebelumnya;
    await rm(root, { recursive: true, force: true });
  });

  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  const user = await buatUser(db, { appRole: "provinsi" });
  await buatUsaha(db, {
    nama: '=HYPERLINK("http://jahat.contoh")',
    kotaId: 7,
    kotaNama: "KABUPATEN SUBANG",
  });

  const r = router();
  registerTabularRoutes(r, { database: db, logger: { error() {}, warn() {} } });
  const out = await run(r.routes["POST /export"], {
    accountability: { user: user.id, role: APPLICATION_ROLE_ID },
    query: {},
    body: {},
    headers: {},
  });
  assert.equal(out.res.statusCode, 202, JSON.stringify(out.res.body ?? out.error ?? {}));

  const key = `tabular-exports/${user.id}/${out.res.body.data.jobId}.csv`;
  const csv = await readFile(path.join(root, key), "utf8");
  assert.match(csv, /'=HYPERLINK/, csv.slice(0, 400));
  assert.doesNotMatch(csv, /,=HYPERLINK/);
});
