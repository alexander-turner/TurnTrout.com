import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import fs from "node:fs"

import {
  githubSnapshotPath,
  README_SNAPSHOT_DIR,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"
import {
  apiUrl,
  BASE_DELAY_MS,
  fetchReadme,
  MAX_ATTEMPTS,
  refreshSnapshots,
} from "../refresh_readme_snapshots"

const SOURCE = { owner: "test-owner", repo: "test-repo" }
const SOURCE_URL = apiUrl(SOURCE)

function response(status: number, body = ""): Response {
  return new Response(body, { status })
}

describe("refresh_readme_snapshots", () => {
  const sleepFn = jest.fn<(ms: number) => Promise<unknown>>(() => Promise.resolve())
  let savedToken: string | undefined

  beforeEach(() => {
    savedToken = process.env.GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN
  })

  afterEach(() => {
    if (savedToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = savedToken
    }
    jest.restoreAllMocks()
  })

  describe("apiUrl", () => {
    it.each([
      [SOURCE, "https://api.github.com/repos/test-owner/test-repo/contents/README.md?ref=main"],
      [
        { owner: "o", repo: "r", ref: "develop", path: "docs/API.md" },
        "https://api.github.com/repos/o/r/contents/docs/API.md?ref=develop",
      ],
    ])("builds the contents-API URL for %j", (source, expected) => {
      expect(apiUrl(source)).toBe(expected)
    })
  })

  describe("fetchReadme", () => {
    it("returns the body on first success, without sleeping", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200, "readme body"))
      await expect(fetchReadme(SOURCE, { fetchFn, sleepFn })).resolves.toBe("readme body")
      expect(fetchFn).toHaveBeenCalledTimes(1)
      expect(sleepFn).not.toHaveBeenCalled()
    })

    it("omits the authorization header when no token is available", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200))
      await fetchReadme(SOURCE, { fetchFn, sleepFn })
      const [, init] = fetchFn.mock.calls[0]
      expect(init?.headers).not.toHaveProperty("authorization")
      expect(init?.headers).toMatchObject({ accept: "application/vnd.github.raw+json" })
    })

    it("sends the authorization header when a token is provided", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200))
      await fetchReadme(SOURCE, { fetchFn, sleepFn, token: "tok123" })
      const [, init] = fetchFn.mock.calls[0]
      expect(init?.headers).toMatchObject({ authorization: "Bearer tok123" })
    })

    it("defaults to global fetch and the GITHUB_TOKEN env var", async () => {
      process.env.GITHUB_TOKEN = "env-token"
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(response(200, "via global fetch"))
      await expect(fetchReadme(SOURCE)).resolves.toBe("via global fetch")
      const [, init] = fetchSpy.mock.calls[0]
      expect(init?.headers).toMatchObject({ authorization: "Bearer env-token" })
    })

    it("retries transient HTTP failures with exponential backoff", async () => {
      const fetchFn = jest
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(500))
        .mockResolvedValueOnce(response(429))
        .mockResolvedValueOnce(response(200, "eventually"))
      await expect(fetchReadme(SOURCE, { fetchFn, sleepFn })).resolves.toBe("eventually")
      expect(sleepFn.mock.calls).toEqual([[BASE_DELAY_MS], [BASE_DELAY_MS * 2]])
    })

    it("retries network errors and reports the last one as the cause", async () => {
      const networkError = new Error("socket hang up")
      const fetchFn = jest.fn<typeof fetch>().mockRejectedValue(networkError)
      let thrown: Error | undefined
      try {
        await fetchReadme(SOURCE, { fetchFn, sleepFn })
      } catch (e) {
        thrown = e as Error
      }
      expect(thrown?.message).toBe(`Failed to fetch ${SOURCE_URL} after ${MAX_ATTEMPTS} attempts`)
      expect(thrown?.cause).toBe(networkError)
      expect(fetchFn).toHaveBeenCalledTimes(MAX_ATTEMPTS)
    })

    it("wraps non-Error rejections in an Error", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockRejectedValue("string failure")
      let thrown: Error | undefined
      try {
        await fetchReadme(SOURCE, { fetchFn, sleepFn })
      } catch (e) {
        thrown = e as Error
      }
      expect((thrown?.cause as Error).message).toBe("string failure")
    })

    it("reports the last HTTP status when every attempt fails", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(502))
      let thrown: Error | undefined
      try {
        await fetchReadme(SOURCE, { fetchFn, sleepFn })
      } catch (e) {
        thrown = e as Error
      }
      expect((thrown?.cause as Error).message).toBe(`${SOURCE_URL} returned HTTP 502`)
    })

    it("fails immediately on 404 without retrying", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(404))
      await expect(fetchReadme(SOURCE, { fetchFn, sleepFn })).rejects.toThrow(
        `${SOURCE_URL} returned 404 — check the owner/repo/ref/path configuration`,
      )
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("refreshSnapshots", () => {
    const sources = { "test-repo": SOURCE }
    const snapshotPath = githubSnapshotPath(SOURCE)
    let mkdirSpy: jest.SpiedFunction<typeof fs.mkdirSync>
    let existsSpy: jest.SpiedFunction<typeof fs.existsSync>
    let readSpy: jest.SpiedFunction<typeof fs.readFileSync>
    let writeSpy: jest.SpiedFunction<typeof fs.writeFileSync>

    beforeEach(() => {
      mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined)
      existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false)
      readSpy = jest.spyOn(fs, "readFileSync").mockReturnValue("")
      writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
    })

    it("writes a new snapshot when none exists", async () => {
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200, "fresh"))
      const result = await refreshSnapshots(sources, { fetchFn, sleepFn })
      expect(mkdirSpy).toHaveBeenCalledWith(README_SNAPSHOT_DIR, { recursive: true })
      expect(writeSpy).toHaveBeenCalledWith(snapshotPath, "fresh", "utf-8")
      expect(result).toEqual({ written: ["test-repo"], unchanged: [], failed: [] })
    })

    it("rewrites a snapshot whose upstream content changed", async () => {
      existsSpy.mockReturnValue(true)
      readSpy.mockReturnValue("stale")
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200, "fresh"))
      const result = await refreshSnapshots(sources, { fetchFn, sleepFn })
      expect(writeSpy).toHaveBeenCalledWith(snapshotPath, "fresh", "utf-8")
      expect(result.written).toEqual(["test-repo"])
    })

    it("leaves an identical snapshot untouched", async () => {
      existsSpy.mockReturnValue(true)
      readSpy.mockReturnValue("same")
      const fetchFn = jest.fn<typeof fetch>().mockResolvedValue(response(200, "same"))
      const result = await refreshSnapshots(sources, { fetchFn, sleepFn })
      expect(writeSpy).not.toHaveBeenCalled()
      expect(result).toEqual({ written: [], unchanged: ["test-repo"], failed: [] })
    })

    it("keeps the last-known-good snapshot and continues past a failing source", async () => {
      const twoSources = {
        broken: { owner: "o", repo: "broken" },
        working: { owner: "o", repo: "working" },
      }
      const fetchFn = jest
        .fn<typeof fetch>()
        .mockImplementation((url) =>
          Promise.resolve(String(url).includes("broken") ? response(404) : response(200, "ok")),
        )
      const result = await refreshSnapshots(twoSources, { fetchFn, sleepFn })
      expect(result.failed).toEqual(["broken"])
      expect(result.written).toEqual(["working"])
      expect(writeSpy).toHaveBeenCalledTimes(1)
    })

    it("defaults to the configured GITHUB_README_SOURCES", async () => {
      // A fresh Response per call — a body can only be read once
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(() => Promise.resolve(response(200, "body")))
      const result = await refreshSnapshots()
      expect(result.failed).toEqual([])
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(0)
    })
  })
})
