<script setup lang="ts">
import { readItem } from "@directus/sdk";
import { ArrowLeft, BadgeCheck, Download, FileText, MapPin, MessageCircle, Package, ShieldCheck } from "@lucide/vue";
import { JENIS_LEGALITAS, SKALA_LABEL, TALENT_STATUS, assetUrl } from "~/constants";
import { BELUM_TERSEDIA, KatalogError, katalogApi, kontakPenjualan, hargaRange, sertifikasiList, specPdfUrl, teksAtauBelum, usahaLegalitas, youtubeEmbed } from "~/lib/katalog";
import type { ProdukPublik } from "~/types/program";

definePageMeta({ layout: "landing" });

const route = useRoute();
const id = String(route.params.id);
const directus = useDirectus();

const DETAIL_FIELDS = [
  "id", "nama", "deskripsi", "kategori", "kbli", "harga_retail", "harga_grosir", "moq", "video_url", "dimensi", "berat",
  "shelf_life", "bahan_baku", "tkdn_persen", "kapasitas_bulanan", "lead_time", "persen_bahan_lokal", "pdn_deklarasi",
  "status_kurasi", "usaha_nama", "usaha_skala", "usaha_talent_status", "usaha_pdn", "usaha_ramah_disabilitas",
  "usaha_whatsapp", "usaha_kota_nama", "usaha_sertifikasi", "usaha_nib", "usaha_legalitas", "foto.directus_files_id",
];

// Unpublished or unknown products are simply not readable by the Public policy (403).
/** Produk valid adalah objek apa pun dari readItem yang membawa `id`; nilai lain dianggap tidak ada. */
function isProdukPublik<T extends object>(value: T | null | undefined): value is T & ProdukPublik {
  return value !== null && value !== undefined && "id" in value;
}

const { data: produk } = await useAsyncData(`katalog:${id}`, async () => {
  try {
    // SAFETY: see the catalogue list page; the SDK cannot type the junction path `foto.directus_files_id`.
    const item = await directus.request(readItem("produk", id, { fields: DETAIL_FIELDS, deep: { foto: { _sort: ["sort"] } } } as never));
    return isProdukPublik(item) ? item : null;
  } catch {
    return null;
  }
});

// Official sales contact (DISKUK hotline), shown next to the business's own WhatsApp.
const { data: kontak } = await useKontakHotline();

useSeoMeta({
  title: () => (produk.value ? `${produk.value.nama} – Katalog UMKM Jawa Barat` : "Produk tidak ditemukan – Katalog UMKM"),
  description: () => produk.value?.deskripsi?.slice(0, 160) ?? undefined,
});

const fotos = computed(() => (produk.value?.foto ?? []).map((item) => item.directus_files_id));
const video = computed(() => youtubeEmbed(produk.value?.video_url));
const sertifikasi = computed(() => sertifikasiList(produk.value?.usaha_sertifikasi));
const legalitas = computed(() => usahaLegalitas(produk.value?.usaha_legalitas));
// "Belum diajukan" is not a stage worth showing; the catalogue only badges real programme stages.
const talent = computed(() => {
  const status = produk.value?.usaha_talent_status;
  return status && status !== "none" ? TALENT_STATUS[status] : null;
});
const wa = computed(() =>
  produk.value
    ? kontakPenjualan(produk.value, `Halo ${produk.value.usaha_nama ?? ""}, saya tertarik dengan produk "${produk.value.nama}" di Katalog UMKM Jawa Barat.`)
    : null,
);

/** Verified PDN, self-declared PDN and no PDN are three different statements, never merged. */
const pdn = computed(() => {
  if (produk.value?.usaha_pdn) return { label: "Terverifikasi", className: "text-emerald-600" };
  if (produk.value?.pdn_deklarasi) return { label: "Deklarasi mandiri pelaku usaha", className: "text-amber-500" };
  return { label: BELUM_TERSEDIA, className: "text-muted-foreground/40" };
});

const persen = (value: number | string | null) => (value === null || value === undefined ? BELUM_TERSEDIA : `${Number(value).toLocaleString("id-ID")}%`);
const nomor = (value: number | null) => (value === null ? BELUM_TERSEDIA : new Intl.NumberFormat("id-ID").format(value));

