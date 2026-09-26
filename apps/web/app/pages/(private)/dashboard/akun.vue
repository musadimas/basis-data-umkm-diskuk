<script setup lang="ts">
import { useAuth } from "~/composables/useAuth";

definePageMeta({
  layout: "dashboard",
});

useSeoMeta({
  title: "Akun Saya – Dashboard Basis Data UMKM DisKUK Jawa Barat",
});

const auth = useAuth();
const displayName = computed(() =>
  [auth.user.value?.firstName, auth.user.value?.lastName]
    .filter(Boolean)
    .join(" ")
  || auth.user.value?.email
  || "Pengguna DisKUK");

const password = ref("");
const confirmPassword = ref("");
const pending = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

async function submitPassword() {
  successMessage.value = "";
  errorMessage.value = "";
  if (password.value.length < 12) {
    errorMessage.value = "Kata sandi minimal 12 karakter.";
    return;
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Konfirmasi kata sandi tidak sama.";
    return;
  }
  if (auth.user.value?.usaha?.nib && password.value === auth.user.value.usaha.nib) {
    errorMessage.value = "Kata sandi tidak boleh sama dengan NIB.";
    return;
  }
  pending.value = true;
  try {
    await $fetch("/panel/users/me", {
      method: "PATCH",
      body: { password: password.value },
      credentials: "include",
    });
    successMessage.value = "Kata sandi berhasil diperbarui.";
    password.value = "";
    confirmPassword.value = "";
  } catch {
    errorMessage.value = "Kata sandi gagal diperbarui.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5 pb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Akun Saya</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Profil, keamanan akun, dan preferensi sesi Anda.
      </p>
    </div>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Profil</UiCardTitle>
        <UiCardDescription>Identitas akun pada Basis Data UMKM DisKUK Jawa Barat.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-amber-950" aria-hidden="true">
            {{ displayName.slice(0, 2).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-foreground">{{ displayName }}</div>
            <div class="truncate text-sm text-muted-foreground">{{ auth.user.value?.email }}</div>
          </div>
          <NavRoleBadge v-if="auth.user.value" :role="auth.user.value.role" class="ml-auto" />
        </div>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-border/70 bg-muted/30 p-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instansi</dt>
            <dd class="mt-1 text-sm text-foreground">{{ auth.user.value?.instansi || "–" }}</dd>
          </div>
          <div class="rounded-lg border border-border/70 bg-muted/30 p-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wilayah / Usaha</dt>
            <dd class="mt-1 text-sm text-foreground">
              <template v-if="auth.user.value?.kota">{{ auth.user.value.kota.nama }}</template>
              <template v-else-if="auth.user.value?.usaha">
                {{ auth.user.value.usaha.nama }}<template v-if="auth.user.value.usaha.nib"> · NIB {{ auth.user.value.usaha.nib }}</template>
              </template>
              <template v-else>–</template>
            </dd>
          </div>
        </dl>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Keamanan Akun</UiCardTitle>
        <UiCardDescription>Ubah kata sandi secara berkala untuk menjaga akses akun Anda.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <form class="max-w-md space-y-4" novalidate @submit.prevent="submitPassword">
          <p v-if="successMessage" role="status" class="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-3.5 text-sm text-emerald-700">
            {{ successMessage }}
          </p>
          <p v-if="errorMessage" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
            {{ errorMessage }}
          </p>

          <UiField class="gap-2">
            <UiFieldLabel for="akun-password" class="text-sm font-semibold text-foreground/80">Kata sandi baru</UiFieldLabel>
            <UiInput id="akun-password" v-model="password" type="password" autocomplete="new-password" placeholder="Minimal 12 karakter" class="h-11 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
            <p class="text-xs text-muted-foreground">Minimal 12 karakter; tidak boleh sama dengan NIB usaha Anda.</p>
          </UiField>

          <UiField class="gap-2">
            <UiFieldLabel for="akun-confirm" class="text-sm font-semibold text-foreground/80">Konfirmasi kata sandi baru</UiFieldLabel>
            <UiInput id="akun-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi kata sandi baru" class="h-11 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
          </UiField>

          <button type="submit" :disabled="pending" :aria-busy="pending" class="h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 sm:w-auto">
            {{ pending ? "Memeriksa…" : "Simpan Kata Sandi" }}
          </button>
        </form>
      </UiCardContent>
    </UiCard>
  </div>
</template>
