<script setup lang="ts">
import type { AnalysisConfig } from "~/types/analytics"

const props = defineProps<{ modelValue: boolean; config: AnalysisConfig; busy?: boolean }>()
const emit = defineEmits<{ (event: "update:modelValue", value: boolean): void; (event: "save", name: string): void }>()

const name = ref("")
watch(() => props.modelValue, (open) => {
  if (open) name.value = ""
})
function submit() {
  if (!name.value.trim() || props.busy) return
  emit("save", name.value.trim())
}
</script>

<template>
  <UiDialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <UiDialogContent class="max-w-md" aria-labelledby="save-analysis-title">
      <!-- SAFETY: DialogContent reka-ui yang menangani focus trap dan pemulihan fokus. -->
      <UiDialogHeader>
        <UiDialogTitle id="save-analysis-title">Simpan analisis</UiDialogTitle>
      </UiDialogHeader>
      <form @submit.prevent="submit">
        <label class="block text-sm font-medium" for="save-analysis-name">
          Nama analisis
          <input
            id="save-analysis-name"
            v-model="name"
            required
            maxlength="120"
            class="mt-1 h-10 w-full rounded-md border px-3"
          >
        </label>
        <p class="mt-2 text-xs text-muted-foreground">Hasil tidak dibekukan; saat dibuka, analisis dijalankan terhadap data saat ini.</p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-2" @click="emit('update:modelValue', false)">Batal</button>
          <button type="submit" class="rounded-md bg-emerald-600 px-3 py-2 font-semibold text-white" :disabled="busy">Simpan</button>
        </div>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
