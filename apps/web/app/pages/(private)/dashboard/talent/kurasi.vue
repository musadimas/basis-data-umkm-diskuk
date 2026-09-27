<script setup lang="ts">
import { FileCheck2 } from "@lucide/vue";
import { PENGAJUAN_STATUS, PLACEHOLDER_RUBRIK, SKALA_LABEL, SKOR_DIMENSI } from "~/constants";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { BeritaAcara, PengajuanStatus, TalentPengajuan, TalentPengajuanListItem } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Talent Scouting – Dashboard UMKM" });

const TABS: { value: PengajuanStatus; label: string }[] = [
  { value: "dinilai", label: "Siap dikurasi" },
  { value: "draft", label: "Draft" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
];

const directus = useDirectus();
const tab = ref<PengajuanStatus>("dinilai");
const selected = ref<string[]>([]);

const { data: items, pending, error, refresh } = await useAsyncData(
  "talent:pengajuan",
  () => directus.request(endpoint<TalentPengajuanListItem[]>("/v1/program/talent/pengajuan", { query: { status: tab.value } })),
  { watch: [tab] },
);
const { data: beritaAcara, refresh: refreshBeritaAcara } = await useAsyncData("talent:berita-acara", () =>
  directus.request(endpoint<BeritaAcara[]>("/v1/program/talent/berita-acara")),
);

watch(tab, () => (selected.value = []));

const rows = computed(() => items.value ?? []);
const allSelected = computed(() => rows.value.length > 0 && selected.value.length === rows.value.length);
const usesPlaceholder = computed(() => rows.value.some((row) => row.skor?.rubrikVersi === PLACEHOLDER_RUBRIK));

function toggleAll(value: boolean | "indeterminate") {
  selected.value = value === true ? rows.value.map((row) => row.id) : [];
}
function toggle(id: string, value: boolean | "indeterminate") {
  selected.value = value === true ? [...new Set([...selected.value, id])] : selected.value.filter((item) => item !== id);
}

const dialogOpen = ref(false);
const catatan = ref("");
const issuing = ref(false);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function terbitkan() {
  issuing.value = true;
  message.value = null;
  try {
    const created = await directus.request(
      endpoint<BeritaAcara, { pengajuan: string[]; catatan: string | null }>("/v1/program/talent/berita-acara", {
        method: "POST",
        body: { pengajuan: selected.value, catatan: catatan.value.trim() || null },
      }),
    );
    message.value = {
      tone: "success",
      text: `Berita Acara ${created.nomor} terbit. ${created.jumlahPengajuan} usaha masuk Talent Pool.`,
    };
    dialogOpen.value = false;
    catatan.value = "";
    selected.value = [];
    await Promise.all([refresh(), refreshBeritaAcara()]);
  } catch (cause) {
    const code = requestErrorCode(cause);
    message.value = {
      tone: "error",
      text:
        code === "PENGAJUAN_BELUM_DINILAI"
          ? "Sebagian pengajuan belum dinilai atau sudah diputuskan. Muat ulang daftar."
          : "Berita Acara tidak dapat diterbitkan. Coba lagi.",
    };
  } finally {
    issuing.value = false;
  }
}

const rejecting = ref<string | null>(null);
async function tolak(row: TalentPengajuanListItem) {
  const reason = window.prompt(`Alasan menolak ${row.usahaInfo.nama}?`);
  if (reason === null) return;
  rejecting.value = row.id;
  message.value = null;
  try {
    await directus.request(
      endpoint<TalentPengajuan, { catatan: string | null }>(`/v1/program/talent/pengajuan/${row.id}/tolak`, {
        method: "POST",
        body: { catatan: reason.trim() || null },
      }),
    );
    await refresh();
  } catch {
    message.value = { tone: "error", text: "Pengajuan tidak dapat ditolak. Coba lagi." };
  } finally {
    rejecting.value = null;
  }
}

const score = (value: number | undefined) =>
  value === undefined ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
</script>

<template>
  <div class="flex w-full flex-col gap-6 pb-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Kurasi Talent Scouting</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Pilih pengajuan yang sudah dinilai, lalu terbitkan Berita Acara untuk memasukkannya ke Talent Pool.
        </p>
      </div>
      <UiButton v-if="tab === 'dinilai'" :disabled="selected.length === 0" @click="dialogOpen = true">
        <FileCheck2 class="size-4" />
        Terbitkan Berita Acara &amp; Masukkan ke Talent Pool ({{ selected.length }})
      </UiButton>
    </div>

    <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="rounded-md border p-3 text-sm" :class="message.tone === 'error' ? 'border-destructive/30 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">
      {{ message.text }}
    </p>
    <p v-if="usesPlaceholder" class="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      Skor di bawah dihitung dengan rubrik sementara. Rubrik resmi dari DISKUK belum tersedia.
    </p>

    <div role="tablist" aria-label="Status pengajuan" class="flex flex-wrap gap-2">
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="tab === item.value"
        class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="tab === item.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
        @click="tab = item.value"
      >{{ item.label }}</button>
    </div>

    <UiCard>
      <UiCardContent class="overflow-x-auto p-0">
        <div v-if="error" role="alert" class="p-6 text-sm text-destructive">Daftar pengajuan tidak dapat dimuat.</div>
        <div v-else-if="pending && !rows.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
        <div v-else-if="!rows.length" class="p-6 text-sm text-muted-foreground">Belum ada pengajuan dengan status ini.</div>
        <table v-else class="w-full min-w-[56rem] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th v-if="tab === 'dinilai'" class="w-10 px-4 py-3">
                <UiCheckbox :model-value="allSelected" aria-label="Pilih semua" @update:model-value="toggleAll" />
              </th>
              <th class="px-4 py-3">Usaha</th>
              <th class="px-4 py-3">Wilayah</th>
              <th v-for="dim in SKOR_DIMENSI" :key="dim.key" class="px-3 py-3 text-right">{{ dim.label }}</th>
              <th class="px-4 py-3 text-right">Total</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b last:border-0">
              <td v-if="tab === 'dinilai'" class="px-4 py-3">
                <UiCheckbox :model-value="selected.includes(row.id)" :aria-label="`Pilih ${row.usahaInfo.nama}`" @update:model-value="(value) => toggle(row.id, value)" />
              </td>
              <td class="px-4 py-3">
                <p class="font-medium">{{ row.usahaInfo.nama }}</p>
                <p class="text-xs text-muted-foreground">{{ SKALA_LABEL[row.usahaInfo.skala ?? ""] || "—" }} · NIB {{ row.usahaInfo.nib || "—" }}</p>
              </td>
              <td class="px-4 py-3">{{ row.usahaInfo.kota || "—" }}</td>
              <td v-for="dim in SKOR_DIMENSI" :key="dim.key" class="px-3 py-3 text-right tabular-nums">{{ score(row.skor?.[dim.key]) }}</td>
              <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ score(row.skor?.total) }}</td>
              <td class="px-4 py-3"><ProgramStatusPill :meta="PENGAJUAN_STATUS[row.status]" /></td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3 whitespace-nowrap">
                  <NuxtLink :to="`/dashboard/talent/ajukan/${row.usaha}`" class="font-semibold underline">Detail</NuxtLink>
                  <button
                    v-if="row.status === 'dinilai' || row.status === 'draft'"
                    type="button"
                    class="font-semibold text-destructive underline disabled:opacity-50"
                    :disabled="rejecting === row.id"
                    @click="tolak(row)"
                  >Tolak</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Berita Acara</UiCardTitle>
      </UiCardHeader>
      <UiCardContent>
        <p v-if="!beritaAcara?.length" class="text-sm text-muted-foreground">Belum ada Berita Acara.</p>
        <ul v-else class="divide-y text-sm">
          <li v-for="item in beritaAcara" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <span class="font-mono font-semibold">{{ item.nomor }}</span>
            <span class="text-muted-foreground">{{ date(item.tanggal) }} · {{ item.jumlahPengajuan }} usaha</span>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <UiDialog v-model:open="dialogOpen">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>Terbitkan Berita Acara</UiDialogTitle>
          <UiDialogDescription>
            {{ selected.length }} pengajuan akan disetujui dan usahanya masuk Talent Pool. Tindakan ini tidak dapat dibatalkan dari dashboard.
          </UiDialogDescription>
        </UiDialogHeader>
        <UiField class="gap-2">
          <UiFieldLabel for="ba-catatan">Catatan (opsional)</UiFieldLabel>
          <UiTextarea id="ba-catatan" v-model="catatan" maxlength="2000" rows="3" />
        </UiField>
        <UiDialogFooter>
          <UiButton variant="outline" :disabled="issuing" @click="dialogOpen = false">Batal</UiButton>
          <UiButton :disabled="issuing" @click="terbitkan">{{ issuing ? "Menerbitkan…" : "Terbitkan" }}</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
