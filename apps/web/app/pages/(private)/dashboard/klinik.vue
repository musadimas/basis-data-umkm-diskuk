<script setup lang="ts">
import { ArrowRight, LayoutGrid, List, Paperclip, Video } from "@lucide/vue";
import { KLINIK_ASPEK, KLINIK_PRIORITAS, KLINIK_RUJUKAN, KLINIK_STATUS, assetUrl } from "~/constants";
import { useAuth } from "~/composables/useAuth";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KlinikAspek, KlinikPrioritas, KlinikRujukan, KlinikStatus, KlinikTiket } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Klinik Konsultasi – Dashboard UMKM" });

const directus = useDirectus();
const auth = useAuth();
const view = ref<"kanban" | "list">("kanban");

const { data: tiket, error, refresh } = await useAsyncData("klinik:tiket", () =>
  directus.request(endpoint<KlinikTiket[]>("/v1/program/klinik/tiket")),
);
const byStatus = computed(() =>
  Object.fromEntries(KLINIK_STATUS.map(({ value }) => [value, (tiket.value ?? []).filter((item) => item.status === value)])) as Record<KlinikStatus, KlinikTiket[]>,
);

// ── Detail sheet ────────────────────────────────────────────────────────────
const active = ref<KlinikTiket | null>(null);
const draft = reactive({
  status: "masuk" as KlinikStatus,
  prioritas: "normal" as KlinikPrioritas,
  linkMeet: "",
  diagnosis: {} as Partial<Record<KlinikAspek, string>>,
  actionPlan: "",
  rujukan: [] as KlinikRujukan[],
  catatan: "",
});
const saving = ref(false);
const sheetError = ref("");

function open(item: KlinikTiket) {
  active.value = item;
  sheetError.value = "";
  Object.assign(draft, {
    status: item.status,
    prioritas: item.prioritas,
    linkMeet: item.linkMeet ?? "",
    diagnosis: { ...item.diagnosis },
    actionPlan: item.actionPlan ?? "",
    rujukan: [...item.rujukan],
    catatan: item.catatan ?? "",
  });
}

async function patch(id: string, body: Record<string, unknown>) {
  const updated = await directus.request(endpoint<KlinikTiket, Record<string, unknown>>(`/v1/program/klinik/tiket/${id}`, { method: "PATCH", body }));
  await refresh();
  return updated;
}

async function simpan() {
  if (!active.value) return;
  saving.value = true;
  sheetError.value = "";
  try {
    active.value = await patch(active.value.id, {
      status: draft.status,
      prioritas: draft.prioritas,
      linkMeet: draft.linkMeet.trim() || null,
      diagnosis: Object.fromEntries(Object.entries(draft.diagnosis).map(([key, value]) => [key, value?.trim() || null])),
      actionPlan: draft.actionPlan.trim() || null,
      rujukan: draft.rujukan,
      catatan: draft.catatan.trim() || null,
    });
  } catch (cause) {
    sheetError.value = requestErrorCode(cause) === "INVALID_PAYLOAD" ? "Periksa isian (tautan rapat harus https)." : "Perubahan tidak dapat disimpan.";
  } finally {
    saving.value = false;
  }
}

async function ambil() {
  if (!active.value || !auth.user.value?.id) return;
  active.value = await patch(active.value.id, { pendamping: auth.user.value.id });
}

async function maju(item: KlinikTiket) {
  const index = KLINIK_STATUS.findIndex(({ value }) => value === item.status);
  const next = KLINIK_STATUS[index + 1];
  if (next) await patch(item.id, { status: next.value });
}

function toggleRujukan(value: KlinikRujukan) {
  draft.rujukan = draft.rujukan.includes(value) ? draft.rujukan.filter((item) => item !== value) : [...draft.rujukan, value];
}

const tanggal = (value: string) => new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
</script>

