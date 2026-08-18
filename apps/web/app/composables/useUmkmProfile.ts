import type { AnalyticsProfile } from "~/types/analytics"
import { isUnauthorized } from "~/lib/request-error"

export async function useUmkmProfile(id: string) {
  const profile = shallowRef<AnalyticsProfile | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  const mutating = ref(false)
  async function load() {
    pending.value = true
    error.value = null
    try {
      profile.value = await $fetch<AnalyticsProfile>(`/panel/analitik/umkm/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
      })
    } catch (cause: unknown) {
      error.value = cause
      if (import.meta.client && isUnauthorized(cause)) window.dispatchEvent(new Event("auth:unauthorized"))
    } finally { pending.value = false }
  }
  async function setStatus(status: "active" | "archived") {
    mutating.value = true
    try {
      await $fetch(`/panel/items/usaha/${encodeURIComponent(id)}`, { method: "PATCH", body: { status }, credentials: "include" })
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
