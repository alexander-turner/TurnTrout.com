import type { Element } from "hast"

import { toString } from "hast-util-to-string"

import { addClass, createElementVisitorPlugin, isElementNode } from "./utils"

const MARKER = "==="
const BOUNDARY_CLASS = "group-boundary"

export function isMarkerRow(row: Element): boolean {
  if (row.tagName !== "tr") return false
  const cells = row.children.filter(isElementNode)
  return cells.length > 0 && cells.every((c) => c.tagName === "td" && toString(c).trim() === MARKER)
}

export function processTableBody(tbody: Element): void {
  const kept: typeof tbody.children = []
  let prevRow: Element | null = null
  for (const child of tbody.children) {
    if (isElementNode(child) && isMarkerRow(child)) {
      if (prevRow) addClass(prevRow, BOUNDARY_CLASS)
      continue
    }
    if (isElementNode(child) && child.tagName === "tr") prevRow = child
    kept.push(child)
  }
  tbody.children = kept
}

/**
 * Adds darker horizontal dividers between groups of rows in a table.
 * Author marks a divider with a body row whose every <td> contains only "===";
 * that row is removed and the row preceding it gains `.group-boundary`, which
 * darkens its bottom border to visually separate the groups.
 */
export const TableDivider = createElementVisitorPlugin("TableDivider", (node) => {
  if (node.tagName !== "table") return
  for (const child of node.children) {
    if (isElementNode(child) && child.tagName === "tbody") processTableBody(child)
  }
})
