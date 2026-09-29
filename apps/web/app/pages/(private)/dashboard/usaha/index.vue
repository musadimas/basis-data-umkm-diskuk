<script setup lang="ts">
import { Camera, CloudOff, Images, RefreshCw, Trash2, Wifi, X } from "@lucide/vue";
import { FASE_LABEL, LAPORAN_STATUS, assetUrl } from "~/constants";
import { useKpiOutbox } from "~/composables/useKpiOutbox";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { endpoint } from "~/lib/directus";
import { isQueryString } from "~/lib/utils";
import type { KpiLaporan, KpiPesertaDetail, KpiPesertaListItem } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Laporan KPI Mingguan – Dashboard UMKM" });

const MAX_PHOTOS = 5;
const MAX_PHOTO_MB = 10;

const route = useRoute();
const router = useRouter();
const directus = useDirectus();

// Participants this account can report for: its own business, or (for the super admin) all of them.
const { data: pesertaList, error: listError } = await useAsyncData("kpi:peserta", () =>
  directus.request(endpoint<KpiPesertaListItem[]>("/v1/program/kpi/peserta")),
);

const pesertaId = computed<string | null>(() => {
  const requested = isQueryString(route.query.peserta) ? route.query.peserta : null;
  const list = pesertaList.value ?? [];
  if (requested && list.some((item) => item.id === requested)) return requested;
  return list.length === 1 ? list[0]!.id : null;
});

const { data: detail, refresh: refreshDetail } = await useAsyncData(
  "kpi:peserta:detail",
  () => (pesertaId.value ? directus.request(endpoint<KpiPesertaDetail>(`/v1/program/kpi/peserta/${pesertaId.value}`)) : Promise.resolve(null)),
  { watch: [pesertaId] },
);

const outbox = useKpiOutbox(pesertaId, () => void refreshDetail());
const peserta = computed(() => detail.value?.peserta ?? null);
const laporanByWeek = computed(() => new Map((detail.value?.laporan ?? []).map((item) => [item.mingguKe, item])));
const queuedWeeks = computed(() => new Set(outbox.entries.value.map((entry) => entry.mingguKe)));

/** Weeks that have started and still need a report (none yet, or rejected). */
const openWeeks = computed(() => {
  const current = peserta.value?.mingguBerjalan ?? 0;
  const weeks: number[] = [];
  for (let week = 1; week <= current; week += 1) {
    const report = laporanByWeek.value.get(week);
    if ((!report || report.status === "ditolak") && !queuedWeeks.value.has(week)) weeks.push(week);
  }
  return weeks;
});

const form = reactive({ mingguKe: 0, realisasiOmzet: "", jumlahTransaksi: "", kendala: "" });
const photos = ref<{ file: File; url: string }[]>([]);
const formError = ref("");
const saved = ref("");

watch(
  openWeeks,
  (weeks) => {
    if (!weeks.includes(form.mingguKe)) form.mingguKe = weeks.at(-1) ?? 0;
  },
  { immediate: true },
);

function stepClass(week: number) {
  if (queuedWeeks.value.has(week)) return "bg-amber-300 text-amber-950";
  const status = laporanByWeek.value.get(week)?.status;
  if (status === "disetujui") return "bg-emerald-600 text-white";
  if (status === "menunggu") return "bg-sky-500 text-white";
  if (status === "ditolak") return "bg-red-500 text-white";
  if (week <= (peserta.value?.mingguBerjalan ?? 0)) return "border-2 border-dashed border-slate-400 text-slate-600";
  return "bg-muted text-muted-foreground";
}

function addPhotos(event: Event) {
  // SAFETY: handler ini hanya dipasang pada <input type="file">, sehingga target-nya selalu elemen input.
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  formError.value = "";
  for (const file of files) {
    if (photos.value.length >= MAX_PHOTOS) {
      formError.value = `Maksimal ${MAX_PHOTOS} foto bukti.`;
      break;
    }
    if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_MB * 1024 * 1024) {
      formError.value = `Foto harus berupa gambar dengan ukuran maksimal ${MAX_PHOTO_MB} MB.`;
      continue;
    }
    photos.value.push({ file, url: URL.createObjectURL(file) });
  }
}

