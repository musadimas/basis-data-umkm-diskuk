<script setup lang="ts">
import { BadgeCheck, Download, Search, ShieldCheck } from "@lucide/vue";
import QRCode from "qrcode";
import { JENIS_LEGALITAS, PLACEHOLDER_RUBRIK, SKALA_LABEL } from "~/constants";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { Passport, PassportDetail, UsahaPilihan } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Talent Passport – Dashboard UMKM" });

const route = useRoute();
const router = useRouter();
const directus = useDirectus();

// UMKM accounts get their own business; the super admin searches for one.
const q = ref("");
const { data: usahaList, refresh: searchUsaha } = await useAsyncData("passport:usaha", () =>
  directus.request(endpoint<UsahaPilihan[]>("/v1/program/katalog/usaha", { query: { q: q.value } })),
);
const usahaId = computed(() => {
  if (typeof route.query.usaha === "string") return route.query.usaha;
  return usahaList.value?.length === 1 && !q.value ? usahaList.value[0]!.id : null;
});

const { data, refresh } = await useAsyncData(
  "passport:detail",
  () => (usahaId.value ? directus.request(endpoint<PassportDetail>("/v1/program/passport", { query: { usaha: usahaId.value } })) : Promise.resolve(null)),
  { watch: [usahaId] },
);
const passport = computed(() => data.value?.passport ?? null);

const verifyUrl = computed(() => (passport.value && import.meta.client ? `${window.location.origin}/passport/${passport.value.kode}` : ""));
const qr = ref("");
watch(
  verifyUrl,
  async (url) => {
    qr.value = url ? await QRCode.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: "M" }) : "";
  },
  { immediate: true },
);

const busy = ref(false);
const message = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function terbitkan() {
  if (!usahaId.value) return;
  if (passport.value && !window.confirm("Terbitkan ulang? Passport lama akan dicabut dan QR lama tidak berlaku lagi.")) return;
  busy.value = true;
  message.value = null;
  try {
    const issued = await directus.request(endpoint<Passport, { usaha: string }>("/v1/program/passport", { method: "POST", body: { usaha: usahaId.value } }));
    message.value = { tone: "success", text: `Talent Passport ${issued.kode} diterbitkan.` };
    await refresh();
  } catch (cause) {
    message.value = {
      tone: "error",
      text: requestErrorCode(cause) === "PASSPORT_BELUM_MEMENUHI" ? (data.value?.alasan ?? "Usaha belum memenuhi syarat.") : "Passport tidak dapat diterbitkan. Coba lagi.",
    };
  } finally {
    busy.value = false;
  }
}

async function cabut() {
  if (!passport.value || !window.confirm(`Cabut Talent Passport ${passport.value.kode}?`)) return;
  busy.value = true;
  try {
    await directus.request(endpoint<Passport>(`/v1/program/passport/${passport.value.id}/cabut`, { method: "POST" }));
    message.value = { tone: "success", text: "Talent Passport dicabut." };
    await refresh();
  } finally {
    busy.value = false;
  }
}

