import type { Root as MdRoot } from "mdast"

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import remarkFrontmatter from "remark-frontmatter"
import remarkParse from "remark-parse"
import { unified } from "unified"

import type { BuildCtx } from "../util/ctx"
import type { FilePath, FullSlug } from "../util/path"

import { formatTitle } from "../components/component_utils"
import { titleIndexFile } from "../components/constants.server"
import { buildTitleIndex, computeTitleIndex, extractHeadings } from "./buildTitleIndex"

const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"])

function parse(md: string): MdRoot {
  return parser.parse(md) as MdRoot
}

describe("extractHeadings", () => {
  it("maps heading ids to their text", () => {
    const headings = extractHeadings(parse("## My Heading\n\n### Another One"))
    expect(headings.get("my-heading")).toBe("My Heading")
    expect(headings.get("another-one")).toBe("Another One")
  })

  it("suffixes duplicate heading ids per document", () => {
    const headings = extractHeadings(parse("## Repeat\n\n## Repeat"))
    expect(headings.get("repeat")).toBe("Repeat")
    expect(headings.get("repeat-1")).toBe("Repeat")
  })

  it("returns an empty map when there are no headings", () => {
    expect(extractHeadings(parse("just a paragraph")).size).toBe(0)
  })
})

describe("computeTitleIndex", () => {
  let dir: string
  const ctx = {
    argv: { directory: "" },
    cfg: { plugins: { transformers: [] } },
  } as unknown as BuildCtx

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "title-index-"))
    ;(ctx.argv as { directory: string }).directory = dir
    fs.writeFileSync(
      path.join(dir, "with-title.md"),
      "---\ntitle: The Real Title\n---\n\n## A Section\n",
    )
    fs.writeFileSync(path.join(dir, "no-title.md"), "no frontmatter here\n")
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("indexes the frontmatter title and section headings", async () => {
    const index = await computeTitleIndex(ctx, [path.join(dir, "with-title.md") as FilePath])
    const entry = index.get("with-title" as FullSlug)
    expect(entry?.title).toBe(formatTitle("The Real Title"))
    expect(entry?.headings.get("a-section")).toBe("A Section")
  })

  it("falls back to the file stem when no title frontmatter is present", async () => {
    const index = await computeTitleIndex(ctx, [path.join(dir, "no-title.md") as FilePath])
    const entry = index.get("no-title" as FullSlug)
    expect(entry?.title).toBe(formatTitle("no-title"))
  })

  it("applies configured text transforms before parsing", async () => {
    const transformingCtx = {
      argv: { directory: dir },
      cfg: {
        plugins: {
          transformers: [
            { name: "upper", textTransform: (_c: BuildCtx, s: string) => s.toUpperCase() },
          ],
        },
      },
    } as unknown as BuildCtx
    const index = await computeTitleIndex(transformingCtx, [
      path.join(dir, "with-title.md") as FilePath,
    ])
    const entry = index.get("with-title" as FullSlug)
    expect(entry?.headings.get("a-section")).toBe("A SECTION")
  })

  it("keeps the content when a text transform returns undefined", async () => {
    const noopCtx = {
      argv: { directory: dir },
      cfg: { plugins: { transformers: [{ name: "noop", textTransform: () => undefined }] } },
    } as unknown as BuildCtx
    const index = await computeTitleIndex(noopCtx, [path.join(dir, "with-title.md") as FilePath])
    expect(index.get("with-title" as FullSlug)?.headings.get("a-section")).toBe("A Section")
  })

  it("buildTitleIndex writes the index to the cache file", async () => {
    await buildTitleIndex(ctx, [path.join(dir, "with-title.md") as FilePath])
    const entries = JSON.parse(fs.readFileSync(titleIndexFile, "utf8")) as Array<[string, unknown]>
    fs.rmSync(titleIndexFile, { force: true })
    expect(entries.map(([slug]) => slug)).toContain("with-title")
  })
})
