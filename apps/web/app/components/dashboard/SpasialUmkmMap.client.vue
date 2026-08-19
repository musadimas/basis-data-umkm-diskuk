<!--
  Peta interaktif sebaran UMKM berbasis MapLibre GL + tile raster OpenStreetMap.

  Komponen bersifat client-only (suffix `.client`), sehingga lib peta tidak
  di-render di server. Data titik dikirim lewat prop `items`; marker otomatis
  dibangun ulang dan peta di-framing ke batas titik saat prop berubah
  (mis. karena filter).
-->
<script setup lang="ts">
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
  Popup,
  type Map as MapLibreMap,
} from "maplibre-gl";

import type { SkalaUsaha, SpasialUmkmItem } from "~/types/dashboard";

interface Props {
  /** Titik UMKM yang akan ditampilkan di peta. */
  items: SpasialUmkmItem[];
  /** Tinggi container peta; override dengan Tailwind class bila perlu. */
  heightClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  heightClass: "h-[420px] lg:h-[480px]",
});

const containerRef = useTemplateRef<HTMLDivElement>("container");

const skalaColors: Record<SkalaUsaha, { marker: string; label: string }> = {
  mikro: { marker: "#16A75C", label: "Usaha Mikro" },
  kecil: { marker: "#0ea5e9", label: "Usaha Kecil" },
  menengah: { marker: "#fbbf24", label: "Usaha Menengah" },
};

const skalaLabels: Record<SkalaUsaha, string> = {
  mikro: "Mikro",
  kecil: "Kecil",
  menengah: "Menengah",
};

// Titik awal pandang: Jawa Barat
const DEFAULT_CENTER: [number, number] = [107.6, -6.9];
const DEFAULT_ZOOM = 9;

let map: MapLibreMap | null = null;
let markers: Marker[] = [];
let resizeObserver: ResizeObserver | null = null;

const counts = computed(() => {
  const c: Record<SkalaUsaha, number> = { mikro: 0, kecil: 0, menengah: 0 };
  for (const item of props.items) c[item.skala] += 1;
  return c;
});

const formatNumber = (val: number) => new Intl.NumberFormat("id-ID").format(val);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildMarkers = () => {
  // Bersihkan marker lama
  markers.forEach((m) => m.remove());
  markers = [];
  if (!map) return;

  for (const item of props.items) {
    const el = document.createElement("div");
    el.className = "spasial-marker";
    el.title = item.namaUsaha;
    el.style.setProperty("--marker-color", skalaColors[item.skala].marker);

    const popup = new Popup({ offset: 16, closeButton: false, maxWidth: "260px" }).setHTML(
      `
      <div class="spasial-popup">
        <div class="spasial-popup__title">${escapeHtml(item.namaUsaha)}</div>
        <span class="spasial-popup__badge" style="--badge-color:${skalaColors[item.skala].marker}">
          ${skalaLabels[item.skala]}
        </span>
        <div class="spasial-popup__meta">
          ${escapeHtml(item.produkUtama)}
        </div>
        <div class="spasial-popup__meta">
          ${escapeHtml(item.kabupatenKota)} &middot; ${escapeHtml(item.kecamatan)}
        </div>
      </div>
    `
    );

    // anchor "bottom" → ujung pin (bottom-center elemen) yang ditancapkan ke
    // koordinat, sehingga pin tidak melayang/geser saat map di-zoom.
    markers.push(
      new Marker({ element: el, anchor: "bottom" })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(popup)
        .addTo(map)
    );
  }

  if (props.items.length > 0) {
    const bounds = new LngLatBounds();
    props.items.forEach((it) => bounds.extend([it.longitude, it.latitude]));
    map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 600 });
  } else {
    map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
  }
};

onMounted(() => {
  const el = containerRef.value;
  if (!el) return;

  map = new Map({
    container: el,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: false,
    fadeDuration: 0,
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

  map.addControl(new AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-left");

  // Ikuti perubahan ukuran container (mis. saat sidebar/layout berubah)
  resizeObserver = new ResizeObserver(() => map?.resize());
  resizeObserver.observe(el);

  // Marker boleh ditambahkan sebelum style selesai dimuat
  buildMarkers();
});

watch(
  () => props.items,
  () => buildMarkers()
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  markers.forEach((m) => m.remove());
  markers = [];
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="relative overflow-hidden rounded-lg border border-border/80">
    <div ref="container" class="w-full" :class="heightClass" data-lenis-prevent-wheel />

    <!-- Keterangan jumlah titik tampil -->
    <div
      class="pointer-events-none absolute left-3 top-3 z-[5] rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-medium text-[#353432] shadow-md backdrop-blur-xs"
    >
      {{ items.length > 0 ? `${formatNumber(items.length)} titik UMKM tampil` : "Tidak ada data" }}
    </div>

    <!-- Legenda skala usaha -->
    <div
      class="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur-xs"
      aria-hidden="true"
    >
      <div class="mb-1.5 text-[11px] font-bold text-[#323232]">Skala Usaha</div>
      <div class="space-y-1 text-[11px] font-medium text-[#616161]">
        <div v-for="(color, key) in skalaColors" :key="key" class="flex items-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: color.marker }" />
          <span>{{ color.label }}</span>
          <span class="text-[#9e9e9e]">({{ counts[key] }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<!--
  CSS non-scoped: marker & popup dibuat lewat DOM API (bukan template),
  sehingga tidak mendapat atribut scope milik SFC.
-->
<style>
/*
  Pin berdiri di atas MapLibre Marker anchor:'bottom', jadi TIP pin adalah
  bottom-center elemen. Geometri di bawah dibuat agar tip benar-benar berada
  di bottom-center (kepala 20x20 di atas, ekor segitiga 12px di bawahnya).
*/
.spasial-marker {
  width: 22px;
  height: 32px;
  cursor: pointer;
}

/* Kepala pin (lingkaran) */
.spasial-marker::before {
  content: "";
  position: absolute;
  top: 0;
  left: 1px;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: var(--marker-color);
  border: 2.5px solid #ffffff;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* Ekor penanda (segitiga) — tip di bottom-center elemen */
.spasial-marker::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: 0;
  margin-left: -5px;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 12px solid var(--marker-color);
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.25));
}

.spasial-marker:hover::before {
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgb(255 255 255 / 0.9), 0 3px 8px rgb(0 0 0 / 0.35);
}

.maplibregl-popup-content {
  padding: 10px 12px;
  border-radius: 10px;
  font-family: "Lato", sans-serif;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.16);
}

.maplibregl-popup-tip {
  border-top-color: #ffffff !important;
}

.spasial-popup__title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: #212121;
}

.spasial-popup__badge {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  background-color: var(--badge-color);
}

.spasial-popup__meta {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: #616161;
}
</style>
