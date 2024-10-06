import { slugify, preprocessSlug, resetSlugger } from "../gfm"

describe("slugify function", () => {
  beforeEach(() => {
    // Reset the slugger before each test to ensure uniqueness tests are valid
    resetSlugger()
  })

  test("should convert simple header text to a slug", () => {
    expect(slugify("Simple Header")).toBe("simple-header")
  })

  test("should handle special characters by replacing them with hyphens", () => {
    expect(slugify("Header/With/Slashes")).toBe("header-with-slashes")
    expect(slugify("Header & Special & Characters")).toBe("header-special-characters")
    expect(slugify("Header—With—Em Dashes")).toBe("header-with-em-dashes")
    expect(slugify("Header “With” Quotes")).toBe("header-with-quotes")
  })

  test("should remove consecutive hyphens generated from multiple special characters", () => {
    expect(slugify("Header -- With -- Multiple -- Hyphens")).toBe("header-with-multiple-hyphens")
    expect(slugify("Header ///// With ///// Multiple Slashes")).toBe("header-with-multiple-slashes")
  })

  test("should convert uppercase letters to lowercase", () => {
    expect(slugify("THIS IS UPPERCASE")).toBe("this-is-uppercase")
    expect(slugify("MiXeD CaSe HeAdEr")).toBe("mixed-case-header")
  })

  test("should generate unique slugs for duplicate headers", () => {
    expect(slugify("Duplicate Header")).toBe("duplicate-header")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-1")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-2")
  })

  test("should handle headers with numbers and symbols", () => {
    expect(slugify("Header 123")).toBe("header-123")
    expect(slugify("Header #1")).toBe("header-1")
    expect(slugify("Price is $5")).toBe("price-is-5")
  })

  test("should maintain compatibility with LessWrong slug behavior", () => {
    expect(slugify("Example’s Header")).toBe("example-s-header")
    expect(slugify("Understanding AI/ML Techniques")).toBe("understanding-ai-ml-techniques")
    expect(slugify("Rock & Roll — The Beginning")).toBe("rock-roll-the-beginning")
  })
})
