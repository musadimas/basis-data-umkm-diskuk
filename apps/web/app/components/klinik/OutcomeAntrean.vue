<script setup lang="ts">
// Antrean verifikasi outcome (R04) untuk provinsi dan kab/kota: outcome berstatus "Menunggu
// verifikasi" dalam cakupan wilayahnya, dari `GET /v1/program/klinik/outcome`. Tombol tiap baris
// mengikuti `aksi` dari server (pengaju tidak diberi tombol Verifikasi untuk outcome-nya sendiri).
import { daftarOutcome } from "~/lib/klinik";

const emit = defineEmits<{ berubah: [] }>();

const directus = useDirectus();
const { data: antrean, status, error, refresh } = useAsyncData("klinik:outcome-antrean", () => daftarOutcome(directus));

async function berubah() {
  await refresh();
  emit("berubah");
}

/** Dipanggil halaman setelah tiket berubah (mis. tiket ditutup dengan outcome) supaya antrean ikut segar. */
defineExpose({ muatUlang: refresh });
</script>

<template>
  <section class="grid gap-3 rounded-xl border bg-card p-4" aria-label="Antrean verifikasi outcome" data-testid="outcome-antrean">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-bold">Antrean verifikasi outcome</h2>
      <span v-if="antrean" class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold" data-testid="outcome-antrean-jumlah">{{ antrean.length }} menunggu</span>
    </div>
    <p class="text-xs text-muted-foreground">Outcome konsultasi yang menunggu verifikasi. Outcome yang Anda ajukan sendiri harus diverifikasi petugas lain.</p>

    <p v-if="status === 'pending' && !antrean" class="text-sm text-muted-foreground">Memuat antrean…</p>
    <p v-else-if="error && !antrean" role="alert" class="text-sm text-destructive">Antrean outcome tidak dapat dimuat.</p>
    <p v-else-if="!antrean?.length" role="status" class="text-sm text-muted-foreground" data-testid="outcome-antrean-kosong">Tidak ada outcome yang menunggu verifikasi.</p>
    <ul v-else class="grid gap-3">
      <li v-for="item in antrean" :key="item.id" class="grid gap-2" data-testid="outcome-antrean-baris">
        <p class="text-sm">
          <span class="font-mono text-xs">{{ item.nomorTiket }}</span> · <span class="font-semibold">{{ item.namaUsaha }}</span>
          <span class="text-xs text-muted-foreground"> · {{ item.poli }}</span>
        </p>
        <KlinikOutcomePanel :outcome="item" @berubah="berubah" />
      </li>
    </ul>
  </section>
</template>
