import type { AnalysisConfig, AnalyticsQueryResponse, AnalyticsRecordsResponse } from "~/types/analytics"
import { useQuery } from "@tanstack/vue-query"
import { canonicalAggregateKey, canonicalRecordsKey } from "~/lib/analytics-query"
import { isAbortError, isUnauthorized } from "~/lib/request-error"

// Aggregate/record responses are immutable per read-model generation, so they
// are cached per canonical config and revalidated in the background after a
// bounded staleness window (matches the 60s CRUD-to-visible SLO). Switching
// between previously-viewed configs paints instantly from cache; chart-type
// and pagination changes never invalidate the aggregate cache.
const ANALYTICS_STALE_MS = 60_000
const ANALYTICS_GC_MS = 15 * 60_000

export function useAnalyticsQuery(config: Readonly<{ value: AnalysisConfig }>) {
  // Captured synchronously during setup so SSR cookie forwarding stays inside
  // the Nuxt context even though queryFn runs asynchronously.
  const ssrHeaders = import.meta.server ? useRequestHeaders(["cookie"]) : undefined

  const aggregateQuery = useQuery<AnalyticsQueryResponse>({
    queryKey: ["analitik", "aggregate", computed(() => canonicalAggregateKey(config.value))],
    queryFn: () => $fetch<AnalyticsQueryResponse>("/panel/analitik/query", {
      method: "POST",
      body: config.value,
      credentials: "include",
      headers: ssrHeaders,
    }),
    staleTime: ANALYTICS_STALE_MS,
    gcTime: ANALYTICS_GC_MS,
  })

  // Records depend only on filters+sort — not on the aggregate response — so
  // the first page loads in parallel instead of waiting for the chart query.
  const firstPageQuery = useQuery<AnalyticsRecordsResponse>({
    queryKey: ["analitik", "records", computed(() => canonicalRecordsKey(config.value))],
    queryFn: () => $fetch<AnalyticsRecordsResponse>("/panel/analitik/records", {
      method: "POST",
      body: { schemaVersion: 1, filters: config.value.filters, pageSize: 20, sort: config.value.sort },
      credentials: "include",
      headers: ssrHeaders,
    }),
    staleTime: ANALYTICS_STALE_MS,
    gcTime: ANALYTICS_GC_MS,
  })

  // Cursor navigation beyond page one stays imperative (page-driven) and is
  // layered over the cached first page.
  const pagedRecords = shallowRef<AnalyticsRecordsResponse | null>(null)
  const pagedPending = ref(false)
  let controller: AbortController | null = null
  let sequence = 0

  async function fetchRecords(cursor?: string | null) {
    const requestId = ++sequence
    controller?.abort()
    controller = new AbortController()
    pagedPending.value = true
    try {
      const result = await $fetch<AnalyticsRecordsResponse>("/panel/analitik/records", {
        method: "POST",
        body: { schemaVersion: 1, filters: config.value.filters, pageSize: 20, sort: config.value.sort, cursor: cursor === undefined ? config.value.cursor : cursor || undefined },
        credentials: "include",
        headers: ssrHeaders,
        signal: controller.signal,
      })
      if (requestId === sequence) pagedRecords.value = result
    } catch (cause: unknown) {
      if (!isAbortError(cause) && requestId === sequence && import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
    } finally {
      if (requestId === sequence) pagedPending.value = false
    }
  }

  // A different applied analysis invalidates imperative pagination state.
  watch(() => canonicalRecordsKey(config.value), () => {
    sequence += 1
    controller?.abort()
    pagedRecords.value = null
  })

  onBeforeUnmount(() => {
    sequence += 1
    controller?.abort()
  })

  return {
    response: computed(() => aggregateQuery.data.value ?? null),
    records: computed(() => pagedRecords.value ?? firstPageQuery.data.value ?? null),
    // isLoading = no cached data yet; background revalidation keeps stale
    // content on screen instead of flashing a loading state.
    pending: computed(() => aggregateQuery.isLoading.value),
    recordsPending: computed(() => firstPageQuery.isLoading.value || pagedPending.value),
    error: computed(() => aggregateQuery.error.value ?? null),
    fetchRecords,
  }
}
