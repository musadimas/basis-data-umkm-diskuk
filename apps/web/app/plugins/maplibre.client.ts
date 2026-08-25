import { addProtocol, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Protokol PMTiles hanya boleh didaftarkan sekali; HMR Nuxt dapat memuat ulang
// plugin ini dan addProtocol ganda akan melempar.
let pmtilesRegistered = false;

export default defineNuxtPlugin(() => {
  setWorkerUrl(workerUrl);
  if (!pmtilesRegistered) {
    const pmtilesProtocol = new Protocol();
    addProtocol("pmtiles", (tile, abortController) =>
      pmtilesProtocol.tile(tile, abortController ?? new AbortController()));
    pmtilesRegistered = true;
  }
});
