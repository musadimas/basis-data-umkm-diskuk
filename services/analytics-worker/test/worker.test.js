import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import {
  RETRY_DELAYS_SECONDS,
  isNonRetryableError,
  retryDelaySeconds,
} from "../src/queue.js";
import { sanitize } from "../src/logger.js";
import { safeProjection } from "../src/projector.js";
import { sourceFixture } from "./fixtures.js";

test("worker config requires a dedicated database URL and bounds settings", () => {
  assert.throws(() => loadConfig({}), /ANALYTICS_DATABASE_URL/);
  const cfg = loadConfig({
    ANALYTICS_DATABASE_URL: "postgres://worker@localhost/db",
  });
  assert.equal(cfg.concurrency, 2);
  assert.equal(cfg.batchSize, 25);
});
test("retry schedule is bounded with jitter", () => {
  assert.deepEqual(RETRY_DELAYS_SECONDS, [10, 30, 120, 300, 900]);
  assert.equal(retryDelaySeconds(1, 0), 10);
  assert.equal(retryDelaySeconds(5, 0.25), 1125);
  assert.equal(retryDelaySeconds(99, 0), 900);
});
test("disk exhaustion is terminal so retries cannot duplicate full projections", () => {
  assert.equal(isNonRetryableError({ code: "53100" }), true);
  assert.equal(isNonRetryableError({ code: "ENOSPC" }), true);
  assert.equal(isNonRetryableError({ code: "40001" }), false);
});
test("daily reconcile checks the active generation without starting a full rebuild", async () => {
  const source = await readFile(
    new URL("../src/index.js", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /job\.job_type === "reconcile"\)\s+await reconcileActiveGeneration/,
  );
  assert.doesNotMatch(
    source,
    /job\.job_type === "rebuild_current_model" \|\| job\.job_type === "reconcile"/,
  );
});
test("logger sanitizer removes credentials, PII, request bodies and stacks", () => {
  assert.deepEqual(
    sanitize({
      password: "secret",
      nik: "3273010101011234",
      body: { raw: "x" },
      safe: "ok",
    }),
    { safe: "ok" },
  );
});
test("projection masks source PII and leaves unknown fields explicit", () => {
  const row = safeProjection(sourceFixture, new Date("2026-08-17T00:00:00Z"), [
    { code: "G", division_start: 45, division_end: 47 },
  ]);
  assert.equal(row.owner.maskedNik, "************1234");
  assert.equal(row.owner.maskedPhone, "08******7890");
  assert.equal(row.sektor_kbli, "G");
  assert.equal(JSON.stringify(row).includes("3273010101011234"), false);
});
test("financial quality keeps zero reported, null missing, and negatives excluded for verification", () => {
  const zero = safeProjection({
    ...sourceFixture,
    omzet_tahunan: 0,
    total_aset: null,
  });
  assert.equal(zero.omzet_quality, "reported");
  assert.equal(zero.aset_quality, "missing");
  const invalid = safeProjection({
    ...sourceFixture,
    omzet_tahunan: -1,
    total_aset: -2,
  });
  assert.equal(invalid.omzet_quality, "needs_verification");
  assert.equal(invalid.aset_quality, "needs_verification");
});
test("source projector uses fixed SQL and no raw source payload", async () => {
  const source = await import("../src/projector.js");
  assert.match(source.SOURCE_SQL, /WHERE u\.id=\$1/);
  assert.doesNotMatch(source.SOURCE_SQL, /SELECT \* FROM/);
});

