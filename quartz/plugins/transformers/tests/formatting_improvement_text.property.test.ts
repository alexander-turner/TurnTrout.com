import { describe, expect, it } from "@jest/globals"
import fc from "fast-check"

import { NBSP } from "../../../components/constants"
import {
  editAdmonition,
  formattingImprovement,
  noteAdmonition,
  spaceAdmonitions,
  TextFormattingImprovement,
  wrapLeadingNumbers,
  wrapNumbersBeforeColon,
} from "../formatting_improvement_text"

// Deterministic runs: a fixed seed keeps CI reproducible (zero-flakiness policy).
fc.configureGlobal({ seed: 20260612, numRuns: 300 })

/** Prose-like text: letters, digits, spaces, newlines, and basic punctuation. */
const proseText = fc.string({
  unit: fc.constantFrom(..."abcdeXYZ 019.\n!?'-"),
  maxLength: 60,
})

describe("formatting_improvement_text (property)", () => {
  describe("formattingImprovement", () => {
    it("never throws on arbitrary unicode input (fuzz)", () => {
      fc.assert(
        fc.property(fc.string({ unit: "binary", maxLength: 400 }), (text) => {
          expect(() => formattingImprovement(text)).not.toThrow()
        }),
      )
    })

    it("removes all non-breaking spaces from the body", () => {
      fc.assert(
        fc.property(
          proseText.filter((s) => !s.trimStart().startsWith("---")),
          (body) => {
            // sprinkle NBSPs between words
            const withNbsp = body.replace(/ /g, NBSP)
            expect(formattingImprovement(withNbsp)).not.toContain(NBSP)
            expect(formattingImprovement(`a&nbsp;${body}`)).not.toContain("&nbsp;")
          },
        ),
      )
    })

    it("preserves the YAML frontmatter verbatim", () => {
      const yamlValue = fc.string({
        unit: fc.constantFrom(..."abcXYZ012 "),
        minLength: 1,
        maxLength: 30,
      })
      fc.assert(
        fc.property(
          yamlValue,
          proseText.filter((s) => !s.trimStart().startsWith("---")),
          (value, body) => {
            const header = `---\ntitle: ${value}\n---\n`
            expect(formattingImprovement(header + body).startsWith(header)).toBe(true)
          },
        ),
      )
    })

    it("removes spaces before commas", () => {
      const commaText = fc.stringMatching(/^[a-z, ]*$/)
      fc.assert(
        fc.property(commaText, (body) => {
          expect(formattingImprovement(body)).not.toMatch(/ ,/)
        }),
      )
    })
  })

  describe("admonition transforms", () => {
    it("leave text without trigger keywords unchanged", () => {
      const noTriggers = fc.stringMatching(/^[a-z .\n-]*$/).filter((s) => !/edit|eta|note/.test(s))
      fc.assert(
        fc.property(noTriggers, (text) => {
          expect(editAdmonition(text)).toBe(text)
          expect(noteAdmonition(text)).toBe(text)
        }),
      )
    })

    it("spaceAdmonitions only ever inserts blockquote continuation lines", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("> [!note] Title", "> body", "plain", "", "> [!quote]"), {
            maxLength: 8,
          }),
          (lines) => {
            const input = lines.join("\n")
            const output = spaceAdmonitions(input)
            // every input line survives, in order; only "> " continuation lines are added
            const outLines = output.split("\n")
            const inLines = input.split("\n")
            const inserted: string[] = []
            let i = 0
            for (const line of outLines) {
              if (i < inLines.length && line === inLines[i]) {
                i++
              } else {
                inserted.push(line)
              }
            }
            expect(i).toBe(inLines.length)
            expect(inserted.every((line) => /^(?:> )+$/.test(line))).toBe(true)
          },
        ),
      )
    })

    it("spaceAdmonitions is the identity when there are no callouts", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("[!")),
          (text) => {
            expect(spaceAdmonitions(text)).toBe(text)
          },
        ),
      )
    })
  })

  describe("number wrapping", () => {
    it("wrapLeadingNumbers is the identity without '# ' headings", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("# ")),
          (text) => {
            expect(wrapLeadingNumbers(text)).toBe(text)
          },
        ),
      )
    })

    it("wraps every digit sequence directly after a heading marker", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99999 }),
          fc.constantFrom("#", "##", "###"),
          (num, h) => {
            const result = wrapLeadingNumbers(`${h} ${num} title`)
            expect(result).toBe(
              `${h} <span style="font-variant-numeric: lining-nums;">${num}</span> title`,
            )
          },
        ),
      )
    })

    it("wrapNumbersBeforeColon is the identity without colons or hashes", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes(":") && !s.includes("#")),
          (text) => {
            expect(wrapNumbersBeforeColon(text)).toBe(text)
          },
        ),
      )
    })
  })
  describe("mutation killers", () => {
    // deterministic examples for behavior the generators rarely hit;
    // each anchors a detail that mutation testing showed was unverified
    it("only treats leading --- blocks as frontmatter", () => {
      const input = "intro\n---\na b\n---\nrest"
      expect(formattingImprovement(input)).toBe(input)
    })

    it("protects frontmatter content from body transforms", () => {
      const header = `---\ntitle: a${NBSP}b\n---\n`
      expect(formattingImprovement(`${header}body`)).toBe(`${header}body`)
      const indented = ` \n${header}`
      expect(formattingImprovement(`${indented}body`)).toBe(`${indented}body`)
    })

    it("concentrates emphasis around every link, not just the first", () => {
      const link = (label: string) => `*[${label}](https://example.com) *`
      const result = formattingImprovement(`${link("a")} and ${link("b")}`)
      expect(result).toBe("*[a](https://example.com)*  and *[b](https://example.com)* ")
    })

    it("only wraps heading numbers when the prefix is word-like", () => {
      const input = "#a.b 3:"
      expect(wrapNumbersBeforeColon(input)).toBe(input)
    })

    it("registers under its pipeline name", () => {
      expect(TextFormattingImprovement().name).toBe("textFormattingImprovement")
    })
  })
})
