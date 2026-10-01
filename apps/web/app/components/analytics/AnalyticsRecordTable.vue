<script setup lang="ts">
import type { AnalyticsRecord } from "~/types/analytics";
import { formatAnalyticsNumber } from "~/lib/analytics-format";

const props = defineProps<{
  records: Array<AnalyticsRecord>;
  matched?: number | null;
  pageIndex?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  pending?: boolean;
}>();
const emit = defineEmits<{
  open: [record: AnalyticsRecord];
  next: [];
  prev: [];
}>();

const from = computed(() =>
  props.records.length
    ? (props.pageIndex || 0) * (props.pageSize || 20) + 1
    : 0,
);
const to = computed(
  () => (props.pageIndex || 0) * (props.pageSize || 20) + props.records.length,
);
</script>

<template>
  <section
    class="flex h-[280px] min-h-0 flex-col gap-1.5 rounded-lg border bg-card p-2.5 lg:h-full"
    aria-labelledby="records-title"
  >
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-1.5">
      <h2
        id="records-title"
        class="truncate text-xs font-bold uppercase tracking-wide"
      >
        Baris dalam hasil
        <span class="font-normal normal-case text-muted-foreground">
          ({{
            records.length
              ? `${formatAnalyticsNumber(from)}–${formatAnalyticsNumber(to)}`
              : 0
          }}
          dari {{ formatAnalyticsNumber(matched) }})
        </span>
      </h2>
      <div class="flex items-center gap-1.5">
        <UiButton
          type="button"
          variant="outline"
          class="h-7 px-2 text-xs font-semibold"
          :disabled="!hasPrev || pending"
          @click="emit('prev')"
        >
          Sebelumnya
        </UiButton>
        <UiButton
          type="button"
          variant="outline"
          class="h-7 px-2 text-xs font-semibold"
          :disabled="!hasNext || pending"
          @click="emit('next')"
        >
          Berikutnya
        </UiButton>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto" data-lenis-prevent-wheel>
      <table class="w-full min-w-[38rem] text-left text-xs">
        <thead class="sticky top-0 bg-card">
          <tr class="border-b">
            <th class="p-1.5">Nama usaha</th>
            <th class="p-1.5">Kabupaten/kota</th>
            <th class="p-1.5">Kecamatan</th>
            <th class="p-1.5">Skala</th>
            <th class="p-1.5">Kategori</th>
            <th class="p-1.5">KBLI</th>
            <th class="p-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="record in records"
            :key="record.id"
            class="border-b align-top"
          >
            <td class="p-1.5">
              <NuxtLink
                class="font-semibold underline"
                :to="`/dashboard/umkm/${record.id}`"
                @click="emit('open', record)"
              >
                {{ record.nama }}
              </NuxtLink>
            </td>
            <td class="p-1.5">{{ record.kota }}</td>
            <td class="p-1.5">{{ record.kecamatan }}</td>
            <td class="p-1.5">{{ record.skala }}</td>
            <td class="max-w-[10rem] truncate p-1.5" :title="record.kategori">
              {{ record.kategori }}
            </td>
            <td class="p-1.5">{{ record.kbli }}</td>
            <td class="p-1.5">{{ record.status }}</td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="!records.length"
        class="py-6 text-center text-xs text-muted-foreground"
      >
        Tidak ada baris pada halaman ini.
      </p>
    </div>
  </section>
</template>
