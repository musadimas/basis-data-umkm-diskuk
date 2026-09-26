<script setup lang="ts">
import { updateMe } from "@directus/sdk";
import { Eye, EyeOff } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { APP_ROLE_BADGES, DEFAULT_APP_ROLE } from "~/constants";
import { requestErrorCode } from "~/lib/request-error";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Pengaturan Akun & Keamanan – Dashboard UMKM" });

const PASSWORD_MIN = 10;
const PASSWORD_TOO_SHORT = `Kata sandi baru minimal ${PASSWORD_MIN} karakter.`;
const PASSWORD_ERRORS: Record<string, string> = {
  CURRENT_PASSWORD_REQUIRED: "Kata sandi saat ini wajib diisi.",
  CURRENT_PASSWORD_INVALID: "Kata sandi saat ini tidak sesuai.",
  NEW_PASSWORD_TOO_SHORT: PASSWORD_TOO_SHORT,
  NEW_PASSWORD_UNCHANGED: "Kata sandi baru harus berbeda dari kata sandi lama.",
};

const auth = useAuth();
const directus = useDirectus();
const user = computed(() => auth.user.value);
const badge = computed(() => APP_ROLE_BADGES[user.value?.app_role ?? DEFAULT_APP_ROLE]);

const profile = reactive({ firstName: "", lastName: "" });
const profilePending = ref(false);
const profileMessage = ref<{ tone: "success" | "error"; text: string } | null>(null);

watch(
  user,
  (value) => {
    profile.firstName = value?.first_name ?? "";
    profile.lastName = value?.last_name ?? "";
  },
  { immediate: true },
);

async function saveProfile() {
  profileMessage.value = null;
  const firstName = profile.firstName.trim();
  if (!firstName) {
    profileMessage.value = { tone: "error", text: "Nama depan wajib diisi." };
    return;
  }
  profilePending.value = true;
  try {
    await directus.request(
      updateMe({ first_name: firstName.slice(0, 50), last_name: profile.lastName.trim().slice(0, 50) || null }),
    );
    await auth.currentUser();
    profileMessage.value = { tone: "success", text: "Profil berhasil diperbarui." };
  } catch {
    profileMessage.value = { tone: "error", text: "Profil tidak dapat disimpan. Coba lagi." };
  } finally {
    profilePending.value = false;
  }
}

const passwords = reactive({ current: "", next: "", confirm: "" });
const showPasswords = ref(false);
const passwordPending = ref(false);
const passwordMessage = ref<{ tone: "success" | "error"; text: string } | null>(null);

async function changePassword() {
  passwordMessage.value = null;
  if (!passwords.current) {
    passwordMessage.value = { tone: "error", text: "Kata sandi saat ini wajib diisi." };
    return;
  }
  if (passwords.next.length < PASSWORD_MIN) {
    passwordMessage.value = { tone: "error", text: PASSWORD_TOO_SHORT };
    return;
  }
  if (passwords.next !== passwords.confirm) {
    passwordMessage.value = { tone: "error", text: "Konfirmasi kata sandi baru tidak sama." };
    return;
  }
  passwordPending.value = true;
  try {
    // The authentication extension's password guard verifies current_password on PATCH /users/me.
    await directus.request(updateMe({ password: passwords.next, current_password: passwords.current }));
    passwords.current = "";
    passwords.next = "";
    passwords.confirm = "";
    passwordMessage.value = { tone: "success", text: "Kata sandi berhasil diperbarui." };
  } catch (error) {
    const code = requestErrorCode(error);
    passwordMessage.value = {
      tone: "error",
      text: (code && PASSWORD_ERRORS[code]) || "Kata sandi tidak dapat diperbarui. Coba lagi.",
    };
  } finally {
    passwordPending.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Pengaturan Akun &amp; Keamanan</h1>
      <p class="mt-1 text-sm text-muted-foreground">Kelola identitas akun dan kata sandi Anda.</p>
    </div>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Profil</UiCardTitle>
        <UiCardDescription>Email, peran, dan instansi diatur oleh admin DISKUK.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <form class="grid gap-5" novalidate @submit.prevent="saveProfile">
          <dl class="grid gap-4 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">Email</dt>
              <dd class="truncate font-medium">{{ user?.email }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">Peran</dt>
              <dd class="pt-0.5"><span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" :class="badge.className">{{ badge.label }}</span></dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted-foreground">Instansi / Usaha</dt>
              <dd class="truncate font-medium">{{ user?.instansi || "—" }}</dd>
            </div>
          </dl>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField class="gap-2">
              <UiFieldLabel for="first-name">Nama depan</UiFieldLabel>
              <UiInput id="first-name" v-model="profile.firstName" autocomplete="given-name" maxlength="50" required />
            </UiField>
            <UiField class="gap-2">
              <UiFieldLabel for="last-name">Nama belakang</UiFieldLabel>
              <UiInput id="last-name" v-model="profile.lastName" autocomplete="family-name" maxlength="50" />
            </UiField>
          </div>
          <p v-if="profileMessage" :role="profileMessage.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="profileMessage.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">
            {{ profileMessage.text }}
          </p>
          <div>
            <UiButton type="submit" :disabled="profilePending">{{ profilePending ? "Menyimpan…" : "Simpan Profil" }}</UiButton>
          </div>
        </form>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Ubah Kata Sandi</UiCardTitle>
        <UiCardDescription>Masukkan kata sandi saat ini untuk menetapkan kata sandi baru (minimal {{ PASSWORD_MIN }} karakter).</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <form class="grid gap-4" novalidate @submit.prevent="changePassword">
          <UiField class="gap-2">
            <UiFieldLabel for="current-password">Kata sandi saat ini</UiFieldLabel>
            <UiInput id="current-password" v-model="passwords.current" :type="showPasswords ? 'text' : 'password'" autocomplete="current-password" required />
          </UiField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField class="gap-2">
              <UiFieldLabel for="new-password">Kata sandi baru</UiFieldLabel>
              <UiInput id="new-password" v-model="passwords.next" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" required />
            </UiField>
            <UiField class="gap-2">
              <UiFieldLabel for="confirm-password">Ulangi kata sandi baru</UiFieldLabel>
              <UiInput id="confirm-password" v-model="passwords.confirm" :type="showPasswords ? 'text' : 'password'" autocomplete="new-password" required />
            </UiField>
          </div>
          <button type="button" class="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground" @click="showPasswords = !showPasswords">
            <EyeOff v-if="showPasswords" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
            {{ showPasswords ? "Sembunyikan kata sandi" : "Tampilkan kata sandi" }}
          </button>
          <p v-if="passwordMessage" :role="passwordMessage.tone === 'error' ? 'alert' : 'status'" class="text-sm" :class="passwordMessage.tone === 'error' ? 'text-destructive' : 'text-emerald-700'">
            {{ passwordMessage.text }}
          </p>
          <div>
            <UiButton type="submit" :disabled="passwordPending">{{ passwordPending ? "Menyimpan…" : "Perbarui Kata Sandi" }}</UiButton>
          </div>
        </form>
      </UiCardContent>
    </UiCard>
  </div>
</template>
