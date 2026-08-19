<script setup lang="ts">
definePageMeta({ layout: "landing" });

useSeoMeta({
  title: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  description:
    "Program UMKM Berdaya Saing Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat",
  ogTitle: "UMKM Berdaya Saing – Diskuk Jawa Barat",
  ogDescription:
    "Program unggulan pemberdayaan UMKM Jawa Barat dengan pendampingan dan penguatan kapasitas usaha.",
  ogImage: "/images/og-cover.jpg",
  twitterCard: "summary_large_image",
});

const preloaderDone = ref(false);
</script>

<template>
  <LandingPreloader @done="preloaderDone = true" />
  <div class="min-h-dvh">
    <LandingHeaderMask
      title="Konsultasi"
      subtitle="Konsultasi"
      badge-color="#cbd5e1"
    />
    <section id="page-content">
      <div class="relative py-16 | lg:py-20">
        <div class="max-w-7xl mx-auto px-3 | lg:px-12 | xl:px-0">
          <div
            class="grid gap-3 | lg:grid-cols-12 lg:gap-6 lg:[&amp;&gt;*:nth-child(odd)]:-mt-12"
          >
            <div class="grid-item col-span-full | lg:col-span-6">
              <div class="relative isolate pt-12 | lg:pt-20">
                <NuxtLink
                  to="/sign-in"
                  class="relative isolate flex flex-col justify-between items-start aspect-video rounded-xl bg-blue-100 bg-[radial-gradient(farthest-side_at_50%_100%,var(--color-blue-300),transparent)] p-6 overflow-clip | lg:aspect-21/9 lg:p-8"
                >
                  <h6
                    class="font-bold text-[11px] tracking-wide uppercase text-blue-500"
                  >
                    Konsultasi
                  </h6>
                  <h4
                    class="text-balance leading-none text-3xl font-bold max-w-[60%] | lg:max-w-[50%]"
                  >
                    Sudah Punya Akun?
                  </h4>
                  <div class="absolute inset-0 z-[-1] mix-blend-overlay">
                    <div
                      class="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/2 aspect-square w-[80%] rounded-full border border-foreground/10"
                    />
                    <div
                      class="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/2 aspect-square w-[80%] rounded-full border border-foreground/10"
                    />
                  </div>
                </NuxtLink>
                <div
                  class="absolute inset-0 flex justify-end pointer-events-none"
                >
                  <figure class="aspect-3/4 h-full">
                    <NuxtImg
                      src="/images/figure-2.png"
                      alt=""
                      class="size-full object-contain"
                    />
                  </figure>
                </div>
              </div>
            </div>
            <div class="grid-item col-span-full | lg:col-span-6 pt-10">
              <div class="relative isolate pt-12 | lg:pt-20">
                <NuxtLink
                  to="/sign-uo"
                  class="relative isolate flex flex-col justify-between items-end text-end aspect-video rounded-xl bg-amber-100 bg-[radial-gradient(farthest-side_at_50%_100%,var(--color-amber-300),transparent)] p-6 overflow-clip | lg:aspect-21/9 lg:p-8"
                >
                  <h6
                    class="font-bold text-[11px] tracking-wide uppercase text-amber-600"
                  >
                    Konsultasi
                  </h6>
                  <h4
                    class="text-balance leading-none text-3xl font-bold max-w-[60%] | lg:max-w-[50%]"
                  >
                    Belum Punya Akun?
                  </h4>
                  <div class="absolute inset-0 z-[-1] mix-blend-overlay">
                    <div
                      class="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/2 aspect-square w-[80%] rounded-full border border-foreground/10"
                    />
                    <div
                      class="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/2 aspect-square w-[80%] rounded-full border border-foreground/10"
                    />
                  </div>
                </NuxtLink>
                <div
                  class="absolute inset-0 flex justify-start pointer-events-none"
                >
                  <figure class="aspect-3/4 h-full">
                    <NuxtImg
                      src="/images/figure-1.png"
                      alt=""
                      class="size-full object-contain"
                    />
                  </figure>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
