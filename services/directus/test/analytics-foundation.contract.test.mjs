import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
const require = createRequire(import.meta.url);
const contracts = require("../analytics-shared/contracts.cjs");
const privacy = require("../analytics-shared/privacy.cjs");
const foundation = await readFile(new URL("../migrations/20260819C-create-analytics-foundation.js", import.meta.url), "utf8");
const seed = await readFile(new URL("../migrations/20260819D-seed-analytics-registry.js", import.meta.url), "utf8");
const financialMetrics = await readFile(new URL("../migrations/20260824A-prepare-financial-analytics-metrics.js", import.meta.url), "utf8");

test("schema v1 contract is bounded and server-owned", () => {
  assert.equal(contracts.SCHEMA_VERSION, 1); assert.equal(contracts.MASKING_VERSION, 1);
  assert.equal(contracts.QUERY_BUDGET.maxFilters, 8); assert.equal(contracts.QUERY_BUDGET.detailExportRows, 50000);
  assert.equal(contracts.KBLI_SECTORS.length, 21); assert.match(foundation, /CREATE TABLE IF NOT EXISTS analitik_job/); assert.match(foundation, /CREATE UNIQUE INDEX IF NOT EXISTS ux_analitik_job_live_dedupe/);
  assert.doesNotMatch(foundation, /raw_nik|raw_phone|birth_date\s+DATE/);
});

test("privacy transforms never return raw owner identifiers", () => {
  assert.equal(privacy.maskNik("3273010101011234"), "************1234"); assert.equal(privacy.maskNik("bad"), "Tersimpan — disembunyikan");
  assert.equal(privacy.maskPhone("+6281234567890"), "08******7890"); assert.equal(privacy.ageBand("1990-01-01", new Date("2026-08-17T00:00:00Z")), "35–44");
  const projected = privacy.projectSafeSource({ id: "u", nama: "Toko", owner: { nik: "3273010101011234", telepon: "081234567890", birth_date: "1990-01-01", nama_lengkap: "Nama" }, extra_fields: { nik: "3273010101011234", safe: "yes" } });
  assert.equal(projected.extraFields.nik, undefined); assert.equal(projected.owner.maskedNik, "************1234"); assert.equal(JSON.stringify(projected).includes("3273010101011234"), false);
});

test("saved config rejects raw PII/result payloads", () => {
  assert.throws(() => contracts.assertSafeAnalysisConfig({ filters: [{ field: "nik" }] }), /Invalid analysis/);
  assert.throws(() => contracts.assertSafeAnalysisConfig({ result: [{ id: "u" }] }), /Invalid analysis/);
  assert.deepEqual(contracts.assertSafeAnalysisConfig({ metric: "jumlah_umkm", groupBy: "kota_nama" }), { metric: "jumlah_umkm", groupBy: "kota_nama" });
});

test("migration includes triggers, promotion guard, and no raw payload column", () => {
  assert.match(foundation, /SECURITY DEFINER/); assert.match(foundation, /analitik_capture_source_change/); assert.match(foundation, /analitik_require_reconciled_generation/); assert.match(foundation, /request JSONB/); assert.doesNotMatch(foundation, /payload\s+JSONB/);
  assert.match(seed, /rebuild_current_model/); assert.match(seed, /quarantined/);
});

test("financial metrics remain quarantined until a reconciled aggregate-only refresh", () => {
  assert.match(financialMetrics, /lifecycle_status='quarantined'/);
  assert.match(financialMetrics, /privacy_class='aggregate'/);
  assert.match(financialMetrics, /null_policy='exclude_and_report'/);
  assert.match(financialMetrics, /SELECT 'reconcile','activate_financial_metrics','queued'/);
  assert.doesNotMatch(financialMetrics, /SELECT 'rebuild_current_model','rebuild_current_model','queued'.*activate_financial_metrics/s);
});
