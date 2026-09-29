<script setup lang="ts">
import { ChevronDown, History, LogOut, ShieldCheck } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { appRoleBadge } from "~/constants";

const auth = useAuth();
const user = computed(() => auth.user.value);
const fullName = computed(() => {
  const name = [user.value?.first_name, user.value?.last_name].filter(Boolean).join(" ").trim();
  return name || user.value?.email || "Pengguna DisKUK";
});
const initials = computed(() =>
  fullName.value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(""),
);
const badge = computed(() => appRoleBadge(user.value?.app_role));
const instansi = computed(() => user.value?.instansi || "Dinas Koperasi dan Usaha Kecil Jawa Barat");
const avatarUrl = computed(() =>
  user.value?.avatar ? `/panel/assets/${encodeURIComponent(user.value.avatar)}?width=80&height=80&fit=cover` : undefined,
);
</script>

<template>
  <UiDropdownMenu>
    <UiDropdownMenuTrigger as-child>
      <button
        type="button"
        class="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary sm:pr-3"
        aria-label="Menu akun"
      >
        <UiAvatar class="size-9">
          <UiAvatarImage v-if="avatarUrl" :src="avatarUrl" :alt="fullName" />
          <UiAvatarFallback class="bg-amber-400 text-xs font-bold text-amber-950">{{ initials }}</UiAvatarFallback>
        </UiAvatar>
        <span class="hidden min-w-0 text-left leading-tight sm:grid">
          <span class="flex items-center gap-2">
            <span class="max-w-44 truncate text-sm font-semibold text-foreground">{{ fullName }}</span>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" :class="badge.className">{{ badge.label }}</span>
          </span>
          <span class="max-w-60 truncate text-xs text-muted-foreground">{{ instansi }}</span>
        </span>
        <ChevronDown class="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    </UiDropdownMenuTrigger>
    <UiDropdownMenuContent align="end" class="w-72">
      <UiDropdownMenuLabel class="font-normal">
        <div class="grid gap-1">
          <span class="truncate text-sm font-semibold">{{ fullName }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ user?.email }}</span>
          <span class="flex items-center gap-2 pt-1">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" :class="badge.className">{{ badge.label }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ instansi }}</span>
          </span>
        </div>
      </UiDropdownMenuLabel>
      <UiDropdownMenuSeparator />
      <UiDropdownMenuItem as-child class="cursor-pointer">
        <NuxtLink to="/dashboard/akun"><ShieldCheck class="size-4" />Pengaturan Akun &amp; Keamanan</NuxtLink>
      </UiDropdownMenuItem>
      <UiDropdownMenuItem as-child class="cursor-pointer">
        <NuxtLink to="/dashboard/akun/aktivitas"><History class="size-4" />Log Aktivitas Sesi</NuxtLink>
      </UiDropdownMenuItem>
      <UiDropdownMenuSeparator />
      <UiDropdownMenuItem class="cursor-pointer text-destructive focus:text-destructive" :disabled="auth.pending.value" @select="auth.logout">
        <LogOut class="size-4" />Keluar
      </UiDropdownMenuItem>
    </UiDropdownMenuContent>
  </UiDropdownMenu>
</template>
