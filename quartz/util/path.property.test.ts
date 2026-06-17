import { describe, expect, it } from "@jest/globals"
import fc from "fast-check"

import {
  endsWith,
  type FilePath,
  type FullSlug,
  getAllSegmentPrefixes,
  getFullSlug,
  isFullSlug,
  isRelativeURL,
  isSimpleSlug,
  joinSegments,
  normalizeRelativeURLs,
  pathToRoot,
  resolveRelative,
  simplifySlug,
  slugifyFilePath,
  slugTag,
  splitAnchor,
  stripSlashes,
  transformInternalLink,
  transformLink,
} from "./path"

// Deterministic runs: a fixed seed keeps CI reproducible (zero-flakiness policy).
fc.configureGlobal({ seed: 20260612, numRuns: 300 })

/** Path segment without separators or characters the slugger strips. */
const safeSegment = fc.stringMatching(/^[\w-]+$/).filter((s) => s.length > 0 && s.length < 20)

/** A slug built from safe segments, e.g. "foo/bar/baz". */
const safeSlug = fc
  .array(safeSegment, { minLength: 1, maxLength: 5 })
  .map((segs) => segs.join("/") as FullSlug)

/** A file path with a markdown-ish extension. */
const safeFilePath = fc
  .tuple(
    fc.array(safeSegment, { minLength: 1, maxLength: 4 }),
    fc.constantFrom(".md", ".html", ".png", ".pdf", ".txt"),
  )
  .map(([segs, ext]) => (segs.join("/") + ext) as FilePath)

