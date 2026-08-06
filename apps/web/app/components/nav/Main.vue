<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import { ChevronRight } from "@lucide/vue";

defineProps<{
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}>();
</script>

<template>
  <UiSidebarGroup>
    <UiSidebarGroupLabel>Platform</UiSidebarGroupLabel>
    <UiSidebarMenu>
      <UiCollapsible v-for="item in items" :key="item.title" as-child :default-open="item.isActive" class="group/Uicollapsible">
        <UiSidebarMenuItem>
          <UiCollapsibleTrigger as-child>
            <UiSidebarMenuButton :tooltip="item.title">
              <component :is="item.icon" v-if="item.icon" />
              <span>{{ item.title }}</span>
              <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/Uicollapsible:rotate-90" />
            </UiSidebarMenuButton>
          </UiCollapsibleTrigger>
          <UiCollapsibleContent>
            <UiSidebarMenuSub>
              <UiSidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                <UiSidebarMenuSubButton as-child>
                  <a :href="subItem.url">
                    <span>{{ subItem.title }}</span>
                  </a>
                </UiSidebarMenuSubButton>
              </UiSidebarMenuSubItem>
            </UiSidebarMenuSub>
          </UiCollapsibleContent>
        </UiSidebarMenuItem>
      </UiCollapsible>
    </UiSidebarMenu>
  </UiSidebarGroup>
</template>
