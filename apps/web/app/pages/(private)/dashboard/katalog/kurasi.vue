<script setup lang="ts">
import { KATEGORI_PRODUK, KURASI_STATUS, assetUrl } from "~/constants";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KurasiStatus, Produk, ProdukLoi } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Katalog – Dashboard UMKM" });

type Tab = KurasiStatus | "loi";
const TABS: { value: Tab; label: string }[] = [
  { value: "menunggu", label: "Menunggu kurasi" },
  { value: "tayang", label: "Tayang" },
  { value: "rekomendasi_marketplace", label: "Rekomendasi" },
  { value: "ditolak", label: "Ditolak" },
  { value: "loi", label: "Letter of Intent" },
];
type Keputusan = "tayang" | "rekomendasi_marketplace" | "ditolak";

const directus = useDirectus();
const tab = ref<Tab>("menunggu");

const { data: produk, pending, error, refresh } = await useAsyncData(
  "katalog:kurasi",
  () => (tab.value === "loi" ? Promise.resolve([] as Produk[]) : directus.request(endpoint<Produk[]>("/v1/program/katalog/kurasi", { query: { status: tab.value } }))),
  { watch: [tab] },
);
const { data: loi } = await useAsyncData(
  "katalog:loi",
  () => (tab.value === "loi" ? directus.request(endpoint<ProdukLoi[]>("/v1/program/katalog/loi")) : Promise.resolve(null)),
  { watch: [tab] },
);

const preview = ref<Produk | null>(null);
const catatan = ref("");
const deciding = ref<Keputusan | null>(null);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);
const dialogError = ref("");

function open(item: Produk) {
  preview.value = item;
  catatan.value = item.catatanKurasi ?? "";
  dialogError.value = "";
}

async function decide(keputusan: Keputusan) {
  if (!preview.value) return;
  dialogError.value = "";
  if (keputusan === "ditolak" && !catatan.value.trim()) {
    dialogError.value = "Tulis alasan penolakan untuk pelaku usaha.";
    return;
  }
  deciding.value = keputusan;
  try {
    const decided = await directus.request(
      endpoint<Produk, { keputusan: Keputusan; catatan: string | null }>(`/v1/program/katalog/produk/${preview.value.id}/kurasi`, {
        method: "POST",
        body: { keputusan, catatan: catatan.value.trim() || null },
      }),
    );
    message.value = { tone: "success", text: `${decided.nama}: ${KURASI_STATUS[decided.statusKurasi].label}.` };
    preview.value = null;
    await refresh();
  } catch (cause) {
    dialogError.value = requestErrorCode(cause) === "CATATAN_WAJIB" ? "Tulis alasan penolakan." : "Keputusan tidak dapat disimpan. Coba lagi.";
  } finally {
    deciding.value = null;
  }
}

const rupiah = (value: number | null) => (value === null ? "—" : `Rp${new Intl.NumberFormat("id-ID").format(value)}`);
const date = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
</script>

