<script setup lang="ts">
import { ArrowLeft, Calculator, LoaderCircle } from "@lucide/vue";
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
  TalentPengajuan,
  TalentPengajuanInput,
  TalentUsahaDetail,
} from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Ajukan ke Talent Scouting – Dashboard UMKM" });

const ERRORS: RuntimeLabelMap = {
  PENGAJUAN_SUDAH_ADA: "Usaha ini sudah memiliki pengajuan yang masih terbuka.",
  PENGAJUAN_CLOSED: "Pengajuan ini sudah diputuskan dan tidak dapat diubah.",
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

/** An open submission is edited in place; a rejected one starts a fresh submission. */
function syncFrom(value: TalentPengajuan | null) {
  pengajuan.value = value && ["draft", "dinilai", "disetujui"].includes(value.status) ? value : null;
  if (!pengajuan.value) return;
  const source = pengajuan.value;
  form.kapasitasProduksi = source.kapasitasProduksi === null ? "" : String(source.kapasitasProduksi);
  form.satuan = source.satuan ?? "";
  for (const { value: jenis } of JENIS_LEGALITAS) form.kesiapanLegalitas[jenis] = source.kesiapanLegalitas[jenis] ?? "belum";
  form.literasiQris = source.literasiQris;
  form.literasiPembukuanDigital = source.literasiPembukuanDigital;
  form.suratKomitmen = source.suratKomitmen;
  form.catatan = source.catatan ?? "";
  if (source.suratKomitmen && !suratName.value) suratName.value = "Surat komitmen";
}
watch(() => data.value?.pengajuan ?? null, syncFrom, { immediate: true });

const readOnly = computed(() => pengajuan.value?.status === "disetujui");
const rejected = computed(() => data.value?.pengajuan?.status === "ditolak" && !pengajuan.value);
const usaha = computed(() => data.value?.usaha);

const saving = ref(false);
const scoring = ref(false);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);

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
  message.value = null;
  saving.value = true;
  try {
    await save();
    message.value = { tone: "success", text: "Draft pengajuan tersimpan." };
  } catch (cause) {
    fail(cause, "Pengajuan tidak dapat disimpan. Coba lagi.");
  } finally {
    saving.value = false;
  }
}

async function hitungSkor() {
  message.value = null;
  scoring.value = true;
  try {
    const saved = await save();
    if (!saved) return;
    // Keep the calculation state visible long enough to read, even when the server is fast.
    const [scored] = await Promise.all([
      directus.request(endpoint<TalentPengajuan>(`/v1/program/talent/pengajuan/${saved.id}/hitung-skor`, { method: "POST" })),
      new Promise((resolve) => setTimeout(resolve, 900)),
    ]);
    pengajuan.value = scored;
    await refresh();
  } catch (cause) {
    fail(cause, "Skor tidak dapat dihitung. Coba lagi.");
  } finally {
    scoring.value = false;
  }
}

const rupiah = (value: number | null) => (value === null ? "Belum tersedia" : formatAnalyticsCurrency(value));
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
            <UiCardDescription v-if="readOnly">Pengajuan ini sudah disetujui melalui Berita Acara dan tidak dapat diubah.</UiCardDescription>
            <UiCardDescription v-else-if="rejected">Pengajuan sebelumnya ditolak. Isi formulir untuk mengajukan ulang.</UiCardDescription>
            <UiCardDescription v-else>Mengubah isian akan menghapus skor sebelumnya sampai skor dihitung ulang.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form class="grid gap-5" novalidate @submit.prevent="hitungSkor">
              <fieldset :disabled="readOnly || saving || scoring" class="grid gap-5">
                <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <UiField class="gap-2">
                    <UiFieldLabel for="kapasitas">Kapasitas produksi per bulan</UiFieldLabel>
                    <UiInput id="kapasitas" v-model="form.kapasitasProduksi" type="number" min="0" inputmode="decimal" />
                  </UiField>
                  <UiField class="gap-2">
                    <UiFieldLabel for="satuan">Satuan</UiFieldLabel>
                    <UiInput id="satuan" v-model="form.satuan" maxlength="32" placeholder="kg, pcs, liter" />
                  </UiField>
                </div>

                <fieldset class="grid gap-3">
                  <legend class="mb-2 text-sm font-medium">Kesiapan legalitas</legend>
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="grid gap-1 text-sm">
                      <span>{{ jenis.label }}</span>
                      <select
                        v-model="form.kesiapanLegalitas[jenis.value]"
                        class="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        :name="`kesiapan-${jenis.value}`"
                      >
                        <option v-for="option in KESIAPAN_LEGALITAS" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
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

              <div v-if="!readOnly" class="flex flex-wrap gap-3">
                <UiButton type="button" variant="outline" :disabled="saving || scoring" @click="saveDraft">
                  {{ saving ? "Menyimpan…" : "Simpan Draft" }}
                </UiButton>
                <UiButton type="submit" :disabled="saving || scoring">
                  <LoaderCircle v-if="scoring" class="size-4 animate-spin" />
                  <Calculator v-else class="size-4" />
                  {{ scoring ? "Menghitung skor…" : "Hitung Skor" }}
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
            <div v-if="scoring" class="grid place-items-center gap-3 py-8 text-sm text-muted-foreground" aria-live="polite">
              <LoaderCircle class="size-8 animate-spin text-primary" />
              Menghitung finansial, pasar, legalitas, dan SDM…
            </div>
            <ProgramScoreBars v-else-if="pengajuan?.skor" :skor="pengajuan.skor" />
            <p v-else class="text-sm text-muted-foreground">Belum dihitung. Lengkapi data lalu tekan <strong>Hitung Skor</strong>.</p>
          </UiCardContent>
        </UiCard>
      </div>
    </template>
  </div>
</template>
