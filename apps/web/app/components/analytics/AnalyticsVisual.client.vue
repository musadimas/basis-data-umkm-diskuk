<script setup lang="ts">
import type { AnalyticsGroup, AnalyticsVisual } from "~/types/analytics";
import {
    formatAnalyticsNumber,
    formatAnalyticsPercent,
} from "~/lib/analytics-format";
const props = defineProps<{
    groups: AnalyticsGroup[];
    visual: AnalyticsVisual;
    drillField?: string | null;
}>();
const emit = defineEmits<{
    select: [group: AnalyticsGroup];
    drill: [group: AnalyticsGroup];
}>();
const max = computed(() =>
    Math.max(1, ...props.groups.map((item) => item.value)),
);
const tableOpen = ref(false);
</script>
<template>
    <section
        class="h-[260px] rounded-lg border bg-card p-4 flex flex-col min-h-0 lg:h-full"
        aria-labelledby="visual-title"
    >
        <div class="mb-3 flex shrink-0 items-center justify-between">
            <h2 id="visual-title" class="font-bold">
                Visualisasi {{ visual }}
            </h2>
            <button
                type="button"
                class="text-sm font-semibold underline"
                @click="tableOpen = !tableOpen"
            >
                {{ tableOpen ? "Sembunyikan tabel" : "Lihat tabel" }}
            </button>
        </div>
        <div
            class="flex-1 min-h-0 overflow-auto"
            data-lenis-prevent-wheel
        >
            <p class="sr-only">
                {{
                    groups
                        .map(
                            (group) =>
                                `${group.label}: ${formatAnalyticsNumber(group.value)} UMKM`,
                        )
                        .join(". ")
                }}
            </p>
            <div
                v-if="visual !== 'table' && groups.length"
                class="space-y-3"
                role="list"
                aria-label="Kelompok hasil"
            >
                <div
                    v-for="group in groups"
                    :key="`${group.key}-${group.breakdown?.key || ''}`"
                    class="space-y-1"
                    role="listitem"
                >
                    <div class="flex items-center gap-3 text-sm">
                        <button
                            type="button"
                            class="flex min-w-0 flex-1 justify-between gap-3 text-left"
                            @click="emit('select', group)"
                        >
                            <span>{{ group.label }}</span
                            ><span class="shrink-0 font-semibold"
                                >{{ formatAnalyticsNumber(group.value) }} ·
                                {{ formatAnalyticsPercent(group.share) }}</span
                            ></button
                        ><button
                            v-if="drillField"
                            type="button"
                            class="shrink-0 text-xs font-semibold underline"
                            @click="emit('drill', group)"
                        >
                            Drill down
                        </button>
                    </div>
                    <div class="h-3 rounded-full bg-muted">
                        <div
                            class="h-full rounded-full bg-emerald-600"
                            :style="{
                                width: `${Math.max(2, (group.value / max) * 100)}%`,
                            }"
                        />
                    </div>
                </div>
            </div>
            <p
                v-else-if="!groups.length"
                class="py-10 text-center text-sm text-muted-foreground"
            >
                Belum ada data untuk filter ini.
            </p>
            <AnalyticsDataTable
                v-if="tableOpen || visual === 'table'"
                :groups="groups"
            />
        </div>
    </section>
</template>
