import { describe, expect, it } from "@jest/globals"

import {
  invertedUrl,
  INVERTIBLE_IMAGE_EXTENSIONS,
  isInvertedUrl,
  isInvertibleImage,
} from "./invertedAssets"

describe("isInvertibleImage", () => {
  it.each([
    ["foo.avif", true],
    ["foo.AVIF", true],
    ["foo.png", true],
    ["foo.JPG", true],
    ["foo.jpeg", true],
    ["foo.webp", true],
    ["foo.svg", true],
    ["foo.mp4", false],
    ["foo.webm", false],
    ["no-extension", false],
    ["foo.avif?v=2", true],
    ["foo.png#anchor", true],
  ])("returns %s → %s", (url, expected) => {
    expect(isInvertibleImage(url)).toBe(expected)
  })

  it("covers every extension in INVERTIBLE_IMAGE_EXTENSIONS", () => {
    for (const ext of INVERTIBLE_IMAGE_EXTENSIONS) {
      expect(isInvertibleImage(`x${ext}`)).toBe(true)
    }
  })
})

describe("invertedUrl", () => {
  it.each([
    ["foo.avif", "foo-inverted.avif"],
    ["dir/foo.png", "dir/foo-inverted.png"],
    [
      "https://cdn.example/Attachments/Pasted image.avif",
      "https://cdn.example/Attachments/Pasted image-inverted.avif",
    ],
    ["foo.avif?v=2", "foo-inverted.avif?v=2"],
    ["foo.avif#anchor", "foo-inverted.avif#anchor"],
    ["foo.tar.gz", "foo.tar-inverted.gz"],
  ])("rewrites %s → %s", (input, expected) => {
    expect(invertedUrl(input)).toBe(expected)
  })

  it("returns the input unchanged when there is no extension", () => {
    expect(invertedUrl("no-extension")).toBe("no-extension")
  })
})

describe("isInvertedUrl", () => {
  it.each([
    ["foo-inverted.avif", true],
    ["dir/foo-inverted.png", true],
    ["foo-inverted.avif?v=2", true],
    ["foo-inverted.avif#anchor", true],
    ["foo.avif", false],
    ["dir/foo.avif", false],
    ["no-extension", false],
    ["inverted-foo.avif", false],
  ])("%s → %s", (url, expected) => {
    expect(isInvertedUrl(url)).toBe(expected)
  })
})
