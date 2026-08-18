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

const values = computed(() => props.regions.map((region) => region.value));
const minValue = computed(() => Math.min(...values.value, 0));
const maxValue = computed(() => Math.max(...values.value, 1));

function fillColor(value: number) {
  const ratio = (value - minValue.value) / Math.max(1, maxValue.value - minValue.value);
  if (ratio >= 0.75) return "#166534";
  if (ratio >= 0.5) return "#16a34a";
  if (ratio >= 0.25) return "#4ade80";
  if (ratio > 0) return "#86efac";
  return "#dcfce7";
}

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
          fillColor: fillColor(region.value),
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
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": "#f8fafc" } }],
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
      paint: { "fill-color": ["get", "fillColor"], "fill-opacity": 0.82 },
    });
    map?.addLayer({
      id: "jabar-outline",
      type: "line",
      source: "jabar-regions",
      paint: { "line-color": "#14532d", "line-width": 1.1 },
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
    <div ref="container" class="h-[430px] w-full" aria-label="Peta sebaran UMKM kabupaten dan kota Jawa Barat" />
    <div class="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border bg-white/95 p-3 text-xs shadow-md">
      <p class="mb-2 font-bold">Jumlah UMKM</p>
      <div class="flex items-center gap-1" aria-hidden="true">
        <span v-for="color in ['#dcfce7', '#86efac', '#4ade80', '#16a34a', '#166534']" :key="color" class="h-3 w-7" :style="{ backgroundColor: color }" />
      </div>
      <div class="mt-1 flex justify-between gap-5 text-[10px] text-muted-foreground">
        <span>{{ formatAnalyticsNumber(minValue) }}</span><span>{{ formatAnalyticsNumber(maxValue) }}</span>
      </div>
    </div>
  </div>
</template>
