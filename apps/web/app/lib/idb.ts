/**
 * Browser-private persistence. No private query, map, or layer state is retained
 * after logout or an auth revocation.
 */
import localforage from "localforage";
import type {
  Persister,
  PersistedClient,
} from "@tanstack/query-persist-client-core";

const IDB_DB_NAME = "diskuk-idb";
export const geoJsonStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "loadedGeoJsonData",
});
export const queryPersistStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "persistedQueries",
});
export const layerGroupStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "layerGroups",
});
export const layerOrderStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "layerOrder",
});

/** Antrean laporan KPI offline (Y03). Retensi: bertahan di perangkat (reload),
 *  terhapus otomatis per-item saat sinkron sukses; ikut terhapus saat logout. */
export const kpiOutboxStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "kpiOutbox",
});

export function createQueryPersister(): Persister {
  return {
    persistClient: (client: PersistedClient) =>
      queryPersistStore.setItem("cache", client).then(() => undefined),
    restoreClient: () =>
      queryPersistStore
        .getItem<PersistedClient>("cache")
        .then((v) => v ?? undefined),
    removeClient: () => queryPersistStore.removeItem("cache"),
  };
}

/** Clear all browser state that could contain private dashboard data. */
export async function clearPrivateClientState(queryClient?: {
  clear?: () => void;
}) {
  queryClient?.clear?.();
  await Promise.allSettled([
    queryPersistStore.clear(),
    geoJsonStore.clear(),
    layerGroupStore.clear(),
    layerOrderStore.clear(),
    kpiOutboxStore.clear(),
  ]);
  if (import.meta.client) {
    try {
      localStorage.removeItem("diskuk:usaha-saya");
    } catch {
      /* abaikan */
    }
  }
  if (import.meta.client && "caches" in window) {
    const names = await caches.keys();
    await Promise.allSettled(
      names
        .filter(
          (name) =>
            name.startsWith("diskuk-private") ||
            name === "diskuk-assets" ||
            name === "diskuk-query",
        )
        .map((name) => caches.delete(name)),
    );
  }
}
