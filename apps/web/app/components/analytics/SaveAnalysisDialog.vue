<script setup lang="ts">
import type { AnalysisConfig } from "~/types/analytics"
defineProps<{ modelValue: boolean; config: AnalysisConfig; busy?: boolean }>()
const emit=defineEmits<{ (event: "close"): void; (event: "save", name: string): void }>()
const name=ref("")
</script>
<template><div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="save-analysis-title"><form class="w-full max-w-md rounded-lg bg-background p-5 shadow-xl" @submit.prevent="emit('save',name)"><h2 id="save-analysis-title" class="text-lg font-bold">Simpan analisis</h2><label class="mt-4 block text-sm font-medium">Nama analisis<input v-model="name" required maxlength="120" class="mt-1 h-10 w-full rounded-md border px-3" ></label><p class="mt-2 text-xs text-muted-foreground">Hasil tidak dibekukan; saat dibuka, analisis dijalankan terhadap data saat ini.</p><div class="mt-4 flex justify-end gap-2"><button type="button" class="rounded-md border px-3 py-2" @click="emit('close')">Batal</button><button type="submit" class="rounded-md bg-emerald-600 px-3 py-2 font-semibold text-white" :disabled="busy">Simpan</button></div></form></div></template>

