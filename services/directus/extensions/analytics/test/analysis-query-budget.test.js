import { withBudgetTransaction } from "../src/endpoints/analysis/query-budget.js";
import contracts from "../../../analytics-shared/contracts.cjs";
import assert from "node:assert/strict";
import test from "node:test";
const { QUERY_BUDGET } = contracts;

test("read budgets are installed before work, using the transaction connection", async () => {
  const calls = [];
  const trx = { raw: async (sql) => { calls.push(sql); } };
  const database = { transaction: async (task) => task(trx) };
  const result = await withBudgetTransaction(database, async (client) => {
    assert.equal(client, trx);
    assert.deepEqual(calls, [
      `SET LOCAL statement_timeout = '${QUERY_BUDGET.statementTimeoutMs}ms'`,
      `SET LOCAL lock_timeout = '${QUERY_BUDGET.lockTimeoutMs}ms'`,
      "SET TRANSACTION READ ONLY",
    ]);
    return "result";
  });
  assert.equal(result, "result");
});

test("a budget setup failure prevents query execution", async () => {
  const failure = new Error("budget setup failed");
  const database = { transaction: async (task) => task({ raw: async () => { throw failure; } }) };
  let ran = false;
  await assert.rejects(withBudgetTransaction(database, () => { ran = true; }), failure);
  assert.equal(ran, false);
});
