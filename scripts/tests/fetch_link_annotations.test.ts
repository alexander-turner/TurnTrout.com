import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { type LinkAnnotation } from "../../quartz/util/annotations"
import {
  abstractHtmlFromText,
  collectCanonicalUrls,
  extractWikipediaUrls,
  fetchAnnotation,
  type FetchDeps,
  isStale,
  main,
  parseArgs,
  trimUrlMatch,
  truncateAtSentence,
  WIKIPEDIA_ATTRIBUTION,
  wikipediaSummaryUrl,
} from "../fetch_link_annotations"

const WIKI_URL = "https://en.wikipedia.org/wiki/Reinforcement_learning"
const TODAY = "2026-07-05"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function summaryPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Reinforcement learning",
    extract: "Reinforcement learning is a field of machine learning.",
    ...overrides,
  }
}

function makeDeps(overrides: Partial<FetchDeps> = {}): FetchDeps {
  return {
    fetchImpl: jest.fn(async () => jsonResponse(summaryPayload())) as unknown as typeof fetch,
    sleep: jest.fn(async () => undefined) as FetchDeps["sleep"],
    log: jest.fn(),
    today: () => TODAY,
    contentDir: "unused",
    outputPath: "unused",
    retries: 0,
    retryMinTimeoutMs: 1,
    ...overrides,
  }
}

describe("trimUrlMatch", () => {
  it.each([
    ["https://en.wikipedia.org/wiki/Foo", "https://en.wikipedia.org/wiki/Foo"],
    ["https://en.wikipedia.org/wiki/Foo.", "https://en.wikipedia.org/wiki/Foo"],
    ["https://en.wikipedia.org/wiki/Foo),", "https://en.wikipedia.org/wiki/Foo"],
    ["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
    ["https://en.wikipedia.org/wiki/Foo_(bar))", "https://en.wikipedia.org/wiki/Foo_(bar)"],
    ["https://en.wikipedia.org/wiki/Foo?x=1;", "https://en.wikipedia.org/wiki/Foo?x=1"],
  ])("trims %j to %j", (input, expected) => {
    expect(trimUrlMatch(input)).toBe(expected)
  })
})

describe("extractWikipediaUrls", () => {
  it("extracts URLs from Markdown links, including parenthesized titles", () => {
    const markdown =
      "See [RL](https://en.wikipedia.org/wiki/Reinforcement_learning) and " +
      "[objects](https://en.wikipedia.org/wiki/Object_(computer_science)) for more."
    expect(extractWikipediaUrls(markdown)).toEqual([
      "https://en.wikipedia.org/wiki/Reinforcement_learning",
      "https://en.wikipedia.org/wiki/Object_(computer_science)",
    ])
  })

  it("stops at quotes and angle brackets", () => {
    const markdown = `<a href="https://en.wikipedia.org/wiki/Foo">x</a>`
    expect(extractWikipediaUrls(markdown)).toEqual(["https://en.wikipedia.org/wiki/Foo"])
  })

  it("ignores non-Wikipedia URLs", () => {
    expect(extractWikipediaUrls("see https://example.com/wiki/Foo")).toEqual([])
  })
})

describe("collectCanonicalUrls", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fetch-annotations-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("deduplicates, canonicalizes, and sorts URLs across nested markdown files", () => {
    mkdirSync(join(dir, "sub"))
    writeFileSync(join(dir, "a.md"), `[b](http://en.wikipedia.org/wiki/Beta/) and [a](${WIKI_URL})`)
    writeFileSync(join(dir, "sub", "b.md"), `${WIKI_URL}#history`)
    writeFileSync(join(dir, "notes.txt"), "https://en.wikipedia.org/wiki/Ignored")

    expect(collectCanonicalUrls(dir)).toEqual(["https://en.wikipedia.org/wiki/Beta", WIKI_URL])
  })
})

describe("truncateAtSentence", () => {
  it("returns short text unchanged", () => {
    expect(truncateAtSentence("Short.", 100)).toBe("Short.")
  })

  it("cuts at the last sentence boundary without an ellipsis", () => {
    const text = "First sentence. Second sentence. Third goes over the limit entirely."
    expect(truncateAtSentence(text, 40)).toBe("First sentence. Second sentence.")
  })

  it("falls back to a word boundary with an ellipsis", () => {
    expect(truncateAtSentence("alpha beta gamma delta", 12)).toBe("alpha beta…")
  })

  it("hard-cuts text with no spaces", () => {
    expect(truncateAtSentence("abcdefghij", 5)).toBe("abcde…")
  })
})

