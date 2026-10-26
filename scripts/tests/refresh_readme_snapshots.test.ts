import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import fs from "node:fs"
import path from "node:path"

import { SNAPSHOT_SOURCES, snapshotSourcesFrom } from "../../config/quartz/externalReadmes"
import {
  githubSnapshotPath,
  README_SNAPSHOT_DIR,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"
import { fetchReadme, refreshSnapshots } from "../refresh_readme_snapshots"
import { fakeGitHub, Reply } from "./fakeGitHub"

const SOURCE = { owner: "test-owner", repo: "test-repo" }

/** A client that answers every request with `body`. */
const serving = (body: string) => fakeGitHub(() => body).github

describe("refresh_readme_snapshots", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("fetchReadme", () => {
    it.each([
      [SOURCE, "/repos/test-owner/test-repo/contents/README.md?ref=main"],
      [
        { owner: "o", repo: "r", ref: "feature/x", path: "docs/a b#c.md" },
        "/repos/o/r/contents/docs%2Fa%20b%23c.md?ref=feature%2Fx",
      ],
    ])("fetches the raw file %j names", async (source, urlPath) => {
      const { github, urls, fetch } = fakeGitHub(() => "readme body")
      await expect(fetchReadme(source, github)).resolves.toBe("readme body")
      expect(urls).toEqual([`https://api.github.com${urlPath}`])
      const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
      expect(init.headers).toMatchObject({ accept: "application/vnd.github.v3.raw" })
    })
  })

  describe("SNAPSHOT_SOURCES", () => {
    it("has a committed snapshot on disk for every configured source", () => {
      expect(SNAPSHOT_SOURCES.length).toBeGreaterThan(0)
      const missing = SNAPSHOT_SOURCES.filter(
        (source) => !fs.existsSync(githubSnapshotPath(source)),
      ).map(githubSnapshotPath)
      expect(missing).toEqual([])
    })
  })

  describe("snapshotSourcesFrom", () => {
    const punctilio = { owner: "o", repo: "punctilio" }

    it("fetches a repo listed in two groups once, keeping first-occurrence page order", () => {
      expect(
        snapshotSourcesFrom({
          first: [
            { heading: "A", source: punctilio },
            { heading: "B", source: { owner: "o", repo: "second" } },
          ],
          later: [{ heading: "C", source: punctilio }],
        }),
      ).toEqual([punctilio, { owner: "o", repo: "second" }])
    })

    it("keeps two sources that share a repo but differ by ref or path", () => {
      const sources = snapshotSourcesFrom({
        group: [
          { heading: "A", source: { owner: "o", repo: "r" } },
          { heading: "B", source: { owner: "o", repo: "r", ref: "dev" } },
          { heading: "C", source: { owner: "o", repo: "r", path: "docs/API.md" } },
        ],
      })
      expect(sources.map(githubSnapshotPath).map((p) => path.basename(p))).toEqual([
        "o__r__main__README.md",
        "o__r__dev__README.md",
        "o__r__main__docs__API.md",
      ])
    })
  })

  describe("refreshSnapshots", () => {
    const sources = [SOURCE]
    const snapshotPath = githubSnapshotPath(SOURCE)
    let mkdirSpy: jest.SpiedFunction<typeof fs.mkdirSync>
    let existsSpy: jest.SpiedFunction<typeof fs.existsSync>
    let readSpy: jest.SpiedFunction<typeof fs.readFileSync>
    let writeSpy: jest.SpiedFunction<typeof fs.writeFileSync>
    let readdirSpy: jest.SpiedFunction<typeof fs.readdirSync>
    let rmSpy: jest.SpiedFunction<typeof fs.rmSync>

    beforeEach(() => {
      mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined)
      existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false)
      readSpy = jest.spyOn(fs, "readFileSync").mockReturnValue("")
      writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
      readdirSpy = jest.spyOn(fs, "readdirSync").mockReturnValue([]) as jest.SpiedFunction<
        typeof fs.readdirSync
      >
      rmSpy = jest.spyOn(fs, "rmSync").mockImplementation(() => undefined)
    })

    it("writes a new snapshot when none exists", async () => {
      const result = await refreshSnapshots(sources, serving("fresh"))
      expect(mkdirSpy).toHaveBeenCalledWith(README_SNAPSHOT_DIR, { recursive: true })
      expect(writeSpy).toHaveBeenCalledWith(snapshotPath, "fresh", "utf-8")
      expect(result).toEqual({
        written: ["test-owner__test-repo__main__README.md"],
        unchanged: [],
        failed: [],
        pruned: [],
      })
    })

    it("rewrites a snapshot whose upstream content changed", async () => {
      existsSpy.mockReturnValue(true)
      readSpy.mockReturnValue("stale")
      const result = await refreshSnapshots(sources, serving("fresh"))
      expect(writeSpy).toHaveBeenCalledWith(snapshotPath, "fresh", "utf-8")
      expect(result.written).toEqual(["test-owner__test-repo__main__README.md"])
    })

    it("leaves an identical snapshot untouched", async () => {
      existsSpy.mockReturnValue(true)
      readSpy.mockReturnValue("same")
      const result = await refreshSnapshots(sources, serving("same"))
      expect(writeSpy).not.toHaveBeenCalled()
      expect(result).toEqual({
        written: [],
        unchanged: ["test-owner__test-repo__main__README.md"],
        failed: [],
        pruned: [],
      })
    })

    it("keeps the last-known-good snapshot and continues past a failing source", async () => {
      const twoSources = [
        { owner: "o", repo: "broken" },
        { owner: "o", repo: "working" },
      ]
      const { github } = fakeGitHub((url) =>
        url.pathname.includes("broken") ? new Reply(404) : "ok",
      )
      const result = await refreshSnapshots(twoSources, github)
      expect(result.failed).toEqual(["o__broken__main__README.md"])
      expect(result.written).toEqual(["o__working__main__README.md"])
      expect(writeSpy).toHaveBeenCalledTimes(1)
    })

    it("labels two sources that differ only by ref distinctly", async () => {
      const result = await refreshSnapshots([SOURCE, { ...SOURCE, ref: "dev" }], serving("body"))
      expect(result.written).toEqual([
        "test-owner__test-repo__main__README.md",
        "test-owner__test-repo__dev__README.md",
      ])
    })

    it("prunes snapshots that no longer match any configured source", async () => {
      const orphanName = "old-owner__old-repo__main__README.md"
      readdirSpy.mockReturnValue([orphanName] as unknown as ReturnType<typeof fs.readdirSync>)
      const result = await refreshSnapshots(sources, serving("fresh"))
      expect(rmSpy).toHaveBeenCalledWith(`${README_SNAPSHOT_DIR}/${orphanName}`)
      expect(result.pruned).toEqual([orphanName])
    })

    it("keeps snapshots that match a configured source", async () => {
      readdirSpy.mockReturnValue([
        "test-owner__test-repo__main__README.md",
      ] as unknown as ReturnType<typeof fs.readdirSync>)
      const result = await refreshSnapshots(sources, serving("fresh"))
      expect(rmSpy).not.toHaveBeenCalled()
      expect(result.pruned).toEqual([])
    })

    it("defaults to the configured SNAPSHOT_SOURCES", async () => {
      // A fresh Response per call — a body can only be read once
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(() =>
          Promise.resolve(new Response("body", { headers: { "content-type": "text/plain" } })),
        )
      const result = await refreshSnapshots()
      expect(result.written).toEqual(
        SNAPSHOT_SOURCES.map((source) => path.basename(githubSnapshotPath(source))),
      )
      expect(result.failed).toEqual([])
      expect(fetchSpy).toHaveBeenCalledTimes(SNAPSHOT_SOURCES.length)
    })
  })
})
