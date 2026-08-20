import type Lenis from 'lenis'

export function useLenis() {
  // $lenis sudah dideklarasikan lewat module augmentation di app/plugins/lenis.client.ts.
  const lenis = useNuxtApp().$lenis

  function scrollTo(target: string | number | HTMLElement, options?: Parameters<Lenis['scrollTo']>[1]) {
    lenis?.scrollTo(target, options)
  }

  return { lenis, scrollTo }
}
