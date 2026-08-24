const { createHash } = require("node:crypto");
const { SCHEMA_VERSION, MASKING_VERSION } = require("../../../analytics-shared/contracts.cjs");

const PREFIX = "diskuk:analitik:aggregate:v1";
const DEFAULT_TTL_SECONDS = 300;
let redisClient;
let testClient;
let unavailableUntil = 0;

function canonicalFilters(plan) {
  return plan.normalized.filters
    .map((filter, index) => ({
      field: plan.filterSemantics[index],
      operator: filter.operator || "eq",
      value: Array.isArray(filter.value) ? [...filter.value].map(String).sort() : String(filter.value),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function aggregateCacheKey({ source, plan, registry, permissionScope }) {
  const registryVersion = registry
    .map(({ semantic_id, lifecycle_status, semantic_role }) => [semantic_id, lifecycle_status, semantic_role])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    maskingVersion: MASKING_VERSION,
    permissionScope,
    source: [source.kind, source.generationId || source.dataAsOf, source.status],
    registryVersion,
    query: {
      metric: plan.metricKey,
      groupBy: plan.semantic,
      breakdown: plan.breakdown,
      filters: canonicalFilters(plan),
      limit: plan.limit,
      includeOthers: plan.includeOthers,
    },
  };
  return `${PREFIX}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function ttlSeconds() {
  const configured = Number(process.env.ANALYTICS_REDIS_TTL_SECONDS);
  return Number.isInteger(configured) && configured >= 30 && configured <= 86_400 ? configured : DEFAULT_TTL_SECONDS;
}

async function getClient() {
  if (testClient !== undefined) return testClient;
  const url = process.env.ANALYTICS_REDIS_URL;
  if (!url || Date.now() < unavailableUntil) return null;
  if (!redisClient) {
    const Redis = require("ioredis");
    redisClient = new Redis(url, { lazyConnect: true, connectTimeout: 500, commandTimeout: 500, maxRetriesPerRequest: 1 });
    redisClient.on("error", () => {});
  }
  if (redisClient.status === "wait") await redisClient.connect();
  return redisClient.status === "ready" ? redisClient : null;
}

function markUnavailable() {
  if (testClient !== undefined) return;
  unavailableUntil = Date.now() + 30_000;
  redisClient?.disconnect();
  redisClient = undefined;
}

async function getCachedAggregate(key) {
  try {
    const client = await getClient();
    const value = client && await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    markUnavailable();
    return null;
  }
}

async function setCachedAggregate(key, value) {
  try {
    const client = await getClient();
    if (client) await client.set(key, JSON.stringify(value), "EX", ttlSeconds());
  } catch {
    markUnavailable();
  }
  return value;
}

function __setRedisClientForTests(client) { testClient = client; }
function __resetAggregateCacheForTests() { testClient = undefined; unavailableUntil = 0; redisClient?.disconnect(); redisClient = undefined; }

module.exports = { aggregateCacheKey, getCachedAggregate, setCachedAggregate, __setRedisClientForTests, __resetAggregateCacheForTests };
