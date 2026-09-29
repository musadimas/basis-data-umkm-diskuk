<script setup lang="ts">
import { Check, CheckCircle2, Paperclip, X } from "@lucide/vue";
import { SKALA_LABEL } from "~/constants";
import { useAuth } from "~/composables/useAuth";
import { KlinikError, MAX_LAMPIRAN, MAX_LAMPIRAN_MB as MAX_MB, PESAN_KLINIK, daftarPoli, pesanTiket, prefillSaya, slotTersedia } from "~/lib/klinik";
import type { KlinikPrefill, KlinikSlot, KlinikTiketDibuat } from "~/types/program";

definePageMeta({ layout: "landing" });
useSeoMeta({
  title: "Klinik Konsultasi UMKM – Diskuk Jawa Barat",
  description: "Ajukan konsultasi gratis dengan pendamping DISKUK Jawa Barat: legalitas, keuangan, pemasaran, advokasi PMSE, bantuan pemerintah, dan inklusif disabilitas.",
});

const STEPS = ["Identitas", "Permasalahan", "Jadwal", "Konfirmasi"];
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

const directus = useDirectus();
const auth = useAuth();
const { data: poliList } = await useAsyncData("klinik:poli", async () => {
  try {
    return await daftarPoli(directus);
  } catch {
    return [];
  }
});

