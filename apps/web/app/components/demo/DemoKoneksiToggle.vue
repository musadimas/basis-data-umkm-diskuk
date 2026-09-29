<script setup lang="ts">
defineProps<{ syncing: boolean }>();
const { enabled, simulatedOffline } = useDemoConnection();
</script>

<template>
  <div v-if="enabled" class="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm" data-testid="demo-koneksi-toggle">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="font-semibold">Mode Pengujian Prototipe · Koneksi</p>
        <p class="text-xs text-muted-foreground">Simulasi hanya untuk antrean laporan di perangkat ini.</p>
      </div>
      <button
        type="button"
        class="rounded-md bg-sky-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        :disabled="syncing"
        :aria-pressed="simulatedOffline"
        @click="simulatedOffline = !simulatedOffline"
      >{{ simulatedOffline ? 'Pulihkan koneksi simulasi' : 'Simulasikan offline' }}</button>
    </div>
    <p v-if="simulatedOffline" role="status" class="mt-2 text-xs">Simulasi offline aktif. Laporan tersimpan lokal dan akan dikirim melalui antrean saat simulasi dipulihkan.</p>
  </div>
</template>
