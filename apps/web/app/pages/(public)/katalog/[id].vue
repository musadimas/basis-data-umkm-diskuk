<script setup lang="ts">
import { readItem, readSingleton } from "@directus/sdk";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Package, ShieldCheck } from "@lucide/vue";
import { JENIS_LEGALITAS, KATEGORI_PRODUK, SKALA_LABEL, TALENT_BADGE_STATUS, assetUrl } from "~/constants";
import { endpoint } from "~/lib/directus";
import { hargaRange, sertifikasiList, whatsappLink, youtubeEmbed } from "~/lib/katalog";
import { requestErrorCode } from "~/lib/request-error";
import type { KontakHotline, ProdukPublik } from "~/types/program";

definePageMeta({ layout: "landing" });

const route = useRoute();
const id = String(route.params.id);
const directus = useDirectus();

const DETAIL_FIELDS = [
  "id", "nama", "deskripsi", "kategori", "kbli", "harga_retail", "harga_grosir", "moq", "video_url", "dimensi", "berat",
  "shelf_life", "bahan_baku", "tkdn_persen", "kapasitas_bulanan", "lead_time", "persen_bahan_lokal", "pdn_deklarasi",
  "status_kurasi", "usaha_nama", "usaha_skala", "usaha_talent_status", "usaha_pdn", "usaha_ramah_disabilitas",
  "usaha_whatsapp", "usaha_kota_nama", "usaha_sertifikasi", "foto.directus_files_id",
];

// Unpublished or unknown products are simply not readable by the Public policy (403).
const { data: produk } = await useAsyncData(`katalog:${id}`, async () => {
  try {
    // SAFETY: see the catalogue list page; the SDK cannot type the junction path `foto.directus_files_id`.
    const item = await directus.request(readItem("produk", id, { fields: DETAIL_FIELDS, deep: { foto: { _sort: ["sort"] } } } as never));
    return item && typeof item === "object" && "id" in item ? (item as ProdukPublik) : null;
  } catch {
    return null;
  }
});

// Official sales contact (DISKUK hotline), shown next to the business's own WhatsApp.
const { data: kontak } = await useAsyncData("katalog:kontak", async () => {
  try {
    const item = await directus.request(readSingleton("kontak_hotline"));
    return item && typeof item === "object" && "nama_layanan" in item ? (item as KontakHotline) : null;
  } catch {
    return null;
  }
});

useSeoMeta({
  title: () => (produk.value ? `${produk.value.nama} – Katalog UMKM Jawa Barat` : "Produk tidak ditemukan – Katalog UMKM"),
  description: () => produk.value?.deskripsi?.slice(0, 160) ?? undefined,
});

const fotos = computed(() => (produk.value?.foto ?? []).map((item) => item.directus_files_id));
const video = computed(() => youtubeEmbed(produk.value?.video_url));
const sertifikasi = computed(() => sertifikasiList(produk.value?.usaha_sertifikasi));
const talent = computed(() => TALENT_BADGE_STATUS.some((status) => status === produk.value?.usaha_talent_status));
const wa = computed(() =>
  produk.value
    ? whatsappLink(produk.value.usaha_whatsapp, `Halo ${produk.value.usaha_nama ?? ""}, saya tertarik dengan produk "${produk.value.nama}" di Katalog UMKM Jawa Barat.`)
    : null,
);
const specs = computed(() => {
  const p = produk.value;
  if (!p) return [];
  const persen = (value: number | string | null) => (value === null ? null : `${Number(value).toLocaleString("id-ID")}%`);
  return [
    ["Kategori", KATEGORI_PRODUK.find((item) => item.value === p.kategori)?.label],
    ["KBLI", p.kbli],
    ["Harga", hargaRange(p)],
    ["Minimum order (MOQ)", p.moq ? new Intl.NumberFormat("id-ID").format(p.moq) : null],
    ["Dimensi", p.dimensi],
    ["Berat", p.berat],
    ["Masa simpan", p.shelf_life],
    ["Bahan baku", p.bahan_baku],
    ["TKDN", persen(p.tkdn_persen)],
    ["Bahan baku lokal", persen(p.persen_bahan_lokal)],
    ["Kapasitas per bulan", p.kapasitas_bulanan],
    ["Lead time", p.lead_time],
  ].filter((row): row is [string, string] => Boolean(row[1]));
});

const active = ref(0);

