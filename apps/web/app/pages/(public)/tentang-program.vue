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
    <LandingHeaderMask title="Tentang Program" subtitle="Tentang Program" />
    <div class="grid gap-8 | lg:grid-cols-12 lg:gap-16 py-20 max-w-7xl mx-auto">
      <div class="grid-item col-span-full | lg:col-span-2">
        <div class="lg:sticky lg:top-30 lg:pt-4 lg:-mt-4">
          <div
            class="flex items-center justify-between gap-4 py-6 border-y border-border | lg:w-min lg:flex-col lg:justify-normal lg:gap-8 lg:py-0 lg:border-none"
          >
            <h6
              class="font-medium text-[11px] tracking-wide leading-4 uppercase | lg:[writing-mode:vertical-lr]"
            >
              Bagikan
            </h6>
            <UiTooltipProvider>
              <div class="flex items-center gap-1 | lg:flex-col">
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton
                      as="a"
                      href="#!"
                      variant="secondary"
                      size="icon-sm"
                      class="rounded-full"
                      aria-label="Bagikan ke Twitter"
                    >
                      <svg
                        class="size-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2.3569 2.78113C2.52359 2.45513 2.85886 2.25 3.225 2.25H8.1C8.41308 2.25 8.70711 2.40034 8.89041 2.65415L13.5354 9.08571L20.0856 2.53557C20.4663 2.15481 21.0837 2.15481 21.4644 2.53557C21.8452 2.91633 21.8452 3.53367 21.4644 3.91443L14.6919 10.687L21.5654 20.2041C21.7798 20.501 21.8098 20.8929 21.6431 21.2189C21.4764 21.5449 21.1411 21.75 20.775 21.75H15.9C15.5869 21.75 15.2929 21.5997 15.1096 21.3459L10.4646 14.9143L3.91443 21.4644C3.53367 21.8452 2.91634 21.8452 2.53557 21.4644C2.15481 21.0837 2.15481 20.4663 2.53557 20.0856L9.30811 13.313L2.43459 3.79585C2.22022 3.49903 2.19021 3.10713 2.3569 2.78113Z"
                          fill="currentColor"
                        />
                      </svg>
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent side="right">Twitter</UiTooltipContent>
                </UiTooltip>
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton
                      as="a"
                      href="#!"
                      variant="secondary"
                      size="icon-sm"
                      class="rounded-full"
                      aria-label="Bagikan ke Facebook"
                    >
                      <svg
                        class="size-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M5.55869 10.2083C4.47617 10.2083 4.25024 10.4146 4.25024 11.4028V13.1944C4.25024 14.1826 4.47617 14.3889 5.55869 14.3889H8.17557V21.5556C8.17557 22.5438 8.40149 22.75 9.48401 22.75H12.1009C13.1834 22.75 13.4093 22.5438 13.4093 21.5556V14.3889H16.3477C17.1687 14.3889 17.3803 14.2432 17.6058 13.5226L18.1666 11.7309C18.5529 10.4965 18.3148 10.2083 16.9085 10.2083H13.4093V7.22222C13.4093 6.56255 13.9951 6.02778 14.7178 6.02778H18.4418C19.5243 6.02778 19.7502 5.82154 19.7502 4.83333V2.44444C19.7502 1.45624 19.5243 1.25 18.4418 1.25H14.7178C11.1046 1.25 8.17557 3.92386 8.17557 7.22222V10.2083H5.55869Z"
                          fill="currentColor"
                        />
                      </svg>
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent side="right">Facebook</UiTooltipContent>
                </UiTooltip>
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton
                      as="a"
                      href="#!"
                      variant="secondary"
                      size="icon-sm"
                      class="rounded-full"
                      aria-label="Bagikan ke WhatsApp"
                    >
                      <svg
                        class="size-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M12 1.24998C6.06296 1.24998 1.25002 6.06292 1.25002 12C1.25002 13.4809 1.54989 14.8937 2.09293 16.1794C2.23539 16.5167 2.33142 16.7447 2.39557 16.9198C2.46099 17.0985 2.47018 17.1631 2.47134 17.1797C2.47783 17.2736 2.45407 17.4013 2.29192 18.0074L1.2755 21.8061C1.20627 22.0649 1.28029 22.3409 1.46969 22.5303C1.65909 22.7197 1.93512 22.7937 2.19387 22.7245L5.99264 21.7081C6.59867 21.5459 6.72635 21.5222 6.82026 21.5287C6.83692 21.5298 6.90154 21.539 7.08019 21.6044C7.25534 21.6686 7.48326 21.7646 7.82056 21.9071C9.10634 22.4501 10.5191 22.75 12 22.75C17.9371 22.75 22.75 17.937 22.75 12C22.75 6.06292 17.9371 1.24998 12 1.24998ZM8.9729 6.25001L8.88025 6.2499C8.40058 6.24909 7.95809 6.24834 7.52291 6.44712C7.20676 6.59154 6.93775 6.83689 6.74186 7.08194C6.54597 7.32699 6.3659 7.64344 6.29467 7.98364C6.19703 8.44998 6.27755 8.80481 6.36369 9.18439L6.37558 9.23689C6.8101 11.1612 7.82592 13.048 9.38873 14.6109C10.9515 16.1737 12.8384 17.1895 14.7627 17.624L14.8152 17.6359C15.1948 17.722 15.5496 17.8026 16.0159 17.7049C16.3561 17.6337 16.6726 17.4536 16.9176 17.2577C17.1627 17.0618 17.408 16.7928 17.5525 16.4767C17.7512 16.0415 17.7505 15.599 17.7497 15.1193L17.7496 15.0267C17.7496 14.8063 17.7428 14.4352 17.5998 14.0922C17.4291 13.6824 17.0773 13.3447 16.5258 13.2583L16.5201 13.2574L16.5197 13.2573C15.8364 13.1502 15.317 13.0688 14.9496 13.0154C14.7657 12.9887 14.6131 12.9679 14.4937 12.9544C14.3955 12.9432 14.2605 12.9292 14.1475 12.9358C13.6579 12.9645 13.2686 13.1631 12.967 13.3697C12.7751 13.5013 12.5665 13.6774 12.4025 13.8159C12.3381 13.8703 12.2805 13.9189 12.2336 13.9567L12.1562 14.019L12.1562 14.0191C11.861 14.2568 11.7133 14.3756 11.5313 14.3719C11.3493 14.3681 11.2157 14.2512 10.9486 14.0174C10.7787 13.8687 10.6121 13.7129 10.4494 13.5502C10.2866 13.3874 10.1309 13.2209 9.98214 13.051C9.74835 12.7839 9.63146 12.6503 9.62771 12.4683C9.62397 12.2863 9.74282 12.1386 9.98054 11.8434L10.0428 11.766C10.0807 11.719 10.1293 11.6615 10.1837 11.5971L10.1837 11.5971C10.3222 11.4331 10.4983 11.2245 10.6299 11.0326C10.8365 10.731 11.0351 10.3416 11.0638 9.85208C11.0704 9.73911 11.0564 9.60406 11.0452 9.50591C11.0316 9.38649 11.0109 9.23385 10.9842 9.04995C10.9308 8.68246 10.8493 8.16299 10.7422 7.47944L10.7413 7.47375C10.6549 6.92231 10.3172 6.57051 9.90741 6.39975C9.5644 6.25681 9.19327 6.25001 8.9729 6.25001Z"
                          fill="currentColor"
                        />
                      </svg>
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent side="right">WhatsApp</UiTooltipContent>
                </UiTooltip>
                <UiTooltip>
                  <UiTooltipTrigger as-child>
                    <UiButton
                      as="a"
                      href="#!"
                      variant="secondary"
                      size="icon-sm"
                      class="rounded-full"
                      aria-label="Salin tautan"
                    >
                      <svg
                        class="size-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9.521 14.4356L14.434 9.52258"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          vector-effect="non-scaling-stroke"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M12.569 15.1084C13.3087 16.2488 13.1113 17.4178 12.2568 18.2723L9.26158 21.2675C8.28318 22.2459 6.69687 22.2459 5.71847 21.2675L2.73234 18.2814C1.75393 17.303 1.75393 15.7167 2.73234 14.7383L5.72755 11.743C6.42949 11.0411 7.76361 10.6357 8.91007 11.4659M15.1088 12.5685C16.2492 13.3082 17.4182 13.1109 18.2727 12.2564L21.2679 9.26114C22.2463 8.28273 22.2463 6.69641 21.2679 5.718L18.2818 2.73185C17.3034 1.75344 15.7171 1.75344 14.7387 2.73185L11.7434 5.72709C11.0415 6.42903 10.6362 7.76315 11.4664 8.90962"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          vector-effect="non-scaling-stroke"
                        />
                      </svg>
                    </UiButton>
                  </UiTooltipTrigger>
                  <UiTooltipContent side="right">Salin tautan</UiTooltipContent>
                </UiTooltip>
              </div>
            </UiTooltipProvider>
          </div>
        </div>
      </div>
      <div
        class="grid-item col-span-full | lg:col-span-8 lg:col-start-3 w-full"
      >
        <article class="prose dark:prose-invert max-w-none mx-auto">
          <h3>
            Program UMKM Naik Kelas Jawa Barat Mendorong Pertumbuhan Ekonomi
            Lokal
          </h3>

          <p class="text-justify">
            Jawa Barat, sebagai salah satu provinsi dengan populasi terbesar di
            Indonesia, memiliki peran penting dalam perekonomian nasional. Usaha
            Mikro, Kecil, dan Menengah (UMKM) menjadi salah satu pilar utama
            dalam pembangunan ekonomi daerah ini. Pemerintah Jawa Barat
            meluncurkan Program UMKM Naik Kelas untuk mendukung pertumbuhan dan
            pengembangan pengusaha, yang tidak hanya meningkatkan pendapatan
            masyarakat, tetapi juga menciptakan lapangan kerja.
          </p>

          <h3>Peningkatan Akses Lokal</h3>

          <p class="text-justify">
            Peningkatan akses lokal bagi pengusaha merupakan langkah strategis
            untuk mendorong pertumbuhan ekonomi yang inklusif dan berkelanjutan.
            Dengan memperluas jaringan distribusi, menyediakan infrastruktur
            pendukung seperti pasar digital lokal, serta memperkuat kemitraan
            dengan pemerintah daerah dan pelaku usaha besar, pengusaha dapat
            lebih mudah menjangkau konsumen di wilayah sekitarnya. Selain itu,
            akses terhadap pelatihan, pembiayaan, dan informasi pasar yang
            relevan akan meningkatkan daya saing pengusaha di tingkat lokal,
            menciptakan lapangan kerja, serta mendorong tumbuhnya ekosistem
            usaha yang lebih sehat dan berdaya saing tinggi.
          </p>

          <h3>Pelatihan dan Pengembangan Keterampilan</h3>

          <p class="text-justify">
            Pelatihan dan pengembangan keterampilan bagi pengusaha merupakan
            kunci utama dalam meningkatkan kapasitas dan daya saing pengusaha di
            tengah dinamika pasar yang terus berkembang. Melalui program UMKM
            Naik Kelas Jawa Barat, seperti manajemen keuangan, pemasaran
            digital, pengemasan produk, serta inovasi dan teknologi, pengusaha
            dapat memperoleh pengetahuan praktis yang langsung dapat diterapkan
            dalam usaha mereka. Selain itu, pendampingan berkelanjutan dan akses
            terhadap pendamping profesional juga penting untuk memastikan bahwa
            keterampilan yang diperoleh dapat berkembang seiring waktu. Dengan
            demikian, pengusaha tidak hanya mampu bertahan, tetapi juga tumbuh
            dan bersaing di pasar lokal maupun global.
          </p>
          <h3>Pemasaran dan Branding Produk</h3>
          <p class="text-justify">
            Pemasaran dan branding produk merupakan aspek krusial bagi pengusaha
            dalam membangun identitas usaha yang kuat dan menarik minat
            konsumen. Dengan strategi pemasaran yang tepat, seperti pemanfaatan
            media sosial, platform e-commerce, dan kolaborasi dengan influencer
            lokal, pengusaha dapat menjangkau pasar yang lebih luas dan
            meningkatkan visibilitas produk mereka. Selain itu, branding yang
            konsisten—mulai dari desain kemasan, logo, hingga cerita di balik
            produk—dapat menciptakan nilai tambah dan membangun loyalitas
            pelanggan. Pendekatan ini tidak hanya membantu meningkatkan
            penjualan, tetapi juga memperkuat posisi pengusaha di tengah
            persaingan pasar yang semakin ketat.
          </p>
          <h3>Kemitraan dan Kolaborasi</h3>
          <p class="text-justify">
            Melalui kerja sama dengan berbagai pihak seperti pelaku usaha besar,
            lembaga keuangan, hingga komunitas lokal, pengusaha dapat memperoleh
            akses terhadap sumber daya, teknologi, dan pasar yang sebelumnya
            sulit dijangkau secara mandiri. Kolaborasi juga membuka peluang
            untuk inovasi bersama, berbagi pengetahuan, serta menciptakan
            ekosistem usaha yang saling mendukung. Dengan membangun kemitraan
            yang saling menguntungkan, pengusaha dapat lebih cepat berkembang
            dan beradaptasi dalam menghadapi tantangan maupun peluang di era
            digital dan globalisasi.
          </p>
          <h3>Sarana dan Prasarana Pendukung</h3>
          <p class="text-justify">
            Sarana dan prasarana pendukung memainkan peran vital dalam
            keberhasilan Program UMKM Naik Kelas. Pemerintah telah menyediakan
            berbagai fasilitas seperti Pusat Layanan Usaha Terpadu (PLUT),
            inkubator bisnis, fasilitasi kemasan, dan fasilitasi multimedia .
            Selain itu, unit pelatihan seperti UPTD P3W dilengkapi dengan
            instruktur, kurikulum yang sesuai, serta modul dan materi pelatihan
            yang mendukung kebutuhan pengusaha. Di tingkat kab./kota juga
            berperan aktif dalam menyediakan infrastruktur dasar seperti akses
            internet, ruang usaha, dan pusat pelatihan untuk mendukung
            pertumbuhan pengusaha di wilayahnya. Kolaborasi antara pemerintah,
            lembaga swadaya masyarakat, dan masyarakat setempat menjadi kunci
            dalam menciptakan ekosistem yang kondusif bagi pengembangan
            pengusaha melalui penyediaan sarana dan prasarana yang memadai.
          </p>
        </article>
      </div>
    </div>
  </div>
</template>
