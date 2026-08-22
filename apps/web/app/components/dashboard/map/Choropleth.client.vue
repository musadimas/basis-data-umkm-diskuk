<!--
  Peta koropleth sebaran UMKM per wilayah (MapLibre GL + tile raster OpenStreetMap).

  Komponen bersifat client-only (suffix `.client`). Fitur:
  - Poligon wilayah dengan hover highlight & klik untuk drill-down.
  - Counter jumlah UMKM pada tiap poligon wilayah.
  - Sebaran titik UMKM (opsional, diaktifkan lewat saklar) dengan clustering:
    titik diagregasi menjadi klaster berhitung, lalu mengembang saat peta
    di-zoom atau klaster diklik.
-->
<script setup lang="ts">
import { Minus, Plus } from "@lucide/vue";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLatBounds,
  Map,
  Popup,
  type GeoJSONSource,
  type ExpressionSpecification,
  type MapLayerMouseEvent,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { InfografisRegion } from "~/types/infografis";
import type { SkalaUsaha, SpasialUmkmItem } from "~/types/dashboard";
import { formatAnalyticsNumber } from "~/lib/analytics-format";

const props = withDefaults(defineProps<{
  regions: InfografisRegion[]
  level?: "kota" | "kecamatan" | "kelurahan"
  /** Titik UMKM yang dapat ditampilkan di atas poligon. */
  points?: SpasialUmkmItem[]
  /** Saklar tampil/sembunyi poligon wilayah (v-model:show-regions). */
  showRegions?: boolean
  /** Saklar tampil/sembunyi titik UMKM (v-model:show-points). */
  showPoints?: boolean
}>(), { level: "kota", points: () => [], showRegions: true, showPoints: false });
const emit = defineEmits<{
  select: [region: InfografisRegion];
  "update:showRegions": [value: boolean];
  "update:showPoints": [value: boolean];
}>();
const container = useTemplateRef<HTMLDivElement>("container");

let map: MapLibreMap | null = null;
let popup: Popup | null = null;
let resizeObserver: ResizeObserver | null = null;
let hoveredRegionId: string | number | null = null;

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

// ── Titik UMKM ──────────────────────────────────────────────────────────────
const skalaColors = {
  mikro: "#16A75C",
  kecil: "#0ea5e9",
  menengah: "#fbbf24",
} satisfies Record<SkalaUsaha, string>;
const skalaLabels = {
  mikro: "Usaha Mikro",
  kecil: "Usaha Kecil",
  menengah: "Usaha Menengah",
} satisfies Record<SkalaUsaha, string>;
const pointsVisible = computed(() => props.showPoints && props.points.length > 0);

function skalaColorExpression(): string | ExpressionSpecification {
  return [
    "match",
    ["get", "skala"],
    "mikro", skalaColors.mikro,
    "kecil", skalaColors.kecil,
    "menengah", skalaColors.menengah,
    "#64748b",
  ];
}

function pointsFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: props.points.map((item) => ({
      type: "Feature" as const,
      properties: {
        id: item.id,
        nama: item.namaUsaha,
        skala: item.skala,
        produk: item.produkUtama,
        kota: item.kabupatenKota,
        kecamatan: item.kecamatan,
      },
      geometry: { type: "Point" as const, coordinates: [item.longitude, item.latitude] },
    })),
  };
}

/** Tampilkan/sembunyikan seluruh layer titik tanpa membangun ulang source. */
function applyPointsVisibility() {
  if (!map) return;
  const visibility = pointsVisible.value ? "visible" : "none";
  for (const layer of ["umkm-clusters", "umkm-cluster-count", "umkm-point"]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
  }
}

/** Tampilkan/sembunyikan poligon wilayah + outline + counter sesuai saklar. */
function applyRegionsVisibility() {
  if (!map) return;
  const visibility = props.showRegions ? "visible" : "none";
  for (const layer of ["jabar-fill", "jabar-outline", "jabar-counters"]) {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
  }
}

/** Terapkan visibilitas semua grup layer (dipanggil saat saklar berubah / data diperbarui). */
function applyLayersVisibility() {
  applyRegionsVisibility();
  applyPointsVisibility();
}

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
          // Label siap pakai untuk simbol counter di atas poligon.
          label: formatAnalyticsNumber(region.value),
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
  // setData menghapus feature state, jadi reset id wilayah yang sedang di-hover.
  hoveredRegionId = null;
  if (map.getLayer("jabar-fill")) map.setPaintProperty("jabar-fill", "fill-color", colorExpression());
  // Titik UMKM: perbarui data + visibilitas sesuai saklar.
  // SAFETY: source "umkm-points" selalu didaftarkan bertipe geojson oleh komponen ini saat map load.
  (map.getSource("umkm-points") as GeoJSONSource | undefined)?.setData(pointsFeatureCollection());
  applyLayersVisibility();
  const bounds = new LngLatBounds();
  for (const feature of data.features) extendBounds(bounds, feature.geometry.coordinates);
  // Durasi animasi memberi transisi kamera halus saat drill-down antar level wilayah.
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 28, duration: 700 });
}

