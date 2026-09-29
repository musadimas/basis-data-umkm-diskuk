<script setup lang="ts">
// Baca ulang tiket (Y09/M7-12): nomor tiket plus the WhatsApp number used to book, so a visitor can
// check the status without an account and nobody can enumerate other people's tickets. The answers
// come straight from `POST /v1/program/klinik/tiket/lacak`, including the honest state of the
// WhatsApp notification (there is no gateway yet, so "belum dikirim" is a valid answer).
import { Search, Star } from "@lucide/vue";
import { labelStatusKlinik } from "~/constants";
import { KlinikError, lacakTiket, nilaiTiket } from "~/lib/klinik";
import type { KlinikCsatTersimpan, KlinikTiketLacak } from "~/types/program";

const TIDAK_COCOK = "Nomor tiket dan nomor WhatsApp tidak cocok dengan tiket mana pun. Periksa juga format nomor tiket (contoh: KLN-2026-09-0042).";

type CaptchaRef = { solve: () => Promise<string | null>; reset: () => void };
const captcha = useTemplateRef<CaptchaRef>("captcha");
const directus = useDirectus();
const form = reactive({ nomor: "", whatsapp: "" });
const hasil = ref<KlinikTiketLacak | null>(null);
const error = ref("");
const mencari = ref(false);

// Penilaian layanan (CSAT, R04): memakai nomor + WhatsApp yang barusan cocok pada pelacakan, bukan isian
// yang mungkin sudah diubah sesudahnya. Captcha lama sekali pakai, jadi pengiriman meminta token baru.
const kunciTiket = ref<{ nomor: string; whatsapp: string } | null>(null);
const nilai = ref(0);
const consent = ref(false);
const mengirimCsat = ref(false);
const errorCsat = ref("");
const csatTersimpan = ref<KlinikCsatTersimpan | null>(null);

async function cari() {
  error.value = "";
  hasil.value = null;
  kunciTiket.value = null;
  nilai.value = 0;
  consent.value = false;
  errorCsat.value = "";
  csatTersimpan.value = null;
  mencari.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      error.value = "Verifikasi captcha belum selesai.";
      return;
    }
    hasil.value = await lacakTiket(directus, form.nomor, form.whatsapp, token);
    if (hasil.value) kunciTiket.value = { nomor: hasil.value.nomor, whatsapp: form.whatsapp };
    else error.value = TIDAK_COCOK;
  } catch (cause) {
    error.value = cause instanceof KlinikError ? cause.pesan : "Tiket tidak dapat dilacak. Coba lagi.";
  } finally {
    captcha.value?.reset();
    mencari.value = false;
  }
}

async function kirimCsat() {
  if (!hasil.value || !kunciTiket.value || mengirimCsat.value) return;
  errorCsat.value = "";
  if (!nilai.value) {
    errorCsat.value = "Pilih nilai 1–5 lebih dulu.";
    return;
  }
  mengirimCsat.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      errorCsat.value = "Verifikasi captcha belum selesai.";
      return;
    }
    csatTersimpan.value = await nilaiTiket(directus, { ...kunciTiket.value, nilai: nilai.value, consent: consent.value }, token);
    hasil.value.csat = { bisaMenilai: false, sudahMenilai: true };
  } catch (cause) {
    if (cause instanceof KlinikError && cause.code === "CSAT_SUDAH_ADA") hasil.value.csat = { bisaMenilai: false, sudahMenilai: true };
    else errorCsat.value = cause instanceof KlinikError ? cause.pesan : "Penilaian tidak dapat dikirim. Coba lagi.";
  } finally {
    captcha.value?.reset();
    mengirimCsat.value = false;
  }
}

const statusLabel = (status: string) => labelStatusKlinik(status);
const tanggalPanjang = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
</script>

