<script setup lang="ts">
import type { RoleKey } from "~/types/operasional";
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "~/constants/ROLES";

defineProps<{ role: RoleKey }>();
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
    :class="ROLE_BADGE_CLASSES[role]"
  >
    {{ ROLE_LABELS[role] }}
  </span>
</template>
