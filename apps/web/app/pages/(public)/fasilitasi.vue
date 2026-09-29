<script setup lang="ts">
// R03/N7-03: delapan kartu fasilitasi bantuan — kuota dari sumber yang disetujui,
// hitung mundur dari waktu SERVER (serverNow), CTA hanya ke petunjuk/kanal resmi.
import { ExternalLink, HandCoins } from "@lucide/vue";
import { endpoint } from "~/lib/directus";
import type { BantuanKartu, BantuanListResponse, JenisBantuan } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Fasilitasi Bantuan UMKM – Diskuk Jawa Barat",
  description: "Delapan bentuk fasilitasi bantuan bagi UMKM Jawa Barat: kuota tersisa dan masa pendaftaran dari sumber resmi dinas.",
});

const directus = useDirectus();
const jenis = ref<"semua" | JenisBantuan>("semua");
const { data: respons, status } = await useAsyncData("fasilitasi:kartu", async () => {
  const payload = await directus.request(endpoint<BantuanListResponse>("/v1/program/fasilitasi"));
  return payload;
});

const JENIS_LABEL = { uang: "Uang", barang: "Barang", jasa: "Jasa" } satisfies Record<JenisBantuan, string>;
const STATUS_LABEL = { dibuka: "Pendaftaran dibuka", segera: "Segera dibuka", ditutup: "Pendaftaran ditutup", penuh: "Kuota penuh" } as const;
const STATUS_CLASS = { dibuka: "bg-emerald-100 text-emerald-800", segera: "bg-amber-100 text-amber-900", ditutup: "bg-slate-200 text-slate-700", penuh: "bg-slate-200 text-slate-700" } as const;
const BENTUK_LABEL = {
  penghargaan: "Penghargaan",
  beasiswa: "Beasiswa",
  operasional: "Operasional",
  sarpras_produksi: "Sarpras Produksi",
  sarpras_pemasaran: "Sarpras Pemasaran",
  revitalisasi_gedung: "Revitalisasi/Pembangunan Gedung",
  permodalan: "Permodalan/Pembiayaan",
  lainnya: "Bantuan Pemerintah Lainnya",
} satisfies Record<BantuanKartu["bentuk"], string>;
const kartu = computed(() => respons.value?.items ?? []);

/** Offset klien→server dihitung sekali dari serverNow, lalu dipakai untuk semua countdown. */
const offsetServer = computed(() => {
  const now = respons.value?.meta.serverNow;
  return now ? Date.parse(now) - Date.now() : 0;
});
const detikServer = ref(Date.now() + offsetServer.value);
onMounted(() => {
  const timer = setInterval(() => (detikServer.value = Date.now() + offsetServer.value), 1000);
  onUnmounted(() => clearInterval(timer));
});

/** Sisa waktu ke deadline dari jam server, mis. "3 hari 04:12:09"; null saat tanpa deadline. */
function hitungMundur(kartuItem: BantuanKartu): string | null {
  if (!kartuItem.pendaftaranSelesai) return null;
  const sisa = Date.parse(kartuItem.pendaftaranSelesai) - detikServer.value;
  if (sisa <= 0) return null;
  const totalDetik = Math.floor(sisa / 1000);
  const hari = Math.floor(totalDetik / 86_400);
  const jam = String(Math.floor((totalDetik % 86_400) / 3600)).padStart(2, "0");
  const menit = String(Math.floor((totalDetik % 3600) / 60)).padStart(2, "0");
  const detik = String(totalDetik % 60).padStart(2, "0");
  return hari > 0 ? `${hari} hari ${jam}:${menit}:${detik}` : `${jam}:${menit}:${detik}`;
}

const terfilter = computed(() => (jenis.value === "semua" ? kartu.value : kartu.value.filter((item) => item.bentukBantuan === jenis.value)));
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Fasilitasi Bantuan" subtitle="8 Bentuk Bantuan UMKM" badge-color="#bbf7d0" />
    <div class="mx-auto max-w-7xl px-3 pb-16 | lg:px-12 xl:px-0">
      <p class="max-w-3xl text-sm text-muted-foreground">
        Delapan bentuk fasilitasi bantuan pemerintah bagi UMKM Jawa Barat. Kuota tersisa dihitung dari data resmi dinas dan hitung mundur mengikuti waktu server — bukan jam perangkat Anda.
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-2" data-testid="filter-jenis">
        <button
          v-for="(label, nilai) in ({ semua: 'Semua', ...JENIS_LABEL } as Record<string, string>)"
          :key="nilai"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="jenis === nilai ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
          :data-testid="`filter-${nilai}`"
          @click="jenis = nilai as 'semua' | JenisBantuan"
        >
          {{ label }}
        </button>
      </div>

      <p v-if="status === 'error'" class="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" data-testid="fasilitasi-error">
        Daftar bantuan tidak dapat dimuat. Coba muat ulang halaman.
      </p>
      <p v-else-if="!terfilter.length" class="mt-6 text-sm text-muted-foreground" data-testid="fasilitasi-kosong">
        Belum ada bantuan pada jenis ini.
      </p>

      <div class="mt-6 grid gap-4 | md:grid-cols-2 | xl:grid-cols-4">
        <article
          v-for="item in terfilter"
          :key="item.id"
          class="flex flex-col rounded-xl border bg-card p-5 shadow-sm"
          :data-testid="`kartu-${item.bentuk}`"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <HandCoins class="size-3.5" /> {{ BENTUK_LABEL[item.bentuk] }}
            </span>
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="STATUS_CLASS[item.statusPendaftaran]" :data-testid="`status-${item.bentuk}`">
              {{ STATUS_LABEL[item.statusPendaftaran] }}
            </span>
          </div>
          <h2 class="mt-3 font-semibold leading-snug">{{ item.judul }}</h2>
          <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{{ item.ringkasan ?? "Menunggu kurasi dinas." }}</p>

          <div class="mt-4">
            <template v-if="item.kuota !== null">
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>Kuota terisi {{ item.terisi }}/{{ item.kuota }}</span>
                <span :class="item.sisaKuota === 0 ? 'font-semibold text-destructive' : 'font-semibold'" :data-testid="`sisa-${item.bentuk}`">
                  {{ item.sisaKuota === 0 ? "Kuota habis" : `Sisa ${item.sisaKuota}` }}
                </span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full"
                  :class="item.sisaKuota === 0 ? 'bg-destructive' : 'bg-primary'"
                  :style="{ width: `${Math.min(100, Math.round((item.terisi / Math.max(item.kuota, 1)) * 100))}%` }"
                />
              </div>
            </template>
            <p v-else class="text-xs text-muted-foreground">Kuota tidak dibatasi.</p>
          </div>

          <p v-if="item.pendaftaranSelesai && item.statusPendaftaran !== 'ditutup' && item.statusPendaftaran !== 'penuh'" class="mt-3 text-xs font-medium text-amber-700" :data-testid="`mundur-${item.bentuk}`">
            Tutup dalam {{ hitungMundur(item) ?? "—" }}
          </p>

          <div class="mt-auto flex flex-col gap-2 pt-4">
            <a
              v-if="item.kanalResmi"
              :href="item.kanalResmi"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              :data-testid="`cta-${item.bentuk}`"
            >
              <ExternalLink class="size-4" /> Kanal resmi
            </a>
            <p v-if="item.petunjuk" class="text-xs text-muted-foreground" :data-testid="`petunjuk-${item.bentuk}`">{{ item.petunjuk }}</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
