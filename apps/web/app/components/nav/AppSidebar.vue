<script setup lang="ts">
import type { SidebarProps } from "../ui/sidebar/index";
import { NAVIGATION_LINKS } from "~/constants";

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
});
</script>

<template>
  <UiSidebar v-bind="props">
    <UiSidebarHeader class="h-16.25">
      <!-- <NavTeamSwitcher :teams="data.teams" /> -->
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
    <!-- <UiSidebarFooter>
      <NavUser :user="data.user" />
    </UiSidebarFooter> -->
    <UiSidebarRail />
  </UiSidebar>
</template>