function removePhoto(index: number) {
  const [removed] = photos.value.splice(index, 1);
  if (removed) URL.revokeObjectURL(removed.url);
}

const submitting = ref(false);
async function submit() {
  formError.value = "";
  saved.value = "";
  const omzet = Number(form.realisasiOmzet);
  const transaksi = Number(form.jumlahTransaksi);
  if (!pesertaId.value || !form.mingguKe) {
    formError.value = "Tidak ada minggu yang perlu dilaporkan.";
    return;
  }
  if (form.realisasiOmzet === "" || !Number.isInteger(omzet) || omzet < 0) {
    formError.value = "Isi omzet minggu ini dalam rupiah (angka bulat).";
    return;
  }
  if (form.jumlahTransaksi === "" || !Number.isInteger(transaksi) || transaksi < 0) {
    formError.value = "Isi jumlah transaksi (angka bulat).";
    return;
  }
  if (!photos.value.length) {
    formError.value = "Tambahkan minimal satu foto bukti transaksi.";
    return;
  }
  submitting.value = true;
  try {
    const week = form.mingguKe;
    const clientUuid = crypto.randomUUID();
    const hasil = await outbox.add({
      clientUuid,
      pesertaId: pesertaId.value,
      mingguKe: week,
      realisasiOmzet: omzet,
      jumlahTransaksi: transaksi,
      kendala: form.kendala.trim() || null,
      photos: photos.value.map(({ file }) => ({ name: file.name, type: file.type, blob: file, fileId: null })),
    });
    if (hasil === "ditolak") {
      const entri = outbox.entries.value.find((item) => item.clientUuid === clientUuid);
      formError.value = entri?.error?.message || "Laporan ditolak server. Periksa isian lalu kirim ulang.";
      return;
    }
    for (const photo of photos.value) URL.revokeObjectURL(photo.url);
    photos.value = [];
    form.realisasiOmzet = "";
    form.jumlahTransaksi = "";
    form.kendala = "";
    saved.value =
      hasil === "terkirim"
        ? `Laporan minggu ke-${week} terkirim.`
        : `Laporan minggu ke-${week} antre dan akan dikirim saat terhubung.`;
  } catch {
    formError.value = "Laporan tidak dapat disimpan di perangkat ini.";
  } finally {
    submitting.value = false;
  }
}

function choose(id: string) {
  void router.replace({ query: { ...route.query, peserta: id } });
}

const rupiah = (value: number) => formatAnalyticsCurrency(value);
const history = computed<KpiLaporan[]>(() => [...(detail.value?.laporan ?? [])].reverse());
</script>

