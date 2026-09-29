<script setup lang="ts">
import { readItems } from "@directus/sdk";
import { HelpCircle, MessageCircle } from "@lucide/vue";
import { whatsappLink } from "~/lib/katalog";
import type { FaqEntry } from "~/types/program";

// Pusat bantuan M7-14: FAQ program dari konten terkurasi (`faq`, hanya yang "terbit") dan tombol
// WhatsApp narahubung dinas dari singleton `kontak_hotline`. Halaman tidak menyimpan salinan
// jawaban sendiri, jadi tanggal program yang basi tidak bisa tertinggal di sini.
definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Pusat Bantuan & FAQ – Diskuk Jawa Barat",
  description: "Pertanyaan umum seputar program UMKM Jawa Barat, pendaftaran, dan kontak narahubung DISKUK.",
});

const directus = useDirectus();
const { data: faq, status } = await useAsyncData("faq:terbit", async () => {
  try {
    // SAFETY: SDK tidak dapat mengetik `fields` union koleksi faq; field yang diminta persis allowlist publik.
    const items = await directus.request(
      readItems("faq", { fields: ["id", "pertanyaan", "jawaban", "kategori", "sort", "date_updated"], sort: ["sort", "id"], limit: 200 } as never),
    );
    // SAFETY: endpoint publik hanya mengembalikan baris faq terbit dengan field yang diminta di atas.
    return (Array.isArray(items) ? items : []) as FaqEntry[];
  } catch {
    return [];
  }
});
const { data: kontak } = await useKontakHotline();

/** One section per editorial category, so a long answer list stays navigable. */
const kategori = computed(() => {
  const groups = new Map<string, FaqEntry[]>();
  for (const item of faq.value ?? []) {
    const key = item.kategori?.trim() || "Umum";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([nama, items]) => ({ nama, items }));
});
const adaFaq = computed(() => (faq.value?.length ?? 0) > 0);
const wa = computed(() =>
  kontak.value ? whatsappLink(kontak.value.whatsapp, "Halo DISKUK Jawa Barat, saya ingin bertanya tentang program UMKM.") : null,
);

const tanggal = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)) : null;
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Pusat Bantuan" subtitle="FAQ & Narahubung" badge-color="#cbd5e1" />

    <div class="mx-auto grid max-w-7xl gap-8 px-3 pb-20 | lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-12 xl:px-0">
      <div class="grid content-start gap-6">
        <div v-if="status === 'pending'" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Memuat pertanyaan…</div>

        <div v-else-if="!adaFaq" role="status" class="grid gap-2 rounded-xl border bg-card p-6 text-sm">
          <span class="inline-flex items-center gap-2 font-semibold"><HelpCircle class="size-4" aria-hidden="true" /> FAQ belum tersedia</span>
          <p class="text-muted-foreground">
            Pertanyaan umum belum dipublikasikan petugas. Silakan hubungi narahubung dinas di samping, atau
            <NuxtLink to="/konsultasi" class="underline">ajukan konsultasi langsung</NuxtLink>.
          </p>
        </div>

        <template v-else>
          <nav aria-label="Kategori FAQ" class="flex flex-wrap gap-2 text-xs">
            <a v-for="group in kategori" :key="group.nama" :href="`#faq-${group.nama.toLowerCase().replace(/\s+/g, '-')}`" class="rounded-full border px-3 py-1.5 font-medium hover:bg-muted">{{ group.nama }} ({{ group.items.length }})</a>
          </nav>

          <section v-for="group in kategori" :id="`faq-${group.nama.toLowerCase().replace(/\s+/g, '-')}`" :key="group.nama" class="grid gap-3" :aria-label="group.nama">
            <h2 class="text-lg font-bold">{{ group.nama }}</h2>
            <dl class="grid gap-3">
              <div v-for="item in group.items" :key="item.id" class="grid gap-1.5 rounded-xl border bg-card p-4" :data-testid="`faq-${item.id}`">
                <dt class="font-semibold">{{ item.pertanyaan }}</dt>
                <dd class="text-sm leading-relaxed text-muted-foreground">{{ item.jawaban }}</dd>
                <dd v-if="tanggal(item.date_updated)" class="text-[11px] text-muted-foreground">Diperbarui {{ tanggal(item.date_updated) }}</dd>
              </div>
            </dl>
          </section>
        </template>
      </div>

      <aside class="grid content-start gap-4">
        <ProgramHotlineCard v-if="kontak" :kontak="kontak" pesan="Halo DISKUK Jawa Barat, saya ingin bertanya tentang program UMKM." />
        <div v-else role="status" class="grid gap-2 rounded-xl border bg-card p-5 text-sm">
          <span class="font-semibold">Kontak narahubung belum tersedia</span>
          <p class="text-muted-foreground">Nomor narahubung dinas belum dikonfigurasi petugas.</p>
        </div>
        <p v-if="kontak && !wa" class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          Nomor WhatsApp narahubung belum dikonfigurasi, jadi tombol WhatsApp tidak ditampilkan. Gunakan telepon atau email di atas.
        </p>

        <section class="grid gap-2 rounded-xl border bg-card p-5 text-sm" aria-label="Ajukan konsultasi">
          <h2 class="text-base font-bold">Belum menemukan jawabannya?</h2>
          <p class="text-muted-foreground">Ajukan konsultasi lewat enam poli klinik DISKUK dan pilih jadwal yang tersedia.</p>
          <NuxtLink to="/konsultasi" class="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
            <MessageCircle class="size-4" aria-hidden="true" /> Ajukan konsultasi
          </NuxtLink>
        </section>
      </aside>
    </div>
  </div>
</template>
