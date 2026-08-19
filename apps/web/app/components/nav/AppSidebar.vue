<script setup lang="ts">
import type { SidebarProps } from "../ui/sidebar/index";
import { useSidebar } from "../ui/sidebar/utils";
import { LogOut, PanelLeft } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { NAVIGATION_LINKS } from "~/constants";

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
});

const auth = useAuth();
const { toggleSidebar } = useSidebar();
const displayName = computed(() => auth.user.value?.first_name || auth.user.value?.email || "Pengguna DisKUK");
const initials = computed(() => displayName.value.slice(0, 1).toUpperCase());
</script>

<template>
  <UiSidebar v-bind="props">
    <UiSidebarHeader class="flex items-center gap-3 px-3 py-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
      <NuxtLink to="/dashboard" class="flex shrink-0 items-center gap-3" aria-label="Dashboard UMKM">
        <img
          src="/images/diskuk-jabar-logo.png"
          alt="DisKUK Jabar"
          class="h-9 w-9 shrink-0 object-contain"
        >
        <span class="truncate text-base font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">Dashboard UMKM</span>
      </NuxtLink>
    </UiSidebarHeader>
    <UiSidebarContent>
      <NavGroup
        v-for="[title, items] of Object.entries(NAVIGATION_LINKS)"
        :key="title"
        :title="title"
        :items="
          title === 'website'
            ? items.filter((item) => item.to !== '/dashboard')
            : items
        "
      />
    </UiSidebarContent>
    <UiSidebarFooter>
      <div class="flex items-center gap-2 px-3 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950">
          {{ initials }}
        </div>
        <div class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div class="truncate text-sm font-medium text-sidebar-foreground">{{ displayName }}</div>
          <div class="truncate text-xs text-sidebar-foreground/60">{{ auth.user.value?.email || "Akun Pengelola" }}</div>
        </div>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <PanelLeft class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-destructive"
          aria-label="Keluar"
          :disabled="auth.pending.value"
          @click="auth.logout"
        >
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </UiSidebarFooter>
    <UiSidebarRail />
  </UiSidebar>
</template>
