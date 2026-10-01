<script setup lang="ts">
import { useAnalyticsCatalog } from "~/composables/useAnalyticsCatalog";
import { useAnalysisState } from "~/composables/useAnalysisState";
import { useAnalyticsQuery } from "~/composables/useAnalyticsQuery";
import { canonicalRecordsKey } from "~/lib/analytics-query";
import { builderLabel } from "~/lib/analytics-filters";
import type {
  AnalysisConfig,
  AnalyticsGroup,
  SavedAnalysis,
  AnalyticsExportType,
  AnalyticsQueryResponse,
} from "~/types/analytics";
import { useSavedAnalyses } from "~/composables/useSavedAnalyses";
import { useAnalyticsExports } from "~/composables/useAnalyticsExports";
import { isUnauthorized } from "~/lib/request-error";
definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Analitik UMKM" });
const catalogApi = useAnalyticsCatalog();
await catalogApi.load();
const savedApi = useSavedAnalyses();
// Gagal memuat analisis tersimpan tidak boleh mematikan render halaman (async setup).
const savedLoadError = ref<string | null>(null);
const aksiFeedback = ref<{ tone: "success" | "error"; text: string } | null>(null);
async function muatSaved() {
  savedLoadError.value = null;
  try {
    await savedApi.load();
  } catch {
    savedLoadError.value = "Daftar analisis tersimpan gagal dimuat.";
  }
}
await muatSaved();
const exportApi = useAnalyticsExports();
const route = useRoute();
const state = useAnalysisState();
function clone<T>(value: T): T {
  // SAFETY: seluruh nilai domain di sini JSON-safe; round-trip JSON.parse(JSON.stringify) mempertahankan strukturnya.
  return JSON.parse(JSON.stringify(value)) as T;
}
const query = useAnalyticsQuery(state.applied);
// Respons query bersifat read-only untuk halaman; computed langsung menghindari
// mirror ref + watch boilerplate dan tetap reaktif terhadap cache TanStack.
const response = computed<AnalyticsQueryResponse | null>(
  () => query.response.value,
);
const pending = computed(() => query.pending.value);
const recordsPending = computed(() => query.recordsPending.value);
const error = computed(() => query.error.value);
const draft = reactive(clone(state.draft.value));
const applied = reactive(clone(state.applied.value));
const warning = ref(state.warning.value);
const recordsCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
watch(
  () => canonicalRecordsKey(state.applied.value),
  () => {
    // Table pagination resets when the applied analysis changes (canonical key),
    // not on background revalidations of the same analysis.
    recordsCursor.value = null;
    cursorStack.value = [];
  },
);
watch(state.draft, (value) => Object.assign(draft, clone(value)));
watch(state.applied, (value) => Object.assign(applied, clone(value)));
watch(state.warning, (value) => {
  warning.value = value;
});
const meta = computed(() => response.value?.meta);
const fields = computed(() => catalogApi.catalog.value?.fields || []);
const records = computed(() => query.records.value?.data.records || []);
const nextCursor = computed(() => query.records.value?.data.nextCursor || null);
const savedItems = computed(() => savedApi.items.value);
const catalogTemplates = computed(() => catalogApi.templates.value);
const savedPending = computed(() => savedApi.pending.value);
const exportStatus = computed(() => exportApi.status.value);
const exportPending = computed(() => exportApi.pending.value);
const showSave = ref(false);
const showExport = ref(false);
const showSaved = ref(false);
const railOpen = ref(true);
const tableOpen = ref(false);
const breadcrumbs = state.breadcrumbs;
function update(patch: Partial<AnalysisConfig>) {
  state.updateDraft(patch);
}
function chooseTemplate(config: Partial<AnalysisConfig>) {
  state.updateDraft({ ...config, filters: config.filters || [] });
}
function selectGroup(group: AnalyticsGroup) {
  state.addFilter({
    fieldId: state.applied.value.groupBy,
    operator: "eq",
    value: group.key,
  });
  state.apply();
}
const DRILL_PATH = new Map<string, string>([
  ["kota_nama", "kecamatan_nama"],
  ["kota_kode", "kecamatan_nama"],
  ["kecamatan_nama", "kelurahan_nama"],
  ["sektor_kbli", "kbli_kode"],
]);
function drillGroup(group: AnalyticsGroup) {
  const field = DRILL_PATH.get(state.applied.value.groupBy);
  if (!field) return;
  state.addFilter({
    fieldId: state.applied.value.groupBy,
    operator: "eq",
    value: group.key,
  });
  state.drillDown(field, group.label);
}
function openRecord(record: { id: string }) {
  state.saveReturnContext(records.value, record.id);
}
onMounted(() => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("analytics:return") || "null",
    );
    if (saved?.path === route.fullPath && Number.isFinite(saved.scrollY))
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
  } catch {
    /* Restoring scroll position is best-effort. */
  }
});
const groups = computed(() => response.value?.data.groups || []);
const metric = computed(() => response.value?.data.metric);
const drillField = computed(() => DRILL_PATH.get(applied.groupBy) || null);
const dimensionLabel = computed(() => {
  const field = fields.value.find((item) => item.key === applied.groupBy);
  return field ? builderLabel(field) : "kelompok";
});
const coverageTotal = computed(() =>
  Number(meta.value?.coverage?.total || meta.value?.matched || 0),
);
const coverage = computed(() =>
  coverageTotal.value
    ? (Number(meta.value?.coverage?.matched ?? meta.value?.matched ?? 0) *
        100) /
      coverageTotal.value
    : 100,
);
const unknownShare = computed(() =>
  coverageTotal.value
    ? (Number(meta.value?.coverage?.unknown || 0) * 100) / coverageTotal.value
    : 0,
);
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(applied));
function nextRecordPage() {
  const cursor = nextCursor.value;
  if (!cursor) return;
  cursorStack.value = [...cursorStack.value, recordsCursor.value || ""];
  recordsCursor.value = cursor;
  void query.fetchRecords(cursor);
}
function prevRecordPage() {
  const stack = [...cursorStack.value];
  const previous = stack.pop();
  if (previous === undefined) return;
  cursorStack.value = stack;
  recordsCursor.value = previous || null;
  void query.fetchRecords(previous || null);
}
async function saveAnalysis(name: string) {
  if (!name.trim()) return;
  aksiFeedback.value = null;
  try {
    await savedApi.save(name.trim(), state.applied.value);
    showSave.value = false;
    aksiFeedback.value = { tone: "success", text: `Analisis "${name.trim()}" tersimpan.` };
  } catch {
    aksiFeedback.value = { tone: "error", text: "Analisis tidak dapat disimpan. Coba lagi." };
  }
}
function openSaved(item: SavedAnalysis) {
  state.updateDraft(item.config);
  state.apply();
  showSaved.value = false;
}
async function removeSaved(id: string) {
  aksiFeedback.value = null;
  try {
    await savedApi.remove(id);
    aksiFeedback.value = { tone: "success", text: "Analisis tersimpan dihapus." };
  } catch {
    aksiFeedback.value = { tone: "error", text: "Analisis tersimpan tidak dapat dihapus. Coba lagi." };
  }
}
async function renameSaved(payload: { id: string; name: string }) {
  aksiFeedback.value = null;
  try {
    await savedApi.rename(payload.id, payload.name);
  } catch {
    aksiFeedback.value = { tone: "error", text: "Nama analisis tidak dapat diubah. Coba lagi." };
  }
}
async function startExport(payload: { type: AnalyticsExportType; title?: string }) {
  aksiFeedback.value = null;
  try {
    await exportApi.submit(payload.type, state.applied.value, { title: payload.title });
  } catch (cause) {
    // Sesi habis (401) sudah memicu event auth:unauthorized di useAnalyticsExports; sisanya tampil inline.
    aksiFeedback.value = {
      tone: "error",
      text: isUnauthorized(cause)
        ? "Sesi berakhir. Masuk kembali untuk mengekspor hasil."
        : "Ekspor tidak dapat dimulai. Coba lagi.",
    };
  }
}
const slidePending = ref(false);
const slideError = ref<string | null>(null);
/** Slide PPT: rasterise the rendered chart and build the deck in the browser (lib/analytics-slide). */
async function exportSlide() {
  if (!response.value || !metric.value) return;
  slidePending.value = true;
  slideError.value = null;
  try {
    const { downloadSlideDeck, svgToPng } = await import("~/lib/analytics-slide");
    // The largest SVG in the visual panel is the chart (small ones are icons).
    const svgs = [...document.querySelectorAll<SVGSVGElement>('section[aria-labelledby="visual-title"] svg')];
    const chart = svgs.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
    await downloadSlideDeck({
      metric: metric.value,
      dimensionLabel: dimensionLabel.value,
      groups: groups.value,
      total: Number(response.value.data.total ?? 0),
      filters: applied.filters,
      fieldLabel: (fieldId) => fields.value.find((field) => field.key === fieldId)?.label || fieldId,
      dataAsOf: meta.value?.dataAsOf ?? null,
      chartPng: chart ? await svgToPng(chart) : null,
    });
    showExport.value = false;
  } catch {
    slideError.value = "Slide PPT tidak dapat dibuat di peramban ini. Coba format lain.";
  } finally {
    slidePending.value = false;
  }
}
/** Empty state “Reset filter”: kembalikan konfigurasi default dan langsung jalankan. */
function resetFromEmptyState() {
  state.reset();
  state.apply();
}

