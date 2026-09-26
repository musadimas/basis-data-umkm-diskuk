<script setup lang="ts">
import { TALENTA_STATUS } from "~/constants/OPERASIONAL";
import type { BeritaAcara, TalentaRingkas } from "~/types/operasional";

definePageMeta({ layout: "dashboard" });

useSeoMeta({ title: "Talent Scouting – Dashboard UMKM DisKUK Jawa Barat" });

const statusFilter = ref<string>("");
const page = ref(1);
const isProvinsi = ref(false);

const PROVINSI_ROLE_ID = "7d6d493c-1a6d-4c59-9e74-40d42a7862eb";

const { data: sesi } = await useFetch<{ data?: { role?: string } }>("/panel/users/me", {
  server: false,
});
watch(sesi, (s) => {
  const role = s?.data?.role;
  isProvinsi.value = role === "provinsi" || role === PROVINSI_ROLE_ID;
}, { immediate: true });

const query = computed(() => ({
  status: statusFilter.value || undefined,
  page: page.value,
  pageSize: 25,
}));

const { data: daftar, refresh } = await useFetch<{ data: TalentaRingkas[]; meta: { total: number } }>(
  "/panel/operasional/talenta",
  { query },
);

const { data: riwayatBa } = await useFetch<{ data: BeritaAcara[] }>(
  "/panel/operasional/berita-acara",
  { server: false },
);

const dipilih = ref<string[]>([]);
const catatan = ref("");
const pesanBa = ref<string | null>(null);
const menerbitkan = ref(false);

const togglePilih = (id: string) => {
  dipilih.value = dipilih.value.includes(id)
    ? dipilih.value.filter((v) => v !== id)
    : [...dipilih.value, id];
};

const terbitkan = async () => {
  menerbitkan.value = true;
  pesanBa.value = null;
  try {
    const res = await $fetch<{ data: { nomor: string; jumlah: number } }>("/panel/operasional/berita-acara", {
      method: "POST",
      body: { talentaIds: dipilih.value, catatan: catatan.value || null },
    });
    pesanBa.value = `Berita Acara ${res.data.nomor} terbit. ${res.data.jumlah} talenta masuk Talent Pool (Scouting).`;
    dipilih.value = [];
    await refresh();
  } catch {
    pesanBa.value = "Penerbitan gagal. Pastikan status masih dinilai.";
  } finally {
    menerbitkan.value = false;
  }
};
</script>

<template>
  <div class="space-y-5 pb-8">
    <h1 class="text-xl font-bold">Talent Scouting</h1>

    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter status">
      <UiButton
        size="sm"
        :variant="statusFilter === '' ? 'default' : 'outline'"
        @click="statusFilter = ''; page = 1"
      >
        Semua
      </UiButton>
      <UiButton
        v-for="s in TALENTA_STATUS"
        :key="s.value"
        size="sm"
        :variant="statusFilter === s.value ? 'default' : 'outline'"
        @click="statusFilter = s.value; page = 1"
      >
        {{ s.label }}
      </UiButton>
    </div>

    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[720px] text-sm">
        <thead>
          <tr class="bg-muted text-left">
            <th v-if="isProvinsi" class="px-3 py-2">Pilih</th>
            <th class="px-3 py-2">Usaha</th>
            <th class="px-3 py-2">Kab/Kota</th>
            <th class="px-3 py-2">Skor</th>
            <th class="px-3 py-2">Rekomendasi</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2">Diajukan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in daftar?.data ?? []" :key="t.id" class="border-t">
            <td v-if="isProvinsi" class="px-3 py-2">
              <input
                v-if="t.status === 'dinilai'"
                type="checkbox"
                :checked="dipilih.includes(t.id)"
                :aria-label="`Pilih ${t.usaha.nama}`"
                @change="togglePilih(t.id)"
              >
            </td>
            <td class="px-3 py-2">
              <NuxtLink :to="`/dashboard/talenta/${t.id}`" class="underline">{{ t.usaha.nama }}</NuxtLink>
            </td>
            <td class="px-3 py-2">{{ t.kota.nama ?? "–" }}</td>
            <td class="px-3 py-2">{{ t.skorTotal.toFixed(2) }}</td>
            <td class="px-3 py-2">{{ t.rekomendasi }}</td>
            <td class="px-3 py-2"><OperasionalTalentaStatusBadge :status="t.status" /></td>
            <td class="px-3 py-2">{{ t.diajukanPada ?? "–" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isProvinsi" class="space-y-2 rounded-lg border bg-card p-4">
      <h2 class="font-semibold">Terbitkan Berita Acara &amp; Masukkan ke Talent Pool</h2>
      <label class="block text-sm">Catatan (opsional)
        <input v-model="catatan" maxlength="2000" class="mt-1 w-full rounded-md border px-2 py-1.5" >
      </label>
      <UiButton :disabled="dipilih.length === 0 || menerbitkan" @click="terbitkan">
        {{ menerbitkan ? "Menerbitkan…" : "Terbitkan Berita Acara" }}
      </UiButton>
      <p v-if="pesanBa" class="text-sm" role="status">{{ pesanBa }}</p>
    </div>

    <section v-if="isProvinsi" aria-label="Riwayat Berita Acara" class="space-y-2">
      <h2 class="font-semibold">Riwayat Berita Acara</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="ba in riwayatBa?.data ?? []" :key="ba.id">
          {{ ba.nomor }} — {{ ba.tanggal }} ({{ ba.jumlahTalenta }} talenta)
        </li>
      </ul>
    </section>
  </div>
</template>
