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
// auth.global.ts sends an account without a valid app_role here instead of looping between dashboards.
const errorMessage = ref(
  route.query.error === "peran" ? "Akun Anda belum memiliki peran. Hubungi Admin Provinsi DISKUK untuk penetapan peran." : "",
);
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
    <div class="mb-7 text-center">
      <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Masuk ke Dashboard UMKM</h1>
    </div>

    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <UiField class="gap-1.5">
        <UiFieldLabel for="identifier" class="text-sm font-medium text-foreground">Email atau NIB</UiFieldLabel>
        <UiInput
          id="identifier"
          v-model="identifier"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          placeholder="nama@jabarprov.go.id atau 13 digit NIB"
          class="h-11 rounded-xl border border-input bg-muted/30 px-3.5 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
          required
        />
      </UiField>

      <UiField class="gap-1.5">
        <div class="flex items-center justify-between">
          <UiFieldLabel for="password" class="text-sm font-medium text-foreground">Kata sandi</UiFieldLabel>
          <NuxtLink to="/lupa-kata-sandi" class="text-xs font-medium text-primary hover:text-primary/80 hover:underline">
            Lupa kata sandi?
          </NuxtLink>
        </div>
        <div class="relative">
          <UiInput
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Masukkan kata sandi"
            class="h-11 rounded-xl border border-input bg-muted/30 px-3.5 pr-11 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
            required
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
          </button>
        </div>
      </UiField>

      <AuthCaptcha ref="captcha" />

      <UiButton
        type="submit"
        :disabled="auth.pending.value"
        :aria-busy="auth.pending.value"
        class="mt-1 h-11 w-full rounded-xl"
      >
        {{ auth.pending.value ? "Memeriksa…" : "Masuk ke Dashboard" }}
      </UiButton>
    </form>

    <div class="mt-5 flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>Sistem ini dilindungi enkripsi AES-256 dan tunduk pada UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).</span>
    </div>

    <div class="mt-6 border-t border-border/70 pt-6 text-center text-xs leading-relaxed text-muted-foreground space-y-1.5">
      <p>Akses hanya untuk pengguna yang telah diundang.</p>
      <p>
        <NuxtLink to="/" class="font-medium text-primary hover:text-primary/80 hover:underline">
          Kembali ke beranda
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
