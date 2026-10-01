<script setup lang="ts">
import type {
  AnalyticsField,
  AnalysisConfig,
  AnalyticsFilter,
} from "~/types/analytics";
import {
  BUILDER_HIDDEN_FIELDS,
  LABEL_VALUE_FIELDS,
  MAX_IN_VALUES,
  builderLabel,
  filterConfigFor,
  mergeFilter,
  operatorsFor,
  type FilterOption,
} from "~/lib/analytics-filters";

const props = defineProps<{
  fields: AnalyticsField[];
  modelValue: AnalysisConfig;
  dirty?: boolean;
}>();
const emit = defineEmits<{
  apply: [];
  reset: [];
  update: [patch: Partial<AnalysisConfig>];
}>();

/**
 * reka-ui menolak `SelectItem` bernilai kosong, jadi opsi "Tidak ada" memakai
 * sentinel dan dipetakan kembali ke breakdown kosong saat dipilih.
 */
const TANPA_BREAKDOWN = "__tanpa_breakdown__";

const dimensions = computed(() =>
  props.fields.filter(
    (field) =>
      field.status === "active" &&
      field.role === "dimension" &&
      (!BUILDER_HIDDEN_FIELDS.has(field.key) ||
        field.key === props.modelValue.groupBy ||
        field.key === props.modelValue.breakdown),
  ),
);
const metrics = computed(() =>
  props.fields.filter(
    (field) => field.status === "active" && field.role === "metric",
  ),
);
/** Field filter: role filter/dimension aktif, tanpa field wilayah duplikat (BUG-003). */
const filterFields = computed(() =>
  props.fields.filter(
    (item) =>
      item.status === "active" &&
      (item.role === 'filter' || item.role === 'dimension') &&
      !BUILDER_HIDDEN_FIELDS.has(item.key),
  ),
);

/**
 * Field picker dikelompokkan sesuai ux-spec §5. Grup mengikuti urutan registry;
 * label dipetakan ke bahasa manusia bila server masih memakai grup teknis.
 */
const GROUP_LABELS = {
  wilayah: "Wilayah",
  usaha: "Profil usaha",
  kbli: "KBLI",
  tenaga_kerja: "Tenaga kerja",
  kualitas: "Kualitas data",
  analytics: "Semua field",
} as const;
const groupOrder = [
  "wilayah",
  "usaha",
  "kbli",
  "tenaga_kerja",
  "kualitas",
] as const;
type GroupKey = (typeof groupOrder)[number] | "analytics";
function groupKey(field: AnalyticsField): GroupKey {
  const normalized = field.group.toLowerCase();
  const matched = groupOrder.find((key) => normalized.includes(key));
  return matched ?? "analytics";
}
const dimensionGroups = computed(() => {
  const groups = new Map<GroupKey, AnalyticsField[]>();
  for (const field of dimensions.value) {
    const key = groupKey(field);
    const bucket = groups.get(key) || [];
    bucket.push(field);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([key, fields]) => ({
    key,
    label: GROUP_LABELS[key],
    fields,
  }));
});
const filterField = ref("");
const filterValue = ref("");
const filterLimitHit = ref(false);
const filterOperator = ref<AnalyticsFilter["operator"]>("eq");
const selectedField = computed(() =>
  props.fields.find((field) => field.key === filterField.value),
);
const selectedConfig = computed(() =>
  filterField.value ? filterConfigFor(filterField.value) : undefined,
);

// ── Opsi filter (searchable + cascading) ────────────────────────────────────
const catalogApi = useAnalyticsCatalog();
const optionList = ref<FilterOption[]>([]);
const optionPending = ref(false);
let optionSequence = 0;

async function loadOptions() {
  if (!selectedField.value) {
    optionList.value = [];
    return;
  }
  const config = selectedConfig.value;
  if (config?.staticOptions) {
    const term = searchDebounce.value.trim().toLowerCase();
    optionList.value = term
      ? config.staticOptions.filter((option) =>
          option.label.toLowerCase().includes(term),
        )
      : config.staticOptions;
    return;
  }
  const requestId = ++optionSequence;
  optionPending.value = true;
  try {
    const cascade = config?.cascade?.({ filters: props.modelValue.filters });
    const response = await catalogApi.options(
      filterField.value,
      searchDebounce.value.trim(),
      cascade?.parentValue,
    );
    if (requestId !== optionSequence) return;
    const byLabel = LABEL_VALUE_FIELDS.has(filterField.value);
    const seen = new Set<string>();
    optionList.value = response.options.flatMap((option) => {
      // `*_nama` disaring server dengan nama; nama kembar lintas induk cukup muncul sekali.
      const id = byLabel ? option.label : String(option.id);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, label: option.label }];
    });
  } catch {
    if (requestId === optionSequence) optionList.value = [];
  } finally {
    if (requestId === optionSequence) optionPending.value = false;
  }
}

