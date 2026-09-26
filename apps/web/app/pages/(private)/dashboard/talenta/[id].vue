<script setup lang="ts">
import { berkasUrl, type TalentaDetail } from "~/types/operasional";

definePageMeta({ layout: "dashboard" });

useSeoMeta({ title: "Detail Talenta – Dashboard UMKM DisKUK Jawa Barat" });

const route = useRoute();
const id = String(route.params.id);

const { data, error, refresh } = await useFetch<{ data: TalentaDetail }>(
  () => `/panel/operasional/talenta/${id}`,
);

const alasan = ref("");
const pesan = ref<string | null>(null);
const memproses = ref(false);

const aksi = async (jenis: "nominasi" | "tolak") => {
  memproses.value = true;
  pesan.value = null;
  try {
    await $fetch(`/panel/operasional/talenta/${id}/${jenis}`, {
      method: "POST",
      body: jenis === "tolak" ? { alasan: alasan.value } : {},
    });
    pesan.value = jenis === "nominasi" ? "Talenta dinominasikan." : "Talenta ditolak.";
    await refresh();
  } catch {
    pesan.value = "Aksi gagal. Periksa status dan isian.";
  } finally {
    memproses.value = false;
  }
};

const detail = computed(() => data.value?.data);
</script>

<template>
  <div class="space-y-5 pb-8">
    <h1 class="text-xl font-bold">Detail Talenta</h1>
    <p v-if="error" class="text-sm text-destructive" role="alert">Talenta tidak ditemukan.</p>
    <template v-else-if="detail">
      <section class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div>
          <p class="font-semibold">{{ detail.usaha.nama }}</p>
          <p class="text-sm text-muted-foreground">{{ detail.kota.nama ?? "–" }}</p>
        </div>
        <OperasionalTalentaStatusBadge :status="detail.status" />
      </section>

      <OperasionalTalentIndexResult
        :hasil="{ ...detail.skor, rekomendasi: detail.rekomendasi, rubrikVersi: detail.rubrikVersi }"
        :animated="false"
      />

      <section aria-label="Parameter form" class="rounded-lg border bg-card p-4 text-sm">
        <h2 class="font-semibold">Parameter Operasional</h2>
        <p>Kapasitas: {{ detail.form.kapasitasProduksiBulanan }} {{ detail.form.satuanKapasitas }}</p>
        <p v-if="detail.suratKomitmen">
          <a :href="berkasUrl(detail.suratKomitmen.id)" target="_blank" rel="noopener" class="underline">
            {{ detail.suratKomitmen.nama }}
          </a>
        </p>
      </section>

      <section aria-label="Riwayat" class="rounded-lg border bg-card p-4 text-sm">
        <h2 class="font-semibold">Riwayat</h2>
        <ul class="space-y-1">
          <li v-for="(r, i) in detail.riwayat" :key="i">{{ r.tahap }} — {{ r.pada ?? "–" }}</li>
        </ul>
      </section>

      <div v-if="detail.status === 'diajukan' || detail.status === 'dinilai'" class="space-y-2 rounded-lg border bg-card p-4">
        <h2 class="font-semibold">Aksi Provinsi</h2>
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="detail.status === 'diajukan'" size="sm" :disabled="memproses" @click="aksi('nominasi')">
            Nominasikan
          </UiButton>
          <UiButton size="sm" variant="outline" :disabled="memproses" @click="aksi('tolak')">Tolak</UiButton>
        </div>
        <label class="block text-sm">Alasan penolakan (wajib bila menolak, 5–1000 karakter)
          <input v-model="alasan" class="mt-1 w-full rounded-md border px-2 py-1.5" >
        </label>
        <p v-if="pesan" class="text-sm" role="status">{{ pesan }}</p>
      </div>
    </template>
  </div>
</template>
