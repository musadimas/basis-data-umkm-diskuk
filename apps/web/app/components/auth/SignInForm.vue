<script setup lang="ts">
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
  <div :class="cn('flex flex-col gap-6', props.class)">
    <UiCard class="overflow-hidden p-0">
      <UiCardContent class="p-6 md:p-8">
        <form class="flex flex-col gap-6" novalidate @submit.prevent="submit">
          <div class="flex flex-col items-center gap-2 text-center">
            <h1 class="text-2xl font-bold">Masuk ke Dashboard UMKM</h1>
            <p class="text-muted-foreground text-balance">Gunakan akun internal DisKUK Anda.</p>
          </div>
          <p v-if="errorMessage" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {{ errorMessage }}
          </p>
          <UiField>
            <UiFieldLabel for="email">Email</UiFieldLabel>
            <UiInput id="email" v-model="email" type="email" autocomplete="username" inputmode="email" required />
          </UiField>
          <UiField>
            <UiFieldLabel for="password">Kata sandi</UiFieldLabel>
            <div class="relative">
              <UiInput id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" class="pr-20" required />
              <button type="button" class="absolute inset-y-0 right-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground" :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="showPassword = !showPassword">
                {{ showPassword ? "Sembunyikan" : "Tampilkan" }}
              </button>
            </div>
          </UiField>
          <button type="button" :disabled="auth.pending.value" class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50" @click="submit">
            {{ auth.pending.value ? "Memeriksa…" : "Masuk" }}
          </button>
        </form>
      </UiCardContent>
    </UiCard>
    <UiFieldDescription class="px-6 text-center">Akses hanya untuk pengguna internal yang telah diundang.</UiFieldDescription>
  </div>
</template>
