/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import { createLazyJsonLoader } from "./lazyJson"

const URL_PATH = "/static/sample.json"
const SAMPLE = { hello: "world" }

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

describe("createLazyJsonLoader", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // skipcq: JS-0321 -- intentional no-op: suppress console.error noise in tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    globalThis.fetch = originalFetch
  })

  function makeLoader() {
    return createLazyJsonLoader<typeof SAMPLE>("testLoader", () => URL_PATH)
  }

  it("fetches and returns the JSON payload", async () => {
    const fetchMock = mockFetchResolving(SAMPLE)
    const loader = makeLoader()
    expect(loader.hasLoaded()).toBe(false)
    await expect(loader.load()).resolves.toEqual(SAMPLE)
    expect(fetchMock).toHaveBeenCalledWith(URL_PATH)
    expect(loader.hasLoaded()).toBe(true)
  })

  it("shares one request across concurrent callers", async () => {
    const fetchMock = mockFetchResolving(SAMPLE)
    const loader = makeLoader()
    const [a, b] = await Promise.all([loader.load(), loader.load()])
    expect(a).toEqual(SAMPLE)
    expect(b).toEqual(SAMPLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("resolves to null on failure, then retries on the next call", async () => {
    const fetchMock = mockFetchRejecting(new Error("network down"))
    const loader = makeLoader()
    await expect(loader.load()).resolves.toBeNull()
    expect(loader.hasLoaded()).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalled()

    mockFetchResolving(SAMPLE)
    await expect(loader.load()).resolves.toEqual(SAMPLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("forceRefresh discards the cached promise", async () => {
    const fetchMock = mockFetchResolving(SAMPLE)
    const loader = makeLoader()
    await loader.load()
    await loader.load(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reset clears cached state", async () => {
    const fetchMock = mockFetchResolving(SAMPLE)
    const loader = makeLoader()
    await loader.load()
    expect(loader.hasLoaded()).toBe(true)
    loader.reset()
    expect(loader.hasLoaded()).toBe(false)
    await loader.load()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws synchronously when resolveUrl throws", () => {
    mockFetchResolving(SAMPLE)
    const loader = createLazyJsonLoader("testLoader", () => {
      throw new Error("no path configured")
    })
    expect(() => loader.load()).toThrow("no path configured")
  })
})
