<script setup lang="ts">
withDefaults(defineProps<{
  src: string;
  alt?: string;
  tipe?: string | null;
}>(), { alt: "Bukti laporan", tipe: null });

const skala = ref(1);

function perbesar() {
  skala.value = Math.min(3, Math.round((skala.value + 0.5) * 10) / 10);
}

function perkecil() {
  skala.value = Math.max(1, Math.round((skala.value - 0.5) * 10) / 10);
}

function asli() {
  skala.value = 1;
}

function toggle() {
  skala.value = skala.value === 1 ? 2 : 1;
}
</script>

<template>
  <div>
    <p v-if="tipe === 'application/pdf'">
      <a :href="src" target="_blank" rel="noopener">Buka Bukti (PDF)</a>
    </p>
    <div v-else>
      <div class="mb-2 flex gap-2">
        <button type="button" @click="perbesar">Perbesar</button>
        <button type="button" @click="perkecil">Perkecil</button>
        <button type="button" @click="asli">Ukuran Asli</button>
      </div>
      <div class="overflow-auto rounded border" style="height: 60vh">
        <img
          :src="src"
          :alt="alt"
          class="object-contain"
          :style="{ transform: `scale(${skala})`, transformOrigin: 'top left' }"
          @click="toggle"
        >
      </div>
    </div>
  </div>
</template>
