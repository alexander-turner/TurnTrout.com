import { describe, it, expect } from "@jest/globals"

import { formatAuthors } from "../Authors"

describe("formatAuthors", () => {
  it("returns default author for empty array", () => {
    expect(formatAuthors([])).toBe("Alex Turner")
  })

  it("returns single author unchanged", () => {
    expect(formatAuthors(["John Doe"])).toBe("John Doe")
  })

  it("joins two authors with 'and'", () => {
    expect(formatAuthors(["John Doe", "Jane Smith"])).toBe("John Doe and Jane Smith")
  })

  it("joins three authors with Oxford comma", () => {
    expect(formatAuthors(["Alice", "Bob", "Charlie"])).toBe("Alice, Bob, and Charlie")
  })

  it("joins four authors with Oxford comma", () => {
    expect(formatAuthors(["A", "B", "C", "D"])).toBe("A, B, C, and D")
  })

  it("handles authors with special characters", () => {
    expect(formatAuthors(["José García", "François Müller"])).toBe(
      "José García and François Müller",
    )
  })

  it("handles many authors", () => {
    const authors = ["Alex Irpan", "Alex Turner", "Mark Kurzeja", "David Elson", "Rohin Shah"]
    expect(formatAuthors(authors)).toBe("Alex Irpan, Alex Turner, Mark Kurzeja, David Elson, and Rohin Shah")
  })
})
