import { describe, it, expect } from "@jest/globals"

import { formatAuthors } from "../Authors"

describe("formatAuthors", () => {
  it.each([
    { authors: [], expected: "Alex Turner", name: "empty array returns default" },
    { authors: ["John Doe"], expected: "John Doe", name: "single author unchanged" },
    { authors: ["John Doe", "Jane Smith"], expected: "John Doe and Jane Smith", name: "two authors with 'and'" },
    { authors: ["Alice", "Bob", "Charlie"], expected: "Alice, Bob, and Charlie", name: "three authors with Oxford comma" },
    { authors: ["A", "B", "C", "D"], expected: "A, B, C, and D", name: "four authors with Oxford comma" },
    { authors: ["José García", "François Müller"], expected: "José García and François Müller", name: "special characters" },
    {
      authors: ["Alex Irpan", "Alex Turner", "Mark Kurzeja", "David Elson", "Rohin Shah"],
      expected: "Alex Irpan, Alex Turner, Mark Kurzeja, David Elson, and Rohin Shah",
      name: "many authors",
    },
  ])("$name", ({ authors, expected }) => {
    expect(formatAuthors(authors)).toBe(expected)
  })
})
