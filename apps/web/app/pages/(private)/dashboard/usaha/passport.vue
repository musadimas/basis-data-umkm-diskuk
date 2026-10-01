<script setup lang="ts">
import { BadgeCheck, Download, FileDown, LoaderCircle, Search, ShieldCheck } from "@lucide/vue";
import QRCode from "qrcode";
import { JENIS_LEGALITAS, PLACEHOLDER_RUBRIK, SKALA_LABEL } from "~/constants";
import { endpoint } from "~/lib/directus";
import { qrPdfDataUrl } from "~/lib/qr-pdf";
import { requestErrorCode } from "~/lib/request-error";
import { isQueryString } from "~/lib/utils";
import type { Passport, PassportBadge, PassportDetail, UsahaPilihan } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Talent Passport – Dashboard UMKM" });

const route = useRoute();
const router = useRouter();
const directus = useDirectus();

// UMKM accounts get their own business; the Admin Provinsi searches for one.
const q = ref("");
const { data: usahaList, refresh: searchUsaha } = await useAsyncData("passport:usaha", () =>
  directus.request(endpoint<UsahaPilihan[]>("/v1/program/katalog/usaha", { query: { q: q.value } })),
);
const usahaId = computed(() => {
  if (isQueryString(route.query.usaha)) return route.query.usaha;
  const daftar = Array.isArray(usahaList.value) ? usahaList.value : [];
  return daftar.length === 1 && !q.value ? daftar[0]!.id : null;
});

const { data, refresh } = await useAsyncData(
  "passport:detail",
  () => (usahaId.value ? directus.request(endpoint<PassportDetail>("/v1/program/passport", { query: { usaha: usahaId.value } })) : Promise.resolve(null)),
  { watch: [usahaId] },
);
const passport = computed(() => data.value?.passport ?? null);

// Badges from the signed payload; passports issued before the badges field fall back to a
// derived list, so "terverifikasi" is never shown for something nobody recorded.
const badges = computed<PassportBadge[]>(() => {
  if (!passport.value) return [];
  if (passport.value.payload.badges?.length) return passport.value.payload.badges;
  const fallback: PassportBadge[] = [];
  if (passport.value.payload.pdnTerverifikasi) {
    fallback.push({ key: "pdn", label: "100% Produk Dalam Negeri (PDN)", terverifikasi: true, sumber: "Diverifikasi dinas" });
  }
  for (const jenis of passport.value.payload.sertifikasi) {
    fallback.push({ key: `legalitas_${jenis}`, label: JENIS_LEGALITAS.find((item) => item.value === jenis)?.label ?? jenis, terverifikasi: true, sumber: "Tercatat dinas" });
  }
  return fallback;
});

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
  if (!passport.value) return;
  busy.value = true;
  message.value = null;
  try {
    await directus.request(endpoint<Passport>(`/v1/program/passport/${passport.value.id}/cabut`, { method: "POST" }));
    message.value = { tone: "success", text: "Talent Passport dicabut." };
    await refresh();
  } catch {
    message.value = { tone: "error", text: "Talent Passport tidak dapat dicabut. Coba lagi." };
  } finally {
    busy.value = false;
  }
}

// Terbitkan ulang & cabut melewati dialog konfirmasi karena efeknya pada QR lama (P4).
const konfirmasi = ref<"terbitkan" | "cabut" | null>(null);
async function jalankanKonfirmasi() {
  const jenis = konfirmasi.value;
  if (!jenis) return;
  konfirmasi.value = null;
  if (jenis === "terbitkan") await terbitkan();
  else await cabut();
}

function pilih(id: string) {
  void router.replace({ query: { ...route.query, usaha: id } });
}

