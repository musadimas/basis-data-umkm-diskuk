<script setup lang="ts">
import { readItems } from "@directus/sdk";
import { Accessibility, CalendarDays, ChevronLeft, ChevronRight, MapPin, Monitor, Users } from "@lucide/vue";
import { assetUrl } from "~/constants";
import {
  KATEGORI_KEGIATAN,
  METODE_LABEL,
  STATUS_KEGIATAN,
  hariJakarta,
  kegiatanPadaHari,
  monthGrid,
  statusKegiatan,
  type StatusKegiatan,
} from "~/lib/kegiatan";
import type { KategoriKegiatan, Kegiatan } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Agenda Kegiatan UMKM – Diskuk Jawa Barat",
  description: "Kalender pelatihan, pameran, bazar, dan temu bisnis untuk UMKM Jawa Barat.",
});

const FIELDS = [
  "id", "judul", "ringkasan", "kategori", "penyelenggara", "kota_nama", "metode", "ramah_disabilitas", "tanggal_mulai",
  "tanggal_selesai", "batas_registrasi", "lokasi", "link", "kuota", "terisi", "silabus", "narasumber", "fasilitas", "syarat", "poster",
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const STATUS_ORDER: StatusKegiatan[] = ["berjalan", "pendaftaran", "segera", "selesai"];

const directus = useDirectus();
// Everything from 90 days ago onward: small enough to filter in the browser.
const { data, error } = await useAsyncData("kegiatan", async () => {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const items = await directus.request(
    readItems("kegiatan", { fields: FIELDS, filter: { tanggal_selesai: { _gte: since } }, sort: ["tanggal_mulai"], limit: 300 } as never),
  );
  return (Array.isArray(items) ? items : []) as Kegiatan[];
});

const filters = reactive({ kategori: "" as KategoriKegiatan | "", penyelenggara: "", metode: "", ramah: false });
const penyelenggaraOptions = computed(() => [...new Set((data.value ?? []).map((item) => item.penyelenggara).filter((value): value is string => Boolean(value)))].sort());
const list = computed(() =>
  (data.value ?? []).filter(
    (item) =>
      (!filters.kategori || item.kategori === filters.kategori) &&
      (!filters.penyelenggara || item.penyelenggara === filters.penyelenggara) &&
      (!filters.metode || item.metode === filters.metode) &&
      (!filters.ramah || item.ramah_disabilitas),
  ),
);

// Re-read on mount so a server-rendered page groups events by the visitor's current time.
const now = ref(new Date());
onMounted(() => (now.value = new Date()));
const grouped = computed(() => {
  const groups = Object.fromEntries(STATUS_ORDER.map((status) => [status, [] as Kegiatan[]])) as Record<StatusKegiatan, Kegiatan[]>;
  for (const item of list.value) groups[statusKegiatan(item, now.value)].push(item);
  groups.selesai.reverse();
  return groups;
});

const today = hariJakarta(new Date());
const month = ref({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
const grid = computed(() => monthGrid(month.value.year, month.value.month));
const monthLabel = computed(() => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(month.value.year, month.value.month, 1))));
function shiftMonth(delta: number) {
  const next = new Date(Date.UTC(month.value.year, month.value.month + delta, 1));
  month.value = { year: next.getUTCFullYear(), month: next.getUTCMonth() };
}

const active = ref<Kegiatan | null>(null);
const waktu = (item: Kegiatan) => {
  const format = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
  return `${format.format(new Date(item.tanggal_mulai))} – ${format.format(new Date(item.tanggal_selesai))} WIB`;
};
const tanggalPendek = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Agenda Kegiatan" subtitle="Kalender" badge-color="#cbd5e1" />

    <div class="mx-auto grid max-w-7xl gap-8 px-3 pb-20 | lg:px-12 xl:px-0">
      <div v-if="error" role="alert" class="rounded-xl border border-destructive/30 p-6 text-sm text-destructive">Agenda tidak dapat dimuat. Coba beberapa saat lagi.</div>

      <!-- Filters -->
      <div class="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" role="group" aria-label="Filter kegiatan">
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Kategori
          <select v-model="filters.kategori" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="(meta, key) in KATEGORI_KEGIATAN" :key="key" :value="key">{{ meta.label }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Penyelenggara
          <select v-model="filters.penyelenggara" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="item in penyelenggaraOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Metode
          <select v-model="filters.metode" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="(label, key) in METODE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="flex h-9 items-center gap-2 text-sm"><UiCheckbox v-model="filters.ramah" /> Ramah disabilitas</label>
      </div>

      <div class="grid gap-8 | lg:grid-cols-[1fr_22rem]">
        <!-- Month calendar -->
        <section class="rounded-xl border bg-card p-4" aria-label="Kalender bulanan">
          <div class="mb-3 flex items-center justify-between">
            <button type="button" class="rounded-md p-2 hover:bg-muted" aria-label="Bulan sebelumnya" @click="shiftMonth(-1)"><ChevronLeft class="size-4" /></button>
            <h2 class="text-base font-bold capitalize" data-testid="bulan">{{ monthLabel }}</h2>
            <button type="button" class="rounded-md p-2 hover:bg-muted" aria-label="Bulan berikutnya" @click="shiftMonth(1)"><ChevronRight class="size-4" /></button>
          </div>
          <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            <span v-for="day in WEEKDAYS" :key="day">{{ day }}</span>
          </div>
          <div class="mt-1 grid grid-cols-7 gap-1">
            <template v-for="(week, w) in grid" :key="w">
              <div
                v-for="(day, d) in week"
                :key="`${w}-${d}`"
                class="group relative min-h-12 min-w-0 rounded-md border p-1 text-left text-xs sm:min-h-16"
                :class="[day ? 'bg-background' : 'border-transparent', day === today && 'ring-2 ring-primary']"
              >
                <template v-if="day">
                  <span class="font-semibold">{{ Number(day.slice(8)) }}</span>
                  <ul class="mt-0.5 flex min-w-0 flex-wrap gap-0.5 sm:grid">
                    <li v-for="item in kegiatanPadaHari(list, day).slice(0, 2)" :key="item.id">
                      <button type="button" class="flex w-full min-w-0 items-center gap-1 rounded px-0.5 text-left hover:bg-muted" :title="item.judul" :aria-label="item.judul" @click="active = item">
                        <span class="size-2 shrink-0 rounded-full sm:size-1.5" :class="KATEGORI_KEGIATAN[item.kategori].dot" aria-hidden="true" />
                        <span class="hidden min-w-0 truncate sm:inline">{{ item.judul }}</span>
                      </button>
                    </li>
                  </ul>
                  <span v-if="kegiatanPadaHari(list, day).length > 2" class="text-[10px] text-muted-foreground">+{{ kegiatanPadaHari(list, day).length - 2 }} lagi</span>
                  <!-- Hover popover with every event of the day -->
                  <div
                    v-if="kegiatanPadaHari(list, day).length"
                    class="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-md border bg-popover p-2 text-left text-xs shadow-lg group-hover:visible"
                    role="tooltip"
                  >
                    <p v-for="item in kegiatanPadaHari(list, day)" :key="item.id" class="py-0.5">
                      <span class="font-semibold">{{ item.judul }}</span><br>
                      <span class="text-muted-foreground">{{ KATEGORI_KEGIATAN[item.kategori].label }} · {{ METODE_LABEL[item.metode] }}</span>
                    </p>
                  </div>
                </template>
              </div>
            </template>
          </div>
          <ul class="mt-3 flex flex-wrap gap-3 text-xs">
            <li v-for="(meta, key) in KATEGORI_KEGIATAN" :key="key" class="flex items-center gap-1"><span class="size-2 rounded-full" :class="meta.dot" /> {{ meta.label }}</li>
          </ul>
        </section>

        <!-- Timeline by status -->
        <section class="grid content-start gap-5" aria-label="Linimasa kegiatan">
          <div v-for="status in STATUS_ORDER" :key="status" :data-testid="`status-${status}`">
            <h2 class="mb-2 flex items-center gap-2 text-sm font-bold">
              <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_KEGIATAN[status].className">{{ STATUS_KEGIATAN[status].label }}</span>
              <span class="text-muted-foreground">({{ grouped[status].length }})</span>
            </h2>
            <p v-if="!grouped[status].length" class="text-xs text-muted-foreground">Tidak ada kegiatan.</p>
            <ul class="grid gap-2">
              <li v-for="item in grouped[status].slice(0, status === 'selesai' ? 5 : 20)" :key="item.id">
                <button type="button" class="grid w-full gap-1 rounded-lg border bg-card p-3 text-left text-sm hover:shadow" @click="active = item">
                  <span class="flex items-center gap-2">
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-bold" :class="KATEGORI_KEGIATAN[item.kategori].className">{{ KATEGORI_KEGIATAN[item.kategori].label }}</span>
                    <span class="text-xs text-muted-foreground">{{ tanggalPendek(item.tanggal_mulai) }}</span>
                  </span>
                  <span class="font-semibold leading-snug">{{ item.judul }}</span>
                  <span class="text-xs text-muted-foreground">{{ METODE_LABEL[item.metode] }}<template v-if="item.kota_nama"> · {{ item.kota_nama }}</template></span>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>

    <UiDialog :open="Boolean(active)" @update:open="(value) => !value && (active = null)">
      <UiDialogScrollContent v-if="active" class="sm:max-w-2xl">
        <UiDialogHeader>
          <div class="flex flex-wrap gap-2">
            <span class="rounded px-1.5 py-0.5 text-[11px] font-bold" :class="KATEGORI_KEGIATAN[active.kategori].className">{{ KATEGORI_KEGIATAN[active.kategori].label }}</span>
            <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_KEGIATAN[statusKegiatan(active, now)].className">{{ STATUS_KEGIATAN[statusKegiatan(active, now)].label }}</span>
          </div>
          <UiDialogTitle>{{ active.judul }}</UiDialogTitle>
          <UiDialogDescription v-if="active.penyelenggara">Diselenggarakan oleh {{ active.penyelenggara }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 text-sm">
          <img v-if="active.poster" :src="assetUrl(active.poster, 800)" :alt="`Poster ${active.judul}`" class="max-h-72 w-full rounded-lg object-cover">
          <ul class="grid gap-1.5">
            <li class="flex gap-2"><CalendarDays class="size-4 shrink-0" aria-hidden="true" /> {{ waktu(active) }}</li>
            <li class="flex gap-2"><Monitor class="size-4 shrink-0" aria-hidden="true" /> {{ METODE_LABEL[active.metode] }}</li>
            <li v-if="active.lokasi || active.kota_nama" class="flex gap-2"><MapPin class="size-4 shrink-0" aria-hidden="true" /> {{ [active.lokasi, active.kota_nama].filter(Boolean).join(", ") }}</li>
            <li v-if="active.kuota !== null" class="flex gap-2"><Users class="size-4 shrink-0" aria-hidden="true" /> Kuota {{ active.terisi }}/{{ active.kuota }} peserta</li>
            <li v-if="active.ramah_disabilitas" class="flex gap-2"><Accessibility class="size-4 shrink-0" aria-hidden="true" /> Ramah disabilitas</li>
          </ul>
          <p v-if="active.ringkasan" class="whitespace-pre-line">{{ active.ringkasan }}</p>
          <template v-for="[label, value] in ([['Silabus', active.silabus], ['Narasumber', active.narasumber], ['Fasilitas', active.fasilitas], ['Persyaratan', active.syarat]] as [string, string | null][])" :key="label">
            <div v-if="value">
              <h3 class="font-bold">{{ label }}</h3>
              <p class="whitespace-pre-line text-muted-foreground">{{ value }}</p>
            </div>
          </template>
        </div>
        <UiDialogFooter class="items-center gap-2">
          <span class="text-xs text-muted-foreground">Pendaftaran online segera hadir.</span>
          <UiButton disabled>Daftar</UiButton>
        </UiDialogFooter>
      </UiDialogScrollContent>
    </UiDialog>
  </div>
</template>