describe("abstractHtmlFromText", () => {
  it("escapes HTML metacharacters", () => {
    expect(abstractHtmlFromText('<script>alert("&")</script>')).toBe(
      '<p>&#x3C;script>alert("&#x26;")&#x3C;/script></p>',
    )
  })
})

describe("wikipediaSummaryUrl", () => {
  it.each([
    [WIKI_URL, "https://en.wikipedia.org/api/rest_v1/page/summary/Reinforcement_learning"],
    // Slashes in the title must be encoded or the REST API reads them as path segments
    [
      "https://en.wikipedia.org/wiki/AC/DC",
      "https://en.wikipedia.org/api/rest_v1/page/summary/AC%2FDC",
    ],
  ])("builds the REST endpoint for %s", (canonicalUrl, expected) => {
    expect(wikipediaSummaryUrl(canonicalUrl)).toBe(expected)
  })
})

describe("fetchAnnotation", () => {
  it("builds an annotation from the summary extract", async () => {
    const deps = makeDeps()
    const annotation = await fetchAnnotation(WIKI_URL, deps)

    expect(annotation).toEqual({
      source: "wikipedia",
      title: "Reinforcement learning",
      abstract_html: "<p>Reinforcement learning is a field of machine learning.</p>",
      attribution: { ...WIKIPEDIA_ATTRIBUTION },
      retrieved: TODAY,
    })
    const fetchMock = deps.fetchImpl as jest.MockedFunction<typeof fetch>
    expect(fetchMock).toHaveBeenCalledWith(
      wikipediaSummaryUrl(WIKI_URL),
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("TurnTrout") }),
      }),
    )
  })

  it("truncates long extracts", async () => {
    const longExtract = `${"First sentence. ".repeat(100)}tail`
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        jsonResponse(summaryPayload({ extract: longExtract })),
      ) as unknown as typeof fetch,
    })
    const annotation = await fetchAnnotation(WIKI_URL, deps)
    expect(annotation?.abstract_html.length).toBeLessThan(1300)
    expect(annotation?.abstract_html.endsWith("sentence.</p>")).toBe(true)
  })

  it("returns null and logs on 404", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () => jsonResponse({}, 404)) as unknown as typeof fetch,
    })
    await expect(fetchAnnotation(WIKI_URL, deps)).resolves.toBeNull()
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No Wikipedia summary"))
  })

  it.each([
    ["a missing title", summaryPayload({ title: undefined })],
    ["a missing extract", summaryPayload({ extract: undefined })],
  ])("returns null and logs on %s", async (_desc, payload) => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch,
    })
    await expect(fetchAnnotation(WIKI_URL, deps)).resolves.toBeNull()
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Empty Wikipedia extract"))
  })

  it("retries a transient server error, then succeeds", async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(summaryPayload()))
    const deps = makeDeps({ fetchImpl: fetchMock as unknown as typeof fetch, retries: 1 })

    const annotation = await fetchAnnotation(WIKI_URL, deps)
    expect(annotation?.title).toBe("Reinforcement learning")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws once retries are exhausted", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch,
    })
    await expect(fetchAnnotation(WIKI_URL, deps)).rejects.toThrow("HTTP 500")
  })
})

describe("parseArgs", () => {
  it("defaults to a plain fetch run", () => {
    expect(parseArgs([])).toEqual({ check: false, force: false, maxAgeDays: null })
  })

  it("parses all flags", () => {
    expect(parseArgs(["--check", "--force", "--max-age-days=30"])).toEqual({
      check: true,
      force: true,
      maxAgeDays: 30,
    })
  })

  it.each([["--max-age-days=nope"], ["--max-age-days=-1"], ["--unknown"]])(
    "throws on %s",
    (arg) => {
      expect(() => parseArgs([arg])).toThrow()
    },
  )
})

describe("isStale", () => {
  it.each([
    ["no max age", "2020-01-01", null, false],
    ["fresh entry", "2026-07-01", 30, false],
    ["stale entry", "2026-01-01", 30, true],
  ])("%s -> %s", (_desc, retrieved, maxAgeDays, expected) => {
    expect(isStale(retrieved, maxAgeDays, TODAY)).toBe(expected)
  })
})

