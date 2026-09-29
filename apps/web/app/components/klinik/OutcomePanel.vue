<script setup lang="ts">
// Satu outcome konsultasi (R04): status, siapa/kapan, isi, alasan pencabutan, dan tombol tindakan.
// Tombol HANYA yang ada di `outcome.aksi` (keputusan server: verifikasi menuntut petugas selain
// pengaju, koreksi/cabut hak provinsi dan kab/kota wilayah usaha). Setiap tindakan memuat ulang
// induknya lewat `berubah`, dan semua tombol dikunci selama satu permintaan berjalan.
import { KLINIK_STATUS_OUTCOME_WARNA } from "~/constants";
import { KlinikError, cabutOutcome, koreksiOutcome, verifikasiOutcome } from "~/lib/klinik";
import type { KlinikAksiOutcome, KlinikOutcome, KlinikOutcomeDiputuskan, KlinikOutcomeIsi } from "~/types/program";

/** Alasan koreksi/cabut minimal selaras server; server tetap yang memutuskan. */
const ALASAN_MIN = 5;

const props = defineProps<{ outcome: KlinikOutcome }>();
const emit = defineEmits<{ berubah: [] }>();

const directus = useDirectus();
const mode = ref<"koreksi" | "cabut" | null>(null);
const itemsKoreksi = ref<KlinikOutcomeIsi[]>([]);
const alasan = ref("");
const proses = ref<KlinikAksiOutcome | null>(null);
const error = ref("");

const bisa = (aksi: KlinikAksiOutcome) => props.outcome.aksi.includes(aksi);

// Outcome baru (koreksi, atau muat ulang) berarti editor lama tidak berlaku lagi.
watch(
  () => `${props.outcome.id}:${props.outcome.status}`,
  () => {
    mode.value = null;
    alasan.value = "";
    error.value = "";
  },
);

function bukaKoreksi() {
  mode.value = "koreksi";
  itemsKoreksi.value = props.outcome.items.map(({ atribut, jenis }) => ({ atribut, jenis }));
  alasan.value = "";
  error.value = "";
}

function bukaCabut() {
  mode.value = "cabut";
  alasan.value = "";
  error.value = "";
}

function tutup() {
  mode.value = null;
  error.value = "";
}

/** Menjalankan satu tindakan sekali saja: klik ganda jatuh di penjaga `proses`. */
async function jalankan(aksi: KlinikAksiOutcome, kerjakan: () => Promise<KlinikOutcomeDiputuskan>) {
  if (proses.value) return;
  proses.value = aksi;
  error.value = "";
  try {
    await kerjakan();
    mode.value = null;
    alasan.value = "";
    emit("berubah");
  } catch (cause) {
    error.value = cause instanceof KlinikError ? cause.pesan : "Tindakan outcome tidak dapat diproses. Coba lagi.";
    // Outcome yang sudah berubah di sisi server (mis. dicabut petugas lain) harus tampil terbaru.
    if (cause instanceof KlinikError && ["OUTCOME_DICABUT", "OUTCOME_TIDAK_DITEMUKAN"].includes(cause.code)) emit("berubah");
  } finally {
    proses.value = null;
  }
}

const verifikasi = () => jalankan("verifikasi", () => verifikasiOutcome(directus, props.outcome.id));

async function kirimKoreksi() {
  if (alasan.value.trim().length < ALASAN_MIN) {
    error.value = `Isi alasan koreksi minimal ${ALASAN_MIN} karakter.`;
    return;
  }
  if (!itemsKoreksi.value.length) {
    error.value = "Pilih minimal satu atribut.";
    return;
  }
  await jalankan("koreksi", () => koreksiOutcome(directus, props.outcome.id, itemsKoreksi.value, alasan.value));
}

async function kirimCabut() {
  if (alasan.value.trim().length < ALASAN_MIN) {
    error.value = `Isi alasan pencabutan minimal ${ALASAN_MIN} karakter.`;
    return;
  }
  await jalankan("cabut", () => cabutOutcome(directus, props.outcome.id, alasan.value));
}

const stempel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
</script>

