<script setup lang="ts">
const config = useRuntimeConfig();
const { busy, error, switchRole } = useDemoRoleSwitch();
const expanded = ref(false);
const roles = [
  { id: "provinsi", label: "Admin provinsi", email: "admin@diskuk.jabarprov.go.id" },
  { id: "kabkota", label: "Admin Subang", email: "admin.subang@jabarprov.go.id" },
  { id: "pendamping", label: "Pendamping", email: "coach.pendamping@jabarprov.go.id" },
  { id: "umkm", label: "Pelaku UMKM", email: "wawan.leathercraft@gmail.com" },
] as const;

</script>

<template>
  <aside v-if="config.public.demoMode" class="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-sky-400 bg-white p-3 shadow-xl" aria-label="Mode Pengujian Prototipe: Pilih Peran Aktif">
    <button type="button" class="flex w-full items-center justify-between text-left text-sm font-bold" :aria-expanded="expanded" @click="expanded = !expanded">
      Mode Pengujian Prototipe <span aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
    </button>
    <div v-if="expanded" class="mt-2">
      <p class="mb-2 text-xs text-muted-foreground">Pilih Peran Aktif · akun dummy saja</p>
      <p v-if="error" role="alert" class="mb-2 text-xs text-destructive">{{ error }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button v-for="role in roles" :key="role.id" type="button" :disabled="busy" class="rounded-lg border px-2 py-2 text-left text-xs hover:bg-sky-50 disabled:opacity-50" @click="switchRole(role.id)">
          <strong class="block">{{ role.label }}</strong>
          <span class="block break-all text-[10px] text-muted-foreground">{{ role.email }}</span>
        </button>
      </div>
    </div>
  </aside>
</template>
