<script setup lang="ts">
import { ATRIBUT_JABAR } from "~/constants/OPERASIONAL";
import { KLINIK_JENIS_OUTCOME } from "~/constants/PROGRAM";
import { formatAnalyticsCurrency, formatAnalyticsWib } from "~/lib/analytics-format";
import { endpoint } from "~/lib/directus";
import type { UsahaLapangan } from "~/types/operasional";

definePageMeta({ layout: "dashboard" });

useSeoMeta({ title: "Ubah Data Lapangan – Dashboard UMKM DisKUK Jawa Barat" });

const route = useRoute();
const id = String(route.params.id);
const directus = useDirectus();

const { data, pending, error, refresh } = await useAsyncData(`operasional:usaha:${id}`, () =>
  directus.request(endpoint<UsahaLapangan>(`/operasional/usaha/${id}`)),
);

const sidt = reactive<Record<string, string>>({});
const atribut = reactive<Record<string, string>>({});
const fieldErrors = ref<Record<string, string>>({});
const statusMsg = ref<string | null>(null);
const menyimpan = ref(false);
const memverifikasi = ref(false);

watch(data, (res) => {
  const s = res?.sidt;
  if (s) {
    sidt.nama = s.nama ?? "";
    sidt.nib = s.nib ?? "";
    sidt.kegiatanUtama = s.kegiatanUtama ?? "";
    sidt.produkUtama = s.produkUtama ?? "";
    sidt.kodeKbli = s.kodeKbli ?? "";
    sidt.skala = s.skala ?? "";
    sidt.omzetTahunan = s.omzetTahunan == null ? "" : String(s.omzetTahunan);
    sidt.totalAset = s.totalAset == null ? "" : String(s.totalAset);
    sidt.latitude = s.latitude == null ? "" : String(s.latitude);
    sidt.longitude = s.longitude == null ? "" : String(s.longitude);
  }
  const a = res?.atribut;
  if (a) {
    for (const item of ATRIBUT_JABAR) {
      const v = a[item.key];
      atribut[item.key] = v === true ? "true" : v === false ? "false" : "null";
    }
  }
}, { immediate: true });

type FieldsError = { errors?: { extensions?: { fields?: Record<string, string> } }[]; data?: { errors?: { extensions?: { fields?: Record<string, string> } }[] } };

const simpan = async () => {
  menyimpan.value = true;
  statusMsg.value = null;
  fieldErrors.value = {};
  try {
    const body: LapanganPatch = {
      sidt: {
        nama: sidt.nama,
        nib: sidt.nib === "" ? null : sidt.nib,
        kegiatanUtama: sidt.kegiatanUtama === "" ? null : sidt.kegiatanUtama,
        produkUtama: sidt.produkUtama === "" ? null : sidt.produkUtama,
        kodeKbli: sidt.kodeKbli === "" ? null : sidt.kodeKbli,
        skala: sidt.skala === "" ? undefined : sidt.skala,
        omzetTahunan: sidt.omzetTahunan === "" ? null : Number(sidt.omzetTahunan),
        totalAset: sidt.totalAset === "" ? null : Number(sidt.totalAset),
        latitude: sidt.latitude === "" ? null : Number(sidt.latitude),
        longitude: sidt.longitude === "" ? null : Number(sidt.longitude),
      },
      atribut: Object.fromEntries(
        ATRIBUT_JABAR.map((item) => [
          item.key,
          atribut[item.key] === "true" ? true : atribut[item.key] === "false" ? false : null,
        ]),
      ),
    };
    await directus.request(endpoint(`/operasional/usaha/${id}`, { method: "PATCH", body }));
    statusMsg.value = "Data lapangan tersimpan.";
    await refresh();
  } catch (e) {
    // Akses defensif: SDK RequestError (errors[0]) maupun ofetch (data.errors[0]) membawa fields galat.
    fieldErrors.value = (e as FieldsError)?.errors?.[0]?.extensions?.fields
      ?? (e as FieldsError)?.data?.errors?.[0]?.extensions?.fields
      ?? {};
    statusMsg.value = "Penyimpanan gagal. Periksa field bertanda galat.";
  } finally {
    menyimpan.value = false;
  }
};

