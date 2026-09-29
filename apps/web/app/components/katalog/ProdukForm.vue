<script setup lang="ts">
import { uploadFiles } from "@directus/sdk";
import { ImagePlus, X } from "@lucide/vue";
import { KURASI_FOLDER_ID, KATEGORI_PRODUK, assetUrl } from "~/constants";
import type { Produk, ProdukInput } from "~/types/program";

const MAX_FOTO = 5;
const MAX_FOTO_MB = 5;

const props = defineProps<{ produk: Produk | null; pending: boolean }>();
const emit = defineEmits<{ submit: [input: ProdukInput]; cancel: [] }>();

const directus = useDirectus();
const text = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));

// Inputs bind strings; toInput() converts them to the API shape.
// SAFETY: daftar foto dimulai kosong dan hanya diisi id berkas (string) dari Directus.
const form = reactive({
  nama: "",
  deskripsi: "",
  kategori: "",
  kbli: "",
  hargaRetail: "",
  hargaGrosir: "",
  moq: "",
  videoUrl: "",
  dimensi: "",
  berat: "",
  shelfLife: "",
  bahanBaku: "",
  tkdnPersen: "",
  kapasitasBulanan: "",
  leadTime: "",
  ujiLab: "",
  persenBahanLokal: "",
  pdnDeklarasi: false,
  foto: [] as string[],
});

watch(
  () => props.produk,
  (produk) => {
    Object.assign(form, {
      nama: text(produk?.nama),
      deskripsi: text(produk?.deskripsi),
      kategori: text(produk?.kategori),
      kbli: text(produk?.kbli),
      hargaRetail: text(produk?.hargaRetail),
      hargaGrosir: text(produk?.hargaGrosir),
      moq: text(produk?.moq),
      videoUrl: text(produk?.videoUrl),
      dimensi: text(produk?.dimensi),
      berat: text(produk?.berat),
      shelfLife: text(produk?.shelfLife),
      bahanBaku: text(produk?.bahanBaku),
      tkdnPersen: text(produk?.tkdnPersen),
      kapasitasBulanan: text(produk?.kapasitasBulanan),
      leadTime: text(produk?.leadTime),
      ujiLab: text(produk?.ujiLab),
      persenBahanLokal: text(produk?.persenBahanLokal),
      pdnDeklarasi: produk?.pdnDeklarasi ?? false,
      foto: [...(produk?.foto ?? [])],
    });
  },
  { immediate: true },
);

const uploading = ref(false);
const error = ref("");

async function addFoto(event: Event) {
  // SAFETY: handler ini hanya dipasang pada <input type="file">, sehingga target-nya selalu elemen input.
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  error.value = "";
  uploading.value = true;
  try {
    for (const file of files) {
      if (form.foto.length >= MAX_FOTO) {
        error.value = `Maksimal ${MAX_FOTO} foto per produk.`;
        break;
      }
      if (!file.type.startsWith("image/") || file.size > MAX_FOTO_MB * 1024 * 1024) {
        error.value = `Foto harus berupa gambar dengan ukuran maksimal ${MAX_FOTO_MB} MB.`;
        continue;
      }
      // Photos wait in the curation folder (no public grant) until a curator publishes them.
      const body = new FormData();
      body.append("folder", KURASI_FOLDER_ID);
      body.append("file", file);
      const uploaded = await directus.request(uploadFiles(body));
      // SAFETY: uploadFiles hanya mengembalikan berkas Directus yang punya `id`.
      form.foto.push((uploaded as { id: string }).id);
    }
  } catch {
    error.value = "Foto tidak dapat diunggah. Coba lagi.";
  } finally {
    uploading.value = false;
  }
}

function toInput(): ProdukInput | null {
  // Number inputs hand back numbers once edited, so normalise through String first.
  const number = (value: string | number) => (String(value).trim() === "" ? null : Number(value));
  const optional = (value: string) => value.trim() || null;
  if (!form.nama.trim()) {
    error.value = "Nama produk wajib diisi.";
    return null;
  }
  if (!form.foto.length) {
    error.value = "Tambahkan minimal satu foto produk.";
    return null;
  }
  return {
    nama: form.nama.trim(),
    deskripsi: optional(form.deskripsi),
    kategori: optional(form.kategori),
    kbli: optional(form.kbli),
    hargaRetail: number(form.hargaRetail),
    hargaGrosir: number(form.hargaGrosir),
    moq: number(form.moq),
    videoUrl: optional(form.videoUrl),
    dimensi: optional(form.dimensi),
    berat: optional(form.berat),
    shelfLife: optional(form.shelfLife),
    bahanBaku: optional(form.bahanBaku),
    tkdnPersen: number(form.tkdnPersen),
    kapasitasBulanan: optional(form.kapasitasBulanan),
    leadTime: optional(form.leadTime),
    ujiLab: optional(form.ujiLab),
    persenBahanLokal: number(form.persenBahanLokal),
    pdnDeklarasi: form.pdnDeklarasi,
    foto: form.foto,
  };
}

function submit() {
  error.value = "";
  const input = toInput();
  if (input) emit("submit", input);
}
</script>

