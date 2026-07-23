import { TOC_AUTOSCROLL_PADDING_PX, TOC_SCROLLOFF_COUNT } from "../constants"

/**
 * Geometry needed to decide where the desktop ToC sidebar should scroll so the
 * active link stays visible with a vim-`scrolloff`-style buffer. All vertical
 * fields are in the sidebar's content coordinates (px from the top of its
 * scrollable content).
 */
export interface AutoScrollMetrics {
  readonly scrollTop: number
  readonly clientHeight: number
  readonly scrollHeight: number
  readonly aboveAnchorTop: number
  readonly activeTop: number
  readonly activeBottom: number
  readonly belowAnchorBottom: number
  readonly padding: number
}

/**
 * The two ToC entries that must stay visible around the active one: `scrolloff`
 * entries before and after it, clamped to the ends of the list.
 */
export function getScrolloffAnchors<T>(
  items: readonly T[],
  activeIndex: number,
  scrolloff: number,
): { readonly above: T; readonly below: T } {
  if (items.length === 0) {
    throw new Error("getScrolloffAnchors: items is empty")
  }
  const above = items[Math.max(0, activeIndex - scrolloff)]
  const below = items[Math.min(items.length - 1, activeIndex + scrolloff)]
  return { above, below }
}

/**
 * Given the sidebar's current geometry, return the scrollTop that keeps the
 * active link plus its scrolloff neighbours in view, or `null` if no scroll is
 * needed. Rules are applied in order: pull the below-anchor into view (scrolling
 * down), then the above-anchor (scrolling up / when both can't fit the up-rule
 * wins), then guarantee the active link itself stays visible even when the
 * scrolloff window is taller than the viewport.
 */
export function computeAutoScrollTop(m: AutoScrollMetrics): number | null {
  const maxScroll = m.scrollHeight - m.clientHeight
  if (maxScroll <= 0) return null

  let target = m.scrollTop
  if (m.belowAnchorBottom + m.padding > target + m.clientHeight) {
    target = m.belowAnchorBottom + m.padding - m.clientHeight
  }
  if (m.aboveAnchorTop - m.padding < target) {
    target = m.aboveAnchorTop - m.padding
  }
  if (m.activeBottom + m.padding > target + m.clientHeight) {
    target = Math.min(m.activeBottom + m.padding - m.clientHeight, m.activeTop - m.padding)
  }

  const clamped = Math.max(0, Math.min(target, maxScroll))
  return Math.abs(clamped - m.scrollTop) < 1 ? null : clamped
}

/**
 * Scroll `sidebar` so the active ToC link (and its scrolloff neighbours) stay
 * visible. No-op when the sidebar isn't a scroll container (mobile, or a ToC
 * short enough to fit), so callers don't need to duplicate the breakpoint.
 */
export function scrollActiveTocLinkIntoView(
  sidebar: HTMLElement,
  links: readonly HTMLElement[],
  activeIndex: number,
  behavior: ScrollBehavior,
): void {
  if (sidebar.scrollHeight <= sidebar.clientHeight) return

  const anchors = getScrolloffAnchors(links, activeIndex, TOC_SCROLLOFF_COUNT)
  const sidebarTop = sidebar.getBoundingClientRect().top
  const toContent = (viewportY: number): number => viewportY - sidebarTop + sidebar.scrollTop

  const activeRect = links[activeIndex].getBoundingClientRect()
  const top = computeAutoScrollTop({
    scrollTop: sidebar.scrollTop,
    clientHeight: sidebar.clientHeight,
    scrollHeight: sidebar.scrollHeight,
    aboveAnchorTop: toContent(anchors.above.getBoundingClientRect().top),
    activeTop: toContent(activeRect.top),
    activeBottom: toContent(activeRect.bottom),
    belowAnchorBottom: toContent(anchors.below.getBoundingClientRect().bottom),
    padding: TOC_AUTOSCROLL_PADDING_PX,
  })

  if (top !== null) {
    sidebar.scrollTo({ top, behavior })
  }
}
