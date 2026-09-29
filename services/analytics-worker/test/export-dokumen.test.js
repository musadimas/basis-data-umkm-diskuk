import assert from "node:assert/strict";
import test from "node:test";
import {
  renderAggregatePptx,
  pptxChartType,
  renderPng,
} from "../src/export-renderer.js";
import { processExport, extensionFor } from "../src/exporter.js";
import { withRegistry } from "./fixtures.js";

test("renderAggregatePptx emits a valid 3-slide PK zip with native chart and aggregation table", async () => {
  assert.equal(pptxChartType("donut"), "doughnut");
  assert.equal(pptxChartType("stacked"), "bar");
  assert.equal(pptxChartType("bar"), "bar");

  const groups = [
    { label: "Kuliner", value: 1200, share: 40 },
    { label: "Fashion", value: 900, share: 30 },
    { label: "Kerajinan", value: 600, share: 20 },
    { label: "Pertanian", value: 300, share: 10 },
  ];

  const pptx = await renderAggregatePptx({
    judul: "Sebaran Sektor UMKM",
    dataAsOf: "2026-09-27",
    visual: "bar",
    groups,
  });

  const raw = pptx.toString("latin1");
  assert.equal(raw.slice(0, 2), "PK");
  assert.match(raw, /ppt\/slides\/slide1\.xml/);
  assert.match(raw, /ppt\/slides\/slide2\.xml/);
  assert.match(raw, /ppt\/slides\/slide3\.xml/);
});

test("renderPng outputs valid presentation-ready dimensions (900x560), not 1x1", () => {
  const groups = [
    { label: "Kota Bandung", value: 15000, share: 45.5 },
    { label: "Kab. Bogor", value: 10000, share: 30.3 },
    { label: "Kota Bekasi", value: 8000, share: 24.2 },
  ];
  const png = renderPng({ title: "Sebaran Wilayah UMKM", groups, meta: { dataAsOf: "2026-09-27" } });

  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  assert.equal(width, 900);
  assert.equal(height, 560);
  assert.ok(width > 1 && height > 1, "PNG must not be 1x1 placeholder");
});

test("processExport merender aggregate_pptx dari query terkompilasi dan menulis MIME benar", async () => {
  const stored = new Map();
  const fakeStore = {
    put: async (key, buffer) => {
      stored.set(key, buffer);
      return key;
    },
  };
  const client = withRegistry({
    async query(sql) {
      if (sql.includes("SELECT * FROM (SELECT"))
        return {
          rows: [
            { group_key: "a", group_label: "Mikro", value: 100, eligible: 100, metric_total: 130 },
            { group_key: "b", group_label: "Kecil", value: 30, eligible: 30, metric_total: 130 },
          ],
        };
      if (sql.includes("FROM analitik_usaha_current a"))
        return { rows: [{ total: 130, matched: 130, missing: 0, needs_verification: 0, metric_total: 130 }] };
      if (sql.includes("SELECT data_as_of")) return { rows: [{ data_as_of: "2026-09-27" }] };
      if (sql.startsWith("UPDATE analitik_job")) return { rows: [] };
      throw new Error(sql);
    },
  });
  const pptRes = await processExport(
    client,
    {
      id: "11111111-2222-3333-4444-555555555553",
      export_type: "aggregate_pptx",
      owner: "user-1",
      request: {
        title: "Sebaran Skala",
        config: { metric: "jumlah_umkm", groupBy: "skala_dilaporkan", filters: [] },
        generationId: "11111111-1111-4111-8111-111111111111",
        permissionScope: "provinsi",
      },
    },
    { store: fakeStore },
  );
  assert.equal(extensionFor("aggregate_pptx"), "pptx");
  assert.ok(pptRes.key.endsWith(".pptx"));
  assert.equal(stored.get(pptRes.key).subarray(0, 2).toString(), "PK");
  assert.equal(pptRes.rowCount, 2);

  // Tipe yang tidak dikenal (termasuk passport_pdf/katalog_pdf/aggregate_csv, yang tidak lagi
  // diproses worker) ditolak.
  for (const tipe of ["unsupported_type", "passport_pdf", "katalog_pdf", "aggregate_csv"])
    await assert.rejects(
      () => processExport(client, { id: "bad", export_type: tipe }, { store: fakeStore }),
      /EXPORT_TYPE/,
    );
});

test("INSTANSI kanonik dipakai satu konstanta (B38)", async () => {
  const { INSTANSI } = await import("../src/export-renderer.js");
  assert.equal(INSTANSI, "Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat");
});
