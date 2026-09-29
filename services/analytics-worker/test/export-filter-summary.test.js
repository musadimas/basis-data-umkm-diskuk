import assert from "node:assert/strict";
import test from "node:test";
import { ringkasanFilter } from "../src/exporter.js";
import { queryAgg } from "./fixtures.js";
import { renderAggregate, renderAggregatePptx } from "../src/export-renderer.js";
import { rebuildCurrentModel } from "../src/rebuild.js";

test("ringkasanFilter mencantumkan filter dan cakupan wilayah operator", () => {
  const config = { filters: [{ fieldId: "skala_dilaporkan", operator: "eq", value: "micro" }] };
  assert.equal(
    ringkasanFilter(config, { role: "provinsi", kotaId: null }),
    `Filter: skala dilaporkan = micro | Cakupan: Provinsi Jawa Barat`,
  );
  const klien = { filters: [{ fieldId: "kota_nama", operator: "eq", value: "Kabupaten Sumedang" }] };
  assert.doesNotMatch(ringkasanFilter(klien, { role: "kabkota", kotaId: 1 }), /Sumedang/);
  assert.match(ringkasanFilter(klien, { role: "provinsi", kotaId: null }), /Sumedang/);
  assert.match(ringkasanFilter({ filters: [] }, { role: "kabkota", kotaId: 7 }), /tanpa filter \| Cakupan: kabupaten\/kota ID 7/);
});

test("queryAggregate memberi dataAsOf ISO dan ringkasan filter di meta", async () => {
  const client = {
    async query(sql) {
      if (sql.includes("SELECT * FROM (SELECT")) return { rows: [] };
      if (sql.includes("FROM analitik_usaha_current a"))
        return { rows: [{ total: 0, matched: 0, missing: 0, needs_verification: 0, metric_total: 0 }] };
      if (sql.includes("SELECT data_as_of")) return { rows: [{ data_as_of: new Date("2026-09-28T19:31:08.000Z") }] };
      throw new Error(sql);
    },
  };
  const result = await queryAgg(client, { metric: "jumlah_umkm", groupBy: "kota_nama", filters: [] }, "g1", {
    operator: { role: "kabkota", kotaId: 1 },
  });
  assert.equal(result.meta.dataAsOf, "2026-09-28T19:31:08.000Z");
  assert.match(result.meta.filterSummary, /kabupaten\/kota ID 1/);
});

test("PDF, PNG dan PPTX memuat ringkasan filter", async () => {
  const meta = { dataAsOf: "2026-09-28T19:31:08.000Z", filterSummary: "Filter: X = 1 | Cakupan: Provinsi Jawa Barat" };
  const groups = [{ label: "A", value: 3, share: 100 }];
  const out = renderAggregate({ title: "T", groups, meta });
  assert.match(out.pdf.toString("latin1"), /Filter: X = 1/);
  assert.notDeepEqual(out.png, renderAggregate({ title: "T", groups, meta: { ...meta, filterSummary: "" } }).png);
  const pptx = await renderAggregatePptx({ judul: "T", dataAsOf: meta.dataAsOf, filterSummary: meta.filterSummary, groups });
  assert.ok(pptx.length > 1000);
});

test("rebuildCurrentModel melempar REBUILD_LOCKED, bukan lolos diam-diam", async () => {
  const pool = { query: async () => ({ rows: [{ locked: false }] }) };
  await assert.rejects(rebuildCurrentModel(pool, {}), { code: "REBUILD_LOCKED" });
});

test("PDF profil mencetak nilai teks tanpa persen", () => {
  const out = renderAggregate({
    title: "Profil",
    groups: [{ label: "Skala", value: "small", share: 0 }, { label: "Jumlah", value: 4, share: 50 }],
    meta: { dataAsOf: "2026-09-28T19:31:08.000Z" },
  });
  const teks = out.pdf.toString("latin1");
  assert.match(teks, /Skala: small/);
  assert.doesNotMatch(teks, /small \\?\(0%/);
  assert.match(teks, /Jumlah: 4 \\?\(50%/);
});

test("workerId default memuat hostname supaya replika berbeda tidak berbagi lease", async () => {
  const os = await import("node:os");
  const { JobQueue } = await import("../src/queue.js");
  assert.match(new JobQueue({}).workerId, new RegExp(`^worker-${os.hostname()}-\\d+$`));
});
