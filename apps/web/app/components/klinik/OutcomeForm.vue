<script setup lang="ts">
// Editor isi outcome konsultasi (R04): 15 atribut Jabar, masing-masing boleh ditandai kepatuhan atau
// perbaikan (klik lagi untuk melepas). Hanya struktur atribut + jenis; tidak ada teks bebas, jadi
// diagnosis dan catatan sesi tidak pernah ikut ke profil. Dipakai saat menutup tiket, mencatat
// outcome, dan mengoreksinya.
import { KLINIK_ATRIBUT_OUTCOME, KLINIK_JENIS_OUTCOME } from "~/constants";
import type { KlinikJenisOutcome, KlinikOutcomeIsi } from "~/types/program";

const items = defineModel<KlinikOutcomeIsi[]>({ required: true });
defineProps<{ disabled?: boolean }>();

const jenisDari = (atribut: string) => items.value.find((item) => item.atribut === atribut)?.jenis ?? null;

function pilih(atribut: string, jenis: KlinikJenisOutcome) {
  const sisa = items.value.filter((item) => item.atribut !== atribut);
  items.value = jenisDari(atribut) === jenis ? sisa : [...sisa, { atribut, jenis }];
}
</script>

<template>
  <div class="grid gap-2" data-testid="outcome-form">
    <ul class="grid gap-1.5">
      <li v-for="atribut in KLINIK_ATRIBUT_OUTCOME" :key="atribut.value" class="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5">
        <span class="text-sm">{{ atribut.label }}</span>
        <span class="flex gap-1.5">
          <button
            v-for="jenis in KLINIK_JENIS_OUTCOME"
            :key="jenis.value"
            type="button"
            :disabled="disabled"
            :aria-pressed="jenisDari(atribut.value) === jenis.value"
            :aria-label="`${atribut.label}: ${jenis.label}`"
            class="rounded-full border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            :class="jenisDari(atribut.value) === jenis.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
            @click="pilih(atribut.value, jenis.value)"
          >{{ jenis.label }}</button>
        </span>
      </li>
    </ul>
    <p class="text-xs text-muted-foreground" aria-live="polite">{{ items.length }} dari {{ KLINIK_ATRIBUT_OUTCOME.length }} atribut dipilih.</p>
  </div>
</template>
