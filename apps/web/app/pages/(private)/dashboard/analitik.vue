<script setup lang="ts">
import { useAnalyticsCatalog } from "~/composables/useAnalyticsCatalog"
import { useAnalysisState } from "~/composables/useAnalysisState"
import { useAnalyticsQuery } from "~/composables/useAnalyticsQuery"
import type { AnalysisConfig, AnalyticsGroup, SavedAnalysis, AnalyticsExportType, AnalyticsQueryResponse } from "~/types/analytics"
import { useSavedAnalyses } from "~/composables/useSavedAnalyses"
import { useAnalyticsExports } from "~/composables/useAnalyticsExports"
definePageMeta({ layout: "dashboard" })
useSeoMeta({ title: "Analitik UMKM" })
const catalogApi=useAnalyticsCatalog()
await catalogApi.load()
const savedApi=useSavedAnalyses(); await savedApi.load(); const exportApi=useAnalyticsExports()
const route=useRoute()
const state=useAnalysisState()
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
const query=useAnalyticsQuery(state.applied)
const response=ref<AnalyticsQueryResponse|null>(query.response.value)
const pending=ref(query.pending.value)
const error=shallowRef(query.error.value)
const draft=reactive(clone(state.draft.value))
const applied=reactive(clone(state.applied.value))
const warning=ref(state.warning.value)
watch(query.response,(value)=>{response.value=value;if(value) void query.fetchRecords()})
watch(query.pending,(value)=>{pending.value=value})
watch(query.error,(value)=>{error.value=value})
watch(state.draft,(value)=>Object.assign(draft,clone(value)))
watch(state.applied,(value)=>Object.assign(applied,clone(value)))
watch(state.warning,(value)=>{warning.value=value})
const meta=computed(()=>response.value?.meta)
const fields=computed(()=>catalogApi.catalog.value?.fields||[])
const records=computed(()=>query.records.value?.data.records||[])
const savedItems=computed(()=>savedApi.items.value); const catalogTemplates=computed(()=>catalogApi.templates.value); const savedPending=ref(savedApi.pending.value); const exportStatus=shallowRef(exportApi.status.value); const exportPending=ref(exportApi.pending.value); watch(savedApi.pending,value=>{savedPending.value=value}); watch(exportApi.status,value=>{exportStatus.value=value}); watch(exportApi.pending,value=>{exportPending.value=value}); const showSave=ref(false); const showExport=ref(false)
function update(patch:Partial<AnalysisConfig>){state.updateDraft(patch)}
function chooseTemplate(config:Partial<AnalysisConfig>){state.updateDraft({...config,filters:config.filters||[]})}
function selectGroup(group:AnalyticsGroup){state.addFilter({fieldId:state.applied.value.groupBy,operator:"eq",value:group.key})}
function drillGroup(group:AnalyticsGroup){const next:{[key:string]:string|undefined}={kota_nama:"kecamatan_nama",kota_kode:"kecamatan_nama",kecamatan_nama:"kelurahan_nama",sektor_kbli:"kbli_kode"};const field=next[state.applied.value.groupBy];if(!field)return;state.addFilter({fieldId:state.applied.value.groupBy,operator:"eq",value:group.key});state.drillDown(field,group.label)}
function openRecord(record: { id: string }){state.saveReturnContext(records.value,record.id)}
onMounted(()=>{try{const saved=JSON.parse(sessionStorage.getItem("analytics:return")||"null");if(saved?.path===route.fullPath&&Number.isFinite(saved.scrollY))requestAnimationFrame(()=>window.scrollTo(0,saved.scrollY))}catch { /* Restoring scroll position is best-effort. */ }})
const currentResponse=()=>response.value
const currentMeta=()=>meta.value
const drillField=computed(()=>({kota_nama:"kecamatan_nama",kota_kode:"kecamatan_nama",kecamatan_nama:"kelurahan_nama",sektor_kbli:"kbli_kode"} as Record<string,string>)[applied.groupBy]||null)
async function saveAnalysis(name:string){if(name.trim()){await savedApi.save(name.trim(),state.applied.value);showSave.value=false}}
function openSaved(item:SavedAnalysis){state.updateDraft(item.config);state.apply()}
async function removeSaved(id:string){await savedApi.remove(id)}
async function renameSaved(payload:{id:string;name:string}){await savedApi.rename(payload.id,payload.name)}
async function startExport(type:AnalyticsExportType){await exportApi.submit(type,state.applied.value)}
</script>
<template><div class="space-y-5 pb-8"><AnalyticsHeader :meta="currentMeta()"/><div class="flex flex-wrap gap-2"><button type="button" class="rounded-md border px-3 py-2 text-sm font-semibold" @click="showSave=true">Simpan analisis</button><button type="button" class="rounded-md border px-3 py-2 text-sm font-semibold" @click="showExport=true">Ekspor</button></div><AnalyticsState :pending="pending" :error="error" :warning="warning" :has-data="Boolean(currentResponse())" :status="currentMeta()?.status"/><div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]"><AnalyticsQueryBuilder :fields="fields" :model-value="draft" @update="update" @reset="state.reset" @apply="state.apply"/><AnalyticsTemplatePicker :templates="catalogTemplates" :model-value="draft" @select="chooseTemplate"/></div><AnalyticsFilterChips :filters="draft.filters" :fields="fields" @remove="state.removeFilter"/><AnalyticsSavedAnalysisMenu :items="savedItems" @open="openSaved" @remove="removeSaved" @rename="renameSaved"/><AnalyticsMetricSummary :response="currentResponse()" :meta="currentMeta()"/><AnalyticsInsightPanel :response="currentResponse()"/><AnalyticsVisual v-if="currentResponse()" :groups="currentResponse()?.data.groups || []" :visual="applied.visual" :drill-field="drillField" @select="selectGroup" @drill="drillGroup"/><AnalyticsRecordTable :records="records" @open="openRecord"/><AnalyticsSaveAnalysisDialog :model-value="showSave" :config="applied" :busy="savedPending" @close="showSave=false" @save="saveAnalysis"/><AnalyticsExportDialog :model-value="showExport" :config="applied" :status="exportStatus" :busy="exportPending" @close="showExport=false" @submit="startExport"/></div></template>
