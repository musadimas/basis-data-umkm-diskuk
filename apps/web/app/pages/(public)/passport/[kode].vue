<script setup lang="ts">
import { BadgeCheck, CircleAlert, ShieldCheck, ShieldX } from "@lucide/vue";
import { JENIS_LEGALITAS, PLACEHOLDER_RUBRIK, SKALA_LABEL, assetUrl } from "~/constants";
import { endpoint } from "~/lib/directus";
import { youtubeEmbed } from "~/lib/katalog";
import type { PassportVerification } from "~/types/program";

definePageMeta({ layout: "landing" });

const route = useRoute();
const kode = String(route.params.kode).toUpperCase();
const directus = useDirectus();

const { data } = await useAsyncData(`passport:${kode}`, async () => {
  try {
    return await directus.request(endpoint<PassportVerification>(`/v1/program/passport/verify/${encodeURIComponent(kode)}`));
  } catch {
    return null;
  }
});

const verified = computed(() => (data.value?.valid ? data.value : null));
useSeoMeta({
  title: () => (verified.value ? `${verified.value.passport.usaha.nama} – Talent Passport Jawa Barat` : "Verifikasi Talent Passport"),
  robots: "noindex",
});

type Tab = "profil" | "galeri" | "video" | "spesifikasi";
const TABS: { value: Tab; label: string }[] = [
  { value: "profil", label: "Profil" },
  { value: "galeri", label: "Galeri Produk" },
  { value: "video", label: "Video" },
  { value: "spesifikasi", label: "Spesifikasi Teknis" },
];
const tab = ref<Tab>("profil");

const fotos = computed(() => verified.value?.portfolio.flatMap((item) => item.foto.map((id) => ({ id, nama: item.nama }))) ?? []);
const videos = computed(() => (verified.value?.portfolio ?? []).map((item) => ({ nama: item.nama, url: item.videoUrl, embed: youtubeEmbed(item.videoUrl) })).filter((item) => item.url));
const tanggal = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-5xl px-3 pb-20 pt-28 | lg:px-12 xl:px-0">
    <div v-if="!data" class="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <CircleAlert class="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 class="text-lg font-semibold">Talent Passport tidak ditemukan</h1>
      <p class="text-sm text-muted-foreground">Periksa kembali kode <span class="font-mono">{{ kode }}</span>.</p>
    </div>

    <div v-else-if="!data.valid" role="alert" class="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center text-red-900">
      <ShieldX class="size-10" aria-hidden="true" />
      <h1 class="text-lg font-semibold">{{ data.status === "dicabut" ? "Talent Passport sudah dicabut" : "Talent Passport tidak valid" }}</h1>
      <p class="max-w-md text-sm">
        {{ data.status === "dicabut" ? "Passport dengan kode ini tidak berlaku lagi." : "Tanda tangan digital tidak cocok. Data passport ini mungkin telah diubah; jangan gunakan sebagai rujukan." }}
      </p>
    </div>

    <article v-else-if="verified" class="grid gap-8">
      <div role="status" class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck class="size-5 shrink-0" aria-hidden="true" />
        Terverifikasi: tanda tangan digital DISKUK Jawa Barat valid untuk kode <span class="font-mono font-semibold">{{ verified.kode }}</span>.
      </div>

      <header class="grid gap-2">
        <span class="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
          <BadgeCheck class="size-4" aria-hidden="true" /> {{ verified.passport.statusBadge }}
        </span>
        <h1 class="text-3xl font-bold leading-tight">{{ verified.passport.usaha.nama }}</h1>
        <p class="text-sm text-muted-foreground">
          {{ SKALA_LABEL[verified.passport.usaha.skala ?? ""] || "—" }} · {{ verified.passport.usaha.kota || "—" }}<template v-if="verified.passport.usaha.kbli"> · KBLI {{ verified.passport.usaha.kbli }}</template>
          · diterbitkan {{ tanggal(verified.passport.diterbitkanAt) }}
        </p>
      </header>

      <div role="tablist" aria-label="Portofolio" class="flex flex-wrap gap-2">
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

      <section v-if="tab === 'profil'" class="grid gap-6 md:grid-cols-2" aria-label="Profil">
        <div class="grid justify-items-center gap-2 rounded-xl border p-4">
          <ProgramRadarChart :skor="verified.passport.skor" />
          <p v-if="verified.passport.rubrikVersi === PLACEHOLDER_RUBRIK" class="text-center text-xs text-muted-foreground">Skor dihitung dengan rubrik sementara.</p>
        </div>
        <ul class="grid content-start gap-2 rounded-xl border p-4 text-sm">
          <li v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="flex items-center gap-2">
            <ShieldCheck class="size-4" :class="verified.passport.sertifikasi.includes(jenis.value) ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
            {{ jenis.label }}: {{ verified.passport.sertifikasi.includes(jenis.value) ? "Terverifikasi" : "—" }}
          </li>
          <li class="flex items-center gap-2">
            <ShieldCheck class="size-4" :class="verified.passport.pdnTerverifikasi ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
            PDN: {{ verified.passport.pdnTerverifikasi ? "Terverifikasi" : "—" }}
          </li>
        </ul>
      </section>

      <section v-else-if="tab === 'galeri'" aria-label="Galeri produk">
        <p v-if="!fotos.length" class="text-sm text-muted-foreground">Belum ada foto produk yang tayang di katalog.</p>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <img v-for="foto in fotos" :key="foto.id" :src="assetUrl(foto.id, 480)" :alt="foto.nama" class="aspect-square w-full rounded-lg object-cover" loading="lazy">
        </div>
      </section>

      <section v-else-if="tab === 'video'" aria-label="Video" class="grid gap-4">
        <p v-if="!videos.length" class="text-sm text-muted-foreground">Belum ada video storytelling.</p>
        <div v-for="video in videos" :key="video.url!" class="grid gap-2">
          <p class="text-sm font-medium">{{ video.nama }}</p>
          <div v-if="video.embed" class="aspect-video overflow-hidden rounded-xl">
            <iframe :src="video.embed" :title="`Video ${video.nama}`" class="size-full" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
          </div>
          <a v-else :href="video.url!" target="_blank" rel="noopener noreferrer" class="text-sm underline">Tonton video</a>
        </div>
      </section>

      <section v-else aria-label="Spesifikasi teknis" class="grid gap-4">
        <p v-if="!verified.portfolio.length" class="text-sm text-muted-foreground">Belum ada produk yang tayang di katalog.</p>
        <div v-for="item in verified.portfolio" :key="item.id" class="rounded-xl border p-4 text-sm">
          <NuxtLink :to="`/katalog/${item.id}`" class="font-semibold underline">{{ item.nama }}</NuxtLink>
          <dl class="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <template v-for="[label, value] in ([['Dimensi', item.dimensi], ['Berat', item.berat], ['Masa simpan', item.shelfLife], ['Kapasitas per bulan', item.kapasitasBulanan], ['Lead time', item.leadTime], ['TKDN', item.tkdnPersen === null ? null : `${Number(item.tkdnPersen)}%`], ['Bahan baku', item.bahanBaku]] as [string, string | null][])" :key="label">
              <div v-if="value" class="flex gap-2"><dt class="text-muted-foreground">{{ label }}:</dt><dd>{{ value }}</dd></div>
            </template>
          </dl>
        </div>
      </section>
    </article>
  </div>
</template>
