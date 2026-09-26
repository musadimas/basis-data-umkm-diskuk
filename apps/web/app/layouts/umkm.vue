<script setup lang="ts">
import { LogOut, ScrollText, UserCog } from "@lucide/vue";
import { NAVIGATION_LINKS } from "~/constants/NAVIGATION";
import { useAuth } from "~/composables/useAuth";
import { useKoneksi } from "~/composables/useKoneksi";
import { useLaporanOutbox } from "~/composables/useLaporanOutbox";

const auth = useAuth();
const route = useRoute();
const usahaNama = computed(() => auth.user.value?.usaha?.nama ?? "Usaha Saya");
const umkmItems = NAVIGATION_LINKS.umkm[0]?.items ?? [];
const { online } = useKoneksi();
const outbox = useLaporanOutbox();

async function keluar() {
  await outbox.muat();
  const n = outbox.items.value.length;
  if (n > 0) {
    const lanjut = window.confirm(
      `Ada ${n} laporan belum tersinkron. Keluar akan menghapusnya dari ponsel ini. Lanjutkan?`,
    );
    if (!lanjut) return;
  }
  await auth.logout();
}
</script>

<template>
  <div class="min-h-svh bg-slate-100 md:flex md:items-center md:justify-center md:py-6">
    <div
      data-testid="umkm-frame"
      class="relative mx-auto flex min-h-svh w-full flex-col bg-background md:h-[844px] md:min-h-0 md:w-[390px] md:overflow-hidden md:rounded-[2.5rem] md:border-8 md:border-slate-900 md:shadow-2xl"
    >
      <header class="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-sm font-bold tracking-tight text-foreground">{{ usahaNama }}</span>
          <NavRoleBadge v-if="auth.user.value" :role="auth.user.value.role" />
        </div>
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <button
              type="button"
              aria-label="Menu profil"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <UserCog class="h-5 w-5" />
            </button>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent align="end" class="w-64">
            <UiDropdownMenuLabel class="truncate">{{ auth.user.value?.email || "Akun Pengelola" }}</UiDropdownMenuLabel>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem as-child class="cursor-pointer">
              <NuxtLink to="/dashboard/akun" class="flex items-center">
                <UserCog class="mr-2 h-4 w-4" />
                <span>Pengaturan Akun &amp; Keamanan</span>
              </NuxtLink>
            </UiDropdownMenuItem>
            <UiDropdownMenuItem as-child class="cursor-pointer">
              <NuxtLink to="/dashboard/audit-sesi" class="flex items-center">
                <ScrollText class="mr-2 h-4 w-4" />
                <span>Log Aktivitas Sesi</span>
              </NuxtLink>
            </UiDropdownMenuItem>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem
              class="cursor-pointer text-destructive"
              :disabled="auth.pending.value"
              @click="keluar()"
            >
              <LogOut class="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
      </header>

      <div
        data-testid="banner-koneksi"
        class="shrink-0 px-4 py-2 text-center text-xs font-semibold"
        :class="online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'"
        role="status"
      >
        {{ online ? "Terhubung - Data Real-Time" : "Mode Offline Aktif - Laporan Akan Disimpan di Memori Ponsel" }}
      </div>

      <main class="flex-1 overflow-y-auto p-4">
        <slot />
      </main>

      <nav
        aria-label="Navigasi UMKM"
        class="grid shrink-0 border-t border-border bg-background"
        :style="{ gridTemplateColumns: `repeat(${umkmItems.length}, minmax(0, 1fr))` }"
      >
        <NuxtLink
          v-for="item in umkmItems"
          :key="item.id"
          :to="item.to"
          class="flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors"
          :class="route.path === item.to ? 'text-amber-700' : 'text-muted-foreground hover:text-foreground'"
        >
          <component :is="item.icon" v-if="item.icon" class="h-5 w-5" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>
