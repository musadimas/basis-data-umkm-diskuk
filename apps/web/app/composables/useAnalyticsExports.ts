import type { AnalysisConfig, AnalyticsExportStatus, AnalyticsExportType } from "~/types/analytics"
import { isUnauthorized } from "~/lib/request-error"

export function useAnalyticsExports() {
  const status = shallowRef<AnalyticsExportStatus | null>(null)
  const pending = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  async function submit(type: AnalyticsExportType, config: AnalysisConfig, profileId?: string) {
    pending.value = true
    try {
      status.value = await $fetch<AnalyticsExportStatus>("/panel/analitik/exports", { method: "POST", body: { exportType: type, config, ...(profileId ? { profileId } : {}) }, credentials: "include" })
      if (["queued", "processing"].includes(status.value.data.status)) poll(status.value.data.jobId)
    } catch (cause: unknown) {
      if (import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
      throw cause
    } finally { pending.value = false }
  }
  async function poll(jobId: string) {
    clearTimeout(timer)
    try {
      const next = await $fetch<AnalyticsExportStatus>(`/panel/analitik/exports/${encodeURIComponent(jobId)}`, { credentials: "include" })
      status.value = next
      if (["queued", "processing"].includes(next.data.status)) timer = setTimeout(() => void poll(jobId), 1500)
    } catch (cause: unknown) {
      if (import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
    }
  }
  onBeforeUnmount(() => clearTimeout(timer))
  return { status, pending, submit }
}
