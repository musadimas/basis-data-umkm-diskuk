<script setup lang="ts">
import { ArrowLeft, Calculator, LoaderCircle, Send } from "@lucide/vue";
import {
  JENIS_LEGALITAS,
  KESIAPAN_LEGALITAS,
  PENGAJUAN_STATUS,
  SKALA_LABEL,
  STATUS_LEGALITAS,
  TALENT_STATUS,
} from "~/constants";
import { endpoint } from "~/lib/directus";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { requestErrorCode } from "~/lib/request-error";
import type { RuntimeLabelMap } from "~/types/directus";
import type {
  JenisLegalitas,
  KesiapanLegalitas,
  PengajuanStatus,
  TalentPengajuan,
  TalentPengajuanInput,
  TalentUsahaDetail,
} from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Ajukan ke Talent Scouting – Dashboard UMKM" });

const ERRORS: RuntimeLabelMap = {
  PENGAJUAN_SUDAH_ADA: "Usaha ini sudah memiliki pengajuan yang masih terbuka.",
  PENGAJUAN_CLOSED: "Pengajuan ini sudah diajukan atau diputuskan sehingga tidak dapat diubah.",
  DATA_BELUM_LENGKAP: "Lengkapi kapasitas produksi (lebih dari 0) dan satuan terlebih dahulu.",
  SKOR_BELUM_DIHITUNG: "Hitung skor dari isian terbaru sebelum mengajukan.",
  INVALID_REFERENCE: "Berkas surat komitmen tidak ditemukan. Unggah ulang berkasnya.",
  INVALID_PAYLOAD: "Periksa kembali isian formulir.",
};

const route = useRoute();
const usahaId = String(route.params.usahaId);
const directus = useDirectus();

const { data, error, refresh } = await useAsyncData(`talent:usaha:${usahaId}`, () =>
  directus.request(endpoint<TalentUsahaDetail>(`/v1/program/talent/usaha/${encodeURIComponent(usahaId)}`)),
);

const pengajuan = ref<TalentPengajuan | null>(null);

/** Isian formulir; tipe eksplisit agar nilai awal tidak perlu assertion. */
interface FormPengajuan {
  kapasitasProduksi: string;
  satuan: string;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  catatan: string;
  kesiapanLegalitas: Record<JenisLegalitas, KesiapanLegalitas>;
}

// Text inputs bind strings; payload() converts them to the API shape.
const form = reactive<FormPengajuan>({
  kapasitasProduksi: "",
  satuan: "",
  literasiQris: false,
  literasiPembukuanDigital: false,
  suratKomitmen: null,
  catatan: "",
  kesiapanLegalitas: { halal: "belum", pirt: "belum", bpom: "belum", hki: "belum", sni: "belum", umku: "belum" },
});
const suratName = ref<string | null>(null);

function payload(): TalentPengajuanInput {
  const kesiapan: TalentPengajuanInput["kesiapanLegalitas"] = {};
  for (const { value: jenis } of JENIS_LEGALITAS) {
    const status = form.kesiapanLegalitas[jenis];
    if (status !== "belum") kesiapan[jenis] = status;
  }
  const kapasitas = String(form.kapasitasProduksi).trim();
  return {
    kapasitasProduksi: kapasitas === "" ? null : Number(kapasitas),
    satuan: form.satuan.trim() || null,
    kesiapanLegalitas: kesiapan,
    literasiQris: form.literasiQris,
    literasiPembukuanDigital: form.literasiPembukuanDigital,
    suratKomitmen: form.suratKomitmen,
    catatan: form.catatan.trim() || null,
  };
}

