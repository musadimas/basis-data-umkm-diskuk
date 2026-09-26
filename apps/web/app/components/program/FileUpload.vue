<script setup lang="ts">
import { uploadFiles } from "@directus/sdk";
import { Paperclip, X } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    id: string;
    accept?: string;
    /** Largest accepted file in megabytes. */
    maxMb?: number;
    capture?: "environment" | "user";
  }>(),
  { accept: "application/pdf,image/*", maxMb: 10, capture: undefined },
);
/** Directus file id of the uploaded file, or null. */
const model = defineModel<string | null>({ default: null });
const fileName = defineModel<string | null>("fileName", { default: null });

const directus = useDirectus();
const pending = ref(false);
const error = ref("");

async function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  error.value = "";
  if (file.size > props.maxMb * 1024 * 1024) {
    error.value = `Ukuran berkas maksimal ${props.maxMb} MB.`;
    return;
  }
  pending.value = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const uploaded = await directus.request(uploadFiles(form));
    model.value = (uploaded as { id: string }).id;
    fileName.value = file.name;
  } catch {
    error.value = "Berkas tidak dapat diunggah. Coba lagi.";
  } finally {
    pending.value = false;
  }
}

function clear() {
  model.value = null;
  fileName.value = null;
}
</script>

<template>
  <div class="grid gap-2">
    <div v-if="model" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <Paperclip class="size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate">{{ fileName || "Berkas terunggah" }}</span>
      <button type="button" class="rounded p-1 hover:bg-muted" aria-label="Hapus berkas" @click="clear">
        <X class="size-4" />
      </button>
    </div>
    <input
      v-else
      :id="id"
      type="file"
      :accept="accept"
      :capture="capture"
      :disabled="pending"
      class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
      @change="onChange"
    >
    <p v-if="pending" class="text-xs text-muted-foreground">Mengunggah…</p>
    <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
