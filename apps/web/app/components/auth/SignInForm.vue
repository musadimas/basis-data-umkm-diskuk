<script setup lang="ts">
import { Eye, EyeOff } from "@lucide/vue";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib";
import { safeDashboardReturnTo, useAuth } from "~/composables/useAuth";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const route = useRoute();
const auth = useAuth();
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const errorMessage = ref("");

async function submit() {
  errorMessage.value = "";
  if (!email.value.trim() || !password.value) {
    errorMessage.value = "Email atau kata sandi belum diisi.";
    return;
  }
  try {
    await auth.login(email.value, password.value);
    await navigateTo(safeDashboardReturnTo(route.query.returnTo));
  } catch {
    // Do not reveal whether an email exists or which credential was wrong.
    errorMessage.value = "Email atau kata sandi tidak sesuai.";
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
        <UiFieldLabel for="email" class="text-sm font-semibold text-foreground/80">Email</UiFieldLabel>
        <UiInput id="email" v-model="email" type="email" autocomplete="username" inputmode="email" placeholder="nama@diskuk.jabarprov.go.id" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
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

      <button type="submit" :disabled="auth.pending.value" :aria-busy="auth.pending.value" class="mt-2 h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
        {{ auth.pending.value ? "Memeriksa…" : "Masuk" }}
      </button>
    </form>

    <div class="mt-8 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
      <p>Akses hanya untuk pengguna internal yang telah diundang.</p>
      <NuxtLink to="/" class="mt-2 inline-flex font-semibold text-primary hover:text-primary/80 hover:underline">Kembali ke beranda</NuxtLink>
    </div>
  </div>
</template>