/** Tandai wilayah yang sedang di-hover agar terlihat bisa diklik. */
function setRegionHover(id: string | number | null) {
  if (!map) return;
  if (hoveredRegionId !== null) {
    map.setFeatureState({ source: "jabar-regions", id: hoveredRegionId }, { hover: false });
  }
  hoveredRegionId = id;
  if (id !== null) {
    map.setFeatureState({ source: "jabar-regions", id }, { hover: true });
  }
}

function onRegionClick(event: MapLayerMouseEvent) {
  // Jangan drill-down bila yang diklik adalah titik/klaster UMKM di atas poligon.
  const hitPoints = event.target.queryRenderedFeatures(event.point, {
    layers: ["umkm-clusters", "umkm-point"],
  });
  if (hitPoints.length > 0) return;
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

/** Klik klaster → zoom halus ke tingkat di mana klaster tersebut mengembang. */
async function onClusterClick(event: MapLayerMouseEvent) {
  const feature = event.features?.[0];
  // clusterId ditulis oleh MapBox/MapLibre cluster sendiri ke properties dan selalu berupa angka;
  // Number() memvalidasi representasinya di boundary sebelum dipakai ke API cluster.
  const clusterId = Number(feature?.properties?.clusterId);
  if (!feature || !Number.isFinite(clusterId)) return;
  // SAFETY: source "umkm-points" selalu didaftarkan bertipe geojson oleh komponen ini saat map load.
  const source = event.target.getSource("umkm-points") as GeoJSONSource | undefined;
  if (!source) return;
  const zoom = await source.getClusterExpansionZoom(clusterId);
  // SAFETY: layer cluster hanya menerima feature Point yang dibuat oleh pointsFeatureCollection().
  const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
  event.target.easeTo({
    center,
    zoom: Math.min(zoom + 0.2, event.target.getMaxZoom()),
    duration: 600,
  });
}

/** Klik titik usaha → popup detail usaha. */
function onPointClick(event: MapLayerMouseEvent) {
  const properties = event.features?.[0]?.properties;
  if (!properties) return;
  popup?.remove();
  // SAFETY: skala pada feature berasal dari pointsFeatureCollection() yang menyalin SkalaUsaha apa adanya;
  // fallback "#64748b"/teks mentah di bawah menangani nilai di luar union.
  const skala = (properties.skala ?? "") as SkalaUsaha;
  const content = document.createElement("div");
  content.className = "space-y-1";
  const title = document.createElement("div");
  title.className = "text-[13px] font-bold leading-snug";
  title.textContent = String(properties.nama ?? "");
  const badge = document.createElement("span");
  badge.className = "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold text-white";
  badge.style.backgroundColor = skalaColors[skala] ?? "#64748b";
  badge.textContent = skalaLabels[skala] ?? skala;
  const produk = document.createElement("div");
  produk.className = "text-[11px] text-slate-600";
  produk.textContent = String(properties.produk ?? "–");
  const meta = document.createElement("div");
  meta.className = "text-[11px] text-slate-600";
  meta.textContent = `${String(properties.kota ?? "")} · ${String(properties.kecamatan ?? "")}`;
  content.append(title, badge, produk, meta);
  popup = new Popup({ closeButton: false, offset: 10, maxWidth: "260px" })
    .setLngLat(event.lngLat)
    .setDOMContent(content)
    .addTo(event.target);
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
      // Glyphs diperlukan agar layer simbol (counter wilayah & angka klaster) bisa merender teks.
      glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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
  map.addControl(new AttributionControl({
    compact: true,
    customAttribution: "Batas wilayah © Badan Informasi Geospasial",
  }), "bottom-right");
  map.on("load", () => {
    map?.addSource("jabar-regions", { type: "geojson", data: featureCollection(), promoteId: "id" });
    map?.addLayer({
      id: "jabar-fill",
      type: "fill",
      source: "jabar-regions",
      paint: {
        "fill-color": colorExpression(),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1,
          0.82,
        ],
        // Transisi paint membuat hover & pembaruan warna terasa halus, bukan melompat.
        "fill-color-transition": { duration: 250, delay: 0 },
        "fill-opacity-transition": { duration: 200, delay: 0 },
      },
    });
    map?.addLayer({
      id: "jabar-outline",
      type: "line",
      source: "jabar-regions",
      paint: {
        "line-color": "#ffffff",
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          3,
          1.5,
        ],
        "line-width-transition": { duration: 200, delay: 0 },
      },
    });
    // Counter jumlah UMKM di tiap poligon wilayah.
    map?.addLayer({
      id: "jabar-counters",
      type: "symbol",
      source: "jabar-regions",
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11,
        "text-letter-spacing": 0.05,
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
    });

    // ── Titik UMKM dengan clustering ────────────────────────────────────────
    map?.addSource("umkm-points", {
      type: "geojson",
      data: pointsFeatureCollection(),
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 13,
    });
    map?.addLayer({
      id: "umkm-clusters",
      type: "circle",
      source: "umkm-points",
      filter: ["has", "point_count"],
      layout: { visibility: "none" },
      paint: {
        "circle-color": "#1E88E5",
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius-transition": { duration: 200, delay: 0 },
      },
    });
    map?.addLayer({
      id: "umkm-cluster-count",
      type: "symbol",
      source: "umkm-points",
      filter: ["has", "point_count"],
      layout: {
        visibility: "none",
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
    map?.addLayer({
      id: "umkm-point",
      type: "circle",
      source: "umkm-points",
      filter: ["!", ["has", "point_count"]],
      layout: { visibility: "none" },
      paint: {
        "circle-color": skalaColorExpression(),
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius-transition": { duration: 150, delay: 0 },
      },
    });

    map?.on("click", "jabar-fill", onRegionClick);
    map?.on("mousemove", "jabar-fill", (event) => {
      if (!map) return;
      map.getCanvas().style.cursor = "pointer";
      const feature = event.features?.[0];
      setRegionHover(feature ? String(feature.properties?.id ?? "") : null);
    });
    map?.on("mouseleave", "jabar-fill", () => {
      if (!map) return;
      map.getCanvas().style.cursor = "";
      setRegionHover(null);
    });

    map?.on("click", "umkm-clusters", onClusterClick);
    map?.on("click", "umkm-point", onPointClick);
    for (const layer of ["umkm-clusters", "umkm-point"]) {
      map?.on("mouseenter", layer, () => { if (map) map.getCanvas().style.cursor = "pointer"; });
      map?.on("mouseleave", layer, () => { if (map) map.getCanvas().style.cursor = ""; });
    }

    updateSource();
  });
  resizeObserver = new ResizeObserver(() => map?.resize());
  resizeObserver.observe(container.value);
});

watch(() => props.regions, updateSource, { deep: true });
watch(() => props.points, updateSource);
watch(() => [props.showRegions, props.showPoints] as const, () => {
  if (map?.isStyleLoaded()) applyLayersVisibility();
});

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
  <div class="relative overflow-hidden bg-slate-50">
    <div
      ref="container"
      class="h-[480px] w-full lg:h-[620px]"
      :aria-label="`Peta sebaran UMKM per ${levelLabel} Jawa Barat`"
      data-lenis-prevent-wheel
    />

    <!-- Saklar tampil/sembunyi layer -->
    <div class="absolute right-3 top-3 z-[5] flex flex-col items-stretch gap-2">
      <button
        type="button"
        role="switch"
        :aria-checked="showRegions"
        class="flex items-center gap-2 rounded-full border bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-xs"
        @click="emit('update:showRegions', !showRegions)"
      >
        <span
          class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
          :class="showRegions ? 'bg-brand-green' : 'bg-slate-300'"
          aria-hidden="true"
        >
          <span
            class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all"
            :class="showRegions ? 'left-3.5' : 'left-0.5'"
          />
        </span>
        <span class="text-slate-700">Wilayah</span>
      </button>
      <button
        type="button"
        role="switch"
        :aria-checked="showPoints"
        class="flex items-center gap-2 rounded-full border bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-xs"
        @click="emit('update:showPoints', !showPoints)"
      >
        <span
          class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
          :class="showPoints ? 'bg-brand-green' : 'bg-slate-300'"
          aria-hidden="true"
        >
          <span
            class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all"
            :class="showPoints ? 'left-3.5' : 'left-0.5'"
          />
        </span>
        <span class="text-slate-700">Titik UMKM</span>
      </button>
    </div>

    <!-- Kontrol zoom kustom -->
    <div class="absolute bottom-12 right-3 z-[5] flex flex-col gap-2">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 text-slate-700 shadow-md backdrop-blur-xs transition-colors hover:bg-slate-100"
        aria-label="Perbesar peta"
        @click="map?.zoomIn()"
      >
        <Plus class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 text-slate-700 shadow-md backdrop-blur-xs transition-colors hover:bg-slate-100"
        aria-label="Perkecil peta"
        @click="map?.zoomOut()"
      >
        <Minus class="h-4 w-4" />
      </button>
    </div>

    <!-- Legenda -->
    <div
      v-if="showRegions || pointsVisible"
      class="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border bg-white/95 p-3 text-xs shadow-md backdrop-blur-xs"
    >
      <template v-if="showRegions">
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
      </template>

      <!-- Legenda skala usaha (tampil saat titik diaktifkan) -->
      <template v-if="pointsVisible">
        <div v-if="showRegions" class="my-2 border-t border-slate-200" />
        <p class="mb-2 font-bold">Titik Usaha</p>
        <div class="space-y-1.5 text-[11px] font-medium text-slate-600">
          <div
            v-for="(color, key) in skalaColors"
            :key="key"
            class="flex items-center gap-2"
          >
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: color }" />
            <span>{{ skalaLabels[key] }}</span>
          </div>
        </div>
        <p class="mt-2 text-[10px] text-slate-500">{{ formatAnalyticsNumber(points.length) }} titik ditampilkan</p>
      </template>
    </div>
  </div>
</template>