<template>
  <div class="flex w-full flex-col gap-6 pb-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Kurasi Katalog</h1>
      <p class="mt-1 text-sm text-muted-foreground">Tinjau produk sebelum tayang di katalog publik.</p>
    </div>

    <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{{ message.text }}</p>

    <div role="tablist" aria-label="Status kurasi" class="flex flex-wrap gap-2">
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
        <template v-if="tab === 'loi'">
          <p v-if="!loi?.length" class="p-6 text-sm text-muted-foreground">Belum ada Letter of Intent.</p>
          <ul v-else class="divide-y text-sm">
            <li v-for="item in loi" :key="item.id" class="grid gap-1 px-4 py-3">
              <p><span class="font-semibold">{{ item.nama }}</span><template v-if="item.instansi"> · {{ item.instansi }}</template> → {{ item.produkNama }} ({{ item.usahaNama }})</p>
              <p class="text-xs text-muted-foreground">{{ date(item.dateCreated) }} · {{ item.email }}<template v-if="item.telepon"> · {{ item.telepon }}</template><template v-if="item.jumlah"> · {{ item.jumlah }}</template></p>
              <p class="whitespace-pre-line">{{ item.pesan }}</p>
            </li>
          </ul>
        </template>
        <div v-else-if="error" role="alert" class="p-6 text-sm text-destructive">Antrean kurasi tidak dapat dimuat.</div>
        <div v-else-if="pending && !produk?.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
        <div v-else-if="!produk?.length" class="p-6 text-sm text-muted-foreground">Tidak ada produk dengan status ini.</div>
        <ul v-else class="divide-y">
          <li v-for="item in produk" :key="item.id" class="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
            <img v-if="item.foto[0]" :src="assetUrl(item.foto[0], 96)" alt="" class="size-12 rounded object-cover">
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ item.nama }}</p>
              <p class="text-xs text-muted-foreground">{{ item.usahaNama }} · {{ item.usahaKota || "—" }} · diperbarui {{ date(item.dateUpdated) }}</p>
            </div>
            <ProgramStatusPill :meta="KURASI_STATUS[item.statusKurasi]" />
            <button type="button" class="font-semibold underline" @click="open(item)">{{ item.statusKurasi === "menunggu" ? "Kurasi" : "Lihat" }}</button>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <UiDialog :open="Boolean(preview)" @update:open="(value) => !value && (preview = null)">
      <UiDialogScrollContent v-if="preview" class="sm:max-w-2xl">
        <UiDialogHeader>
          <UiDialogTitle>{{ preview.nama }}</UiDialogTitle>
          <UiDialogDescription>{{ preview.usahaNama }} · {{ KATEGORI_PRODUK.find((item) => item.value === preview?.kategori)?.label || "Tanpa kategori" }}</UiDialogDescription>
        </UiDialogHeader>
        <div class="grid gap-4 text-sm">
          <div class="flex gap-2 overflow-x-auto">
            <img v-for="id in preview.foto" :key="id" :src="assetUrl(id, 240)" alt="" class="size-28 shrink-0 rounded-md object-cover">
          </div>
          <p v-if="preview.deskripsi" class="whitespace-pre-line">{{ preview.deskripsi }}</p>
          <dl class="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
            <div><dt class="text-xs text-muted-foreground">Harga retail</dt><dd>{{ rupiah(preview.hargaRetail) }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Harga grosir</dt><dd>{{ rupiah(preview.hargaGrosir) }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">MOQ</dt><dd>{{ preview.moq ?? "—" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">TKDN</dt><dd>{{ preview.tkdnPersen ?? "—" }}%</dd></div>
            <div><dt class="text-xs text-muted-foreground">Deklarasi PDN</dt><dd>{{ preview.pdnDeklarasi ? "Ya" : "Tidak" }}</dd></div>
            <div><dt class="text-xs text-muted-foreground">Video</dt><dd class="truncate">{{ preview.videoUrl || "—" }}</dd></div>
          </dl>
          <UiField class="gap-1">
            <UiFieldLabel for="catatan-kurasi">Catatan kurasi</UiFieldLabel>
            <UiTextarea id="catatan-kurasi" v-model="catatan" rows="2" maxlength="2000" placeholder="Wajib diisi bila menolak" />
          </UiField>
          <p v-if="dialogError" role="alert" class="text-destructive">{{ dialogError }}</p>
        </div>
        <UiDialogFooter class="gap-2">
          <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">Tolak</UiButton>
          <UiButton variant="outline" :disabled="Boolean(deciding)" @click="decide('rekomendasi_marketplace')">Rekomendasikan ke Marketplace</UiButton>
          <UiButton :disabled="Boolean(deciding)" @click="decide('tayang')">Tayangkan</UiButton>
        </UiDialogFooter>
      </UiDialogScrollContent>
    </UiDialog>
  </div>
</template>
