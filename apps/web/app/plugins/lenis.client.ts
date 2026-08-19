import Lenis from 'lenis'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

declare module '#app' {
  interface NuxtApp {
    $lenis: Lenis
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  gsap.registerPlugin(ScrollTrigger)

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  const lenis = new Lenis()

  lenis.on('scroll', ScrollTrigger.update)

  const rafCallback = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(rafCallback)
  gsap.ticker.lagSmoothing(0)

  nuxtApp.provide('lenis', lenis)

  window.addEventListener('beforeunload', () => {
    gsap.ticker.remove(rafCallback)
    lenis.destroy()
  }, { once: true })
})
