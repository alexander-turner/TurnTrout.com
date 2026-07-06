/**
 * Generic lazily-fetched, cached JSON loader shared by the content index and
 * the link-annotations manifest. The cache holds a promise, so concurrent
 * callers share one request; a failed fetch resolves to `null` and clears the
 * cache so the next call retries.
 */

export interface LazyJsonLoader<T> {
  /**
   * Returns the cached fetch, starting one if needed. Pass `forceRefresh` to
   * discard a cached (possibly hung) promise and start over. Resolves to
   * `null` on failure so callers can retry.
   */
  load(forceRefresh?: boolean): Promise<T | null>
  /** Whether a fetch has succeeded at least once. */
  hasLoaded(): boolean
  /** Clears cached state between unit tests. */
  reset(): void
}

/** `resolveUrl` runs per fetch; if it throws, `load` throws synchronously. */
export function createLazyJsonLoader<T>(
  label: string,
  resolveUrl: () => string,
): LazyJsonLoader<T> {
  let fetchData: Promise<T | null> | null = null
  let loaded = false

  return {
    load(forceRefresh = false): Promise<T | null> {
      if (forceRefresh || !fetchData) {
        const url = resolveUrl()
        fetchData = fetch(url)
          .then((res) => res.json() as Promise<T>)
          .then((json) => {
            loaded = true
            return json
          })
          .catch((err: unknown) => {
            console.error(`[${label}] Failed to load ${url}:`, err)
            fetchData = null
            return null
          })
      }
      return fetchData
    },
    hasLoaded: () => loaded,
    reset() {
      fetchData = null
      loaded = false
    },
  }
}
