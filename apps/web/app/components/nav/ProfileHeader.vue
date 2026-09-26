<script setup lang="ts">
import { LogOut, ScrollText, UserCog } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";

const auth = useAuth();
const displayName = computed(() =>
  [auth.user.value?.firstName, auth.user.value?.lastName]
    .filter(Boolean)
    .join(" ")
  || auth.user.value?.email
  || "Pengguna DisKUK");
const initials = computed(() => {
  const parts = displayName.value.trim().split(/\s+/);
  return (parts.length > 1 ? `${parts[0]}${parts[1]}` : displayName.value)
    .slice(0, 2)
    .toUpperCase();
});
const avatarUrl = computed(() =>
  auth.user.value?.avatar
    ? `/panel/assets/${auth.user.value.avatar}?width=64`
    : null);
// Identitas organisasi langsung dari sesi server (kontrak GET /panel/operasional/me):
// instansi untuk provinsi/kabkota/pendamping, nama usaha untuk UMKM.
const affiliation = computed(() => auth.user.value?.instansi ?? null);
const usahaNIB = computed(() => auth.user.value?.usaha?.nib ?? null);
</script>

<template>
  <header class="flex h-14 shrink-0 items-center justify-end gap-3 border-b bg-background px-4">
    <UiDropdownMenu>
      <UiDropdownMenuTrigger as-child>
        <button
          type="button"
          aria-label="Menu profil"
          class="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="displayName"
            class="h-8 w-8 shrink-0 rounded-full object-cover"
          >
          <span
            v-else
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950"
            aria-hidden="true"
          >{{ initials }}</span>
          <span class="hidden max-w-48 flex-col items-start leading-tight sm:flex">
            <span class="w-full truncate text-sm font-medium text-foreground">{{ displayName }}</span>
            <span v-if="affiliation" class="w-full truncate text-xs text-muted-foreground">{{ affiliation }}</span>
          </span>
          <NavRoleBadge v-if="auth.user.value" :role="auth.user.value.role" />
        </button>
      </UiDropdownMenuTrigger>
      <UiDropdownMenuContent align="end" class="w-64">
        <UiDropdownMenuLabel class="flex flex-col items-start gap-0.5">
          <span class="w-full truncate text-sm font-semibold text-foreground">{{ displayName }}</span>
          <span v-if="affiliation" class="w-full truncate text-xs font-normal text-muted-foreground">{{ affiliation }}<template v-if="usahaNIB"> · NIB {{ usahaNIB }}</template></span>
          <span class="w-full truncate text-xs font-normal text-muted-foreground">{{ auth.user.value?.email || "Akun Pengelola" }}</span>
        </UiDropdownMenuLabel>
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
          @click="auth.logout()"
        >
          <LogOut class="mr-2 h-4 w-4" />
          <span>Keluar</span>
        </UiDropdownMenuItem>
      </UiDropdownMenuContent>
    </UiDropdownMenu>
  </header>
</template>
