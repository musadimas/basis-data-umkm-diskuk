<script setup lang="ts">
import { endpoint } from "~/lib/directus";
import type { RuntimeLabelMap } from "~/types/directus";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Log Aktivitas Sesi – Dashboard UMKM" });

type ActivityRow = {
  kind: "session" | "data";
  action: string;
  collection: string | null;
  item: string | null;
  ip: string | null;
  user_agent: string | null;
  reason: string | null;
  timestamp: string;
};
type ActivityPage = { items: ActivityRow[]; meta: { page: number; limit: number; hasMore: boolean } };

const PAGE_SIZE = 20;
const directus = useDirectus();
const ACTION_LABELS: RuntimeLabelMap = {
  login: "Masuk berhasil",
  login_failed: "Percobaan masuk gagal",
  create: "Membuat data",
  update: "Mengubah data",
  delete: "Menghapus data",
  comment: "Menambah komentar",
};
const REASON_LABELS: RuntimeLabelMap = {
  INVALID_CREDENTIALS: "kredensial tidak sesuai",
  CAPTCHA_MISSING: "captcha tidak ada",
  CAPTCHA_INVALID: "captcha tidak valid",
  CAPTCHA_EXPIRED: "captcha kedaluwarsa",
  CAPTCHA_REPLAYED: "captcha dipakai ulang",
  USER_SUSPENDED: "akun ditangguhkan",
};

const rows = ref<ActivityRow[]>([]);
const page = ref(0);
const hasMore = ref(true);
const pending = ref(false);
const failed = ref(false);

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

async function loadMore() {
  if (pending.value || !hasMore.value) return;
  pending.value = true;
  failed.value = false;
  try {
    const next = page.value + 1;
    const response = await directus.request(
      endpoint<ActivityPage>("/v1/auth/activity", { query: { page: next, limit: PAGE_SIZE } }),
    );
    rows.value = [...rows.value, ...response.items];
    page.value = next;
    hasMore.value = response.meta.hasMore;
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}

function describe(row: ActivityRow) {
  const label = ACTION_LABELS[row.action] ?? row.action;
  if (row.kind === "session") return row.reason ? `${label} (${REASON_LABELS[row.reason] ?? row.reason})` : label;
  return row.collection ? `${label} · ${row.collection}${row.item ? ` #${row.item}` : ""}` : label;
}

/** Shortens a user agent to a readable "Browser · OS". */
function device(userAgent: string | null) {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Lainnya";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

onMounted(loadMore);
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Log Aktivitas Sesi</h1>
      <p class="mt-1 text-sm text-muted-foreground">Riwayat masuk dan perubahan data oleh akun Anda (audit trail). Laporkan ke admin bila ada aktivitas yang tidak Anda kenali.</p>
    </div>

    <UiCard class="overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-3 font-semibold">Waktu</th>
              <th scope="col" class="px-4 py-3 font-semibold">Aktivitas</th>
              <th scope="col" class="px-4 py-3 font-semibold">Alamat IP</th>
              <th scope="col" class="px-4 py-3 font-semibold">Perangkat</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="(row, index) in rows" :key="`${row.timestamp}-${index}`">
              <td class="whitespace-nowrap px-4 py-3 tabular-nums">{{ dateFormat.format(new Date(row.timestamp)) }}</td>
              <td class="px-4 py-3" :class="row.action === 'login_failed' ? 'font-medium text-destructive' : ''">{{ describe(row) }}</td>
              <td class="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{{ row.ip || "—" }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-muted-foreground" :title="row.user_agent || undefined">{{ device(row.user_agent) }}</td>
            </tr>
            <tr v-if="!rows.length && !pending && !failed">
              <td colspan="4" class="px-4 py-10 text-center text-muted-foreground">Belum ada aktivitas tercatat.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <p v-if="failed" role="alert" class="text-sm text-destructive">Log aktivitas tidak dapat dimuat.</p>
    <div class="flex justify-center">
      <UiButton v-if="hasMore" variant="outline" :disabled="pending" @click="loadMore">
        {{ pending ? "Memuat…" : failed ? "Coba lagi" : "Muat lebih banyak" }}
      </UiButton>
    </div>
  </div>
</template>
