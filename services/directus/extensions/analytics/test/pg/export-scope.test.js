import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import registerAnalysisRoutes from "../../src/endpoints/analysis/index.js";
import { signDownload } from "../../src/endpoints/analysis/exports-service.js";
import registerTabularRoutes from "../../src/endpoints/tabular/index.js";
import { buatKota, buatUsaha, buatUser, uuid } from "../../../../test-support/fixtures.mjs";
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
  // Kedua handler benar-benar membaca/menulis berkas; beri waktu event loop untuk I/O.
  for (let i = 0; i < 500 && !res.body && !error; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return { res, error };
}

async function ubahPeran(db, userId, { appRole, kotaScope }) {
  await db("directus_users").where({ id: userId }).update({ app_role: appRole, kota_scope: kotaScope });
}

test("unduhan ekspor Tabular ditolak bila peran atau scope pemanggil berubah (B36)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const root = await mkdtemp(path.join(tmpdir(), "diskuk-tabular-scope-"));
  const sebelumnya = process.env.TABULAR_EXPORT_DIR;
  process.env.TABULAR_EXPORT_DIR = root;
  t.after(async () => {
    if (sebelumnya === undefined) delete process.env.TABULAR_EXPORT_DIR;
    else process.env.TABULAR_EXPORT_DIR = sebelumnya;
    await rm(root, { recursive: true, force: true });
  });

  await buatKota(db, { id: 7, nama: "KABUPATEN SUBANG" });
  await buatKota(db, { id: 9, nama: "KOTA BANDUNG" });
  const user = await buatUser(db, { appRole: "provinsi" });
  await buatUsaha(db, { nama: "Usaha Scope", kotaId: 7, kotaNama: "KABUPATEN SUBANG" });

  const r = router();
  registerTabularRoutes(r, { database: db, logger: { error() {}, warn() {} } });
  const akun = { user: user.id, role: APPLICATION_ROLE_ID };
  // Body seperti yang dikirim web: `max_rows` dan pencarian NIK 16 digit.
  const kirim = await run(r.routes["POST /export"], {
    accountability: akun,
    query: {},
    body: { max_rows: 50000, q: "3273012345678901" },
    headers: {},
  });
  assert.equal(kirim.res.statusCode, 202, JSON.stringify(kirim.res.body ?? kirim.error ?? {}));
  const job = await db("analitik_job").where({ id: kirim.res.body.data.jobId }).first();
  assert.ok(job, "job ekspor tersimpan di analitik_job");
  const url = new URL(kirim.res.body.data.downloadUrl, "http://lokal");
  const unduh = () =>
    run(r.routes["GET /export/:jobId/download"], {
      accountability: akun,
      params: { jobId: kirim.res.body.data.jobId },
      query: { expires: url.searchParams.get("expires"), sig: url.searchParams.get("sig") },
      headers: {},
    });

  const pertama = await unduh();
  assert.equal(pertama.res.statusCode, 200, JSON.stringify(pertama.res.body ?? pertama.error ?? {}));

  // Akun yang sama pindah peran dan wilayah: job lama tidak boleh lagi diunduh.
  await ubahPeran(db, user.id, { appRole: "kabkota", kotaScope: 9 });
  const kedua = await unduh();
  assert.equal(kedua.res.statusCode, 403, JSON.stringify(kedua.res.body ?? kedua.error ?? {}));
});

test("unduhan ekspor analitik ditolak bila peran atau scope pemanggil berubah (B36)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const root = await mkdtemp(path.join(tmpdir(), "diskuk-analytics-scope-"));
  const sebelumnya = process.env.ANALYTICS_EXPORT_DIR;
  process.env.ANALYTICS_EXPORT_DIR = root;
  t.after(async () => {
    if (sebelumnya === undefined) delete process.env.ANALYTICS_EXPORT_DIR;
    else process.env.ANALYTICS_EXPORT_DIR = sebelumnya;
    await rm(root, { recursive: true, force: true });
  });

  const user = await buatUser(db, { appRole: "provinsi" });
  await buatKota(db, { id: 9, nama: "KOTA BANDUNG" });
  const jobId = uuid();
  const expires = Date.now() + 60 * 60 * 1000;
  const key = `exports/${user.id}/${jobId}.pdf`;
  await mkdir(path.join(root, `exports/${user.id}`), { recursive: true });
  await writeFile(path.join(root, key), Buffer.from("%PDF-1.4 uji scope"));
  await db("analitik_job").insert({
    id: jobId,
    job_type: "export",
    dedupe_key: `export:${user.id}:${uuid()}`,
    status: "completed",
    owner: user.id,
    export_type: "aggregate_pdf",
    request: JSON.stringify({
      config: {},
      permissionScope: "provinsi",
      artifact: { key, contentType: "application/pdf", rowCount: 1, expiresAt: new Date(expires).toISOString() },
    }),
  });

  const sig = signDownload(jobId, user.id, expires);
  const r = router();
  registerAnalysisRoutes(r, { database: db, logger: { error() {} } });
  const akun = { user: user.id, role: APPLICATION_ROLE_ID };
  const unduh = () =>
    run(r.routes["GET /exports/:jobId/download"], {
      accountability: akun,
      params: { jobId },
      query: { expires, sig },
      headers: {},
    });

  const pertama = await unduh();
  assert.equal(pertama.res.statusCode, 200, JSON.stringify(pertama.res.body ?? pertama.error ?? {}));

  await ubahPeran(db, user.id, { appRole: "kabkota", kotaScope: 9 });
  const kedua = await unduh();
  assert.equal(kedua.res.statusCode, 403, JSON.stringify(kedua.res.body ?? kedua.error ?? {}));
});
