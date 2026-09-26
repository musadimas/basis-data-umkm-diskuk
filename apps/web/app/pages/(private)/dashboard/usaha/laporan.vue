<script setup lang="ts">
import { useKoneksi } from "~/composables/useKoneksi";
import { useLaporanOutbox } from "~/composables/useLaporanOutbox";
import { useBerkasUpload } from "~/composables/useBerkasUpload";
import { formatAnalyticsCurrency } from "~/lib/analytics-format";
import { mingguKe, isJumatJakarta } from "~/lib/program-week";
import type { UsahaSaya, LaporanSaya } from "~/types/operasional";

definePageMeta({
  layout: "umkm",
});

useSeoMeta({
  title: "Laporan KPI – Dashboard UMKM",
});

const { online, tandaiSukses, tandaiGagalJaringan } = useKoneksi();
const outbox = useLaporanOutbox();
const { uploadBerkas } = useBerkasUpload();

const profil = ref<UsahaSaya | null>(null);
const riwayat = ref<LaporanSaya[]>([]);
const target = ref<number | null>(null);
const mingguAktif = ref(0);
const jumlahMinggu = ref(0);
const omzet = ref("");
const jumlahTransaksi = ref("");
const catatan = ref("");
const berkas = ref<File | null>(null);
const pesan = ref<string | null>(null);
const mengirim = ref(false);
const canSubmit = computed(() => !mengirim.value);

async function muat() {
  try {
    const res = await $fetch<{ data: UsahaSaya }>("/panel/operasional/usaha-saya");
    profil.value = res.data;
    tandaiSukses();
    const t = res.data.talenta;
    if (t?.batch) {
      const m = mingguKe(t.batch.tanggalMulai, new Date());
      mingguAktif.value = Math.min(m, t.batch.jumlahMinggu);
      jumlahMinggu.value = t.batch.jumlahMinggu;
      target.value = t.targetMingguan;
    }
  } catch (error) {
    const e = error as { data?: unknown };
    if (e?.data === undefined) tandaiGagalJaringan();
  }
  try {
    const lap = await $fetch<{ data: LaporanSaya[] }>("/panel/operasional/laporan-saya");
    riwayat.value = lap.data;
  } catch {
    /* abaikan */
  }
  await outbox.muat();
}

onMounted(() => {
  void muat();
});

function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement;
  berkas.value = input.files?.[0] ?? null;
}

const galeriRef = ref<HTMLInputElement | null>(null);

function pilihGaleri() {
  galeriRef.value?.click();
}

function validasi(): string | null {
  const o = Number(omzet.value);
  const tr = Number(jumlahTransaksi.value);
  if (!Number.isInteger(o) || o < 0 || o > 1_000_000_000_000) return "Realisasi omzet 0–1.000.000.000.000.";
  if (!Number.isInteger(tr) || tr < 0 || tr > 1_000_000) return "Jumlah transaksi 0–1.000.000.";
  if (!berkas.value) return "Unggah bukti transaksi wajib.";
  if (berkas.value.size > 10 * 1024 * 1024) return "Ukuran berkas maksimal 10 MB.";
  if (catatan.value.length > 1000) return "Catatan maksimal 1000 karakter.";
  return null;
}

async function kirim() {
  pesan.value = null;
  const masalah = validasi();
  if (masalah) {
    pesan.value = masalah;
    return;
  }
  mengirim.value = true;
  try {
    const clientUuid = crypto.randomUUID();
    const dikirimPada = new Date().toISOString();
    const file = berkas.value as File;
    if (!online.value) {
      const blob = file.slice(0, file.size, file.type);
      await outbox.enqueue({
        clientUuid,
        mingguKe: mingguAktif.value,
        omzet: Number(omzet.value),
        jumlahTransaksi: Number(jumlahTransaksi.value),
        catatanKendala: catatan.value || null,
        dikirimPada,
        bukti: blob,
        buktiNama: file.name,
        buktiTipe: file.type,
        error: null,
      });
      pesan.value =
        "Koneksi internet tidak terdeteksi. Laporan berhasil diamankan di ponsel Anda. Sinkronisasi otomatis akan berjalan saat online.";
      return;
    }
    try {
      const { id: buktiFileId } = await uploadBerkas(file, `Bukti laporan minggu ${mingguAktif.value}`);
      await $fetch("/panel/operasional/laporan", {
        method: "POST",
        body: {
          clientUuid,
          mingguKe: mingguAktif.value,
          omzet: Number(omzet.value),
          jumlahTransaksi: Number(jumlahTransaksi.value),
          buktiFileId,
          catatanKendala: catatan.value || null,
          dikirimPada,
        },
      });
      tandaiSukses();
      pesan.value = `Laporan minggu ke-${mingguAktif.value} terkirim.`;
      await muat();
    } catch (error) {
      const e = error as { data?: unknown; status?: number };
      if (e?.data === undefined) {
        tandaiGagalJaringan();
        await outbox.enqueue({
          clientUuid,
          mingguKe: mingguAktif.value,
          omzet: Number(omzet.value),
          jumlahTransaksi: Number(jumlahTransaksi.value),
          catatanKendala: catatan.value || null,
          dikirimPada,
          bukti: file.slice(0, file.size, file.type),
          buktiNama: file.name,
          buktiTipe: file.type,
          error: null,
        });
        pesan.value =
          "Koneksi internet tidak terdeteksi. Laporan berhasil diamankan di ponsel Anda. Sinkronisasi otomatis akan berjalan saat online.";
      } else {
        const msg = (e.data as { errors?: { message?: string }[] })?.errors?.[0]?.message;
        pesan.value = msg ?? "Laporan ditolak server.";
      }
    }
  } finally {
    mengirim.value = false;
  }
}

