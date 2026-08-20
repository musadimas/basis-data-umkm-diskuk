<script setup lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLatBounds,
  Map,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type ExpressionSpecification,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { InfografisRegion } from "~/types/infografis";
import { formatAnalyticsNumber } from "~/lib/analytics-format";

const props = withDefaults(defineProps<{
  regions: InfografisRegion[]
  level?: "kota" | "kecamatan" | "kelurahan"
}>(), { level: "kota" });
const emit = defineEmits<{ select: [region: InfografisRegion] }>();
const container = useTemplateRef<HTMLDivElement>("container");

let map: MapLibreMap | null = null;
let popup: Popup | null = null;
let resizeObserver: ResizeObserver | null = null;

const maxValue = computed(() => Math.max(0, ...props.regions.map((region) => region.value)));
const levelLabel = computed(() => ({
  kota: "kabupaten dan kota",
  kecamatan: "kecamatan",
  kelurahan: "desa dan kelurahan",
})[props.level]);
const legendItems = computed(() => {
  const max = maxValue.value;
  if (max <= 0) return [{ color: "#cbd5e1", label: "Tidak ada UMKM" }];
  const quarter = Math.round(max * 0.25);
  const half = Math.round(max * 0.5);
  const threeQuarters = Math.round(max * 0.75);
  return [
    { color: "#0e7490", label: `${formatAnalyticsNumber(threeQuarters)}–${formatAnalyticsNumber(max)}` },
    { color: "#2563eb", label: `${formatAnalyticsNumber(half)}–${formatAnalyticsNumber(Math.max(half, threeQuarters - 1))}` },
    { color: "#16A75C", label: `${formatAnalyticsNumber(quarter)}–${formatAnalyticsNumber(Math.max(quarter, half - 1))}` },
    { color: "#fb923c", label: `0–${formatAnalyticsNumber(Math.max(0, quarter - 1))}` },
  ];
});

function colorExpression(): string | ExpressionSpecification {
  const max = maxValue.value;
  if (max <= 0) return "#cbd5e1";
  return [
    "interpolate", ["linear"], ["get", "value"],
    0, "#fb923c",
    max * 0.25, "#16A75C",
    max * 0.5, "#2563eb",
    max, "#0e7490",
  ];
}

function featureCollection(): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
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
        // SAFETY: endpoint /panel/infografis/map hanya mengirim geometry Polygon/MultiPolygon
        // (lihat InfografisRegion.geometry), sehingga bentuk GeoJSON ini valid.
        geometry: region.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      }];
    }),
  };
}

/** Koordinat GeoJSON bersarang: posisi (daftar number) atau daftar koordinat lebih dalam. */
type Coordinates = number[] | Coordinates[];

function extendBounds(bounds: LngLatBounds, coordinates: Coordinates): void {
  const [x, y] = coordinates;
  if (x !== undefined && y !== undefined && !Array.isArray(x) && !Array.isArray(y)) {
    bounds.extend([x, y]);
    return;
  }
  for (const child of coordinates) {
    if (Array.isArray(child)) extendBounds(bounds, child);
  }
}

function updateSource() {
  if (!map?.isStyleLoaded()) return;
  const data = featureCollection();
  // SAFETY: source "jabar-regions" selalu didaftarkan bertipe geojson oleh komponen ini saat map load.
  (map.getSource("jabar-regions") as GeoJSONSource | undefined)?.setData(data);
  if (map.getLayer("jabar-fill")) map.setPaintProperty("jabar-fill", "fill-color", colorExpression());
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
        "fill-color": colorExpression(),
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
      :aria-label="`Peta sebaran UMKM per ${levelLabel} Jawa Barat`"
      data-lenis-prevent-wheel
    />
    <div class="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border bg-white/95 p-3 text-xs shadow-md">
      <p class="mb-2 font-bold">Jumlah UMKM</p>
      <div class="space-y-1.5 text-[11px] font-medium text-slate-600">
        <div
          v-for="item in legendItems"
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
