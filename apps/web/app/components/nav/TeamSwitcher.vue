<script setup lang="ts">
import type { Component } from "vue";

import { ChevronsUpDown, Plus } from "@lucide/vue";
import { ref } from "vue";

import { useSidebar } from "@/components/ui/sidebar";

const props = defineProps<{
  teams: {
    name: string;
    logo: Component;
    plan: string;
  }[];
}>();

const { isMobile } = useSidebar();
const activeTeam = ref(props.teams[0]!);
</script>

<template>
  <UiSidebarMenu>
    <UiSidebarMenuItem>
      <UiDropdownMenu>
        <UiDropdownMenuTrigger as-child>
          <UiSidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <component :is="activeTeam.logo" class="size-4" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">
                {{ activeTeam.name }}
              </span>
              <span class="truncate text-xs">{{ activeTeam.plan }}</span>
            </div>
            <ChevronsUpDown class="ml-auto" />
          </UiSidebarMenuButton>
        </UiDropdownMenuTrigger>
        <UiDropdownMenuContent class="w-(--reka-dropdown-menu-trigger-width) min-w-56 rounded-lg" align="start" :side="isMobile ? 'bottom' : 'right'" :side-offset="4">
          <UiDropdownMenuLabel class="text-xs text-muted-foreground"> Teams </UiDropdownMenuLabel>
          <UiDropdownMenuItem v-for="(team, index) in teams" :key="team.name" class="gap-2 p-2" @click="activeTeam = team">
            <div class="flex size-6 items-center justify-center rounded-sm border">
              <component :is="team.logo" class="size-3.5 shrink-0" />
            </div>
            {{ team.name }}
            <UiDropdownMenuShortcut>⌘{{ index + 1 }}</UiDropdownMenuShortcut>
          </UiDropdownMenuItem>
          <UiDropdownMenuSeparator />
          <UiDropdownMenuItem class="gap-2 p-2">
            <div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
              <Plus class="size-4" />
            </div>
            <div class="font-medium text-muted-foreground">Add team</div>
          </UiDropdownMenuItem>
        </UiDropdownMenuContent>
      </UiDropdownMenu>
    </UiSidebarMenuItem>
  </UiSidebarMenu>
</template>