const jumatIni = computed(() => isJumatJakarta(new Date()));
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Laporan Kinerja Mingguan</h1>
    <p class="text-xs text-muted-foreground">
      Laporan hanya dapat dibuat pada hari Jumat (WIB). Laporan offline yang dibuat Jumat
      tersimpan di perangkat dan tersinkron otomatis (maks 7 hari), terhapus dari ponsel setelah terkirim.
    </p>

    <section class="rounded-xl border bg-card p-4">
      <dl class="space-y-1 text-sm">
        <div class="flex justify-between">
          <dt>Target KPI Mingguan</dt>
          <dd>{{ target === null ? "Target belum tersedia" : formatAnalyticsCurrency(target) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>Minggu ke</dt>
          <dd>{{ mingguAktif }}</dd>
        </div>
        <div class="flex justify-between">
          <dt>Hari ini Jumat (WIB)</dt>
          <dd>{{ jumatIni ? "Ya" : "Bukan" }}</dd>
        </div>
      </dl>
    </section>

    <form class="space-y-3 rounded-xl border bg-card p-4" @submit.prevent="kirim()">
      <label class="block text-sm">
        Realisasi Omzet Mingguan (Rp)
        <input v-model="omzet" inputmode="numeric" class="mt-1 w-full rounded border p-2" placeholder="19000000" >
      </label>
      <label class="block text-sm">
        Jumlah Transaksi / Pesanan
        <input v-model="jumlahTransaksi" inputmode="numeric" class="mt-1 w-full rounded border p-2" placeholder="42" >
      </label>
      <div class="text-sm">
        <p>Unggah Bukti Transaksi</p>
        <input type="file" accept="image/*" capture="environment" class="mt-1 w-full" aria-label="Unggah Bukti Transaksi" @change="onFile" >
        <button type="button" class="mt-2 rounded border px-3 py-1 text-xs" @click="pilihGaleri">
          Pilih dari Galeri
        </button>
        <input ref="galeriRef" type="file" accept="image/*" class="sr-only" aria-label="Pilih dari Galeri" @change="onFile" >
        <p v-if="berkas" class="mt-1 text-xs">Terpilih: {{ berkas.name }}</p>
      </div>
      <label class="block text-sm">
        Catatan Singkat Kendala Produksi/Pasar
        <textarea v-model="catatan" rows="3" class="mt-1 w-full rounded border p-2" placeholder="Contoh: harga bahan baku naik, pengiriman terlambat" />
      </label>
      <button
        type="submit"
        :disabled="!canSubmit"
        class="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Kirim Laporan Kinerja Mingguan
      </button>
    </form>

    <p v-if="pesan" role="status" class="rounded-xl border bg-muted/40 p-3 text-sm">{{ pesan }}</p>

    <section class="rounded-xl border bg-card p-4">
      <h2 class="text-sm font-bold">Riwayat Laporan</h2>
      <ul class="mt-2 space-y-1 text-xs">
        <li v-for="l in riwayat" :key="l.id">
          Minggu {{ l.mingguKe }} — {{ formatAnalyticsCurrency(l.omzet) }} — {{ l.status }}
        </li>
        <li v-for="o in outbox.items.value" :key="o.clientUuid">
          Minggu {{ o.mingguKe }} — Menunggu sinkronisasi{{ o.error ? `: ${o.error}` : "" }}
        </li>
      </ul>
    </section>
  </div>
</template>
