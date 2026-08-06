/**
 * Shared IndexedDB abstraction using localforage.
 * All app IDB access (GeoJSON data + query cache) uses the same DB name
 * with separate object stores.
 */
import localforage from "localforage";
import type { Persister, PersistedClient } from "@tanstack/query-persist-client-core";

const IDB_DB_NAME = "diskuk-idb";

/** Object store for loaded GeoJSON layer data. */
export const geoJsonStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "loadedGeoJsonData",
});

/** Object store for TanStack Query cache persistence. */
export const queryPersistStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "persistedQueries",
});

/** Object store for layer group metadata (groups wrapping local layers). */
export const layerGroupStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "layerGroups",
});

/** Object store for the user's drag-ordered layer list (persists top-level order across sessions). */
export const layerOrderStore = localforage.createInstance({
  name: IDB_DB_NAME,
  storeName: "layerOrder",
});

/** Creates the persister adapter consumed by persistQueryClient(). */
export function createQueryPersister(): Persister {
  return {
    persistClient: (client: PersistedClient) => queryPersistStore.setItem("cache", client).then(() => undefined),
    restoreClient: () => queryPersistStore.getItem<PersistedClient>("cache").then((v) => v ?? undefined),
    removeClient: () => queryPersistStore.removeItem("cache"),
  };
}