<template>
  <form class="grid gap-5" novalidate @submit.prevent="submit">
    <fieldset :disabled="pending" class="grid gap-5">
      <div class="grid gap-2">
        <span class="text-sm font-medium">Foto produk (maks. {{ MAX_FOTO }})</span>
        <ul class="flex flex-wrap gap-2">
          <li v-for="(id, index) in form.foto" :key="id" class="relative size-24">
            <img :src="assetUrl(id, 192)" :alt="`Foto produk ${index + 1}`" class="size-full rounded-md object-cover">
            <button type="button" class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" :aria-label="`Hapus foto ${index + 1}`" @click="form.foto.splice(index, 1)">
              <X class="size-3" />
            </button>
            <span v-if="index === 0" class="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">Utama</span>
          </li>
          <li v-if="form.foto.length < MAX_FOTO">
            <label class="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground hover:bg-muted">
              <ImagePlus class="size-5" /> {{ uploading ? "Mengunggah…" : "Tambah" }}
              <input type="file" accept="image/*" multiple class="sr-only" data-testid="foto-produk-input" :disabled="uploading" @change="addFoto">
            </label>
          </li>
        </ul>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField class="gap-1 sm:col-span-2"><UiFieldLabel for="produk-nama">Nama produk</UiFieldLabel><UiInput id="produk-nama" v-model="form.nama" maxlength="160" required /></UiField>
        <label class="grid gap-1 text-sm">
          <span class="font-medium">Kategori</span>
          <select v-model="form.kategori" name="kategori" class="h-9 rounded-md border border-input bg-transparent px-2">
            <option value="">Pilih kategori</option>
            <option v-for="item in KATEGORI_PRODUK" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <UiField class="gap-1"><UiFieldLabel for="produk-kbli">KBLI (5 digit)</UiFieldLabel><UiInput id="produk-kbli" v-model="form.kbli" inputmode="numeric" maxlength="5" /></UiField>
        <UiField class="gap-1 sm:col-span-2"><UiFieldLabel for="produk-deskripsi">Deskripsi</UiFieldLabel><UiTextarea id="produk-deskripsi" v-model="form.deskripsi" rows="4" maxlength="5000" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-retail">Harga retail (Rp)</UiFieldLabel><UiInput id="produk-retail" v-model="form.hargaRetail" type="number" min="0" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-grosir">Harga grosir (Rp)</UiFieldLabel><UiInput id="produk-grosir" v-model="form.hargaGrosir" type="number" min="0" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-moq">Minimum order (MOQ)</UiFieldLabel><UiInput id="produk-moq" v-model="form.moq" type="number" min="1" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-video">Video (tautan https, mis. YouTube)</UiFieldLabel><UiInput id="produk-video" v-model="form.videoUrl" type="url" maxlength="500" /></UiField>
      </div>

      <fieldset class="grid gap-4 sm:grid-cols-2">
        <legend class="mb-2 text-sm font-bold">Spesifikasi teknis</legend>
        <UiField class="gap-1"><UiFieldLabel for="produk-dimensi">Dimensi</UiFieldLabel><UiInput id="produk-dimensi" v-model="form.dimensi" maxlength="100" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-berat">Berat</UiFieldLabel><UiInput id="produk-berat" v-model="form.berat" maxlength="50" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-shelf">Masa simpan</UiFieldLabel><UiInput id="produk-shelf" v-model="form.shelfLife" maxlength="50" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-kapasitas">Kapasitas per bulan</UiFieldLabel><UiInput id="produk-kapasitas" v-model="form.kapasitasBulanan" maxlength="100" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-lead">Lead time</UiFieldLabel><UiInput id="produk-lead" v-model="form.leadTime" maxlength="100" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-uji">Sertifikasi uji lab</UiFieldLabel><UiInput id="produk-uji" v-model="form.ujiLab" maxlength="200" placeholder="Bila ada, mis. uji mikrobiologi labkes" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-tkdn">TKDN (%)</UiFieldLabel><UiInput id="produk-tkdn" v-model="form.tkdnPersen" type="number" min="0" max="100" /></UiField>
        <UiField class="gap-1"><UiFieldLabel for="produk-lokal">Bahan baku lokal (%)</UiFieldLabel><UiInput id="produk-lokal" v-model="form.persenBahanLokal" type="number" min="0" max="100" /></UiField>
        <UiField class="gap-1 sm:col-span-2"><UiFieldLabel for="produk-bahan">Bahan baku</UiFieldLabel><UiTextarea id="produk-bahan" v-model="form.bahanBaku" rows="2" maxlength="2000" /></UiField>
      </fieldset>

      <label class="flex items-start gap-2 rounded-md border p-3 text-sm">
        <UiCheckbox v-model="form.pdnDeklarasi" name="pdn-deklarasi" class="mt-0.5" />
        <span>Saya menyatakan produk ini diproduksi di dalam negeri (deklarasi mandiri Produk Dalam Negeri).</span>
      </label>
      <p class="rounded-md bg-sky-50 p-3 text-xs leading-relaxed text-sky-950">
        <strong>Kepatuhan PMSE:</strong> dilarang memanipulasi transaksi maupun ulasan, dan wajib menjaga standar mutu barang yang ditawarkan. Informasi produk harus lengkap, benar, dan tidak menyesatkan sesuai ketentuan Perdagangan Melalui Sistem Elektronik. Setiap perubahan akan dikurasi ulang sebelum tayang.
      </p>
    </fieldset>

    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <div class="flex flex-wrap gap-3">
      <UiButton type="submit" :disabled="pending || uploading">{{ pending ? "Menyimpan…" : produk ? "Simpan & Ajukan Kurasi Ulang" : "Ajukan ke Kurasi" }}</UiButton>
      <UiButton type="button" variant="outline" :disabled="pending" @click="emit('cancel')">Batal</UiButton>
    </div>
  </form>
</template>
