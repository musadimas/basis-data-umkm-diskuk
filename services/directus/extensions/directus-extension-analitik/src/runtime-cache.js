// Tiny in-process TTL memo for per-instance source/registry lookups. Aggregate
// responses use the separate generation-aware Redis cache. Cached values
// are treated as immutable by callers; TTLs bound generation-promotion lag far
// inside the 60s CRUD-to-visible SLO (source 5s, registry 60s).
const SOURCE_TTL_MS = 5_000;
const REGISTRY_TTL_MS = 60_000;

function createTtlCache(ttlMs) {
  let entry = null;
  let pending = null;
  return {
    get() { if (entry && Date.now() - entry.at < ttlMs) return entry.value; return null; },
    set(value) { entry = { at: Date.now(), value }; },
    getOrLoad(loader) {
      const cached = this.get();
      if (cached !== null) return Promise.resolve(cached);
      if (!pending) {
        const request = Promise.resolve().then(loader).then((value) => {
          // clear() may invalidate an older lookup while it is still running.
          if (pending === request && value != null) this.set(value);
          return value;
        }).finally(() => {
          if (pending === request) pending = null;
        });
        pending = request;
      }
      return pending;
    },
    clear() { entry = null; pending = null; },
  };
}

const sourceCache = createTtlCache(SOURCE_TTL_MS);
const registryCache = createTtlCache(REGISTRY_TTL_MS);

async function loadRegistryCached(database) {
  return registryCache.getOrLoad(async () => {
    const result = await database.raw(`SELECT id,semantic_id,lifecycle_status,semantic_role FROM analitik_field`);
    return result.rows ?? result[0] ?? [];
  });
}

function __resetRuntimeCachesForTests() { sourceCache.clear(); registryCache.clear(); }

module.exports = { createTtlCache, sourceCache, registryCache, loadRegistryCached, __resetRuntimeCachesForTests };
