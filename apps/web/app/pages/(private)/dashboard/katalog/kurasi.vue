<script setup lang="ts">
import { KATEGORI_PRODUK, KURASI_STATUS, LOI_STATUS } from "~/constants";
import { KURASI_ANTREAN, KatalogError, katalogApi, katalogFotoUrl, kurasiLabel, type KurasiKeputusan } from "~/lib/katalog";
import type { KurasiStatus, Produk, ProdukLoi } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kurasi Katalog – Dashboard UMKM" });

type Tab = KurasiStatus | "loi";
const TABS: { value: Tab; label: string }[] = [
  ...KURASI_ANTREAN.map((value) => ({ value, label: kurasiLabel(value) })),
  { value: "loi", label: "Letter of Intent" },
];
type Keputusan = KurasiKeputusan;

const api = katalogApi(useDirectus());
const tab = ref<Tab>("menunggu");

const { data: produk, pending, error, refresh } = await useAsyncData<Produk[]>(
  "katalog:kurasi",
  () => (tab.value === "loi" ? Promise.resolve<Produk[]>([]) : api.antreanKurasi(tab.value)),
  { watch: [tab] },
);
const { data: loi, pending: loiPending, error: loiError, refresh: refreshLoi } = await useAsyncData(
  "katalog:loi",
  () => (tab.value === "loi" ? api.daftarLoi() : Promise.resolve(null)),
  { watch: [tab] },
);

const preview = ref<Produk | null>(null);
const catatan = ref("");
const deciding = ref<Keputusan | null>(null);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);
const dialogError = ref("");
/** Status produk yang sedang ditinjau; `null` saat dialog tertutup. */
const statusPreview = computed(() => preview.value?.statusKurasi ?? null);
/** `ditolak` read-only: catatan kurasi hanya dibaca, keputusan baru menunggu pemilik mengubah produk. */
const bisaUbah = computed(() => statusPreview.value !== null && statusPreview.value !== "ditolak");

function open(item: Produk) {
  preview.value = item;
  catatan.value = item.catatanKurasi ?? "";
  dialogError.value = "";
}

async function decide(keputusan: Keputusan) {
  // R6: kunci sibuk diklaim sebelum await pertama supaya klik ganda hanya mengirim satu permintaan.
  if (!preview.value || deciding.value) return;
  dialogError.value = "";
  deciding.value = keputusan;
  try {
    const decided = await api.putuskanKurasi(preview.value.id, keputusan, catatan.value);
    message.value = { tone: "success", text: `${decided.nama}: ${kurasiLabel(decided.statusKurasi)}.` };
    preview.value = null;
    await refresh();
  } catch (cause) {
    // R4: dialog tetap terbuka dengan pesan inline; antrean basi dimuat ulang.
    dialogError.value = cause instanceof KatalogError ? cause.pesan : "Keputusan tidak dapat disimpan. Coba lagi.";
    if (cause instanceof KatalogError && cause.code === "TRANSISI_KURASI_TIDAK_VALID") await refresh();
  } finally {
    deciding.value = null;
  }
}

const loiTarget = ref<ProdukLoi | null>(null);
const loiBusy = ref(false);
const loiDialogError = ref("");

function bukaLoi(item: ProdukLoi) {
  loiTarget.value = item;
  loiDialogError.value = "";
}

