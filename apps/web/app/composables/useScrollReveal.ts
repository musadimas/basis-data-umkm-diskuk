import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

export interface RevealOptions {
  y?: number
  opacity?: number
  duration?: number
  stagger?: number
  trigger?: Element | string | null
  start?: string
  delay?: number
}

export function useScrollReveal() {
  function revealFrom(targets: gsap.TweenTarget, options: RevealOptions = {}) {
    const {
      y = 40,
      opacity = 0,
      duration = 0.75,
      stagger = 0,
      trigger,
      start = 'top 82%',
      delay = 0,
    } = options

    return gsap.from(targets, {
      y,
      opacity,
      duration,
      stagger,
      delay,
      ease: 'power2.out',
      scrollTrigger: trigger ? { trigger, start, once: true } : undefined,
    })
  }

  return { revealFrom }
}

export { ScrollTrigger }
