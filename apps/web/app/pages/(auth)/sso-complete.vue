<script setup lang="ts">
import { dashboardRedirect } from "~/constants/ROLES";

const auth = useAuth();
const error = ref("");
onMounted(async () => {
  const user = await auth.currentUser();
  if (!user?.app_role) {
    error.value = "Akun SSO belum terpetakan ke peran dashboard. Hubungi Admin Provinsi DISKUK.";
    return;
  }
  await navigateTo(dashboardRedirect(user.app_role, "/dashboard") ?? "/dashboard", { replace: true });
});
</script>

<template>
  <AuthShell label="Penyelesaian masuk SSO">
    <h1 class="text-xl font-bold">Masuk dengan SSO Jabar</h1>
    <p v-if="error" role="alert" class="mt-3 text-sm text-destructive">{{ error }}</p>
    <p v-else role="status" class="mt-3 text-sm">Memeriksa sesi dan peran akun…</p>
    <NuxtLink to="/sign-in" class="mt-4 inline-block text-sm font-semibold text-primary underline">Gunakan login email atau NIB</NuxtLink>
  </AuthShell>
</template>
