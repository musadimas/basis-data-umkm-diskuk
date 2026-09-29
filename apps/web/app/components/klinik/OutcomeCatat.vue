<script setup lang="ts">
// "Catat outcome" pada tiket yang sudah Selesai (R04). Server yang memutuskan kapan formulir ini
// ditawarkan (`tiket.outcomeBisaDicatat`); di sini hanya mengirim isinya. Outcome baru berstatus
// "Menunggu verifikasi" dan tidak menyentuh profil usaha sebelum petugas lain memverifikasinya.
import { KlinikError, catatOutcome } from "~/lib/klinik";
import type { KlinikOutcomeIsi, KlinikTiket } from "~/types/program";

const props = defineProps<{ tiket: KlinikTiket }>();
const emit = defineEmits<{ berubah: [] }>();

const directus = useDirectus();
const items = ref<KlinikOutcomeIsi[]>([]);
const mengirim = ref(false);
const error = ref("");

async function kirim() {
  if (mengirim.value) return;
  error.value = "";
  if (!items.value.length) {
    error.value = "Pilih minimal satu atribut.";
    return;
  }
  mengirim.value = true;
  try {
    await catatOutcome(directus, props.tiket, items.value);
    items.value = [];
    emit("berubah");
  } catch (cause) {
    error.value = cause instanceof KlinikError ? cause.pesan : "Outcome tidak dapat dicatat. Coba lagi.";
    // Outcome yang sudah ada di server (mis. dicatat petugas lain) harus tampil, bukan formulir kosong.
    if (cause instanceof KlinikError && cause.code === "OUTCOME_SUDAH_ADA") emit("berubah");
  } finally {
    mengirim.value = false;
  }
}
</script>

<template>
  <form class="grid gap-3 rounded-lg border p-3 text-sm" novalidate data-testid="outcome-catat" @submit.prevent="kirim">
    <h4 class="font-semibold">Catat outcome</h4>
    <p class="text-xs text-muted-foreground">Tandai atribut usaha yang berubah setelah konsultasi. Outcome menunggu verifikasi petugas lain sebelum masuk ke profil usaha.</p>
    <KlinikOutcomeForm v-model="items" :disabled="mengirim" />
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <UiButton type="submit" size="sm" class="w-fit" :disabled="mengirim">{{ mengirim ? "Mencatat…" : "Catat outcome" }}</UiButton>
  </form>
</template>