/** Isian formulir dari satu pengajuan; dipakai juga saat mengajukan ulang pengajuan yang ditolak. */
function isiForm(source: TalentPengajuan) {
  form.kapasitasProduksi = source.kapasitasProduksi === null ? "" : String(source.kapasitasProduksi);
  form.satuan = source.satuan ?? "";
  for (const { value: jenis } of JENIS_LEGALITAS) form.kesiapanLegalitas[jenis] = source.kesiapanLegalitas[jenis] ?? "belum";
  form.literasiQris = source.literasiQris;
  form.literasiPembukuanDigital = source.literasiPembukuanDigital;
  form.suratKomitmen = source.suratKomitmen;
  form.catatan = source.catatan ?? "";
  if (source.suratKomitmen && !suratName.value) suratName.value = "Surat komitmen";
}

/** Snapshot payload terakhir yang tersimpan/dihitung; dipakai mendeteksi isian yang berubah (R5). */
const tersimpan = ref("");

/** Pengajuan ditolak tidak dapat diedit; isian lama tetap dimuat untuk "Ajukan ulang". */
function syncFrom(value: TalentPengajuan | null) {
  pengajuan.value = value && value.status !== "ditolak" ? value : null;
  if (value) isiForm(value);
  tersimpan.value = JSON.stringify(payload());
}
watch(() => data.value?.pengajuan ?? null, syncFrom, { immediate: true });

type Mode = "baru" | "draft" | "dinilai" | "disetujui" | "ditolak";
/** Status pengajuan yang masih dapat dilihat pengaju; `ditolak` ditangani terpisah (mode "ditolak"). */
const MODE_DARI_STATUS = { draft: "draft", dinilai: "dinilai", disetujui: "disetujui" } as const satisfies Record<Exclude<Mode, "baru" | "ditolak">, Mode>;
function modeDariStatus(status: PengajuanStatus): Mode {
  if (status === "ditolak") return "ditolak";
  return MODE_DARI_STATUS[status];
}
const mode = computed<Mode>(() => {
  if (data.value?.pengajuan?.status === "ditolak") return "ditolak";
  return pengajuan.value ? modeDariStatus(pengajuan.value.status) : "baru";
});
const readOnly = computed(() => ["dinilai", "disetujui", "ditolak"].includes(mode.value));
const berubah = computed(() => JSON.stringify(payload()) !== tersimpan.value);
const usaha = computed(() => data.value?.usaha);

const galat = reactive<{ kapasitas: string; satuan: string }>({ kapasitas: "", satuan: "" });
function validasiWajib(): boolean {
  const kapasitas = Number(String(form.kapasitasProduksi).trim());
  galat.kapasitas = String(form.kapasitasProduksi).trim() !== "" && kapasitas > 0 ? "" : "Kapasitas produksi wajib diisi dan lebih dari 0.";
  galat.satuan = form.satuan.trim() ? "" : "Satuan wajib diisi.";
  return !galat.kapasitas && !galat.satuan;
}
watch(() => form.kapasitasProduksi, () => (galat.kapasitas = ""));
watch(() => form.satuan, () => (galat.satuan = ""));
const bisaAjukan = computed(() =>
  mode.value === "draft" && Boolean(pengajuan.value?.skor) && !berubah.value &&
  Number(String(form.kapasitasProduksi).trim()) > 0 && Boolean(form.satuan.trim()));

const busy = ref<null | "simpan" | "hitung" | "ajukan" | "ulang">(null);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function save(): Promise<TalentPengajuan | null> {
  const body = payload();
  const saved = pengajuan.value
    ? await directus.request(
        endpoint<TalentPengajuan, TalentPengajuanInput>(`/v1/program/talent/pengajuan/${pengajuan.value.id}`, { method: "PATCH", body }),
      )
    : await directus.request(
        endpoint<TalentPengajuan, TalentPengajuanInput & { usaha: string }>("/v1/program/talent/pengajuan", {
          method: "POST",
          body: { ...body, usaha: usahaId },
        }),
      );
  pengajuan.value = saved;
  return saved;
}

function fail(cause: unknown, fallback: string) {
  const code = requestErrorCode(cause);
  message.value = { tone: "error", text: (code && ERRORS[code]) || fallback };
}