const searchDebounce = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounce 250 ms agar tiap ketikan tidak memicu request ke server. */
watch(searchDebounce, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void loadOptions();
  }, 250);
});
watch(selectedField, () => {
  filterOperator.value = operatorsFor(selectedField.value)[0] || "eq";
  filterValue.value = "";
  filterLimitHit.value = false;
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  void loadOptions();
});
onMounted(() => {
  void loadOptions();
});
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

/**
 * Parent berubah → opsi anak di-refresh dan nilai anak yang tidak kompatibel
 * dibersihkan (ux-spec §6). Deep watch aman: filters maksimal QUERY_BUDGET
 * (8 item) sehingga traversalnya murah.
 */
watch(
  () =>
    props.modelValue.filters
      .map(
        (filter) =>
          `${filter.fieldId}:${filter.operator}:${Array.isArray(filter.value) ? filter.value.join("|") : filter.value}`,
      )
      .join(";"),
  () => {
    const cascade = selectedConfig.value?.cascade?.({
      filters: props.modelValue.filters,
    });
    if (!cascade) return;
    filterValue.value = "";
    void loadOptions();
  },
);

const operatorChoices = computed(() => operatorsFor(selectedField.value));
const operatorLabels = {
  eq: "sama dengan",
  neq: "tidak sama",
  contains: "mengandung",
  starts_with: "diawali",
  in: "salah satu",
} as const;
/** Label induk cascade untuk hint; kosong bila field tidak cascading atau induk sudah dipilih. */
const cascadeHint = computed(() => {
  const config = filterField.value
    ? filterConfigFor(filterField.value)
    : undefined;
  if (!config?.cascade) return "";
  const parent = config.cascade({ filters: props.modelValue.filters });
  if (!parent?.parentField || parent.parentValue) return "";
  return parent.parentField === "kota_nama"
    ? "Tips: pilih kabupaten/kota dulu agar daftar kecamatan lebih pendek."
    : "Tips: pilih nilai induknya dulu agar daftar lebih pendek.";
});

function patch(value: string, key: keyof AnalysisConfig) {
  // SAFETY: key berasal dari keyof AnalysisConfig dan nilai select selalu string, sehingga objek ini cocok dengan Partial<AnalysisConfig>.
  emit("update", { [key]: value } as Partial<AnalysisConfig>);
}
function addFilter() {
  const value = filterValue.value.trim();
  if (!filterField.value || !value) return;
  const next = mergeFilter(props.modelValue.filters, {
    fieldId: filterField.value,
    operator: filterOperator.value,
    value,
  });
  filterLimitHit.value = next === props.modelValue.filters;
  if (filterLimitHit.value) return;
  emit("update", { filters: next });
  filterValue.value = "";
}
</script>

