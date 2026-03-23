/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, expect } from "@jest/globals"

import { type ContentDetails } from "../../plugins/emitters/contentIndex"
import { setupRandomPost } from "./randomPost"

const cd = (content: string): ContentDetails => ({
  title: content,
  links: [],
  tags: [],
  content,
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

beforeEach(() => {
  document.body.innerHTML = '<button id="random-post-link">Random post</button>'
  document.body.dataset.slug = "index"
  mockIndex(mockContentIndex)
  window.spaNavigate = mockSpaNavigate
  mockSpaNavigate.mockClear()
})

describe("setupRandomPost", () => {
  it("navigates to a valid post slug on click", async () => {
    setupRandomPost()

    const slug = await clickRandomAndGetSlug()
    expect(VALID_POST_SLUGS).toContain(slug)
  })

  it("excludes current page when multiple posts exist", async () => {
    mockIndex({ "post-a": cd("a"), "post-b": cd("b") })
    document.body.dataset.slug = "post-a"

    setupRandomPost()

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
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    mockIndex(index)

    setupRandomPost()

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
    setupRandomPost()
    expect(document.getElementById("random-post-link")).toBeNull()
  })

  it.each(["tags/ai", "tags/math", "index", "posts", "about", "404", "design", "open-source"])(
    "never navigates to excluded slug %s",
    async (excludedSlug) => {
      // Index contains only the excluded slug + two valid posts.
      // If filtering is broken, the excluded slug would be a candidate.
      mockIndex({
        [excludedSlug]: cd("excluded"),
        "valid-post-a": cd("a"),
        "valid-post-b": cd("b"),
      })
      setupRandomPost()
      const slug = await clickRandomAndGetSlug()
      expect(slug).toMatch(/^valid-post-/)
    },
  )
})
