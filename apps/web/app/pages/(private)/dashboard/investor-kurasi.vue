<script setup lang="ts">
import { endpoint } from "~/lib/directus";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Profil Investor" });
const directus = useDirectus();
interface QueueItem { id: string; nama: string; jenama: string; disetujui_berbagi_pada: string | null;
  disetujui_kurator_pada: string | null; dicabut_pada: string | null }
const { data, refresh } = await useAsyncData("investor:kurasi", () =>
  directus.request(endpoint<QueueItem[]>("/v1/program/executive/investor/kurasi")));
const userId = ref(""); const feedback = ref("");
async function decide(id: string, setuju: boolean) {
  try { await directus.request(endpoint(`/v1/program/executive/investor/profil/${id}/kurasi`, { method: "POST", body: { setuju } }));
    feedback.value = setuju ? "Profil disetujui." : "Persetujuan kurator dicabut."; await refresh(); }
  catch { feedback.value = "Keputusan tidak dapat disimpan."; }
}
async function verify(aktif: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(userId.value)) { feedback.value = "ID pengguna tidak valid."; return; }
  try { await directus.request(endpoint(`/v1/program/executive/investor/verifikasi/${userId.value}`, { method: "POST", body: { aktif } }));
    feedback.value = aktif ? "Akun investor diverifikasi." : "Verifikasi investor dicabut."; }
  catch { feedback.value = "Status verifikasi tidak dapat disimpan."; }
}
</script>

<template>
  <main class="max-w-4xl space-y-6 pb-10"><h1 class="text-2xl font-bold">Kurasi profil investor</h1>
    <section class="rounded-xl border p-4"><h2 class="font-semibold">Verifikasi akun investor</h2>
      <p class="text-sm text-muted-foreground">Gunakan ID akun Directus yang telah diidentifikasi dan disetujui oleh petugas.</p>
      <input v-model="userId" class="mt-2 w-full rounded-md border p-2" placeholder="UUID akun investor" >
      <div class="mt-2 flex gap-2"><button type="button" class="rounded-md border px-3 py-2" @click="verify(true)">Verifikasi</button>
        <button type="button" class="rounded-md border px-3 py-2" @click="verify(false)">Cabut verifikasi</button></div></section>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <section><h2 class="mb-3 font-semibold">Profil usaha</h2><ul class="space-y-3"><li v-for="item in data || []" :key="item.id" class="rounded-xl border p-4">
      <strong>{{ item.jenama }}</strong> · {{ item.nama }}
      <p class="text-sm">{{ item.dicabut_pada ? "Persetujuan dicabut" : item.disetujui_berbagi_pada ? item.disetujui_kurator_pada ? "Disetujui" : "Menunggu kurasi" : "Belum disetujui usaha" }}</p>
      <div v-if="item.disetujui_berbagi_pada && !item.dicabut_pada" class="mt-2 flex gap-2">
        <button type="button" class="rounded-md border px-3 py-1" @click="decide(item.id, true)">Setujui</button>
        <button type="button" class="rounded-md border px-3 py-1" @click="decide(item.id, false)">Cabut persetujuan kurator</button>
      </div></li></ul></section>
  </main>
</template>
