<script setup lang="ts">
import { ATRIBUT_JABAR } from "~/constants/OPERASIONAL";
import { KLINIK_JENIS_OUTCOME } from "~/constants/PROGRAM";
import { formatAnalyticsCurrency, formatAnalyticsWib } from "~/lib/analytics-format";
import type { UsahaLapangan } from "~/types/operasional";

definePageMeta({ layout: "dashboard" });

useSeoMeta({ title: "Ubah Data Lapangan – Dashboard UMKM DisKUK Jawa Barat" });

const route = useRoute();
const id = String(route.params.id);

const { data, pending, error, refresh } = await useFetch<{ data: UsahaLapangan }>(
  () => `/panel/operasional/usaha/${id}`,
);

const sidt = reactive<Record<string, string>>({});
const atribut = reactive<Record<string, string>>({});
const fieldErrors = ref<Record<string, string>>({});
const statusMsg = ref<string | null>(null);
const menyimpan = ref(false);
const memverifikasi = ref(false);

watch(data, (res) => {
  const s = res?.data?.sidt;
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
  const a = res?.data?.atribut;
  if (a) {
    for (const item of ATRIBUT_JABAR) {
      const v = a[item.key];
      atribut[item.key] = v === true ? "true" : v === false ? "false" : "null";
    }
  }
}, { immediate: true });

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
    await $fetch(`/panel/operasional/usaha/${id}`, { method: "PATCH", body });
    statusMsg.value = "Data lapangan tersimpan.";
    await refresh();
  } catch (e) {
    type FieldsError = { data?: { errors?: { extensions?: { fields?: Record<string, string> } }[] } };
    // SAFETY: $fetch melempar FetchError shaped FieldsError; akses defensif via ?.
    fieldErrors.value = (e as FieldsError)?.data?.errors?.[0]?.extensions?.fields ?? {};
    statusMsg.value = "Penyimpanan gagal. Periksa field bertanda galat.";
  } finally {
    menyimpan.value = false;
  }
};

const verifikasi = async () => {
  memverifikasi.value = true;
  try {
    await $fetch(`/panel/operasional/usaha/${id}/verifikasi`, { method: "POST" });
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

const verifikasiInfo = computed(() => data.value?.data?.verifikasi);

// Hasil konsultasi klinik (R04): hanya outcome terverifikasi, tanpa diagnosis atau catatan sesi.
const hasilKonsultasi = computed(() => data.value?.data?.hasilKonsultasi ?? []);
const labelAtribut = (atribut: string) => ATRIBUT_JABAR.find((item) => item.key === atribut)?.label ?? atribut;
const labelJenis = (jenis: string) => KLINIK_JENIS_OUTCOME.find((item) => item.value === jenis)?.label ?? jenis;
</script>

<template>
  <div class="space-y-5 pb-8">
    <h1 class="text-xl font-bold">Ubah Data Lapangan — {{ data?.data?.sidt?.nama ?? "…" }}</h1>
    <p class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="note">
      Perubahan kolom SIDT dapat tertimpa oleh sinkronisasi SIDT berikutnya bila data sumber lebih baru.
    </p>
    <p v-if="error" class="text-sm text-destructive" role="alert">
      Data usaha tidak ditemukan atau di luar wilayah Anda.
    </p>
    <template v-else-if="data?.data">
      <section aria-label="Data SIDT" class="space-y-3 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">Data SIDT</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="text-sm">Nama usaha
            <input v-model="sidt.nama" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            <span v-if="fieldErrors.nama" class="text-xs text-destructive">{{ fieldErrors.nama }}</span>
          </label>
          <label class="text-sm">NIB (13 digit)
            <input v-model="sidt.nib" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            <span v-if="fieldErrors.nib" class="text-xs text-destructive">{{ fieldErrors.nib }}</span>
          </label>
          <label class="text-sm">Kegiatan utama
            <input v-model="sidt.kegiatanUtama" class="mt-1 w-full rounded-md border px-2 py-1.5" >
          </label>
          <label class="text-sm">Produk utama
            <input v-model="sidt.produkUtama" class="mt-1 w-full rounded-md border px-2 py-1.5" >
          </label>
          <label class="text-sm">Kode KBLI (5 digit)
            <input v-model="sidt.kodeKbli" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            <span v-if="fieldErrors.kodeKbli" class="text-xs text-destructive">{{ fieldErrors.kodeKbli }}</span>
          </label>
          <label class="text-sm">Skala
            <select v-model="sidt.skala" class="mt-1 w-full rounded-md border px-2 py-1.5">
              <option value="micro">Mikro</option>
              <option value="small">Kecil</option>
              <option value="medium">Menengah</option>
            </select>
          </label>
          <label class="text-sm">Omzet tahunan (Rp)
            <input v-model="sidt.omzetTahunan" inputmode="numeric" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            <span class="text-xs text-muted-foreground">{{ formatAnalyticsCurrency(Number(sidt.omzetTahunan) || null) }}</span>
          </label>
          <label class="text-sm">Total aset (Rp)
            <input v-model="sidt.totalAset" inputmode="numeric" class="mt-1 w-full rounded-md border px-2 py-1.5" >
          </label>
          <label class="text-sm">Latitude
            <input v-model="sidt.latitude" inputmode="decimal" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            <span v-if="fieldErrors.latitude" class="text-xs text-destructive">{{ fieldErrors.latitude }}</span>
          </label>
          <label class="text-sm">Longitude
            <input v-model="sidt.longitude" inputmode="decimal" class="mt-1 w-full rounded-md border px-2 py-1.5" >
          </label>
        </div>
      </section>

      <section aria-label="15 Atribut Jabar" class="space-y-3 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">15 Atribut Jabar</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <label v-for="item in ATRIBUT_JABAR" :key="item.key" class="text-sm">{{ item.label }}
            <select v-model="atribut[item.key]" class="mt-1 w-full rounded-md border px-2 py-1.5">
              <option value="true">Ya</option>
              <option value="false">Tidak</option>
              <option value="null">Belum didata</option>
            </select>
          </label>
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
