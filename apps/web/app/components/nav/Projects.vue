<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import { Folder, Forward, MoreHorizontal, Trash2 } from "@lucide/vue";

import { useSidebar } from "@/components/ui/sidebar";

defineProps<{
  projects: {
    name: string;
    url: string;
    icon: LucideIcon;
  }[];
}>();

const { isMobile } = useSidebar();
</script>

<template>
  <UiSidebarGroup class="group-data-[collapsible=icon]:hidden">
    <UiSidebarGroupLabel>Projects</UiSidebarGroupLabel>
    <UiSidebarMenu>
      <UiSidebarMenuItem v-for="item in projects" :key="item.name">
        <UiSidebarMenuButton as-child>
          <a :href="item.url">
            <component :is="item.icon" />
            <span>{{ item.name }}</span>
          </a>
        </UiSidebarMenuButton>
        <UiDropdownMenu>
          <UiDropdownMenuTrigger as-child>
            <UiSidebarMenuAction show-on-hover>
              <MoreHorizontal />
              <span class="sr-only">More</span>
            </UiSidebarMenuAction>
          </UiDropdownMenuTrigger>
          <UiDropdownMenuContent class="w-48 rounded-lg" :side="isMobile ? 'bottom' : 'right'" :align="isMobile ? 'end' : 'start'">
            <UiDropdownMenuItem>
              <Folder class="text-muted-foreground" />
              <span>View Project</span>
            </UiDropdownMenuItem>
            <UiDropdownMenuItem>
              <Forward class="text-muted-foreground" />
              <span>Share Project</span>
            </UiDropdownMenuItem>
            <UiDropdownMenuSeparator />
            <UiDropdownMenuItem>
              <Trash2 class="text-muted-foreground" />
              <span>Delete Project</span>
            </UiDropdownMenuItem>
          </UiDropdownMenuContent>
        </UiDropdownMenu>
      </UiSidebarMenuItem>
      <UiSidebarMenuItem>
        <UiSidebarMenuButton class="text-Uisidebar-foreground/70">
          <MoreHorizontal class="text-Uisidebar-foreground/70" />
          <span>More</span>
        </UiSidebarMenuButton>
      </UiSidebarMenuItem>
    </UiSidebarMenu>
  </UiSidebarGroup>
</template>
