import type { ChartConfig } from "."
import { isClient } from "@vueuse/core"
import { useId } from "reka-ui"
import type { Component } from "vue"
import { h, render } from "vue"

type DatumValue = number | string | boolean | null | Datum | undefined
type Datum = {
  [key: string]: DatumValue
}

// Simple cache using a Map to store serialized object keys
const cache = new Map<string, string>()

// Convert object to a consistent string key
function serializeKey(key: Datum): string {
  return JSON.stringify(key, Object.keys(key).sort())
}

function isDatum(value: DatumValue): value is Datum {
  return typeof value === "object" && value !== null
}

export function componentToString<P extends object>(config: ChartConfig, component: Component, props?: P) {
  if (!isClient)
    return

  // This function will be called once during mount lifecycle
  const id = useId()

  // https://unovis.dev/docs/auxiliary/Crosshair#component-props
  return (_data: DatumValue, x: number | Date) => {
    const data = isDatum(_data) && isDatum(_data.data) ? _data.data : _data
    if (!isDatum(data))
      return ""

    const serializedKey = `${id}-${serializeKey(data)}`
    const cachedContent = cache.get(serializedKey)
    if (cachedContent)
      return cachedContent

    const vnode = h(component, { ...props, payload: data, config, x })
    const div = document.createElement("div")
    render(vnode, div)
    cache.set(serializedKey, div.innerHTML)
    return div.innerHTML
  }
}