async function saveDraft() {
  if (busy.value) return;
  busy.value = "simpan";
  message.value = null;
  try {
    await save();
    tersimpan.value = JSON.stringify(payload());
    message.value = { tone: "success", text: "Draft pengajuan tersimpan." };
  } catch (cause) {
    fail(cause, "Pengajuan tidak dapat disimpan. Coba lagi.");
  } finally {
    busy.value = null;
  }
}

async function hitungSkor() {
  if (!validasiWajib()) return;
  if (busy.value) return;
  busy.value = "hitung";
  message.value = null;
  try {
    const saved = await save();
    if (!saved) return;
    // Keep the calculation state visible long enough to read, even when the server is fast.
    const [scored] = await Promise.all([
      directus.request(endpoint<TalentPengajuan>(`/v1/program/talent/pengajuan/${saved.id}/hitung-skor`, { method: "POST" })),
      new Promise((resolve) => setTimeout(resolve, 900)),
    ]);
    pengajuan.value = scored;
    tersimpan.value = JSON.stringify(payload());
    await refresh();
    message.value = { tone: "success", text: "Skor dihitung. Periksa hasilnya, lalu tekan Ajukan ke Kurasi." };
  } catch (cause) {
    fail(cause, "Skor tidak dapat dihitung. Coba lagi.");
  } finally {
    busy.value = null;
  }
}

async function ajukan() {
  if (!pengajuan.value || !bisaAjukan.value) return;
  if (busy.value) return;
  busy.value = "ajukan";
  message.value = null;
  try {
    const submitted = await directus.request(
      endpoint<TalentPengajuan>(`/v1/program/talent/pengajuan/${pengajuan.value.id}/ajukan`, { method: "POST" }),
    );
    pengajuan.value = submitted;
    await refresh();
    message.value = { tone: "success", text: "Pengajuan dikirim ke kurasi dan berstatus Siap dikurasi." };
  } catch (cause) {
    fail(cause, "Pengajuan tidak dapat diajukan. Coba lagi.");
  } finally {
    busy.value = null;
  }
}

async function ajukanUlang() {
  if (busy.value) return;
  busy.value = "ulang";
  message.value = null;
  try {
    await directus.request(
      endpoint<TalentPengajuan, TalentPengajuanInput & { usaha: string }>("/v1/program/talent/pengajuan", {
        method: "POST",
        body: { ...payload(), usaha: usahaId },
      }),
    );
    await refresh();
    message.value = { tone: "success", text: "Draft baru dibuat dari pengajuan yang ditolak. Perbarui isian, hitung skor, lalu ajukan." };
  } catch (cause) {
    fail(cause, "Draft baru tidak dapat dibuat. Coba lagi.");
  } finally {
    busy.value = null;
  }
}

