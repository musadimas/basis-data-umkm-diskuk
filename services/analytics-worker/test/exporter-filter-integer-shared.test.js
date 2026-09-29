import assert from "node:assert/strict";
import test from "node:test";
import { queryAgg } from "./fixtures.js";

async function sqlOf(filters) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT * FROM (SELECT")) return { rows: [] };
      if (sql.includes("FROM analitik_usaha_current a"))
        return {
          rows: [
            { total: 0, matched: 0, missing: 0, needs_verification: 0, metric_total: 0 },
          ],
        };
      if (sql.includes("SELECT data_as_of")) return { rows: [{ data_as_of: null }] };
      throw new Error(sql);
    },
  };
  await queryAgg(
    client,
    { metric: "jumlah_umkm", groupBy: "kota_nama", filters },
    "11111111-1111-4111-8111-111111111111",
  );
  return calls[0];
}

test("filter kota_id sargable dari metadata shared (03-2b)", async () => {
  const sql = await sqlOf([{ fieldId: "kota_id", operator: "eq", value: "7" }]);
  assert.match(sql.sql, /a\.kota_id = \$\d+::integer/);
  assert.doesNotMatch(sql.sql, /COALESCE\(a\.kota_id/);
});

test("filter kota_id unknown menjadi IS NULL (03-2b)", async () => {
  const sql = await sqlOf([{ fieldId: "kota_id", operator: "eq", value: "unknown" }]);
  assert.match(sql.sql, /a\.kota_id IS NULL/);
});

test("filter kota_id menolak contains (03-2b)", async () => {
  await assert.rejects(
    () =>
      queryAgg(
        {
          async query() {
            throw new Error("no query may run for a rejected operator");
          },
        },
        {
          metric: "jumlah_umkm",
          groupBy: "kota_nama",
          filters: [{ fieldId: "kota_id", operator: "contains", value: "7" }],
        },
        "11111111-1111-4111-8111-111111111111",
      ),
    (error) => error.code === "INVALID_ANALYSIS_CONFIG",
  );
});
