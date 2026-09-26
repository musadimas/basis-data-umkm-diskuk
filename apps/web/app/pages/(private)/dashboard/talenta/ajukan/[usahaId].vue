<script setup lang="ts">
import { useBerkasUpload } from "~/composables/useBerkasUpload";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import type { TalentaForm, TalentaPrefill, TalentIndexHasil } from "~/types/operasional";

definePageMeta({ layout: "dashboard" });

useSeoMeta({ title: "Ajukan Talent Scouting – Dashboard UMKM DisKUK Jawa Barat" });

const route = useRoute();
const router = useRouter();
const usahaId = String(route.params.usahaId);

const { data: prefill, error: prefillError } = await useFetch<{ data: TalentaPrefill }>(
  () => `/panel/operasional/talenta/prefill/${usahaId}`,
);

const form = reactive<TalentaForm>({
  kapasitasProduksiBulanan: 0,
  satuanKapasitas: "unit",
  kesiapanHalal: false,
  kesiapanPirtBpom: false,
  kesiapanHki: false,
  adopsiQris: false,
  pencatatanKeuanganDigital: false,
  suratKomitmenFileId: null,
});

const berkasNama = ref<string | null>(null);
const { mengunggah, galat: galatUnggah, uploadBerkas } = useBerkasUpload();
const skor = ref<TalentIndexHasil | null>(null);
const menghitung = ref(false);
const mengajukan = ref(false);
const pesan = ref<string | null>(null);

const onFile = async (event: Event) => {
  // SAFETY: handler terikat pada <input type="file"> sehingga target selalu elemen input.
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const out = await uploadBerkas(file, "Surat Komitmen Keikutsertaan (simulasi)");
    form.suratKomitmenFileId = out.id;
    berkasNama.value = file.name;
  } catch {
    // galat tampil via galatUnggah
  }
};

const hitungSkor = async () => {
  menghitung.value = true;
  pesan.value = null;
  try {
    const res = await $fetch<{ data: TalentIndexHasil }>("/panel/operasional/talenta/skor", {
      method: "POST",
      body: { usahaId, form },
    });
    skor.value = res.data;
  } catch {
    pesan.value = "Hitung skor gagal. Periksa isian form.";
  } finally {
    menghitung.value = false;
  }
};

const ajukan = async () => {
  mengajukan.value = true;
  pesan.value = null;
  try {
    const res = await $fetch<{ data: { id: string } }>("/panel/operasional/talenta", {
      method: "POST",
      body: { usahaId, form },
    });
    await router.push(`/dashboard/talenta/${res.data.id}`);
  } catch (e) {
    type CodeError = { data?: { errors?: { extensions?: { code?: string } }[] } };
    // SAFETY: $fetch melempar FetchError shaped CodeError; akses defensif via ?.
    const code = (e as CodeError)?.data?.errors?.[0]?.extensions?.code;
    pesan.value = code === "TALENTA_SUDAH_ADA"
      ? "Usaha ini sudah memiliki pengajuan talenta aktif."
      : "Pengajuan gagal. Coba lagi.";
  } finally {
    mengajukan.value = false;
  }
};

const usaha = computed(() => prefill.value?.data?.usaha);
const talentaAktif = computed(() => prefill.value?.data?.talentaAktif);
</script>

<template>
  <div class="space-y-5 pb-8">
    <h1 class="text-xl font-bold">Ajukan ke Talent Scouting</h1>
    <p v-if="prefillError" class="text-sm text-destructive" role="alert">
      Data usaha tidak ditemukan atau di luar wilayah Anda.
    </p>
    <template v-else-if="usaha">
      <section aria-label="Data Bawaan SIDT" class="space-y-2 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">Data Bawaan SIDT (read-only)</h2>
        <dl class="grid gap-2 text-sm md:grid-cols-2">
          <div><dt class="text-muted-foreground">Nama Usaha</dt><dd>{{ usaha.nama }}</dd></div>
          <div><dt class="text-muted-foreground">NIK Terenkripsi</dt><dd data-testid="nik-tersamar">{{ usaha.nikTersamar }}</dd></div>
          <div><dt class="text-muted-foreground">NIB</dt><dd>{{ usaha.nib ?? "–" }}</dd></div>
          <div><dt class="text-muted-foreground">Omzet Historis</dt><dd>{{ formatAnalyticsCurrency(usaha.omzetTahunan) }}</dd></div>
          <div class="md:col-span-2"><dt class="text-muted-foreground">Alamat</dt><dd>{{ usaha.alamat ?? "–" }}</dd></div>
        </dl>
      </section>

      <p v-if="talentaAktif" class="rounded-lg border p-3 text-sm" role="note">
        Usaha ini sudah dalam proses talenta ({{ talentaAktif.status }}).
        <NuxtLink :to="`/dashboard/talenta/${talentaAktif.id}`" class="underline">Lihat detail</NuxtLink>
      </p>

      <template v-else>
        <section aria-label="Parameter Operasional Jabar" class="space-y-3 rounded-lg border bg-card p-4">
          <h2 class="font-semibold">Parameter Operasional Jabar</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="text-sm">Kapasitas Produksi Bulanan
              <input v-model.number="form.kapasitasProduksiBulanan" type="number" min="0" class="mt-1 w-full rounded-md border px-2 py-1.5" >
            </label>
            <label class="text-sm">Satuan
              <select v-model="form.satuanKapasitas" class="mt-1 w-full rounded-md border px-2 py-1.5">
                <option value="unit">Unit</option>
                <option value="kg">Kg</option>
              </select>
            </label>
          </div>
          <div class="grid gap-2 text-sm md:grid-cols-2">
            <label class="flex items-center gap-2"><input v-model="form.kesiapanHalal" type="checkbox" > Sertifikat Halal (kesiapan lanjutan)</label>
            <label class="flex items-center gap-2"><input v-model="form.kesiapanPirtBpom" type="checkbox" > BPOM/PIRT (kesiapan lanjutan)</label>
            <label class="flex items-center gap-2"><input v-model="form.kesiapanHki" type="checkbox" > HKI/Merek (kesiapan lanjutan)</label>
            <label class="flex items-center gap-2"><input v-model="form.adopsiQris" type="checkbox" > Adopsi QRIS</label>
            <label class="flex items-center gap-2"><input v-model="form.pencatatanKeuanganDigital" type="checkbox" > Pencatatan Keuangan Digital</label>
          </div>
          <div class="text-sm">
            <label>Surat Komitmen Keikutsertaan (simulasi bila belum ada dokumen riil)
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="mt-1 block" @change="onFile" >
            </label>
            <p v-if="berkasNama" class="mt-1 text-xs" role="status">Terunggah: {{ berkasNama }}</p>
            <p v-if="galatUnggah" class="mt-1 text-xs text-destructive" role="alert">{{ galatUnggah }}</p>
          </div>
        </section>

        <div class="flex flex-wrap items-center gap-3">
          <UiButton variant="outline" :disabled="menghitung || mengunggah" @click="hitungSkor">
            {{ menghitung ? "Menghitung…" : "Hitung Skor" }}
          </UiButton>
          <UiButton :disabled="!skor || mengajukan" @click="ajukan">
            {{ mengajukan ? "Mengirim…" : "Ajukan ke Talent Scouting" }}
          </UiButton>
        </div>
        <OperasionalTalentIndexResult v-if="skor" :hasil="skor" />
        <p v-if="pesan" class="text-sm" role="status">{{ pesan }}</p>
      </template>
    </template>
  </div>
</template>
