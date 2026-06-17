import type { ElementContent, Root, Text } from "hast"

import { describe, expect, it } from "@jest/globals"
import fc from "fast-check"

import { NBSP } from "../../../components/constants"
import {
  applyTextTransforms,
  improveFormatting,
  massTransformText,
  normalizeAbbreviations,
  plusToAmpersand,
  spacesAroundSlashes,
  timeTransform,
} from "../formatting_improvement_html"

// Deterministic runs: a fixed seed keeps CI reproducible (zero-flakiness policy).
fc.configureGlobal({ seed: 20260612, numRuns: 300 })

describe("formatting_improvement_html text transforms (property)", () => {
  describe("fuzz: no transform throws on arbitrary unicode", () => {
    it.each([
      ["spacesAroundSlashes", spacesAroundSlashes],
      ["normalizeAbbreviations", normalizeAbbreviations],
      ["plusToAmpersand", plusToAmpersand],
      ["timeTransform", timeTransform],
      ["massTransformText", massTransformText],
      ["applyTextTransforms", (text: string) => applyTextTransforms(text)],
    ])("%s", (_name, transform) => {
      fc.assert(
        fc.property(fc.string({ unit: "binary", maxLength: 300 }), (text) => {
          expect(() => transform(text)).not.toThrow()
        }),
      )
    })
  })

  describe("spacesAroundSlashes", () => {
    it("is the identity for slash-free text", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("/")),
          (text) => {
            expect(spacesAroundSlashes(text)).toBe(text)
          },
        ),
      )
    })

    it("preserves h/t attributions", () => {
      const word = fc.stringMatching(/^[a-z]+$/).filter((s) => s.length > 0)
      fc.assert(
        fc.property(word, word, (a, b) => {
          const text = `${a} h/t ${b}`
          expect(spacesAroundSlashes(text)).toBe(text)
        }),
      )
    })

    it("pads word/word slashes with non-breaking spaces", () => {
      const word = fc.stringMatching(/^[a-z]+$/).filter((s) => s.length > 0)
      fc.assert(
        fc.property(
          word.filter((w) => w !== "h"),
          word.filter((w) => w !== "t"),
          (a, b) => {
            expect(spacesAroundSlashes(`${a}/${b}`)).toBe(`${a}${NBSP}/${NBSP}${b}`)
          },
        ),
      )
    })

    it("leaves fractions alone", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 999 }), (n, d) => {
          const fraction = `${n}/${d}`
          expect(spacesAroundSlashes(fraction)).toBe(fraction)
        }),
      )
    })
  })

  describe("normalizeAbbreviations", () => {
    it("normalizes all spellings of e.g. and i.e.", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("eg", "e.g", "e.g.", "EG", "E.g."),
          fc.constantFrom("ie", "i.e", "i.e.", "IE", "I.e."),
          (egForm, ieForm) => {
            expect(normalizeAbbreviations(`${egForm} apples`)).toBe("e.g. apples")
            expect(normalizeAbbreviations(`${ieForm} apples`)).toBe("i.e. apples")
          },
        ),
      )
    })

    it("is idempotent on marker-free prose", () => {
      const prose = fc.string({ unit: fc.constantFrom(..."abegiEGI .,"), maxLength: 40 })
      fc.assert(
        fc.property(prose, (text) => {
          const once = normalizeAbbreviations(text)
          expect(normalizeAbbreviations(once)).toBe(once)
        }),
      )
    })

    it("leaves abbreviations with stray extra periods alone", () => {
      // found by the idempotence property: "IE.a" used to gain a period per pass
      expect(normalizeAbbreviations("i.e..")).toBe("i.e..")
      expect(normalizeAbbreviations("e.g...")).toBe("e.g...")
      expect(normalizeAbbreviations("IE.a")).toBe("IE.a")
    })

    it("does not touch words merely containing 'eg' or 'ie'", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("egregious", "leg", "piece", "lie", "legend", "belief"),
          (word) => {
            expect(normalizeAbbreviations(word)).toBe(word)
          },
        ),
      )
    })
  })

  describe("plusToAmpersand", () => {
    it("is the identity for plus-free text", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes("+")),
          (text) => {
            expect(plusToAmpersand(text)).toBe(text)
          },
        ),
      )
    })

    it("rewrites letter+Capital pairs and skips keyboard chords", () => {
      const word = fc.stringMatching(/^[a-z]+[A-Z][a-z]*$/).filter((s) => s.length > 1)
      fc.assert(
        fc.property(word, (w) => {
          const idx = w.search(/[A-Z]/)
          const [left, right] = [w.slice(0, idx), w.slice(idx)]
          expect(plusToAmpersand(`${left}+${right}`)).toBe(`${left}${NBSP}&${NBSP}${right}`)
          expect(plusToAmpersand(`ctrl+${right}`)).toBe(`ctrl+${right}`)
        }),
      )
    })
  })

  describe("timeTransform", () => {
    it("lowercases AM/PM after any digit time", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 12 }),
          fc.constantFrom("AM", "PM", "A.M.", "P.M.", "am", "pm"),
          fc.constantFrom("", " "),
          (hour, meridiem, space) => {
            const expected = `${hour}${space}${meridiem[0].toLowerCase()}.m.`
            expect(timeTransform(`${hour}${space}${meridiem}`)).toBe(expected)
          },
        ),
      )
    })

    it("is idempotent", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), (text) => {
          const once = timeTransform(text)
          expect(timeTransform(once)).toBe(once)
        }),
      )
    })

    it("leaves digit-free text unchanged", () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/\d/.test(s)),
          (text) => {
            expect(timeTransform(text)).toBe(text)
          },
        ),
      )
    })
  })

  describe("improveFormatting pipeline on arbitrary HAST trees (fuzz)", () => {
    const proseChars = "abcdefghijk ABC 0123456789 .,;:!?'\"-/$()[]{}<>+=*&%#@~`^|\\\n→←é“”"
    const fuzzText: fc.Arbitrary<Text> = fc.record({
      type: fc.constant("text" as const),
      value: fc.string({ unit: fc.constantFrom(...proseChars), maxLength: 30 }),
    })

    const { element } = fc.letrec<{ element: ElementContent; node: ElementContent }>((tie) => ({
      node: fc.oneof({ maxDepth: 3, withCrossShrink: true }, fuzzText, tie("element")),
      element: fc.record({
        type: fc.constant("element" as const),
        tagName: fc.constantFrom(
          "p",
          "em",
          "strong",
          "a",
          "span",
          "div",
          "code",
          "pre",
          "h1",
          "h2",
          "blockquote",
          "sup",
          "li",
        ),
        properties: fc.oneof(
          fc.constant({}),
          fc.record({ href: fc.constantFrom("./a/b", "https://example.com/x", "#anchor") }),
          fc.record({ className: fc.constantFrom(["fraction"], ["no-formatting"], ["elvish"]) }),
        ),
        children: fc.array(tie("node"), { maxLength: 4 }),
      }) as fc.Arbitrary<ElementContent>,
    }))

    const fuzzRoot: fc.Arbitrary<Root> = fc
      .array(element, { minLength: 1, maxLength: 4 })
      .map((children) => ({ type: "root", children }))

    it("never throws on arbitrary trees", () => {
      const transformer = improveFormatting() as (tree: Root) => void
      fc.assert(
        fc.property(fuzzRoot, (tree) => {
          expect(() => transformer(tree)).not.toThrow()
        }),
        { numRuns: 150 },
      )
    })
  })

  describe("massTransformText", () => {
    it("is the identity on digits and punctuation", () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[0-9 .,;:!?-]*$/), (text) => {
          expect(massTransformText(text)).toBe(text)
        }),
      )
    })

    it("is idempotent on marker-free prose", () => {
      const prose = fc.string({ unit: fc.constantFrom(..."abcdwXYZ .,-"), maxLength: 40 })
      fc.assert(
        fc.property(prose, (text) => {
          const once = massTransformText(text)
          expect(massTransformText(once)).toBe(once)
        }),
      )
    })
  })
})