const rupiah = (value: number | null) => (value === null ? "Belum tersedia" : formatAnalyticsCurrency(value));
const waktuWib = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "—";
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/dashboard/tabular" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft class="size-4" /> Data Tabular UMKM
        </NuxtLink>
        <h1 class="mt-1 text-2xl font-bold tracking-tight">Ajukan ke Talent Scouting</h1>
      </div>
      <NuxtLink to="/dashboard/talent/kurasi" class="text-sm font-semibold underline">Panel Kurasi</NuxtLink>
    </div>

    <div v-if="error" role="alert" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
      Data usaha tidak tersedia atau Anda tidak memiliki akses.
    </div>

    <template v-else-if="usaha && data">
      <UiCard>
        <UiCardHeader>
          <div class="flex flex-wrap items-center gap-2">
            <UiCardTitle>{{ usaha.nama }}</UiCardTitle>
            <ProgramStatusPill :meta="TALENT_STATUS[usaha.talentStatus]" />
          </div>
          <UiCardDescription>Data SIDT (hanya baca). NIK pemilik disamarkan.</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <dl class="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt class="text-xs text-muted-foreground">Pemilik</dt><dd class="font-medium">{{ usaha.pemilik.nama || "—" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">NIK</dt><dd class="font-mono">{{ usaha.pemilik.nikMasked }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">NIB</dt><dd class="font-mono">{{ usaha.nib || "—" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Skala</dt><dd>{{ SKALA_LABEL[usaha.skala ?? ""] || "—" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">KBLI</dt><dd>{{ usaha.kodeKbli || "—" }}</dd></div>
            <div class="sm:col-span-2 lg:col-span-3"><dt class="text-xs text-muted-foreground">Kegiatan utama</dt><dd>{{ usaha.kegiatanUtama || "—" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Omzet tahunan</dt><dd>{{ rupiah(usaha.omzetTahunan) }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Tenaga kerja</dt><dd>{{ usaha.tenagaKerja }} orang</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Wilayah</dt><dd>{{ [usaha.kecamatan, usaha.kota].filter(Boolean).join(", ") || "—" }}</dd></div>
          </dl>
          <div v-if="data.legalitas.length" class="mt-4 flex flex-wrap gap-2">
            <span v-for="item in data.legalitas" :key="item.id" class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <span class="font-semibold uppercase">{{ item.jenis }}</span>
              <ProgramStatusPill :meta="STATUS_LEGALITAS[item.status]" />
            </span>
          </div>
        </UiCardContent>
      </UiCard>

      <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <UiCard>
          <UiCardHeader>
            <div class="flex items-center gap-2">
              <UiCardTitle>Data Tambahan Jawa Barat</UiCardTitle>
              <ProgramStatusPill v-if="pengajuan" :meta="PENGAJUAN_STATUS[pengajuan.status]" />
            </div>
            <UiCardDescription v-if="mode === 'dinilai'">Pengajuan sudah diajukan dan menunggu kurasi Admin Provinsi. Isian tidak dapat diubah.</UiCardDescription>
            <UiCardDescription v-else-if="mode === 'disetujui'">Pengajuan ini sudah disetujui melalui Berita Acara dan tidak dapat diubah.</UiCardDescription>
            <p
              v-else-if="mode === 'ditolak'"
              role="alert"
              class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              Pengajuan ditolak pada {{ waktuWib(data.pengajuan?.ditolakAt ?? null) }}. Alasan: {{ data.pengajuan?.alasanTolak ?? "tidak dicatat" }}.
              Ajukan ulang membuat draft baru berisi isian di bawah.
            </p>
            <UiCardDescription v-else>Mengubah isian akan menghapus skor sebelumnya sampai skor dihitung ulang.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form class="grid gap-5" novalidate @submit.prevent="hitungSkor">
              <fieldset :disabled="readOnly || busy !== null" class="grid gap-5">
                <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <UiField class="gap-2">
                    <UiFieldLabel for="kapasitas">Kapasitas produksi per bulan (wajib)</UiFieldLabel>
                    <UiInput
                      id="kapasitas"
                      v-model="form.kapasitasProduksi"
                      type="number"
                      min="0"
                      inputmode="decimal"
                      :aria-invalid="Boolean(galat.kapasitas)"
                      aria-describedby="kapasitas-galat"
                    />
                    <p v-if="galat.kapasitas" id="kapasitas-galat" class="text-xs text-destructive">{{ galat.kapasitas }}</p>
                  </UiField>
                  <UiField class="gap-2">
                    <UiFieldLabel for="satuan">Satuan (wajib)</UiFieldLabel>
                    <UiInput
                      id="satuan"
                      v-model="form.satuan"
                      maxlength="32"
                      placeholder="kg, pcs, liter"
                      :aria-invalid="Boolean(galat.satuan)"
                      aria-describedby="satuan-galat"
                    />
                    <p v-if="galat.satuan" id="satuan-galat" class="text-xs text-destructive">{{ galat.satuan }}</p>
                  </UiField>
                </div>

                <fieldset class="grid gap-3">
                  <legend class="mb-2 text-sm font-medium">Kesiapan legalitas</legend>
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="grid gap-1 text-sm">
                      <span>{{ jenis.label }}</span>
                      <UiSelect
                        v-model="form.kesiapanLegalitas[jenis.value]"
                        :name="`kesiapan-${jenis.value}`"
                      >
                        <UiSelectTrigger class="text-sm"><UiSelectValue /></UiSelectTrigger>
                        <UiSelectContent>
                          <UiSelectItem v-for="option in KESIAPAN_LEGALITAS" :key="option.value" :value="option.value">{{ option.label }}</UiSelectItem>
                        </UiSelectContent>
                      </UiSelect>
                    </label>
                  </div>
                </fieldset>

                <div class="grid gap-3">
                  <label class="flex items-center gap-2 text-sm">
                    <UiCheckbox v-model="form.literasiQris" name="literasi-qris" /> Sudah menerima pembayaran QRIS
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <UiCheckbox v-model="form.literasiPembukuanDigital" name="literasi-pembukuan" /> Sudah memakai pembukuan digital
                  </label>
                </div>

                <UiField class="gap-2">
                  <UiFieldLabel for="surat-komitmen">Surat komitmen (PDF atau foto, maks. 10 MB)</UiFieldLabel>
                  <ProgramFileUpload id="surat-komitmen" v-model="form.suratKomitmen" v-model:file-name="suratName" />
                </UiField>

                <UiField class="gap-2">
                  <UiFieldLabel for="catatan">Catatan</UiFieldLabel>
                  <UiTextarea id="catatan" v-model="form.catatan" maxlength="2000" rows="3" />
                </UiField>
              </fieldset>

              <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="message.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">
                {{ message.text }}
              </p>

              <div v-if="mode === 'baru' || mode === 'draft'" class="flex flex-wrap gap-3">
                <UiButton type="button" variant="outline" :disabled="busy !== null" @click="saveDraft">
                  {{ busy === "simpan" ? "Menyimpan…" : "Simpan Draft" }}
                </UiButton>
                <UiButton type="submit" :disabled="busy !== null">
                  <LoaderCircle v-if="busy === 'hitung'" class="size-4 animate-spin" />
                  <Calculator v-else class="size-4" />
                  {{ busy === "hitung" ? "Menghitung skor…" : "Hitung Skor" }}
                </UiButton>
                <UiButton type="button" :disabled="busy !== null || !bisaAjukan" @click="ajukan">
                  <Send class="size-4" />
                  {{ busy === "ajukan" ? "Mengajukan…" : "Ajukan ke Kurasi" }}
                </UiButton>
              </div>
              <p v-if="mode === 'draft' && pengajuan?.skor && berubah" class="text-xs text-muted-foreground">
                Isian berubah sejak skor dihitung. Hitung ulang skor sebelum mengajukan.
              </p>

              <div v-if="mode === 'ditolak'" class="flex flex-wrap gap-3">
                <UiButton type="button" :disabled="busy !== null" @click="ajukanUlang">
                  {{ busy === "ulang" ? "Membuat draft…" : "Ajukan ulang" }}
                </UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>

        <UiCard class="h-fit">
          <UiCardHeader>
            <UiCardTitle>Skor Talent</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="busy === 'hitung'" class="grid place-items-center gap-3 py-8 text-sm text-muted-foreground" aria-live="polite">
              <LoaderCircle class="size-8 animate-spin text-primary" />
              Menghitung finansial, pasar, legalitas, dan SDM…
            </div>
            <template v-else-if="pengajuan?.skor">
              <ProgramScoreBars :skor="pengajuan.skor" />
              <p class="mt-3 text-xs text-muted-foreground">
                Skor Finansial memakai omzet tahunan dari data SIDT, Legalitas memakai NIB dan sertifikat dari data SIDT,
                SDM memakai jumlah tenaga kerja SIDT. Karena itu skor dapat bernilai walau isian formulir masih sedikit.
              </p>
            </template>
            <p v-else class="text-sm text-muted-foreground">Belum dihitung. Lengkapi data wajib lalu tekan <strong>Hitung Skor</strong>.</p>
          </UiCardContent>
        </UiCard>
      </div>
    </template>
  </div>
</template>
