<script setup lang="ts">
// Pengantar klinik (Y09/M7-11): the six consultation desks with their editable topics, the four-step
// flow, and the WhatsApp button of the configured narahubung. The desks come from
// `GET /v1/program/klinik/poli` and the contact from the `kontak_hotline` singleton, so this page
// never keeps its own copy of editorial content.
import { ChevronRight, MessageCircle } from "@lucide/vue";
import { whatsappLink } from "~/lib/katalog";
import type { KlinikPoli } from "~/types/program";

const props = defineProps<{ poli: KlinikPoli[] }>();
const emit = defineEmits<{ mulai: []; lacak: [] }>();

const ALUR = [
  { judul: "Identitas usaha", isi: "Masuk dengan akun UMKM agar nama, skala, dan wilayah terisi dari data SIDT. Tanpa masuk, tiket dicatat belum terverifikasi." },
  { judul: "Poli & permasalahan", isi: "Pilih satu dari enam poli, ceritakan masalahnya, dan lampirkan berkas pendukung bila ada." },
  { judul: "Jadwal", isi: "Pilih daring (video call) atau tatap muka, lalu slot hari kerja yang masih kosong." },
  { judul: "Nomor tiket", isi: "Anda menerima nomor tiket untuk membaca ulang status, dan pendamping mengonfirmasi jadwal." },
];

const { data: kontak } = await useKontakHotline();
const wa = computed(() =>
  kontak.value ? whatsappLink(kontak.value.whatsapp, "Halo DISKUK Jawa Barat, saya ingin bertanya tentang klinik konsultasi UMKM.") : null,
);
</script>

<template>
  <section class="grid gap-6" aria-label="Pengantar klinik konsultasi">
    <div class="grid gap-3">
      <h2 class="text-2xl font-bold tracking-tight">Enam poli konsultasi</h2>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Konsultasi gratis dengan pendamping DISKUK Jawa Barat. Pilih poli yang paling dekat dengan
        permasalahan usaha Anda; petugas dapat merujuk ke bantuan sarpras, pelatihan vokasi, mediasi
        Kementerian/SAPA UMKM, atau kurasi Talent Pool.
      </p>
    </div>

    <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="daftar-poli">
      <li v-for="item in props.poli" :key="item.id" class="grid content-start gap-2 rounded-xl border bg-card p-4 text-sm" data-testid="poli-kartu">
        <h3 class="font-semibold leading-snug">{{ item.nama }}</h3>
        <p class="text-muted-foreground">{{ item.deskripsi }}</p>
        <ul v-if="item.subtopik?.length" class="flex flex-wrap gap-1">
          <li v-for="topik in item.subtopik" :key="topik" class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{{ topik }}</li>
        </ul>
      </li>
    </ul>

    <div class="grid gap-3 rounded-xl border bg-muted/30 p-5">
      <h2 class="text-lg font-bold">Alur empat langkah</h2>
      <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(langkah, index) in ALUR" :key="langkah.judul" class="grid content-start gap-1 text-sm">
          <span class="text-xs font-bold text-muted-foreground">LANGKAH {{ index + 1 }}</span>
          <span class="font-semibold">{{ langkah.judul }}</span>
          <span class="text-muted-foreground">{{ langkah.isi }}</span>
        </li>
      </ol>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-sm">
      <UiButton type="button" @click="emit('mulai')">Ajukan konsultasi <ChevronRight class="size-4" /></UiButton>
      <UiButton type="button" variant="outline" @click="emit('lacak')">Sudah punya tiket? Lacak status</UiButton>
      <a v-if="wa" :href="wa" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 font-semibold text-[#128c3e] underline">
        <MessageCircle class="size-4" aria-hidden="true" /> {{ kontak?.nama_layanan }}
      </a>
    </div>
  </section>
</template>