import { csvCell } from "../src/exporter.js";
import { queryAgg } from "./fixtures.js";
import { renderPng, renderPdf } from "../src/export-renderer.js";
import {
  DIM_AGGREGATE_SQL,
  SCALE_DIM_AGGREGATE_SQL,
  generationPartitionName,
} from "../src/rebuild.js";
test("generation partition names are deterministic and reject unsafe input", () => {
  assert.equal(
    generationPartitionName("4afa7fd5-13f2-40da-8a3f-988fc232210b"),
    "analitik_usaha_g_4afa7fd5_13f2_40da_8a3f_988fc232210b",
  );
  assert.throws(
    () => generationPartitionName('bad";DROP TABLE usaha;--'),
    /INVALID_GENERATION_ID/,
  );
});
test("dimension rollup covers every compiler dimension and stays scoped to one generation", () => {
  const dimensions = [...DIM_AGGREGATE_SQL.matchAll(/SELECT '([a-z_]+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(dimensions, [
    "kota_id",
    "kota_kode",
    "kota_nama",
    "kecamatan_id",
    "kecamatan_nama",
    "kelurahan_id",
    "kelurahan_nama",
    "sektor_kbli",
    "kbli_kode",
    "skala_dilaporkan",
    "status_hukum",
    "status_usaha",
    "quality_geography",
    "quality_kbli",
  ]);
  const scoped =
    DIM_AGGREGATE_SQL.match(/WHERE a\.generation_id=\$1/g)?.length ?? 0;
  assert.equal(scoped, 14); // every UNION ALL branch is generation-scoped
  assert.match(
    DIM_AGGREGATE_SQL,
    /ON CONFLICT \(generation_id,dimension,dimension_value,status\)/,
  );
  assert.match(
    DIM_AGGREGATE_SQL,
    /SUM\(a\.omzet_tahunan\).*omzet_quality='reported'/s,
  );
  assert.match(DIM_AGGREGATE_SQL, /omzet_missing=EXCLUDED\.omzet_missing/);
  assert.match(
    DIM_AGGREGATE_SQL,
    /aset_needs_verification=EXCLUDED\.aset_needs_verification/,
  );
  const scaleDimensions = [
    ...SCALE_DIM_AGGREGATE_SQL.matchAll(/:([a-z_]+)' AS dimension/g),
  ].map((match) => match[1]);
  assert.deepEqual(scaleDimensions, dimensions);
  assert.equal(
    SCALE_DIM_AGGREGATE_SQL.match(/WHERE a\.generation_id=\$1/g)?.length ?? 0,
    14,
  );
});
test("export CSV neutralizes spreadsheet formulas and quotes separators", () => {
  assert.equal(csvCell("=FORMULA"), "'=FORMULA");
  assert.equal(csvCell("a,b"), '"a,b"');
});
test("financial aggregate export uses SUM values and explicit missing coverage", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("SELECT * FROM (SELECT"))
        return {
          rows: [
            {
              group_key: "Bogor",
              group_label: "Bogor",
              value: "1500000",
              eligible: 2,
            },
          ],
        };
      if (sql.includes("SELECT COUNT(*)::integer AS total"))
        return {
          rows: [
            {
              total: 3,
              matched: 2,
              missing: 1,
              needs_verification: 0,
              metric_total: "1500000",
            },
          ],
        };
      if (sql.includes("SELECT data_as_of"))
        return { rows: [{ data_as_of: "2026-08-24T00:00:00Z" }] };
      throw new Error(sql);
    },
  };
  const result = await queryAgg(
    client,
    { metric: "omzet_tahunan", groupBy: "kota_nama", filters: [] },
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(result.data.total, 1500000);
  assert.equal(result.data.metric.unit, "IDR");
  assert.deepEqual(result.meta.coverage, {
    matched: 2,
    total: 3,
    missing: 1,
    needsVerification: 0,
    unknown: 0,
  });
  assert.match(calls[0], /SUM\(a\.omzet_tahunan\).*reported/s);
});

test("aggregate export rejects more filters than the budget instead of truncating", async () => {
  const nine = Array.from({ length: 9 }, (_, index) => ({
    fieldId: "sektor_kbli",
    operator: "eq",
    value: `sektor-${index}`,
  }));
  await assert.rejects(
    () =>
      queryAgg(
        {
          async query() {
            throw new Error("no query may run for an over-budget config");
          },
        },
        { metric: "jumlah_umkm", groupBy: "kota_nama", filters: nine },
        "11111111-1111-4111-8111-111111111111",
      ),
    (error) => error.code === "INVALID_ANALYSIS_CONFIG",
  );
});

test("aggregate export binds every one of the eight budgeted filters", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT * FROM (SELECT")) return { rows: [] };
      if (sql.includes("FROM analitik_usaha_current a"))
        return {
          rows: [
            {
              total: 0,
              matched: 0,
              missing: 0,
              needs_verification: 0,
              metric_total: 0,
            },
          ],
        };
      if (sql.includes("SELECT data_as_of"))
        return { rows: [{ data_as_of: "2026-08-24T00:00:00Z" }] };
      throw new Error(sql);
    },
  };
  const eight = Array.from({ length: 8 }, (_, index) => ({
    fieldId: "sektor_kbli",
    operator: "eq",
    value: `sektor-${index}`,
  }));
  await queryAgg(
    client,
    { metric: "jumlah_umkm", groupBy: "kota_nama", filters: eight },
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(calls[0].params.length, 9, "generation plus eight filter values");
  assert.equal(
    (calls[0].sql.match(/COALESCE\(a\.sektor_kbli,'unknown'\) = \$/g) || [])
      .length,
    8,
  );
});

