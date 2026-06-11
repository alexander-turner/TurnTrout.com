/**
 * @jest-environment jest-fixed-jsdom
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

import { type ContentDetails } from "../../plugins/vfile"
import { EXCLUDED_SLUG_PREFIXES, EXCLUDED_SLUGS, isPost, setupRandomPostLink } from "./randomPost"

const cd = (content: string): ContentDetails => ({
  title: content,
  links: [],
  tags: [],
  content,
  authors: [],
})

const mockContentIndex: Record<string, ContentDetails> = {
  "my-first-post": cd("First Post"),
  "another-post": cd("Another Post"),
  "deep/nested-post": cd("Nested Post"),
  index: cd(""),
  posts: cd(""),
  about: cd(""),
  research: cd(""),
  "open-source": cd(""),
  design: cd(""),
  "tags/ai": cd(""),
  "tags/math": cd(""),
  "404": cd(""),
}

const VALID_POST_SLUGS = ["my-first-post", "another-post", "deep/nested-post"]

const mockSpaNavigate = jest.fn<(url: URL) => Promise<void>>().mockResolvedValue()

const mockIndex = (index: Record<string, ContentDetails>) => {
  global.getContentIndex = jest
    .fn<() => Promise<Record<string, ContentDetails>>>()
    .mockResolvedValue(index)
}

async function clickRandomAndGetSlug(): Promise<string | null> {
  const link = document.getElementById("random-post-link")
  link?.click()
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (mockSpaNavigate.mock.calls.length === 0) return null
  return (mockSpaNavigate.mock.calls[0][0] as URL).pathname.replace(/^\//, "")
}

describe("isPost", () => {
  it.each([...EXCLUDED_SLUGS])("returns false for excluded slug %s", (slug) => {
    expect(isPost(slug)).toBe(false)
  })

  it.each(EXCLUDED_SLUG_PREFIXES.map((p) => `${p}example`))(
    "returns false for slug with excluded prefix %s",
    (slug) => {
      expect(isPost(slug)).toBe(false)
    },
  )

  it.each(["my-post", "deep/nested", "some-other-slug"])(
    "returns true for post slug %s",
    (slug) => {
      expect(isPost(slug)).toBe(true)
    },
  )
})

describe("setupRandomPostLink", () => {
  beforeAll(() => {
    setupRandomPostLink()
  })

  beforeEach(() => {
    document.body.innerHTML = '<a href="#" id="random-post-link">Random post</a>'
    document.body.dataset.slug = "index"
    mockIndex(mockContentIndex)
    window.spaNavigate = mockSpaNavigate
    mockSpaNavigate.mockClear()
  })

  it("navigates to a valid post slug on click", async () => {
    const slug = await clickRandomAndGetSlug()
    expect(VALID_POST_SLUGS).toContain(slug)
  })

  it("excludes current page when multiple posts exist", async () => {
    mockIndex({ "post-a": cd("a"), "post-b": cd("b") })
    document.body.dataset.slug = "post-a"

    const link = document.getElementById("random-post-link")
    expect(link).not.toBeNull()
    link?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockSpaNavigate).toHaveBeenCalledTimes(1)
    expect((mockSpaNavigate.mock.calls[0][0] as URL).pathname).toBe("/post-b")
  })

  it.each([
    { name: "no posts", index: { index: cd("") } as Record<string, ContentDetails> },
    { name: "only one post", index: { "only-post": cd("x") } as Record<string, ContentDetails> },
  ])("logs error and does not navigate when $name exist", async ({ index }) => {
    const errorSpy = jest.spyOn(console, "error").mockReturnValue()
    mockIndex(index)

    const slug = await clickRandomAndGetSlug()
    expect(slug).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[randomPost]"),
      expect.any(Number),
    )
    errorSpy.mockRestore()
  })

  it("does nothing when link element is missing", async () => {
    document.body.innerHTML = ""
    const link = document.getElementById("random-post-link")
    expect(link).toBeNull()
    // Click on body — handler checks closest("#random-post-link") and exits early
    document.body.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockSpaNavigate).not.toHaveBeenCalled()
  })

  it.each(["tags/ai", "tags/math", "index", "posts", "about", "404", "design", "open-source"])(
    "never navigates to excluded slug %s",
    async (excludedSlug) => {
      // Index contains the excluded slug + two valid posts.
      // Math.random() = 0 forces index 0, which would be the excluded slug
      // if filtering were broken (since object keys preserve insertion order).
      mockIndex({
        [excludedSlug]: cd("excluded"),
        "valid-post-a": cd("a"),
        "valid-post-b": cd("b"),
      })
      const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0)
      const slug = await clickRandomAndGetSlug()
      expect(slug).toBe("valid-post-a")
      randomSpy.mockRestore()
    },
  )

  it("does not navigate when getContentIndex returns null", async () => {
    global.getContentIndex = jest
      .fn<() => Promise<Record<string, ContentDetails>>>()
      .mockResolvedValue(null as unknown as Record<string, ContentDetails>)

    const slug = await clickRandomAndGetSlug()
    expect(slug).toBeNull()
  })

  it("navigates when dataset.slug is undefined", async () => {
    delete document.body.dataset.slug

    const slug = await clickRandomAndGetSlug()
    expect(VALID_POST_SLUGS).toContain(slug)
  })

  it("falls back to location.assign when spaNavigate is unavailable", async () => {
    const assignMock = jest.fn<(url: string | URL) => void>()
    Object.defineProperty(window, "location", {
      value: { ...window.location, origin: "http://localhost", assign: assignMock },
      writable: true,
    })
    // @ts-expect-error -- testing the fallback when spaNavigate is absent
    delete window.spaNavigate

    mockIndex({ "post-a": cd("a"), "post-b": cd("b") })
    document.body.dataset.slug = "post-a"

    const link = document.getElementById("random-post-link")
    link?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(assignMock).toHaveBeenCalledTimes(1)
    expect((assignMock.mock.calls[0][0] as URL).pathname).toBe("/post-b")
  })
})
