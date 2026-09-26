<script setup lang="ts">
import { readItems } from "@directus/sdk";
import { Check, CheckCircle2, Paperclip, Search, X } from "@lucide/vue";
import { SKALA_LABEL } from "~/constants";
import { endpoint, endpointForm } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import type { KlinikPoli, KlinikSlot, KlinikTiketDibuat, KlinikUsahaDitemukan } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Klinik Konsultasi UMKM – Diskuk Jawa Barat",
  description: "Ajukan konsultasi gratis dengan pendamping DISKUK Jawa Barat: legalitas, keuangan, pemasaran, produksi, SDM, dan ekspor.",
});

const STEPS = ["Identitas", "Permasalahan", "Jadwal", "Konfirmasi"];
const MAX_LAMPIRAN = 3;
const MAX_MB = 5;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const ERRORS: Record<string, string> = {
  CAPTCHA_INVALID: "Captcha kedaluwarsa. Centang ulang lalu coba lagi.",
  NOMOR_TIDAK_VALID: "Periksa jumlah digit NIB (13) atau NIK (16).",
  SLOT_PENUH: "Slot ini baru saja dipesan orang lain. Pilih slot lain.",
  REF_KEDALUWARSA: "Data usaha perlu dicari ulang di langkah 1.",
  LAMPIRAN_TIDAK_DIDUKUNG: "Lampiran harus berupa PDF, JPG, PNG, atau WebP.",
  LAMPIRAN_TERLALU_BESAR: `Setiap lampiran maksimal ${MAX_MB} MB.`,
  TANGGAL_AKHIR_PEKAN: "Konsultasi hanya tersedia Senin–Jumat.",
  TANGGAL_DI_LUAR_RENTANG: "Pilih tanggal mulai besok hingga 30 hari ke depan.",
  INVALID_PAYLOAD: "Periksa kembali isian formulir.",
};

const directus = useDirectus();
const { data: poliList } = await useAsyncData("klinik:poli", async () => {
  try {
    const items = await directus.request(readItems("konsultasi_poli", { fields: ["id", "kode", "nama", "deskripsi", "sort"], sort: ["sort"] } as never));
    return (Array.isArray(items) ? items : []) as KlinikPoli[];
  } catch {
    return [];
  }
});

const step = ref(0);
const form = reactive({
  jenis: "nib" as "nib" | "nik",
  nomor: "",
  usaha: null as KlinikUsahaDitemukan | null,
  namaUsaha: "",
  namaKontak: "",
  whatsapp: "",
  email: "",
  poli: null as number | null,
  deskripsi: "",
  moda: "daring" as "daring" | "luring",
  tanggal: "",
  slot: "",
});
const lampiran = ref<File[]>([]);
const error = ref("");

// ── Step 1: identity lookup ──────────────────────────────────────────────────
type CaptchaRef = { solve: () => Promise<string | null>; reset: () => void };
const lookupCaptcha = useTemplateRef<CaptchaRef>("lookupCaptcha");
const found = ref<KlinikUsahaDitemukan[] | null>(null);
const searching = ref(false);

async function cariUsaha() {
  error.value = "";
  searching.value = true;
  try {
    const token = await lookupCaptcha.value?.solve();
    if (!token) {
      error.value = "Verifikasi captcha belum selesai.";
      return;
    }
    found.value = await directus.request(
      endpoint<KlinikUsahaDitemukan[], { jenis: string; nomor: string; captcha: string }>("/v1/program/klinik/lookup", {
        method: "POST",
        body: { jenis: form.jenis, nomor: form.nomor.replace(/\D/g, ""), captcha: token },
      }),
    );
    form.usaha = found.value.length === 1 ? found.value[0]! : null;
  } catch (cause) {
    const code = requestErrorCode(cause);
    error.value = (code && ERRORS[code]) || "Pencarian gagal. Coba lagi.";
  } finally {
    lookupCaptcha.value?.reset();
    searching.value = false;
  }
}

// ── Step 2: attachments ─────────────────────────────────────────────────────
function addLampiran(event: Event) {
  const input = event.target as HTMLInputElement;
  error.value = "";
  for (const file of input.files ?? []) {
    if (lampiran.value.length >= MAX_LAMPIRAN) {
      error.value = `Maksimal ${MAX_LAMPIRAN} lampiran.`;
      break;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      error.value = ERRORS.LAMPIRAN_TERLALU_BESAR!;
      continue;
    }
    lampiran.value.push(file);
  }
  input.value = "";
}

