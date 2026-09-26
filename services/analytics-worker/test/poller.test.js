import assert from "node:assert/strict";
import test from "node:test";
import { JobPoller } from "../src/poller.js";
import { JobQueue } from "../src/queue.js";

const silentLogger = { log() {}, info() {}, warn() {}, error() {} };

async function flushTurns(rounds = 5) {
  for (let i = 0; i < rounds; i++)
    await new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test("overlapping ticks during a slow claim start a single claim and handle every claimed job", async () => {
  const claimLimits = [];
  const gate = deferred();
  const released = [];
  const handled = [];
  const poller = new JobPoller({
    queue: {
      claim(limit) {
        claimLimits.push(limit);
        return gate.promise;
      },
      async release(ids) {
        released.push(...ids);
        return ids.length;
      },
    },
    concurrency: 2,
    pollMs: 1_000,
    handle: async (job) => {
      handled.push(job.id);
    },
    logger: silentLogger,
  });
  const first = poller.tick();
  const second = poller.tick();
  assert.equal(claimLimits.length, 1, "second tick must not claim while one is in flight");
  gate.resolve([{ id: "a" }, { id: "b" }]);
  await Promise.all([first, second]);
  await flushTurns();
  assert.deepEqual(claimLimits, [2]);
  assert.deepEqual(handled, ["a", "b"]);
  assert.deepEqual(released, []);
  assert.equal(poller.active.size, 0);
});

test("claimed jobs beyond remaining capacity are explicitly released, never left processing", async () => {
  const released = [];
  const handled = [];
  const poller = new JobPoller({
    queue: {
      async claim() {
        return [{ id: "a" }, { id: "b" }, { id: "c" }];
      },
      async release(ids) {
        released.push(...ids);
        return ids.length;
      },
    },
    concurrency: 2,
    pollMs: 1_000,
    handle: async (job) => {
      handled.push(job.id);
    },
    logger: silentLogger,
  });
  await poller.tick();
  await flushTurns();
  assert.deepEqual(handled, ["a", "b"]);
  assert.deepEqual(released, ["c"]);
  assert.equal(poller.active.size, 0);
});

test("stop waits for a pending claim, releases its jobs unhandled, and blocks later ticks", async () => {
  const claimCalls = [];
  const gate = deferred();
  const released = [];
  const handled = [];
  const poller = new JobPoller({
    queue: {
      claim(...args) {
        claimCalls.push(args);
        return gate.promise;
      },
      async release(ids) {
        released.push(...ids);
        return ids.length;
      },
    },
    concurrency: 2,
    pollMs: 1_000,
    handle: async (job) => {
      handled.push(job.id);
    },
    logger: silentLogger,
  });
  const pending = poller.tick();
  const stopping = poller.stop(1_000);
  gate.resolve([{ id: "a" }, { id: "b" }]);
  await pending;
  assert.equal(await stopping, 0);
  await flushTurns();
  assert.deepEqual(handled, [], "jobs claimed during shutdown must not be handled");
  assert.deepEqual(released, ["a", "b"]);
  await poller.tick();
  await flushTurns();
  assert.equal(claimCalls.length, 1, "poller must stay stopped after shutdown");
});

test("a rejected claim releases the in-flight guard so the next tick can claim again", async () => {
  const claimCalls = [];
  const handled = [];
  let failNext = true;
  const poller = new JobPoller({
    queue: {
      async claim() {
        claimCalls.push(Date.now());
        if (failNext) {
          failNext = false;
          const error = new Error("connect refused");
          error.code = "ECONNREFUSED";
          throw error;
        }
        return [{ id: "a" }];
      },
      async release() {
        return 0;
      },
    },
    concurrency: 1,
    pollMs: 1_000,
    handle: async (job) => {
      handled.push(job.id);
    },
    logger: silentLogger,
  });
  await poller.tick();
  await flushTurns();
  assert.deepEqual(handled, []);
  assert.equal(poller.claimInFlight, false);
  await poller.tick();
  await flushTurns();
  assert.equal(claimCalls.length, 2);
  assert.deepEqual(handled, ["a"]);
});

test("a handler that rejects still frees its active slot", async () => {
  const poller = new JobPoller({
    queue: {
      async claim() {
        return [{ id: "boom" }];
      },
      async release() {
        return 0;
      },
    },
    concurrency: 1,
    pollMs: 1_000,
    handle: async () => {
      throw new Error("handler failed");
    },
    logger: silentLogger,
  });
  await poller.tick();
  await flushTurns();
  assert.equal(poller.active.size, 0);
});

test("stop reports active jobs that outlive the deadline instead of exiting clean", async () => {
  const gate = deferred();
  const poller = new JobPoller({
    queue: {
      async claim() {
        return [{ id: "slow" }];
      },
      async release() {
        return 0;
      },
    },
    concurrency: 1,
    pollMs: 1_000,
    handle: () => gate.promise,
    logger: silentLogger,
    stopTimeoutMs: 60,
  });
  await poller.tick();
  const remaining = await poller.stop(60);
  assert.equal(remaining, 1);
  gate.resolve();
  await flushTurns();
  assert.equal(poller.active.size, 0);
});

test("JobQueue.release returns claimed jobs to queued and never touches foreign leases", async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rowCount: 1 };
    },
  };
  const queue = new JobQueue(pool, { workerId: "worker-test" });
  assert.equal(await queue.release([]), 0);
  assert.equal(await queue.release([undefined, null]), 0);
  assert.equal(queries.length, 0);
  const rowCount = await queue.release([
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ]);
  assert.equal(rowCount, 1);
  assert.equal(queries.length, 1);
  const { sql, params } = queries[0];
  assert.match(sql, /SET status='queued'/);
  assert.match(sql, /lease_until=NULL, lease_owner=NULL/);
  assert.match(sql, /attempts=GREATEST\(attempts-1,0\)/);
  assert.match(sql, /status='processing' AND lease_owner=\$2/);
  assert.match(sql, /ANY\(\$1::uuid\[\]\)/);
  assert.deepEqual(params, [
    [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ],
    "worker-test",
  ]);
});
