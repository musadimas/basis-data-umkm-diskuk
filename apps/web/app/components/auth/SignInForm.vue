<script setup lang="ts">
import { Eye, EyeOff, ShieldCheck } from "@lucide/vue";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib";
import { safeDashboardReturnTo, useAuth } from "~/composables/useAuth";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const route = useRoute();
const auth = useAuth();
const identifier = ref("");
const password = ref("");
const showPassword = ref(false);
const errorMessage = ref("");
const captcha = useTemplateRef<{ solve: () => Promise<string | null>; reset: () => void }>("captcha");

function identifierError(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed) && trimmed.length !== 13) return "NIB terdiri dari 13 digit angka.";
  return "";
}

async function submit() {
  errorMessage.value = "";
  if (!identifier.value.trim() || !password.value) {
    errorMessage.value = "Email/NIB atau kata sandi belum diisi.";
    return;
  }
  const formatError = identifierError(identifier.value);
  if (formatError) {
    errorMessage.value = formatError;
    return;
  }
  const captchaToken = await captcha.value?.solve();
  if (!captchaToken) {
    errorMessage.value = "Verifikasi captcha belum selesai. Silakan coba lagi.";
    return;
  }
  try {
    await auth.login(identifier.value, password.value, captchaToken);
    await navigateTo(safeDashboardReturnTo(route.query.returnTo));
  } catch {
    // Never reveal whether the account exists, the password was wrong, or the captcha expired.
    errorMessage.value = "Email/NIB atau kata sandi tidak sesuai.";
  } finally {
    // A captcha payload is valid only once.
    captcha.value?.reset();
  }
}
</script>

<template>
  <div :class="cn('flex flex-col', props.class)">
    <div class="mb-9">
      <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Masuk ke Dashboard UMKM</h1>
    </div>

    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <UiField class="gap-2">
        <UiFieldLabel for="identifier" class="text-sm font-semibold text-foreground/80">Email atau NIB</UiFieldLabel>
        <UiInput id="identifier" v-model="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="nama@jabarprov.go.id atau 13 digit NIB" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
        <UiFieldDescription class="text-xs">Pegawai memakai email kedinasan; pelaku usaha dapat memakai Nomor Induk Berusaha (NIB).</UiFieldDescription>
      </UiField>

      <UiField class="gap-2">
        <div class="flex items-center justify-between gap-3">
          <UiFieldLabel for="password" class="text-sm font-semibold text-foreground/80">Kata sandi</UiFieldLabel>
          <NuxtLink to="/lupa-kata-sandi" class="text-sm font-semibold text-primary hover:text-primary/80 hover:underline">Lupa Kata Sandi?</NuxtLink>
        </div>
        <div class="relative">
          <UiInput id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Masukkan kata sandi" class="h-12 rounded-xl bg-muted/40 px-4 pr-12 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
          <button type="button" class="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="showPassword = !showPassword">
            <EyeOff v-if="showPassword" class="size-4.5" aria-hidden="true" />
            <Eye v-else class="size-4.5" aria-hidden="true" />
          </button>
        </div>
      </UiField>

      <AuthCaptcha ref="captcha" />

      <button type="submit" :disabled="auth.pending.value" :aria-busy="auth.pending.value" class="mt-2 h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
        {{ auth.pending.value ? "Memeriksa…" : "Masuk ke Dashboard" }}
      </button>
    </form>

    <p class="mt-6 flex gap-2.5 rounded-xl bg-muted/50 p-3.5 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>Sistem ini dilindungi enkripsi AES-256 dan tunduk pada UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).</span>
    </p>

    <div class="mt-6 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
      <p>Akses hanya untuk pengguna yang telah diundang.</p>
      <NuxtLink to="/" class="mt-2 inline-flex font-semibold text-primary hover:text-primary/80 hover:underline">Kembali ke beranda</NuxtLink>
    </div>
  </div>
</template>