function pilih(id: string) {
  void router.replace({ query: { ...route.query, usaha: id } });
}
const tanggal = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Talent Passport</h1>
      <p class="mt-1 text-sm text-muted-foreground">Identitas digital bertanda tangan untuk usaha Talent Jawa Barat, dapat diverifikasi lewat QR.</p>
    </div>

    <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="rounded-md border p-3 text-sm" :class="message.tone === 'error' ? 'border-destructive/30 text-destructive' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">{{ message.text }}</p>

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
            <span><span class="font-medium">{{ item.nama }}</span> <span class="text-xs text-muted-foreground">· {{ item.kota || "—" }}</span></span>
            <UiButton size="sm" variant="outline" @click="pilih(item.id)">Buka passport</UiButton>
          </li>
        </ul>
      </UiCardContent>
    </UiCard>

    <template v-else-if="data">
      <UiCard v-if="!passport">
        <UiCardHeader>
          <UiCardTitle>{{ data.usaha.nama }}</UiCardTitle>
          <UiCardDescription>{{ data.eligible ? "Usaha memenuhi syarat untuk Talent Passport." : data.alasan }}</UiCardDescription>
        </UiCardHeader>
        <UiCardContent v-if="data.bisaMenerbitkan">
          <UiButton :disabled="busy || !data.eligible" @click="terbitkan">Terbitkan Talent Passport</UiButton>
        </UiCardContent>
      </UiCard>

      <template v-else>
        <section class="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-700 p-6 text-white shadow-lg" aria-label="Kartu identitas Talent Passport">
          <div class="flex flex-wrap items-start justify-between gap-6">
            <div class="grid gap-3">
              <p class="text-xs uppercase tracking-[0.2em] text-white/70">Talent Passport · Jawa Barat</p>
              <h2 class="text-2xl font-bold leading-tight">{{ passport.payload.usaha.nama }}</h2>
              <p class="text-sm text-white/80">
                {{ SKALA_LABEL[passport.payload.usaha.skala ?? ""] || "—" }} · {{ passport.payload.usaha.kota || "—" }}<template v-if="passport.payload.usaha.kbli"> · KBLI {{ passport.payload.usaha.kbli }}</template>
              </p>
              <span class="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
                <BadgeCheck class="size-4" /> {{ passport.statusBadge }}
              </span>
              <p class="font-mono text-lg tracking-widest" data-testid="passport-kode">{{ passport.kode }}</p>
              <p class="text-xs text-white/70">Diterbitkan {{ tanggal(passport.diterbitkanAt) }}</p>
            </div>
            <div class="grid justify-items-center gap-2">
              <img v-if="qr" :src="qr" :alt="`QR verifikasi ${passport.kode}`" class="size-36 rounded-lg bg-white p-2">
              <a v-if="qr" :href="qr" :download="`talent-passport-${passport.kode}.png`" class="inline-flex items-center gap-1 text-xs font-semibold underline">
                <Download class="size-3" /> Unduh QR (PNG)
              </a>
            </div>
          </div>
        </section>

        <div class="grid gap-6 md:grid-cols-2">
          <UiCard>
            <UiCardHeader>
              <UiCardTitle>Radar Kapabilitas</UiCardTitle>
              <UiCardDescription v-if="passport.payload.rubrikVersi === PLACEHOLDER_RUBRIK">Dihitung dengan rubrik sementara sampai rubrik resmi DISKUK tersedia.</UiCardDescription>
            </UiCardHeader>
            <UiCardContent class="flex justify-center">
              <ProgramRadarChart :skor="passport.skor" />
            </UiCardContent>
          </UiCard>
          <UiCard>
            <UiCardHeader><UiCardTitle>Kepatuhan</UiCardTitle></UiCardHeader>
            <UiCardContent>
              <ul class="grid gap-2 text-sm">
                <li v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="flex items-center gap-2">
                  <ShieldCheck class="size-4" :class="passport.payload.sertifikasi.includes(jenis.value) ? 'text-emerald-600' : 'text-muted-foreground/40'" />
                  <span :class="!passport.payload.sertifikasi.includes(jenis.value) && 'text-muted-foreground'">{{ jenis.label }}</span>
                </li>
                <li class="flex items-center gap-2">
                  <ShieldCheck class="size-4" :class="passport.payload.pdnTerverifikasi ? 'text-emerald-600' : 'text-muted-foreground/40'" /> PDN terverifikasi
                </li>
              </ul>
            </UiCardContent>
          </UiCard>
        </div>

        <div class="flex flex-wrap gap-3">
          <UiButton as-child variant="outline"><NuxtLink :to="`/passport/${passport.kode}`">Lihat halaman publik</NuxtLink></UiButton>
          <template v-if="data.bisaMenerbitkan">
            <UiButton variant="outline" :disabled="busy" @click="terbitkan">Terbitkan ulang</UiButton>
            <UiButton variant="destructive" :disabled="busy" @click="cabut">Cabut passport</UiButton>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>
