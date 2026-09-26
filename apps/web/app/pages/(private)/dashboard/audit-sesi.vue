<script setup lang="ts">
import type { AktivitasItem } from "~/types/operasional";
import { formatAnalyticsWib } from "~/lib/analytics-format";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Log Aktivitas Sesi – Dashboard Basis Data UMKM DisKUK Jawa Barat",
});

// Endpoint bisa mengembalikan array langsung atau bungkus Directus { data: [...] }.
const { data: aktivitasData, error } = await useFetch<
  AktivitasItem[] | { data: AktivitasItem[] }
>("/panel/operasional/aktivitas");

const items = computed<AktivitasItem[]>(() => {
  const value = aktivitasData.value;
  if (Array.isArray(value)) return value;
  return value?.data ?? [];
});

const ACTION_LABELS = new Map<string, string>([
  ["login", "Masuk"],
  ["logout", "Keluar"],
  ["create", "Membuat"],
  ["update", "Mengubah"],
  ["delete", "Menghapus"],
]);

function actionLabel(action: string) {
  return ACTION_LABELS.get(action) ?? action;
}

/**
 * Deskripsi perangkat ringkas dari user agent. String UA mentah tidak
 * pernah dirender agar tidak membocorkan sidik jari perangkat.
 */
function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Perangkat tidak dikenal";
  if (userAgent.includes("Mobile")) return "Perangkat mobile";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  return "Perangkat tidak dikenal";
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5 pb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Log Aktivitas Sesi (Audit Trail)</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Riwayat aktivitas akun Anda, dicatat otomatis oleh sistem (waktu WIB).
      </p>
    </div>

    <p
      v-if="error"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Log aktivitas belum dapat dimuat. Silakan coba lagi.
    </p>

    <div v-else-if="items.length" class="overflow-x-auto rounded-xl border border-border/80 bg-card">
      <table class="w-full text-left text-sm">
        <caption class="sr-only">Log aktivitas sesi Anda</caption>
        <thead>
          <tr class="border-b border-border/80 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th scope="col" class="px-4 py-3">Waktu</th>
            <th scope="col" class="px-4 py-3">Aksi</th>
            <th scope="col" class="px-4 py-3">Perangkat</th>
            <th scope="col" class="px-4 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-b border-border/40 last:border-b-0"
          >
            <td class="px-4 py-3 whitespace-nowrap text-foreground">{{ formatAnalyticsWib(item.timestamp) }}</td>
            <td class="px-4 py-3 text-foreground">{{ actionLabel(item.action) }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ deviceLabel(item.userAgent) }}</td>
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">{{ item.ip ?? "–" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="rounded-xl border border-border/80 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      Belum ada aktivitas tercatat.
    </p>
  </div>
</template>
