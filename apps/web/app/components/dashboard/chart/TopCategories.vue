<script setup lang="ts">
import type { TopCategoryItem } from "~/types/dashboard"
import { formatAnalyticsNumber } from "~/lib/analytics-format"
const props=withDefaults(defineProps<{ items?: Array<TopCategoryItem>; buttonText?: string; buttonHref?: string }>(),{items:()=>[],buttonText:"Lihat Data"})
const emit=defineEmits<{ (event: "click:action", item?: TopCategoryItem): void }>()
const maxValue=computed(()=>Math.max(1,...props.items.map((item)=>item.value)))
const hovered=ref<string|null>(null)
</script>
<template><div class="flex h-full flex-col justify-between space-y-3"><div v-if="items.length" class="space-y-3" role="list" aria-label="Kategori lapangan usaha teratas"><button v-for="item in items" :key="item.code" type="button" class="block w-full text-left" role="listitem" @mouseenter="hovered=item.code" @mouseleave="hovered=null" @click="emit('click:action',item)"><div class="mb-1 flex justify-between gap-2 text-xs"><span class="font-semibold">{{ item.code }} · {{ item.name }}</span><span>{{ formatAnalyticsNumber(item.value) }}</span></div><div class="h-3 rounded-full bg-muted"><div class="h-full rounded-full bg-emerald-600" :style="{width:`${Math.max(2,item.value/maxValue*100)}%`}" /></div><span v-if="hovered===item.code" class="sr-only">{{ formatAnalyticsNumber(item.value) }}</span></button></div><p v-else class="py-6 text-sm text-muted-foreground">Belum ada kategori terpetakan.</p><div class="flex justify-center pt-2"><NuxtLink v-if="buttonHref" :to="buttonHref" class="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white">{{ buttonText }}</NuxtLink><button v-else type="button" class="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white" @click="emit('click:action')">{{ buttonText }}</button></div></div></template>
