<script setup lang="ts">
import { ScanBarcode } from "@lucide/vue";
import type { NavLink, SocialLink } from "@/types/landing";

const quickLinks: NavLink[] = [
  { label: "Katalog", to: "/katalog" },
  { label: "Download", to: "/download" },
  { label: "FAQ", to: "/faq" },
  { label: "Galeri", to: "/galeri" },
  { label: "Hubungi Kami", to: "/hubungi-kami" },
  { label: "Konsultasi", to: "/konsultasi" },
  { label: "Tentang Program", to: "/tentang-program" },
];

const socials: (SocialLink & { icon: typeof ScanBarcode })[] = [
  { label: "Facebook", href: "/", icon: ScanBarcode },
  { label: "X / Twitter", href: "/", icon: ScanBarcode },
  { label: "Instagram", href: "/", icon: ScanBarcode },
];
</script>

<template>
  <footer role="contentinfo" class="relative isolate overflow-clip border-t border-border">
    <div class="mx-auto max-w-screen-7xl px-4 py-16 lg:px-8 lg:py-24">
      <div class="grid gap-12 lg:grid-cols-12">
        <div class="col-span-full lg:col-span-3">
          <NuxtLink to="/" aria-label="Beranda Diskuk">
            <span class="text-2xl font-extrabold tracking-tighter text-primary">DISKUK</span>
            <br />
            <span class="text-xs font-medium text-muted-foreground">Jawa Barat</span>
          </NuxtLink>
          <p class="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat</p>
        </div>

        <div class="col-span-full lg:col-span-4">
          <h3 class="mb-5 border-b border-border pb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Tautan Cepat</h3>
          <ul class="grid grid-cols-2 gap-y-2 gap-x-6" role="list">
            <li v-for="link in quickLinks" :key="link.to">
              <NuxtLink :to="link.to" class="text-sm font-medium text-foreground/70 transition-colors hover:text-primary">
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="col-span-full lg:col-span-3">
          <h3 class="mb-5 border-b border-border pb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Alamat</h3>
          <address class="not-italic text-sm text-muted-foreground leading-relaxed">
            Jl. Soekarno Hatta No. 705 Jatisari,<br />
            Kec. Buahbatu, Kota Bandung,<br />
            Jawa Barat 40286
          </address>
        </div>

        <div class="col-span-full lg:col-span-2">
          <h3 class="mb-5 border-b border-border pb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Kontak</h3>
          <ul class="flex flex-col gap-2" role="list">
            <li>
              <a href="tel:02273027750" class="text-sm font-medium text-foreground/70 transition-colors hover:text-primary"> (022) 7302775 </a>
            </li>
            <li>
              <a href="mailto:buk.diskukjabar@gmail.com" class="text-sm font-medium text-foreground/70 transition-colors hover:text-primary break-all"> buk.diskukjabar@gmail.com </a>
            </li>
          </ul>

          <h3 class="mb-4 mt-8 border-b border-border pb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">Ikuti Kami</h3>
          <ul class="flex items-center gap-3" role="list">
            <li v-for="social in socials" :key="social.label">
              <a
                :href="social.href"
                :aria-label="social.label"
                rel="noopener noreferrer"
                target="_blank"
                class="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <component :is="social.icon" class="size-4" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="border-t border-border px-4 py-6 text-center">
      <p class="text-xs text-muted-foreground">&copy; {{ new Date().getFullYear() }} UMKM Naik Kelas — Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat. Hak cipta dilindungi undang-undang.</p>
    </div>
  </footer>
</template>