<template>
  <div class="flex flex-col gap-4 pb-10">
    <div v-if="listError" role="alert" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
      Data kepesertaan tidak dapat dimuat.
    </div>

    <!-- Super admin (or an account with several participants): choose whose view to open. -->
    <UiCard v-else-if="!pesertaId">
      <UiCardHeader>
        <UiCardTitle>Laporan KPI Mingguan</UiCardTitle>
        <UiCardDescription v-if="pesertaList?.length">Pilih peserta program untuk membuka tampilan UMKM-nya.</UiCardDescription>
        <UiCardDescription v-else>Akun ini belum terhubung ke peserta program akselerasi.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent v-if="pesertaList?.length">
        <ul class="divide-y text-sm">
          <li v-for="item in pesertaList" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p class="font-medium">{{ item.usaha.nama }}</p>
              <p class="text-xs text-muted-foreground">Batch {{ item.batch }} · Minggu {{ item.mingguBerjalan }}/{{ item.jumlahMinggu }}</p>
            </div>
            <UiButton size="sm" variant="outline" @click="choose(item.id)">Buka sebagai UMKM</UiButton>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <ProgramPhoneFrame v-else-if="peserta">
      <header class="bg-primary px-5 pb-5 pt-4 text-primary-foreground">
        <p class="text-xs opacity-80">{{ FASE_LABEL[peserta.fase] || peserta.fase }} · Batch {{ peserta.batch }}</p>
        <h1 class="text-lg font-bold leading-tight">{{ peserta.usaha.nama }}</h1>
        <p class="mt-1 text-xs opacity-80">Pendamping: {{ peserta.pendamping?.nama || "Belum ditetapkan" }}</p>
      </header>

      <div
        role="status"
        class="flex items-center gap-2 px-5 py-2 text-xs font-medium"
        :class="outbox.online.value ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-200 text-amber-950'"
        data-testid="connectivity-banner"
      >
        <Wifi v-if="outbox.online.value" class="size-4" />
        <CloudOff v-else class="size-4" />
        {{ outbox.simulatedOffline.value && outbox.demoEnabled.value ? "Simulasi Offline Aktif - Laporan Disimpan di Perangkat" : outbox.online.value ? "Terhubung - Data Real-Time" : "Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel" }}
      </div>

      <DemoDemoKoneksiToggle :syncing="outbox.syncing.value" />

      <div class="grid gap-5 p-5">
        <section aria-label="Progres mingguan">
          <p class="text-sm font-semibold">
            <template v-if="peserta.mingguBerjalan">Minggu ke-{{ peserta.mingguBerjalan }} dari {{ peserta.jumlahMinggu }}</template>
            <template v-else>Program dimulai {{ peserta.tanggalMulai }}</template>
          </p>
          <ol class="mt-2 grid grid-cols-6 gap-1.5">
            <li
              v-for="week in peserta.jumlahMinggu"
              :key="week"
              class="grid h-8 place-items-center rounded-md text-xs font-semibold"
              :class="stepClass(week)"
              :aria-label="`Minggu ${week}: ${laporanByWeek.get(week) ? LAPORAN_STATUS[laporanByWeek.get(week)!.status].label : queuedWeeks.has(week) ? 'menunggu sinkronisasi' : 'belum ada laporan'}`"
            >{{ week }}</li>
          </ol>
        </section>

        <section v-if="outbox.entries.value.length" class="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" aria-label="Antrean sinkronisasi">
          <div class="flex items-center justify-between">
            <p class="font-semibold">{{ outbox.pending.value.length }} laporan menunggu sinkronisasi</p>
            <button type="button" class="inline-flex items-center gap-1 text-xs font-semibold underline disabled:opacity-50" :disabled="outbox.syncing.value || !outbox.online.value" @click="outbox.sync()">
              <RefreshCw class="size-3" :class="outbox.syncing.value && 'animate-spin'" /> Kirim sekarang
            </button>
          </div>
          <ul class="grid gap-1">
            <li v-for="entry in outbox.entries.value" :key="entry.clientUuid" class="flex items-start justify-between gap-2">
              <span>
                Minggu ke-{{ entry.mingguKe }} · {{ rupiah(entry.realisasiOmzet) }}
                <span v-if="entry.error" class="block text-xs text-destructive">{{ entry.error.message }}</span>
              </span>
              <button v-if="entry.error" type="button" class="rounded p-1 hover:bg-amber-100" :aria-label="`Buang laporan minggu ${entry.mingguKe}`" @click="outbox.remove(entry.clientUuid)">
                <Trash2 class="size-4" />
              </button>
            </li>
          </ul>
        </section>

        <form v-if="detail?.akses.kirim" class="grid gap-4" novalidate @submit.prevent="submit">
          <h2 class="text-base font-bold">Kirim Laporan</h2>
          <p v-if="!openWeeks.length" class="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Semua minggu yang berjalan sudah dilaporkan.
          </p>
          <template v-else>
            <label class="grid gap-1 text-sm">
              <span class="font-medium">Minggu laporan</span>
              <select v-model.number="form.mingguKe" name="minggu" class="h-10 rounded-md border border-input bg-transparent px-2">
                <option v-for="week in openWeeks" :key="week" :value="week">
                  Minggu ke-{{ week }}{{ laporanByWeek.get(week)?.status === "ditolak" ? " (perbaikan)" : "" }}
                </option>
              </select>
            </label>
            <p v-if="laporanByWeek.get(form.mingguKe)?.catatanPendamping" class="rounded-md bg-red-50 p-2 text-xs text-red-900">
              Catatan pendamping: {{ laporanByWeek.get(form.mingguKe)?.catatanPendamping }}
            </p>
            <div class="grid gap-1 text-sm">
              <span class="font-medium">Target mingguan</span>
              <p class="rounded-md bg-muted px-3 py-2 font-semibold" data-testid="target-mingguan">{{ rupiah(peserta.targetMingguan) }}</p>
            </div>
            <UiField class="gap-1">
              <UiFieldLabel for="omzet">Omzet minggu ini (Rp)</UiFieldLabel>
              <UiInput id="omzet" v-model="form.realisasiOmzet" type="number" min="0" step="1" inputmode="numeric" />
            </UiField>
            <UiField class="gap-1">
              <UiFieldLabel for="transaksi">Jumlah transaksi</UiFieldLabel>
              <UiInput id="transaksi" v-model="form.jumlahTransaksi" type="number" min="0" step="1" inputmode="numeric" />
            </UiField>
            <div class="grid gap-2 text-sm">
              <span class="font-medium">Foto bukti (maks. {{ MAX_PHOTOS }})</span>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 font-medium hover:bg-muted">
                  <Camera class="size-4" /> Kamera
                  <input type="file" accept="image/*" capture="environment" class="sr-only" @change="addPhotos">
                </label>
                <label class="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 font-medium hover:bg-muted">
                  <Images class="size-4" /> Galeri
                  <input type="file" accept="image/*" multiple class="sr-only" data-testid="galeri-input" @change="addPhotos">
                </label>
              </div>
              <ul v-if="photos.length" class="grid grid-cols-3 gap-2">
                <li v-for="(photo, index) in photos" :key="photo.url" class="relative">
                  <img :src="photo.url" :alt="`Foto bukti ${index + 1}`" class="aspect-square w-full rounded-md object-cover">
                  <button type="button" class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" :aria-label="`Hapus foto ${index + 1}`" @click="removePhoto(index)">
                    <X class="size-3" />
                  </button>
                </li>
              </ul>
            </div>
            <UiField class="gap-1">
              <UiFieldLabel for="kendala">Kendala minggu ini</UiFieldLabel>
              <UiTextarea id="kendala" v-model="form.kendala" rows="3" maxlength="2000" />
            </UiField>
            <p v-if="formError" role="alert" class="text-sm text-destructive">{{ formError }}</p>
            <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ saved }}</p>
            <UiButton type="submit" size="lg" :disabled="submitting">{{ submitting ? "Menyimpan…" : "Kirim Laporan" }}</UiButton>
          </template>
        </form>

        <section class="grid gap-2" aria-label="Riwayat laporan">
          <h2 class="text-base font-bold">Riwayat</h2>
          <p v-if="!history.length" class="text-sm text-muted-foreground">Belum ada laporan terkirim.</p>
          <ul v-else class="grid gap-2">
            <li v-for="item in history" :key="item.id" class="grid gap-1 rounded-lg border p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="font-semibold">Minggu ke-{{ item.mingguKe }}</span>
                <ProgramStatusPill :meta="LAPORAN_STATUS[item.status]" />
              </div>
              <p>{{ rupiah(item.realisasiOmzet) }} · {{ item.jumlahTransaksi }} transaksi · {{ item.capaianPersen ?? "—" }}% dari target</p>
              <div v-if="item.bukti.length" class="flex gap-1">
                <img v-for="id in item.bukti" :key="id" :src="assetUrl(id, 96)" alt="" class="size-10 rounded object-cover">
              </div>
              <p v-if="item.catatanPendamping" class="text-xs text-muted-foreground">Pendamping: {{ item.catatanPendamping }}</p>
            </li>
          </ul>
        </section>
      </div>
    </ProgramPhoneFrame>
  </div>
</template>
