/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  getContentIndex,
  refreshContentIndexOnVisible,
  resetContentIndexLoaderForTesting,
  setupContentIndexLoader,
} from "../contentIndexLoader"

const INDEX_PATH = "static/contentIndex.json"
const SAMPLE_INDEX = {
  "/sample": {
    title: "Sample",
    content: "sample content",
    slug: "/sample",
    authors: [],
    tags: [],
    links: [],
  },
}

function mockFetchResolving(data: unknown): jest.Mock {
  const fetchMock = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(data) }))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function mockFetchRejecting(error: Error): jest.Mock {
  const fetchMock = jest.fn(() => Promise.reject(error))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

/** Force document.hidden to a fixed value (jsdom leaves it read-only otherwise). */
function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
}

describe("contentIndexLoader", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    resetContentIndexLoaderForTesting()
    window.__contentIndexPath = INDEX_PATH
    setDocumentHidden(false)
    // skipcq: JS-0321 -- intentional no-op: suppress console.error noise in tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    document.removeEventListener("visibilitychange", refreshContentIndexOnVisible)
    resetContentIndexLoaderForTesting()
    Reflect.deleteProperty(window, "__contentIndexPath")
    Reflect.deleteProperty(globalThis, "getContentIndex")
  })

  describe("getContentIndex", () => {
    it("fetches the index from the injected path and resolves the parsed data", async () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      await expect(getContentIndex()).resolves.toEqual(SAMPLE_INDEX)
      expect(fetchMock).toHaveBeenCalledWith(INDEX_PATH)
    })

    it("caches the in-flight promise so concurrent callers share one fetch", async () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      const [a, b] = await Promise.all([getContentIndex(), getContentIndex()])
      expect(a).toBe(b)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("forceRefresh discards the cached promise and starts a new fetch", async () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      await getContentIndex()
      await getContentIndex(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("resolves null, logs, and clears the cache when the fetch fails (so a retry refetches)", async () => {
      const fetchMock = mockFetchRejecting(new Error("network down"))
      await expect(getContentIndex()).resolves.toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
      // Cache was cleared on failure: a subsequent call fetches again.
      await getContentIndex()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("throws when the index path was never injected", () => {
      Reflect.deleteProperty(window, "__contentIndexPath")
      expect(() => getContentIndex()).toThrow(/__contentIndexPath/)
    })
  })

  describe("refreshContentIndexOnVisible", () => {
    it("re-warms the index when the tab is visible and the index has not loaded", () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      refreshContentIndexOnVisible()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does nothing while the tab is hidden", () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      setDocumentHidden(true)
      refreshContentIndexOnVisible()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("does nothing once the index has already loaded", async () => {
      const fetchMock = mockFetchResolving(SAMPLE_INDEX)
      await getContentIndex()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      refreshContentIndexOnVisible()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("setupContentIndexLoader", () => {
    it("exposes getContentIndex globally and registers the visibilitychange self-heal", () => {
      const addEventListenerSpy = jest.spyOn(document, "addEventListener")
      setupContentIndexLoader()

      expect((globalThis as { getContentIndex?: unknown }).getContentIndex).toBe(getContentIndex)
      // Cast away the site's CustomEventMap overloads (which don't list
      // "visibilitychange") so we can match the plain listener registration.
      const registrations = addEventListenerSpy.mock.calls as unknown as Array<[string, unknown]>
      expect(
        registrations.some(
          ([type, handler]) =>
            type === "visibilitychange" && handler === refreshContentIndexOnVisible,
        ),
      ).toBe(true)
      addEventListenerSpy.mockRestore()
    })
  })
})
