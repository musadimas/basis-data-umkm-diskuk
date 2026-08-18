<script setup lang="ts">
import { useUmkmProfile } from "~/composables/useUmkmProfile"
import { useAnalyticsExports } from "~/composables/useAnalyticsExports"
import { defaultAnalysis } from "~/lib/analytics-query"
import type { AnalyticsProfile } from "~/types/analytics"
definePageMeta({ layout: "dashboard" })
const route = useRoute()
const router = useRouter()
const exportApi = useAnalyticsExports()
const exportPending = exportApi.pending
const exportStatus = exportApi.status
const api = await useUmkmProfile(String(route.params.id))
const profile = shallowRef<AnalyticsProfile | null>(api.profile.value)
const pending = ref(api.pending.value)
const error = shallowRef(api.error.value)
const mutating = ref(api.mutating.value)
const backHref = ref("/dashboard/analitik")
const previousId = ref<string | null>(null)
const nextId = ref<string | null>(null)
watch(api.profile, (value) => { profile.value = value })
watch(api.pending, (value) => { pending.value = value })
watch(api.error, (value) => { error.value = value })
watch(api.mutating, (value) => { mutating.value = value })
function restoreReturnContext() {
  try {
    const context = history.state?.analyticsReturn || JSON.parse(sessionStorage.getItem("analytics:return") || "null")
    if (!context || typeof context !== "object") return
    if (typeof context.path === "string" && context.path.startsWith("/dashboard/analitik")) backHref.value = context.path
    const ids = Array.isArray(context.recordIds) ? context.recordIds.filter((id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) : []
    const index = ids.indexOf(String(route.params.id))
    if (index >= 0) { previousId.value = ids[index - 1] || null; nextId.value = ids[index + 1] || null }
  } catch { /* malformed return state falls back to the default canvas */ }
}
onMounted(restoreReturnContext)
async function archive() { if (import.meta.client && window.confirm("Arsipkan usaha ini?")) await api.archive() }
async function restore() { if (import.meta.client && window.confirm("Pulihkan usaha ini?")) await api.restore() }
async function exportPdf() { await exportApi.submit("profile_pdf", defaultAnalysis, String(route.params.id)) }
function back() { router.push(backHref.value) }
function goNeighbor(id: string | null) { if (id) router.push(`/dashboard/umkm/${encodeURIComponent(id)}`) }
const currentProfile = () => profile.value
</script>
<template>
  <div class="space-y-4 pb-8">
    <nav class="flex flex-wrap items-center justify-between gap-3" aria-label="Navigasi profil">
      <button type="button" class="text-sm font-semibold underline" @click="back">← Kembali ke Analitik</button>
      <div class="flex gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm font-semibold" :disabled="!previousId" @click="goNeighbor(previousId)">UMKM sebelumnya</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm font-semibold" :disabled="!nextId" @click="goNeighbor(nextId)">UMKM berikutnya</button>
      </div>
    </nav>
    <div v-if="pending&&!currentProfile()" class="rounded-lg border p-6">Memuat profil…</div>
    <div v-else-if="error&&!currentProfile()" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">Profil tidak tersedia atau Anda tidak memiliki akses.</div>
    <template v-else-if="currentProfile()">
      <UmkmProfileHero :profile="currentProfile() as AnalyticsProfile" />
      <p class="rounded-md border bg-muted/30 p-3 text-sm">Profil PDF tersedia melalui ekspor privat setelah memilih analisis.</p>
      <UmkmProfileActions :profile="currentProfile() as AnalyticsProfile" :mutating="mutating" @archive="archive" @restore="restore" />
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm font-semibold" :disabled="exportPending" @click="exportPdf">{{ exportPending ? 'Menyiapkan PDF…' : 'Ekspor PDF profil' }}</button>
        <a v-if="exportStatus?.data.downloadUrl" class="text-sm font-semibold underline" :href="exportStatus.data.downloadUrl">Unduh PDF</a>
        <span v-if="exportStatus" class="text-xs text-muted-foreground">Status: {{ exportStatus.data.status }}</span>
      </div>
      <main class="space-y-4" aria-label="Profil UMKM"><UmkmProfileSection v-for="section in currentProfile()?.data.sections || []" :key="section.id" :section="section" /></main>
    </template>
  </div>
</template>