<template>
  <div class="grid gap-3 rounded-lg border p-3 text-sm" data-testid="outcome-panel">
    <div class="flex flex-wrap items-center gap-2">
      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" :class="KLINIK_STATUS_OUTCOME_WARNA[outcome.status]" data-testid="outcome-status">{{ outcome.statusLabel }}</span>
      <span class="text-xs text-muted-foreground">Versi {{ outcome.versi }}</span>
    </div>

    <ul class="flex flex-wrap gap-1.5" data-testid="outcome-items">
      <li v-for="item in outcome.items" :key="item.atribut" class="rounded-full border bg-background px-2.5 py-0.5 text-xs">
        {{ item.label }} <span class="text-muted-foreground">· {{ item.jenis === "kepatuhan" ? "Kepatuhan" : "Perbaikan" }}</span>
      </li>
    </ul>

    <dl class="grid gap-1 text-xs text-muted-foreground">
      <div><dt class="inline">Diajukan oleh</dt> <dd class="inline font-medium text-foreground">{{ outcome.diajukanNama || "Petugas" }}</dd> · {{ stempel(outcome.diajukanPada) }}</div>
      <div v-if="outcome.diverifikasiPada"><dt class="inline">Diverifikasi oleh</dt> <dd class="inline font-medium text-foreground">{{ outcome.diverifikasiNama || "Petugas" }}</dd> · {{ stempel(outcome.diverifikasiPada) }}</div>
      <template v-if="outcome.status === 'dicabut'">
        <div><dt class="inline">Dicabut oleh</dt> <dd class="inline font-medium text-foreground">{{ outcome.dicabutNama || "Petugas" }}</dd><template v-if="outcome.dicabutPada"> · {{ stempel(outcome.dicabutPada) }}</template></div>
        <div v-if="outcome.alasanCabut" data-testid="outcome-alasan-cabut"><dt class="inline">Alasan:</dt> <dd class="inline text-foreground">{{ outcome.alasanCabut }}</dd></div>
      </template>
    </dl>

    <div v-if="outcome.aksi.length && !mode" class="flex flex-wrap gap-2">
      <UiButton v-if="bisa('verifikasi')" type="button" size="sm" :disabled="Boolean(proses)" data-testid="outcome-verifikasi" @click="verifikasi">{{ proses === "verifikasi" ? "Memverifikasi…" : "Verifikasi" }}</UiButton>
      <UiButton v-if="bisa('koreksi')" type="button" size="sm" variant="outline" :disabled="Boolean(proses)" data-testid="outcome-koreksi" @click="bukaKoreksi">Koreksi</UiButton>
      <UiButton v-if="bisa('cabut')" type="button" size="sm" variant="outline" :disabled="Boolean(proses)" data-testid="outcome-cabut" @click="bukaCabut">Cabut</UiButton>
    </div>

    <form v-if="mode === 'koreksi' && bisa('koreksi')" class="grid gap-3 border-t pt-3" novalidate data-testid="outcome-form-koreksi" @submit.prevent="kirimKoreksi">
      <h4 class="font-semibold">Koreksi outcome</h4>
      <KlinikOutcomeForm v-model="itemsKoreksi" :disabled="Boolean(proses)" />
      <UiField class="gap-1">
        <UiFieldLabel :for="`alasan-koreksi-${outcome.id}`">Alasan koreksi</UiFieldLabel>
        <UiTextarea :id="`alasan-koreksi-${outcome.id}`" v-model="alasan" rows="2" maxlength="500" />
      </UiField>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex flex-wrap gap-2">
        <UiButton type="submit" size="sm" :disabled="Boolean(proses)">{{ proses === "koreksi" ? "Menyimpan…" : "Simpan koreksi" }}</UiButton>
        <UiButton type="button" size="sm" variant="ghost" :disabled="Boolean(proses)" @click="tutup">Batal</UiButton>
      </div>
    </form>

    <form v-else-if="mode === 'cabut' && bisa('cabut')" class="grid gap-3 border-t pt-3" novalidate data-testid="outcome-form-cabut" @submit.prevent="kirimCabut">
      <h4 class="font-semibold">Cabut outcome</h4>
      <p class="text-xs text-muted-foreground">Efek outcome ini langsung hilang dari profil dan indikator usaha.</p>
      <UiField class="gap-1">
        <UiFieldLabel :for="`alasan-cabut-${outcome.id}`">Alasan pencabutan</UiFieldLabel>
        <UiTextarea :id="`alasan-cabut-${outcome.id}`" v-model="alasan" rows="2" maxlength="500" />
      </UiField>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex flex-wrap gap-2">
        <UiButton type="submit" size="sm" variant="destructive" :disabled="Boolean(proses)">{{ proses === "cabut" ? "Mencabut…" : "Cabut outcome" }}</UiButton>
        <UiButton type="button" size="sm" variant="ghost" :disabled="Boolean(proses)" @click="tutup">Batal</UiButton>
      </div>
    </form>

    <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
