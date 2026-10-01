<script setup lang="ts">
import type { SavedAnalysis } from "~/types/analytics";

const props = defineProps<{
  modelValue: boolean;
  items: Array<SavedAnalysis>;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "open", item: SavedAnalysis): void;
  (event: "remove", id: string): void;
  (event: "rename", payload: { id: string; name: string }): void;
}>();

const editing = ref<string | null>(null);
const name = ref("");
const removing = ref<string | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) editing.value = null;
    removing.value = null;
  },
);

function begin(item: SavedAnalysis) {
  editing.value = item.id;
  name.value = item.name;
}
function commit(id: string) {
  if (name.value.trim()) emit("rename", { id, name: name.value.trim() });
  editing.value = null;
}
</script>

<template>
  <UiDialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <UiDialogContent class="max-w-md" aria-labelledby="saved-analysis-title">
      <!-- SAFETY: DialogContent reka-ui yang menangani focus trap dan pemulihan fokus. -->
      <UiDialogHeader>
        <UiDialogTitle id="saved-analysis-title"
          >Analisis tersimpan</UiDialogTitle
        >
      </UiDialogHeader>

      <p v-if="!items.length" class="text-sm text-muted-foreground">
        Belum ada analisis tersimpan.
      </p>
      <ul v-else class="max-h-72 space-y-1.5 overflow-auto">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
        >
          <template v-if="editing === item.id">
            <UiInput
              v-model="name"
              class="h-8 min-w-0 flex-1"
              aria-label="Nama analisis baru"
              @keyup.enter="commit(item.id)"
            />
            <button
              type="button"
              class="text-xs font-semibold underline"
              @click="commit(item.id)"
            >
              Simpan nama
            </button>
            <button
              type="button"
              class="text-xs underline"
              @click="editing = null"
            >
              Batal
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left font-semibold underline"
              @click="emit('open', item)"
            >
              {{ item.name }}
            </button>
            <span class="flex shrink-0 gap-2">
              <button
                type="button"
                class="text-xs underline"
                @click="begin(item)"
              >
                Ganti nama
              </button>
              <button
                type="button"
                class="text-xs underline"
                @click="removing = item.id"
              >
                Hapus
              </button>
            </span>
          </template>
          <template v-if="removing === item.id">
            <p class="w-full text-xs" role="alert">
              Hapus analisis tersimpan ini?
              <button type="button" class="font-semibold text-destructive underline" @click="emit('remove', item.id); removing = null">Ya, hapus</button>
              ·
              <button type="button" class="underline" @click="removing = null">Batal</button>
            </p>
          </template>
        </li>
      </ul>

      <p class="text-xs text-muted-foreground">
        Analisis dijalankan ulang pada data saat ini setiap kali dibuka.
      </p>
    </UiDialogContent>
  </UiDialog>
</template>
