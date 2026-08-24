import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { RETRY_DELAYS_SECONDS, isNonRetryableError, retryDelaySeconds } from "../src/queue.js";
import { sanitize } from "../src/logger.js";
import { safeProjection } from "../src/projector.js";
import { sourceFixture } from "./fixtures.js";

test("worker config requires a dedicated database URL and bounds settings", () => { assert.throws(() => loadConfig({}), /ANALYTICS_DATABASE_URL/); const cfg=loadConfig({ ANALYTICS_DATABASE_URL:"postgres://worker@localhost/db" }); assert.equal(cfg.concurrency,2); assert.equal(cfg.batchSize,25); });
test("retry schedule is bounded with jitter", () => { assert.deepEqual(RETRY_DELAYS_SECONDS,[10,30,120,300,900]); assert.equal(retryDelaySeconds(1,0),10); assert.equal(retryDelaySeconds(5,0.25),1125); assert.equal(retryDelaySeconds(99,0),900); });
test("disk exhaustion is terminal so retries cannot duplicate full projections", () => { assert.equal(isNonRetryableError({code:"53100"}),true); assert.equal(isNonRetryableError({code:"ENOSPC"}),true); assert.equal(isNonRetryableError({code:"40001"}),false); });
test("daily reconcile checks the active generation without starting a full rebuild", async () => { const source=await readFile(new URL("../src/index.js",import.meta.url),"utf8");assert.match(source,/job\.job_type === "reconcile"\) await reconcileActiveGeneration/);assert.doesNotMatch(source,/job\.job_type === "rebuild_current_model" \|\| job\.job_type === "reconcile"/); });
test("logger sanitizer removes credentials, PII, request bodies and stacks", () => { assert.deepEqual(sanitize({ password:"secret", nik:"3273010101011234", body:{ raw:"x" }, safe:"ok" }), { safe:"ok" }); });
test("projection masks source PII and leaves unknown fields explicit", () => { const row=safeProjection(sourceFixture,new Date("2026-08-17T00:00:00Z"),[{code:"G",division_start:45,division_end:47}]); assert.equal(row.owner.maskedNik,"************1234"); assert.equal(row.owner.maskedPhone,"08******7890"); assert.equal(row.sektor_kbli,"G"); assert.equal(JSON.stringify(row).includes("3273010101011234"),false); });
test("financial quality keeps zero reported, null missing, and negatives excluded for verification", () => { const zero=safeProjection({...sourceFixture,omzet_tahunan:0,total_aset:null}); assert.equal(zero.omzet_quality,"reported");assert.equal(zero.aset_quality,"missing");const invalid=safeProjection({...sourceFixture,omzet_tahunan:-1,total_aset:-2});assert.equal(invalid.omzet_quality,"needs_verification");assert.equal(invalid.aset_quality,"needs_verification"); });
test("source projector uses fixed SQL and no raw source payload", async () => { const source = await import("../src/projector.js"); assert.match(source.SOURCE_SQL,/WHERE u\.id=\$1/); assert.doesNotMatch(source.SOURCE_SQL,/SELECT \* FROM/); });

import { aggregateCsv, csvCell, queryAggregate } from "../src/exporter.js";
import { renderPng, renderPdf } from "../src/export-renderer.js";
import { DIM_AGGREGATE_SQL, SCALE_DIM_AGGREGATE_SQL, generationPartitionName } from "../src/rebuild.js";
test("generation partition names are deterministic and reject unsafe input",()=>{assert.equal(generationPartitionName("4afa7fd5-13f2-40da-8a3f-988fc232210b"),"analitik_usaha_g_4afa7fd5_13f2_40da_8a3f_988fc232210b");assert.throws(()=>generationPartitionName('bad\";DROP TABLE usaha;--'),/INVALID_GENERATION_ID/);});
test("dimension rollup covers every compiler dimension and stays scoped to one generation", () => {
  const dimensions = [...DIM_AGGREGATE_SQL.matchAll(/SELECT '([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(dimensions, ["kota_id","kota_kode","kota_nama","kecamatan_id","kecamatan_nama","kelurahan_id","kelurahan_nama","sektor_kbli","kbli_kode","skala_dilaporkan","status_hukum","status_usaha","quality_geography","quality_kbli"]);
  const scoped = DIM_AGGREGATE_SQL.match(/WHERE a\.generation_id=\$1/g)?.length ?? 0;
  assert.equal(scoped, 14); // every UNION ALL branch is generation-scoped
  assert.match(DIM_AGGREGATE_SQL, /ON CONFLICT \(generation_id,dimension,dimension_value,status\)/);
  assert.match(DIM_AGGREGATE_SQL, /SUM\(a\.omzet_tahunan\).*omzet_quality='reported'/s);
  assert.match(DIM_AGGREGATE_SQL, /omzet_missing=EXCLUDED\.omzet_missing/);
  assert.match(DIM_AGGREGATE_SQL, /aset_needs_verification=EXCLUDED\.aset_needs_verification/);
  const scaleDimensions = [...SCALE_DIM_AGGREGATE_SQL.matchAll(/:([a-z_]+)' AS dimension/g)].map((match) => match[1]);
  assert.deepEqual(scaleDimensions, dimensions);
  assert.equal(SCALE_DIM_AGGREGATE_SQL.match(/WHERE a\.generation_id=\$1/g)?.length ?? 0, 14);
});
test("export CSV neutralizes spreadsheet formulas and has Indonesian BOM",()=>{const csv=aggregateCsv({groups:[{label:"=FORMULA",value:1,share:100}],meta:{dataAsOf:"2026-08-17T00:00:00Z"}});assert.equal(csv.charCodeAt(0),0xfeff);assert.match(csv,/'=FORMULA/);assert.equal(csvCell("a,b"),"\"a,b\"");});
test("financial aggregate export uses SUM values and explicit missing coverage",async()=>{const calls=[];const client={async query(sql){calls.push(sql);if(sql.includes("SELECT * FROM (SELECT"))return{rows:[{group_key:"Bogor",group_label:"Bogor",value:"1500000",eligible:2}]};if(sql.includes("SELECT COUNT(*)::integer AS total"))return{rows:[{total:3,matched:2,missing:1,needs_verification:0,metric_total:"1500000"}]};if(sql.includes("SELECT data_as_of"))return{rows:[{data_as_of:"2026-08-24T00:00:00Z"}]};throw new Error(sql)}};const result=await queryAggregate(client,{metric:"omzet_tahunan",groupBy:"kota_nama",filters:[]},"11111111-1111-4111-8111-111111111111");assert.equal(result.data.total,1500000);assert.equal(result.data.metric.unit,"IDR");assert.deepEqual(result.meta.coverage,{matched:2,total:3,missing:1,needsVerification:0,unknown:0});assert.match(calls[0],/SUM\(a\.omzet_tahunan\).*reported/s);});
test("renderers emit parseable artifact signatures and semantic text",()=>{const png=renderPng();assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");const pdf=renderPdf({title:"Sebaran UMKM",lines:["Bogor: 4"]});assert.equal(pdf.subarray(0,8).toString(),"%PDF-1.4");assert.match(pdf.toString(),/Sebaran UMKM/);});
test("disk watchdog classifies free-space thresholds and fails open on probe errors", async () => { const { inspectDiskUsage } = await import("../src/watchdog.js"); assert.equal((await inspectDiskUsage({ dataDir: "./", minFreePercent: 1, criticalPercent: 0.5 })).status, "healthy"); await assert.rejects(() => inspectDiskUsage({ dataDir: "/nonexistent-path-xyz" })); });