// ── Cross-filter selected state (ux-spec §8) ────────────────────────────────
/** Nilai filter eq pada dimensi aktif = kelompok yang sedang menyeleksi canvas. */
const selectedGroupKey = computed(() => {
  const filter = applied.filters.find(
    (item) => item.fieldId === applied.groupBy && item.operator !== "neq",
  );
  if (!filter) return null;
  return Array.isArray(filter.value)
    ? String(filter.value[0])
    : String(filter.value);
});
function removeFilter(fieldId: string) {
  state.removeFilter(fieldId);
  state.apply();
}
function clearGroupSelection() {
  removeFilter(applied.groupBy);
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2 lg:flex-1 lg:overflow-hidden">
    <AnalyticsToolbar
      :meta="meta"
      :config="draft"
      :fields="fields"
      :templates="catalogTemplates"
      :filters="draft.filters"
      :breadcrumbs="breadcrumbs"
      :saved-count="savedItems.length"
      :rail-open="railOpen"
      @template="chooseTemplate"
      @remove-filter="removeFilter"
      @saved="showSaved = true"
      @save="showSave = true"
      @export="showExport = true"
      @toggle-rail="railOpen = !railOpen"
    />

    <div
      v-if="savedLoadError"
      role="alert"
      class="flex shrink-0 flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span>{{ savedLoadError }}</span>
      <UiButton size="sm" variant="outline" :disabled="savedPending" @click="muatSaved">Coba lagi</UiButton>
    </div>
    <p
      v-else-if="aksiFeedback"
      :role="aksiFeedback.tone === 'error' ? 'alert' : 'status'"
      class="shrink-0 text-sm"
      :class="aksiFeedback.tone === 'error' ? 'text-destructive' : 'text-emerald-700'"
    >
      {{ aksiFeedback.text }}
    </p>

    <AnalyticsState
      class="shrink-0"
      :pending="pending"
      :error="error"
      :warning="warning"
      :has-data="Boolean(response)"
      :status="meta?.status"
      @reset="resetFromEmptyState"
    />

    <div
      class="grid min-h-0 gap-2 lg:flex-1 lg:overflow-hidden"
      :class="
        railOpen
          ? 'lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-1'
          : 'lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-1'
      "
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
        <AnalyticsMetricSummary :response="response" :meta="meta" />

        <AnalyticsInsightPanel
          :groups="groups"
          :metric="metric"
          :coverage="coverage"
          :unknown-share="unknownShare"
          @evidence="tableOpen = true"
        />

        <div
          class="grid min-h-0 gap-2 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden 2xl:grid-cols-3 2xl:grid-rows-1"
        >
          <AnalyticsVisual
            v-if="response"
            v-model:table-open="tableOpen"
            :groups="groups"
            :metric="metric"
            :visual="applied.visual"
            :selected-key="selectedGroupKey"
            :include-others="applied.includeOthers !== false"
            @update:visual="state.setVisual"
            @select="selectGroup"
            @clear-select="clearGroupSelection"
          />
          <AnalyticsGroupList
            :groups="groups"
            :metric="metric"
            :dimension-label="dimensionLabel"
            :drill-field="drillField"
            :selected-key="selectedGroupKey"
            @select="selectGroup"
            @drill="drillGroup"
          />
          <AnalyticsRecordTable
            class="lg:col-span-2 2xl:col-span-1"
            :records="records"
            :matched="meta?.coverage?.total ?? meta?.matched"
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
      v-model="showSaved"
      :items="savedItems"
      @open="openSaved"
      @remove="removeSaved"
      @rename="renameSaved"
    />
    <AnalyticsSaveAnalysisDialog
      v-model="showSave"
      :config="applied"
      :busy="savedPending"
      @save="saveAnalysis"
    />
    <AnalyticsExportDialog
      v-model="showExport"
      :config="applied"
      :status="exportStatus"
      :busy="exportPending || slidePending"
      :error="slideError"
      @submit="startExport"
      @slide="exportSlide"
    />
  </div>
</template>
