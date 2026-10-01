<script setup lang="ts">
import { uploadFiles } from "@directus/sdk";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Profil Kemitraan Investor" });
const directus = useDirectus();
interface OwnProfile {
  jenama: string; kebutuhan_modal: number | string; skema: string[]; kapasitas_pasok: string | null;
  margin_persen: number | string | null; pitch_deck: string | null;
  disetujui_berbagi_pada: string | null; disetujui_kurator_pada: string | null; dicabut_pada: string | null;
  kurator_dicabut_pada: string | null;
}
const { data, refresh } = await useAsyncData("investor:own", () =>
  directus.request(endpoint<OwnProfile | null>("/v1/program/executive/investor/profil-saya")));
const jenama = ref(""); const kebutuhanModal = ref<number | null>(null);
const skema = ref<string[]>([]); const kapasitasPasok = ref(""); const marginPersen = ref<number | null>(null);
const pitchDeck = ref<string | null>(null); const file = ref<File | null>(null);
const agree = ref(false); const saving = ref(false); const feedback = ref<{ tone: "success" | "error"; text: string } | null>(null);
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
function toggleSkema(value: string, checked: boolean | "indeterminate") {
  skema.value = checked === true ? [...skema.value, value] : skema.value.filter((item) => item !== value);
}
async function save(setuju: boolean) {
  if (kebutuhanModal.value == null || !jenama.value.trim()) {
    feedback.value = { tone: "error", text: "Jenama dan kebutuhan modal wajib diisi." };
    return;
  }
  saving.value = true; feedback.value = null;
  try {
    if (file.value) {
      if (file.value.type !== "application/pdf") {
        feedback.value = { tone: "error", text: "Pitch deck harus berupa berkas PDF." };
        saving.value = false;
        return;
      }
      const body = new FormData(); body.append("file", file.value);
      const uploaded = await directus.request(uploadFiles(body)); pitchDeck.value = uploaded.id;
    }
    await directus.request(endpoint("/v1/program/executive/investor/profil", { method: "POST", body: {
      jenama: jenama.value.trim(), kebutuhanModal: kebutuhanModal.value, skema: skema.value,
      kapasitasPasok: kapasitasPasok.value || null, marginPersen: marginPersen.value,
      pitchDeck: pitchDeck.value, setuju,
    } }));
    feedback.value = { tone: "success", text: setuju ? "Profil dikirim untuk kurasi. Perubahan perlu disetujui ulang." : "Persetujuan berbagi data dicabut." };
    await refresh();
  } catch (cause) {
    feedback.value = {
      tone: "error",
      text: requestErrorCode(cause) === "INVALID_PAYLOAD" ? "Isian profil tidak diterima server. Periksa kembali isian Anda." : "Profil tidak dapat disimpan. Periksa isian dan PDF.",
    };
  } finally { saving.value = false; }
}
const choices: [string, string][] = [["kur", "KUR"], ["lpdb", "LPDB"], ["offtaker", "Offtaker"],
  ["penyertaan_modal", "Penyertaan modal"], ["konsinyasi", "Konsinyasi"], ["ekspor", "Ekspor"]];
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-5 pb-10">
    <h1 class="text-2xl font-bold">Profil kemitraan investor</h1>
    <p class="text-sm">Data finansial hanya dibuka untuk investor terverifikasi setelah Anda memberi persetujuan dan kurator menyetujui profil.</p>
    <p v-if="data?.disetujui_kurator_pada && !data?.dicabut_pada" class="text-sm text-emerald-700">Profil disetujui untuk dibagikan.</p>
    <p v-else-if="data?.kurator_dicabut_pada && data?.disetujui_berbagi_pada && !data?.dicabut_pada" role="status" class="text-sm text-amber-800">Persetujuan kurator dicabut. Perbarui profil untuk mengajukannya kembali ke kurasi.</p>
    <form class="grid gap-4 rounded-xl border p-5" @submit.prevent="save(true)">
      <UiField class="gap-1">
        <UiFieldLabel for="investor-jenama">Jenama</UiFieldLabel>
        <UiInput id="investor-jenama" v-model="jenama" required maxlength="160" />
      </UiField>
      <UiField class="gap-1">
        <UiFieldLabel for="investor-modal">Kebutuhan modal (Rp)</UiFieldLabel>
        <UiInput id="investor-modal" :model-value="kebutuhanModal ?? ''" required type="number" min="1" @update:model-value="(value) => (kebutuhanModal = value === '' ? null : Number(value))" />
      </UiField>
      <fieldset class="grid gap-2">
        <legend class="text-sm font-medium">Skema kemitraan</legend>
        <label v-for="option in choices" :key="option[0]" class="flex items-center gap-2 text-sm">
          <UiCheckbox :model-value="skema.includes(option[0])" :aria-label="`Skema ${option[1]}`" @update:model-value="(value) => toggleSkema(option[0], value)" />
          {{ option[1] }}
        </label>
      </fieldset>
      <UiField class="gap-1">
        <UiFieldLabel for="investor-kapasitas">Kapasitas pasok</UiFieldLabel>
        <UiInput id="investor-kapasitas" v-model="kapasitasPasok" maxlength="300" />
      </UiField>
      <UiField class="gap-1">
        <UiFieldLabel for="investor-margin">Margin (%) — deklarasi pelaku usaha</UiFieldLabel>
        <UiInput id="investor-margin" :model-value="marginPersen ?? ''" type="number" min="0" max="100" step="0.01" @update:model-value="(value) => (marginPersen = value === '' ? null : Number(value))" />
      </UiField>
      <UiField class="gap-1">
        <UiFieldLabel for="investor-deck">Pitch deck PDF (opsional)</UiFieldLabel>
        <!-- Input file tidak punya padanan Ui* (lihat UI_audit §2). -->
        <input id="investor-deck" type="file" accept="application/pdf" @change="picked">
      </UiField>
      <label class="flex items-start gap-2 text-sm">
        <UiCheckbox v-model="agree" :aria-label="'Saya menyetujui pembagian profil dan data finansial di atas kepada investor terverifikasi.'" class="mt-0.5" />
        <span>Saya menyetujui pembagian profil dan data finansial di atas kepada investor terverifikasi.<span v-if="!agree" class="text-destructive"> (wajib)</span></span>
      </label>
      <div class="flex gap-3">
        <UiButton type="submit" :disabled="saving || !agree">{{ saving ? "Menyimpan…" : "Ajukan profil" }}</UiButton>
        <UiButton v-if="data?.disetujui_berbagi_pada && !data?.dicabut_pada" type="button" variant="outline" :disabled="saving" @click="save(false)">Cabut persetujuan</UiButton>
      </div>
    </form>
    <p v-if="feedback" :role="feedback.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="feedback.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">{{ feedback.text }}</p>
  </main>
</template>
