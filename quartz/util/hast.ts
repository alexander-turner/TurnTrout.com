import type { Element } from "hast"

/**
 * Adds the given classes to a hast element unless already present. Tolerates
 * hast's permitted `className` forms: array, space-separated string, or unset.
 */
export function addClassesOnce(node: Element, classes: readonly string[]): void {
  const existing = node.properties.className
  let list: string[]
  if (Array.isArray(existing)) {
    list = existing.map(String)
  } else if (typeof existing === "string") {
    list = existing.split(" ").filter(Boolean)
  } else {
    list = []
  }
  for (const cls of classes) {
    if (!list.includes(cls)) {
      list.push(cls)
    }
  }
  node.properties.className = list
}