const verifikasi = async () => {
  memverifikasi.value = true;
  try {
    await directus.request(endpoint(`/operasional/usaha/${id}/verifikasi`, { method: "POST" }));
    statusMsg.value = "Data terverifikasi.";
    await refresh();
  } catch {
    statusMsg.value = "Verifikasi gagal. Pastikan atribut sudah diisi.";
  } finally {
    memverifikasi.value = false;
  }
};

type AtributKey = (typeof ATRIBUT_JABAR)[number]["key"];

interface SidtPatch {
  nama?: string;
  nib?: string | null;
  kegiatanUtama?: string | null;
  produkUtama?: string | null;
  kodeKbli?: string | null;
  skala?: string;
  omzetTahunan?: number | null;
  totalAset?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface LapanganPatch {
  sidt: SidtPatch;
  atribut: Partial<Record<AtributKey, boolean | null>>;
}

const verifikasiInfo = computed(() => data.value?.verifikasi);

// Hasil konsultasi klinik (R04): hanya outcome terverifikasi, tanpa diagnosis atau catatan sesi.
const hasilKonsultasi = computed(() => data.value?.hasilKonsultasi ?? []);
const labelAtribut = (atribut: string) => ATRIBUT_JABAR.find((item) => item.key === atribut)?.label ?? atribut;
const labelJenis = (jenis: string) => KLINIK_JENIS_OUTCOME.find((item) => item.value === jenis)?.label ?? jenis;
</script>

<template>
  <div class="space-y-5 pb-8">
    <h1 class="text-xl font-bold">Ubah Data Lapangan — {{ data?.sidt?.nama ?? "…" }}</h1>
    <p class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="note">
      Perubahan kolom SIDT dapat tertimpa oleh sinkronisasi SIDT berikutnya bila data sumber lebih baru.
    </p>
    <p v-if="pending" class="text-sm text-muted-foreground">Memuat data usaha…</p>
    <p v-else-if="error" class="text-sm text-destructive" role="alert">
      Data usaha tidak ditemukan atau di luar wilayah Anda.
    </p>
    <template v-else-if="data">
      <section aria-label="Data SIDT" class="space-y-3 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">Data SIDT</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-nama">Nama usaha</UiFieldLabel>
            <UiInput id="sidt-nama" v-model="sidt.nama" />
            <span v-if="fieldErrors.nama" class="text-xs text-destructive">{{ fieldErrors.nama }}</span>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-nib">NIB (13 digit)</UiFieldLabel>
            <UiInput id="sidt-nib" v-model="sidt.nib" inputmode="numeric" />
            <span v-if="fieldErrors.nib" class="text-xs text-destructive">{{ fieldErrors.nib }}</span>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-kegiatan">Kegiatan utama</UiFieldLabel>
            <UiInput id="sidt-kegiatan" v-model="sidt.kegiatanUtama" />
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-produk">Produk utama</UiFieldLabel>
            <UiInput id="sidt-produk" v-model="sidt.produkUtama" />
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-kbli">Kode KBLI (5 digit)</UiFieldLabel>
            <UiInput id="sidt-kbli" v-model="sidt.kodeKbli" inputmode="numeric" maxlength="5" />
            <span v-if="fieldErrors.kodeKbli" class="text-xs text-destructive">{{ fieldErrors.kodeKbli }}</span>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-skala">Skala</UiFieldLabel>
            <UiSelect v-model="sidt.skala">
              <UiSelectTrigger id="sidt-skala"><UiSelectValue placeholder="Pilih skala" /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="micro">Mikro</UiSelectItem>
                <UiSelectItem value="small">Kecil</UiSelectItem>
                <UiSelectItem value="medium">Menengah</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-omzet">Omzet tahunan (Rp)</UiFieldLabel>
            <UiInput id="sidt-omzet" v-model="sidt.omzetTahunan" inputmode="numeric" />
            <span class="text-xs text-muted-foreground">{{ formatAnalyticsCurrency(Number(sidt.omzetTahunan) || null) }}</span>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-aset">Total aset (Rp)</UiFieldLabel>
            <UiInput id="sidt-aset" v-model="sidt.totalAset" inputmode="numeric" />
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-latitude">Latitude</UiFieldLabel>
            <UiInput id="sidt-latitude" v-model="sidt.latitude" inputmode="decimal" />
            <span v-if="fieldErrors.latitude" class="text-xs text-destructive">{{ fieldErrors.latitude }}</span>
          </UiField>
          <UiField class="gap-1 text-sm">
            <UiFieldLabel for="sidt-longitude">Longitude</UiFieldLabel>
            <UiInput id="sidt-longitude" v-model="sidt.longitude" inputmode="decimal" />
          </UiField>
        </div>
      </section>

