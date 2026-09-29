<script setup lang="ts">
import { passwordRequest, withOptions } from "@directus/sdk";
import { requestErrorCode } from "~/lib/request-error";

useSeoMeta({ title: "Lupa Kata Sandi – Dashboard UMKM Jawa Barat" });

const directus = useDirectus();
const identifier = ref("");
const pending = ref(false);
const sent = ref(false);
const errorMessage = ref("");
const captcha = useTemplateRef<{ solve: () => Promise<string | null>; reset: () => void }>("captcha");

async function submit() {
  errorMessage.value = "";
  const value = identifier.value.trim();
  if (!value) {
    errorMessage.value = "Email atau NIB belum diisi.";
    return;
  }
  pending.value = true;
  try {
    const captchaToken = await captcha.value?.solve();
    if (!captchaToken) {
      errorMessage.value = "Verifikasi captcha belum selesai. Silakan coba lagi.";
      return;
    }
    // Native passwordRequest plus the captcha the authentication extension's password guard requires.
    await directus.request(
      withOptions(passwordRequest(value), (init) => ({
        ...init,
        body: JSON.stringify({ email: value, captcha: captchaToken }),
      })),
    );
    sent.value = true;
  } catch (error) {
    const code = requestErrorCode(error);
    errorMessage.value =
      code === "CAPTCHA_INVALID"
        ? "Verifikasi captcha gagal. Silakan ulangi."
        : "Permintaan tidak dapat diproses. Coba beberapa saat lagi.";
  } finally {
    captcha.value?.reset();
    pending.value = false;
  }
}
</script>

<template>
  <AuthShell label="Formulir lupa kata sandi">
    <div class="mb-7 text-center">
      <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Lupa Kata Sandi</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Masukkan email akun atau NIB usaha Anda. Bila terdaftar, tautan pemulihan akan dikirimkan ke email akun.
      </p>
    </div>

    <div v-if="sent" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
      Bila akun terdaftar, email berisi tautan reset kata sandi telah dikirim. Tautan berlaku 24 jam. Periksa juga folder spam.
    </div>

    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
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
      <AuthCaptcha ref="captcha" />
      <button
        type="submit"
        :disabled="pending"
        :aria-busy="pending"
        class="mt-1 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {{ pending ? "Mengirim…" : "Kirim Tautan Reset" }}
      </button>
    </form>

    <div class="mt-6 border-t border-border/70 pt-6 text-center text-xs leading-relaxed text-muted-foreground">
      <NuxtLink to="/sign-in" class="font-medium text-primary hover:text-primary/80 hover:underline">
        Kembali ke halaman masuk
      </NuxtLink>
    </div>
  </AuthShell>
</template>
