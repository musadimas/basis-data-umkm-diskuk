<script setup lang="ts">
import type { AnalysisConfig, AnalyticsExportStatus, AnalyticsExportType } from "~/types/analytics"

const props = defineProps<{ modelValue: boolean; config: AnalysisConfig; status?: AnalyticsExportStatus | null; busy?: boolean }>()
const emit = defineEmits<{ (event: "update:modelValue", value: boolean): void; (event: "submit", type: AnalyticsExportType): void }>()

const type = ref<AnalyticsExportType>("aggregate_csv")

const EXPORT_TYPES: Array<{ value: AnalyticsExportType; label: string }> = [
  { value: "aggregate_csv", label: "CSV agregat (langsung)" },
  { value: "detail_csv", label: "CSV detail (maks. 50.000)" },
  { value: "aggregate_png", label: "PNG agregat" },
  { value: "aggregate_pdf", label: "PDF agregat" },
]

function submit() {
  if (props.busy) return
  emit("submit", type.value)
}
</script>

<template>
  <UiDialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <UiDialogContent class="max-w-md" aria-labelledby="export-title">
      <!-- SAFETY: DialogContent reka-ui yang menangani focus trap dan pemulihan fokus. -->
      <UiDialogHeader>
        <UiDialogTitle id="export-title">Ekspor privat</UiDialogTitle>
        <UiDialogDescription>Filter aktif akan diterapkan pada data terbaru yang tersedia.</UiDialogDescription>
      </UiDialogHeader>

      <form @submit.prevent="submit">
        <label class="block text-sm font-medium" for="export-format">
          Format
          <select v-model="type" class="mt-1 h-10 w-full rounded-md border px-3">
            <option v-for="item in EXPORT_TYPES" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>

        <dl class="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs">
          <div><dt class="text-muted-foreground">Masking</dt><dd>v1</dd></div>
          <div><dt class="text-muted-foreground">Zona waktu</dt><dd>Asia/Jakarta</dd></div>
          <div><dt class="text-muted-foreground">Batas detail</dt><dd>50.000 baris</dd></div>
          <div><dt class="text-muted-foreground">Tautan</dt><dd>Privat, ≤24 jam</dd></div>
        </dl>

        <div v-if="status" class="mt-3 rounded-md border p-2 text-sm" aria-live="polite">
          Status:
          {{ status.data.status === "completed"
            ? "Selesai"
            : status.data.status === "queued"
              ? "Menunggu"
              : status.data.status === "processing"
                ? "Diproses"
                : status.data.status === "expired"
                  ? "Kedaluwarsa"
                  : "Gagal" }}
          <span v-if="status.data.estimatedRows"> · estimasi {{ status.data.estimatedRows.toLocaleString("id-ID") }} baris</span>
          <a v-if="status.data.downloadUrl" class="ml-2 font-semibold underline" :href="status.data.downloadUrl">Unduh</a>
        </div>

        <p class="mt-3 text-xs text-muted-foreground">Tautan privat kedaluwarsa paling lambat 24 jam.</p>

        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-2" @click="emit('update:modelValue', false)">Tutup</button>
          <button type="submit" class="rounded-md bg-emerald-600 px-3 py-2 font-semibold text-white" :disabled="busy">{{ busy ? "Menyiapkan…" : "Mulai ekspor" }}</button>
        </div>
      </form>
    </UiDialogContent>
  </UiDialog>
</template>
