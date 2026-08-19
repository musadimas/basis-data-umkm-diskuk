<script setup lang="ts">
import { Filter, RotateCcw, X } from "@lucide/vue";

withDefaults(defineProps<{
  activeCount?: number;
  pending?: boolean;
  title?: string;
}>(), {
  activeCount: 0,
  pending: false,
  title: "Filter Data",
});

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ apply: []; reset: [] }>();
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});

const apply = () => {
  emit("apply");
  open.value = false;
};

const reset = () => {
  emit("reset");
  open.value = false;
};
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <UiButton
      type="button"
      class="fixed right-4 bottom-4 z-40 h-11 gap-2 rounded-full bg-brand-green px-4 font-bold text-brand-green-foreground shadow-lg hover:bg-brand-green/90 sm:right-6 sm:bottom-6"
      aria-label="Buka filter data"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = true"
    >
      <Filter class="size-4" />
      <span>Filter Data</span>
      <span
        v-if="activeCount"
        class="grid size-5 place-items-center rounded-full bg-white text-[11px] text-brand-green-foreground"
        aria-label="Jumlah filter aktif"
      >
        {{ activeCount }}
      </span>
    </UiButton>
  </Teleport>

  <UiDialog v-model:open="open">
    <UiDialogContent
      :show-close-button="false"
      class="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl"
    >
      <UiDialogHeader class="flex-row items-start justify-between border-b px-4 py-3 text-left sm:px-5">
        <div class="space-y-1">
          <UiDialogTitle>{{ title }}</UiDialogTitle>
          <UiDialogDescription class="text-xs">
            Pilih satu atau beberapa kriteria, lalu terapkan.
          </UiDialogDescription>
        </div>
        <UiDialogClose as-child>
          <UiButton type="button" variant="ghost" size="icon-sm" aria-label="Tutup filter">
            <X class="size-4" />
          </UiButton>
        </UiDialogClose>
      </UiDialogHeader>

      <div class="overflow-y-auto p-4 sm:p-5">
        <slot />
      </div>

      <UiDialogFooter class="border-t bg-muted/30 px-4 py-3 sm:px-5">
        <UiButton
          type="button"
          variant="outline"
          class="border-brand-green text-brand-green-foreground hover:bg-brand-green/10 hover:text-brand-green-foreground"
          :disabled="pending"
          @click="reset"
        >
          <RotateCcw class="size-4" />
          Reset
        </UiButton>
        <UiButton
          type="button"
          class="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
          :disabled="pending"
          @click="apply"
        >
          <Filter class="size-4" />
          Terapkan Filter
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