/** Every group the brief lists, with an explicit "Belum tersedia" when the record has no value. */
const spesifikasi = computed(() => {
  const p = produk.value;
  if (!p) return [];
  return [
    ["Deskripsi", p.deskripsi],
    ["KBLI", p.kbli],
    ["Dimensi", p.dimensi],
    ["Berat bersih", p.berat],
    ["Masa kedaluwarsa", p.shelf_life],
    ["Bahan baku", p.bahan_baku],
    ["TKDN", p.tkdn_persen === null ? BELUM_TERSEDIA : persen(p.tkdn_persen)],
    ["Bahan baku lokal", p.persen_bahan_lokal === null ? BELUM_TERSEDIA : persen(p.persen_bahan_lokal)],
  ].map(([label, value]) => ({ label: String(label), value: teksAtauBelum(value) }));
});

const kapasitas = computed(() => {
  const p = produk.value;
  if (!p) return [];
  return [
    { label: "Kapasitas produksi bulanan", value: teksAtauBelum(p.kapasitas_bulanan) },
    // Neither the brief's "stok" nor "kapasitas pesanan besar" exists in the product record yet.
    { label: "Stok", value: BELUM_TERSEDIA },
    { label: "Kapasitas pesanan besar", value: BELUM_TERSEDIA },
    { label: "Lead time", value: teksAtauBelum(p.lead_time) },
  ];
});

const legalitasRows = computed(() => {
  const p = produk.value;
  if (!p) return [];
  return JENIS_LEGALITAS.map((jenis) => {
    const terverifikasi = sertifikasi.value.includes(jenis.value);
    const detail = legalitas.value.find((item) => item.jenis === jenis.value);
    return {
      label: jenis.label,
      status: terverifikasi ? "Terverifikasi" : "Belum ada",
      // A verified certificate without a recorded number says so instead of showing an empty value.
      nomor: terverifikasi ? (detail?.nomor ? `Nomor ${detail.nomor}` : "Nomor belum tersedia") : null,
      aktif: terverifikasi,
    };
  });
});

const active = ref(0);

// ── Letter of intent ────────────────────────────────────────────────────────
const loi = reactive({ nama: "", instansi: "", email: "", telepon: "", jumlah: "", pesan: "", persetujuan: false });
const captcha = useTemplateRef<{ solve: () => Promise<string | null>; reset: () => void }>("captcha");
const sending = ref(false);
const loiMessage = ref<{ tone: "success" | "error"; text: string } | null>(null);
// One key per letter: a retry or a double click cannot store the same intent twice.
const clientUuid = ref(crypto.randomUUID());

