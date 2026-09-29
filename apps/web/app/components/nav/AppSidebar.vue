<script setup lang="ts">
import type { SidebarProps } from "../ui/sidebar/index";
import { useSidebar } from "../ui/sidebar/utils";
import { PanelLeft } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { NAVIGATION_LINKS, isRoleKey } from "~/constants";

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
});

const auth = useAuth();
const { toggleSidebar } = useSidebar();
// NAVIGATION_LINKS berkunci peran dan setiap nilai berisi daftar section {title, items}.
// Kunci perannya ada di app_role; `role` berisi UUID role Directus. Section yang dipakai
// harus selaras dengan ROLE_ROUTES di constants/ROLES.ts, yang ditegakkan middleware
// auth.global.ts.
// Tanpa app_role yang sah tidak ada menu sama sekali (ADR-009), bukan menu provinsi.
const sections = computed(() => {
  const role = auth.user.value?.app_role;
  return isRoleKey(role) ? NAVIGATION_LINKS[role] : [];
});
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
        v-for="section in sections"
        :key="section.title"
        :title="section.title"
        :items="section.items"
      />
    </UiSidebarContent>
    <UiSidebarFooter>
      <!-- Identity and the account menu live in NavTopbar (top right). -->
      <div class="flex justify-end px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <PanelLeft class="h-4 w-4" />
        </button>
      </div>
    </UiSidebarFooter>
    <UiSidebarRail />
  </UiSidebar>
</template>
