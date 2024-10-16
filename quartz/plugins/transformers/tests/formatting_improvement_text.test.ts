import {
  massTransformText,
  formattingImprovement,
  editAdmonition,
  noteAdmonition,
  wrapLeadingHeaderNumbers,
  spaceDoublyNestedCallouts, // Add this line
} from "../formatting_improvement_text"

describe("TextFormattingImprovement Plugin", () => {
  describe("Non-breaking spaces", () => {
    it("should replace &nbsp; with regular spaces", () => {
      const input = "This&nbsp;is&nbsp;a&nbsp;test."
      const expected = "This is a test."
      const processed = formattingImprovement(input)
      expect(processed).toBe(expected)
    })
  })
  describe("Footnote Formatting", () => {
    it.each([
      [
        "This sentence has a footnote.[^1] Another sentence.",
        "This sentence has a footnote.[^1] Another sentence.",
      ],
      ['defined [^16] "values" to', 'defined[^16] "values" to'],
      [
        "This is a sentence[^1]. Another sentence[^2], and more text[^3]!",
        "This is a sentence.[^1] Another sentence,[^2] and more text![^3]",
      ],
      ["Is this correct[^2]?!", "Is this correct?![^2]"],
      ["Is this correct[^2]?!", "Is this correct?![^2]"],
    ])("Correctly formats footnotes.", (input: string, expected: string): void => {
      const result = formattingImprovement(input)
      expect(result).toBe(expected)
    })
  })

  describe("wrapLeadingHeaderNumbers", () => {
    it("should wrap single-digit numbers in headers", () => {
      const input = "# 1 Introduction"
      const expected = '# <span style="font-variant-numeric: lining-nums;">1</span> Introduction'
      expect(wrapLeadingHeaderNumbers(input)).toBe(expected)
    })

    it("should wrap multi-digit numbers in headers", () => {
      const input = "# 10 Chapter Ten"
      const expected = '# <span style="font-variant-numeric: lining-nums;">10</span> Chapter Ten'
      expect(wrapLeadingHeaderNumbers(input)).toBe(expected)
    })

    it("should not wrap numbers that are not at the start of headers", () => {
      const input = "# Introduction to Chapter 1"
      expect(wrapLeadingHeaderNumbers(input)).toBe(input)
    })

    it("should handle multiple headers in the same text", () => {
      const input = "# 1 First Chapter\nSome content\n# 2 Second Chapter"
      const expected =
        '# <span style="font-variant-numeric: lining-nums;">1</span> First Chapter\nSome content\n# <span style="font-variant-numeric: lining-nums;">2</span> Second Chapter'
      expect(wrapLeadingHeaderNumbers(input)).toBe(expected)
    })

    it("should not affect text without headers", () => {
      const input = "This is just some regular text without headers."
      expect(wrapLeadingHeaderNumbers(input)).toBe(input)
    })
  })

  describe("Comma spacing", () => {
    it.each([
      ["  ,", ","],
      ["Hi, he said", "Hi, he said"],
    ])("Removes spaces before commas.", (input: string, expected: string): void => {
      const result = formattingImprovement(input)
      expect(result).toBe(expected)
    })
  })

  describe("YAML Header Handling", () => {
    it("ignores YAML header and processes content correctly", () => {
      const input = `
---
title: My Document
author: John Doe
---

This is the main content of the document. It has a footnote.[^1]
And some hyphens-to-be-ignored.`

      const expectedOutput = `
---
title: My Document
author: John Doe
---

This is the main content of the document. It has a footnote.[^1]
And some hyphens-to-be-ignored.`

      const result = formattingImprovement(input)
      expect(result).toBe(expectedOutput)
    })
  })

  describe("Bulleted List Formatting", () => {
    it("should replace escaped hyphens with regular hyphens at the start of lines", () => {
      const input = "Some text\n\\- First item\n\\- Second item\nNormal line\n\\- Third item"
      const expected = "Some text\n- First item\n- Second item\nNormal line\n- Third item"
      const result = formattingImprovement(input)
      expect(result).toBe(expected)
    })
  })
})

