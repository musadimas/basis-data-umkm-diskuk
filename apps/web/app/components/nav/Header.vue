<script setup lang="ts">
import { ChevronDown, Menu, User, LogOut, Settings, LayoutDashboard } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";

interface NavItem { label: string; to: string }
const navLinks: NavItem[] = [
  { label: "Beranda", to: "/" }, { label: "Dashboard", to: "/dashboard" },
  { label: "Katalog", to: "/katalog" }, { label: "Konsultasi", to: "/konsultasi" },
];
const route = useRoute();
const mobileOpen = ref(false);
const auth = useAuth();
const displayName = computed(() => auth.user.value?.first_name || auth.user.value?.email || "Pengguna DisKUK");
const initials = computed(() => displayName.value.slice(0, 1).toUpperCase());
const isActive = (to: string) => to === "/dashboard" ? route.path.startsWith("/dashboard") : route.path === to;
</script>

<template>
  <header role="banner" class="sticky top-0 z-40 w-full border-b border-border/80 bg-white/95 shadow-md backdrop-blur-md dark:bg-background/95">
    <div class="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 xl:max-w-5xl">
      <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="Beranda Basis Data UMKM">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-tr from-sky-600 to-blue-500 text-white shadow-xs"><LayoutDashboard class="h-5 w-5 stroke-[2.2]" /></div>
        <span class="text-base font-bold tracking-tight text-foreground sm:text-lg">Dashboard UMKM</span>
      </NuxtLink>
      <nav class="hidden items-center gap-1 md:flex lg:gap-2" aria-label="Navigasi Utama">
        <NuxtLink v-for="link in navLinks" :key="link.to" :to="link.to" class="relative px-3.5 py-2 text-sm font-semibold transition-colors hover:text-brand-green-foreground" :class="isActive(link.to) ? 'font-bold text-brand-green-foreground' : 'text-muted-foreground'">
          {{ link.label }}<span v-if="isActive(link.to)" class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-green" />
        </NuxtLink>
      </nav>
      <div class="flex items-center gap-2 sm:gap-3">
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <button type="button" class="hidden items-center gap-2.5 rounded-full p-1 pl-2.5 transition-colors hover:bg-slate-100 sm:flex" aria-label="Menu akun">
              <span class="text-xs font-semibold text-foreground">{{ displayName }}</span><ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950">{{ initials }}</div>
            </button>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-52">
            <UiDropdownMenuLabel>{{ auth.user.value?.email || "Akun Pengelola" }}</UiDropdownMenuLabel><UiDropdownMenuSeparator />
            <UiDropdownMenuItem class="cursor-pointer"><User class="mr-2 h-4 w-4" /><span>Profil DisKUK</span></UiDropdownMenuItem>
            <UiDropdownMenuItem class="cursor-pointer"><Settings class="mr-2 h-4 w-4" /><span>Pengaturan Data</span></UiDropdownMenuItem>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem class="cursor-pointer text-destructive" :disabled="auth.pending.value" @click="auth.logout"><LogOut class="mr-2 h-4 w-4" /><span>Keluar</span></UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
        <UiSheet v-model:open="mobileOpen">
          <UiSheetTrigger as-child><button type="button" class="flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden" aria-label="Buka navigasi mobile"><Menu class="h-5 w-5" /></button></UiSheetTrigger>
          <UiSheetContent side="right" class="w-72 pt-16">
            <UiSheetHeader><UiSheetTitle class="text-left text-base font-bold">Dashboard UMKM</UiSheetTitle></UiSheetHeader>
            <nav class="mt-6 flex flex-col gap-1.5" aria-label="Navigasi Menu Mobile">
              <NuxtLink v-for="link in navLinks" :key="link.to" :to="link.to" class="rounded-lg px-3 py-2 text-sm font-semibold" :class="isActive(link.to) ? 'bg-brand-green/10 text-brand-green-foreground' : 'text-foreground/80'" @click="mobileOpen = false">{{ link.label }}</NuxtLink>
            </nav>
            <div class="mt-8 border-t border-border pt-4"><div class="flex items-center gap-3 px-2"><div class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950">{{ initials }}</div><div><div class="text-sm font-bold">{{ displayName }}</div><div class="text-xs text-muted-foreground">{{ auth.user.value?.email }}</div></div></div><button type="button" class="mt-4 flex items-center text-sm text-destructive" @click="auth.logout"><LogOut class="mr-2 h-4 w-4" />Keluar</button></div>
          </UiSheetContent>
        </UiSheet>
      </div>
    </div>
  </header>
</template>