<template>
  <section class="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-8" aria-label="Lacak tiket konsultasi">
    <div class="grid gap-1">
      <h2 class="text-lg font-bold">Lacak tiket konsultasi</h2>
      <p class="text-sm text-muted-foreground">Masukkan nomor tiket dan nomor WhatsApp yang Anda pakai saat mengajukan.</p>
    </div>

    <form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" novalidate @submit.prevent="cari">
      <UiField class="gap-1">
        <UiFieldLabel for="lacak-nomor">Nomor tiket</UiFieldLabel>
        <UiInput id="lacak-nomor" v-model="form.nomor" placeholder="KLN-2026-09-0001" autocomplete="off" />
      </UiField>
      <UiField class="gap-1">
        <UiFieldLabel for="lacak-whatsapp">Nomor WhatsApp</UiFieldLabel>
        <UiInput id="lacak-whatsapp" v-model="form.whatsapp" type="tel" inputmode="tel" placeholder="0812xxxxxxxx" autocomplete="tel" />
      </UiField>
      <UiButton type="submit" :disabled="mencari"><Search class="size-4" /> {{ mencari ? "Mencari…" : "Lacak" }}</UiButton>
    </form>

    <AuthCaptcha ref="captcha" />
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

    <dl v-if="hasil" class="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:grid-cols-2" data-testid="hasil-lacak">
      <div><dt class="text-xs text-emerald-700">Nomor tiket</dt><dd class="font-mono font-bold">{{ hasil.nomor }}</dd></div>
      <div><dt class="text-xs text-emerald-700">Status</dt><dd class="font-semibold">{{ statusLabel(hasil.status) }}</dd></div>
      <div><dt class="text-xs text-emerald-700">Usaha</dt><dd>{{ hasil.namaUsaha }}<span v-if="hasil.sumberIdentitas === 'manual'" class="text-xs"> · belum terverifikasi</span></dd></div>
      <div><dt class="text-xs text-emerald-700">Poli</dt><dd>{{ hasil.poli }}</dd></div>
      <div><dt class="text-xs text-emerald-700">Jadwal</dt><dd>{{ tanggalPanjang(hasil.tanggal) }}, {{ hasil.slot }} WIB · {{ hasil.moda === "daring" ? "Daring" : "Luring" }}</dd></div>
      <div><dt class="text-xs text-emerald-700">Notifikasi WhatsApp</dt><dd data-testid="status-notifikasi-lacak">{{ hasil.notifikasi.label }}</dd></div>
    </dl>

    <section v-if="hasil && (hasil.csat.bisaMenilai || hasil.csat.sudahMenilai || csatTersimpan)" class="grid gap-3 rounded-lg border p-4 text-sm" aria-label="Penilaian layanan" data-testid="csat">
      <form v-if="hasil.csat.bisaMenilai" class="grid gap-3" novalidate data-testid="csat-form" @submit.prevent="kirimCsat">
        <fieldset class="grid gap-1.5">
          <legend class="font-semibold">Bagaimana konsultasi Anda?</legend>
          <p class="text-xs text-muted-foreground">Beri nilai 1 (sangat tidak puas) sampai 5 (sangat puas).</p>
          <div class="flex gap-1">
            <label v-for="angka in 5" :key="angka" class="relative cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input v-model.number="nilai" type="radio" name="csat-nilai" :value="angka" class="absolute inset-0 size-full cursor-pointer opacity-0">
              <Star class="size-7 transition-colors" :class="angka <= nilai ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground'" aria-hidden="true" />
              <span class="sr-only">{{ angka }} dari 5</span>
            </label>
          </div>
        </fieldset>
        <label class="flex items-start gap-2 rounded-lg border p-3">
          <input v-model="consent" type="checkbox" name="csat-consent" class="mt-0.5">
          <span>Saya setuju penilaian saya (tanpa identitas) dihitung dalam statistik layanan</span>
        </label>
        <p v-if="!consent" class="text-xs text-muted-foreground" data-testid="csat-tanpa-consent">
          Tanpa persetujuan ini, penilaian Anda tetap tersimpan tetapi tidak dihitung dalam statistik layanan.
        </p>
        <p v-if="errorCsat" role="alert" class="text-sm text-destructive">{{ errorCsat }}</p>
        <UiButton type="submit" class="w-fit" :disabled="mengirimCsat">{{ mengirimCsat ? "Mengirim…" : "Kirim penilaian" }}</UiButton>
      </form>
      <p v-else-if="csatTersimpan" role="status" class="text-emerald-900" data-testid="csat-terima-kasih">
        <strong>Terima kasih atas penilaian Anda.</strong>
        {{ csatTersimpan.dihitung ? "Penilaian Anda dihitung dalam statistik layanan, tanpa identitas." : "Penilaian tersimpan, tetapi tidak dihitung dalam statistik layanan karena Anda tidak memberi persetujuan." }}
      </p>
      <p v-else role="status" data-testid="csat-sudah-menilai">Terima kasih, penilaian sudah tercatat.</p>
    </section>
  </section>
</template>