async function kirimLoi() {
  loiMessage.value = null;
  if (!loi.nama.trim() || !loi.email.trim() || !loi.pesan.trim()) {
    loiMessage.value = { tone: "error", text: "Nama, email, dan pesan wajib diisi." };
    return;
  }
  if (!loi.persetujuan) {
    loiMessage.value = { tone: "error", text: "Centang persetujuan untuk dihubungi kembali sebelum mengirim." };
    return;
  }
  sending.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      loiMessage.value = { tone: "error", text: "Verifikasi captcha belum selesai." };
      return;
    }
    const hasil = await katalogApi(directus).kirimLoi({
      produk: id,
      nama: loi.nama.trim(),
      instansi: loi.instansi.trim() || null,
      email: loi.email.trim(),
      telepon: loi.telepon.trim() || null,
      jumlah: loi.jumlah.trim() || null,
      pesan: loi.pesan.trim(),
      clientUuid: clientUuid.value,
      captcha: token,
    });
    Object.assign(loi, { nama: "", instansi: "", email: "", telepon: "", jumlah: "", pesan: "", persetujuan: false });
    clientUuid.value = crypto.randomUUID();
    loiMessage.value = {
      tone: "success",
      text: hasil?.duplikat
        ? "Letter of Intent ini sudah pernah terkirim. Tim DISKUK akan menghubungi Anda melalui email."
        : "Letter of Intent terkirim. Tim DISKUK akan menghubungi Anda melalui email.",
    };
  } catch (cause) {
    const text = cause instanceof KatalogError ? cause.pesan : "Letter of Intent tidak dapat dikirim. Periksa isian lalu coba lagi.";
    loiMessage.value = { tone: "error", text };
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
        <p v-else class="text-xs text-muted-foreground">Video cerita produk: {{ BELUM_TERSEDIA }}.</p>
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
          <p class="mt-3 text-xl font-semibold">{{ (produk.hargaLabel ?? hargaRange(produk)) ?? BELUM_TERSEDIA }}</p>
          <p class="text-sm text-muted-foreground">Minimum order {{ nomor(produk.moq) }}</p>
        </div>

        <!-- The two catalogue actions: B2B interest and the verified sales contact. -->
        <div class="flex flex-wrap gap-2" aria-label="Aksi produk">
          <a
            href="#loi"
            class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <FileText class="size-4" aria-hidden="true" /> Ajukan Minat Kemitraan / Order B2B
          </a>
          <a
            v-if="wa"
            :href="wa"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b]"
          >
            <MessageCircle class="size-4" aria-hidden="true" /> Kontak Penjualan Resmi (WhatsApp)
          </a>
          <a
            :href="specPdfUrl(produk.id)"
            class="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Download class="size-4" aria-hidden="true" /> Unduh Lembar Spesifikasi (PDF)
          </a>
        </div>
        <p v-if="!wa" class="text-xs text-muted-foreground">Kontak penjualan resmi belum tersedia atau belum disetujui kurasi.</p>

        <p v-if="produk.deskripsi" class="whitespace-pre-line text-sm leading-relaxed">{{ produk.deskripsi }}</p>

        <div class="rounded-xl border p-4" aria-label="Status legalitas">
          <h2 class="flex items-center gap-2 text-sm font-bold"><ShieldCheck class="size-4" aria-hidden="true" /> Legalitas &amp; Kepatuhan</h2>
          <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div class="flex items-start gap-1.5">
              <BadgeCheck class="mt-0.5 size-4" :class="produk.usaha_nib ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
              <dt>NIB:</dt>
              <dd :class="{ 'text-muted-foreground': !produk.usaha_nib }">{{ teksAtauBelum(produk.usaha_nib) }}</dd>
            </div>
            <div v-for="row in legalitasRows" :key="row.label" class="flex items-start gap-1.5">
              <BadgeCheck class="mt-0.5 size-4" :class="row.aktif ? 'text-emerald-600' : 'text-muted-foreground/40'" aria-hidden="true" />
              <dt>{{ row.label }}:</dt>
              <dd :class="{ 'text-muted-foreground': !row.aktif }">{{ row.status }}<template v-if="row.nomor"> · {{ row.nomor }}</template></dd>
            </div>
            <div class="flex items-start gap-1.5">
              <BadgeCheck class="mt-0.5 size-4" :class="pdn.className" aria-hidden="true" />
              <dt>PDN:</dt>
              <dd :class="{ 'text-muted-foreground': pdn.label === BELUM_TERSEDIA }">{{ pdn.label }}</dd>
            </div>
            <div v-if="talent" class="flex items-start gap-1.5">
              <BadgeCheck class="mt-0.5 size-4 text-amber-500" aria-hidden="true" />
              <dt>Tahap program:</dt>
              <dd>{{ talent.label }}</dd>
            </div>
            <div v-if="produk.usaha_ramah_disabilitas" class="flex items-start gap-1.5">
              <BadgeCheck class="mt-0.5 size-4 text-sky-600" aria-hidden="true" />
              <dt>Ramah disabilitas:</dt>
              <dd>Ya</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 class="text-sm font-bold">Spesifikasi dan Kapasitas</h2>
          <dl class="mt-2 divide-y rounded-xl border text-sm">
            <div v-for="row in [...spesifikasi, ...kapasitas]" :key="row.label" class="grid grid-cols-[10rem_1fr] gap-3 px-4 py-2">
              <dt class="text-muted-foreground">{{ row.label }}</dt>
              <dd class="whitespace-pre-line" :class="{ 'text-muted-foreground': row.value === BELUM_TERSEDIA }">{{ row.value }}</dd>
            </div>
          </dl>
        </div>

        <ProgramHotlineCard v-if="kontak" :kontak="kontak" :pesan="`Halo DISKUK, saya ingin bertanya tentang produk ${produk.nama} di Katalog UMKM.`" />

        <form id="loi" class="grid gap-3 rounded-xl border bg-muted/30 p-4" novalidate aria-labelledby="loi-title" @submit.prevent="kirimLoi">
          <div>
            <h2 id="loi-title" class="text-sm font-bold">Ajukan Minat Kemitraan / Order B2B (LOI)</h2>
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
          <label class="flex items-start gap-2 text-xs text-muted-foreground">
            <UiCheckbox v-model="loi.persetujuan" aria-label="Persetujuan dihubungi kembali" />
            <span>Saya menyetujui data kontak ini digunakan DISKUK dan pelaku usaha untuk menindaklanjuti minat kemitraan.</span>
          </label>
          <AuthCaptcha ref="captcha" />
          <p v-if="loiMessage" :role="loiMessage.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="loiMessage.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">{{ loiMessage.text }}</p>
          <UiButton type="submit" :disabled="sending" class="w-fit">{{ sending ? "Mengirim…" : "Kirim LOI" }}</UiButton>
        </form>
      </section>
    </article>
  </div>
</template>
