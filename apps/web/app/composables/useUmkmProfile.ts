import { updateItem } from "@directus/sdk"
import type { AnalyticsProfile } from "~/types/analytics"
import { endpoint, fromEnvelope, type Enveloped } from "~/lib/directus"
import { isUnauthorized } from "~/lib/request-error"

export async function useUmkmProfile(id: string) {
  // Resolve the client before the first await so the Nuxt context is still available.
  const directus = useDirectus()
  const profile = shallowRef<AnalyticsProfile | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  const mutating = ref(false)
  async function load() {
    pending.value = true
    error.value = null
    try {
      profile.value = fromEnvelope<AnalyticsProfile>(
        await directus.request(
          endpoint<Enveloped<AnalyticsProfile>>(`/v1/analytics/analysis/umkm/${encodeURIComponent(id)}`),
        ),
      )
    } catch (cause: unknown) {
      error.value = cause
      if (import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
    } finally { pending.value = false }
  }
  async function setStatus(status: "active" | "archived") {
    mutating.value = true
    try {
      await directus.request(updateItem("usaha", id, { status }))
      await load()
    } finally { mutating.value = false }
  }
  async function archive() { return setStatus("archived") }
  async function restore() { return setStatus("active") }
  function saveReturn() {
    if (import.meta.client) {
      const prior = history.state?.analyticsReturn || { path: "/dashboard/analitik" }
      sessionStorage.setItem("analytics:return", JSON.stringify(prior))
    }
  }
  await load()
  return { profile, pending, error, mutating, load, archive, restore, saveReturn }
}
