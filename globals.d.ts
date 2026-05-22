/**
 * Options accepted by SPA navigation. `searchTerm` activates highlight-and-scroll
 * on the destination page without round-tripping the term through the URL hash.
 */
export interface SpaNavigateOptions {
  scroll?: boolean
  fetch?: boolean
  searchTerm?: string
}

declare global {
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void
  }
  interface Window {
    __routerInitialized?: boolean
    spaNavigate: (url: URL, opts?: SpaNavigateOptions) => Promise<void>
    addCleanup(fn: (...args: never[]) => void)
  }
}
