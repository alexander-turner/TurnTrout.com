export declare global {
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void
  }
  interface Window {
    spaNavigate: (url: URL, opts?: { scroll?: boolean; fetch?: boolean }) => Promise<void>
    addCleanup(fn: (...args: never[]) => void)
  }
}
