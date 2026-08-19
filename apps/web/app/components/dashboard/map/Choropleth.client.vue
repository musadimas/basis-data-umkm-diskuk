<script setup lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLatBounds,
  Map,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { InfografisRegion } from "~/types/infografis";
import { formatAnalyticsNumber } from "~/lib/analytics-format";

const props = defineProps<{ regions: InfografisRegion[] }>();
const emit = defineEmits<{ select: [region: InfografisRegion] }>();
const container = useTemplateRef<HTMLDivElement>("container");

let map: MapLibreMap | null = null;
let popup: Popup | null = null;
let resizeObserver: ResizeObserver | null = null;

function featureCollection(): FeatureCollection<Polygon | MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: props.regions.flatMap((region) => {
      if (!region.geometry) return [];
      return [{
        type: "Feature" as const,
        id: region.id,
        properties: {
          id: region.id,
          code: region.code ?? "",
          name: region.name,
          value: region.value,
        },
        geometry: region.geometry as Polygon | MultiPolygon,
      }];
    }),
  };
}

function extendBounds(bounds: LngLatBounds, coordinates: unknown) {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2
    && typeof coordinates[0] === "number"
    && typeof coordinates[1] === "number"
  ) {
    bounds.extend([coordinates[0], coordinates[1]]);
    return;
  }
  for (const child of coordinates) extendBounds(bounds, child);
}

function updateSource() {
  if (!map?.isStyleLoaded()) return;
  const data = featureCollection();
  (map.getSource("jabar-regions") as GeoJSONSource | undefined)?.setData(data);
  const bounds = new LngLatBounds();
  for (const feature of data.features) extendBounds(bounds, feature.geometry.coordinates);
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 28, duration: 0 });
}

function onRegionClick(event: MapLayerMouseEvent) {
  const feature = event.features?.[0];
  const id = String(feature?.properties?.id ?? "");
  const region = props.regions.find((item) => item.id === id);
  if (!region) return;
  popup?.remove();
  const content = document.createElement("div");
  const title = document.createElement("strong");
  const total = document.createElement("div");
  title.textContent = region.name;
  total.textContent = `${formatAnalyticsNumber(region.value)} UMKM`;
  content.append(title, total);
  popup = new Popup({ closeButton: false, offset: 8 })
    .setLngLat(event.lngLat)
    .setDOMContent(content)
    .addTo(event.target);
  emit("select", region);
}

onMounted(() => {
  if (!container.value) return;
  map = new Map({
    container: container.value,
    center: [107.6, -6.9],
    zoom: 7,
    attributionControl: false,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
  });
  map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-left");
  map.addControl(new AttributionControl({
    compact: true,
    customAttribution: "Batas wilayah © Badan Informasi Geospasial",
  }), "bottom-right");
  map.on("load", () => {
    map?.addSource("jabar-regions", { type: "geojson", data: featureCollection() });
    map?.addLayer({
      id: "jabar-fill",
      type: "fill",
      source: "jabar-regions",
      paint: {
        "fill-color": [
          "step", ["get", "value"],
          "#fb923c",
          50_000, "#facc15",
          100_000, "#10b981",
          300_000, "#2563eb",
          500_000, "#0e7490",
        ],
        "fill-opacity": 0.82,
      },
    });
    map?.addLayer({
      id: "jabar-outline",
      type: "line",
      source: "jabar-regions",
      paint: { "line-color": "#ffffff", "line-width": 1.5 },
    });
    map?.on("click", "jabar-fill", onRegionClick);
    map?.on("mouseenter", "jabar-fill", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
    map?.on("mouseleave", "jabar-fill", () => { if (map) map.getCanvas().style.cursor = ""; });
    updateSource();
  });
  resizeObserver = new ResizeObserver(() => map?.resize());
  resizeObserver.observe(container.value);
});

watch(() => props.regions, updateSource, { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  popup?.remove();
  map?.remove();
  resizeObserver = null;
  popup = null;
  map = null;
});
</script>

<template>
  <div class="relative overflow-hidden rounded-lg border border-border/80 bg-slate-50">
    <div
      ref="container"
      class="h-[430px] w-full"
      aria-label="Peta sebaran UMKM kabupaten dan kota Jawa Barat"
      data-lenis-prevent-wheel
    />
    <div class="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border bg-white/95 p-3 text-xs shadow-md">
      <p class="mb-2 font-bold">Jumlah UMKM</p>
      <div class="space-y-1.5 text-[11px] font-medium text-slate-600">
        <div
          v-for="item in [
          { color: '#0e7490', label: '≥ 500.000' },
          { color: '#2563eb', label: '300.000–499.999' },
          { color: '#10b981', label: '100.000–299.999' },
          { color: '#facc15', label: '50.000–99.999' },
          { color: '#fb923c', label: '< 50.000' },
          ]"
          :key="item.label"
          class="flex items-center gap-2"
        >
          <span class="h-3 w-3 shrink-0 rounded-xs" :style="{ backgroundColor: item.color }" />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
