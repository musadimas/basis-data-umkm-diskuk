<script setup lang="ts">
import { Check, Plus, Search } from "@lucide/vue";
import { KURASI_STATUS } from "~/constants";
import { KURASI_TAHAP, KatalogError, isTayang, katalogApi, kurasiLabel, tahapKurasiSelesai } from "~/lib/katalog";
import { isQueryString } from "~/lib/utils";
import type { Produk, ProdukInput } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Produk Katalog – Dashboard UMKM" });

const STEPS = KURASI_TAHAP.map((status) => ({ status, label: kurasiLabel(status) }));

const route = useRoute();
const router = useRouter();
const api = katalogApi(useDirectus());

// UMKM accounts get their own business; the Admin Provinsi searches for one.
const q = ref("");
const { data: usahaList, refresh: searchUsaha } = await useAsyncData("katalog:usaha", () =>
  api.cariUsaha(q.value),
);
const usahaId = computed(() => {
  if (isQueryString(route.query.usaha)) return route.query.usaha;
  const daftar = Array.isArray(usahaList.value) ? usahaList.value : [];
  return daftar.length === 1 && !q.value ? daftar[0]!.id : null;
});
const usahaNama = computed(() => (Array.isArray(usahaList.value) ? usahaList.value : []).find((item) => item.id === usahaId.value)?.nama ?? null);

const { data: produkList, refresh } = await useAsyncData(
  "katalog:produk-usaha",
  () => (usahaId.value ? api.produkUsaha(usahaId.value) : Promise.resolve([])),
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
    await api.simpanProduk(usahaId.value, input, current && current !== "baru" ? current.id : undefined);
    editing.value = null;
    message.value = { tone: "success", text: "Produk diajukan ke kurasi DISKUK." };
    await refresh();
  } catch (cause) {
    message.value = { tone: "error", text: cause instanceof KatalogError ? cause.pesan : "Produk tidak dapat disimpan. Coba lagi." };
  } finally {
    saving.value = false;
  }
}

const stepState = (produk: Produk, step: Produk["statusKurasi"]) => (tahapKurasiSelesai(produk.statusKurasi, step) ? "done" : "todo");

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
              <NuxtLink v-if="isTayang(produk.statusKurasi)" :to="`/katalog/${produk.id}`" class="font-semibold underline">Lihat di katalog</NuxtLink>
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