const step = ref(0);
/** Pengantar, formulir, atau lacak tiket: the visitor picks, and nothing sits behind a login. */
const tampilan = ref<"ajukan" | "lacak">("ajukan");
function keForm() {
  tampilan.value = "ajukan";
  if (import.meta.client) nextTick(() => document.getElementById("form-klinik")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}
const tersalin = ref(false);
async function salinNomor() {
  if (!tiket.value || !import.meta.client) return;
  try {
    await navigator.clipboard.writeText(tiket.value.nomor);
    tersalin.value = true;
    setTimeout(() => (tersalin.value = false), 2_000);
  } catch {
    tersalin.value = false;
  }
}
/** Isian formulir empat langkah; tipe eksplisit agar nilai awal tidak perlu assertion. */
interface FormKonsultasi {
  usaha: KlinikPrefill["usaha"] | null;
  namaUsaha: string;
  namaKontak: string;
  whatsapp: string;
  email: string;
  poli: number | null;
  deskripsi: string;
  moda: "daring" | "luring";
  tanggal: string;
  slot: string;
  consent: boolean;
}

const form = reactive<FormKonsultasi>({
  usaha: null,
  namaUsaha: "",
  namaKontak: "",
  whatsapp: "",
  email: "",
  poli: null,
  deskripsi: "",
  moda: "daring",
  tanggal: "",
  slot: "",
  consent: true,
});
const lampiran = ref<File[]>([]);
const error = ref("");

// ── Step 1: identity from the visitor's own account, never a NIB/NIK lookup ──
// The public form deliberately has no NIB/NIK search: a business is either already on the
// signed-in account (verified against SIDT) or typed by hand and stored as unverified.
type CaptchaRef = { solve: () => Promise<string | null>; reset: () => void };
const prefillSelesai = ref(false);
onMounted(async () => {
  if (!auth.user.value?.id) {
    prefillSelesai.value = true;
    return;
  }
  try {
    const data = await prefillSaya(directus);
    form.usaha = data?.usaha ?? null;
    form.namaKontak ||= data?.kontak.nama ?? "";
    form.email ||= data?.kontak.email ?? "";
    form.whatsapp ||= data?.kontak.whatsapp ?? "";
  } catch {
    form.usaha = null;
  } finally {
    prefillSelesai.value = true;
  }
});

// ── Step 2: attachments ─────────────────────────────────────────────────────
function addLampiran(event: Event) {
  // SAFETY: handler ini hanya dipasang pada <input type="file">, sehingga target-nya selalu elemen input.
  const input = event.target as HTMLInputElement;
  error.value = "";
  for (const file of input.files ?? []) {
    if (lampiran.value.length >= MAX_LAMPIRAN) {
      error.value = `Maksimal ${MAX_LAMPIRAN} lampiran.`;
      break;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      error.value = PESAN_KLINIK.LAMPIRAN_TERLALU_BESAR!;
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
      slots.value = await slotTersedia(directus, poli, tanggal);
      error.value = "";
    } catch (cause) {
      error.value = cause instanceof KlinikError ? cause.pesan : "Slot tidak dapat dimuat.";
    } finally {
      slotsPending.value = false;
    }
  },
);

// ── Navigation ──────────────────────────────────────────────────────────────
function validate(index: number): string {
  if (index === 0) {
    if (!form.usaha && !form.namaUsaha.trim()) return "Isi nama usaha bila belum terdaftar.";
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
    if (!form.poli) {
      error.value = "Pilih poli konsultasi.";
      step.value = 1;
      return;
    }
    tiket.value = await pesanTiket(
      directus,
      {
        namaUsaha: form.usaha ? null : form.namaUsaha.trim(),
        namaKontak: form.namaKontak.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim() || null,
        poli: form.poli,
        deskripsi: form.deskripsi.trim(),
        moda: form.moda,
        tanggal: form.tanggal,
        slot: form.slot,
        consent: form.consent,
      },
      lampiran.value,
      token,
    );
  } catch (cause) {
    error.value = cause instanceof KlinikError ? cause.pesan : "Tiket tidak dapat dikirim. Coba lagi.";
    if (cause instanceof KlinikError && cause.code === "SLOT_PENUH") step.value = 2;
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

    <!-- Landing klinik: the six desks, the four-step flow and the narahubung, then the service figures and consultant directory, before the form. -->
    <div v-if="!tiket && tampilan === 'ajukan' && step === 0" class="mx-auto grid max-w-7xl gap-8 px-3 pb-10 | lg:px-12 xl:px-0">
      <KlinikPengantarKlinik :poli="poliList ?? []" @mulai="keForm" @lacak="tampilan = 'lacak'" />
      <KlinikStatistik />
      <KlinikDirektori />
    </div>

    <div class="mx-auto max-w-3xl px-3 pb-20 | lg:px-0">
      <div v-if="tiket" role="status" class="grid justify-items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-950">
        <CheckCircle2 class="size-12 text-emerald-600" aria-hidden="true" />
        <h2 class="text-xl font-bold">Tiket konsultasi terkirim</h2>
        <p class="font-mono text-2xl font-bold tracking-wider" data-testid="nomor-tiket">{{ tiket.nomor }}</p>
        <p class="text-sm">{{ tiket.poli }} · {{ tiket.moda === "daring" ? "Daring" : "Luring" }} · {{ tanggalPanjang(tiket.tanggal) }}, {{ tiket.slot }} WIB</p>
        <p class="text-xs text-emerald-800" data-testid="status-notifikasi">
          Notifikasi WhatsApp: {{ tiket.notifikasi.label }}<template v-if="tiket.notifikasi.status === 'pending'"> · pesan dikirim setelah gateway aktif</template>
        </p>
        <p class="max-w-md text-sm">Simpan nomor tiket ini. Pendamping DISKUK akan menghubungi Anda melalui WhatsApp untuk konfirmasi jadwal.</p>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <UiButton type="button" variant="outline" size="sm" @click="salinNomor">{{ tersalin ? "Nomor tersalin" : "Salin nomor tiket" }}</UiButton>
          <UiButton type="button" variant="outline" size="sm" @click="(tampilan = 'lacak'), (tiket = null)">Lacak status tiket</UiButton>
        </div>
        <p class="max-w-md text-xs">Baca ulang kapan saja lewat tab <strong>Lacak tiket</strong>, dengan nomor tiket dan nomor WhatsApp di atas.</p>
        <p v-if="tiket.sumberIdentitas === 'manual'" class="max-w-md text-xs">Usaha ini dicatat sebagai <strong>belum terverifikasi</strong>; petugas dapat mencocokkannya ke data SIDT saat konsultasi.</p>
      </div>

      <template v-else>
        <div v-if="step === 0" class="mb-6 flex justify-center gap-2" role="group" aria-label="Tampilan klinik">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" :class="tampilan === 'ajukan' ? 'bg-muted font-semibold' : 'hover:bg-muted'" :aria-pressed="tampilan === 'ajukan'" @click="tampilan = 'ajukan'">Ajukan konsultasi</button>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" :class="tampilan === 'lacak' ? 'bg-muted font-semibold' : 'hover:bg-muted'" :aria-pressed="tampilan === 'lacak'" @click="tampilan = 'lacak'">Lacak tiket</button>
        </div>

        <KlinikLacakTiket v-if="tampilan === 'lacak'" />

        <template v-else>
        <ol class="mb-8 grid grid-cols-4 gap-2" aria-label="Langkah formulir">
          <li v-for="(label, index) in STEPS" :key="label" class="grid justify-items-center gap-1 text-center text-xs" :aria-current="index === step ? 'step' : undefined">
            <span class="grid size-8 place-items-center rounded-full text-sm font-bold" :class="index < step ? 'bg-emerald-600 text-white' : index === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">
              <Check v-if="index < step" class="size-4" /><template v-else>{{ index + 1 }}</template>
            </span>
            <span :class="index === step ? 'font-semibold' : 'text-muted-foreground'">{{ label }}</span>
          </li>
        </ol>

        <form id="form-klinik" class="grid gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8" novalidate @submit.prevent="step === 3 ? kirim() : next()">
          <!-- Step 1 -->
          <template v-if="step === 0">
            <h2 class="text-lg font-bold">Identitas usaha</h2>
            <div v-if="form.usaha" class="grid gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" data-testid="usaha-prefill">
              <span class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Dari data SIDT · terverifikasi</span>
              <span class="text-base font-semibold">{{ form.usaha.nama }}</span>
              <span class="text-xs">{{ SKALA_LABEL[form.usaha.skala ?? ""] || "—" }} · {{ form.usaha.kota || "—" }} · KBLI {{ form.usaha.kbli || "—" }}</span>
            </div>
            <template v-else>
              <p v-if="prefillSelesai" class="rounded-md bg-muted p-3 text-sm">
                <template v-if="auth.user.value?.id">Data SIDT belum tersedia untuk akun ini, jadi tiket akan ditandai <strong>belum terverifikasi</strong>. Isi nama usaha di bawah.</template>
                <template v-else><NuxtLink to="/sign-in" class="underline">Masuk</NuxtLink> agar nama, skala, dan wilayah usaha terisi otomatis dari data SIDT. Tanpa masuk, tiket ditandai <strong>belum terverifikasi</strong>.</template>
              </p>
              <UiField class="gap-1 sm:col-span-2">
                <UiFieldLabel for="nama-usaha">Nama usaha</UiFieldLabel>
                <UiInput id="nama-usaha" v-model="form.namaUsaha" maxlength="255" />
              </UiField>
            </template>

            <div class="grid gap-4 sm:grid-cols-2">
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
                <span class="grid gap-1.5">
                  <span class="font-semibold">{{ poli.nama }}</span>
                  <span class="text-xs text-muted-foreground">{{ poli.deskripsi }}</span>
                  <span v-if="poli.subtopik?.length" class="flex flex-wrap gap-1">
                    <span v-for="topik in poli.subtopik" :key="topik" class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{{ topik }}</span>
                  </span>
                </span>
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
              <div><dt class="text-xs text-muted-foreground">Usaha</dt><dd class="font-medium">{{ form.usaha?.nama || form.namaUsaha }} <span v-if="!form.usaha" class="font-normal text-muted-foreground">(belum terverifikasi)</span></dd></div>
              <div><dt class="text-xs text-muted-foreground">Narahubung</dt><dd>{{ form.namaKontak }} · {{ form.whatsapp }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">Poli</dt><dd>{{ poliNama }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">Jadwal</dt><dd>{{ form.tanggal && tanggalPanjang(form.tanggal) }}, {{ form.slot }} WIB · {{ form.moda === "daring" ? "Daring" : "Luring" }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Permasalahan</dt><dd class="whitespace-pre-line">{{ form.deskripsi }}</dd></div>
              <div v-if="lampiran.length" class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Lampiran</dt><dd>{{ lampiran.map((file) => file.name).join(", ") }}</dd></div>
            </dl>
            <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input v-model="form.consent" type="checkbox" name="consent" class="mt-0.5">
              <span>Saya setuju dihubungi melalui WhatsApp di nomor di atas untuk konfirmasi jadwal dan tindak lanjut konsultasi.</span>
            </label>
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
      </template>
    </div>
  </div>
</template>
