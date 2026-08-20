import { defaultAnalysis, parseAnalysisUrl, serializeAnalysisUrl } from "~/lib/analytics-query"
import type { AnalysisConfig, AnalyticsFilter, AnalyticsVisual } from "~/types/analytics"

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

type RouterQuery = Record<string, string | string[]>
function queryFromConfig(config: AnalysisConfig) {
  const query: RouterQuery = {}
  for (const [key, value] of new URLSearchParams(serializeAnalysisUrl(config))) {
    const current = query[key]
    query[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value]
  }
  return query
}

export function useAnalysisState() {
  const route = useRoute()
  const router = useRouter()
  const initial = parseAnalysisUrl(route.fullPath.split("?")[1] || "")
  const draft = ref<AnalysisConfig>(clone(initial.config))
  const applied = ref<AnalysisConfig>(clone(initial.config))
  const warning = ref(initial.warning)
  const breadcrumbs = ref<string[]>([])
  let applying = false

  function syncFromRoute() {
    const parsed = parseAnalysisUrl(route.fullPath.split("?")[1] || "")
    applied.value = clone(parsed.config)
    draft.value = clone(parsed.config)
    warning.value = parsed.warning
    if (import.meta.client) {
      const saved = history.state?.analyticsBreadcrumbs
      breadcrumbs.value = Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []
    }
  }

  function apply() {
    const next = clone(draft.value)
    applied.value = next
    warning.value = false
    applying = true
    void router.push({ path: route.path, query: queryFromConfig(next) }).then(() => {
      if (import.meta.client) history.replaceState({ ...history.state, analyticsConfig: next, analyticsBreadcrumbs: breadcrumbs.value }, "")
      applying = false
    }).catch(() => { applying = false })
  }

  function reset() { draft.value = clone(defaultAnalysis) }
  function updateDraft(patch: Partial<AnalysisConfig>) {
    draft.value = { ...draft.value, ...patch, filters: patch.filters === undefined ? draft.value.filters : patch.filters }
  }
  function addFilter(filter: AnalyticsFilter) {
    draft.value = { ...draft.value, filters: [...draft.value.filters.filter((item) => item.fieldId !== filter.fieldId), filter] }
  }
  function removeFilter(fieldId: string) {
    draft.value = { ...draft.value, filters: draft.value.filters.filter((item) => item.fieldId !== fieldId) }
  }
  function setVisual(visual: AnalyticsVisual) { draft.value = { ...draft.value, visual } }
  function drillDown(field: string, label: string) {
    draft.value = { ...draft.value, groupBy: field, breakdown: null, cursor: undefined, page: 1 }
    breadcrumbs.value = [...breadcrumbs.value, label].slice(-4)
    apply()
  }
  function saveReturnContext(records: Array<{ id: string }> = [], selectedId?: string) {
    if (!import.meta.client) return
    const recordIds = records.map((record) => record.id).filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100)
    const value = { path: route.fullPath, scrollY: window.scrollY, config: clone(applied.value), recordIds, selectedId }
    sessionStorage.setItem("analytics:return", JSON.stringify(value))
    history.replaceState({ ...history.state, analyticsConfig: value.config, analyticsReturn: value, analyticsBreadcrumbs: breadcrumbs.value }, "")
  }

  watch(() => route.fullPath, () => {
    if (!applying) syncFromRoute()
  })
  return { draft, applied, warning, breadcrumbs, apply, reset, updateDraft, addFilter, removeFilter, setVisual, drillDown, saveReturnContext, syncFromRoute }
}