<template>
  <section
    aria-labelledby="query-builder-title"
    class="flex min-h-0 flex-col rounded-lg border bg-card lg:h-full"
  >
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b px-2.5 py-1.5"
    >
      <h2
        id="query-builder-title"
        class="text-xs font-bold uppercase tracking-wide"
      >
        Atur analisis
      </h2>
      <span
        v-if="dirty"
        class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
        >Draf</span
      >
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5"
      data-lenis-prevent-wheel
    >
      <label
        class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground"
      >
        Metrik
        <UiSelect
          :model-value="modelValue.metric"
          @update:model-value="patch($event as string, 'metric')"
        >
          <UiSelectTrigger aria-label="Metrik" class="h-8 w-full text-sm font-normal text-foreground"><UiSelectValue /></UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="jumlah_umkm">Jumlah UMKM</UiSelectItem>
            <UiSelectItem
              v-for="field in metrics.filter(
                (item) => item.key !== 'jumlah_umkm',
              )"
              :key="field.key"
              :value="field.key"
            >
              {{ field.label }}
            </UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </label>

      <label
        class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground"
      >
        Kelompokkan menurut
        <UiSelect
          :model-value="modelValue.groupBy"
          @update:model-value="patch($event as string, 'groupBy')"
        >
          <UiSelectTrigger aria-label="Kelompokkan menurut" class="h-8 w-full text-sm font-normal text-foreground"><UiSelectValue /></UiSelectTrigger>
          <UiSelectContent>
            <UiSelectGroup
              v-for="group in dimensionGroups"
              :key="group.key"
            >
              <UiSelectLabel>{{ group.label }}</UiSelectLabel>
              <UiSelectItem
                v-for="field in group.fields"
                :key="field.key"
                :value="field.key"
              >
                {{ builderLabel(field) }}
              </UiSelectItem>
            </UiSelectGroup>
          </UiSelectContent>
        </UiSelect>
      </label>

      <label
        class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground"
      >
        Breakdown opsional
        <UiSelect
          :model-value="modelValue.breakdown || TANPA_BREAKDOWN"
          @update:model-value="
            patch($event === TANPA_BREAKDOWN ? '' : ($event as string), 'breakdown')
          "
        >
          <UiSelectTrigger aria-label="Breakdown opsional" class="h-8 w-full text-sm font-normal text-foreground"><UiSelectValue placeholder="Tidak ada" /></UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem :value="TANPA_BREAKDOWN">Tidak ada</UiSelectItem>
            <UiSelectGroup
              v-for="group in dimensionGroups"
              :key="group.key"
            >
              <UiSelectLabel>{{ group.label }}</UiSelectLabel>
              <UiSelectItem
                v-for="field in group.fields"
                :key="field.key"
                :value="field.key"
                :disabled="field.key === modelValue.groupBy"
              >
                {{ builderLabel(field) }}
              </UiSelectItem>
            </UiSelectGroup>
          </UiSelectContent>
        </UiSelect>
      </label>

      <label
        class="flex flex-col gap-0.5 text-[11px] font-semibold text-muted-foreground"
      >
        Urutan baris
        <UiSelect
          :model-value="modelValue.sort || 'nama'"
          @update:model-value="patch($event as string, 'sort')"
        >
          <UiSelectTrigger aria-label="Urutan baris" class="h-8 w-full text-sm font-normal text-foreground"><UiSelectValue /></UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="nama">Nama usaha</UiSelectItem>
            <UiSelectItem value="id">Identitas baris</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </label>

      <label
        class="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground"
      >
        <UiCheckbox
          :model-value="modelValue.includeOthers !== false"
          @update:model-value="
            emit('update', {
              includeOthers: $event === true,
            })
          "
        />
        Gabungkan sisanya sebagai “Lainnya”
      </label>

      <fieldset class="rounded-md border p-2">
        <legend class="px-1 text-[11px] font-semibold">Tambah filter</legend>
        <div class="flex flex-col gap-1.5">
          <UiSelect v-model="filterField">
            <UiSelectTrigger id="analytics-filter-field" aria-label="Field filter" class="min-w-0 text-sm"><UiSelectValue placeholder="Pilih field" /></UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem
                v-for="field in filterFields"
                :key="field.key"
                :value="field.key"
              >
                {{ builderLabel(field) }}
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>

          <template v-if="selectedField">
            <div
              class="grid"
              :class="
                operatorChoices.length > 1
                  ? 'grid-cols-[auto_minmax(0,1fr)]'
                  : 'grid-cols-1'
              "
            >
              <UiSelect
                v-if="operatorChoices.length > 1"
                v-model="filterOperator"
              >
                <UiSelectTrigger aria-label="Operator filter" class="h-8 text-xs"><UiSelectValue /></UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectItem
                    v-for="choice in operatorChoices"
                    :key="choice"
                    :value="choice"
                  >
                    {{ operatorLabels[choice] ?? choice }}
                  </UiSelectItem>
                </UiSelectContent>
              </UiSelect>

              <template v-if="optionList.length || optionPending">
                <div class="relative min-w-0">
                  <UiInput
                    v-model="searchDebounce"
                    type="search"
                    class="h-8 w-full min-w-0 pr-12 text-sm"
                    :placeholder="`Cari ${builderLabel(selectedField).toLowerCase()}…`"
                    aria-label="Cari nilai filter"
                  />
                  <span
                    v-if="optionPending"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
                    >memuat…</span
                  >
                </div>
                <UiSelect v-model="filterValue">
                  <UiSelectTrigger aria-label="Nilai filter" class="min-w-0 text-sm"><UiSelectValue placeholder="Pilih nilai" /></UiSelectTrigger>
                  <UiSelectContent>
                    <UiSelectItem
                      v-for="option in optionList"
                      :key="option.id"
                      :value="option.id"
                    >
                      {{ option.label }}
                    </UiSelectItem>
                  </UiSelectContent>
                </UiSelect>
              </template>
              <UiInput
                v-else
                v-model="filterValue"
                class="h-8 min-w-0 text-sm"
                :placeholder="builderLabel(selectedField)"
                aria-label="Nilai filter"
                @keyup.enter="addFilter"
              />
            </div>
            <p
              v-if="cascadeHint"
              class="text-[10px] leading-tight text-muted-foreground"
            >
              {{ cascadeHint }}
            </p>
            <p
              v-if="filterLimitHit"
              role="alert"
              class="text-[10px] leading-tight text-destructive"
            >
              Maksimal {{ MAX_IN_VALUES }} nilai per filter.
            </p>
            <UiButton
              type="button"
              variant="outline"
              class="h-8 px-3 text-xs font-semibold"
              :disabled="!filterValue.trim()"
              @click="addFilter"
            >
              Tambah
            </UiButton>
          </template>
        </div>
      </fieldset>
    </div>

    <div class="flex shrink-0 items-center gap-2 border-t px-2.5 py-2">
      <UiButton
        type="button"
        variant="outline"
        class="h-8 flex-1 text-xs font-semibold"
        @click="emit('reset')"
      >
        Reset
      </UiButton>
      <UiButton
        type="button"
        size="sm"
        class="flex-1 text-xs"
        @click="emit('apply')"
        >Terapkan</UiButton
      >
    </div>
  </section>
</template>
