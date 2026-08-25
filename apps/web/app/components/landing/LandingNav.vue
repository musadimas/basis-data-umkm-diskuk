<script setup lang="ts">
import { Menu, User } from "@lucide/vue";
import type { NavLink } from "@/types/landing";

const navLinks: NavLink[] = [
  { label: "Tentang Program", to: "/tentang-program" },
  { label: "Dashboard", to: "/public-dashboard" },
  { label: "Katalog", to: "/katalog" },
  { label: "Konsultasi", to: "/konsultasi" },
  // { label: "Download", to: "/download" },
];

const route = useRoute();
const mobileOpen = ref(false);
const isScrolled = ref(false);

onMounted(() => {
  const { lenis } = useLenis();
  lenis?.on("scroll", ({ scroll }: { scroll: number }) => {
    isScrolled.value = scroll > 1;
  });
});

function isActive(to: string) {
  return route.path === to;
}
</script>

<template>
  <header role="banner" class="fixed top-0 z-50 w-full h-30 pt-4">
    <div
      class="absolute inset-0 transition-all duration-500 h-full"
      :class="
        isScrolled
          ? 'bg-linear-to-b from-white to-transparent'
          : 'bg-linear-to-b from-white/10 to-transparent'
      "
    />

    <div class="relative isolate px-4 lg:px-8">
      <div
        class="mx-auto max-w-7xl! flex h-16 items-center justify-between gap-8"
      >
        <NuxtLink
          to="/"
          class="flex items-center h-10 shrink-0"
          aria-label="Beranda Diskuk"
        >
          <NuxtImg
            src="/images/logo-umkm-diskuk.png"
            alt="UMKM Diskuk Jawa Barat"
            class="h-15 w-auto object-contain"
          />
        </NuxtLink>

        <nav
          class="hidden lg:flex items-center gap-1"
          aria-label="Navigasi utama"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 rounded-md text-sm font-semibold transition-colors hover:text-primary"
            :class="isActive(link.to) ? 'text-primary' : 'text-foreground/70'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="hidden lg:flex items-center gap-2 shrink-0">
          <UiButton
            variant="ghost"
            size="sm"
            as-child
            class="group relative bg-transparent hover:bg-transparent"
          >
            <NuxtLink to="/sign-in" class="font-semibold">
              Login
              <span
                class="absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 bg-blue-500 transition-transform duration-300 group-hover:scale-x-100"
                aria-hidden="true"
              />
            </NuxtLink>
          </UiButton>
        </div>

        <div class="flex lg:hidden items-center gap-2">
          <UiButton variant="outline" size="icon" as-child>
            <NuxtLink to="/sign-in" aria-label="Login ke akun">
              <User class="size-4" />
            </NuxtLink>
          </UiButton>

          <UiSheet v-model:open="mobileOpen">
            <UiSheetTrigger as-child>
              <UiButton
                variant="outline"
                size="icon"
                aria-label="Buka menu navigasi"
              >
                <Menu class="size-4" />
              </UiButton>
            </UiSheetTrigger>
            <UiSheetContent side="left" class="w-72 pt-16">
              <UiSheetHeader>
                <UiSheetTitle
                  class="text-left text-base font-bold tracking-tight"
                >
                  DISKUK Jawa Barat
                </UiSheetTitle>
              </UiSheetHeader>
              <nav
                class="flex flex-col gap-1 mt-6"
                aria-label="Navigasi mobile"
              >
                <NuxtLink
                  v-for="link in navLinks"
                  :key="link.to"
                  :to="link.to"
                  class="px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  :class="
                    isActive(link.to)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground/70'
                  "
                  @click="mobileOpen = false"
                >
                  {{ link.label }}
                </NuxtLink>
              </nav>
              <div class="mt-8 flex flex-col gap-2">
                <UiButton variant="outline" as-child>
                  <NuxtLink to="/sign-in" @click="mobileOpen = false"
                    >Login</NuxtLink
                  >
                </UiButton>
              </div>
            </UiSheetContent>
          </UiSheet>
        </div>
      </div>
    </div>
  </header>
</template>
