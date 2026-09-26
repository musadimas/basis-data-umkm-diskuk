<script setup lang="ts">
import { Eye, EyeOff } from "@lucide/vue";
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

async function submit() {
  errorMessage.value = "";
  if (!identifier.value.trim() || !password.value) {
    errorMessage.value = "Email/NIB atau kata sandi belum diisi.";
    return;
  }
  try {
    if (/^\d{13}$/.test(identifier.value.trim()))
      await auth.loginWithNib(identifier.value.trim(), password.value);
    else await auth.login(identifier.value, password.value);
    // Middleware mengalihkan ke beranda role bila tujuan tidak diizinkan.
    await navigateTo(safeDashboardReturnTo(route.query.returnTo));
  } catch {
    // Do not reveal whether an email/NIB exists or which credential was wrong.
    errorMessage.value = "Email/NIB atau kata sandi tidak sesuai.";
  }
}
</script>

<template>
  <div :class="cn('flex flex-col', props.class)">
    <NuxtLink to="/" class="mb-8 self-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Kembali ke beranda DISKUK Jawa Barat">
      <NuxtImg src="/images/diskuk-jabar-logo.png" alt="DISKUK Jawa Barat" width="125" height="87" class="h-16 w-auto object-contain" />
    </NuxtLink>

    <div class="mb-9">
      <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Masuk ke Dashboard UMKM</h1>
    </div>

    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <UiField class="gap-2">
        <UiFieldLabel for="identifier" class="text-sm font-semibold text-foreground/80">Email / NIB</UiFieldLabel>
        <UiInput id="identifier" v-model="identifier" type="text" autocomplete="username" inputmode="text" placeholder="nama@jabarprov.go.id atau 13 digit NIB" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
      </UiField>

      <UiField class="gap-2">
        <UiFieldLabel for="password" class="text-sm font-semibold text-foreground/80">Kata sandi</UiFieldLabel>
        <div class="relative">
          <UiInput id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Masukkan kata sandi" class="h-12 rounded-xl bg-muted/40 px-4 pr-12 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
          <button type="button" class="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="showPassword = !showPassword">
            <EyeOff v-if="showPassword" class="size-4.5" aria-hidden="true" />
            <Eye v-else class="size-4.5" aria-hidden="true" />
          </button>
        </div>
      </UiField>

      <!-- Simulasi CAPTCHA: hanya UI, tidak memengaruhi submit dan tidak diverifikasi server. -->
      <div class="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3" aria-label="Simulasi CAPTCHA">
        <input id="captcha-simulasi" type="checkbox" class="size-4 shrink-0 rounded border-border accent-primary">
        <label for="captcha-simulasi" class="text-sm font-medium text-foreground select-none">Saya bukan robot</label>
      </div>
      <p class="-mt-3 text-xs text-muted-foreground">Simulasi CAPTCHA (prototipe) — tidak diverifikasi server.</p>

      <div class="flex items-center justify-end">
        <button type="button" class="rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary/80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="navigateTo('/forgot-password')">
          Lupa Kata Sandi?
        </button>
      </div>

      <button type="submit" :disabled="auth.pending.value" :aria-busy="auth.pending.value" class="h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
        {{ auth.pending.value ? "Memeriksa…" : "Masuk ke Dashboard" }}
      </button>
    </form>

    <div class="mt-8 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
      <p>Akses terbatas untuk akun dinas dan pelaku UMKM peserta program.</p>
      <NuxtLink to="/" class="mt-2 inline-flex font-semibold text-primary hover:text-primary/80 hover:underline">Kembali ke beranda</NuxtLink>
    </div>
  </div>
</template>
