<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import { KURASI_INVESTOR_STATUS } from "~/constants/PROGRAM";
import type { KurasiInvestorDaftar, KurasiInvestorItem, KurasiInvestorStatus } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Profil Investor" });
const directus = useDirectus();

const URUTAN_STATUS: KurasiInvestorStatus[] = ["menunggu", "disetujui", "belum_disetujui", "dicabut"];
const TABS: { value: KurasiInvestorStatus; label: string }[] = URUTAN_STATUS.map((value) => ({
  value,
  label: KURASI_INVESTOR_STATUS[value].label,
}));
const tab = ref<KurasiInvestorStatus>("menunggu");

const { data, pending, error, refresh } = await useAsyncData("investor:kurasi", () =>
  directus.request(endpoint<KurasiInvestorDaftar>("/v1/program/executive/investor/kurasi", { query: { status: tab.value } })),
  { watch: [tab] });
const daftar = computed(() => data.value?.items ?? []);
const counts = computed(() => data.value?.meta.counts);

const userId = ref("");
const feedback = ref<{ tone: "success" | "error"; text: string } | null>(null);
const memverifikasi = ref(false);
const memutuskan = ref<string | null>(null);
const cabutTarget = ref<KurasiInvestorItem | null>(null);
const cabutError = ref("");

function pesanKeputusan(cause: unknown) {
  switch (requestErrorCode(cause)) {
    case "STATUS_BERUBAH": return "Status profil sudah berubah oleh petugas lain. Daftar dimuat ulang.";
    case "FORBIDDEN": return "Anda tidak berwenang memutuskan profil ini.";
    case "NOT_FOUND": return "Profil tidak ditemukan atau usaha sudah menarik persetujuan.";
    default: return "Keputusan tidak dapat disimpan. Coba lagi.";
  }
}

async function decide(item: KurasiInvestorItem, setuju: boolean) {
  // R6: kunci sibuk diklaim sebelum await pertama supaya klik ganda hanya mengirim satu permintaan.
  if (memutuskan.value) return;
  memutuskan.value = item.id;
  feedback.value = null;
  try {
    await directus.request(endpoint(`/v1/program/executive/investor/profil/${item.id}/kurasi`, { method: "POST", body: { setuju } }));
    feedback.value = { tone: "success", text: setuju ? `${item.jenama} disetujui.` : `Persetujuan ${item.jenama} dicabut.` };
    cabutTarget.value = null;
    await refresh();
  } catch (cause) {
    const kode = requestErrorCode(cause);
    const teks = pesanKeputusan(cause);
    if (kode === "STATUS_BERUBAH" || kode === "NOT_FOUND") {
      cabutTarget.value = null;
      feedback.value = { tone: "error", text: teks };
      await refresh();
    } else if (cabutTarget.value) {
      // R4: dialog tetap terbuka dengan pesan inline saat penyimpanan gagal.
      cabutError.value = teks;
    } else {
      feedback.value = { tone: "error", text: teks };
    }
  } finally {
    memutuskan.value = null;
  }
}

function mintaCabut(item: KurasiInvestorItem) {
  cabutTarget.value = item;
  cabutError.value = "";
}

function tutupCabut(open: boolean) {
  if (!open && !memutuskan.value) cabutTarget.value = null;
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
  <div class="flex w-full flex-col gap-6 pb-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Kurasi Profil Investor</h1>
      <p class="mt-1 text-sm text-muted-foreground">Setujui profil usaha yang sudah memberi persetujuan berbagi sebelum tampil di Direktori Investor.</p>
    </div>

    <p
      v-if="feedback"
      :role="feedback.tone === 'error' ? 'alert' : 'status'"
      class="rounded-md border p-3 text-sm"
      :class="feedback.tone === 'error' ? 'border-destructive/30 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-800'"
    >{{ feedback.text }}</p>

    <div role="tablist" aria-label="Status kurasi investor" class="flex flex-wrap gap-2">
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="tab === item.value"
        class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === item.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
        @click="tab = item.value"
      >{{ item.label + (counts ? ` (${counts[item.value]})` : "") }}</button>
    </div>

    <UiCard>
      <UiCardContent class="overflow-x-auto p-0">
        <div v-if="error" role="alert" class="p-6 text-sm text-destructive">Daftar profil tidak dapat dimuat. Coba lagi.</div>
        <div v-else-if="pending && !daftar.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
        <div v-else-if="!daftar.length" class="p-6 text-sm text-muted-foreground">Tidak ada profil dengan status ini.</div>
        <ul v-else class="divide-y">
          <li v-for="item in daftar" :key="item.id" class="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ item.jenama }}</p>
              <p class="text-xs text-muted-foreground">{{ item.nama }}</p>
            </div>
            <ProgramStatusPill :meta="KURASI_INVESTOR_STATUS[item.status]" />
            <UiButton v-if="item.status === 'menunggu' || item.status === 'dicabut'" size="sm" :disabled="Boolean(memutuskan)" @click="decide(item, true)">
              {{ memutuskan === item.id ? "Memproses…" : item.status === "dicabut" ? "Setujui ulang" : "Setujui" }}
            </UiButton>
            <UiButton v-else-if="item.status === 'disetujui'" size="sm" variant="outline" :disabled="Boolean(memutuskan)" @click="mintaCabut(item)">Cabut persetujuan</UiButton>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Verifikasi akun investor</UiCardTitle>
        <UiCardDescription>Gunakan ID akun Directus yang telah diidentifikasi dan disetujui oleh petugas.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="grid gap-2">
        <UiField class="gap-1">
          <UiFieldLabel for="investor-user-id">ID akun investor</UiFieldLabel>
          <UiInput id="investor-user-id" v-model="userId" placeholder="Contoh: 0e6fbd61-…" />
          <UiFieldDescription>ID (UUID) akun investor dari daftar pengguna; tidak ditampilkan ke pelaku usaha.</UiFieldDescription>
        </UiField>
        <div class="flex gap-2">
          <UiButton type="button" :disabled="memverifikasi" @click="verify(true)">{{ memverifikasi ? "Memproses…" : "Verifikasi" }}</UiButton>
          <UiButton type="button" variant="outline" :disabled="memverifikasi" @click="verify(false)">{{ memverifikasi ? "Memproses…" : "Cabut verifikasi" }}</UiButton>
        </div>
      </UiCardContent>
    </UiCard>

    <UiDialog :open="Boolean(cabutTarget)" @update:open="tutupCabut">
      <UiDialogContent v-if="cabutTarget" class="sm:max-w-md" :show-close-button="!memutuskan">
        <UiDialogHeader>
          <UiDialogTitle class="pr-6">Cabut persetujuan {{ cabutTarget.jenama }}?</UiDialogTitle>
          <UiDialogDescription>Profil berhenti tampil di Direktori Investor dan pindah ke tab Persetujuan dicabut. Anda dapat menyetujuinya ulang.</UiDialogDescription>
        </UiDialogHeader>
        <p v-if="cabutError" role="alert" class="text-sm text-destructive">{{ cabutError }}</p>
        <UiDialogFooter>
          <UiButton variant="outline" :disabled="Boolean(memutuskan)" @click="cabutTarget = null">Batal</UiButton>
          <UiButton variant="destructive" :disabled="Boolean(memutuskan)" @click="decide(cabutTarget, false)">{{ memutuskan ? "Memproses…" : "Ya, cabut" }}</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
