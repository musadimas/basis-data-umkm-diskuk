<script setup lang="ts">
import type { SavedAnalysis } from "~/types/analytics"
defineProps<{ items: Array<SavedAnalysis> }>()
const emit = defineEmits<{ (event: "open", item: SavedAnalysis): void; (event: "remove", id: string): void; (event: "rename", payload: { id: string; name: string }): void }>()
const editing = ref<string | null>(null)
const name = ref("")
function begin(item: SavedAnalysis) { editing.value = item.id; name.value = item.name }
function commit(id: string) { if (name.value.trim()) emit("rename", { id, name: name.value.trim() }); editing.value = null }
</script>
<template><section class="rounded-lg border bg-card p-4"><h2 class="font-bold">Analisis tersimpan</h2><p v-if="!items.length" class="mt-2 text-sm text-muted-foreground">Belum ada analisis tersimpan.</p><ul v-else class="mt-2 space-y-2"><li v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 text-sm"><template v-if="editing === item.id"><input v-model="name" class="h-8 rounded-md border px-2" aria-label="Nama analisis baru" @keyup.enter="commit(item.id)"><button type="button" class="text-xs font-semibold underline" @click="commit(item.id)">Simpan nama</button><button type="button" class="text-xs underline" @click="editing=null">Batal</button></template><template v-else><button type="button" class="font-semibold underline" @click="emit('open',item)">{{ item.name }}</button><span class="flex gap-2"><button type="button" class="text-xs underline" @click="begin(item)">Ganti nama</button><button type="button" class="text-xs underline" @click="emit('remove',item.id)">Hapus</button></span></template></li></ul></section></template>