describe("path utilities (property)", () => {
  describe("stripSlashes", () => {
    it("is the identity for strings without boundary slashes", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.startsWith("/") && !s.endsWith("/")),
          (s) => {
            expect(stripSlashes(s)).toBe(s)
          },
        ),
      )
    })

    it("removes exactly one slash from each end", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.startsWith("/") && !s.endsWith("/") && s !== ""),
          (s) => {
            expect(stripSlashes(`/${s}/`)).toBe(s)
            expect(stripSlashes(`/${s}/`, true)).toBe(`${s}/`)
          },
        ),
      )
    })
  })

  describe("joinSegments", () => {
    it("round-trips with split for slash-free segments", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { minLength: 1, maxLength: 6 }), (segs) => {
          expect(joinSegments(...segs).split("/")).toEqual(segs)
        }),
      )
    })

    it("never produces consecutive slashes", () => {
      fc.assert(
        fc.property(fc.array(fc.string({ unit: "binary" }), { maxLength: 6 }), (segs) => {
          expect(joinSegments(...segs)).not.toMatch(/\/{2,}/)
        }),
      )
    })

    it("ignores empty segments", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { minLength: 1, maxLength: 4 }), (segs) => {
          expect(joinSegments("", ...segs, "")).toBe(joinSegments(...segs))
        }),
      )
    })
  })

  describe("getAllSegmentPrefixes", () => {
    it("returns one prefix per segment, ending with the full input", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { minLength: 1, maxLength: 6 }), (segs) => {
          const tag = segs.join("/")
          const prefixes = getAllSegmentPrefixes(tag)
          expect(prefixes).toHaveLength(segs.length)
          expect(prefixes.at(-1)).toBe(tag)
          for (let i = 1; i < prefixes.length; i++) {
            expect(prefixes[i].startsWith(`${prefixes[i - 1]}/`)).toBe(true)
          }
        }),
      )
    })
  })

  describe("endsWith", () => {
    it("matches any segment-aligned suffix", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (a, b) => {
          expect(endsWith(`${a}/${b}`, b)).toBe(true)
          expect(endsWith(b, b)).toBe(true)
        }),
      )
    })

    it("rejects non-segment-aligned suffixes", () => {
      fc.assert(
        fc.property(safeSegment, safeSegment, (a, b) => {
          // "ab" ends in the characters of b but not on a segment boundary
          expect(endsWith(a + b, b)).toBe(a + b === b)
        }),
      )
    })
  })

  describe("pathToRoot", () => {
    it("emits one '..' per parent directory", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { minLength: 1, maxLength: 6 }), (segs) => {
          const result = pathToRoot(segs.join("/") as FullSlug)
          const expected =
            segs.length === 1
              ? "."
              : Array(segs.length - 1)
                  .fill("..")
                  .join("/")
          expect(result).toBe(expected)
        }),
      )
    })
  })

  describe("slugifyFilePath", () => {
    it("always produces a valid FullSlug for safe file paths", () => {
      fc.assert(
        fc.property(safeFilePath, (fp) => {
          expect(isFullSlug(slugifyFilePath(fp))).toBe(true)
        }),
      )
    })

    it("strips URL-hostile characters from messy paths", () => {
      const messySegment = fc
        .stringMatching(/^[\w &%?#-]+$/)
        .filter((s) => s.length > 0 && s.length < 20 && !s.startsWith("/"))
      fc.assert(
        fc.property(
          fc.array(messySegment, { minLength: 1, maxLength: 4 }),
          fc.constantFrom(".md", ".png"),
          (segs, ext) => {
            const slug = slugifyFilePath((segs.join("/") + ext) as FilePath)
            expect(slug).not.toMatch(/[ ?#&]/)
          },
        ),
      )
    })

    it("drops .md and .html extensions but keeps others", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { minLength: 1, maxLength: 4 }), (segs) => {
          const base = segs.join("/")
          expect(slugifyFilePath(`${base}.md` as FilePath)).toBe(base)
          expect(slugifyFilePath(`${base}.html` as FilePath)).toBe(base)
          expect(slugifyFilePath(`${base}.png` as FilePath)).toBe(`${base}.png`)
        }),
      )
    })
  })

  describe("simplifySlug", () => {
    it("always produces a valid, non-empty SimpleSlug from safe slugs", () => {
      fc.assert(
        fc.property(safeSlug, (slug) => {
          const simple = simplifySlug(slug)
          expect(simple.length).toBeGreaterThan(0)
          expect(isSimpleSlug(simple)).toBe(true)
        }),
      )
    })

    it("maps any index slug to its folder path", () => {
      fc.assert(
        fc.property(fc.array(safeSegment, { maxLength: 4 }), (segs) => {
          const slug = [...segs, "index"].join("/") as FullSlug
          const expected = segs.length === 0 ? "/" : `${segs.join("/")}/`
          expect(simplifySlug(slug)).toBe(expected)
        }),
      )
    })
  })

  describe("splitAnchor", () => {
    it("returns the original link when there is no anchor", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("#")),
          (link) => {
            expect(splitAnchor(link)).toEqual([link, ""])
          },
        ),
      )
    })

    it("keeps the file path intact and prefixes the anchor with '#'", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("#")),
          safeSegment,
          (fp, anchor) => {
            const [path, slugAnchor] = splitAnchor(`${fp}#${anchor}`)
            expect(path).toBe(fp)
            expect(slugAnchor.startsWith("#")).toBe(true)
          },
        ),
      )
    })

    it("preserves PDF anchors verbatim", () => {
      fc.assert(
        fc.property(safeSegment, safeSegment, (name, anchor) => {
          expect(splitAnchor(`${name}.pdf#${anchor}`)).toEqual([`${name}.pdf`, `#${anchor}`])
        }),
      )
    })
  })

  describe("slugTag", () => {
    it("replaces whitespace and keeps segment count", () => {
      const spacedSegment = fc.string({
        unit: fc.constantFrom(..."abcXYZ012 -"),
        minLength: 1,
        maxLength: 19,
      })
      fc.assert(
        fc.property(fc.array(spacedSegment, { minLength: 1, maxLength: 4 }), (segs) => {
          const slugged = slugTag(segs.join("/"))
          expect(slugged.split("/")).toHaveLength(segs.length)
          expect(slugged).not.toMatch(/ /)
        }),
      )
    })
  })

  describe("transformInternalLink", () => {
    it("always produces a RelativeURL for safe links", () => {
      fc.assert(
        fc.property(safeSlug, fc.option(safeSegment, { nil: undefined }), (slug, anchor) => {
          const link = anchor === undefined ? slug : `${slug}#${anchor}`
          const result = transformInternalLink(link)
          expect(isRelativeURL(result)).toBe(true)
        }),
      )
    })

    it("never throws on arbitrary hash-free input (fuzz)", () => {
      fc.assert(
        fc.property(
          fc.string({ unit: "binary" }).filter((s) => {
            // decodeURI rejects lone "%" sequences; that precondition is the caller's job
            try {
              decodeURI(s)
              return true
            } catch {
              return false
            }
          }),
          (link) => {
            expect(() => transformInternalLink(link)).not.toThrow()
          },
        ),
      )
    })
  })

  describe("resolveRelative", () => {
    it("always starts with a relative marker", () => {
      fc.assert(
        fc.property(safeSlug, safeSlug, (current, target) => {
          expect(resolveRelative(current, target)).toMatch(/^\.{1,2}/)
        }),
      )
    })

    it("resolves to the target when applied from the site root", () => {
      fc.assert(
        fc.property(safeSegment, safeSlug, (page, target) => {
          // a root-level page has pathToRoot "." so the target passes through simplified
          const result = resolveRelative(page as FullSlug, target)
          expect(result).toBe(joinSegments(".", simplifySlug(target)))
        }),
      )
    })
  })
  describe("mutation killers (examples)", () => {
    // deterministic examples anchoring details the generators rarely hit
    it.each([
      ["a", true, true, false],
      ["a/b", true, true, false],
      ["a/b.png", true, false, false],
      // ".a" counts as relative: the guard only requires a leading dot
      [".a", false, false, true],
      ["/a", false, false, false],
      ["a/", false, true, false],
      ["a b", false, false, false],
      ["a#b", false, false, false],
      ["a?b", false, false, false],
      ["a&b", false, false, false],
      ["a/index", true, false, false],
      ["./a", false, false, true],
      ["../a/b", false, false, true],
      ["./a/index", false, false, false],
      ["./a.md", false, false, false],
      ["./a.html", false, false, false],
    ])("classifies %j (full=%j, simple=%j, relative=%j)", (s, full, simple, relative) => {
      expect(isFullSlug(s)).toBe(full)
      expect(isSimpleSlug(s)).toBe(simple)
      expect(isRelativeURL(s)).toBe(relative)
    })

    it("transformInternalLink resolves prefixes, folders, and anchors", () => {
      expect(transformInternalLink("a/b")).toBe("./a/b")
      expect(transformInternalLink("../a/b")).toBe("../a/b")
      expect(transformInternalLink("./a/index.md")).toBe("./a/")
      expect(transformInternalLink("a/b.md#Some Anchor")).toBe("./a/b#some-anchor")
      expect(transformInternalLink("")).toBe(".")
    })

    it("transformLink honors each strategy", () => {
      const allSlugs = ["x/unique", "y/z"] as FullSlug[]
      expect(transformLink("a/b" as FullSlug, "c/d", { strategy: "absolute", allSlugs })).toBe(
        "../c/d",
      )
      expect(transformLink("a/b" as FullSlug, "unique", { strategy: "shortest", allSlugs })).toBe(
        "../x/unique",
      )
      expect(transformLink("a/b" as FullSlug, "./c", { strategy: "relative", allSlugs })).toBe(
        "./c",
      )
      expect(
        transformLink("a/b" as FullSlug, "c/index.md", { strategy: "absolute", allSlugs }),
      ).toBe("../c/")
    })

    it("getFullSlug reads the body slug attribute", () => {
      document.body.dataset.slug = "foo/bar"
      expect(getFullSlug(window)).toBe("foo/bar")
    })

    it("normalizeRelativeURLs rebases relative hrefs and srcs", () => {
      document.body.innerHTML = '<a id="l" href="./x#frag">x</a><img id="i" src="../y">'
      normalizeRelativeURLs(document, new URL("https://example.com/base/page"))
      expect(document.getElementById("l")?.getAttribute("href")).toBe("/base/x#frag")
      expect(document.getElementById("i")?.getAttribute("src")).toBe("/y")
    })
  })
})
