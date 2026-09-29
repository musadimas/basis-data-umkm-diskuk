<script setup lang="ts">
import { Accessibility, BellRing, CalendarDays, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, FileText, MapPin, Monitor, RotateCcw, Users } from "@lucide/vue";
import { assetUrl } from "~/constants";
import { endpoint } from "~/lib/directus";
import {
  FILTER_KOSONG,
  KATEGORI_KEGIATAN,
  METODE_LABEL,
  STATUS_KEGIATAN,
  STATUS_URUT,
  batasRegistrasiTeks,
  filterDariQuery,
  hariIniJakarta,
  jadwalPengingatTeks,
  kegiatanPadaHari,
  labelBulan,
  monthGrid,
  queryKegiatan,
  sisaKuotaTeks,
  tanggalPendek,
  tindakanKegiatan,
  waktuKegiatan,
} from "~/lib/kegiatan";
import { requestErrorCode } from "~/lib/request-error";
import type { KegiatanAgenda, KegiatanFilters, KegiatanListResponse, KegiatanMeta, KegiatanPengingat } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Agenda Kegiatan UMKM – Diskuk Jawa Barat",
  description: "Kalender pelatihan, sertifikasi, pameran, akselerasi talenta, dan literasi digital untuk UMKM Jawa Barat.",
});

const KOSONG_META: KegiatanMeta = {
  serverNow: new Date(0).toISOString(),
  jumlah: 0,
  terpotong: false,
  kelompok: { berjalan: 0, pendaftaran: 0, segera: 0, selesai: 0 },
  bulan: null,
  tahun: null,
  opsi: { kategori: [], metode: [], penyelenggara: [] },
};

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const directus = useDirectus();
const route = useRoute();
const router = useRouter();

const filters = reactive<KegiatanFilters>({ ...FILTER_KOSONG, ...filterDariQuery(route.query) });
const hariIni = hariIniJakarta();
const bulan = ref({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) });

/** Both lists are read from the API so the filters, the counts and the status come from the server. */
async function ambilAgenda(extra: Record<string, string> = {}) {
  const payload = await directus.request(
    endpoint<KegiatanListResponse>("/v1/program/kegiatan", { query: { ...queryKegiatan(filters), ...extra } }),
  );
  return payload ?? { items: [], meta: KOSONG_META };
}

const { data: agenda, error: agendaError, pending, refresh } = await useAsyncData("kegiatan:agenda", () => ambilAgenda());
const { data: kalender, error: kalenderError, refresh: refreshKalender } = await useAsyncData("kegiatan:bulan", () =>
  ambilAgenda({ bulan: String(bulan.value.bulan), tahun: String(bulan.value.tahun) }),
);

// Filters live in the URL, so a shared link keeps the same server query.
watch(filters, async () => {
  await router.replace({ query: queryKegiatan(filters) });
  await Promise.all([refresh(), refreshKalender()]);
});
watch(bulan, () => refreshKalender());

const meta = computed(() => agenda.value?.meta ?? KOSONG_META);
const penyelenggaraOpsi = computed(() => meta.value.opsi.penyelenggara);
const daftarKalender = computed(() => kalender.value?.items ?? []);

const kelompok = computed(() => {
  const groups: Record<string, KegiatanAgenda[]> = {};
  for (const status of STATUS_URUT) groups[status] = [];
  for (const item of agenda.value?.items ?? []) groups[item.status]?.push(item);
  groups.selesai?.reverse();
  return groups;
});

const grid = computed(() => monthGrid(bulan.value.tahun, bulan.value.bulan));
const labelBulanAktif = computed(() => labelBulan(bulan.value.tahun, bulan.value.bulan));
const hariIniTerlihat = computed(() => `${bulan.value.tahun}-${String(bulan.value.bulan).padStart(2, "0")}` === hariIni.slice(0, 7));
/** Day whose focus card is pinned by tap/click (hover alone is not enough on mobile). */
const hariTerpilih = ref<string | null>(null);

