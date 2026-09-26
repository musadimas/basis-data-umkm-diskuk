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
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">Buat Kata Sandi Baru</h1>
    </div>

    <div v-if="!token" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
      Tautan reset tidak lengkap. <NuxtLink to="/lupa-kata-sandi" class="font-semibold underline">Minta tautan baru</NuxtLink>.
    </div>

    <div v-else-if="done" role="status" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
        {{ errorMessage }}
      </p>
      <UiField class="gap-2">
        <UiFieldLabel for="new-password" class="text-sm font-semibold text-foreground/80">Kata sandi baru</UiFieldLabel>
        <div class="relative">
          <UiInput id="new-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="h-12 rounded-xl bg-muted/40 px-4 pr-12 shadow-none focus-visible:border-primary focus-visible:bg-white" required />
          <button type="button" class="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-primary" :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="showPassword = !showPassword">
            <EyeOff v-if="showPassword" class="size-4.5" aria-hidden="true" />
            <Eye v-else class="size-4.5" aria-hidden="true" />
          </button>
        </div>
        <UiFieldDescription class="text-xs">Minimal {{ PASSWORD_MIN }} karakter.</UiFieldDescription>
      </UiField>
      <UiField class="gap-2">
        <UiFieldLabel for="confirm-password" class="text-sm font-semibold text-foreground/80">Ulangi kata sandi baru</UiFieldLabel>
        <UiInput id="confirm-password" v-model="confirmation" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none focus-visible:border-primary focus-visible:bg-white" required />
      </UiField>
      <button type="submit" :disabled="pending" :aria-busy="pending" class="h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50">
        {{ pending ? "Menyimpan…" : "Simpan Kata Sandi" }}
      </button>
    </form>

    <NuxtLink to="/sign-in" class="mt-8 inline-flex text-sm font-semibold text-primary hover:text-primary/80 hover:underline">Kembali ke halaman masuk</NuxtLink>
  </AuthShell>
</template>
