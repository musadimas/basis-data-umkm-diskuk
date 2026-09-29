<script setup lang="ts">
// Baca ulang tiket (Y09/M7-12): nomor tiket plus the WhatsApp number used to book, so a visitor can
// check the status without an account and nobody can enumerate other people's tickets. The answers
// come straight from `POST /v1/program/klinik/tiket/lacak`, including the honest state of the
// WhatsApp notification (there is no gateway yet, so "belum dikirim" is a valid answer).
import { Search } from "@lucide/vue";
import { labelStatusKlinik } from "~/constants";
import { KlinikError, lacakTiket } from "~/lib/klinik";
import type { KlinikTiketLacak } from "~/types/program";

const TIDAK_COCOK = "Nomor tiket dan nomor WhatsApp tidak cocok dengan tiket mana pun. Periksa juga format nomor tiket (contoh: KLN-2026-09-0042).";

type CaptchaRef = { solve: () => Promise<string | null>; reset: () => void };
const captcha = useTemplateRef<CaptchaRef>("captcha");
const directus = useDirectus();
const form = reactive({ nomor: "", whatsapp: "" });
const hasil = ref<KlinikTiketLacak | null>(null);
const error = ref("");
const mencari = ref(false);

async function cari() {
  error.value = "";
  hasil.value = null;
  mencari.value = true;
  try {
    const token = await captcha.value?.solve();
    if (!token) {
      error.value = "Verifikasi captcha belum selesai.";
      return;
    }
    hasil.value = await lacakTiket(directus, form.nomor, form.whatsapp, token);
    if (!hasil.value) error.value = TIDAK_COCOK;
  } catch (cause) {
    error.value = cause instanceof KlinikError ? cause.pesan : "Tiket tidak dapat dilacak. Coba lagi.";
  } finally {
    captcha.value?.reset();
    mencari.value = false;
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
  </section>
</template>