// ── Step 3: date and slot ───────────────────────────────────────────────────
const tanggalMin = ref("");
const tanggalMax = ref("");
onMounted(() => {
  const day = (offset: number) => new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
  tanggalMin.value = day(1);
  tanggalMax.value = day(30);
});
const slots = ref<KlinikSlot[]>([]);
const slotsPending = ref(false);
watch(
  () => [form.poli, form.tanggal] as const,
  async ([poli, tanggal]) => {
    form.slot = "";
    slots.value = [];
    if (!poli || !tanggal) return;
    slotsPending.value = true;
    try {
      slots.value = await directus.request(endpoint<KlinikSlot[]>("/v1/program/klinik/slot", { query: { poli, tanggal } }));
      error.value = "";
    } catch (cause) {
      const code = requestErrorCode(cause);
      error.value = (code && ERRORS[code]) || "Slot tidak dapat dimuat.";
    } finally {
      slotsPending.value = false;
    }
  },
);

// ── Navigation ──────────────────────────────────────────────────────────────
function validate(index: number): string {
  if (index === 0) {
    if (!form.usaha && !form.namaUsaha.trim()) return "Cari usaha lewat NIB/NIK, atau isi nama usaha bila belum terdaftar.";
    if (!form.namaKontak.trim()) return "Isi nama narahubung.";
    if (!/^(\+?62|0)8\d{7,12}$/.test(form.whatsapp.replace(/[\s-]/g, ""))) return "Isi nomor WhatsApp yang valid, mis. 0812xxxxxxx.";
  }
  if (index === 1) {
    if (!form.poli) return "Pilih poli konsultasi.";
    if (form.deskripsi.trim().length < 20) return "Ceritakan permasalahan minimal 20 karakter.";
  }
  if (index === 2 && (!form.tanggal || !form.slot)) return "Pilih tanggal dan slot waktu.";
  return "";
}
function next() {
  error.value = validate(step.value);
  if (!error.value) step.value += 1;
}

// ── Step 4: submit ──────────────────────────────────────────────────────────
const submitCaptcha = useTemplateRef<CaptchaRef>("submitCaptcha");
const submitting = ref(false);
const tiket = ref<KlinikTiketDibuat | null>(null);
const poliNama = computed(() => poliList.value?.find((item) => item.id === form.poli)?.nama ?? "");

async function kirim() {
  error.value = "";
  submitting.value = true;
  try {
    const token = await submitCaptcha.value?.solve();
    if (!token) {
      error.value = "Verifikasi captcha belum selesai.";
      return;
    }
    const body = new FormData();
    body.append(
      "payload",
      JSON.stringify({
        usahaRef: form.usaha?.ref ?? null,
        namaUsaha: form.usaha ? null : form.namaUsaha.trim(),
        namaKontak: form.namaKontak.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim() || null,
        poli: form.poli,
        deskripsi: form.deskripsi.trim(),
        moda: form.moda,
        tanggal: form.tanggal,
        slot: form.slot,
      }),
    );
    body.append("captcha", token);
    for (const file of lampiran.value) body.append("lampiran", file, file.name);
    tiket.value = await directus.request(endpointForm<KlinikTiketDibuat>("/v1/program/klinik/tiket", body));
  } catch (cause) {
    const code = requestErrorCode(cause);
    error.value = (code && ERRORS[code]) || "Tiket tidak dapat dikirim. Coba lagi.";
    if (code === "SLOT_PENUH") step.value = 2;
    if (code === "REF_KEDALUWARSA") step.value = 0;
  } finally {
    submitCaptcha.value?.reset();
    submitting.value = false;
  }
}