/** Unduh sertifikat QR sebagai PDF: QR digambar ke canvas lalu dibungkus PDF tanpa dependensi. */
async function unduhPdf() {
  if (!qr.value || !passport.value) return;
  const gambar = new Image();
  await new Promise((resolve, reject) => {
    gambar.onload = resolve;
    gambar.onerror = reject;
    gambar.src = qr.value;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(gambar, 0, 0);
  const pdf = await qrPdfDataUrl(canvas, {
    kode: passport.value.kode,
    url: verifyUrl.value,
    nama: passport.value.payload.usaha.nama,
    diterbitkanAt: passport.value.diterbitkanAt,
  });
  const tautan = document.createElement("a");
  tautan.href = pdf;
  tautan.download = `talent-passport-${passport.value.kode}.pdf`;
  tautan.click();
}

const downloadingDoc = ref<"summary" | "katalog" | null>(null);

async function unduhDokumen(jenis: "summary" | "katalog") {
  if (!usahaId.value) return;
  downloadingDoc.value = jenis;
  try {
    const response = await directus.request(
      endpoint<Response>(`/v1/program/passport/pdf/${jenis}`, {
        query: { usaha: usahaId.value },
      }),
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = jenis === "summary"
      ? `executive-summary-${passport.value?.kode ?? "usaha"}.pdf`
      : `katalog-ekspor-${passport.value?.kode ?? "usaha"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    message.value = {
      tone: "error",
      text: `Gagal mengunduh dokumen ${jenis === "summary" ? "Executive Summary" : "Katalog Ekspor"}.`,
    };
  } finally {
    downloadingDoc.value = null;
  }
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
        <ul v-if="Array.isArray(usahaList) && usahaList.length" class="divide-y text-sm">
          <li v-for="item in (usahaList as UsahaPilihan[])" :key="item.id" class="flex items-center justify-between gap-2 py-2">
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
              <div v-if="qr" class="flex gap-3 text-xs font-semibold underline">
                <a :href="qr" :download="`talent-passport-${passport.kode}.png`" class="inline-flex items-center gap-1"><Download class="size-3" /> Unduh QR (PNG)</a>
                <UiButton type="button" variant="link" class="h-auto gap-1 p-0 text-xs font-semibold text-white" data-testid="unduh-qr-pdf" @click="unduhPdf"><FileDown class="size-3" /> Unduh QR (PDF)</UiButton>
              </div>
            </div>
          </div>
        </section>

        <div class="grid gap-6 md:grid-cols-2">
          <UiCard>
            <UiCardHeader>
              <UiCardTitle>Radar Kapabilitas</UiCardTitle>
              <UiCardDescription v-if="passport.payload.rubrikVersi === PLACEHOLDER_RUBRIK">Dihitung dengan rubrik sementara sampai rubrik resmi DISKUK tersedia.</UiCardDescription>
            </UiCardHeader>
            <UiCardContent class="grid gap-3">
              <div class="flex justify-center"><ProgramRadarChart :skor="passport.skor" /></div>
              <ul v-if="passport.payload.sumberSkor?.length" class="grid gap-1 text-xs text-muted-foreground" aria-label="Sumber skor">
                <li v-for="item in passport.payload.sumberSkor" :key="item.dimensi">
                  <span class="font-medium capitalize">{{ item.dimensi }}:</span> {{ item.sumber }}
                </li>
              </ul>
            </UiCardContent>
          </UiCard>
          <UiCard>
            <UiCardHeader><UiCardTitle>Badge & Kepatuhan</UiCardTitle></UiCardHeader>
            <UiCardContent>
              <ul class="grid gap-2 text-sm">
                <li v-for="badge in badges" :key="badge.key" class="flex flex-wrap items-center gap-2" :data-testid="`badge-${badge.key}`" :data-terverifikasi="String(badge.terverifikasi)">
                  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="badge.terverifikasi ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'">
                    <ShieldCheck v-if="badge.terverifikasi" class="size-3.5" />
                    {{ badge.terverifikasi ? "Terverifikasi" : "Deklarasi" }}
                  </span>
                  <span>{{ badge.label }}</span>
                  <span class="w-full text-xs text-muted-foreground">{{ badge.sumber }}</span>
                </li>
              </ul>
            </UiCardContent>
          </UiCard>
        </div>

        <div class="flex flex-wrap gap-3">
          <UiButton as-child variant="outline"><NuxtLink :to="`/passport/${passport.kode}`">Lihat halaman publik</NuxtLink></UiButton>
          <UiButton variant="outline" :disabled="downloadingDoc !== null" @click="unduhDokumen('summary')">
            <LoaderCircle v-if="downloadingDoc === 'summary'" class="mr-2 size-4 animate-spin" />
            <FileDown v-else class="mr-2 size-4" />
            Unduh Executive Summary & Business Scorecard (PDF)
          </UiButton>
          <UiButton variant="outline" :disabled="downloadingDoc !== null" @click="unduhDokumen('katalog')">
            <LoaderCircle v-if="downloadingDoc === 'katalog'" class="mr-2 size-4 animate-spin" />
            <FileDown v-else class="mr-2 size-4" />
            Unduh Katalog Ekspor Resmi (PDF)
          </UiButton>
          <template v-if="data.bisaMenerbitkan">
            <UiButton variant="outline" :disabled="busy" @click="konfirmasi = 'terbitkan'">Terbitkan ulang</UiButton>
            <UiButton variant="destructive" :disabled="busy" @click="konfirmasi = 'cabut'">Cabut passport</UiButton>
          </template>
        </div>
      </template>
    </template>

    <UiDialog :open="Boolean(konfirmasi)" @update:open="(value) => !value && (konfirmasi = null)">
      <UiDialogContent class="max-w-md">
        <UiDialogHeader>
          <UiDialogTitle>{{ konfirmasi === "cabut" ? "Cabut Talent Passport?" : "Terbitkan ulang Talent Passport?" }}</UiDialogTitle>
          <UiDialogDescription>
            {{ konfirmasi === "cabut"
              ? "Passport tidak dapat diverifikasi lagi dan QR-nya menjadi tidak berlaku."
              : "Passport lama akan dicabut dan QR lama tidak berlaku lagi." }}
          </UiDialogDescription>
        </UiDialogHeader>
        <UiDialogFooter class="gap-2">
          <UiButton variant="outline" @click="konfirmasi = null">Batal</UiButton>
          <UiButton :variant="konfirmasi === 'cabut' ? 'destructive' : 'default'" @click="jalankanKonfirmasi">{{ konfirmasi === "cabut" ? "Ya, cabut" : "Ya, terbitkan ulang" }}</UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
