<script setup lang="ts">
const config = useRuntimeConfig();
const demo = useDemoRoleSwitch();
</script>

<template>
  <AuthShell label="Formulir masuk">
    <AuthSignInForm />
    <DemoDemoRoleSwitcher />
    <div class="mt-5 border-t pt-5 text-center">
      <a
        v-if="config.public.ssoJabarEnabled"
        href="/api/auth/sso/start"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5"
      >Masuk Menggunakan Jabar Digital Services / SSO Jabar</a>
      <button
        v-else-if="config.public.demoMode"
        type="button"
        :disabled="demo.busy.value"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50"
        @click="demo.switchRole('provinsi')"
      >Masuk Menggunakan Jabar Digital Services / SSO Jabar · simulasi akun dummy</button>
      <p v-else class="text-xs text-muted-foreground">SSO Jabar belum tersedia; gunakan login email atau NIB.</p>
      <p v-if="demo.error.value" role="alert" class="mt-2 text-xs text-destructive">{{ demo.error.value }}</p>
    </div>
  </AuthShell>
</template>
