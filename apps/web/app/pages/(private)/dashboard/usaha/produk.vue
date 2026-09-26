<script setup lang="ts">
import { Check, Plus, Search } from "@lucide/vue";
import { KURASI_STATUS } from "~/constants";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KurasiStatus, Produk, ProdukInput, UsahaPilihan } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Produk Katalog – Dashboard UMKM" });

const ERRORS: Record<string, string> = {
  FOTO_TIDAK_VALID: "Foto harus diunggah ulang melalui formulir ini.",
  INVALID_PAYLOAD: "Periksa kembali isian formulir (mis. tautan video harus https).",
  FORBIDDEN: "Akun ini tidak dapat mengelola produk usaha tersebut.",
};
const STEPS: { status: KurasiStatus; label: string }[] = [
  { status: "menunggu", label: "Menunggu kurasi" },
  { status: "tayang", label: "Tayang di katalog" },
  { status: "rekomendasi_marketplace", label: "Rekomendasi marketplace" },
];

const route = useRoute();
const router = useRouter();
const directus = useDirectus();

// UMKM accounts get their own business; the super admin searches for one.
const q = ref("");
const { data: usahaList, refresh: searchUsaha } = await useAsyncData("katalog:usaha", () =>
  directus.request(endpoint<UsahaPilihan[]>("/v1/program/katalog/usaha", { query: { q: q.value } })),
);
const usahaId = computed(() => {
  if (typeof route.query.usaha === "string") return route.query.usaha;
  return usahaList.value?.length === 1 && !q.value ? usahaList.value[0]!.id : null;
});
const usahaNama = computed(() => usahaList.value?.find((item) => item.id === usahaId.value)?.nama ?? null);

const { data: produkList, refresh } = await useAsyncData(
  "katalog:produk-usaha",
  () => (usahaId.value ? directus.request(endpoint<Produk[]>("/v1/program/katalog/produk", { query: { usaha: usahaId.value } })) : Promise.resolve([])),
  { watch: [usahaId] },
);

const editing = ref<Produk | null | "baru">(null);
const saving = ref(false);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function save(input: ProdukInput) {
  if (!usahaId.value) return;
  saving.value = true;
  message.value = null;
  try {
    const current = editing.value;
    if (current && current !== "baru") {
      await directus.request(endpoint<Produk, ProdukInput>(`/v1/program/katalog/produk/${current.id}`, { method: "PATCH", body: input }));
    } else {
      await directus.request(
        endpoint<Produk, ProdukInput & { usaha: string }>("/v1/program/katalog/produk", { method: "POST", body: { ...input, usaha: usahaId.value } }),
      );
    }
    editing.value = null;
    message.value = { tone: "success", text: "Produk diajukan ke kurasi DISKUK." };
    await refresh();
  } catch (cause) {
    const code = requestErrorCode(cause);
    message.value = { tone: "error", text: (code && ERRORS[code]) || "Produk tidak dapat disimpan. Coba lagi." };
  } finally {
    saving.value = false;
  }
}

function stepState(produk: Produk, step: KurasiStatus) {
  const order: KurasiStatus[] = ["menunggu", "tayang", "rekomendasi_marketplace"];
  if (produk.statusKurasi === "ditolak") return step === "menunggu" ? "done" : "todo";
  return order.indexOf(step) <= order.indexOf(produk.statusKurasi) ? "done" : "todo";
}

function pilih(id: string) {
  void router.replace({ query: { ...route.query, usaha: id } });
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Produk Katalog</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ usahaNama ? `Produk ${usahaNama}` : "Kelola produk yang tayang di Katalog UMKM Jawa Barat." }}
        </p>
      </div>
      <UiButton v-if="usahaId && editing === null" @click="editing = 'baru'"><Plus class="size-4" /> Tambah Produk</UiButton>
    </div>

    <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="rounded-md border p-3 text-sm" :class="message.tone === 'error' ? 'border-destructive/30 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">
      {{ message.text }}
    </p>

    <UiCard v-if="!usahaId">
      <UiCardHeader>
        <UiCardTitle>Pilih usaha</UiCardTitle>
        <UiCardDescription>Cari berdasarkan nama usaha atau NIB (minimal 3 karakter).</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="grid gap-3">
        <form class="flex gap-2" @submit.prevent="searchUsaha()">
          <UiInput v-model="q" type="search" placeholder="Nama usaha atau NIB" aria-label="Cari usaha" />
          <UiButton type="submit" variant="outline"><Search class="size-4" /> Cari</UiButton>
        </form>
        <ul v-if="usahaList?.length" class="divide-y text-sm">
          <li v-for="item in usahaList" :key="item.id" class="flex items-center justify-between gap-2 py-2">
            <span><span class="font-medium">{{ item.nama }}</span> <span class="text-xs text-muted-foreground">· {{ item.kota || "—" }} · NIB {{ item.nib || "—" }}</span></span>
            <UiButton size="sm" variant="outline" @click="pilih(item.id)">Kelola produk</UiButton>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <UiCard v-if="usahaId && editing !== null">
      <UiCardHeader>
        <UiCardTitle>{{ editing === "baru" ? "Produk baru" : `Ubah ${editing.nama}` }}</UiCardTitle>
      </UiCardHeader>
      <UiCardContent>
        <KatalogProdukForm :produk="editing === 'baru' ? null : editing" :pending="saving" @submit="save" @cancel="editing = null" />
      </UiCardContent>
    </UiCard>

    <template v-if="usahaId && editing === null">
      <p v-if="!produkList?.length" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada produk.</p>
      <UiCard v-for="produk in produkList" :key="produk.id">
        <UiCardContent class="grid gap-4 pt-6">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-semibold">{{ produk.nama }}</p>
              <ProgramStatusPill :meta="KURASI_STATUS[produk.statusKurasi]" />
            </div>
            <div class="flex gap-3 text-sm">
              <NuxtLink v-if="produk.statusKurasi === 'tayang' || produk.statusKurasi === 'rekomendasi_marketplace'" :to="`/katalog/${produk.id}`" class="font-semibold underline">Lihat di katalog</NuxtLink>
              <button type="button" class="font-semibold underline" @click="editing = produk">Ubah</button>
            </div>
          </div>
          <ol class="grid gap-2 sm:grid-cols-3" :aria-label="`Tahap kurasi ${produk.nama}`">
            <li v-for="step in STEPS" :key="step.status" class="flex items-center gap-2 text-xs">
              <span class="grid size-5 place-items-center rounded-full" :class="stepState(produk, step.status) === 'done' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'">
                <Check v-if="stepState(produk, step.status) === 'done'" class="size-3" />
              </span>
              {{ step.label }}
            </li>
          </ol>
          <p v-if="produk.statusKurasi === 'ditolak'" class="rounded-md bg-red-50 p-2 text-sm text-red-900">
            Ditolak kurator: {{ produk.catatanKurasi }}. Perbaiki lalu ajukan ulang.
          </p>
        </UiCardContent>
      </UiCard>
    </template>
  </div>
</template>
