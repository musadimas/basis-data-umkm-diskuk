<script setup lang="ts">
import gsap from 'gsap'

const emit = defineEmits<{ done: [] }>()

const visible = ref(true)
const topRef = useTemplateRef<HTMLDivElement>('top')
const bottomRef = useTemplateRef<HTMLDivElement>('bottom')

onMounted(() => {
  gsap.timeline({
    delay: 0.2,
    onComplete: () => {
      visible.value = false
      emit('done')
    },
  })
    .to(topRef.value!, { yPercent: -100, duration: 0.7, ease: 'power4.inOut' })
    .to(bottomRef.value!, { yPercent: 100, duration: 0.7, ease: 'power4.inOut' }, '<0.08')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      aria-hidden="true"
      role="status"
      aria-label="Memuat halaman..."
      class="fixed inset-0 z-[9999] flex flex-col pointer-events-none overflow-hidden"
    >
      <div ref="top" class="flex-1 bg-primary origin-top" />
      <div ref="bottom" class="flex-1 bg-primary origin-bottom" />
    </div>
  </Teleport>
</template>
