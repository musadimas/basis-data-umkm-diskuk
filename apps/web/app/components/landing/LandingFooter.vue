<script setup lang="ts">
import type { NavLink } from "@/types/landing";

const quickLinks: NavLink[] = [
  { label: "Katalog", to: "/katalog" },
  { label: "Download", to: "/download" },
  { label: "FAQ", to: "/faq" },
  { label: "Konsultasi", to: "/konsultasi" },
  { label: "Tentang Program", to: "/tentang-program" },
];
</script>

<template>
  <footer
    id="section-footer"
    role="contentinfo"
    class="relative isolate overflow-clip"
  >
    <!-- Main columns -->
    <section class="relative py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
        <div class="grid gap-16 lg:grid-cols-12">
          <!-- Logo -->
          <div class="col-span-full text-center lg:col-span-4 lg:text-start">
            <NuxtLink
              to="/"
              aria-label="Beranda UMKM Diskuk"
              class="inline-flex h-20"
            >
              <NuxtImg
                src="/images/logo-umkm-diskuk.png"
                alt="UMKM Diskuk Jawa Barat"
                class="size-full object-contain"
                loading="lazy"
              />
            </NuxtLink>
          </div>

          <!-- Quick links -->
          <div class="col-span-full lg:col-span-8">
            <h3
              class="mb-6 border-b border-foreground/10 pb-6 text-center text-[11px] font-semibold uppercase tracking-widest text-sky-500 lg:text-start"
            >
              Quick Link
            </h3>
            <ul
              class="group grid grid-cols-2 gap-x-8 gap-y-1 [&>*:nth-child(odd)]:text-end lg:gap-x-16 lg:[&>*:nth-child(odd)]:text-start"
              role="list"
            >
              <li v-for="link in quickLinks" :key="link.to">
                <NuxtLink
                  :to="link.to"
                  class="inline-flex text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Address -->
          <div class="col-span-full lg:col-span-4">
            <h3
              class="mb-6 border-b border-foreground/10 pb-6 text-center text-[11px] font-semibold uppercase tracking-widest text-sky-500 lg:text-start"
            >
              Alamat
            </h3>
            <address
              class="not-italic text-center text-sm font-semibold text-balance lg:text-start"
            >
              Jl. Soekarno Hatta No. 705 Jatisari, Kec. Buahbatu, Kota Bandung,
              Jawa Barat 40286
            </address>
          </div>

          <!-- Support -->
          <div class="col-span-full lg:col-span-4">
            <h3
              class="mb-6 border-b border-foreground/10 pb-6 text-center text-[11px] font-semibold uppercase tracking-widest text-sky-500 lg:text-start"
            >
              Support
            </h3>
            <ul
              class="group flex flex-col gap-1 text-center lg:text-start"
              role="list"
            >
              <li>
                <a
                  href="tel:02273027750"
                  class="inline-flex text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  (022) 7302775
                </a>
              </li>
              <li>
                <a
                  href="mailto:buk.diskukjabar@gmail.com"
                  class="inline-flex break-all text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  buk.diskukjabar@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom bar -->
    <section class="relative pb-8 pt-16">
      <div class="mx-auto max-w-7xl px-3 lg:px-12 xl:px-0">
        <p
          class="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          &copy; {{ new Date().getFullYear() }} UMKM Naik Kelas
        </p>
      </div>

      <!-- Decorative divider with centered logo -->
      <div
        class="absolute inset-x-0 top-0 mx-auto flex max-w-7xl -translate-y-1/2 items-center gap-6 px-3 lg:px-12 xl:px-0"
        aria-hidden="true"
      >
        <div
          class="h-px grow bg-linear-to-l from-foreground/30 to-transparent"
        />
        <figure class="h-16 shrink-0">
          <NuxtImg
            src="/images/logo-jabar-diskuk.png"
            alt=""
            class="size-full object-contain"
            loading="lazy"
            draggable="false"
          />
        </figure>
        <div
          class="h-px grow bg-linear-to-r from-foreground/30 to-transparent"
        />
      </div>

      <!-- Gradient colour bloom -->
      <div
        class="absolute -top-48 bottom-0 inset-x-[-20vw] -z-2 overflow-clip pt-48"
        aria-hidden="true"
      >
        <div
          class="aspect-video rounded-full bg-linear-to-r from-sky-500 from-30% via-amber-500 via-60% to-green-500 blur-[5rem] opacity-80"
        />
      </div>
    </section>

    <!-- Dot grid overlay -->
    <div
      class="pointer-events-none absolute inset-0 -z-1 translate-y-1/4 bg-top bg-no-repeat opacity-5 mix-blend-overlay"
      style="
        background-image: radial-gradient(
          circle,
          currentColor 1px,
          transparent 1px
        );
        background-size: 24px 24px;
      "
      aria-hidden="true"
    />
  </footer>
</template>
