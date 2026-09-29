<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import { KURASI_INVESTOR_STATUS } from "~/constants/PROGRAM";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Profil Investor" });
const directus = useDirectus();
interface QueueItem { id: string; nama: string; jenama: string; disetujui_berbagi_pada: string | null;
  disetujui_kurator_pada: string | null; dicabut_pada: string | null }
const { data, pending, error, refresh } = await useAsyncData("investor:kurasi", () =>
  directus.request(endpoint<QueueItem[]>("/v1/program/executive/investor/kurasi")));
const daftar = computed(() => data.value ?? []);

function statusItem(item: QueueItem) {
  if (item.dicabut_pada) return KURASI_INVESTOR_STATUS.dicabut;
  if (!item.disetujui_berbagi_pada) return KURASI_INVESTOR_STATUS.belum_disetujui;
  return item.disetujui_kurator_pada ? KURASI_INVESTOR_STATUS.disetujui : KURASI_INVESTOR_STATUS.menunggu;
}

const userId = ref("");
const feedback = ref<{ tone: "success" | "error"; text: string } | null>(null);
const memverifikasi = ref(false);
const memutuskan = ref<string | null>(null);

async function decide(id: string, setuju: boolean) {
  memutuskan.value = id;
  feedback.value = null;
  try {
    await directus.request(endpoint(`/v1/program/executive/investor/profil/${id}/kurasi`, { method: "POST", body: { setuju } }));
    feedback.value = { tone: "success", text: setuju ? "Profil disetujui." : "Persetujuan kurator dicabut." };
    await refresh();
  } catch (cause) {
    feedback.value = { tone: "error", text: requestErrorCode(cause) === "FORBIDDEN" ? "Anda tidak berwenang memutuskan profil ini." : "Keputusan tidak dapat disimpan. Coba lagi." };
  } finally {
    memutuskan.value = null;
  }
}
async function verify(aktif: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(userId.value)) {
    feedback.value = { tone: "error", text: "ID pengguna tidak valid." };
    return;
  }
  memverifikasi.value = true;
  feedback.value = null;
  try {
    await directus.request(endpoint(`/v1/program/executive/investor/verifikasi/${userId.value}`, { method: "POST", body: { aktif } }));
    feedback.value = { tone: "success", text: aktif ? "Akun investor diverifikasi." : "Verifikasi investor dicabut." };
  } catch (cause) {
    feedback.value = { tone: "error", text: requestErrorCode(cause) === "FORBIDDEN" ? "Anda tidak berwenang mengubah verifikasi." : "Status verifikasi tidak dapat disimpan. Coba lagi." };
  } finally {
    memverifikasi.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-6 pb-10">
    <h1 class="text-2xl font-bold">Kurasi profil investor</h1>
    <section class="rounded-xl border p-4"><h2 class="font-semibold">Verifikasi akun investor</h2>
      <p class="text-sm text-muted-foreground">Gunakan ID akun Directus yang telah diidentifikasi dan disetujui oleh petugas.</p>
      <UiField class="mt-2 gap-1">
        <UiFieldLabel for="investor-user-id">ID akun investor</UiFieldLabel>
        <UiInput id="investor-user-id" v-model="userId" placeholder="Contoh: 0e6fbd61-…" />
        <UiFieldDescription>ID (UUID) akun investor dari daftar pengguna; tidak ditampilkan ke pelaku usaha.</UiFieldDescription>
      </UiField>
      <div class="mt-2 flex gap-2">
        <UiButton type="button" :disabled="memverifikasi" @click="verify(true)">{{ memverifikasi ? "Memproses…" : "Verifikasi" }}</UiButton>
        <UiButton type="button" variant="outline" :disabled="memverifikasi" @click="verify(false)">{{ memverifikasi ? "Memproses…" : "Cabut verifikasi" }}</UiButton>
      </div>
    </section>
    <p v-if="feedback" :role="feedback.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="feedback.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">{{ feedback.text }}</p>
    <section><h2 class="mb-3 font-semibold">Profil usaha</h2>
      <p v-if="pending" class="text-sm text-muted-foreground">Memuat daftar profil…</p>
      <p v-else-if="error" role="alert" class="rounded-md border p-4 text-sm text-destructive">Daftar profil tidak dapat dimuat. Coba lagi.</p>
      <p v-else-if="!daftar.length" role="status" class="rounded-md border p-4 text-sm text-muted-foreground">Belum ada usaha yang menyetujui berbagi profil.</p>
      <ul v-else class="space-y-3"><li v-for="item in daftar" :key="item.id" class="rounded-xl border p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>{{ item.jenama }}</strong>
          <ProgramStatusPill :meta="statusItem(item)" />
        </div>
        <p class="text-sm">{{ item.nama }}</p>
        <div v-if="item.disetujui_berbagi_pada && !item.dicabut_pada" class="mt-2 flex gap-2">
          <UiButton type="button" size="sm" :disabled="memutuskan === item.id" @click="decide(item.id, true)">{{ memutuskan === item.id ? "Memproses…" : "Setujui" }}</UiButton>
          <UiButton type="button" size="sm" variant="outline" :disabled="memutuskan === item.id" @click="decide(item.id, false)">Cabut persetujuan kurator</UiButton>
        </div>
      </li></ul></section>
  </main>
</template>
