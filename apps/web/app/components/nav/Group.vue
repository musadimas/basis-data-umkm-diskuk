<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import { ChevronRight } from "@lucide/vue";

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  items?: { id: string; label: string; to: string }[];
}

const props = defineProps<{
  items: NavItem[];
  title: string;
}>();

const route = useRoute();
const isItemActive = (to: string) => route.path === to;
const formattedTitle = computed(() =>
  props.title
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" "),
);
</script>

<template>
  <UiSidebarGroup>
    <UiSidebarGroupLabel>{{ formattedTitle }}</UiSidebarGroupLabel>
    <UiSidebarMenu>
      <template v-for="item in items" :key="item.id">
        <UiCollapsible
          v-if="item.items?.length"
          as-child
          :default-open="item.items.some((subItem) => isItemActive(subItem.to))"
          class="group/collapsible"
        >
          <UiSidebarMenuItem>
            <UiCollapsibleTrigger as-child>
              <UiSidebarMenuButton :tooltip="item.label">
                <component :is="item.icon" v-if="item.icon" />
                <span>{{ item.label }}</span>
                <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </UiSidebarMenuButton>
            </UiCollapsibleTrigger>
            <UiCollapsibleContent>
              <UiSidebarMenuSub>
                <UiSidebarMenuSubItem v-for="subItem in item.items" :key="subItem.id">
                  <UiSidebarMenuSubButton as-child :is-active="isItemActive(subItem.to)">
                    <NuxtLink :to="subItem.to">
                      <span>{{ subItem.label }}</span>
                    </NuxtLink>
                  </UiSidebarMenuSubButton>
                </UiSidebarMenuSubItem>
              </UiSidebarMenuSub>
            </UiCollapsibleContent>
          </UiSidebarMenuItem>
        </UiCollapsible>

        <UiSidebarMenuItem v-else>
          <UiSidebarMenuButton
            as-child
            :is-active="isItemActive(item.to)"
            :tooltip="item.label"
          >
            <NuxtLink
              :to="item.to"
              class="transition-colors ease-in-out"
              :class="[
                isItemActive(item.to)
                  ? 'text-brand-green-foreground! dark:text-brand-green'
                  : 'text-slate-400! group-hover/menu-item:text-foreground!',
              ]"
            >
              <component :is="item.icon" v-if="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </UiSidebarMenuButton>
        </UiSidebarMenuItem>
      </template>
    </UiSidebarMenu>
  </UiSidebarGroup>
</template>