<template>
  <div class="flex w-full flex-col gap-6 pb-10">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Klinik Konsultasi</h1>
        <p class="mt-1 text-sm text-muted-foreground">Tiket dari formulir publik, diurutkan menurut prioritas dan jadwal.</p>
      </div>
      <div class="flex rounded-md border p-0.5" role="group" aria-label="Tampilan">
        <button type="button" class="inline-flex items-center gap-1 rounded px-2 py-1 text-sm" :class="view === 'kanban' && 'bg-muted font-semibold'" :aria-pressed="view === 'kanban'" @click="view = 'kanban'"><LayoutGrid class="size-4" /> Kanban</button>
        <button type="button" class="inline-flex items-center gap-1 rounded px-2 py-1 text-sm" :class="view === 'list' && 'bg-muted font-semibold'" :aria-pressed="view === 'list'" @click="view = 'list'"><List class="size-4" /> Daftar</button>
      </div>
    </div>

    <div v-if="error" role="alert" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">Tiket tidak dapat dimuat.</div>

    <div v-else-if="view === 'kanban'" class="grid auto-cols-[16rem] grid-flow-col gap-3 overflow-x-auto pb-2">
      <section v-for="column in KLINIK_STATUS" :key="column.value" class="grid content-start gap-2 rounded-xl bg-muted/50 p-2" :aria-label="column.label" :data-testid="`kolom-${column.value}`">
        <h2 class="px-1 text-sm font-bold">{{ column.label }} <span class="text-muted-foreground">({{ byStatus[column.value].length }})</span></h2>
        <article v-for="item in byStatus[column.value]" :key="item.id" class="grid gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs">{{ item.nomor }}</span>
            <ProgramStatusPill :meta="KLINIK_PRIORITAS[item.prioritas]" />
          </div>
          <button type="button" class="text-left font-semibold leading-snug hover:underline" @click="open(item)">{{ item.namaUsaha }}</button>
          <p class="text-xs text-muted-foreground">{{ item.poliNama }}</p>
          <p class="text-xs">{{ tanggal(item.jadwalTanggal) }} · {{ item.jadwalSlot }} · {{ item.moda === "daring" ? "Daring" : "Luring" }}</p>
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">{{ item.pendampingNama || "Belum ada pendamping" }}</span>
            <button v-if="column.value !== 'selesai'" type="button" class="rounded p-1 hover:bg-muted" :aria-label="`Pindahkan ${item.nomor} ke tahap berikutnya`" @click="maju(item)"><ArrowRight class="size-4" /></button>
          </div>
        </article>
      </section>
    </div>

    <UiCard v-else>
      <UiCardContent class="overflow-x-auto p-0">
        <table class="w-full min-w-[48rem] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th class="px-4 py-3">Tiket</th><th class="px-4 py-3">Usaha</th><th class="px-4 py-3">Poli</th><th class="px-4 py-3">Jadwal</th><th class="px-4 py-3">Prioritas</th><th class="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in tiket ?? []" :key="item.id" class="cursor-pointer border-b last:border-0 hover:bg-muted/30" @click="open(item)">
              <td class="px-4 py-3 font-mono text-xs">{{ item.nomor }}</td>
              <td class="px-4 py-3 font-medium">{{ item.namaUsaha }}</td>
              <td class="px-4 py-3">{{ item.poliNama }}</td>
              <td class="px-4 py-3">{{ tanggal(item.jadwalTanggal) }} · {{ item.jadwalSlot }}</td>
              <td class="px-4 py-3"><ProgramStatusPill :meta="KLINIK_PRIORITAS[item.prioritas]" /></td>
              <td class="px-4 py-3">{{ KLINIK_STATUS.find((status) => status.value === item.status)?.label }}</td>
            </tr>
          </tbody>
        </table>
      </UiCardContent>
    </UiCard>

    <UiSheet :open="Boolean(active)" @update:open="(value) => !value && (active = null)">
      <UiSheetContent v-if="active" class="w-full overflow-y-auto sm:max-w-xl">
        <UiSheetHeader>
          <UiSheetTitle>{{ active.namaUsaha }}</UiSheetTitle>
          <UiSheetDescription>{{ active.nomor }} · {{ active.poliNama }}</UiSheetDescription>
        </UiSheetHeader>
        <div class="grid gap-5 px-4 pb-6 text-sm">
          <dl class="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
            <div><dt class="text-xs text-muted-foreground">Narahubung</dt><dd>{{ active.namaKontak }} · <a :href="`https://wa.me/${active.whatsapp.replace(/^0/, '62').replace(/\D/g, '')}`" target="_blank" rel="noopener noreferrer" class="underline">{{ active.whatsapp }}</a></dd></div>
            <div><dt class="text-xs text-muted-foreground">Jadwal</dt><dd>{{ tanggal(active.jadwalTanggal) }} · {{ active.jadwalSlot }} WIB · {{ active.moda === "daring" ? "Daring" : "Luring" }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Permasalahan</dt><dd class="whitespace-pre-line">{{ active.deskripsi }}</dd></div>
            <div v-if="active.lampiran.length" class="sm:col-span-2">
              <dt class="text-xs text-muted-foreground">Lampiran</dt>
              <dd class="flex flex-wrap gap-2 pt-1">
                <a v-for="(id, index) in active.lampiran" :key="id" :href="assetUrl(id)" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 underline"><Paperclip class="size-3" /> Lampiran {{ index + 1 }}</a>
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap items-center gap-3">
            <span>Pendamping: <strong>{{ active.pendampingNama || "belum ada" }}</strong></span>
            <UiButton v-if="active.pendamping !== auth.user.value?.id" size="sm" variant="outline" @click="ambil">Ambil tiket ini</UiButton>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1"><span class="font-medium">Status</span>
              <select v-model="draft.status" name="status" class="h-9 rounded-md border border-input bg-transparent px-2">
                <option v-for="item in KLINIK_STATUS" :key="item.value" :value="item.value">{{ item.label }}</option>
                <option value="batal">Batal</option>
              </select>
            </label>
            <label class="grid gap-1"><span class="font-medium">Prioritas</span>
              <select v-model="draft.prioritas" name="prioritas" class="h-9 rounded-md border border-input bg-transparent px-2">
                <option v-for="(meta, key) in KLINIK_PRIORITAS" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </label>
          </div>

          <UiField class="gap-1">
            <UiFieldLabel for="link-meet">Tautan rapat daring</UiFieldLabel>
            <div class="flex gap-2">
              <UiInput id="link-meet" v-model="draft.linkMeet" type="url" placeholder="https://" />
              <UiButton v-if="active.linkMeet" as-child size="sm" variant="outline"><a :href="active.linkMeet" target="_blank" rel="noopener noreferrer"><Video class="size-4" /> Buka</a></UiButton>
            </div>
          </UiField>

          <fieldset class="grid gap-2">
            <legend class="mb-1 font-bold">Notulensi sesi: diagnosis per aspek</legend>
            <UiField v-for="aspek in KLINIK_ASPEK" :key="aspek.value" class="gap-1">
              <UiFieldLabel :for="`diagnosis-${aspek.value}`">{{ aspek.label }}</UiFieldLabel>
              <UiTextarea :id="`diagnosis-${aspek.value}`" v-model="draft.diagnosis[aspek.value]" rows="2" maxlength="2000" />
            </UiField>
          </fieldset>
          <UiField class="gap-1"><UiFieldLabel for="action-plan">Rencana aksi</UiFieldLabel><UiTextarea id="action-plan" v-model="draft.actionPlan" rows="3" maxlength="5000" /></UiField>

          <div class="grid gap-2">
            <span class="font-bold">Rujukan</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="item in KLINIK_RUJUKAN"
                :key="item.value"
                type="button"
                :aria-pressed="draft.rujukan.includes(item.value)"
                class="rounded-full border px-3 py-1.5 text-xs font-medium"
                :class="draft.rujukan.includes(item.value) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                @click="toggleRujukan(item.value)"
              >{{ item.label }}</button>
            </div>
          </div>
          <UiField class="gap-1"><UiFieldLabel for="catatan-klinik">Catatan internal</UiFieldLabel><UiTextarea id="catatan-klinik" v-model="draft.catatan" rows="2" maxlength="5000" /></UiField>

          <p v-if="sheetError" role="alert" class="text-destructive">{{ sheetError }}</p>
          <UiButton :disabled="saving" @click="simpan">{{ saving ? "Menyimpan…" : "Simpan" }}</UiButton>
        </div>
      </UiSheetContent>
    </UiSheet>
  </div>
</template>