const tanggalPanjang = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask title="Klinik Konsultasi" subtitle="Konsultasi" badge-color="#cbd5e1" />

    <div class="mx-auto max-w-3xl px-3 pb-20 | lg:px-0">
      <div v-if="tiket" role="status" class="grid justify-items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-950">
        <CheckCircle2 class="size-12 text-emerald-600" aria-hidden="true" />
        <h2 class="text-xl font-bold">Tiket konsultasi terkirim</h2>
        <p class="font-mono text-2xl font-bold tracking-wider" data-testid="nomor-tiket">{{ tiket.nomor }}</p>
        <p class="text-sm">{{ tiket.poli }} · {{ tiket.moda === "daring" ? "Daring" : "Luring" }} · {{ tanggalPanjang(tiket.tanggal) }}, {{ tiket.slot }} WIB</p>
        <p class="max-w-md text-sm">Simpan nomor tiket ini. Pendamping DISKUK akan menghubungi Anda melalui WhatsApp untuk konfirmasi jadwal.</p>
      </div>

      <template v-else>
        <ol class="mb-8 grid grid-cols-4 gap-2" aria-label="Langkah formulir">
          <li v-for="(label, index) in STEPS" :key="label" class="grid justify-items-center gap-1 text-center text-xs" :aria-current="index === step ? 'step' : undefined">
            <span class="grid size-8 place-items-center rounded-full text-sm font-bold" :class="index < step ? 'bg-emerald-600 text-white' : index === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
              <Check v-if="index < step" class="size-4" /><template v-else>{{ index + 1 }}</template>
            </span>
            <span :class="index === step ? 'font-semibold' : 'text-muted-foreground'">{{ label }}</span>
          </li>
        </ol>

        <form class="grid gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8" novalidate @submit.prevent="step === 3 ? kirim() : next()">
          <!-- Step 1 -->
          <template v-if="step === 0">
            <h2 class="text-lg font-bold">Identitas usaha</h2>
            <fieldset class="grid gap-3">
              <legend class="mb-2 text-sm font-medium">Cari data usaha Anda di SIDT</legend>
              <div class="flex gap-4 text-sm">
                <label class="flex items-center gap-2"><input v-model="form.jenis" type="radio" value="nib" name="jenis"> NIB</label>
                <label class="flex items-center gap-2"><input v-model="form.jenis" type="radio" value="nik" name="jenis"> NIK pemilik</label>
              </div>
              <div class="flex gap-2">
                <UiInput v-model="form.nomor" inputmode="numeric" :maxlength="form.jenis === 'nib' ? 13 : 16" :placeholder="form.jenis === 'nib' ? '13 digit NIB' : '16 digit NIK'" aria-label="Nomor NIB atau NIK" autocomplete="off" />
                <UiButton type="button" variant="outline" :disabled="searching" @click="cariUsaha"><Search class="size-4" /> {{ searching ? "Mencari…" : "Cari" }}</UiButton>
              </div>
              <AuthCaptcha ref="lookupCaptcha" />
            </fieldset>

            <div v-if="found && found.length" class="grid gap-2" role="radiogroup" aria-label="Usaha ditemukan">
              <label v-for="item in found" :key="item.ref" class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm" :class="form.usaha?.ref === item.ref && 'border-primary bg-primary/5'">
                <input v-model="form.usaha" type="radio" :value="item" name="usaha" class="mt-1">
                <span>
                  <span class="font-semibold">{{ item.nama }}</span><br>
                  <span class="text-xs text-muted-foreground">{{ SKALA_LABEL[item.skala ?? ""] || "—" }} · {{ item.kota || "—" }} · KBLI {{ item.kbli || "—" }}</span>
                </span>
              </label>
            </div>
            <p v-else-if="found" class="rounded-md bg-muted p-3 text-sm">Data usaha tidak ditemukan. Anda tetap dapat mengajukan dengan mengisi nama usaha di bawah.</p>

            <div class="grid gap-4 sm:grid-cols-2">
              <UiField v-if="!form.usaha" class="gap-1 sm:col-span-2"><UiFieldLabel for="nama-usaha">Nama usaha</UiFieldLabel><UiInput id="nama-usaha" v-model="form.namaUsaha" maxlength="255" /></UiField>
              <UiField class="gap-1"><UiFieldLabel for="nama-kontak">Nama narahubung</UiFieldLabel><UiInput id="nama-kontak" v-model="form.namaKontak" maxlength="120" autocomplete="name" /></UiField>
              <UiField class="gap-1"><UiFieldLabel for="whatsapp">Nomor WhatsApp</UiFieldLabel><UiInput id="whatsapp" v-model="form.whatsapp" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="0812xxxxxxxx" /></UiField>
              <UiField class="gap-1 sm:col-span-2"><UiFieldLabel for="email">Email (opsional)</UiFieldLabel><UiInput id="email" v-model="form.email" type="email" maxlength="160" autocomplete="email" /></UiField>
            </div>
          </template>

          <!-- Step 2 -->
          <template v-else-if="step === 1">
            <h2 class="text-lg font-bold">Permasalahan</h2>
            <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Poli konsultasi">
              <label v-for="poli in poliList ?? []" :key="poli.id" class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm" :class="form.poli === poli.id && 'border-primary bg-primary/5'">
                <input v-model="form.poli" type="radio" :value="poli.id" name="poli" class="mt-1">
                <span><span class="font-semibold">{{ poli.nama }}</span><br><span class="text-xs text-muted-foreground">{{ poli.deskripsi }}</span></span>
              </label>
            </div>
            <UiField class="gap-1">
              <UiFieldLabel for="deskripsi">Ceritakan permasalahan usaha Anda</UiFieldLabel>
              <UiTextarea id="deskripsi" v-model="form.deskripsi" rows="5" maxlength="3000" />
            </UiField>
            <div class="grid gap-2 text-sm">
              <span class="font-medium">Lampiran (opsional, maks. {{ MAX_LAMPIRAN }} berkas PDF/JPG/PNG, {{ MAX_MB }} MB)</span>
              <ul v-if="lampiran.length" class="grid gap-1">
                <li v-for="(file, index) in lampiran" :key="`${file.name}-${index}`" class="flex items-center gap-2 rounded-md border px-3 py-1.5">
                  <Paperclip class="size-4 shrink-0" aria-hidden="true" /><span class="min-w-0 flex-1 truncate">{{ file.name }}</span>
                  <button type="button" class="rounded p-1 hover:bg-muted" :aria-label="`Hapus ${file.name}`" @click="lampiran.splice(index, 1)"><X class="size-4" /></button>
                </li>
              </ul>
              <input v-if="lampiran.length < MAX_LAMPIRAN" type="file" :accept="ACCEPT" multiple data-testid="lampiran-input" class="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-semibold" @change="addLampiran">
            </div>
          </template>

          <!-- Step 3 -->
          <template v-else-if="step === 2">
            <h2 class="text-lg font-bold">Jadwal konsultasi</h2>
            <fieldset class="flex gap-4 text-sm">
              <legend class="mb-2 font-medium">Metode</legend>
              <label class="flex items-center gap-2"><input v-model="form.moda" type="radio" value="daring" name="moda"> Daring (video call)</label>
              <label class="flex items-center gap-2"><input v-model="form.moda" type="radio" value="luring" name="moda"> Luring (tatap muka)</label>
            </fieldset>
            <UiField class="gap-1">
              <UiFieldLabel for="tanggal">Tanggal (Senin–Jumat)</UiFieldLabel>
              <UiInput id="tanggal" v-model="form.tanggal" type="date" :min="tanggalMin" :max="tanggalMax" class="w-fit" />
            </UiField>
            <div v-if="form.tanggal" class="grid gap-2">
              <span class="text-sm font-medium">Slot waktu (WIB)</span>
              <p v-if="slotsPending" class="text-sm text-muted-foreground">Memuat slot…</p>
              <div v-else class="flex flex-wrap gap-2" role="radiogroup" aria-label="Slot waktu">
                <button
                  v-for="item in slots"
                  :key="item.slot"
                  type="button"
                  role="radio"
                  :aria-checked="form.slot === item.slot"
                  :disabled="!item.tersedia"
                  class="rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  :class="form.slot === item.slot ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="form.slot = item.slot"
                >{{ item.slot }}<span v-if="!item.tersedia" class="sr-only"> (penuh)</span></button>
              </div>
            </div>
          </template>

          <!-- Step 4 -->
          <template v-else>
            <h2 class="text-lg font-bold">Konfirmasi</h2>
            <dl class="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div><dt class="text-xs text-muted-foreground">Usaha</dt><dd class="font-medium">{{ form.usaha?.nama || form.namaUsaha }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">Narahubung</dt><dd>{{ form.namaKontak }} · {{ form.whatsapp }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">Poli</dt><dd>{{ poliNama }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">Jadwal</dt><dd>{{ form.tanggal && tanggalPanjang(form.tanggal) }}, {{ form.slot }} WIB · {{ form.moda === "daring" ? "Daring" : "Luring" }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Permasalahan</dt><dd class="whitespace-pre-line">{{ form.deskripsi }}</dd></div>
              <div v-if="lampiran.length" class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Lampiran</dt><dd>{{ lampiran.map((file) => file.name).join(", ") }}</dd></div>
            </dl>
            <AuthCaptcha ref="submitCaptcha" />
          </template>

          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

          <div class="flex justify-between gap-3">
            <UiButton v-if="step > 0" type="button" variant="outline" :disabled="submitting" @click="(step -= 1), (error = '')">Kembali</UiButton>
            <span v-else />
            <UiButton type="submit" :disabled="submitting">{{ step === 3 ? (submitting ? "Mengirim…" : "Kirim Tiket") : "Lanjut" }}</UiButton>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
