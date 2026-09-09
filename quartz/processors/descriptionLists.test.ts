import type { Root } from "mdast"

import { describe, expect, it } from "@jest/globals"
import { remarkDefinitionList } from "remark-definition-list"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { VFile } from "vfile"

import { validateDescriptionLists } from "./descriptionLists"

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDefinitionList)
const validate = validateDescriptionLists()

function validationError(markdown: string): string | null {
  const tree = parser.runSync(parser.parse(markdown)) as Root
  try {
    validate(tree, new VFile({ value: markdown }))
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe("validateDescriptionLists", () => {
  it.each([
    ["a tight term", "Term\n: Definition"],
    ["a loose term", "Term\n\n: Definition"],
    ["consecutive terms with their own definitions", "One\n: First\n\nTwo\n: Second"],
    ["several definitions under one term", "Term\n: First\n\n: Second"],
    ["an indented sub-list inside the definition", "Term\n: Definition\n\n  - a bullet"],
    ["prose wrapped onto the next line", "Term\n: Definition which wraps\nonto the next line."],
    ["a caption attached to the definition's image", "Term\n: ![alt](/x.png)\nFigure: A caption."],
    ["a footnote definition below the list", "Term\n: Definition\n[^a]: A footnote.\n\nB\n: C"],
    ["an emphasized multi-sentence term", "A\n: First\n\n**Long. Question?**\n\n: Second"],
    ["an emphasized term carrying a footnote", "A\n: F\n\n**Long. Q?**[^a]\n\n: S\n\n[^a]: N."],
    ["a term which is only an image", "A\n: First\n\n![alt](/x.png)\n\n: Second"],
    ["a label-like term between two definitions", "A\n: First\n\nSecond term\n\n: Second"],
    ["markdown with no description list at all", "# Heading\n\nSome prose: with a colon."],
  ])("accepts %s", (_name, markdown) => {
    expect(validationError(markdown)).toBeNull()
  })

  it.each([
    [
      "a lead-in glued above the term",
      "Two hypotheses:\nThe first one\n: Because of X.",
      "Line 2: this term shares a paragraph with the line above it, so both render as terms " +
        "and collide on one line. Separate them with a blank line.",
    ],
    [
      "a term glued below a definition",
      "Term\n: Definition.\nSecond term\n: Second definition.",
      "Line 3: this term touches the definition above it, so it is absorbed into that " +
        "definition and its own definitions reparent. Separate them with a blank line.",
    ],
    [
      "prose stranded between two definitions",
      "Term\n: First definition.\n\nHowever, weights hold. So does interpretability.\n\n: Second.",
      "Line 4: this prose sits between two definitions, so it renders as a term and steals " +
        "the definition below it. Prefix it with `: `.",
    ],
  ])("rejects %s", (_name, markdown, expected) => {
    expect(validationError(markdown)).toBe(`Malformed description list:\n${expected}`)
  })

  it("reports every malformed list in the file", () => {
    const markdown = "Lead-in:\nTerm\n: First.\n\nOther\n: Second.\nGlued\n: Third."
    expect(validationError(markdown)?.split("\n")).toHaveLength(3)
  })
})
