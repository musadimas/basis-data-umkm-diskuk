<script setup lang="ts">
import type { AnalyticsRecord } from "~/types/analytics";
defineProps<{ records: Array<AnalyticsRecord> }>();
const emit = defineEmits<{ (event: "open", record: AnalyticsRecord): void }>();
</script>
<template>
    <section
        class="h-[260px] rounded-lg border bg-card p-4 flex flex-col min-h-0 lg:h-full"
        aria-labelledby="records-title"
    >
        <h2 id="records-title" class="mb-3 shrink-0 font-bold">
            Record dalam hasil
        </h2>
        <div
            class="min-h-0 flex-1 overflow-auto"
            data-lenis-prevent-wheel
        >
            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b">
                        <th class="p-2">Nama usaha</th>
                        <th class="p-2">Kabupaten/kota</th>
                        <th class="p-2">Skala</th>
                        <th class="p-2">Tindakan</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="record in records"
                        :key="record.id"
                        class="border-b"
                    >
                        <td class="p-2">{{ record.nama }}</td>
                        <td class="p-2">{{ record.kota }}</td>
                        <td class="p-2">{{ record.skala }}</td>
                        <td class="p-2">
                            <NuxtLink
                                class="font-semibold underline"
                                :to="`/dashboard/umkm/${record.id}`"
                                @click="emit('open', record)"
                                >Buka profil</NuxtLink
                            >
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p
            v-if="!records.length"
            class="shrink-0 py-6 text-sm text-muted-foreground"
        >
            Tidak ada record pada halaman ini.
        </p>
    </section>
</template>
