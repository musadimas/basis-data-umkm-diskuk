<script setup lang="ts">
import { useAnalyticsCatalog } from "~/composables/useAnalyticsCatalog"
import { useAnalysisState } from "~/composables/useAnalysisState"
import { useAnalyticsQuery } from "~/composables/useAnalyticsQuery"
import type { AnalysisConfig, AnalyticsGroup, SavedAnalysis, AnalyticsExportType, AnalyticsQueryResponse } from "~/types/analytics"
import { useSavedAnalyses } from "~/composables/useSavedAnalyses"
import { useAnalyticsExports } from "~/composables/useAnalyticsExports"
definePageMeta({ layout: "dashboard" })
useSeoMeta({ title: "Analitik UMKM" })
const catalogApi = useAnalyticsCatalog()
await catalogApi.load()
const savedApi = useSavedAnalyses(); await savedApi.load(); const exportApi = useAnalyticsExports()
const route = useRoute()
const state = useAnalysisState()
function clone<T>(value: T): T {
  // SAFETY: seluruh nilai domain di sini JSON-safe; round-trip JSON.parse(JSON.stringify) mempertahankan strukturnya.
  return JSON.parse(JSON.stringify(value)) as T
}
const query = useAnalyticsQuery(state.applied)
const response = ref<AnalyticsQueryResponse | null>(query.response.value)
const pending = ref(query.pending.value)
const error = shallowRef(query.error.value)
const draft = reactive(clone(state.draft.value))
const applied = reactive(clone(state.applied.value))
const warning = ref(state.warning.value)
const recordsCursor = ref<string | null>(null)
const cursorStack = ref<string[]>([])
const recordsPending = ref(query.recordsPending.value)
watch(query.response, (value) => {
  response.value = value
  if (!value) return
  recordsCursor.value = null
  cursorStack.value = []
  void query.fetchRecords(null)
})
watch(query.pending, (value) => { pending.value = value })
watch(query.recordsPending, (value) => { recordsPending.value = value })
watch(query.error, (value) => { error.value = value })
watch(state.draft, (value) => Object.assign(draft, clone(value)))
watch(state.applied, (value) => Object.assign(applied, clone(value)))
watch(state.warning, (value) => { warning.value = value })
const meta = computed(() => response.value?.meta)
const fields = computed(() => catalogApi.catalog.value?.fields || [])
const records = computed(() => query.records.value?.data.records || [])
const nextCursor = computed(() => query.records.value?.data.nextCursor || null)
const savedItems = computed(() => savedApi.items.value)
const catalogTemplates = computed(() => catalogApi.templates.value)
const savedPending = ref(savedApi.pending.value)
const exportStatus = shallowRef(exportApi.status.value)
const exportPending = ref(exportApi.pending.value)
watch(savedApi.pending, value => { savedPending.value = value })
watch(exportApi.status, value => { exportStatus.value = value })
watch(exportApi.pending, value => { exportPending.value = value })
const showSave = ref(false)
const showExport = ref(false)
const showSaved = ref(false)
const railOpen = ref(true)
const tableOpen = ref(false)
const breadcrumbs = state.breadcrumbs
function update(patch: Partial<AnalysisConfig>) { state.updateDraft(patch) }
function chooseTemplate(config: Partial<AnalysisConfig>) { state.updateDraft({ ...config, filters: config.filters || [] }) }
function selectGroup(group: AnalyticsGroup) { state.addFilter({ fieldId: state.applied.value.groupBy, operator: "eq", value: group.key }) }
const DRILL_PATH = new Map<string, string>([
  ["kota_nama", "kecamatan_nama"],
  ["kota_kode", "kecamatan_nama"],
  ["kecamatan_nama", "kelurahan_nama"],
  ["sektor_kbli", "kbli_kode"],
])
function drillGroup(group: AnalyticsGroup) {
  const field = DRILL_PATH.get(state.applied.value.groupBy)
  if (!field) return
  state.addFilter({ fieldId: state.applied.value.groupBy, operator: "eq", value: group.key })
  state.drillDown(field, group.label)
}
function openRecord(record: { id: string }) { state.saveReturnContext(records.value, record.id) }
onMounted(() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem("analytics:return") || "null")
    if (saved?.path === route.fullPath && Number.isFinite(saved.scrollY)) requestAnimationFrame(() => window.scrollTo(0, saved.scrollY))
  } catch { /* Restoring scroll position is best-effort. */ }
})
const currentResponse = () => response.value
const currentMeta = () => meta.value
const groups = computed(() => response.value?.data.groups || [])
const drillField = computed(() => DRILL_PATH.get(applied.groupBy) || null)
const dimensionLabel = computed(() => fields.value.find((field) => field.key === applied.groupBy)?.label || "kelompok")
const coverageTotal = computed(() => Number(meta.value?.coverage?.total || meta.value?.matched || 0))
const coverage = computed(() => (coverageTotal.value ? Number(meta.value?.coverage?.matched ?? meta.value?.matched ?? 0) * 100 / coverageTotal.value : 100))
const unknownShare = computed(() => (coverageTotal.value ? Number(meta.value?.coverage?.unknown || 0) * 100 / coverageTotal.value : 0))
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(applied))
function nextRecordPage() {
  const cursor = nextCursor.value
  if (!cursor) return
  cursorStack.value = [...cursorStack.value, recordsCursor.value || ""]
  recordsCursor.value = cursor
  void query.fetchRecords(cursor)
}
function prevRecordPage() {
  const stack = [...cursorStack.value]
  const previous = stack.pop()
  if (previous === undefined) return
  cursorStack.value = stack
  recordsCursor.value = previous || null
  void query.fetchRecords(previous || null)
}
async function saveAnalysis(name: string) { if (name.trim()) { await savedApi.save(name.trim(), state.applied.value); showSave.value = false } }
function openSaved(item: SavedAnalysis) { state.updateDraft(item.config); state.apply(); showSaved.value = false }
async function removeSaved(id: string) { await savedApi.remove(id) }
async function renameSaved(payload: { id: string; name: string }) { await savedApi.rename(payload.id, payload.name) }
async function startExport(type: AnalyticsExportType) { await exportApi.submit(type, state.applied.value) }
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2 lg:flex-1 lg:overflow-hidden">
    <AnalyticsToolbar
      :meta="currentMeta()"
      :config="draft"
      :fields="fields"
      :templates="catalogTemplates"
      :filters="draft.filters"
      :breadcrumbs="breadcrumbs"
      :saved-count="savedItems.length"
      :rail-open="railOpen"
      @template="chooseTemplate"
      @remove-filter="state.removeFilter"
      @saved="showSaved = true"
      @save="showSave = true"
      @export="showExport = true"
      @toggle-rail="railOpen = !railOpen"
    />

    <AnalyticsState
      class="shrink-0"
      :pending="pending"
      :error="error"
      :warning="warning"
      :has-data="Boolean(currentResponse())"
      :status="currentMeta()?.status"
    />

    <div
      class="grid min-h-0 gap-2 lg:flex-1 lg:overflow-hidden"
      :class="railOpen ? 'lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-1' : 'lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-1'"
    >
      <AnalyticsQueryBuilder
        v-show="railOpen"
        :fields="fields"
        :model-value="draft"
        :dirty="dirty"
        @update="update"
        @reset="state.reset"
        @apply="state.apply"
      />

      <div class="flex min-h-0 flex-col gap-2 lg:overflow-hidden">
        <AnalyticsMetricSummary :response="currentResponse()" :meta="currentMeta()" />

        <AnalyticsInsightPanel :groups="groups" :coverage="coverage" :unknown-share="unknownShare" @evidence="tableOpen = true" />

        <div class="grid min-h-0 gap-2 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden 2xl:grid-cols-3 2xl:grid-rows-1">
          <AnalyticsVisual
            v-if="currentResponse()"
            v-model:table-open="tableOpen"
            :groups="groups"
            :visual="applied.visual"
            @select="selectGroup"
          />
          <AnalyticsGroupList
            :groups="groups"
            :dimension-label="dimensionLabel"
            :drill-field="drillField"
            @select="selectGroup"
            @drill="drillGroup"
          />
          <AnalyticsRecordTable
            class="lg:col-span-2 2xl:col-span-1"
            :records="records"
            :matched="currentMeta()?.matched"
            :page-index="cursorStack.length"
            :page-size="20"
            :has-next="Boolean(nextCursor)"
            :has-prev="cursorStack.length > 0"
            :pending="recordsPending"
            @open="openRecord"
            @next="nextRecordPage"
            @prev="prevRecordPage"
          />
        </div>
      </div>
    </div>

    <AnalyticsSavedAnalysisMenu
      :model-value="showSaved"
      :items="savedItems"
      @close="showSaved = false"
      @open="openSaved"
      @remove="removeSaved"
      @rename="renameSaved"
    />
    <AnalyticsSaveAnalysisDialog :model-value="showSave" :config="applied" :busy="savedPending" @close="showSave = false" @save="saveAnalysis" />
    <AnalyticsExportDialog :model-value="showExport" :config="applied" :status="exportStatus" :busy="exportPending" @close="showExport = false" @submit="startExport" />
  </div>
</template>