describe("main", () => {
  let dir: string
  let contentDir: string
  let outputPath: string

  const OTHER_URL = "https://en.wikipedia.org/wiki/Zebra"

  function existingAnnotation(overrides: Partial<LinkAnnotation> = {}): LinkAnnotation {
    return {
      source: "wikipedia",
      title: "Existing",
      abstract_html: "<p>Existing.</p>",
      attribution: { ...WIKIPEDIA_ATTRIBUTION },
      retrieved: "2026-07-01",
      ...overrides,
    }
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fetch-annotations-main-"))
    contentDir = join(dir, "content")
    outputPath = join(dir, "link_annotations.json")
    mkdirSync(contentDir)
    writeFileSync(join(contentDir, "post.md"), `[a](${WIKI_URL}) [z](${OTHER_URL})`)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function mainDeps(overrides: Partial<FetchDeps> = {}): FetchDeps {
    return makeDeps({ contentDir, outputPath, ...overrides })
  }

  function readOutput(): Record<string, LinkAnnotation> {
    return JSON.parse(readFileSync(outputPath, "utf-8")) as Record<string, LinkAnnotation>
  }

  it("fetches missing annotations with a delay between requests and writes sorted JSON", async () => {
    const deps = mainDeps()
    await expect(main([], deps)).resolves.toBe(0)

    const fetchMock = deps.fetchImpl as jest.MockedFunction<typeof fetch>
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // One inter-request delay for two requests
    expect(deps.sleep).toHaveBeenCalledTimes(1)
    expect(deps.sleep).toHaveBeenCalledWith(1000)
    expect(Object.keys(readOutput())).toEqual([WIKI_URL, OTHER_URL])
  })

  it("skips URLs that already have fresh annotations", async () => {
    writeFileSync(
      outputPath,
      JSON.stringify({ [WIKI_URL]: existingAnnotation(), [OTHER_URL]: existingAnnotation() }),
    )
    const deps = mainDeps()
    await expect(main([], deps)).resolves.toBe(0)
    expect(deps.fetchImpl).not.toHaveBeenCalled()
    // Untouched entries survive the rewrite
    expect(readOutput()[WIKI_URL].title).toBe("Existing")
  })

  it("--force refetches everything", async () => {
    writeFileSync(
      outputPath,
      JSON.stringify({ [WIKI_URL]: existingAnnotation(), [OTHER_URL]: existingAnnotation() }),
    )
    const deps = mainDeps()
    await expect(main(["--force"], deps)).resolves.toBe(0)
    expect(deps.fetchImpl).toHaveBeenCalledTimes(2)
    expect(readOutput()[WIKI_URL].title).toBe("Reinforcement learning")
  })

  it("--max-age-days refetches only stale entries", async () => {
    writeFileSync(
      outputPath,
      JSON.stringify({
        [WIKI_URL]: existingAnnotation({ retrieved: "2025-01-01" }),
        [OTHER_URL]: existingAnnotation(),
      }),
    )
    const deps = mainDeps()
    await expect(main(["--max-age-days=30"], deps)).resolves.toBe(0)
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("--check lists missing URLs, writes nothing, and exits non-zero", async () => {
    writeFileSync(outputPath, JSON.stringify({ [WIKI_URL]: existingAnnotation() }))
    const deps = mainDeps()
    await expect(main(["--check"], deps)).resolves.toBe(1)
    expect(deps.fetchImpl).not.toHaveBeenCalled()
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining(OTHER_URL))
    // No write happened: the file still holds only the one entry
    expect(Object.keys(readOutput())).toEqual([WIKI_URL])
  })

  it("--check exits zero when every URL is annotated", async () => {
    writeFileSync(
      outputPath,
      JSON.stringify({ [WIKI_URL]: existingAnnotation(), [OTHER_URL]: existingAnnotation() }),
    )
    await expect(main(["--check"], mainDeps())).resolves.toBe(0)
  })

  it("omits URLs Wikipedia has no summary for", async () => {
    const fetchMock = jest.fn<typeof fetch>(async (input) =>
      input.toString().includes("Zebra") ? jsonResponse({}, 404) : jsonResponse(summaryPayload()),
    )
    const deps = mainDeps({ fetchImpl: fetchMock as unknown as typeof fetch })
    await expect(main([], deps)).resolves.toBe(0)
    expect(Object.keys(readOutput())).toEqual([WIKI_URL])
  })

  it("rejects when the existing manifest is malformed", async () => {
    writeFileSync(outputPath, JSON.stringify({ [WIKI_URL]: { title: "incomplete" } }))
    await expect(main([], mainDeps())).rejects.toThrow("must be an object")
  })
})
