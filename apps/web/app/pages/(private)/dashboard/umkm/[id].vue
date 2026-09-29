<script setup lang="ts">
import { useUmkmProfile } from "~/composables/useUmkmProfile";
import { useAnalyticsExports } from "~/composables/useAnalyticsExports";
import { defaultAnalysis } from "~/lib/analytics-query";
import type { AnalyticsProfile } from "~/types/analytics";
definePageMeta({ layout: "dashboard" });
const route = useRoute();
const router = useRouter();
const exportApi = useAnalyticsExports();
const exportPending = exportApi.pending;
const exportStatus = exportApi.status;
const api = await useUmkmProfile(String(route.params.id));
const profile = shallowRef<AnalyticsProfile | null>(api.profile.value);
const pending = ref(api.pending.value);
const error = shallowRef(api.error.value);
const mutating = ref(api.mutating.value);
const backHref = ref("/dashboard/analitik");
const previousId = ref<string | null>(null);
const nextId = ref<string | null>(null);
watch(api.profile, (value) => {
  profile.value = value;
});
watch(api.pending, (value) => {
  pending.value = value;
});
watch(api.error, (value) => {
  error.value = value;
});
watch(api.mutating, (value) => {
  mutating.value = value;
});
interface AnalyticsReturnContext {
  path?: string | undefined;
  recordIds?: string[] | undefined;
}
// Type guard: pemeriksaan typeof hanya diizinkan di dalam predikat tipe seperti ini.
function isAnalyticsReturnContext(
  value: AnalyticsReturnContext | null | undefined,
): value is AnalyticsReturnContext {
  return value !== null && value !== undefined && typeof value === "object";
}
function isDashboardAnalitikPath(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith("/dashboard/analitik");
}
const UUID_RE = /^[0-9a-f-]{36}$/i;
function restoreReturnContext() {
  try {
    const candidate =
      history.state?.analyticsReturn ||
      JSON.parse(sessionStorage.getItem("analytics:return") || "null");
    if (!isAnalyticsReturnContext(candidate)) return;
    if (isDashboardAnalitikPath(candidate.path))
      backHref.value = candidate.path;
    const ids = Array.isArray(candidate.recordIds)
      ? candidate.recordIds.filter((id) => UUID_RE.test(id))
      : [];
    const index = ids.indexOf(String(route.params.id));
    if (index >= 0) {
      previousId.value = ids[index - 1] || null;
      nextId.value = ids[index + 1] || null;
    }
  } catch {
    /* malformed return state falls back to the default canvas */
  }
}
onMounted(restoreReturnContext);
// Arsip/pulihkan melewati dialog konfirmasi (P4) sebelum mutasi dipanggil.
const konfirmasiArsip = ref<"arsipkan" | "pulihkan" | null>(null);
function archive() {
  konfirmasiArsip.value = "arsipkan";
}
function restore() {
  konfirmasiArsip.value = "pulihkan";
}
async function jalankanKonfirmasiArsip() {
  const jenis = konfirmasiArsip.value;
  if (!jenis) return;
  konfirmasiArsip.value = null;
  if (jenis === "arsipkan") await api.archive();
  else await api.restore();
}
async function exportPdf() {
  await exportApi.submit("profile_pdf", defaultAnalysis, {
    profileId: String(route.params.id),
  });
}
function back() {
  router.push(backHref.value);
}
function goNeighbor(id: string | null) {
  if (id) router.push(`/dashboard/umkm/${encodeURIComponent(id)}`);
}
const currentProfile = () => profile.value;
</script>
<template>
  <div class="space-y-4 pb-8">
    <nav
      class="flex flex-wrap items-center justify-between gap-3"
      aria-label="Navigasi profil"
    >
      <button
        type="button"
        class="text-sm font-semibold underline"
        @click="back"
      >
        ← Kembali ke Analitik
      </button>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm font-semibold"
          :disabled="!previousId"
          @click="goNeighbor(previousId)"
        >
          UMKM sebelumnya
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm font-semibold"
          :disabled="!nextId"
          @click="goNeighbor(nextId)"
        >
          UMKM berikutnya
        </button>
      </div>
    </nav>
    <div v-if="pending && !currentProfile()" class="rounded-lg border p-6">
      Memuat profil…
    </div>
    <div
      v-else-if="error && !currentProfile()"
      class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive"
    >
      Profil tidak tersedia atau Anda tidak memiliki akses.
    </div>
    <template v-else-if="currentProfile()">
      <UmkmProfileHero :profile="currentProfile() as AnalyticsProfile" />
      <p class="rounded-md border bg-muted/30 p-3 text-sm">
        Profil PDF tersedia melalui ekspor privat setelah memilih analisis.
      </p>
      <UmkmProfileActions
        :profile="currentProfile() as AnalyticsProfile"
        :mutating="mutating"
        @archive="archive"
        @restore="restore"
      />
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-sm font-semibold"
          :disabled="exportPending"
          @click="exportPdf"
        >
          {{ exportPending ? "Menyiapkan PDF…" : "Ekspor PDF profil" }}
        </button>
        <a
          v-if="exportStatus?.data.downloadUrl"
          class="text-sm font-semibold underline"
          :href="exportStatus.data.downloadUrl"
          >Unduh PDF</a
        >
        <span v-if="exportStatus" class="text-xs text-muted-foreground"
          >Status: {{ exportStatus.data.status }}</span
        >
      </div>
      <main class="space-y-4" aria-label="Profil UMKM">
        <UmkmProfileSection
          v-for="section in currentProfile()?.data.sections || []"
          :key="section.id"
          :section="section"
        />
      </main>
    </template>

    <UiDialog :open="Boolean(konfirmasiArsip)" @update:open="(value) => !value && (konfirmasiArsip = null)">
      <UiDialogContent class="max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>{{ konfirmasiArsip === "pulihkan" ? "Pulihkan usaha ini?" : "Arsipkan usaha ini?" }}</UiDialogTitle>
          <UiDialogDescription>
            {{ konfirmasiArsip === "pulihkan"
              ? "Usaha kembali tampil dalam analitik dan daftar data."
              : "Usaha yang diarsipkan keluar dari analitik dan daftar data sampai dipulihkan." }}
          </UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter class="gap-2">
          <UiButton variant="outline" @click="konfirmasiArsip = null">Batal</UiButton>
          <UiButton :variant="konfirmasiArsip === 'pulihkan' ? 'default' : 'destructive'" @click="jalankanKonfirmasiArsip">{{ konfirmasiArsip === "pulihkan" ? "Ya, pulihkan" : "Ya, arsipkan" }}</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