describe("editAdmonition", () => {
  it('should replace a basic "edit" command with the admonition', () => {
    const input = "edit 08-10-2023: This is some edited text."
    const expected = "> [!info] Edited on 08-10-2023\n>\n> This is some edited text."
    expect(editAdmonition(input)).toBe(expected)
  })

  it('should replace a date-less "edit" command with the admonition', () => {
    const input = "edit: This is some edited text."
    const expected = "> [!info] Edited after posting\n>\n> This is some edited text."
    expect(editAdmonition(input)).toBe(expected)
  })

  it("should handle complicated edit command", () => {
    const content =
      "The initial version of this post talked about \"outer alignment\"; I changed this to just talk about _alignment_, because the outer/inner alignment distinction doesn't feel relevant here. What matters is how the AI's policy impacts us; what matters is [_impact alignment_](/non-obstruction-motivates-corrigibility)."
    const input = "Edit: " + content
    const expected = "> [!info] Edited after posting\n>\n> " + content
    expect(editAdmonition(input)).toBe(expected)
  })

  it('should replace a basic "note" command with the admonition', () => {
    const input = "_Note, 08-10-2023_: This is some edited text."
    const expected = "> [!info] Edited on 08-10-2023\n>\n> This is some edited text."
    expect(editAdmonition(input)).toBe(expected)
  })

  it('should replace a basic "eta" command with the admonition', () => {
    const input = "eta 8/10/2023: Updated information here."
    const expected = "> [!info] Edited on 8/10/2023\n>\n> Updated information here."
    expect(editAdmonition(input)).toBe(expected)
  })

  it("should be case-insensitive", () => {
    const input = "Edit 06-15-2023: Some case-insensitive text."
    const expected = "> [!info] Edited on 06-15-2023\n>\n> Some case-insensitive text."
    expect(editAdmonition(input)).toBe(expected)
  })

  it("should not modify text without the edit/eta command", () => {
    const input = "This is some regular text without an edit command."
    expect(editAdmonition(input)).toBe(input)
  })
})

describe("noteAdmonition", () => {
  it('should handle multiple "note:" occurrences', () => {
    const input = "note: First note.\nSome other text.\nnote: Second note."
    const expected =
      "\n> [!note]\n>\n> First note.\nSome other text.\n\n> [!note]\n>\n> Second note."
    expect(noteAdmonition(input)).toBe(expected)
  })

  it("should be case-insensitive", () => {
    const input = "NOTE: This is a case-insensitive note."
    const expected = "\n> [!note]\n>\n> This is a case-insensitive note."
    expect(noteAdmonition(input)).toBe(expected)
  })

  it("Deletes emphasis", () => {
    const input = "**NOTE: This contains emphasis.**"
    const expected = "\n> [!note]\n>\n> This contains emphasis."
    expect(noteAdmonition(input)).toBe(expected)
  })

  it('should not modify text without the "note:" prefix', () => {
    const input = "This is some regular text without a note."
    expect(noteAdmonition(input)).toBe(input)
  })

  it('should handle "note:" at the beginning of a line', () => {
    const input = "Some text.\nnote: A note at the start of a line."
    const expected = "Some text.\n\n> [!note]\n>\n> A note at the start of a line."
    expect(noteAdmonition(input)).toBe(expected)
  })
  it('should handle italicized "note:" at the beginning of a line', () => {
    const input = "Some text.\n_note:_ A note at the start of a line."
    const expected = "Some text.\n\n> [!note]\n>\n> A note at the start of a line."
    expect(noteAdmonition(input)).toBe(expected)
  })
})

describe("Mass transforms", () => {
  it.each([
    ["Let x := 5", "Let x ≝ 5"],
    ["a:=b:=c", "a≝b≝c"],
    ["L1", 'L<sub style="font-variant-numeric: lining-nums;">1</sub>'],
    ["L10", 'L<sub style="font-variant-numeric: lining-nums;">10</sub>'],
    ["ILO10", "ILO10"],
    [" :) The best", " 🙂 The best"],
    [" :( The worst", " 🙁 The worst"],
  ])("should perform transforms for %s", (input: string, expected: string) => {
    const result = massTransformText(input)
    expect(result).toBe(expected)
  })
})

describe("spaceDoublyNestedCallouts", () => {
  it("should add a space after doubly nested callouts", () => {
    const input = "> > [!note] Nested note\n> > This is nested content."
    const expected = "> > [!note] Nested note\n> >\n> > This is nested content."
    expect(spaceDoublyNestedCallouts(input)).toBe(expected)
  })

  it("should not modify singly nested callouts", () => {
    const input = "> [!note] Single note\n> This is single nested content."
    expect(spaceDoublyNestedCallouts(input)).toBe(input)
  })

  it("should handle multiple doubly nested callouts", () => {
    const input = "> > [!note] First note\n> > Content 1\n> > [!warning] Second note\n> > Content 2"
    const expected =
      "> > [!note] First note\n> >\n> > Content 1\n> > [!warning] Second note\n> >\n> > Content 2"
    expect(spaceDoublyNestedCallouts(input)).toBe(expected)
  })

  it("should handle mixed singly and doubly nested callouts", () => {
    const input = "> [!note] Outer\n> Content\n> > [!warning] Inner\n> > Warning content"
    const expected = "> [!note] Outer\n> Content\n> > [!warning] Inner\n> >\n> > Warning content"
    expect(spaceDoublyNestedCallouts(input)).toBe(expected)
  })
})
