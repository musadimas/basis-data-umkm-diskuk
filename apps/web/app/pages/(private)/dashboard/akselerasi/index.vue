<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Program Akselerasi – DISKUK Jawa Barat",
});

interface Batch {
  id: string;
  kode: string;
  nama: string;
  tahap: string;
  tanggalMulai: string;
  jumlahMinggu: number;
  faktorTarget: number;
  jumlahPeserta: number;
}

interface Peserta {
  talentaId: string;
  usaha: { id: string; nama: string | null };
  kota: string | null;
  status: string;
  batch: { id: string; nama: string; tahap: string } | null;
  pendamping: { id: string; nama: string | null } | null;
  mingguBerjalan: number;
  jumlahMinggu: number | null;
  targetMingguan: number | null;
  rekomendasiPitching: boolean;
  laporanTerakhir: { mingguKe: number; status: string } | null;
}

const batch = ref<Batch[]>([]);
const peserta = ref<Peserta[]>([]);
const pesan = ref<string | null>(null);

async function muat() {
  const b = await $fetch<{ data: Batch[] }>("/panel/operasional/batch");
  batch.value = b.data;
  const p = await $fetch<{ data: Peserta[] }>("/panel/operasional/akselerasi/peserta");
  peserta.value = p.data;
}

onMounted(() => {
  void muat();
});

const kode = ref("");
const nama = ref("");
const tahap = ref("accelerator");
const tanggalMulai = ref("");

async function buatBatch() {
  pesan.value = null;
  try {
    await $fetch("/panel/operasional/batch", {
      method: "POST",
      body: { kode: kode.value, nama: nama.value, tahap: tahap.value, tanggalMulai: tanggalMulai.value },
    });
    pesan.value = "Batch tersimpan.";
    await muat();
  } catch (error) {
    pesan.value = (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.[0]?.message ?? "Gagal menyimpan batch.";
  }
}

const dialogTahap = ref<Peserta | null>(null);
const pilihBatch = ref("");
const pilihPendamping = ref("");
const daftarPendamping = ref<{ id: string; nama: string }[]>([]);

async function bukaTahap(p: Peserta, tujuan: string) {
  dialogTahap.value = p;
  (dialogTahap.value as Peserta & { tujuan?: string }).tujuan = tujuan;
  const d = await $fetch<{ data: { id: string; nama: string }[] }>("/panel/operasional/pendamping");
  daftarPendamping.value = d.data;
}

async function simpanTahap() {
  if (!dialogTahap.value) return;
  const tujuan = (dialogTahap.value as Peserta & { tujuan?: string }).tujuan ?? "accelerator";
  await $fetch(`/panel/operasional/talenta/${dialogTahap.value.talentaId}/tahap`, {
    method: "POST",
    body: { tahap: tujuan, batchId: pilihBatch.value || undefined, pendampingId: pilihPendamping.value || undefined },
  });
  dialogTahap.value = null;
  await muat();
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 pb-8">
    <h1 class="text-2xl font-bold">Program Akselerasi</h1>

    <section class="rounded border bg-card p-4">
      <h2 class="font-bold">Peserta Program</h2>
      <table class="mt-2 w-full text-xs">
        <thead>
          <tr class="border-b text-left">
            <th class="p-2">Usaha</th>
            <th class="p-2">Kab/Kota</th>
            <th class="p-2">Tahap</th>
            <th class="p-2">Batch</th>
            <th class="p-2">Pendamping</th>
            <th class="p-2">Minggu</th>
            <th class="p-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in peserta" :key="p.talentaId" class="border-b">
            <td class="p-2">{{ p.usaha.nama }}</td>
            <td class="p-2">{{ p.kota ?? "—" }}</td>
            <td class="p-2">{{ p.status }}</td>
            <td class="p-2">{{ p.batch?.nama ?? "—" }}</td>
            <td class="p-2">{{ p.pendamping?.nama ?? "—" }}</td>
            <td class="p-2">{{ p.mingguBerjalan }}</td>
            <td class="p-2 space-x-2">
              <button type="button" class="rounded border px-2 py-0.5" @click="bukaTahap(p, 'talent_lab')">Pindah ke Talent Lab</button>
              <button type="button" class="rounded border px-2 py-0.5" @click="bukaTahap(p, 'accelerator')">Masuk Accelerator</button>
              <button
                type="button"
                class="rounded border px-2 py-0.5 disabled:opacity-40"
                :disabled="!p.rekomendasiPitching"
                @click="bukaTahap(p, 'champion')"
              >
                Tetapkan Champion
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="rounded border bg-card p-4">
      <h2 class="font-bold">Batch Program</h2>
      <ul class="mt-2 text-xs">
        <li v-for="b in batch" :key="b.id">{{ b.kode }} — {{ b.nama }} ({{ b.tahap }})</li>
      </ul>
      <form class="mt-3 grid grid-cols-2 gap-2 text-sm" @submit.prevent="buatBatch()">
        <label>Kode <input v-model="kode" class="w-full rounded border p-1" ></label>
        <label>Nama <input v-model="nama" class="w-full rounded border p-1" ></label>
        <label>Tahap
          <select v-model="tahap" class="w-full rounded border p-1">
            <option value="talent_lab">talent_lab</option>
            <option value="accelerator">accelerator</option>
          </select>
        </label>
        <label>Tanggal mulai <input v-model="tanggalMulai" placeholder="YYYY-MM-DD" class="w-full rounded border p-1" ></label>
        <button type="submit" class="col-span-2 rounded bg-slate-900 px-3 py-1 text-white">Buat Batch</button>
      </form>
    </section>

    <div v-if="dialogTahap" role="dialog" aria-label="Ubah tahap" class="rounded border bg-card p-4">
      <h3 class="font-bold">Ubah tahap {{ dialogTahap.usaha.nama }}</h3>
      <label class="block text-sm">Batch
        <select v-model="pilihBatch" class="w-full rounded border p-1">
          <option value="">Pilih batch</option>
          <option v-for="b in batch" :key="b.id" :value="b.id">{{ b.nama }}</option>
        </select>
      </label>
      <label class="block text-sm">Pendamping
        <select v-model="pilihPendamping" class="w-full rounded border p-1">
          <option value="">Pilih pendamping</option>
          <option v-for="d in daftarPendamping" :key="d.id" :value="d.id">{{ d.nama }}</option>
        </select>
      </label>
      <button type="button" class="mt-2 rounded bg-emerald-600 px-3 py-1 text-white" @click="simpanTahap()">Simpan</button>
    </div>

    <p v-if="pesan" role="status" class="text-sm">{{ pesan }}</p>
  </div>
</template>
