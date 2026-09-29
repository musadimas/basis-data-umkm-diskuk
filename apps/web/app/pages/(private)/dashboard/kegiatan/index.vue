<script setup lang="ts">
// R03/N7-02: panel panitia — daftar pendaftar, keputusan seleksi, tugas, sertifikat,
// ekspor XLSX tanpa NIK, dan pemindai QR presensi (rahasia internal tetap di server).
import { Download, ScanLine, ShieldCheck } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { endpoint } from "~/lib/directus";
import { requestErrorCode, requestStatus } from "~/lib/request-error";
import type { KegiatanListResponse, KeputusanHasil, RegistrasiPendaftarListItem } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Kegiatan & Pendaftar – Dashboard UMKM" });

const directus = useDirectus();
const auth = useAuth();
const peran = computed(() => auth.user.value?.app_role ?? null);
const staf = computed(() => ["provinsi", "kabkota"].includes(peran.value ?? ""));

const { data: agenda } = await useAsyncData("kegiatan:panitia", async () => {
  if (!staf.value) return null;
  const payload = await directus.request(endpoint<KegiatanListResponse>("/v1/program/kegiatan"));
  return payload;
});
const opsiKegiatan = computed(() => (agenda.value?.items ?? []).filter((item) => item.pendaftaranInternal));
const kegiatanTerpilih = ref("");
watchEffect(() => {
  if (!kegiatanTerpilih.value && opsiKegiatan.value.length) kegiatanTerpilih.value = opsiKegiatan.value[0]!.id;
});

const pendaftar = ref<RegistrasiPendaftarListItem[]>([]);
const muatPendaftar = ref(false);
const pesan = ref<string | null>(null);
async function muatDaftar() {
  if (!kegiatanTerpilih.value) return;
  muatPendaftar.value = true;
  try {
    const payload = await directus.request(endpoint<RegistrasiPendaftarListItem[]>(`/v1/program/registrasi/kegiatan/${kegiatanTerpilih.value}/pendaftar`));
    pendaftar.value = payload;
  } catch {
    pendaftar.value = [];
  } finally {
    muatPendaftar.value = false;
  }
}
watch(kegiatanTerpilih, () => {
  pesan.value = null;
  muatDaftar();
}, { immediate: true });

const PESAN = new Map(Object.entries({
  KUOTA_PENUH: "Kuota penuh — tolak atau daftar tunggu dulu, atau naikkan kuota kegiatan.",
  BELUM_LAYAK: "Belum layak: kehadiran di bawah 80% atau tugas belum selesai.",
  PENDAFTARAN_NOT_FOUND: "Pendaftaran tidak ditemukan (mungkin di luar wilayah Anda).",
}));

async function putuskan(pendaftaranId: string, keputusan: string) {
  pesan.value = null;
  try {
    const hasil = await directus.request(
      endpoint<KeputusanHasil, { keputusan: string }>(`/v1/program/registrasi/pendaftar/${pendaftaranId}/keputusan`, { method: "POST", body: { keputusan } }),
    );
    pesan.value =
      hasil.daftarTungguNaik
        ? `Keputusan ${keputusan} tersimpan; peserta daftar tunggu tertua dinaikkan ke diterima.`
        : `Keputusan ${keputusan} tersimpan.`;
    await muatDaftar();
  } catch (cause) {
    pesan.value = PESAN.get(requestErrorCode(cause) ?? "") ?? "Keputusan gagal disimpan.";
  }
}

async function nilaiTugas(pendaftaran: RegistrasiPendaftarListItem, selesai: boolean) {
  pesan.value = null;
  try {
    await directus.request(endpoint<unknown, { selesai: boolean }>(`/v1/program/registrasi/pendaftar/${pendaftaran.id}/tugas`, { method: "POST", body: { selesai } }));
    pesan.value = `Tugas ${pendaftaran.usahaNama ?? "peserta"} ditandai ${selesai ? "selesai" : "belum selesai"}.`;
    await muatDaftar();
  } catch {
    pesan.value = "Penilaian tugas gagal disimpan.";
  }
}

