<script setup lang="ts">
import type { SavedAnalysis } from "~/types/analytics"
defineProps<{ modelValue: boolean; items: Array<SavedAnalysis> }>()
const emit = defineEmits<{
  (event: "close"): void
  (event: "open", item: SavedAnalysis): void
  (event: "remove", id: string): void
  (event: "rename", payload: { id: string; name: string }): void
}>()
const editing = ref<string | null>(null)
const name = ref("")
function begin(item: SavedAnalysis) { editing.value = item.id; name.value = item.name }
function commit(id: string) { if (name.value.trim()) emit("rename", { id, name: name.value.trim() }); editing.value = null }
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
    role="dialog"
    aria-modal="true"
    aria-labelledby="saved-analysis-title"
  >
    <section class="w-full max-w-md rounded-lg bg-background p-4 shadow-xl">
      <div class="flex items-center justify-between gap-2">
        <h2 id="saved-analysis-title" class="text-base font-bold">Analisis tersimpan</h2>
        <button type="button" class="rounded-md border px-2 py-1 text-xs font-semibold" @click="emit('close')">Tutup</button>
      </div>
      <p v-if="!items.length" class="mt-3 text-sm text-muted-foreground">Belum ada analisis tersimpan.</p>
      <ul v-else class="mt-3 max-h-72 space-y-1.5 overflow-auto">
        <li v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
          <template v-if="editing === item.id">
            <input v-model="name" class="h-8 min-w-0 flex-1 rounded-md border px-2" aria-label="Nama analisis baru" @keyup.enter="commit(item.id)">
            <button type="button" class="text-xs font-semibold underline" @click="commit(item.id)">Simpan nama</button>
            <button type="button" class="text-xs underline" @click="editing = null">Batal</button>
          </template>
          <template v-else>
            <button type="button" class="min-w-0 flex-1 truncate text-left font-semibold underline" @click="emit('open', item)">{{ item.name }}</button>
            <span class="flex shrink-0 gap-2">
              <button type="button" class="text-xs underline" @click="begin(item)">Ganti nama</button>
              <button type="button" class="text-xs underline" @click="emit('remove', item.id)">Hapus</button>
            </span>
          </template>
        </li>
      </ul>
      <p class="mt-3 text-xs text-muted-foreground">Analisis dijalankan ulang pada data saat ini setiap kali dibuka.</p>
    </section>
  </div>
</template>
