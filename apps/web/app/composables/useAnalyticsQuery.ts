import type { AnalysisConfig, AnalyticsQueryResponse, AnalyticsRecordsResponse } from "~/types/analytics"
import { isAbortError, isUnauthorized } from "~/lib/request-error"

export function useAnalyticsQuery(config: Readonly<{ value: AnalysisConfig }>) {
  const response = shallowRef<AnalyticsQueryResponse | null>(null)
  const records = shallowRef<AnalyticsRecordsResponse | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  let controller: AbortController | null = null
  let recordsController: AbortController | null = null
  let sequence = 0
  let recordsSequence = 0

  async function execute() {
    const requestId = ++sequence
    controller?.abort()
    controller = new AbortController()
    pending.value = true
    error.value = null
    try {
      const result = await $fetch<AnalyticsQueryResponse>("/panel/analitik/query", {
        method: "POST",
        body: config.value,
        credentials: "include",
        headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
        signal: controller.signal,
      })
      if (requestId === sequence) response.value = result
    } catch (cause: unknown) {
      if (!isAbortError(cause) && requestId === sequence) {
        error.value = cause
        if (import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
      }
    } finally {
      if (requestId === sequence) pending.value = false
    }
  }

  async function fetchRecords() {
    if (!response.value) return
    const requestId = ++recordsSequence
    recordsController?.abort()
    recordsController = new AbortController()
    try {
      const result = await $fetch<AnalyticsRecordsResponse>("/panel/analitik/records", {
        method: "POST",
        body: { schemaVersion: 1, filters: config.value.filters, pageSize: 20, sort: config.value.sort, cursor: config.value.cursor },
        credentials: "include",
        headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
        signal: recordsController.signal,
      })
      if (requestId === recordsSequence) records.value = result
    } catch (cause: unknown) {
      if (!isAbortError(cause) && requestId === recordsSequence && import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
    }
  }

  watch(() => JSON.stringify(config.value), execute, { immediate: true })
  onBeforeUnmount(() => { controller?.abort(); recordsController?.abort() })
  return { response, records, pending, error, execute, fetchRecords }
}