async function terbitkan(pendaftaran: RegistrasiPendaftarListItem) {
  pesan.value = null;
  try {
    const hasil = await directus.request(endpoint<{ kode: string; duplikat: boolean }>(`/v1/program/registrasi/pendaftar/${pendaftaran.id}/sertifikat`, { method: "POST" }));
    pesan.value = hasil.duplikat ? `Sertifikat aktif sudah ada: ${hasil.kode}.` : `Sertifikat diterbitkan: ${hasil.kode}.`;
    await muatDaftar();
  } catch (cause) {
    pesan.value = PESAN.get(requestErrorCode(cause) ?? "") ?? "Penerbitan sertifikat gagal.";
  }
}

async function cabut(pendaftaran: RegistrasiPendaftarListItem) {
  pesan.value = null;
  try {
    await directus.request(endpoint(`/v1/program/registrasi/sertifikat/${pendaftaran.sertifikatId}/cabut`, { method: "POST" }));
    pesan.value = `Sertifikat ${pendaftaran.sertifikatKode} dicabut; indikator dampak dinonaktifkan.`;
    await muatDaftar();
  } catch {
    pesan.value = "Pencabutan gagal.";
  }
}

async function unduhXlsx() {
  pesan.value = null;
  try {
    const response: unknown = await directus.request(endpoint(`/v1/program/registrasi/kegiatan/${kegiatanTerpilih.value}/pendaftar/xlsx`));
    if (!(response instanceof Response)) throw new Error("Balasan ekspor bukan berkas.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const tautan = document.createElement("a");
    tautan.href = url;
    tautan.download = `pendaftar-${kegiatanTerpilih.value}.xlsx`;
    tautan.click();
    URL.revokeObjectURL(url);
  } catch {
    pesan.value = "Ekspor XLSX gagal.";
  }
}

const PESAN_PINDAI = new Map([[401, "Sesi tidak valid."], [403, "Pemindai hanya untuk staf."], [503, "Pemindai presensi belum dikonfigurasi."]]);
const qrInput = ref("");
const sesiKe = ref(1);
const hasilPindai = ref<string | null>(null);
async function pindai() {
  hasilPindai.value = null;
  try {
    const respons = await $fetch<{ data?: { hadir: number; jumlahSesi: number; persen: number } }>("/api/operasional/pindai", {
      method: "POST",
      body: { qr: qrInput.value.trim(), sesiKe: sesiKe.value },
    });
    hasilPindai.value = `Hadir ${respons.data?.hadir}/${respons.data?.jumlahSesi} sesi (${respons.data?.persen}%). Scan ulang sesi yang sama tidak menambah hitungan.`;
    qrInput.value = "";
  } catch (cause) {
    hasilPindai.value = PESAN_PINDAI.get(requestStatus(cause) ?? 0) ?? "Pindai gagal — periksa QR dan sesi.";
  }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold">Kegiatan & Pendaftar</h1>
      <p class="text-sm text-muted-foreground">Seleksi peserta pendaftaran internal, presensi QR, tugas, dan e-sertifikat.</p>
    </header>

    <p v-if="!staf" class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" data-testid="tolak-nonstaf">
      Panel ini hanya untuk staf provinsi/kabkota.
    </p>

    <template v-else>
      <section class="rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="mb-1 block font-medium">Kegiatan pendaftaran internal</span>
            <select v-model="kegiatanTerpilih" class="h-9 min-w-64 rounded-md border bg-transparent px-2 text-sm" data-testid="pilih-kegiatan">
              <option v-for="item in opsiKegiatan" :key="item.id" :value="item.id">{{ item.judul }}</option>
            </select>
          </label>
          <UiButton type="button" variant="outline" :disabled="!kegiatanTerpilih" data-testid="tombol-xlsx" @click="unduhXlsx">
            <Download class="size-4" /> Ekspor XLSX
          </UiButton>
        </div>
        <p v-if="pesan" class="mt-3 text-sm text-muted-foreground" data-testid="pesan-panitia">{{ pesan }}</p>
      </section>

      <section class="rounded-xl border bg-card p-5 shadow-sm">
        <h2 class="flex items-center gap-2 font-bold"><ScanLine class="size-4" /> Pemindai presensi e-pass</h2>
        <form class="mt-3 flex flex-wrap items-end gap-3" @submit.prevent="pindai">
          <label class="min-w-72 flex-1 text-sm">
            <span class="mb-1 block font-medium">QR e-pass (DISKUK-EPASS:…)</span>
            <input v-model="qrInput" type="text" class="h-9 w-full rounded-md border bg-transparent px-3 text-sm" placeholder="Tempel hasil scan QR" data-testid="input-qr" required>
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium">Sesi ke-</span>
            <input v-model.number="sesiKe" type="number" min="1" max="60" class="h-9 w-20 rounded-md border bg-transparent px-3 text-sm" data-testid="input-sesi">
          </label>
          <UiButton type="submit" data-testid="tombol-pindai">Catat hadir</UiButton>
        </form>
        <p v-if="hasilPindai" class="mt-3 text-sm text-muted-foreground" data-testid="hasil-pindai">{{ hasilPindai }}</p>
      </section>

      <section class="rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between border-b p-5">
          <h2 class="font-bold">Pendaftar ({{ pendaftar.length }})</h2>
          <span v-if="muatPendaftar" class="text-sm text-muted-foreground">Memuat…</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="tabel-pendaftar">
            <thead>
              <tr class="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th class="p-3">Usaha</th>
                <th class="p-3">Kota</th>
                <th class="p-3">Status</th>
                <th class="p-3">Skor Talent</th>
                <th class="p-3">Tugas</th>
                <th class="p-3">Sertifikat</th>
                <th class="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pendaftar" :key="item.id" class="border-b last:border-0" :data-testid="`baris-${item.id}`">
                <td class="p-3 font-medium">{{ item.usahaNama ?? "—" }}<span v-if="item.usahaSkala" class="block text-xs text-muted-foreground">{{ item.usahaSkala }}</span></td>
                <td class="p-3">{{ item.usahaKota ?? "—" }}</td>
                <td class="p-3"><span class="rounded-full bg-muted px-2 py-1 text-xs font-semibold">{{ item.status }}</span></td>
                <td class="p-3">{{ item.skorTalent ?? "—" }}</td>
                <td class="p-3">
                  <template v-if="item.status === 'diterima'">
                    <UiButton v-if="!item.tugasSelesai" type="button" variant="outline" size="sm" :data-testid="`tugas-${item.id}`" @click="nilaiTugas(item, true)">Tandai selesai</UiButton>
                    <span v-else class="text-xs text-emerald-700">Selesai</span>
                  </template>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </td>
                <td class="p-3">
                  <span v-if="item.sertifikatKode" class="font-mono text-xs" :data-testid="`kode-${item.id}`">{{ item.sertifikatKode }}</span>
                  <span v-else class="text-xs text-muted-foreground">—</span>
                </td>
                <td class="p-3">
                  <div class="flex flex-wrap gap-1.5">
                    <template v-if="item.status === 'menunggu' || item.status === 'daftar_tunggu'">
                      <UiButton type="button" size="sm" @click="putuskan(item.id, 'diterima')">Terima</UiButton>
                      <UiButton type="button" size="sm" variant="outline" @click="putuskan(item.id, 'ditolak')">Tolak</UiButton>
                    </template>
                    <template v-else-if="item.status === 'diterima'">
                      <UiButton type="button" size="sm" variant="outline" :disabled="Boolean(item.sertifikatKode)" :data-testid="`terbit-${item.id}`" @click="terbitkan(item)">
                        <ShieldCheck class="size-4" /> Terbitkan
                      </UiButton>
                      <UiButton v-if="item.sertifikatKode" type="button" size="sm" variant="outline" :data-testid="`cabut-${item.id}`" @click="cabut(item)">Cabut</UiButton>
                      <UiButton type="button" size="sm" variant="outline" @click="putuskan(item.id, 'batal')">Batalkan</UiButton>
                    </template>
                  </div>
                </td>
              </tr>
              <tr v-if="!pendaftar.length && !muatPendaftar">
                <td colspan="7" class="p-6 text-center text-sm text-muted-foreground" data-testid="pendaftar-kosong">Belum ada pendaftar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