function geserBulan(delta: number) {
  hariTerpilih.value = null;
  const next = new Date(Date.UTC(bulan.value.tahun, bulan.value.bulan - 1 + delta, 1));
  bulan.value = { tahun: next.getUTCFullYear(), bulan: next.getUTCMonth() + 1 };
}

function keHariIni() {
  bulan.value = { tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) };
  hariTerpilih.value = hariIni;
}

function resetFilter() {
  Object.assign(filters, FILTER_KOSONG);
}

// ── Detail & CTA ───────────────────────────────────────────────────────────

const active = ref<KegiatanAgenda | null>(null);

function bukaDetail(item: KegiatanAgenda) {
  active.value = item;
}

// ── Reminder opt-in (M7-09) ────────────────────────────────────────────────

interface PengingatLokal {
  kanal: "email" | "whatsapp";
  tujuanMasked: string;
  jadwalKirim: string;
  status: KegiatanPengingat["status"];
  batalToken: string;
}

const KUNCI_SIMPAN = "diskuk:pengingat-kegiatan";
const pengingat = ref<Record<string, PengingatLokal>>({});
const pengingatUntuk = ref<KegiatanAgenda | null>(null);
const form = reactive<{ kanal: "email" | "whatsapp"; tujuan: string }>({ kanal: "email", tujuan: "" });
const captcha = useTemplateRef<{ solve: () => Promise<string | null>; reset: () => void }>("captcha");
const mengirim = ref(false);
const pesanPengingat = ref<{ tone: "success" | "error"; text: string } | null>(null);
/** Outcome of a reminder action taken outside the dialog (cancellation), announced in the timeline. */
const pesanAksi = ref<string | null>(null);
/** Set once the page has hydrated; the browser proof waits for it before interacting. */
const terhidrasi = ref(false);

onMounted(() => {
  terhidrasi.value = true;
  try {
    const tersimpan = localStorage.getItem(KUNCI_SIMPAN);
    if (tersimpan) pengingat.value = JSON.parse(tersimpan);
  } catch {
    pengingat.value = {};
  }
});

function simpanLokal() {
  try {
    localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(pengingat.value));
  } catch {
    // A blocked storage must not break the page; the reminder is already stored on the server.
  }
}

function bukaPengingat(item: KegiatanAgenda) {
  pengingatUntuk.value = item;
  form.tujuan = "";
  pesanPengingat.value = null;
}

async function kirimPengingat() {
  const item = pengingatUntuk.value;
  if (!item) return;
  pesanPengingat.value = null;
  if (!form.tujuan.trim()) {
    pesanPengingat.value = { tone: "error", text: form.kanal === "email" ? "Isi alamat email." : "Isi nomor WhatsApp." };
    return;
  }
  mengirim.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      pesanPengingat.value = { tone: "error", text: "Verifikasi captcha belum selesai." };
      return;
    }
    const hasil = await directus.request(
      endpoint<KegiatanPengingat, Record<string, string>>(`/v1/program/kegiatan/${encodeURIComponent(item.id)}/pengingat`, {
        method: "POST",
        body: { kanal: form.kanal, tujuan: form.tujuan.trim(), captcha: token },
      }),
    );
    pengingat.value[item.id] = {
      kanal: hasil.kanal,
      tujuanMasked: hasil.tujuanMasked,
      jadwalKirim: hasil.jadwalKirim,
      status: hasil.status,
      batalToken: hasil.batalToken,
    };
    simpanLokal();
    pesanPengingat.value = {
      tone: "success",
      text:
        hasil.status === "menunggu_gateway"
          ? `Pengingat WhatsApp untuk ${hasil.tujuanMasked} tercatat, tetapi gateway resmi belum tersedia sehingga belum ada pesan yang dikirim.`
          : `Pengingat untuk ${hasil.tujuanMasked} aktif. ${jadwalPengingatTeks(hasil.jadwalKirim)}.`,
    };
  } catch (cause) {
    const code = requestErrorCode(cause);
    pesanPengingat.value = {
      tone: "error",
      text:
        code === "CAPTCHA_INVALID"
          ? "Captcha kedaluwarsa. Centang ulang lalu kirim."
          : code === "TUJUAN_TIDAK_VALID"
            ? form.kanal === "email"
              ? "Alamat email tidak valid."
              : "Nomor WhatsApp tidak valid. Gunakan format 08xx atau 628xx."
            : code === "KEGIATAN_SELESAI"
              ? "Kegiatan ini sudah selesai, pengingat tidak diperlukan lagi."
              : "Pengingat tidak dapat disimpan. Coba lagi beberapa saat.",
    };
  } finally {
    captcha.value?.reset();
    mengirim.value = false;
  }
}

