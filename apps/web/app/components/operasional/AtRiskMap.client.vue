<script setup lang="ts">
import { Map, LngLatBounds, Popup, type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RiskItem } from "~/types/executive";

const props = defineProps<{ items: RiskItem[] }>();
const container = useTemplateRef<HTMLDivElement>("mapContainer");
const renderWebgl = ref(false);
let map: MapLibreMap | null = null;
let popup: Popup | null = null;

const valid = computed(() => props.items.filter((item) =>
  item.longitude != null && item.latitude != null &&
  Number.isFinite(item.longitude) && Number.isFinite(item.latitude) &&
  Math.abs(item.longitude) <= 180 && Math.abs(item.latitude) <= 90));
const geojson = computed(() => ({
  type: "FeatureCollection" as const,
  features: valid.value.map((item) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [item.longitude!, item.latitude!] },
    properties: { pesertaId: item.pesertaId, nama: item.nama, kota: item.kota ?? "", pendamping: item.pendamping ?? "Belum ditugaskan" },
  })),
}));
// A coordinate plot keeps the red risk pins visible when WebGL2 is unavailable.
const plotPins = computed(() => valid.value.map((item) => ({
  ...item,
  x: 35 + ((item.longitude! - 105.5) / 4) * 570,
  y: 285 - ((item.latitude! + 8.2) / 2.8) * 250,
})));

onMounted(async () => {
  if (!document.createElement("canvas").getContext("webgl2")) return;
  renderWebgl.value = true;
  await nextTick();
  if (!container.value) return;
  try { map = new Map({ container: container.value, center: [107.6, -6.9], zoom: 7,
    style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256, attribution: "© OpenStreetMap contributors" } },
    layers: [{ id: "osm", type: "raster", source: "osm" }] } }); }
  catch { renderWebgl.value = false; return; }
  map.on("load", () => {
    map?.addSource("risiko", { type: "geojson", data: geojson.value });
    map?.addLayer({ id: "pin-risiko", type: "circle", source: "risiko", paint: {
      "circle-color": "#dc2626", "circle-radius": 8, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
    } });
    if (valid.value.length && map) {
      const bounds = new LngLatBounds();
      valid.value.forEach((item) => bounds.extend([item.longitude!, item.latitude!]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 11, duration: 0 });
    }
  });
  map.on("click", "pin-risiko", (event) => {
    const feature = event.features?.[0];
    if (!feature || !map) return;
    // SAFETY: properti pin dibuat oleh `geojson` di komponen ini dengan bentuk yang sama.
    const props = feature.properties as { pesertaId: string; nama: string; kota: string; pendamping: string };
    const node = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = props.nama;
    const info = document.createElement("p"); info.textContent = `${props.kota} · Pendamping: ${props.pendamping}`;
    const link = document.createElement("a"); link.href = `/dashboard/pendampingan/${encodeURIComponent(props.pesertaId)}`;
    link.textContent = "Lihat peserta"; link.className = "underline";
    node.append(name, info, link);
    popup?.remove(); popup = new Popup().setLngLat(event.lngLat).setDOMContent(node).addTo(map);
  });
});
watch(geojson, (data) => {
  // SAFETY: sumber "risiko" ditambahkan sebagai GeoJSON pada inisialisasi peta.
  (map?.getSource("risiko") as GeoJSONSource | undefined)?.setData(data);
});
onBeforeUnmount(() => { popup?.remove(); map?.remove(); map = null; });
</script>

<template>
  <div class="space-y-2" data-testid="at-risk-map">
    <div v-if="renderWebgl" ref="mapContainer" class="h-80 rounded-xl border" aria-label="Peta pin risiko peserta" />
    <svg v-else class="h-80 w-full rounded-xl border bg-slate-50" viewBox="0 0 640 320" role="img" aria-label="Peta koordinat peserta berisiko">
      <path d="M35 35H605V285H35Z M35 160H605 M320 35V285" fill="none" stroke="#cbd5e1" stroke-width="1" />
      <text x="38" y="24" font-size="12" fill="#475569">Koordinat Jawa Barat · 105,5–109,5° BT</text>
      <text x="38" y="306" font-size="12" fill="#475569">-8,2 sampai -5,4° LS</text>
      <g v-for="item in plotPins" :key="item.pesertaId" data-risk-pin>
        <circle :cx="item.x" :cy="item.y" r="10" fill="#dc2626" stroke="white" stroke-width="2" />
        <title>{{ item.nama }} · {{ item.kota || "Wilayah belum tercatat" }}</title>
      </g>
    </svg>
    <p v-if="!valid.length" class="text-sm text-muted-foreground">Tidak ada peserta berisiko dengan koordinat.</p>
    <p v-if="items.length > valid.length" class="text-sm text-muted-foreground">{{ items.length - valid.length }} peserta berisiko tanpa koordinat.</p>
    <ul class="list-disc pl-5 text-sm"><li v-for="item in items" :key="item.pesertaId">
      {{ item.nama }} · {{ item.kota || "Wilayah belum tercatat" }} · Pendamping: {{ item.pendamping || "Belum ditugaskan" }}
    </li></ul>
  </div>
</template>
