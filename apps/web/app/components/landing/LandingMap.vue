<!--
  Peta sebaran UMKM Jawa Barat di landing page.
  Memakai ulang komponen peta yang sama persis dengan dashboard
  (DashboardMapChoropleth) plus endpoint data yang sama (/panel/infografis/map),
  agar representasi sebaran konsisten di kedua tempat. Poligon bisa diklik untuk
  drill-down wilayah (kab/kota → kecamatan → kelurahan) dengan breadcrumb
  kembali, mengikuti pola yang sama dengan dashboard; saklar "Titik UMKM"
  disembunyikan karena halaman publik tidak menampilkan titik. Data di-fetch di
  sisi klien (server:false) supaya render server halaman publik tidak
  terpengaruh ketentuan sesi endpoint /panel.
-->
<script setup lang="ts">
import gsap from "gsap";
import { MapPin } from "@lucide/vue";
import type { InfografisRegion } from "~/types/infografis";

const rootRef = useTemplateRef<HTMLElement>("root");
const headerRef = useTemplateRef<HTMLElement>("header");
const mapRef = useTemplateRef<HTMLElement>("map");
let ctx: gsap.Context;

type LandingMapData = {
  regions: InfografisRegion[]
  regionLevel?: "kota" | "kecamatan" | "kelurahan"
};

/** Wilayah yang sedang di-drill-down pada peta (id kosong = level provinsi). */
const drillKota = ref("");
const drillKecamatan = ref("");
const drillKotaName = ref("");
const drillKecamatanName = ref("");

const mapQuery = computed(() => ({
  kota: drillKota.value || undefined,
  kecamatan: drillKecamatan.value || undefined,
}));

const { data: mapData, status } = await useFetch<{ data: LandingMapData }>(
  "/panel/infografis/map",
  { query: mapQuery, server: false },
);

const regions = computed<InfografisRegion[]>(() => mapData.value?.data?.regions ?? []);
const level = computed<"kota" | "kecamatan" | "kelurahan">(() =>
  mapData.value?.data?.regionLevel ?? "kota",
);
// Nuxt mempertahankan data lama saat refetch query drill-down, jadi peta tidak berkedip
// ke state "Memuat" di antara level; fallback hanya muncul saat belum ada data sama sekali.
const mapReady = computed(() => regions.value.length > 0);
const hasError = computed(() => status.value === "error" && regions.value.length === 0);

/** Drill-down satu level saat poligon wilayah diklik (berhenti di level kelurahan). */
function selectRegion(region: InfografisRegion) {
  if (level.value === "kota") {
    drillKota.value = region.id;
    drillKotaName.value = region.name;
    drillKecamatan.value = "";
    drillKecamatanName.value = "";
  } else if (level.value === "kecamatan") {
    drillKecamatan.value = region.id;
    drillKecamatanName.value = region.name;
  }
}

const canGoBack = computed(() => drillKota.value !== "" || drillKecamatan.value !== "");

function goBack() {
  if (drillKecamatan.value !== "") {
    drillKecamatan.value = "";
    drillKecamatanName.value = "";
  } else {
    drillKota.value = "";
    drillKotaName.value = "";
  }
}

/** Jejak breadcrumb wilayah terpilih: Jawa Barat › Kota › Kecamatan. */
const selectionLabel = computed(() => {
  const parts = ["Jawa Barat"];
  if (drillKotaName.value) parts.push(drillKotaName.value);
  if (drillKecamatanName.value) parts.push(drillKecamatanName.value);
  return parts.join(" › ");
});

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from([headerRef.value!, mapRef.value!], {
      y: 30,
      opacity: 0,
      duration: 0.75,
      stagger: 0.15,
      ease: "power2.out",
      scrollTrigger: {
        trigger: rootRef.value!,
        start: "top 80%",
        once: true,
      },
    });
  }, rootRef.value!);
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <section id="section-map" ref="root" role="region" aria-label="Sebaran UMKM Jawa Barat" class="relative isolate overflow-x-clip py-16 lg:py-20">
    <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
      <div class="grid gap-8 lg:grid-cols-12">
        <!-- Heading -->
        <div ref="header" class="col-span-full lg:col-span-6 lg:col-start-4">
          <div class="flex flex-col items-center gap-4 text-center lg:gap-6">
            <span class="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-800"> UMKM Jawa Barat </span>
            <h2 class="text-balance font-semibold uppercase leading-none text-5xl">Sebaran UMKM Jawa Barat</h2>
          </div>
        </div>

        <!-- Peta (sama dengan dashboard) -->
        <div ref="map" class="col-span-full">
          <div class="relative overflow-clip rounded-xl bg-slate-100 ring-1 ring-black/5">
            <DashboardMapChoropleth
              v-if="mapReady"
              :regions="regions"
              :level="level"
              :show-regions="true"
              :show-points="false"
              :hide-points-switcher="true"
              @select="selectRegion"
            />

            <!-- Breadcrumb wilayah: klik untuk kembali satu tingkat drill-down -->
            <div
              v-if="mapReady"
              class="absolute left-3 top-3 z-[6] flex w-fit flex-col gap-1 rounded-xl border bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-xs"
              :class="canGoBack ? 'cursor-pointer hover:bg-slate-50' : ''"
              :role="canGoBack ? 'button' : undefined"
              :tabindex="canGoBack ? 0 : undefined"
              :aria-label="canGoBack ? 'Kembali ke tingkat wilayah sebelumnya' : undefined"
              @click="canGoBack && goBack()"
              @keydown.enter="canGoBack && goBack()"
            >
              <span class="font-bold text-slate-800">Wilayah</span>
              <span class="flex items-center gap-1 text-slate-600">
                <span class="text-slate-400" aria-hidden="true">›</span>
                <span class="font-medium">{{ selectionLabel }}</span>
              </span>
            </div>
            <!-- State transisi / gagal muat -->
            <div
              v-if="!mapReady"
              class="flex h-[480px] w-full flex-col items-center justify-center gap-3 text-center lg:h-[620px]"
              aria-live="polite"
            >
              <MapPin class="size-5" aria-hidden="true" />
              <p class="text-sm font-medium text-slate-500">
                {{
                  hasError
                    ? "Peta sebaran UMKM belum dapat ditampilkan saat ini. Silakan coba lagi."
                    : "Memuat peta sebaran UMKM…"
                }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
