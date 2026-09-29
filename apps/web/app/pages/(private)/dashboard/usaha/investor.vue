<script setup lang="ts">
import { uploadFiles } from "@directus/sdk";
import { endpoint } from "~/lib/directus";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Profil Kemitraan Investor" });
const directus = useDirectus();
interface OwnProfile {
  jenama: string; kebutuhan_modal: number | string; skema: string[]; kapasitas_pasok: string | null;
  margin_persen: number | string | null; pitch_deck: string | null;
  disetujui_berbagi_pada: string | null; disetujui_kurator_pada: string | null; dicabut_pada: string | null;
}
const { data, refresh } = await useAsyncData("investor:own", () =>
  directus.request(endpoint<OwnProfile | null>("/v1/program/executive/investor/profil-saya")));
const jenama = ref(""); const kebutuhanModal = ref<number | null>(null);
const skema = ref<string[]>([]); const kapasitasPasok = ref(""); const marginPersen = ref<number | null>(null);
const pitchDeck = ref<string | null>(null); const file = ref<File | null>(null);
const agree = ref(false); const saving = ref(false); const feedback = ref("");
watch(data, (v) => {
  if (!v) return;
  jenama.value = v.jenama; kebutuhanModal.value = Number(v.kebutuhan_modal); skema.value = v.skema;
  kapasitasPasok.value = v.kapasitas_pasok ?? "";
  marginPersen.value = v.margin_persen == null ? null : Number(v.margin_persen);
  pitchDeck.value = v.pitch_deck; agree.value = Boolean(v.disetujui_berbagi_pada && !v.dicabut_pada);
}, { immediate: true });
function picked(event: Event) {
  // SAFETY: handler hanya dipasang pada <input type="file"> di template ini.
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}
async function save(setuju: boolean) {
  if (kebutuhanModal.value == null || !jenama.value.trim()) return;
  saving.value = true; feedback.value = "";
  try {
    if (file.value) {
      if (file.value.type !== "application/pdf") throw new Error("PDF only");
      const body = new FormData(); body.append("file", file.value);
      const uploaded = await directus.request(uploadFiles(body)); pitchDeck.value = uploaded.id;
    }
    await directus.request(endpoint("/v1/program/executive/investor/profil", { method: "POST", body: {
      jenama: jenama.value.trim(), kebutuhanModal: kebutuhanModal.value, skema: skema.value,
      kapasitasPasok: kapasitasPasok.value || null, marginPersen: marginPersen.value,
      pitchDeck: pitchDeck.value, setuju,
    } }));
    feedback.value = setuju ? "Profil dikirim untuk kurasi. Perubahan perlu disetujui ulang." : "Persetujuan berbagi data dicabut.";
    await refresh();
  } catch { feedback.value = "Profil tidak dapat disimpan. Periksa isian dan PDF."; }
  finally { saving.value = false; }
}
const choices = [["kur", "KUR"], ["lpdb", "LPDB"], ["offtaker", "Offtaker"],
  ["penyertaan_modal", "Penyertaan modal"], ["konsinyasi", "Konsinyasi"], ["ekspor", "Ekspor"]];
</script>

<template>
  <main class="max-w-3xl space-y-5 pb-10">
    <h1 class="text-2xl font-bold">Profil kemitraan investor</h1>
    <p class="text-sm">Data finansial hanya dibuka untuk investor terverifikasi setelah Anda memberi persetujuan dan kurator menyetujui profil.</p>
    <p v-if="data?.disetujui_kurator_pada && !data?.dicabut_pada" class="text-sm text-emerald-700">Profil disetujui untuk dibagikan.</p>
    <form class="grid gap-4 rounded-xl border p-5" @submit.prevent="save(true)">
      <label class="grid gap-1">Jenama<input v-model="jenama" required maxlength="160" class="rounded-md border p-2" ></label>
      <label class="grid gap-1">Kebutuhan modal (Rp)<input v-model.number="kebutuhanModal" required type="number" min="1" class="rounded-md border p-2" ></label>
      <fieldset class="grid gap-2"><legend>Skema kemitraan</legend><label v-for="option in choices" :key="option[0]" class="flex gap-2">
        <input v-model="skema" type="checkbox" :value="option[0]" >{{ option[1] }}</label></fieldset>
      <label class="grid gap-1">Kapasitas pasok<input v-model="kapasitasPasok" maxlength="300" class="rounded-md border p-2" ></label>
      <label class="grid gap-1">Margin (%) — deklarasi pelaku usaha<input v-model.number="marginPersen" type="number" min="0" max="100" step="0.01" class="rounded-md border p-2" ></label>
      <label class="grid gap-1">Pitch deck PDF (opsional)<input type="file" accept="application/pdf" @change="picked" ></label>
      <label class="flex gap-2"><input v-model="agree" type="checkbox" required >Saya menyetujui pembagian profil dan data finansial di atas kepada investor terverifikasi.</label>
      <div class="flex gap-3"><button type="submit" :disabled="saving || !agree" class="rounded-md bg-primary px-4 py-2 text-primary-foreground">Ajukan profil</button>
        <button v-if="data?.disetujui_berbagi_pada && !data?.dicabut_pada" type="button" :disabled="saving" class="rounded-md border px-4 py-2" @click="save(false)">Cabut persetujuan</button></div>
    </form>
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </main>
</template>
