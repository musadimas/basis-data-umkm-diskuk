<script setup lang="ts">
useSeoMeta({
  title: "Lupa Kata Sandi – Dashboard UMKM DisKUK Jawa Barat",
  description:
    "Pemulihan akses Dashboard UMKM: kirim tautan atur ulang kata sandi atau tetapkan kata sandi baru dari tautan email.",
});

const route = useRoute();

/** Predikat token query: hanya string non-kosong yang dipakai. */
function isQueryToken(value: string | null | (string | null)[] | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

const isResetMode = computed(() => isQueryToken(route.query.token));

// ── Mode permintaan tautan reset ────────────────────────────────────────────
const email = ref("");
const requestPending = ref(false);
const requestMessage = ref("");
const requestError = ref("");

async function submitRequest() {
  requestMessage.value = "";
  requestError.value = "";
  const value = email.value.trim();
  if (!value || !value.includes("@") || value.includes(" ")) {
    requestError.value = "Masukkan alamat email yang valid.";
    return;
  }
  requestPending.value = true;
  try {
    // Respons selalu 200 tanpa body: keberadaan email tidak dapat diuji dari respons.
    await $fetch("/panel/auth/password/request", {
      method: "POST",
      body: {
        email: value,
        reset_url: `${window.location.origin}/forgot-password`,
      },
      credentials: "include",
    });
    requestMessage.value = "Tautan pemulihan telah dikirim bila email terdaftar.";
  } catch {
    requestError.value = "Tautan pemulihan belum dapat dikirim. Silakan coba lagi.";
  } finally {
    requestPending.value = false;
  }
}

// ── Mode atur ulang kata sandi (token dari email) ───────────────────────────
const password = ref("");
const confirmPassword = ref("");
const resetPending = ref(false);
const resetError = ref("");

async function submitReset() {
  resetError.value = "";
  const token = isQueryToken(route.query.token) ? route.query.token : null;
  if (password.value.length < 12) {
    resetError.value = "Kata sandi minimal 12 karakter.";
    return;
  }
  if (password.value !== confirmPassword.value) {
    resetError.value = "Konfirmasi kata sandi tidak sama.";
    return;
  }
  if (/^\d{13}$/.test(password.value)) {
    resetError.value = "Kata sandi tidak boleh 13 digit angka (NIB).";
    return;
  }
  resetPending.value = true;
  try {
    await $fetch("/panel/auth/password/reset", {
      method: "POST",
      body: { token, password: password.value },
      credentials: "include",
    });
    await navigateTo("/sign-in");
  } catch (error) {
    // SAFETY: ofetch melempar FetchError yang membawa status/statusCode numerik;
    // tidak ada tipe publik untuk itu tanpa menambah dependensi langsung.
    const status = (error as { status?: number; statusCode?: number }).status
      ?? (error as { statusCode?: number }).statusCode;
    resetError.value = status === 403
      ? "Tautan tidak valid atau sudah kedaluwarsa."
      : "Kata sandi gagal diperbarui. Silakan coba lagi.";
  } finally {
    resetPending.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-white px-4 py-10">
    <div class="w-full max-w-md">
      <NuxtLink to="/" class="mb-8 flex justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Kembali ke beranda DISKUK Jawa Barat">
        <NuxtImg src="/images/diskuk-jabar-logo.png" alt="DISKUK Jawa Barat" width="125" height="87" class="h-16 w-auto object-contain" />
      </NuxtLink>

      <div class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs sm:p-8">
        <template v-if="isResetMode">
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Atur Ulang Kata Sandi</h1>
          <p class="mt-2 text-sm text-muted-foreground">
            Buat kata sandi baru untuk akun Anda.
          </p>

          <form class="mt-6 flex flex-col gap-5" novalidate @submit.prevent="submitReset">
            <p v-if="resetError" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
              {{ resetError }}
            </p>

            <UiField class="gap-2">
              <UiFieldLabel for="reset-password" class="text-sm font-semibold text-foreground/80">Kata sandi baru</UiFieldLabel>
              <UiInput id="reset-password" v-model="password" type="password" autocomplete="new-password" placeholder="Minimal 12 karakter" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
              <p class="text-xs text-muted-foreground">
                Kata sandi tidak boleh berupa 13 digit angka (NIB) — kebijakan server menolaknya.
              </p>
            </UiField>

            <UiField class="gap-2">
              <UiFieldLabel for="reset-confirm" class="text-sm font-semibold text-foreground/80">Konfirmasi kata sandi baru</UiFieldLabel>
              <UiInput id="reset-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi kata sandi baru" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
            </UiField>

            <button type="submit" :disabled="resetPending" :aria-busy="resetPending" class="h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
              {{ resetPending ? "Memeriksa…" : "Simpan Kata Sandi Baru" }}
            </button>
          </form>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold tracking-tight text-foreground">Lupa Kata Sandi?</h1>
          <p class="mt-2 text-sm text-muted-foreground">
            Masukkan email akun Anda dan kami akan mengirim tautan untuk mengatur ulang kata sandi.
          </p>

          <form class="mt-6 flex flex-col gap-5" novalidate @submit.prevent="submitRequest">
            <p v-if="requestMessage" role="status" class="rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-3.5 text-sm text-emerald-700">
              {{ requestMessage }}
            </p>
            <p v-if="requestError" role="alert" class="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
              {{ requestError }}
            </p>

            <UiField class="gap-2">
              <UiFieldLabel for="forgot-email" class="text-sm font-semibold text-foreground/80">Email</UiFieldLabel>
              <UiInput id="forgot-email" v-model="email" type="email" autocomplete="email" inputmode="email" placeholder="nama@jabarprov.go.id" class="h-12 rounded-xl bg-muted/40 px-4 shadow-none transition-colors focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15" required />
            </UiField>

            <button type="submit" :disabled="requestPending" :aria-busy="requestPending" class="h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50">
              {{ requestPending ? "Memeriksa…" : "Kirim Tautan Pemulihan" }}
            </button>
          </form>
        </template>

        <div class="mt-6 border-t border-border pt-4 text-sm">
          <NuxtLink to="/sign-in" class="inline-flex font-semibold text-primary hover:text-primary/80 hover:underline">Kembali ke halaman masuk</NuxtLink>
        </div>
      </div>
    </div>
  </main>
</template>