test("aggregate export honours an explicit status filter instead of forcing active", async () => {
  const sqlOf = async (filters) => {
    const calls = [];
    const client = {
      async query(sql) {
        calls.push(sql);
        if (sql.includes("SELECT * FROM (SELECT")) return { rows: [] };
        if (sql.includes("FROM analitik_usaha_current a"))
          return {
            rows: [
              {
                total: 0,
                matched: 0,
                missing: 0,
                needs_verification: 0,
                metric_total: 0,
              },
            ],
          };
        if (sql.includes("SELECT data_as_of"))
          return { rows: [{ data_as_of: null }] };
        throw new Error(sql);
      },
    };
    await queryAgg(
      client,
      { metric: "jumlah_umkm", groupBy: "kota_nama", filters },
      "11111111-1111-4111-8111-111111111111",
    );
    return calls[0];
  };

  // B20: ekspor `status_usaha=archived` dulu selalu menghasilkan nol karena worker menambah
  // `a.status='active'` di samping filter klien.
  const archived = await sqlOf([
    { fieldId: "status_usaha", operator: "eq", value: "archived" },
  ]);
  assert.doesNotMatch(archived, /a\.status\s*=\s*'active'/);
  assert.match(archived, /COALESCE\(a\.status,'unknown'\) = \$/);

  const tanpaFilter = await sqlOf([]);
  assert.match(tanpaFilter, /a\.status\s*=\s*'active'/);
});

test("the Lainnya group carries the whole remainder of a truncated scan (B29)", async () => {
  const client = {
    async query(sql) {
      // Lima grup, tetapi scan hanya mengembalikan limit+1 baris (limit=2): tiga baris pertama.
      if (sql.includes("SELECT * FROM (SELECT"))
        return {
          rows: [
            { group_key: "a", group_label: "A", value: 5, eligible: 5, metric_total: 15 },
            { group_key: "b", group_label: "B", value: 4, eligible: 4, metric_total: 15 },
            { group_key: "c", group_label: "C", value: 3, eligible: 3, metric_total: 15 },
          ],
        };
      if (sql.includes("FROM analitik_usaha_current a"))
        return { rows: [{ total: 15, matched: 15, missing: 0, needs_verification: 0, metric_total: 15 }] };
      if (sql.includes("SELECT data_as_of"))
        return { rows: [{ data_as_of: null }] };
      throw new Error(sql);
    },
  };
  const hasil = await queryAgg(
    client,
    { metric: "jumlah_umkm", groupBy: "kota_nama", filters: [], limit: 2 },
    "11111111-1111-4111-8111-111111111111",
  );
  assert.deepEqual(
    hasil.data.groups.map((group) => [group.key, group.value]),
    [["a", 5], ["b", 4], ["others", 6]],
  );
  assert.equal(hasil.data.groups.at(-1).share, 40);
  assert.equal(hasil.data.total, 15);
});

test("renderers emit parseable artifact signatures and semantic text", () => {
  const png = renderPng();
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const pdf = renderPdf({ title: "Sebaran UMKM", lines: ["Bogor: 4"] });
  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(pdf.toString(), /Sebaran UMKM/);
});

test("aggregate PDF keeps every line, wraps long text and stays latin1 (B26)", () => {
  const baris = Array.from({ length: 120 }, (_, index) => `Baris ${index + 1}`);
  const pdf = renderPdf({ title: "Sebaran UMKM Café", lines: baris });
  const latin = pdf.toString("latin1");
  assert.match(latin, /Sebaran UMKM Caf\xe9/);
  assert.doesNotMatch(latin, /Caf\xc3\xa9/, "UTF-8 dua byte menghasilkan mojibake di stream WinAnsi");
  assert.ok(latin.includes("Baris 120"), "baris ke-120 dulu dipotong slice(0, 28)");
  assert.match(latin, /\/Count 3\b/);
  const potongan = [...latin.matchAll(/\(([^()\\]*)\) Tj/g)].map((match) => match[1]);
  assert.deepEqual(potongan.filter((teks) => teks.length > 95), []);

  const kata = Array.from({ length: 40 }, (_, index) => `kata${index}`);
  const dibungkus = renderPdf({ title: "Bungkus", lines: [kata.join(" ")] }).toString("latin1");
  for (const satu of kata) assert.ok(dibungkus.includes(satu), `kata hilang: ${satu}`);
  const headers = [...dibungkus.matchAll(/\/Length (\d+) >>\nstream\n/g)];
  for (const header of headers) {
    const start = header.index + header[0].length;
    const end = dibungkus.indexOf("\nendstream", start);
    assert.equal(Number(header[1]), Buffer.byteLength(dibungkus.slice(start, end), "latin1"));
  }
});

test("disk watchdog classifies free-space thresholds and fails open on probe errors", async () => {
  const { inspectDiskUsage } = await import("../src/watchdog.js");
  assert.equal(
    (
      await inspectDiskUsage({
        dataDir: "./",
        minFreePercent: 1,
        criticalPercent: 0.5,
      })
    ).status,
    "healthy",
  );
  await assert.rejects(() =>
    inspectDiskUsage({ dataDir: "/nonexistent-path-xyz" }),
  );
});