      <section aria-label="15 Atribut Jabar" class="space-y-3 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">15 Atribut Jabar</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <UiField v-for="item in ATRIBUT_JABAR" :key="item.key" class="gap-1 text-sm">
            <UiFieldLabel :for="`atribut-${item.key}`">{{ item.label }}</UiFieldLabel>
            <UiSelect v-model="atribut[item.key]">
              <UiSelectTrigger :id="`atribut-${item.key}`"><UiSelectValue /></UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem value="true">Ya</UiSelectItem>
                <UiSelectItem value="false">Tidak</UiSelectItem>
                <UiSelectItem value="null">Belum didata</UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </UiField>
        </div>
      </section>

      <section aria-label="Verifikasi Legalitas" class="space-y-2 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">Verifikasi Legalitas</h2>
        <p v-if="verifikasiInfo?.terverifikasiOleh" class="text-sm">
          Terverifikasi oleh {{ verifikasiInfo.terverifikasiOleh.nama }} pada
          {{ formatAnalyticsWib(verifikasiInfo.terverifikasiPada) }}
        </p>
        <p v-else class="text-sm text-muted-foreground">Belum diverifikasi.</p>
        <UiButton variant="outline" size="sm" :disabled="memverifikasi" @click="verifikasi">
          {{ memverifikasi ? "Memproses…" : "Tandai Terverifikasi" }}
        </UiButton>
      </section>

      <section aria-label="Hasil konsultasi klinik" class="space-y-3 rounded-lg border bg-card p-4" data-testid="hasil-konsultasi">
        <h2 class="font-semibold">Hasil konsultasi klinik (terverifikasi)</h2>
        <p v-if="!hasilKonsultasi.length" class="text-sm text-muted-foreground">Belum ada hasil konsultasi terverifikasi.</p>
        <ul v-else class="space-y-3">
          <li v-for="hasil in hasilKonsultasi" :key="hasil.id" class="space-y-2 rounded-md border p-3 text-sm" data-testid="hasil-konsultasi-item">
            <p><span class="font-mono text-xs">{{ hasil.nomorTiket }}</span> · {{ hasil.poli }}</p>
            <p class="text-xs text-muted-foreground">
              Diverifikasi oleh {{ hasil.diverifikasiOleh ?? "petugas" }}<template v-if="hasil.diverifikasiPada"> pada {{ formatAnalyticsWib(hasil.diverifikasiPada) }}</template>
            </p>
            <ul class="flex flex-wrap gap-1.5">
              <li v-for="item in hasil.items" :key="item.atribut" class="rounded-full border bg-background px-2.5 py-0.5 text-xs">
                {{ labelAtribut(item.atribut) }} <span class="text-muted-foreground">· {{ labelJenis(item.jenis) }}</span>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <div class="flex items-center gap-3">
        <UiButton :disabled="menyimpan || pending" @click="simpan">
          {{ menyimpan ? "Menyimpan…" : "Simpan Perubahan" }}
        </UiButton>
        <p v-if="statusMsg" class="text-sm" role="status">{{ statusMsg }}</p>
      </div>
    </template>
  </div>
</template>
