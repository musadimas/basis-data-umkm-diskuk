import assert from "node:assert/strict";
import test from "node:test";
import { createPgPool, createTestDatabase, pgSkipReason } from "../../../directus/test-support/pg-harness.mjs";
import { buatUser } from "../../../directus/test-support/fixtures.mjs";
import { JobQueue } from "../../src/queue.js";

test("klaim worker melewati ekspor Tabular yang diproses endpoint", { skip: pgSkipReason() }, async (t) => {
  const { db, url, drop } = await createTestDatabase();
  const pool = createPgPool(url);
  // Satu hook dengan urutan pasti: tutup pool dulu, baru drop database (DROP ... FORCE
  // memutus koneksi pool dan error hasilnya akan terbaca sebagai kegagalan tes).
  t.after(async () => {
    await pool.end();
    await drop();
  });
  const owner = (await buatUser(db, { appRole: "provinsi" })).id;

  // Baris gaya lama/balapan: `queued` dengan export_type tabular_csv. Endpoint kini menulis
  // barisnya sebagai `processing`, tetapi baris lama tetap tidak boleh diklaim worker (B19).
  await db("analitik_job").insert({
    job_type: "export",
    dedupe_key: "tabular:lama",
    status: "queued",
    owner,
    request: JSON.stringify({}),
    export_type: "tabular_csv",
    max_attempts: 3,
  });
  // Baris yang memang milik worker.
  await db("analitik_job").insert({
    job_type: "export",
    dedupe_key: "agregat:baru",
    status: "queued",
    owner,
    request: JSON.stringify({ config: {} }),
    export_type: "aggregate_pdf",
    max_attempts: 5,
  });

  const queue = new JobQueue(pool, { leaseSeconds: 120, batchSize: 25, workerId: "test-worker" });
  const claimed = await queue.claim(10);
  const kunci = claimed.map((job) => job.dedupe_key);
  assert.equal(claimed.some((job) => job.export_type === "tabular_csv"), false, JSON.stringify(kunci));
  assert.equal(kunci.includes("tabular:lama"), false, JSON.stringify(kunci));
  assert.ok(kunci.includes("agregat:baru"), JSON.stringify(kunci));
});