// ── Letter of intent ────────────────────────────────────────────────────────
const loi = reactive({ nama: "", instansi: "", email: "", telepon: "", jumlah: "", pesan: "" });
const captcha = useTemplateRef<{ solve: () => Promise<string | null>; reset: () => void }>("captcha");
const sending = ref(false);
const loiMessage = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function kirimLoi() {
  loiMessage.value = null;
  if (!loi.nama.trim() || !loi.email.trim() || !loi.pesan.trim()) {
    loiMessage.value = { tone: "error", text: "Nama, email, dan pesan wajib diisi." };
    return;
  }
  sending.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      loiMessage.value = { tone: "error", text: "Verifikasi captcha belum selesai." };
      return;
    }
    await directus.request(
      endpoint<{ diterima: boolean }, Record<string, string | null>>("/v1/program/katalog/loi", {
        method: "POST",
        body: {
          produk: id,
          nama: loi.nama.trim(),
          instansi: loi.instansi.trim() || null,
          email: loi.email.trim(),
          telepon: loi.telepon.trim() || null,
          jumlah: loi.jumlah.trim() || null,
          pesan: loi.pesan.trim(),
          captcha: token,
        },
      }),
    );
    Object.assign(loi, { nama: "", instansi: "", email: "", telepon: "", jumlah: "", pesan: "" });
    loiMessage.value = { tone: "success", text: "Letter of Intent terkirim. Tim DISKUK akan menghubungi Anda melalui email." };
  } catch (cause) {
    const code = requestErrorCode(cause);
    loiMessage.value = {
      tone: "error",
      text: code === "CAPTCHA_INVALID" ? "Captcha kedaluwarsa. Centang ulang lalu kirim." : "Letter of Intent tidak dapat dikirim. Periksa isian lalu coba lagi.",
    };
  } finally {
    captcha.value?.reset();
    sending.value = false;
  }
}
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-6xl px-3 pb-20 pt-28 | lg:px-12 xl:px-0">
    <NuxtLink to="/katalog" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft class="size-4" /> Kembali ke Katalog
    </NuxtLink>

    <div v-if="!produk" class="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <Package class="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 class="text-lg font-semibold">Produk tidak ditemukan</h1>
      <p class="text-sm text-muted-foreground">Produk ini belum tayang atau sudah tidak tersedia di katalog.</p>
    </div>

    <article v-else class="mt-6 grid gap-10 | lg:grid-cols-2">
      <section aria-label="Galeri produk" class="grid gap-3">
        <figure class="relative aspect-square overflow-hidden rounded-xl bg-muted">
          <img v-if="fotos[active]" :src="assetUrl(fotos[active]!, 900)" :alt="`${produk.nama} – foto ${active + 1}`" class="size-full object-cover">
          <Package v-else class="absolute inset-0 m-auto size-12 text-muted-foreground" aria-hidden="true" />
        </figure>
        <div v-if="fotos.length > 1" class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Pilih foto">
          <button
            v-for="(foto, index) in fotos"
            :key="foto"
            type="button"
            role="tab"
            :aria-selected="index === active"
            :aria-label="`Foto ${index + 1}`"
            class="size-16 shrink-0 overflow-hidden rounded-md border-2"
            :class="index === active ? 'border-primary' : 'border-transparent'"
            @click="active = index"
          >
            <img :src="assetUrl(foto, 128)" alt="" class="size-full object-cover">
          </button>
        </div>
        <div v-if="video" class="aspect-video overflow-hidden rounded-xl">
          <iframe :src="video" :title="`Video ${produk.nama}`" class="size-full" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" />
        </div>
        <a v-else-if="produk.video_url" :href="produk.video_url" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold underline">Tonton video produk</a>
      </section>

      <section class="grid content-start gap-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">
            {{ produk.usaha_nama }}<template v-if="produk.usaha_skala"> · {{ SKALA_LABEL[produk.usaha_skala] }}</template>
          </p>
          <h1 class="mt-1 text-2xl font-bold leading-tight">{{ produk.nama }}</h1>
          <p v-if="produk.usaha_kota_nama" class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin class="size-4" aria-hidden="true" /> {{ produk.usaha_kota_nama }}
          </p>
          <p v-if="hargaRange(produk)" class="mt-3 text-xl font-semibold">{{ hargaRange(produk) }}</p>
          <p v-if="produk.moq" class="text-sm text-muted-foreground">Minimum order {{ new Intl.NumberFormat("id-ID").format(produk.moq) }}</p>
        </div>

        <p v-if="produk.deskripsi" class="whitespace-pre-line text-sm leading-relaxed">{{ produk.deskripsi }}</p>

        <a v-if="wa" :href="wa" target="_blank" rel="noopener noreferrer" class="inline-flex w-fit items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
          <MessageCircle class="size-4" aria-hidden="true" /> Hubungi via WhatsApp
        </a>

        <div class="rounded-xl border p-4" aria-label="Status legalitas">
          <h2 class="flex items-center gap-2 text-sm font-bold"><ShieldCheck class="size-4" aria-hidden="true" /> Legalitas &amp; Kepatuhan</h2>
          <ul class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li v-for="jenis in JENIS_LEGALITAS" :key="jenis.value" class="flex items-center gap-2">
              <BadgeCheck class="size-4" :class="sertifikasi.includes(jenis.value) ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
              <span :class="!sertifikasi.includes(jenis.value) && 'text-muted-foreground'">{{ jenis.label }}: {{ sertifikasi.includes(jenis.value) ? "Terverifikasi" : "Belum ada" }}</span>
            </li>
            <li class="flex items-center gap-2">
              <BadgeCheck class="size-4" :class="produk.usaha_pdn || produk.pdn_deklarasi ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
              PDN: {{ produk.usaha_pdn ? "Terverifikasi" : produk.pdn_deklarasi ? "Deklarasi mandiri" : "Belum ada" }}
            </li>
            <li v-if="talent" class="flex items-center gap-2"><BadgeCheck class="size-4 text-amber-500" aria-hidden="true" /> Talent Jawa Barat</li>
            <li v-if="produk.usaha_ramah_disabilitas" class="flex items-center gap-2"><BadgeCheck class="size-4 text-sky-600" aria-hidden="true" /> Ramah disabilitas</li>
          </ul>
        </div>

        <div v-if="specs.length">
          <h2 class="text-sm font-bold">Spesifikasi Teknis</h2>
          <dl class="mt-2 divide-y rounded-xl border text-sm">
            <div v-for="[label, value] in specs" :key="label" class="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2">
              <dt class="text-muted-foreground">{{ label }}</dt>
              <dd class="whitespace-pre-line">{{ value }}</dd>
            </div>
          </dl>
        </div>

        <ProgramHotlineCard v-if="kontak" :kontak="kontak" :pesan="`Halo DISKUK, saya ingin bertanya tentang produk ${produk.nama} di Katalog UMKM.`" />

        <form class="grid gap-3 rounded-xl border bg-muted/30 p-4" novalidate aria-labelledby="loi-title" @submit.prevent="kirimLoi">
          <div>
            <h2 id="loi-title" class="text-sm font-bold">Ajukan Letter of Intent (LOI)</h2>
            <p class="text-xs text-muted-foreground">Untuk pembelian partai besar. Tim DISKUK meneruskan LOI ke pelaku usaha.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UiField class="gap-1"><UiFieldLabel for="loi-nama">Nama</UiFieldLabel><UiInput id="loi-nama" v-model="loi.nama" maxlength="120" autocomplete="name" required /></UiField>
            <UiField class="gap-1"><UiFieldLabel for="loi-instansi">Perusahaan / instansi</UiFieldLabel><UiInput id="loi-instansi" v-model="loi.instansi" maxlength="160" autocomplete="organization" /></UiField>
            <UiField class="gap-1"><UiFieldLabel for="loi-email">Email</UiFieldLabel><UiInput id="loi-email" v-model="loi.email" type="email" maxlength="160" autocomplete="email" required /></UiField>
            <UiField class="gap-1"><UiFieldLabel for="loi-telepon">Telepon</UiFieldLabel><UiInput id="loi-telepon" v-model="loi.telepon" type="tel" maxlength="32" autocomplete="tel" /></UiField>
          </div>
          <UiField class="gap-1"><UiFieldLabel for="loi-jumlah">Perkiraan jumlah pesanan</UiFieldLabel><UiInput id="loi-jumlah" v-model="loi.jumlah" maxlength="100" placeholder="mis. 1.000 pcs per bulan" /></UiField>
          <UiField class="gap-1"><UiFieldLabel for="loi-pesan">Pesan</UiFieldLabel><UiTextarea id="loi-pesan" v-model="loi.pesan" rows="3" maxlength="2000" required /></UiField>
          <AuthCaptcha ref="captcha" />
          <p v-if="loiMessage" :role="loiMessage.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="loiMessage.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">{{ loiMessage.text }}</p>
          <UiButton type="submit" :disabled="sending" class="w-fit">{{ sending ? "Mengirim…" : "Kirim LOI" }}</UiButton>
        </form>
      </section>
    </article>
  </div>
</template>
