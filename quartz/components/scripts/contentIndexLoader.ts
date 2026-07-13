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

type ContentIndexData = Record<FullSlug, ContentDetails>

declare global {
  interface Window {
    /** Page-relative URL of contentIndex.json, injected by renderPage.tsx. */
    __contentIndexPath?: string
  }
}

let fetchData: Promise<ContentIndexData | null> | null = null
let indexLoaded = false

/**
 * Returns the cached content-index fetch, starting one if needed. Pass
 * `forceRefresh` to discard a cached (possibly hung) promise and start over.
 * Resolves to `null` on failure so callers can retry.
 */
export function getContentIndex(forceRefresh = false): Promise<ContentIndexData | null> {
  if (forceRefresh || !fetchData) {
    const path = window.__contentIndexPath
    if (!path) {
      throw new Error("window.__contentIndexPath is not set; cannot load the content index")
    }
    fetchData = fetch(path)
      .then((res) => res.json() as Promise<ContentIndexData>)
      .then((json) => {
        indexLoaded = true
        return json
      })
      .catch((err: unknown) => {
        console.error("[getContentIndex] Failed to load content index:", err)
        fetchData = null
        return null
      })
  }
  return fetchData
}

/**
 * Re-warms the index when the tab becomes visible again, until it has loaded
 * once. Returning to a backgrounded tab always fires visibilitychange, so a
 * fetch left hung while the tab was frozen is discarded before search or
 * random-post needs the data.
 */
export function refreshContentIndexOnVisible(): void {
  if (!document.hidden && !indexLoaded) {
    // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
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
  fetchData = null
  indexLoaded = false
}
