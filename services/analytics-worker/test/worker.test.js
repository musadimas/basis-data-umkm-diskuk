import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { RETRY_DELAYS_SECONDS, retryDelaySeconds } from "../src/queue.js";
import { sanitize } from "../src/logger.js";
import { safeProjection } from "../src/projector.js";
import { sourceFixture } from "./fixtures.js";

test("worker config requires a dedicated database URL and bounds settings", () => { assert.throws(() => loadConfig({}), /ANALYTICS_DATABASE_URL/); const cfg=loadConfig({ ANALYTICS_DATABASE_URL:"postgres://worker@localhost/db" }); assert.equal(cfg.concurrency,2); assert.equal(cfg.batchSize,25); });
test("retry schedule is bounded with jitter", () => { assert.deepEqual(RETRY_DELAYS_SECONDS,[10,30,120,300,900]); assert.equal(retryDelaySeconds(1,0),10); assert.equal(retryDelaySeconds(5,0.25),1125); assert.equal(retryDelaySeconds(99,0),900); });
test("logger sanitizer removes credentials, PII, request bodies and stacks", () => { assert.deepEqual(sanitize({ password:"secret", nik:"3273010101011234", body:{ raw:"x" }, safe:"ok" }), { safe:"ok" }); });
test("projection masks source PII and leaves unknown fields explicit", () => { const row=safeProjection(sourceFixture,new Date("2026-08-17T00:00:00Z"),[{code:"G",division_start:45,division_end:47}]); assert.equal(row.owner.maskedNik,"************1234"); assert.equal(row.owner.maskedPhone,"08******7890"); assert.equal(row.sektor_kbli,"G"); assert.equal(JSON.stringify(row).includes("3273010101011234"),false); });
test("source projector uses fixed SQL and no raw source payload", async () => { const source = await import("../src/projector.js"); assert.match(source.SOURCE_SQL,/WHERE u\.id=\$1/); assert.doesNotMatch(source.SOURCE_SQL,/SELECT \* FROM/); });

import { aggregateCsv, csvCell } from "../src/exporter.js";
import { renderPng, renderPdf } from "../src/export-renderer.js";
test("export CSV neutralizes spreadsheet formulas and has Indonesian BOM",()=>{const csv=aggregateCsv({groups:[{label:"=FORMULA",value:1,share:100}],meta:{dataAsOf:"2026-08-17T00:00:00Z"}});assert.equal(csv.charCodeAt(0),0xfeff);assert.match(csv,/'=FORMULA/);assert.equal(csvCell("a,b"),"\"a,b\"");});
test("renderers emit parseable artifact signatures and semantic text",()=>{const png=renderPng();assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");const pdf=renderPdf({title:"Sebaran UMKM",lines:["Bogor: 4"]});assert.equal(pdf.subarray(0,8).toString(),"%PDF-1.4");assert.match(pdf.toString(),/Sebaran UMKM/);});
