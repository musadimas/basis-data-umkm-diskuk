<script setup lang="ts">
import { passwordReset } from "@directus/sdk";
import { Eye, EyeOff } from "@lucide/vue";

useSeoMeta({ title: "Buat Kata Sandi Baru – Dashboard UMKM Jawa Barat" });

const PASSWORD_MIN = 10;
const directus = useDirectus();
const route = useRoute();
function isTokenString(value: string | null | (string | null)[] | undefined): value is string {
  return typeof value === "string";
}
const token = computed(() => (isTokenString(route.query.token) ? route.query.token : ""));
const password = ref("");
const confirmation = ref("");
const showPassword = ref(false);
const pending = ref(false);
const done = ref(false);
const errorMessage = ref("");

async function submit() {
  errorMessage.value = "";
  if (password.value.length < PASSWORD_MIN) {
    errorMessage.value = `Kata sandi minimal ${PASSWORD_MIN} karakter.`;
    return;
  }
  if (password.value !== confirmation.value) {
    errorMessage.value = "Konfirmasi kata sandi tidak sama.";
    return;
  }
  pending.value = true;
  try {
    await directus.request(passwordReset(token.value, password.value));
    done.value = true;
  } catch {
    errorMessage.value = "Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <AuthShell label="Formulir kata sandi baru">
    <div class="mb-7 text-center">
      <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Buat Kata Sandi Baru</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Tentukan kata sandi baru untuk akun Anda.
      </p>
    </div>

    <div v-if="!token" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
      Tautan reset tidak lengkap. <NuxtLink to="/lupa-kata-sandi" class="font-semibold underline">Minta tautan baru</NuxtLink>.
    </div>

    <div v-else-if="done" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
      Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.
    </div>

    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
        {{ errorMessage }}
      </p>
      <UiField class="gap-1.5">
        <UiFieldLabel for="new-password" class="text-sm font-medium text-foreground">Kata sandi baru</UiFieldLabel>
        <div class="relative">
          <UiInput
            id="new-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="Minimal 10 karakter"
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
        <UiFieldDescription class="text-xs">Minimal {{ PASSWORD_MIN }} karakter.</UiFieldDescription>
      </UiField>
      <UiField class="gap-1.5">
        <UiFieldLabel for="confirm-password" class="text-sm font-medium text-foreground">Ulangi kata sandi baru</UiFieldLabel>
        <UiInput
          id="confirm-password"
          v-model="confirmation"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="Ulangi kata sandi baru"
          class="h-11 rounded-xl border border-input bg-muted/30 px-3.5 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/20"
          required
        />
      </UiField>
      <button
        type="submit"
        :disabled="pending"
        :aria-busy="pending"
        class="mt-1 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {{ pending ? "Menyimpan…" : "Simpan Kata Sandi" }}
      </button>
    </form>

    <div class="mt-6 border-t border-border/70 pt-6 text-center text-xs leading-relaxed text-muted-foreground">
      <NuxtLink to="/sign-in" class="font-medium text-primary hover:text-primary/80 hover:underline">
        Kembali ke halaman masuk
      </NuxtLink>
    </div>
  </AuthShell>
</template>
