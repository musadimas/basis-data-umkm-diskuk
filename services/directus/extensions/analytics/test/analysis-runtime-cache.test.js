import { createTtlCache, loadRegistryCached, __resetRuntimeCachesForTests } from "../src/endpoints/analysis/runtime-cache.js";
import { resolveAnalyticsSourceCached } from "../src/endpoints/analysis/source-service.js";
import assert from "node:assert/strict";
import test from "node:test";
test("20 concurrent requests share two source/registry lookups, including warm hits", async () => {
  __resetRuntimeCachesForTests();
  let calls = 0;
  const database = {
    async raw(sql) {
      calls++;
      await new Promise((resolve) => setImmediate(resolve));
      return { rows: sql.includes("analitik_field") ? [] : [
        { id: "generation-1", status: "active", reconciled_at: "2026-09-06", row_count: 1 },
      ] };
    },
  };
  const results = await Promise.all(Array.from({ length: 20 }, () => Promise.all([
    resolveAnalyticsSourceCached(database), loadRegistryCached(database),
  ])));
  assert.equal(calls, 2);
  assert.equal(results[0][0].generationId, "generation-1");
  assert.ok(results.every(([source, registry]) => source === results[0][0] && registry === results[0][1]));
  await Promise.all([resolveAnalyticsSourceCached(database), loadRegistryCached(database)]);
  assert.equal(calls, 2);
  __resetRuntimeCachesForTests();
});

test("failed lookups are shared but can be retried, and missing sources are not cached", async () => {
  const cache = createTtlCache(5000);
  const failure = new Error("lookup unavailable");
  let calls = 0;
  const loader = async () => { calls++; throw failure; };
  const results = await Promise.allSettled([cache.getOrLoad(loader), cache.getOrLoad(loader)]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === "rejected" && result.reason === failure));
  assert.equal(await cache.getOrLoad(async () => null), null);
  assert.equal(await cache.getOrLoad(async () => "ready"), "ready");
});

test("TTL expires and clear prevents an older lookup from replacing fresh data", async () => {
  const expired = createTtlCache(0);
  await expired.getOrLoad(async () => "old");
  assert.equal(await expired.getOrLoad(async () => "new"), "new");
  const cache = createTtlCache(5000);
  let finish;
  const old = cache.getOrLoad(() => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(await cache.getOrLoad(async () => "new"), "new");
  finish("old");
  assert.equal(await old, "old");
  assert.equal(cache.get(), "new");
});
