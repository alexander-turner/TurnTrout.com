import type { Element, ElementContent } from "hast"

import { createElementVisitorPlugin, isElementNode, isTextNode } from "./utils"

const MARKER = "==="
const BOUNDARY_CLASS = "group-boundary"

function cellText(cell: Element): string {
  let out = ""
  for (const child of cell.children) {
    if (isTextNode(child)) {
      out += child.value
    } else if (isElementNode(child)) {
      out += cellText(child)
    }
  }
  return out.trim()
}

export function isMarkerRow(row: Element): boolean {
  if (row.tagName !== "tr") return false
  const cells = row.children.filter(isElementNode)
  if (cells.length === 0) return false
  return cells.every(
    (cell) => (cell.tagName === "td" || cell.tagName === "th") && cellText(cell) === MARKER,
  )
}

export function addClass(element: Element, className: string): void {
  const props = element.properties ?? {}
  const existing = props.className
  let classList: string[]
  if (Array.isArray(existing)) {
    classList = existing.map(String)
  } else if (typeof existing === "string") {
    classList = existing.split(/\s+/).filter(Boolean)
  } else {
    classList = []
  }
  if (!classList.includes(className)) {
    classList.push(className)
  }
  element.properties = { ...props, className: classList }
}

export function processTableSection(section: Element): void {
  const newChildren: ElementContent[] = []
  let pendingBoundary = false
  for (const child of section.children) {
    if (isElementNode(child) && isMarkerRow(child)) {
      pendingBoundary = true
      continue
    }
    if (pendingBoundary && isElementNode(child) && child.tagName === "tr") {
      addClass(child, BOUNDARY_CLASS)
      pendingBoundary = false
    }
    newChildren.push(child)
  }
  section.children = newChildren
}

function processNode(node: Element): void {
  if (node.tagName !== "table") return
  for (const child of node.children) {
    if (
      isElementNode(child) &&
      (child.tagName === "tbody" || child.tagName === "thead" || child.tagName === "tfoot")
    ) {
      processTableSection(child)
    }
  }
}

/**
 * Adds darker horizontal dividers between groups of rows in a table.
 *
 * Author marks a divider by inserting a body row whose every cell contains
 * only "===". That row is removed from the rendered table, and the row
 * immediately following gains the `.group-boundary` class so CSS can draw
 * a darker top border above it.
 */
export const TableDivider = createElementVisitorPlugin("TableDivider", processNode)
