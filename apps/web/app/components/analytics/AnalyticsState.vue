<script setup lang="ts">
defineProps<{ pending: boolean; error?: unknown; warning?: boolean; hasData: boolean; status?: string }>()
const emit = defineEmits<{ reset: [] }>()
</script>
<template>
  <div aria-live="polite">
    <p v-if="warning" class="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Sebagian state URL tidak dikenali; konfigurasi aman digunakan.</p>

    <!-- Skeleton menjaga layout agar canvas tidak lompat saat memuat pertama (ux-spec §10). -->
    <div v-if="pending && !hasData" class="flex flex-col gap-2" aria-hidden="true">
      <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        <UiSkeleton v-for="index in 6" :key="index" class="h-[3.4rem] rounded-md" />
      </div>
      <UiSkeleton class="h-9 w-full rounded-md" />
      <div class="grid gap-2 lg:grid-cols-2 lg:grid-rows-2">
        <UiSkeleton class="h-[280px] rounded-lg lg:h-full" />
        <UiSkeleton class="h-[280px] rounded-lg lg:h-full" />
        <UiSkeleton class="h-[280px] rounded-lg lg:col-span-2 lg:h-full" />
      </div>
    </div>

    <div v-else-if="error && !hasData" class="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
      Hasil analitik belum dapat dimuat. Silakan coba lagi.
    </div>
    <div v-else-if="!pending && !hasData" class="rounded-md border bg-muted/30 p-6 text-sm">
      Tidak ada UMKM yang sesuai dengan filter. Hapus atau ubah filter untuk memperluas hasil.
      <button type="button" class="ml-1 font-semibold underline" @click="emit('reset')">Reset filter</button>
    </div>

    <p v-if="status === 'stale_last_good'" class="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Data terakhir yang berhasil diproses sedang ditampilkan.</p>
  </div>
</template>
