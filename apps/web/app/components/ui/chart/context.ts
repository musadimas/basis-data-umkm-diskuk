import type { Component, Ref } from "vue"
import { createContext } from "reka-ui"

export const THEMES = {
  light: "",
  dark: ".dark",
} as const

export type ChartConfig = {
  [key: string]: {
    label?: string
    icon?: Component
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

export const [useChart, provideChartContext] = createContext<{
  id: string
  config: Ref<ChartConfig>
}>("Chart")