async function batalkanPengingat(item: KegiatanAgenda) {
  const tersimpan = pengingat.value[item.id];
  if (!tersimpan) return;
  try {
    await directus.request(
      endpoint<{ status: string }, Record<string, string>>("/v1/program/kegiatan/pengingat/batal", {
        method: "POST",
        body: { token: tersimpan.batalToken },
      }),
    );
    const { [item.id]: _hapus, ...sisa } = pengingat.value;
    pengingat.value = sisa;
    simpanLokal();
    pesanAksi.value = "Pengingat dibatalkan.";
  } catch {
    pesanAksi.value = "Pengingat tidak dapat dibatalkan sekarang.";
  }
}
</script>

<template>
  <div class="min-h-dvh" :data-terhidrasi="terhidrasi ? '1' : undefined">
    <LandingHeaderMask title="Agenda Kegiatan" subtitle="Kalender" badge-color="#cbd5e1" />

    <div class="mx-auto grid max-w-7xl gap-8 px-3 pb-20 | lg:px-12 xl:px-0">
      <div v-if="agendaError" role="alert" class="rounded-xl border border-destructive/30 p-6 text-sm text-destructive">
        Agenda tidak dapat dimuat. Coba beberapa saat lagi.
      </div>

      <!-- Filters: sent to the server, so the result and its count are always the server's -->
      <div class="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" role="group" aria-label="Filter kegiatan">
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Kategori
          <select v-model="filters.kategori" data-testid="filter-kategori" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="(kategoriMeta, key) in KATEGORI_KEGIATAN" :key="key" :value="key">{{ kategoriMeta.label }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Penyelenggara
          <select v-model="filters.penyelenggara" data-testid="filter-penyelenggara" class="h-9 max-w-64 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="item in penyelenggaraOpsi" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-semibold text-muted-foreground">
          Metode
          <select v-model="filters.metode" data-testid="filter-metode" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm font-normal text-foreground">
            <option value="">Semua</option>
            <option v-for="(label, key) in METODE_LABEL" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="flex h-9 items-center gap-2 text-sm"><UiCheckbox v-model="filters.ramah" /> Ramah disabilitas</label>
        <div class="flex items-center gap-2">
          <UiButton type="button" variant="outline" size="sm" @click="keHariIni"><CalendarClock class="size-4" /> Hari ini</UiButton>
          <UiButton type="button" variant="ghost" size="sm" data-testid="reset-filter" @click="resetFilter"><RotateCcw class="size-4" /> Reset</UiButton>
        </div>
        <p class="w-full text-xs text-muted-foreground" data-testid="jumlah-hasil">
          {{ meta.jumlah }} kegiatan sesuai filter · {{ meta.opsi.penyelenggara.length }} penyelenggara tersedia
        </p>
      </div>

      <div class="grid gap-8 | lg:grid-cols-[1fr_22rem]">
        <!-- Month calendar -->
        <section class="rounded-xl border bg-card p-4" aria-label="Kalender bulanan">
          <div class="mb-3 flex items-center justify-between">
            <button type="button" class="rounded-md p-2 hover:bg-muted" aria-label="Bulan sebelumnya" @click="geserBulan(-1)"><ChevronLeft class="size-4" /></button>
            <h2 class="text-base font-bold capitalize" data-testid="bulan">{{ labelBulanAktif }}</h2>
            <button type="button" class="rounded-md p-2 hover:bg-muted" aria-label="Bulan berikutnya" @click="geserBulan(1)"><ChevronRight class="size-4" /></button>
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
                :class="[day ? 'bg-background' : 'border-transparent', day === hariIni && 'ring-2 ring-primary']"
              >
                <template v-if="day">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-1"
                    :aria-label="`Agenda ${day}`"
                    :aria-expanded="hariTerpilih === day"
                    :data-testid="`hari-${day}`"
                    @click="hariTerpilih = hariTerpilih === day ? null : day"
                  >
                    <span class="font-semibold">{{ Number(day.slice(8)) }}</span>
                    <span v-if="kegiatanPadaHari(daftarKalender, day).length" class="size-2 rounded-full" :class="KATEGORI_KEGIATAN[kegiatanPadaHari(daftarKalender, day)[0]!.kategori].dot" aria-hidden="true" />
                  </button>
                  <ul class="mt-0.5 flex min-w-0 flex-wrap gap-0.5 sm:grid">
                    <li v-for="item in kegiatanPadaHari(daftarKalender, day).slice(0, 2)" :key="item.id">
                      <button type="button" class="flex w-full min-w-0 items-center gap-1 rounded px-0.5 text-left hover:bg-muted" :title="item.judul" :aria-label="item.judul" @click="bukaDetail(item)">
                        <span class="size-2 shrink-0 rounded-full sm:size-1.5" :class="KATEGORI_KEGIATAN[item.kategori].dot" aria-hidden="true" />
                        <span class="hidden min-w-0 truncate sm:inline">{{ item.judul }}</span>
                      </button>
                    </li>
                  </ul>
                  <span v-if="kegiatanPadaHari(daftarKalender, day).length > 2" class="text-[10px] text-muted-foreground">
                    +{{ kegiatanPadaHari(daftarKalender, day).length - 2 }} lagi
                  </span>
                  <!-- Focus card: hover on desktop, tap on mobile (M7-09) -->
                  <div
                    v-if="kegiatanPadaHari(daftarKalender, day).length"
                    class="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md border bg-popover p-2 text-left text-xs shadow-lg"
                    :class="hariTerpilih === day ? 'visible' : 'invisible group-hover:visible'"
                    :data-testid="`fokus-${day}`"
                    role="tooltip"
                  >
                    <p v-for="item in kegiatanPadaHari(daftarKalender, day)" :key="item.id" class="border-b py-1 last:border-0">
                      <span class="font-semibold">{{ item.judul }}</span><br>
                      <span class="text-muted-foreground">{{ KATEGORI_KEGIATAN[item.kategori].label }} · {{ [item.metodeLabel, item.lokasi ?? item.kotaNama].filter(Boolean).join(" · ") }}</span><br>
                      <span v-if="sisaKuotaTeks(item)" class="text-muted-foreground">{{ sisaKuotaTeks(item) }}</span>
                      <span v-if="batasRegistrasiTeks(item)" class="text-muted-foreground"> · {{ batasRegistrasiTeks(item) }}</span>
                    </p>
                  </div>
                </template>
              </div>
            </template>
          </div>
          <p v-if="kalenderError" role="alert" class="mt-3 text-xs text-destructive">Kalender bulan ini tidak dapat dimuat.</p>
          <p v-else-if="!daftarKalender.length" class="mt-3 text-xs text-muted-foreground" data-testid="kalender-kosong">Belum ada kegiatan pada bulan ini.</p>
          <p v-if="hariIniTerlihat" class="mt-2 text-xs text-muted-foreground">Hari ini: {{ hariIni }} (WIB)</p>
          <ul class="mt-3 flex flex-wrap gap-3 text-xs">
            <li v-for="(item, key) in KATEGORI_KEGIATAN" :key="key" class="flex items-center gap-1"><span class="size-2 rounded-full" :class="item.dot" /> {{ item.label }}</li>
          </ul>
        </section>

        <!-- Timeline by status -->
        <section class="grid content-start gap-5" aria-label="Linimasa kegiatan" :aria-busy="pending">
          <p v-if="pesanAksi" role="status" class="text-xs text-emerald-700" data-testid="pesan-aksi">{{ pesanAksi }}</p>
          <div v-for="status in STATUS_URUT" :key="status" :data-testid="`status-${status}`">
            <h2 class="mb-2 flex items-center gap-2 text-sm font-bold">
              <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_KEGIATAN[status].className">{{ STATUS_KEGIATAN[status].label }}</span>
              <span class="text-muted-foreground">({{ meta.kelompok[status] }})</span>
            </h2>
            <p v-if="!kelompok[status]?.length" class="text-xs text-muted-foreground">Tidak ada kegiatan.</p>
            <ul class="grid gap-2">
              <li v-for="item in kelompok[status]?.slice(0, 20)" :key="item.id">
                <article class="grid gap-2 rounded-lg border bg-card p-3 text-sm">
                  <button type="button" class="grid gap-1 text-left" @click="bukaDetail(item)">
                    <span class="flex items-center gap-2">
                      <span class="rounded px-1.5 py-0.5 text-[10px] font-bold" :class="KATEGORI_KEGIATAN[item.kategori].className">{{ KATEGORI_KEGIATAN[item.kategori].label }}</span>
                      <span class="text-xs text-muted-foreground">{{ tanggalPendek(item.tanggalMulai) }}</span>
                      <span v-if="item.ramahDisabilitas" class="text-xs text-muted-foreground" title="Ramah disabilitas"><Accessibility class="size-3.5" /></span>
                    </span>
                    <span class="font-semibold leading-snug">{{ item.judul }}</span>
                    <span class="text-xs text-muted-foreground">{{ item.metodeLabel }}<template v-if="item.kotaNama"> · {{ item.kotaNama }}</template></span>
                  </button>
                  <div class="flex flex-wrap items-center gap-2">
                    <NuxtLink
                      v-if="tindakanKegiatan(item).href && tindakanKegiatan(item).internal"
                      :to="tindakanKegiatan(item).href!"
                      class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      :data-testid="`cta-${item.id}`"
                    >
                      {{ tindakanKegiatan(item).label }}
                    </NuxtLink>
                    <a
                      v-else-if="tindakanKegiatan(item).href"
                      :href="tindakanKegiatan(item).href!"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      :data-testid="`cta-${item.id}`"
                    >
                      {{ tindakanKegiatan(item).label }}
                    </a>
                    <UiButton
                      v-else-if="tindakanKegiatan(item).jenis === 'pengingat' && !pengingat[item.id]"
                      type="button"
                      size="sm"
                      :data-testid="`cta-${item.id}`"
                      @click="bukaPengingat(item)"
                    >
                      <BellRing class="size-4" /> {{ tindakanKegiatan(item).label }}
                    </UiButton>
                    <span v-else-if="pengingat[item.id]" class="inline-flex items-center gap-1 text-xs text-emerald-700" :data-testid="`pengingat-aktif-${item.id}`">
                      <CheckCircle2 class="size-4" /> Pengingat aktif ({{ pengingat[item.id]!.tujuanMasked }})
                      <UiButton type="button" variant="ghost" size="sm" :data-testid="`ubah-${item.id}`" @click="bukaPengingat(item)">Ubah</UiButton>
                      <UiButton type="button" variant="ghost" size="sm" :data-testid="`batal-${item.id}`" @click="batalkanPengingat(item)">Batalkan</UiButton>
                    </span>
                    <UiButton v-else type="button" size="sm" variant="outline" disabled :data-testid="`cta-${item.id}`">{{ tindakanKegiatan(item).label }}</UiButton>
                    <span v-if="tindakanKegiatan(item).nonaktif" class="text-xs text-muted-foreground">{{ tindakanKegiatan(item).pesan }}</span>
                  </div>
                </article>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>

    <!-- Detail (M7-10) -->
    <UiDialog :open="Boolean(active)" @update:open="(value) => !value && (active = null)">
      <UiDialogScrollContent v-if="active" class="sm:max-w-2xl">
        <UiDialogHeader>
          <div class="flex flex-wrap gap-2">
            <span class="rounded px-1.5 py-0.5 text-[11px] font-bold" :class="KATEGORI_KEGIATAN[active.kategori].className">{{ active.kategoriLabel }}</span>
            <span class="rounded-full px-2 py-0.5 text-[11px]" :class="STATUS_KEGIATAN[active.status].className">{{ active.statusLabel }}</span>
          </div>
          <UiDialogTitle>{{ active.judul }}</UiDialogTitle>
          <UiDialogDescription v-if="active.penyelenggara">Diselenggarakan oleh {{ active.penyelenggara }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 text-sm">
          <img v-if="active.poster" :src="assetUrl(active.poster, 800)" :alt="`Poster ${active.judul}`" class="max-h-72 w-full rounded-lg object-cover">
          <ul class="grid gap-1.5">
            <li class="flex gap-2"><CalendarDays class="size-4 shrink-0" aria-hidden="true" /> {{ waktuKegiatan(active) }}</li>
            <li class="flex gap-2"><Monitor class="size-4 shrink-0" aria-hidden="true" /> {{ active.metodeLabel }}</li>
            <li v-if="active.lokasi || active.kotaNama" class="flex gap-2"><MapPin class="size-4 shrink-0" aria-hidden="true" /> {{ [active.lokasi, active.kotaNama].filter(Boolean).join(", ") }}</li>
            <li v-if="sisaKuotaTeks(active)" class="flex gap-2"><Users class="size-4 shrink-0" aria-hidden="true" /> {{ sisaKuotaTeks(active) }}</li>
            <li v-if="active.ramahDisabilitas" class="flex gap-2"><Accessibility class="size-4 shrink-0" aria-hidden="true" /> Ramah disabilitas</li>
          </ul>
          <p v-if="active.ringkasan" class="whitespace-pre-line">{{ active.ringkasan }}</p>
          <template v-for="[label, value] in ([['Silabus', active.silabus], ['Narasumber', active.narasumber], ['Fasilitas', active.fasilitas], ['Persyaratan lain', active.syarat.catatan]] as [string, string | null][])" :key="label">
            <div v-if="value">
              <h3 class="font-bold">{{ label }}</h3>
              <p class="whitespace-pre-line text-muted-foreground">{{ value }}</p>
            </div>
          </template>
          <div>
            <h3 class="font-bold">Syarat peserta</h3>
            <ul class="list-inside list-disc text-muted-foreground">
              <li v-if="active.syarat.skala">Skala usaha: {{ active.syarat.skala }}</li>
              <li v-if="active.syarat.wilayah">Wilayah: {{ active.syarat.wilayah }}</li>
              <li>{{ active.syarat.nib ? "Wajib memiliki NIB" : "NIB tidak diwajibkan" }}</li>
              <li v-if="!active.syarat.skala && !active.syarat.wilayah && !active.syarat.nib">Tidak ada syarat khusus yang dicantumkan penyelenggara.</li>
            </ul>
          </div>
          <div v-if="active.dokumenUrl || active.materiUrl || active.registrationUrl || active.tautanDaring" class="flex flex-wrap gap-2">
            <a v-if="active.dokumenUrl" :href="active.dokumenUrl" target="_blank" rel="noopener noreferrer" class="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold hover:bg-muted">
              <FileText class="size-4" /> Dokumen pendukung
            </a>
            <a v-if="active.materiUrl" :href="active.materiUrl" target="_blank" rel="noopener noreferrer" class="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold hover:bg-muted">
              <FileText class="size-4" /> Materi & dokumentasi
            </a>
            <a v-if="active.registrationUrl" :href="active.registrationUrl" target="_blank" rel="noopener noreferrer" class="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold hover:bg-muted">
              <FileText class="size-4" /> Tautan pendaftaran resmi
            </a>
            <a v-if="active.tautanDaring" :href="active.tautanDaring" target="_blank" rel="noopener noreferrer" class="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold hover:bg-muted">
              <Monitor class="size-4" /> Tautan daring/presensi
            </a>
          </div>
        </div>
        <UiDialogFooter class="items-center gap-2">
          <span class="text-xs text-muted-foreground">{{ batasRegistrasiTeks(active) ?? "Batas registrasi belum dicantumkan." }}</span>
          <NuxtLink
            v-if="tindakanKegiatan(active).href && tindakanKegiatan(active).internal"
            :to="tindakanKegiatan(active).href!"
            class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            data-testid="cta-detail"
          >
            {{ tindakanKegiatan(active).label }}
          </NuxtLink>
          <a
            v-else-if="tindakanKegiatan(active).href"
            :href="tindakanKegiatan(active).href!"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            data-testid="cta-detail"
          >
            {{ tindakanKegiatan(active).label }}
          </a>
          <UiButton v-else-if="tindakanKegiatan(active).jenis === 'pengingat'" type="button" data-testid="cta-detail" @click="bukaPengingat(active)">
            <BellRing class="size-4" /> {{ tindakanKegiatan(active).label }}
          </UiButton>
          <UiButton v-else disabled data-testid="cta-detail">{{ tindakanKegiatan(active).label }}</UiButton>
        </UiDialogFooter>
        <p v-if="tindakanKegiatan(active).pesan" class="text-xs text-muted-foreground">{{ tindakanKegiatan(active).pesan }}</p>
      </UiDialogScrollContent>
    </UiDialog>

    <!-- Reminder opt-in (M7-09) -->
    <UiDialog :open="Boolean(pengingatUntuk)" @update:open="(value) => !value && (pengingatUntuk = null)">
      <UiDialogScrollContent v-if="pengingatUntuk" class="sm:max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>Ingatkan saya</UiDialogTitle>
          <UiDialogDescription>{{ pengingatUntuk.judul }} · {{ waktuKegiatan(pengingatUntuk) }}</UiDialogDescription>
        </UiDialogHeader>
        <form class="grid gap-3" novalidate @submit.prevent="kirimPengingat">
          <label class="grid gap-1 text-sm">
            Kanal pengingat
            <select v-model="form.kanal" class="h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Kanal pengingat">
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <UiField class="gap-1">
            <UiFieldLabel for="pengingat-tujuan">{{ form.kanal === "email" ? "Alamat email" : "Nomor WhatsApp" }}</UiFieldLabel>
            <UiInput
              id="pengingat-tujuan"
              v-model="form.tujuan"
              :type="form.kanal === 'email' ? 'email' : 'tel'"
              maxlength="160"
              :placeholder="form.kanal === 'email' ? 'nama@email.com' : '0812xxxxxxx'"
              autocomplete="email"
            />
          </UiField>
          <AuthCaptcha ref="captcha" />
          <p v-if="pesanPengingat" :role="pesanPengingat.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="pesanPengingat.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">
            {{ pesanPengingat.text }}
          </p>
          <p class="text-xs text-muted-foreground">Pengingat dikirim oleh sistem DISKUK; kanal WhatsApp baru aktif setelah gateway resmi tersedia.</p>
          <UiButton type="submit" :disabled="mengirim" class="w-fit">{{ mengirim ? "Menyimpan…" : "Simpan pengingat" }}</UiButton>
        </form>
      </UiDialogScrollContent>
    </UiDialog>
  </div>
</template>
