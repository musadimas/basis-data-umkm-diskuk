import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanupExpiredTabularExports } from "../../src/endpoints/tabular/index.js";
import { buatUser } from "../../../../test-support/fixtures.mjs";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

test("cleanup menghapus artefak ekspor Tabular yang kedaluwarsa", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);
  const owner = (await buatUser(db, { appRole: "provinsi" })).id;
  const root = await mkdtemp(path.join(tmpdir(), "diskuk-tabular-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const tulis = async (dedupe, expiresAt) => {
    const key = `tabular-exports/${owner}/${dedupe}.csv`;
    await mkdir(path.dirname(path.join(root, key)), { recursive: true });
    await writeFile(path.join(root, key), "a,b\r\n");
    const [row] = await db("analitik_job")
      .insert({
        job_type: "export",
        dedupe_key: dedupe,
        status: "completed",
        owner,
        export_type: "tabular_csv",
        request: JSON.stringify({ artifact: { key, rowCount: 1, expiresAt } }),
      })
      .returning("id");
    return { key, id: row.id };
  };

  const kedaluwarsa = await tulis("tabular:expired", new Date(Date.now() - 60_000).toISOString());
  const segar = await tulis("tabular:fresh", new Date(Date.now() + 60 * 60 * 1000).toISOString());

  const jumlah = await cleanupExpiredTabularExports(db, { root });
  assert.equal(jumlah, 1);
  await assert.rejects(readFile(path.join(root, kedaluwarsa.key)), /ENOENT/);
  const row = await db("analitik_job").where({ id: kedaluwarsa.id }).first();
  assert.equal(row.status, "expired");
  assert.equal(row.request.artifact, undefined);
  const masih = await db("analitik_job").where({ id: segar.id }).first();
  assert.equal(masih.status, "completed");
  assert.ok(masih.request.artifact, "artefak yang belum kedaluwarsa tidak disentuh");
});
