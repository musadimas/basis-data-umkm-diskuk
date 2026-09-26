const { QUERY_BUDGET } = require("../../../analytics-shared/contracts.cjs");

async function withBudgetTransaction(database, fn) {
  if (typeof database.transaction === "function") {
    return database.transaction(async (trx) => {
      // Fail-closed: if budget cannot be enforced, abort the request rather than run unbounded
      await trx.raw(
        `SET LOCAL statement_timeout = '${QUERY_BUDGET.statementTimeoutMs}ms'`,
      );
      await trx.raw(
        `SET LOCAL lock_timeout = '${QUERY_BUDGET.lockTimeoutMs}ms'`,
      );
      await trx.raw(`SET TRANSACTION READ ONLY`);
      return fn(trx);
    });
  }
  // Fallback for test mocks without transaction support
  return fn(database);
}

module.exports = { withBudgetTransaction };
