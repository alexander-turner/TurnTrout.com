/**
 * Loads and caches the prebuilt content index (used by search and random-post)
 * and keeps it resilient to the Page Lifecycle: a backgrounded/frozen tab can
 * leave the in-flight request hung forever, so the loader re-warms itself when
 * the tab becomes visible again.
 *
 * The bundled entry is `contentIndex.inline.ts`; renderPage.tsx injects the
 * page-relative index path as `window.__contentIndexPath` before it runs.
 */

import { type ContentDetails } from "../../plugins/vfile"
import { type FullSlug } from "../../util/path"
import { createLazyJsonLoader } from "./lazyJson"

type ContentIndexData = Record<FullSlug, ContentDetails>

declare global {
  interface Window {
    /** Page-relative URL of contentIndex.json, injected by renderPage.tsx. */
    __contentIndexPath?: string
  }
}

const loader = createLazyJsonLoader<ContentIndexData>("getContentIndex", () => {
  const path = window.__contentIndexPath
  if (!path) {
    throw new Error("window.__contentIndexPath is not set; cannot load the content index")
  }
  return path
})

/**
 * Returns the cached content-index fetch, starting one if needed. Pass
 * `forceRefresh` to discard a cached (possibly hung) promise and start over.
 * Resolves to `null` on failure so callers can retry.
 */
export function getContentIndex(forceRefresh = false): Promise<ContentIndexData | null> {
  return loader.load(forceRefresh)
}

/**
 * Re-warms the index when the tab becomes visible again, until it has loaded
 * once. Returning to a backgrounded tab always fires visibilitychange, so a
 * fetch left hung while the tab was frozen is discarded before search or
 * random-post needs the data.
 */
export function refreshContentIndexOnVisible(): void {
  if (!document.hidden && !loader.hasLoaded()) {
    void getContentIndex(true)
  }
}

/** Exposes the loader globally and installs the self-heal listener. */
export function setupContentIndexLoader(): void {
  ;(globalThis as { getContentIndex?: typeof getContentIndex }).getContentIndex = getContentIndex
  document.addEventListener("visibilitychange", refreshContentIndexOnVisible)
}

/** Resets module-level cache state between unit tests. */
export function resetContentIndexLoaderForTesting(): void {
  loader.reset()
}
