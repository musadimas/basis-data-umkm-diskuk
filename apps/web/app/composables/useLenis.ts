import type Lenis from 'lenis'

export function useLenis() {
  const nuxtApp = useNuxtApp() as unknown as { $lenis: Lenis }
  const lenis = nuxtApp.$lenis

  function scrollTo(target: string | number | HTMLElement, options?: Parameters<Lenis['scrollTo']>[1]) {
    lenis?.scrollTo(target, options)
  }

  return { lenis, scrollTo }
}
