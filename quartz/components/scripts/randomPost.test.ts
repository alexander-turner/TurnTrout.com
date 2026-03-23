/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, expect } from "@jest/globals"

import { type ContentDetails } from "../../plugins/emitters/contentIndex"

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

const mockSpaNavigate = jest.fn<(url: URL) => Promise<void>>().mockResolvedValue(undefined)

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
  jest.resetModules()
  document.body.innerHTML = '<button id="random-post-link">Random post</button>'
  document.body.dataset.slug = "index"
  mockIndex(mockContentIndex)
  window.spaNavigate = mockSpaNavigate
  mockSpaNavigate.mockClear()
})

describe("setupRandomPost", () => {
  it("navigates to a valid post slug on click", async () => {
    const { setupRandomPost } = await import("./randomPost")
    setupRandomPost()

    const slug = await clickRandomAndGetSlug()
    expect(VALID_POST_SLUGS).toContain(slug)
  })

  it.each([
    {
      name: "excludes current page when multiple posts exist",
      index: { "post-a": cd("a"), "post-b": cd("b") } as Record<string, ContentDetails>,
      currentSlug: "post-a",
      expectedSlug: "/post-b",
    },
    {
      name: "navigates to only post even if it is current page",
      index: { "only-post": cd("content") } as Record<string, ContentDetails>,
      currentSlug: "only-post",
      expectedSlug: "/only-post",
    },
  ])("$name", async ({ index, currentSlug, expectedSlug }) => {
    mockIndex(index)
    document.body.dataset.slug = currentSlug

    const { setupRandomPost } = await import("./randomPost")
    setupRandomPost()

    const link = document.getElementById("random-post-link")!
    link.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockSpaNavigate).toHaveBeenCalledTimes(1)
    expect((mockSpaNavigate.mock.calls[0][0] as URL).pathname).toBe(expectedSlug)
  })

  it("does not navigate when no posts exist", async () => {
    mockIndex({ index: cd("") })

    const { setupRandomPost } = await import("./randomPost")
    setupRandomPost()

    const slug = await clickRandomAndGetSlug()
    expect(slug).toBeNull()
  })

  it("does nothing when link element is missing", async () => {
    document.body.innerHTML = ""
    const { setupRandomPost } = await import("./randomPost")
    setupRandomPost()
    expect(document.getElementById("random-post-link")).toBeNull()
  })

  it.each(["tags/ai", "tags/math", "index", "posts", "about", "404", "design", "open-source"])(
    "never navigates to excluded slug %s",
    async (excludedSlug) => {
      const { setupRandomPost } = await import("./randomPost")

      for (let i = 0; i < 10; i++) {
        mockSpaNavigate.mockClear()
        setupRandomPost()
        const slug = await clickRandomAndGetSlug()
        expect(slug).not.toBe(excludedSlug)
      }
    },
  )
})