async function ubahLoi(status: "ditindaklanjuti" | "ditutup") {
  // R6: sama seperti `deciding`, sibuk diklaim sebelum await pertama.
  if (!loiTarget.value || loiBusy.value) return;
  loiBusy.value = true;
  loiDialogError.value = "";
  try {
    const id = loiTarget.value.id;
    await api.ubahStatusLoi(id, status);
    await refreshLoi();
    loiTarget.value = loi.value?.find((item) => item.id === id) ?? null;
    message.value = { tone: "success", text: `LOI ${LOI_STATUS[status].label.toLowerCase()}.` };
  } catch (cause) {
    // R4: dialog tetap terbuka; status yang sudah berubah memuat ulang daftarnya.
    loiDialogError.value = cause instanceof KatalogError ? cause.pesan : "Status LOI tidak dapat disimpan. Coba lagi.";
    if (cause instanceof KatalogError && cause.code === "TRANSISI_LOI_TIDAK_VALID") await refreshLoi();
  } finally {
    loiBusy.value = false;
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
          <div v-if="loiError" role="alert" class="p-6 text-sm text-destructive">Letter of Intent tidak dapat dimuat.</div>
          <div v-else-if="loiPending && !loi?.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
          <p v-else-if="!loi?.length" class="p-6 text-sm text-muted-foreground">Belum ada Letter of Intent.</p>
          <ul v-else class="divide-y">
            <li v-for="item in loi" :key="item.id" class="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
              <div class="min-w-0 flex-1">
                <p class="font-medium">{{ item.nama }}<template v-if="item.instansi"> · {{ item.instansi }}</template></p>
                <p class="text-xs text-muted-foreground">{{ item.produkNama }} ({{ item.usahaNama }}) · {{ date(item.dateCreated) }}</p>
              </div>
              <ProgramStatusPill :meta="LOI_STATUS[item.status]" />
              <button type="button" class="font-semibold underline" @click="bukaLoi(item)">Detail</button>
            </li>
          </ul>
        </template>
        <div v-else-if="error" role="alert" class="p-6 text-sm text-destructive">Antrean kurasi tidak dapat dimuat.</div>
        <div v-else-if="pending && !produk?.length" class="p-6 text-sm text-muted-foreground">Memuat…</div>
        <div v-else-if="!produk?.length" class="p-6 text-sm text-muted-foreground">Tidak ada produk dengan status ini.</div>
        <ul v-else class="divide-y">
          <li v-for="item in produk" :key="item.id" class="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
            <img v-if="item.foto[0]" :src="katalogFotoUrl(item.foto[0])" alt="" class="size-12 rounded object-cover">
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
            <img v-for="id in preview.foto" :key="id" :src="katalogFotoUrl(id)" alt="" class="size-28 shrink-0 rounded-md object-cover">
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
          <UiField v-if="bisaUbah" class="gap-1">
            <UiFieldLabel for="catatan-kurasi">Catatan kurasi</UiFieldLabel>
            <UiTextarea id="catatan-kurasi" v-model="catatan" rows="2" maxlength="2000" placeholder="Wajib diisi bila menolak atau menurunkan" />
          </UiField>
          <div v-else class="rounded-md bg-muted/40 p-3">
            <p class="text-xs text-muted-foreground">Catatan kurasi</p>
            <p class="whitespace-pre-line">{{ preview.catatanKurasi || "—" }}</p>
            <p class="mt-2 text-xs text-muted-foreground">Produk kembali ke antrean setelah pelaku usaha mengubahnya.</p>
          </div>
          <p v-if="dialogError" role="alert" class="text-destructive">{{ dialogError }}</p>
        </div>
        <UiDialogFooter>
          <template v-if="statusPreview === 'menunggu'">
            <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">Tolak</UiButton>
            <UiButton variant="outline" :disabled="Boolean(deciding)" @click="decide('rekomendasi_marketplace')">Rekomendasikan ke Marketplace</UiButton>
            <UiButton :disabled="Boolean(deciding)" @click="decide('tayang')">Tayangkan</UiButton>
          </template>
          <template v-else-if="statusPreview === 'tayang' || statusPreview === 'rekomendasi_marketplace'">
            <UiButton variant="destructive" :disabled="Boolean(deciding)" @click="decide('ditolak')">Turunkan</UiButton>
            <UiButton v-if="statusPreview === 'tayang'" variant="outline" :disabled="Boolean(deciding)" @click="decide('rekomendasi_marketplace')">Rekomendasikan ke Marketplace</UiButton>
            <UiButton as-child variant="outline">
              <NuxtLink :to="`/katalog/${preview.id}`" target="_blank">Lihat di katalog</NuxtLink>
            </UiButton>
          </template>
          <UiButton v-else variant="outline" @click="preview = null">Tutup</UiButton>
        </UiDialogFooter>
      </UiDialogScrollContent>
    </UiDialog>

    <UiDialog :open="Boolean(loiTarget)" @update:open="(value) => !value && !loiBusy && (loiTarget = null)">
      <UiDialogContent v-if="loiTarget" class="sm:max-w-lg" :show-close-button="!loiBusy">
        <UiDialogHeader>
          <UiDialogTitle class="pr-6">LOI dari {{ loiTarget.nama }}</UiDialogTitle>
          <UiDialogDescription>{{ loiTarget.instansi || "Perorangan" }} · {{ date(loiTarget.dateCreated) }}</UiDialogDescription>
        </UiDialogHeader>
        <dl class="grid gap-2 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">Produk</dt>
            <dd>
              <NuxtLink :to="`/katalog/${loiTarget.produk}`" target="_blank" class="underline">{{ loiTarget.produkNama }}</NuxtLink>
              · {{ loiTarget.usahaNama || "—" }}
            </dd>
          </div>
          <div><dt class="text-xs text-muted-foreground">Perkiraan jumlah</dt><dd>{{ loiTarget.jumlah || "—" }}</dd></div>
          <div><dt class="text-xs text-muted-foreground">Pesan</dt><dd class="whitespace-pre-line">{{ loiTarget.pesan }}</dd></div>
          <div>
            <dt class="text-xs text-muted-foreground">Kontak</dt>
            <dd v-if="loiTarget.persetujuanKontak" class="flex flex-wrap gap-3">
              <a :href="`mailto:${loiTarget.email}`" class="underline">{{ loiTarget.email }}</a>
              <a v-if="loiTarget.telepon" :href="`tel:${loiTarget.telepon}`" class="underline">{{ loiTarget.telepon }}</a>
            </dd>
            <dd v-else class="text-muted-foreground">Pengirim tidak menyetujui kontaknya dibagikan.</dd>
          </div>
          <div><dt class="text-xs text-muted-foreground">Status</dt><dd><ProgramStatusPill :meta="LOI_STATUS[loiTarget.status]" /></dd></div>
        </dl>
        <p v-if="loiDialogError" role="alert" class="text-sm text-destructive">{{ loiDialogError }}</p>
        <UiDialogFooter>
          <UiButton v-if="loiTarget.status === 'baru'" variant="outline" :disabled="loiBusy" @click="ubahLoi('ditindaklanjuti')">{{ loiBusy ? "Memproses…" : "Tandai ditindaklanjuti" }}</UiButton>
          <UiButton v-if="loiTarget.status !== 'ditutup'" :disabled="loiBusy" @click="ubahLoi('ditutup')">{{ loiBusy ? "Memproses…" : "Tutup LOI" }}</UiButton>
          <UiButton v-else variant="outline" @click="loiTarget = null">Tutup</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
