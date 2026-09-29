<script setup lang="ts">
// Statistik layanan klinik (R04): total konsultasi selesai, waktu respons rata-rata, dan CSAT dari
// `GET /v1/program/klinik/statistik`. Angka `null` dari server berarti belum ada data: halaman
// menuliskannya begitu, tidak pernah sebagai 0. Kegagalan memuat tidak mengganggu formulir pemesanan.
import { statistikKlinik } from "~/lib/klinik";

const directus = useDirectus();
const { data: statistik, status } = useAsyncData("klinik:statistik", () => statistikKlinik(directus));

const bilangan = new Intl.NumberFormat("id-ID");
const satuDesimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const duaDesimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<template>
  <section class="grid gap-3" aria-label="Statistik layanan klinik" data-testid="statistik-klinik">
    <h2 class="text-lg font-bold">Layanan klinik dalam angka</h2>

    <div v-if="status === 'pending'" class="grid gap-3 sm:grid-cols-3" aria-hidden="true">
      <UiSkeleton v-for="urutan in 3" :key="urutan" class="h-28 rounded-xl" />
    </div>
    <p v-else-if="!statistik" role="status" class="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="statistik-gagal">
      Statistik layanan belum dapat dimuat. Formulir konsultasi tetap dapat dipakai.
    </p>
    <dl v-else class="grid gap-3 sm:grid-cols-3">
      <div class="grid content-start gap-1 rounded-xl border bg-card p-4" data-testid="stat-total">
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Konsultasi selesai</dt>
        <dd class="text-3xl font-bold">{{ bilangan.format(statistik.totalSelesai) }}</dd>
        <dd class="text-[11px] text-muted-foreground">{{ statistik.definisi.totalSelesai }}</dd>
      </div>

      <div class="grid content-start gap-1 rounded-xl border bg-card p-4" data-testid="stat-respons">
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waktu respons rata-rata</dt>
        <dd v-if="statistik.respons.rataRataJam !== null" class="text-3xl font-bold">
          {{ satuDesimal.format(statistik.respons.rataRataJam) }} <span class="text-base font-semibold">jam</span>
        </dd>
        <dd v-else class="text-lg font-semibold text-muted-foreground">Belum ada data</dd>
        <dd class="text-xs">
          Target kurang dari {{ statistik.respons.targetJam }} jam<template v-if="statistik.respons.sampel"> · dari {{ bilangan.format(statistik.respons.sampel) }} tiket</template>
        </dd>
        <dd class="text-[11px] text-muted-foreground">{{ statistik.definisi.respons }}</dd>
      </div>

      <div class="grid content-start gap-1 rounded-xl border bg-card p-4" data-testid="stat-csat">
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kepuasan pemohon (CSAT)</dt>
        <dd v-if="statistik.csat.rataRata !== null" class="text-3xl font-bold">
          {{ duaDesimal.format(statistik.csat.rataRata) }} <span class="text-base font-semibold">/ {{ statistik.csat.skalaMaks }}</span>
        </dd>
        <dd v-else class="text-lg font-semibold text-muted-foreground">Belum ada penilaian</dd>
        <dd v-if="statistik.csat.sampel" class="text-xs">dari {{ bilangan.format(statistik.csat.sampel) }} penilaian</dd>
        <dd class="text-[11px] text-muted-foreground">{{ statistik.definisi.csat }}</dd>
      </div>
    </dl>
  </section>
</template>
