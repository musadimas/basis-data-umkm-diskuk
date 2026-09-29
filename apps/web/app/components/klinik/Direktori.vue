<script setup lang="ts">
// Direktori konsultan (R04): siapa yang melayani tiap poli, hari dan jam layanannya, serta slot bebas
// terdekat dari `GET /v1/program/klinik/konsultan`. Konsultan tanpa slot bebas ditampilkan apa adanya,
// bukan disembunyikan. Kegagalan memuat tidak mengganggu formulir pemesanan.
import { HARI_DIREKTORI, direktoriKonsultan } from "~/lib/klinik";

/** Tanggal per kartu yang ditampilkan; sisanya diringkas agar kartu tetap ringkas. */
const MAKS_TANGGAL = 4;

const directus = useDirectus();
const { data: direktori, status } = useAsyncData("klinik:konsultan", () => direktoriKonsultan(directus));

const tanggal = (value: string) => new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const tanggalPendek = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const namaHari = (hari: string) => hari.charAt(0).toUpperCase() + hari.slice(1);
</script>

<template>
  <section class="grid gap-3" aria-label="Direktori konsultan" data-testid="direktori-konsultan">
    <div class="grid gap-1">
      <h2 class="text-lg font-bold">Konsultan kami</h2>
      <p v-if="direktori?.rentang.dari && direktori.rentang.sampai" class="text-sm text-muted-foreground">
        Slot bebas {{ tanggalPendek(direktori.rentang.dari) }} – {{ tanggalPendek(direktori.rentang.sampai) }}. Pilih jadwal lewat formulir <strong>Ajukan konsultasi</strong>.
      </p>
    </div>

    <div v-if="status === 'pending'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      <UiSkeleton v-for="urutan in 3" :key="urutan" class="h-40 rounded-xl" />
    </div>
    <p v-else-if="!direktori" role="status" class="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="direktori-gagal">
      Direktori konsultan belum dapat dimuat. Formulir konsultasi tetap dapat dipakai.
    </p>
    <p v-else-if="!direktori.konsultan.length" role="status" class="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground" data-testid="direktori-kosong">
      Direktori belum tersedia.
    </p>
    <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="item in direktori.konsultan" :key="item.id" class="grid content-start gap-3 rounded-xl border bg-card p-4 text-sm" data-testid="konsultan-kartu">
        <div class="grid gap-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold leading-snug">{{ item.nama }}</h3>
            <span v-if="item.afiliasiLabel" class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary" data-testid="konsultan-afiliasi">{{ item.afiliasiLabel }}</span>
          </div>
          <p class="text-xs text-muted-foreground">{{ item.poli.nama }}</p>
        </div>

        <p class="text-xs">
          <span class="font-medium">Poli & jadwal:</span>
          {{ item.hari.length ? item.hari.map(namaHari).join(", ") : "jadwal mingguan belum diatur" }}<template v-if="item.slot.length"> · {{ item.slot.join(", ") }} WIB</template>
        </p>

        <div class="grid gap-1.5">
          <span class="text-xs font-medium">Slot bebas terdekat</span>
          <p v-if="!item.ketersediaan.length" class="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground" data-testid="konsultan-belum-ada-slot">
            Belum ada slot dalam {{ HARI_DIREKTORI }} hari ke depan.
          </p>
          <template v-else>
            <ul class="grid gap-1.5">
              <li v-for="hari in item.ketersediaan.slice(0, MAKS_TANGGAL)" :key="hari.tanggal" class="flex flex-wrap items-center gap-1.5 text-xs" data-testid="konsultan-tanggal">
                <span class="w-20 shrink-0 font-medium">{{ tanggal(hari.tanggal) }}</span>
                <span v-for="slot in hari.slot" :key="slot" class="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px]">{{ slot }}</span>
              </li>
            </ul>
            <p class="text-[11px] text-muted-foreground">
              {{ item.totalSlotBebas }} slot bebas<template v-if="item.ketersediaan.length > MAKS_TANGGAL"> di {{ item.ketersediaan.length }} tanggal</template>.
            </p>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>
