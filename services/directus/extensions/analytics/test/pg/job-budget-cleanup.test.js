import assert from "node:assert/strict";
import test from "node:test";
import * as migrasi from "../../../../migrations/20260928E-batalkan-job-export-lama.js";
import { pgSkipReason, withDatabase } from "../../../../test-support/pg-harness.mjs";

/** Config ekspor agregat seperti yang disimpan sebelum perbaikan budget (B02). */
const requestDenganFilter = (jumlah) => ({
  config: {
    schemaVersion: 1,
    metric: "count_distinct_usaha",
    groupBy: "kota_nama",
    filters: Array.from({ length: jumlah }, (_, i) => ({ fieldId: `field_${i}`, operator: "eq", value: "x" })),
  },
});

const buatJob = async (db, { dedupe, status = "queued", filterCount = 2 }) => {
  const [row] = await db("analitik_job")
    .insert({
      job_type: "export",
      dedupe_key: dedupe,
      status,
      export_type: "aggregate_pdf",
      request: JSON.stringify(requestDenganFilter(filterCount)),
    })
    .returning("id");
  return row.id;
};

test("migrasi 20260928E membatalkan job ekspor lama yang melebihi budget filter (B02c)", { skip: pgSkipReason() }, async (t) => {
  const { db } = await withDatabase(t);

  // Job kabkota lama: 8 filter pengguna + filter `kota_id` dari scope = 9 filter tersimpan.
  const lampaui = await buatJob(db, { dedupe: "legacy:kabkota", filterCount: 9 });
  const normal = await buatJob(db, { dedupe: "normal:2", filterCount: 2 });
  const selesai = await buatJob(db, { dedupe: "legacy:selesai", status: "completed", filterCount: 9 });

  await migrasi.up(db);

  const dibatalkan = await db("analitik_job").where({ id: lampaui }).first();
  assert.equal(dibatalkan.status, "cancelled");
  assert.equal(dibatalkan.error_code, "EXPORT_BUDGET");
  assert.equal((await db("analitik_job").where({ id: normal }).first()).status, "queued");
  assert.equal((await db("analitik_job").where({ id: selesai }).first()).status, "completed");

  // Trigger PII tetap aktif sesudah migrasi.
  const { rows } = await db.raw("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_analitik_job_request'");
  assert.equal(rows[0]?.tgenabled, "O");
  await assert.rejects(
    db("analitik_job").insert({ job_type: "export", dedupe_key: "pii:baru", status: "queued", request: JSON.stringify({ note: "nik" }) }),
    /restricted data/,
  );

  await migrasi.down(db);

  const dipulihkan = await db("analitik_job").where({ id: lampaui }).first();
  assert.equal(dipulihkan.status, "queued");
  assert.equal(dipulihkan.error_code, null);
  assert.equal((await db("analitik_job").where({ id: normal }).first()).status, "queued");
});
