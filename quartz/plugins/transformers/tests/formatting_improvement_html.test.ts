import { describe, it, expect } from "@jest/globals"
import { type Element, type ElementContent, type Parent, type Text } from "hast"
import { toHtml as hastToHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { symbolTransform } from "punctilio"
import {
  getTextContent,
  flattenTextNodes,
  transformElement,
  assertSmartQuotesMatch,
  collectTransformableElements,
  getFirstTextNode,
} from "punctilio/rehype"
import { rehype } from "rehype"
import { VFile } from "vfile"

import { charsToMoveIntoLinkFromRight, markerChar } from "../../../components/constants"
import {
  massTransformText,
  improveFormatting,
  spacesAroundSlashes,
  l_pRegex,
  identifyLinkNode,
  moveQuotesBeforeLink,
  replaceFractions,
  timeTransform,
  applyTextTransforms,
  HTMLFormattingImprovement,
  rearrangeLinkPunctuation,
  arrowsToWrap,
} from "../formatting_improvement_html"
import { toSkip, SKIP_TAGS, FRACTION_SKIP_TAGS, SKIP_CLASSES } from "../formatting_improvement_html"

// Unicode constants for readable test expectations
// (punctilio exports these in constants.js but not from the main entry point)
const LEFT_DOUBLE_QUOTE = "\u201C" // "
const RIGHT_DOUBLE_QUOTE = "\u201D" // "
const LEFT_SINGLE_QUOTE = "\u2018" // '
const RIGHT_SINGLE_QUOTE = "\u2019" // '
const MULTIPLICATION = "\u00D7" // ×
const NBSP = "\u00A0" // non-breaking space

/** Normalize non-breaking spaces to regular spaces for comparison in non-nbsp-specific tests */
function normalizeNbsp(html: string): string {
  return html.replace(/\u00A0/g, " ")
}

function testHtmlFormattingImprovement(
  inputHTML: string,
  skipFirstLetter = true,
  doNotSetFirstLetterAttribute = false,
) {
  const options = { skipFirstLetter }
  if (!inputHTML.trim().startsWith("<")) {
    throw new Error("Input HTML must start with an HTML tag")
  }
  const processor = rehype().data("settings", { fragment: true })

  if (doNotSetFirstLetterAttribute) {
    // Do not pass options at all (exercise improveFormatting() default parameter)
    processor.use(improveFormatting)
  } else {
    processor.use(improveFormatting, options)
  }

  return processor.processSync(inputHTML).toString()
}

describe("HTMLFormattingImprovement", () => {
  describe("Quotes", () => {
    // Handle HTML inputs
    it.each([
      [
        '<p>I love <span class="katex">math</span>".</p>',
        '<p>I love <span class="katex">math</span>.”</p>',
      ],
      [
        '<p><a>"How steering vectors impact GPT-2’s capabilities"</a>.</p>',
        "<p><a>“How steering vectors impact GPT-2’s capabilities.”</a></p>",
      ],
      [
        '<p>"<span class="katex"></span> alignment metric</p>',
        '<p>“<span class="katex"></span> alignment metric</p>',
      ],
      [
        '<dl><dd>Multipliers like "2x" are 2x more pleasant than "<span class="no-formatting">2x</span>". </dd></dl>',
        `<dl><dd>Multipliers like ${LEFT_DOUBLE_QUOTE}2${MULTIPLICATION}${RIGHT_DOUBLE_QUOTE} are 2${MULTIPLICATION} more pleasant than ${LEFT_DOUBLE_QUOTE}<span class="no-formatting">2x</span>.${RIGHT_DOUBLE_QUOTE} </dd></dl>`,
      ],
      [
        '<p>Suppose you tell me, "<code>TurnTrout</code>", we definitely</p>',
        `<p>Suppose you tell me, ${LEFT_DOUBLE_QUOTE}<code>TurnTrout</code>,${RIGHT_DOUBLE_QUOTE} we definitely</p>`,
      ],
      [
        '<p>I was born in \'94. Now, I’m a research scientist on <a href="https://deepmind.google/" class="external" target="_blank" rel="noopener noreferrer">Google DeepMi<span class="favicon-span">nd’s<img src="https://assets.turntrout.com/static/images/external-favicons/deepmind_google.avif" class="favicon" alt="" loading="lazy" width="64" height="64" style="aspect-ratio:64 / 64;"></span></a></p>',
        '<p>I was born in ’94. Now, I’m a research scientist on <a href="https://deepmind.google/" class="external" target="_blank" rel="noopener noreferrer">Google DeepMi<span class="favicon-span">nd’s<img src="https://assets.turntrout.com/static/images/external-favicons/deepmind_google.avif" class="favicon" alt="" loading="lazy" width="64" height="64" style="aspect-ratio:64 / 64;"></span></a></p>',
      ],
      [
        '<div><p>not confident in that plan - "</p><p>"Why not? You were the one who said we should use the AIs in the first place! Now you don’t like this idea?” she asked, anger rising in her voice.</p></div>',
        "<div><p>not confident in that plan—”</p><p>“Why not? You were the one who said we should use the AIs in the first place! Now you don’t like this idea?” she asked, anger rising in her voice.</p></div>",
      ],
      [
        "<div><div></div><div><p><strong>small voice.</strong></p><p><strong>'I will take the Ring', he</strong> <strong>said, 'though I do not know the way.'</strong></p></div></div>",
        `<div><div></div><div><p><strong>small voice.</strong></p><p><strong>${LEFT_SINGLE_QUOTE}I will take the Ring,${RIGHT_SINGLE_QUOTE} he</strong> <strong>said, ${LEFT_SINGLE_QUOTE}though I do not know the way.${RIGHT_SINGLE_QUOTE}</strong></p></div></div>`,
      ],
      [
        "<article><blockquote><div>Testestes</div><div><p><strong>small voice.</strong></p><p><strong>'I will take the Ring', he</strong> <strong>said, 'though I do not know the way.'</strong></p></div></blockquote></article>",
        `<article><blockquote><div>Testestes</div><div><p><strong>small voice.</strong></p><p><strong>${LEFT_SINGLE_QUOTE}I will take the Ring,${RIGHT_SINGLE_QUOTE} he</strong> <strong>said, ${LEFT_SINGLE_QUOTE}though I do not know the way.${RIGHT_SINGLE_QUOTE}</strong></p></div></blockquote></article>`,
      ],
      [
        '<blockquote class="admonition quote" data-admonition="quote"> <div class="admonition-title"><div class="admonition-icon"></div><div class="admonition-title-inner">Checking that HTML formatting is applied to each paragraph element </div></div> <div class="admonition-content"><p>Comes before the single quote</p><p>\'I will take the Ring\'</p></div> </blockquote>',
        '<blockquote class="admonition quote" data-admonition="quote"> <div class="admonition-title"><div class="admonition-icon"></div><div class="admonition-title-inner">Checking that HTML formatting is applied to each paragraph element </div></div> <div class="admonition-content"><p>Comes before the single quote</p><p>‘I will take the Ring’</p></div> </blockquote>',
      ],
      [
        '<blockquote class="admonition quote" data-admonition="quote"><div class="admonition-title"><div class="admonition-icon"></div><div class="admonition-title-inner">Checking that HTML formatting is applied per-paragraph element </div></div><div class="admonition-content"><p>Comes before the single quote</p><p>\'I will take the Ring\'</p></div></blockquote>',
        '<blockquote class="admonition quote" data-admonition="quote"><div class="admonition-title"><div class="admonition-icon"></div><div class="admonition-title-inner">Checking that HTML formatting is applied per-paragraph element </div></div><div class="admonition-content"><p>Comes before the single quote</p><p>‘I will take the Ring’</p></div></blockquote>',
      ],
    ])("should handle HTML inputs", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it.each([['<p><br>"Unicorn"<br></p>', "<p><br>“Unicorn”<br></p>"]])(
      "should handle quotes in DOM",
      (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      },
    )

    it.each([
      ["<code>'This quote should not change'</code>"],
      ["<pre>'This quote should not change'</pre>"],
      ["<p><code>5 - 3</code></p>"],
      ['<p><code>"This quote should not change"</code></p>'],
      ["<p><code>'This quote should not change'</code></p>"],
    ])("should not change quotes inside <code>", (input: string) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    const mathHTML = `<p><span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord text"><span class="mord">return</span></span><span class="mopen">(</span><span class="mord mathnormal">s</span><span class="mclose">)</span></span></span></span> averages strategy <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">s</span></span></span></span>'s return over the first state being cooperate <code>c</code> and being defect <code>d</code>. <a href="#user-content-fnref-5" data-footnote-backref="" aria-label="Back to reference 6" class="data-footnote-backref internal">↩</a></p>`

    const targetMathHTML =
      '<p><span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord text"><span class="mord">return</span></span><span class="mopen">(</span><span class="mord mathnormal">s</span><span class="mclose">)</span></span></span></span> averages strategy <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">s</span></span></span></span>’s return over the first state being cooperate <code>c</code> and being defect <code>d</code>. <a href="#user-content-fnref-5" data-footnote-backref="" aria-label="Back to reference 6" class="data-footnote-backref internal">↩</a></p>'

    it("should handle apostrophe right after math mode", () => {
      const processedHtml = testHtmlFormattingImprovement(mathHTML)
      expect(normalizeNbsp(processedHtml)).toBe(targetMathHTML)
    })

    const codeBlocks = [
      '<code><span>This is a plain "code block" without a language specified.</span></code>',
      '<figure><code><span>This is a plain "code block" without a language specified.</span></code></figure>',
    ]
    it.each(codeBlocks)("should ignore quotes in code blocks", (input) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    const originalHeader =
      '<h3 id="optimal-policy--reinforcement-maximizing-policy"><del>"Optimal policy"</del> → "Reinforcement-maximizing policy"</h3>'
    const targetHeader =
      '<h3 id="optimal-policy--reinforcement-maximizing-policy"><del>“Optimal policy”</del> <span class="monospace-arrow">→</span> “Reinforcement-maximizing policy”</h3>'
    it("should handle quotes in headers", () => {
      const processedHtml = testHtmlFormattingImprovement(originalHeader)
      expect(normalizeNbsp(processedHtml)).toBe(targetHeader)
    })
  })

  describe("Definition Lists", () => {
    it.each([
      [
        '<dl><dt>"Term 1".</dt><dd>Definition 1.</dd></dl>',
        "<dl><dt>“Term 1.”</dt><dd>Definition 1.</dd></dl>",
      ],
      [
        '<dl><dt>"Quoted term".</dt><dd>"Quoted definition".</dd></dl>',
        "<dl><dt>“Quoted term.”</dt><dd>“Quoted definition.”</dd></dl>",
      ],
    ])("should handle smart quotes and punctuation in definition lists: %s", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("Spacing around slashes", () => {
    const testCases = [
      // Should change
      ["dog/cat", "dog / cat"],
      ["dog/cat/dog", "dog / cat / dog"],
      ["‘cat’/‘dog’", "‘cat’ / ‘dog’"],
      ["Shrek Two/3", "Shrek Two / 3"],
      ["‘cat’/ ‘dog’", "‘cat’ / ‘dog’"],
      ["3/month", "3 / month"],

      // Should not change
      ["‘cat’ / ‘dog’", "‘cat’ / ‘dog’"],
      ["h/t John", "h/t John"],
    ]

    it.each(testCases)("should add spaces around '/' in %s", (input: string, expected: string) => {
      const processedHtml = spacesAroundSlashes(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it.each(testCases)(
      "should add spaces around '/' in an HTML context: %s",
      (input: string, expected: string) => {
        const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
        expect(normalizeNbsp(processedHtml)).toBe(`<p>${expected}</p>`)
      },
    )

    it.each([
      ["<p><em>dog/cat</em></p>", "<p><em>dog / cat</em></p>"],
      ["<p><strong>dog/cat</strong></p>", "<p><strong>dog / cat</strong></p>"],
      ["<p><em>dog</em>/cat</p>", "<p><em>dog</em> / cat</p>"],
      // Code kerning is different
      [
        "<p><code>cat</code> / <code>unknown</code> classifier</p>",
        "<p><code>cat</code> / <code>unknown</code> classifier</p>",
      ],
    ])(
      "should add spaces around '/' even near other HTML tags: %s",
      (input: string, expected: string) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      },
    )

    for (const tagName of ["code", "pre"]) {
      it.each([
        ["https://dog"],
        ["https://dog/cat"],
        ["https://dog/cat/dog"],
        ["dog/cat"],
        ["dog/cat/dog"],
        ["‘cat’/‘dog’"],
        ["Shrek Two/3"],
      ])(`should not add spaces around '/' in <${tagName}> %s`, (input: string) => {
        let inputElement = `<${tagName}>${input}</${tagName}>`
        // In HTML, <pre> cannot be a child of <p>
        if (tagName === "code") {
          inputElement = `<p>${inputElement}</p>`
        }
        const processedHtml = testHtmlFormattingImprovement(inputElement)
        expect(normalizeNbsp(processedHtml)).toBe(inputElement)
      })
    }

    it.each([["https://dog"], ["https://dog/cat"]])(
      "should not add spaces around '/' in <a> %s",
      (input: string) => {
        const inputElement = `<p><a href="${input}">${input}</a></p>`
        const processedHtml = testHtmlFormattingImprovement(inputElement)
        expect(normalizeNbsp(processedHtml)).toBe(inputElement)
      },
    )
  })

  describe("spacesAroundSlashes marker invariance", () => {
    // Testing marker invariance for spacesAroundSlashes
    // Original error: "at : / , , ." became "at :  / , , ." (extra space)
    // Root cause: marker character is treated as non-whitespace by the regex

    it("spacesAroundSlashes is invariant with marker after colon (no space)", () => {
      // Pattern: colon, marker, slash - no space between
      const textWithMarker = `:${markerChar}/`
      const textWithoutMarker = ":/"

      const transformedWithMarker = spacesAroundSlashes(textWithMarker)
      const transformedWithoutMarker = spacesAroundSlashes(textWithoutMarker)
      const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

      expect(strippedResult).toBe(transformedWithoutMarker)
    })

    it("spacesAroundSlashes should be invariant with marker before slash (after space)", () => {
      // Pattern: colon, space, marker, slash - marker is right before slash
      // This is the bug case: regex (?<=[\S]) sees marker as non-whitespace
      // and adds a space, but without marker the space already exists
      const textWithMarker = `: ${markerChar}/ ,`
      const textWithoutMarker = ": / ,"

      const transformedWithMarker = spacesAroundSlashes(textWithMarker)
      const transformedWithoutMarker = spacesAroundSlashes(textWithoutMarker)
      const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

      // This test verifies the fix works - both should produce same result
      expect(strippedResult).toBe(transformedWithoutMarker)
    })

    it("spacesAroundSlashes should be invariant with marker before slash followed by comma (no space after)", () => {
      // Pattern from CI failure: "at : /," where element boundary is between space and slash
      const textWithMarker = `at : ${markerChar}/,`
      const textWithoutMarker = "at : /,"

      const transformedWithMarker = spacesAroundSlashes(textWithMarker)
      const transformedWithoutMarker = spacesAroundSlashes(textWithoutMarker)
      const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

      expect(strippedResult).toBe(transformedWithoutMarker)
    })

    it("symbolTransform is invariant with colon-slash pattern", () => {
      const textWithMarker = `: ${markerChar}/ ,`
      const textWithoutMarker = ": / ,"

      const transformedWithMarker = symbolTransform(textWithMarker, {
        separator: markerChar,
        includeArrows: false,
      })
      const transformedWithoutMarker = symbolTransform(textWithoutMarker, {
        separator: markerChar,
        includeArrows: false,
      })
      const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

      expect(strippedResult).toBe(transformedWithoutMarker)
    })
  })

  describe("Fractions", () => {
    it.each([
      ["<p>There are 1/2 left.</p>", '<p>There are <span class="fraction">1/2</span> left.</p>'],
      ["<p>I ate 2 1/4 pizzas.</p>", '<p>I ate 2 <span class="fraction">1/4</span> pizzas.</p>'],
      ["<p>I ate 2 -14213.21/4 pizzas.</p>", "<p>I ate 2 −14213.21/4 pizzas.</p>"],
      [
        "<p>I got 240/290 questions correct.</p>",
        '<p>I got <span class="fraction">240/290</span> questions correct.</p>',
      ],
      ["<p>2/3/50</p>", "<p>2/3/50</p>"],
      ["<p>01/01/2000</p>", "<p>01/01/2000</p>"],
      ["<p>9/11</p>", "<p>9/11</p>"],
    ])("should create an element for the fractions in %s", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("Time", () => {
    const timeCases = [
      ["12:30 PM", "12:30 p.m."],
      ["12:30 AM", "12:30 a.m."],
      ["12:30", "12:30"],
      ["1.41 PM", "1.41 p.m."],
      ["I AM A TEST", "I AM A TEST"],
      ["I saw him in the PM", "I saw him in the PM"],
      ["I saw him at 4 PM.", "I saw him at 4 p.m."], // Sentence end
    ]
    it.each(timeCases)("should handle time in %s, end-to-end", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
      expect(normalizeNbsp(processedHtml)).toBe(`<p>${expected}</p>`)
    })

    it.each(timeCases)("direct testing of the timeTransform function", (input, expected) => {
      const processedHtml = timeTransform(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("timeTransform is marker-invariant with footnote followed by Am", () => {
      // From CI failure: "<sup>15</sup> Am I" flattens to "15" + marker + " Am I"
      // Both should transform to "15 a.m. I" for invariance
      const textWithMarker = `15${markerChar} Am I`
      const textWithoutMarker = "15 Am I"

      const transformedWithMarker = timeTransform(textWithMarker)
      const transformedWithoutMarker = timeTransform(textWithoutMarker)
      const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

      expect(strippedResult).toBe(transformedWithoutMarker)
      expect(strippedResult).toBe("15 a.m. I")
    })
  })

  describe("Mass transforms", () => {
    // Note: !=, multiplication (5x1), and ellipsis (...) are now handled by punctilio's symbolTransform
    // These tests cover site-specific transforms in massTransformText
    it.each([
      ["The data are i.i.d.", "The data are IID"],
      ["The frappe", "The frappé"],
      ["The latte", "The latté"],
      ["That's cliche", "That's cliché"],
      ["Exposed", "Exposed"],
      ["The expose", "The exposé"],
      ["an expose", "an exposé"],
      ["I expose", "I expose"],
      ["Deja vu", "Déjà vu"],
      ["Naively", "Naïvely"],
      ["Don't be naive", "Don't be naïve"],
      ["Dojo", "Dōjō"],
      ["regex", "RegEx"],
      ["regexpressions", "regexpressions"],
      ["Chateau", "Château"],
      ["chateau", "château"],
      ["github", "GitHub"],
      ["GitHub", "GitHub"],
      ["I went to github", "I went to GitHub"],
      ["voilà", "voilà"],
      ["Voilà", "Voilà"],
      ["and then, voila!", "and then, voilà!"],
      ["relu", "RELU"],
      ["reluctantly", "reluctantly"],
      ["ReLU", "RELU"],
      ["How are you 1RelU?", "How are you 1RelU?"],
      ["wifi", "Wi-Fi"],
      ["wi-fi", "Wi-Fi"],
      ["WiFi", "Wi-Fi"],
      ["WI-FI", "Wi-Fi"],
      ["wiFi", "Wi-Fi"],
      ["regexes", "RegExes"],
      ["Connect to the wi-fi network", "Connect to the Wi-Fi network"],
      ["The wi-fi is down", "The Wi-Fi is down"],
      ["My open-source", "My open source"],
      ["I wrote the markdown file", "I wrote the Markdown file"],
      ["e.g., this is a test", "e.g. this is a test"],
      ["i.e., this is a test", "i.e. this is a test"],
      ["(e.g., this is a test)", "(e.g. this is a test)"],
      ["(i.e., this is a test)", "(i.e. this is a test)"],
      // Test variations of e.g. and i.e. with marker-aware word boundaries
      ["eg this is a test", "e.g. this is a test"],
      ["ie this is a test", "i.e. this is a test"],
      ["e.g this is a test", "e.g. this is a test"],
      ["i.e this is a test", "i.e. this is a test"],
      ["eg. this is a test", "e.g. this is a test"],
      ["ie. this is a test", "i.e. this is a test"],
      ["E.G., this is a test", "e.g. this is a test"],
      ["I.E., this is a test", "i.e. this is a test"],
      ["EG this is a test", "e.g. this is a test"],
      ["IE this is a test", "i.e. this is a test"],
      // Should not transform when not at word boundaries
      ["egie", "egie"], // 'eg' in middle of word should not match
      ["diet", "diet"], // 'ie' in middle of word should not match
      ["piece", "piece"], // 'ie' in middle of word should not match
      ["macos", "macOS"],
      ["MacOS", "macOS"],
      ["MACOS", "macOS"],
      ["macOS", "macOS"],
      ["Mac OS", "Mac OS"],
      ["Team shard", "Team Shard"],
      ["Gemini Pro 3", "Gemini 3 Pro"],
      ["Gemini Pro 3-shot", "Gemini Pro 3-shot"],
      ["Gemini Pro 2.5", "Gemini 2.5 Pro"],
      // Model naming standardization
      ["LLAMA-2", "Llama-2"],
      ["LLAMA-3.1-70B", "Llama-3.1-70B"],
      ["LLAMA-1", "Llama-1"],
      ["Llama-2", "Llama-2"], // Already correct, no change
      ["GPT-4-o", "GPT-4o"],
      ["gpt-4-o", "GPT-4o"],
      ["GPT-4o", "GPT-4o"], // Already correct, no change
      // BibTeX capitalization
      ["bibtex", "BibTeX"],
      ["BIBTEX", "BibTeX"],
      ["Bibtex", "BibTeX"],
      ["BibTeX", "BibTeX"], // Already correct, no change
      ["Use bibtex for citations", "Use BibTeX for citations"],
    ])("should perform transforms for %s", (input: string, expected: string) => {
      const result = massTransformText(input)
      expect(result).toBe(expected)
    })

    describe("Marker invariance for e.g. and i.e. transforms", () => {
      // Test that the marker-aware word boundary patterns work correctly
      // when markers are present between word characters
      it("should be marker-invariant for 'e.g.' at start of text", () => {
        const textWithMarker = `${markerChar}e.g. test`
        const textWithoutMarker = "e.g. test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("e.g. test")
      })

      it("should be marker-invariant for 'i.e.' at start of text", () => {
        const textWithMarker = `${markerChar}i.e. test`
        const textWithoutMarker = "i.e. test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("i.e. test")
      })

      it("should be marker-invariant for 'eg' followed by marker", () => {
        const textWithMarker = `eg${markerChar} test`
        const textWithoutMarker = "eg test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("e.g. test")
      })

      it("should be marker-invariant for 'ie.' followed by marker", () => {
        // Test "ie." (with period) followed by marker
        const textWithMarker = `ie.${markerChar} test`
        const textWithoutMarker = "ie. test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("i.e. test")
      })

      it("should not transform 'eg' in middle of word with marker (e.g., 'regex')", () => {
        const textWithMarker = `reg${markerChar}ex`
        const textWithoutMarker = "regex"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(transformedWithoutMarker).toBe("RegEx")
        expect(strippedResult).toBe("regex")
      })

      it("should not transform 'ie' in middle of word with marker (e.g., 'piece')", () => {
        // Pattern: "p" + "ie" + marker + "ce" - marker between 'ie' and 'ce'
        const textWithMarker = `pie${markerChar}ce`
        const textWithoutMarker = "piece"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("piece")
      })

      it("should handle 'e.g.,' with marker between elements", () => {
        // Simulates: "<em>e.g.</em>, test" which becomes "e.g." + marker + ", test"
        const textWithMarker = `e.g.${markerChar}, test`
        const textWithoutMarker = "e.g., test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("e.g. test")
      })

      it("should handle 'i.e.,' with marker between elements", () => {
        // Simulates: "<em>i.e.</em>, test" which becomes "i.e." + marker + ", test"
        const textWithMarker = `i.e.${markerChar}, test`
        const textWithoutMarker = "i.e., test"

        const transformedWithMarker = massTransformText(textWithMarker)
        const transformedWithoutMarker = massTransformText(textWithoutMarker)
        const strippedResult = transformedWithMarker.replaceAll(markerChar, "")

        expect(strippedResult).toBe(transformedWithoutMarker)
        expect(strippedResult).toBe("i.e. test")
      })
    })

    describe("HTML integration for e.g. and i.e.", () => {
      it.each([
        ["<p><em>eg</em> test</p>", "<p><em>e.g.</em> test</p>"],
        ["<p><em>e.g.</em>, test</p>", "<p><em>e.g.</em> test</p>"],
        ["<p><strong>ie</strong> test</p>", "<p><strong>i.e.</strong> test</p>"],
        ["<p><strong>i.e.</strong>, test</p>", "<p><strong>i.e.</strong> test</p>"],
        ["<p>(<em>eg</em> test)</p>", "<p>(<em>e.g.</em> test)</p>"],
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })
  })

  describe("Punctilio symbolTransform integration (end-to-end HTML)", () => {
    describe("Not equals", () => {
      it.each([
        ["<p>1 != 2</p>", "<p>1 ≠ 2</p>"],
        ["<p>x!=y</p>", "<p>x≠y</p>"],
        ["<p><code>a != b</code></p>", "<p><code>a != b</code></p>"], // Preserved in code
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })

    describe("Multiplication", () => {
      it.each([
        ["<p>5x1</p>", "<p>5×1</p>"],
        ["<p>3 x 4</p>", "<p>3 × 4</p>"],
        ["<p>2*3</p>", "<p>2×3</p>"],
        ["<p>I have 3x apples</p>", "<p>I have 3× apples</p>"],
        ["<p>-2 x 3 = -6</p>", "<p>−2 × 3 = −6</p>"],
        ["<p>The word box should not change</p>", "<p>The word box should not change</p>"],
        ["<p><code>5x5</code></p>", "<p><code>5x5</code></p>"], // Preserved in code
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })

    describe("Ellipsis", () => {
      it.each([
        ["<p>Wait...</p>", "<p>Wait…</p>"],
        ["<p>What...?</p>", "<p>What…?</p>"],
        ["<p>Hmm...well</p>", "<p>Hmm… well</p>"],
        ["<p><code>...</code></p>", "<p><code>...</code></p>"], // Preserved in code
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })

    describe("Math symbols", () => {
      it.each([
        ["<p>+/-</p>", "<p>±</p>"],
        ["<p>~=</p>", "<p>≈</p>"],
        ["<p>>=</p>", "<p>≥</p>"],
        ["<p><=</p>", "<p>≤</p>"],
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })

    describe("Legal symbols", () => {
      it.each([
        ["<p>(c)</p>", "<p>©</p>"],
        ["<p>(C)</p>", "<p>©</p>"],
        ["<p>(r)</p>", "<p>®</p>"],
        ["<p>(R)</p>", "<p>®</p>"],
        ["<p>(tm)</p>", "<p>™</p>"],
        ["<p>(TM)</p>", "<p>™</p>"],
      ])("transforms '%s' to '%s'", (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      })
    })
  })

  describe("macOS transform end-to-end (HTML)", () => {
    it.each([
      ["<p>macos</p>", "<p>macOS</p>"],
      ["<p>MACOS</p>", "<p>macOS</p>"],
      ["<p>macOS</p>", "<p>macOS</p>"],
      ["<p>Mac OS</p>", "<p>Mac OS</p>"],
      // Ensure we don't transform inside code blocks
      ["<p><code>macos</code></p>", "<p><code>macos</code></p>"],
    ])("transforms '%s' to '%s'", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("Ampersand replacement", () => {
    it.each([["<p>There I saw him+her.</p>", "<p>There I saw him &#x26; her.</p>"]])(
      "should replace + with & in %s",
      (input: string, expected: string) => {
        const result = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(result)).toBe(expected)
      },
    )
  })

  describe("Hyphens", () => {
    it.each([
      ["<code>This is a - hyphen.</code>", "<code>This is a - hyphen.</code>"],
      ["<p>I think that -<em> despite</em></p>", "<p>I think that—<em>despite</em></p>"],
      [
        "<blockquote><p>Perhaps one did not want to be loved so much as to be understood.</p><p>-- Orwell, <em>1984</em></p></blockquote>",
        "<blockquote><p>Perhaps one did not want to be loved so much as to be understood.</p><p>— Orwell, <em>1984</em></p></blockquote>",
      ],
      // There is NBSP after the - in the next one!
      [
        "<blockquote><blockquote><p>not simply <em>accept</em> – but</p></blockquote></blockquote>",
        "<blockquote><blockquote><p>not simply <em>accept</em>—but</p></blockquote></blockquote>",
      ],
      // Handle en dash number ranges
      ["<p>1-2</p>", "<p>1–2</p>"],
      ["<p>p1-2</p>", "<p>p1–2</p>"], // Page range
      [
        "<p>Hi you're a test <code>ABC</code> - file</p>",
        "<p>Hi you’re a test <code>ABC</code>—file</p>",
      ],
    ])("handling hyphenation in the DOM", (input: string, expected: string) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })
  describe("transformParagraph", () => {
    function _getParagraphNode(numChildren: number, value = "Hello, world!"): Element {
      return h(
        "p",
        {},
        Array.from({ length: numChildren }, () => ({
          type: "text",
          value,
        })),
      )
    }

    const capitalize = (str: string) => str.toUpperCase()
    it.each([
      ["r231o dsa;", 1],
      ["hi", 3],
    ])("should capitalize while respecting the marker", (before: string, numChildren: number) => {
      const node = _getParagraphNode(numChildren, before)
      transformElement(node, capitalize, () => false, markerChar)

      const targetNode = _getParagraphNode(numChildren, capitalize(before))
      expect(node).toEqual(targetNode)
    })
  })

  describe("Number Range", () => {
    const testCases = [
      ["1-2", "1–2"],
      ["10-20", "10–20"],
      ["100-200", "100–200"],
      ["1000-2000", "1000–2000"],
      ["1,000-2,000", "1,000–2,000"],
      ["1.000-2.000", "1.000–2.000"],
      ["1-2 and 3-4", "1–2 and 3–4"],
      ["from 5-10 to 15-20", "from 5–10 to 15–20"],
      ["1-2-3", "1-2-3"], // Ambiguous pattern (could be phone segment), preserved
      ["a-b", "a-b"], // Don't replace non-numeric ranges
      ["1a-2b", "1a-2b"], // Don't replace if not purely numeric
      ["a1-2b", "a1-2b"], // Don't replace if not purely numeric
      ["p. 206-207)", "p. 206–207)"], // ) should close out a word boundary
      ["Qwen1.5-1.8", "Qwen1.5-1.8"], // Don't replace if there's a decimal
      ["$100-$200", "$100–$200"], // Dollar amounts
      ["$1.50-$3.50", "$1.50–$3.50"], // Dollar amounts with decimals
      ["$1-3", "$1–3"], // Dollar amounts with single digit
    ]

    it.each(testCases)(
      "should replace hyphens with en dashes in number ranges: %s (end-to-end)",
      (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
        expect(normalizeNbsp(processedHtml)).toBe(`<p>${expected}</p>`)
      },
    )
  })

  describe("Arrows", () => {
    it.each([
      // Basic arrow cases
      ["<p>-> arrow</p>", '<p><span class="right-arrow">⭢</span> arrow</p>'],
      ["<p>--> arrow</p>", '<p><span class="right-arrow">⭢</span> arrow</p>'],
      ["<p>word -> arrow</p>", '<p>word <span class="right-arrow">⭢</span> arrow</p>'],
      ["<p>word->arrow</p>", '<p>word <span class="right-arrow">⭢</span> arrow</p>'],
      ["<p>word --> arrow</p>", '<p>word <span class="right-arrow">⭢</span> arrow</p>'],

      // Start of line cases
      ["<p>-> at start</p>", '<p><span class="right-arrow">⭢</span> at start</p>'],
      ["<p>--> at start</p>", '<p><span class="right-arrow">⭢</span> at start</p>'],

      // Multiple arrows in one line
      [
        "<p>-> first --> second</p>",
        '<p><span class="right-arrow">⭢</span> first <span class="right-arrow">⭢</span> second</p>',
      ],

      // Code blocks should be ignored
      ["<code>-> not an arrow</code>", "<code>-> not an arrow</code>"],
      ["<pre>-> not an arrow</pre>", "<pre>-> not an arrow</pre>"],
      [
        "<p>text <code>-> ignored</code> -> arrow</p>",
        '<p>text <code>-> ignored</code> <span class="right-arrow">⭢</span> arrow</p>',
      ],

      // Nested elements
      [
        "<p>text <em>-> arrow</em></p>",
        '<p>text <em><span class="right-arrow">⭢</span> arrow</em></p>',
      ],
      [
        "<p><strong>-> arrow</strong></p>",
        '<p><strong><span class="right-arrow">⭢</span> arrow</strong></p>',
      ],

      // Mixed with other formatting
      ["<p>text -> *emphasis*</p>", '<p>text <span class="right-arrow">⭢</span> *emphasis*</p>'],
      ["<p>**bold** -> text</p>", '<p>**bold** <span class="right-arrow">⭢</span> text</p>'],

      ["<p>No change in word-like</p>", "<p>No change in word-like</p>"], // Should not change hyphens
    ])("should format arrows correctly: %s", (input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })
})

describe("rearrangeLinkPunctuation", () => {
  const specialCases = [
    [
      '<p>"<a href="https://example.com">Link</a>"</p>',
      '<p><a href="https://example.com">“Link”</a></p>',
    ],
    [
      '<p>"<a href="https://example.com"><code>Link</code></a>"</p>',
      '<p><a href="https://example.com">“<code>Link</code>”</a></p>',
    ],
    [
      '<p><a href="https://example.com">Link</a>",</p>',
      `<p><a href="https://example.com">Link,${RIGHT_DOUBLE_QUOTE}</a></p>`,
    ],
    [
      '<p><a href="https://example.com">Link</a>" k</p>',
      '<p><a href="https://example.com">Link”</a> k</p>',
    ],
    [
      '<p>(<a href="https://scholar.google.com/citations?user=thAHiVcAAAAJ">Google Scholar</a>)</p>',
      '<p>(<a href="https://scholar.google.com/citations?user=thAHiVcAAAAJ">Google Scholar</a>)</p>',
    ],
    [
      '<p><em><a href="https://example.com">Link</a></em></p>',
      '<p><em><a href="https://example.com">Link</a></em></p>',
    ],
    [
      '<p><strong><a href="https://example.com">Link</a></strong></p>',
      '<p><strong><a href="https://example.com">Link</a></strong></p>',
    ],
    [
      '<p><a href="/a-certain-formalization-of-corrigibility-is-vnm-incoherent"><em>Corrigibility Can Be VNM-Incoherent</em></a></p>,',
      '<p><a href="/a-certain-formalization-of-corrigibility-is-vnm-incoherent"><em>Corrigibility Can Be VNM-Incoherent</em>,</a></p>',
    ],
  ]

  // Ignore chars which will be transformed into smart quotes; will error
  const charsToTest = charsToMoveIntoLinkFromRight.filter(
    (char: string) => !['"', "'"].includes(char),
  )
  const generateLinkScenarios = () => {
    const basicScenarios = charsToTest.map((mark: string) => [
      `<p><a href="https://example.com">Link</a>${mark}</p>`,
      `<p><a href="https://example.com">Link${mark}</a></p>`,
    ])
    return [...basicScenarios, ...specialCases]
  }

  const linkScenarios = generateLinkScenarios()

  it.each(linkScenarios)("correctly handles link punctuation", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  describe("Handles footnote links correctly", () => {
    it("should not modify footnote links", () => {
      const input = '<p>Sentence with footnote<a href="#user-content-fn-1">1</a>.</p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    it("should modify regular links but not footnote links", () => {
      const input =
        '<p><a href="https://example.com">Link</a>. <a href="#user-content-fn-2">2</a>.</p>'
      const expected =
        '<p><a href="https://example.com">Link.</a> <a href="#user-content-fn-2">2</a>.</p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("End-to-end HTML formatting improvement", () => {
    it.each([
      [
        '<p><a href="https://www.amazon.com/Algorithms-Live-Computer-Science-Decisions/dp/1627790365">Algorithms to Live By: The Computer Science of Human Decisions</a>.</p>',
        '<p><a href="https://www.amazon.com/Algorithms-Live-Computer-Science-Decisions/dp/1627790365">Algorithms to Live By: The Computer Science of Human Decisions.</a></p>',
      ],
      [
        '<p><em><a href="https://www.amazon.com/Algorithms-Live-Computer-Science-Decisions/dp/1627790365">Algorithms to Live By: The Computer Science of Human Decisions</a></em>.</p>',
        '<p><em><a href="https://www.amazon.com/Algorithms-Live-Computer-Science-Decisions/dp/1627790365">Algorithms to Live By: The Computer Science of Human Decisions.</a></em></p>',
      ],
    ])("correctly processes links", (input: string, expected: string) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("Handles multiple links in a single string", () => {
    it("processes multiple links correctly", () => {
      const input =
        '<p>Check out <a href="https://example1.com">Link1</a>, and then <a href="https://example2.com">Link2</a>!</p>'
      const expected =
        '<p>Check out <a href="https://example1.com">Link1,</a> and then <a href="https://example2.com">Link2!</a></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("Doesn't modify non-link text", () => {
    it("leaves regular text unchanged", () => {
      const input = "<p>This is a regular sentence without any links.</p>"
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })
  })

  describe("rearrangeLinkPunctuation edge cases", () => {
    it("should handle case where linkNode has no text child at the end", () => {
      const input = '<p><a href="https://example.com"><span></span></a>.</p>'
      const expected = '<p><a href="https://example.com"><span></span>.</a></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("should handle when sibling is an element with children but not text-like", () => {
      const input = '<p><a href="https://example.com">Link</a><div>Not text-like</div></p>'
      const expected =
        '<p><a href="https://example.com">Link</a></p><div>Not text-like</div><p></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("should handle when sibling is text-like element with first child being text", () => {
      const input = '<p><a href="https://example.com">Link</a><em>.</em></p>'
      const expected = '<p><a href="https://example.com">Link.</a><em></em></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("should handle case where textNode has no value", () => {
      const input = '<p><a href="https://example.com">Link</a><em></em></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    it("should return early when index is undefined", () => {
      const node = h("a", { href: "https://example.com" }, "Link") as Element
      const parent = h("p", [node]) as Element

      // This should return early and not throw an error
      expect(() => {
        rearrangeLinkPunctuation(node, undefined, parent)
      }).not.toThrow()
    })

    it("should handle case where last child doesn't have value property", () => {
      const input = '<p><a href="https://example.com">Link<span></span></a>.</p>'
      const expected = '<p><a href="https://example.com">Link<span></span>.</a></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("should handle case where lastChild doesn't have value property - direct test", () => {
      // Create a linkNode where we can manipulate the last child after the function adds a text node
      const linkNode = h("a", { href: "https://example.com" }, ["Link"]) as Element

      const textNode = { type: "text", value: "." } as Text
      const parent = h("p", [linkNode, textNode]) as Element

      // Call the function normally first, which will move the punctuation
      rearrangeLinkPunctuation(linkNode, 0, parent)

      // Check that the punctuation was moved (this is the normal behavior)
      expect(textNode.value).toBe("")
      expect((linkNode.children[linkNode.children.length - 1] as Text).value).toBe("Link.")
    })

    it("should handle case where lastChild doesn't have value property after adding text node", () => {
      const linkNode = h("a", { href: "#" }, [
        h("img", { src: "test.jpg", alt: "test" }), // Element without value property
      ]) as Element

      const value = "test"
      const textNode = { type: "text", value: `.${value}` } as Text
      const parent = h("p", [linkNode, textNode]) as Element

      // The function will add a text node as the last child and move the punctuation
      rearrangeLinkPunctuation(linkNode, 0, parent)

      // The "." should be moved into the link, leaving only "test"
      expect(textNode.value).toBe(value)

      // Verify that a text node was added to the link with the moved punctuation
      const lastChild = linkNode.children[linkNode.children.length - 1] as Text
      expect(lastChild.type).toBe("text")
      expect(lastChild.value).toBe(".")
    })
  })

  it.each([
    [
      '<p><a href="https://example.com">Simple link</a>: with colon after</p>',
      '<p><a href="https://example.com">Simple link:</a> with colon after</p>',
    ],
    [
      '<p><a href="https://example.com"><em>Nested</em> link</a>: with colon after</p>',
      '<p><a href="https://example.com"><em>Nested</em> link:</a> with colon after</p>',
    ],
    [
      '<p><a href="https://example.com"><em>Fully nested</em></a>: with colon after</p>',
      '<p><a href="https://example.com"><em>Fully nested</em>:</a> with colon after</p>',
    ],
    [
      '<p><a href="https://example.com">Link</a>. with period after</p>',
      '<p><a href="https://example.com">Link.</a> with period after</p>',
    ],
    [
      '<p><a href="https://example.com">Link</a>, with comma after</p>',
      '<p><a href="https://example.com">Link,</a> with comma after</p>',
    ],
    [
      '<p><a href="https://example.com"><strong>Bold</strong> link</a>: with colon after</p>',
      '<p><a href="https://example.com"><strong>Bold</strong> link:</a> with colon after</p>',
    ],
  ])('correctly applies nested link punctuation for "%s"', (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

// Testing smartquotes balance checker

describe("assertSmartQuotesMatch", () => {
  it("should not throw for an empty string", () => {
    expect(() => assertSmartQuotesMatch("")).not.toThrow()
  })

  it("should not throw for correctly matched quotes", () => {
    const validStrings = [
      "“This is a valid string”",
      "“Nested quotes: “Inside” work too”",
      "“Multiple sentences work too”. “So does this”",
      "Other punctuation is fine: “Hello,” she said.",
    ]

    validStrings.forEach((str) => {
      expect(() => assertSmartQuotesMatch(str)).not.toThrow()
    })
  })

  it("should throw for mismatched opening quotes", () => {
    const invalidStrings = ["“This is missing an end quote", "“Nested “quotes” that are incorrect"]

    invalidStrings.forEach((str) => {
      expect(() => assertSmartQuotesMatch(str)).toThrowErrorMatchingSnapshot()
    })
  })

  it("should throw for mismatched closing quotes", () => {
    const invalidStrings = ["This has a random ending quote”", "“More” nested mismatches”"]

    invalidStrings.forEach((str) => {
      expect(() => assertSmartQuotesMatch(str)).toThrowErrorMatchingSnapshot()
    })
  })
})

describe("flattenTextNodes and getTextContent", () => {
  const ignoreNone = () => false
  const ignoreCode = (n: Element) => n.tagName === "code"

  const testNodes = {
    empty: h("", []),
    simple: h("p", "Hello, world!"),
    nested: h("div", ["This is ", h("em", "emphasized"), " text."]),
    withCode: h("div", ["This is ", h("code", "ignored"), " text."]),
    emptyAndComment: h("div", [h("span"), { type: "comment", value: "This is a comment" }]),
    deeplyNested: h("div", ["Level 1 ", h("span", ["Level 2 ", h("em", "Level 3")]), " End"]),
  }

  describe("flattenTextNodes", () => {
    it("should handle various node structures", () => {
      expect(flattenTextNodes(testNodes.empty, ignoreNone)).toEqual([])
      expect(flattenTextNodes(testNodes.simple, ignoreNone)).toEqual([
        { type: "text", value: "Hello, world!" },
      ])
      expect(flattenTextNodes(testNodes.nested, ignoreNone)).toEqual([
        { type: "text", value: "This is " },
        { type: "text", value: "emphasized" },
        { type: "text", value: " text." },
      ])
      expect(flattenTextNodes(testNodes.withCode, ignoreCode)).toEqual([
        { type: "text", value: "This is " },
        { type: "text", value: " text." },
      ])
      expect(flattenTextNodes(testNodes.emptyAndComment, ignoreNone)).toEqual([])
      expect(flattenTextNodes(testNodes.deeplyNested, ignoreNone)).toEqual([
        { type: "text", value: "Level 1 " },
        { type: "text", value: "Level 2 " },
        { type: "text", value: "Level 3" },
        { type: "text", value: " End" },
      ])
    })
  })

  describe("getTextContent", () => {
    it("should handle various node structures", () => {
      expect(getTextContent(testNodes.empty)).toBe("")
      expect(getTextContent(testNodes.simple)).toBe("Hello, world!")
      expect(getTextContent(testNodes.nested)).toBe("This is emphasized text.")
    })
  })
})

describe("setFirstLetterAttribute", () => {
  it.each([
    [
      "sets data-first-letter on the first paragraph in the first ",
      `
      
      <h1>Title</h1>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    
      
      <p>First paragraph.</p>
    
      
      <p>Second paragraph.</p>
    
    `,
      `
      
      <h1>Title</h1>
      <p data-first-letter="F">First paragraph.</p>
      <p>Second paragraph.</p>
    
      
      <p>First paragraph.</p>
    
      
      <p>Second paragraph.</p>
    
    `,
    ],
    [
      "does not modify when there are no paragraphs",
      `
      
      <h1>Title</h1>
    
      <div>Not a paragraph</div>
    `,
      `
      
      <h1>Title</h1>
    
      <div>Not a paragraph</div>
    `,
    ],
    [
      "only processes the first  in the document",
      `
      <p>First paragraph.</p>
    
      
      <p>Second paragraph.</p>
    
    `,
      `
      <p data-first-letter="F">First paragraph.</p>
    
      
      <p>Second paragraph.</p>
    
    `,
    ],
    [
      "sets the attribute when skipFirstLetter is not in options",
      `<p>First paragraph.</p>
    `,
      `<p data-first-letter="F">First paragraph.</p>
    `,
      true,
    ],
    [
      "skips empty paragraphs and sets attribute on first non-empty paragraph",
      `
      <p></p>
      <p>First non-empty paragraph.</p>
      <p>Second paragraph.</p>
    
    `,
      `
      <p></p>
      <p data-first-letter="F">First non-empty paragraph.</p>
      <p>Second paragraph.</p>
    
    `,
    ],
  ])("%s", (_description, input, expected, doNotSetFirstLetterAttribute = false) => {
    const processedHtml = testHtmlFormattingImprovement(input, false, doNotSetFirstLetterAttribute)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it.each([
    [
      "apostrophe as second character (after smart-quote transform)",
      `
      
      <p>'Twas the night before Christmas.</p>
    
    `,
      `
      
      <p data-first-letter="’">’Twas the night before Christmas.</p>
    
    `,
    ],
    [
      "second character is a quote and we have a direct text node to patch",
      '<p><strong></strong>"Twas the night</p>',
      '<p data-first-letter="“"><strong></strong>“Twas the night</p>',
    ],
    [
      "second character is an apostrophe and a direct text node exists",
      "<p><span></span>X's story</p>",
      '<p data-first-letter="X"><span></span>X ’s story</p>',
    ],
  ])("%s", (_description, input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it.each([
    [
      "paragraph is not a direct child of article",
      `
      <div>
        <p>First paragraph not in article.</p>
        <p>Second paragraph not in article.</p>
      </div>
    `,
    ],
    [
      "paragraph is nested inside article",
      `
      <article>
        <div>
          <p>Nested paragraph in article.</p>
        </div>
      </article>
    `,
    ],
  ])("should NOT set data-first-letter when %s", (_description, input) => {
    // setFirstLetterAttribute only applies to <p> that are direct children of the root
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(normalizeNbsp(processedHtml)).toBe(input)
  })
})

describe("removeSpaceBeforeSup", () => {
  it.each([
    ["text <sup>1</sup>", "text<sup>1</sup>"],
    ["multiple spaces   <sup>2</sup>", "multiple spaces<sup>2</sup>"],
    ["text<sup>3</sup>", "text<sup>3</sup>"], // No space case
    ["text <sup>1</sup> and text <sup>2</sup>", "text<sup>1</sup> and text<sup>2</sup>"],
    ["text &nbsp;<sup>4</sup>", "text<sup>4</sup>"], // HTML entities
    ["text <sup>1</sup>", "text<sup>1</sup>"], // Nested in paragraph
    ["<sup>1</sup>", "<sup>1</sup>"], // First element
  ])('should process "%s" to "%s"', (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
    expect(normalizeNbsp(processedHtml)).toBe(`<p>${expected}</p>`)
  })

  it("should handle multiple sups in complex HTML", () => {
    const input = "<p>First<sup>1</sup> and second <sup>2</sup> and third<sup>3</sup></p>"
    const expected = "<p>First<sup>1</sup> and second<sup>2</sup> and third<sup>3</sup></p>"
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

describe("minusReplace", () => {
  // Test ${chr} handling
  const tableBefore =
    '<table><thead><tr><th style="text-align:right;">Before</th><th style="text-align:left;">After</th></tr></thead><tbody><tr><td style="text-align:right;"><span class="no-formatting">-2 x 3 = -6</span></td><td style="text-align:left;">-2 x 3 = -6</td></tr></tbody></table>'
  const tableAfter =
    '<table><thead><tr><th style="text-align:right;">Before</th><th style="text-align:left;">After</th></tr></thead><tbody><tr><td style="text-align:right;"><span class="no-formatting">-2 x 3 = -6</span></td><td style="text-align:left;">−2 × 3 = −6</td></tr></tbody></table>'
  // Now test the end-to-end HTML formatting improvement
  it.each([
    ["<p>-3</p>", "<p>−3</p>"],
    ["<p>-2 x 3 = -6</p>", "<p>−2 × 3 = −6</p>"],
    ["<p>\n-2 x 3 = -6</p>", "<p>\n−2 × 3 = −6</p>"],
    [tableBefore, tableAfter],
    ["<p>19,999<sup>100,000,000 - 992</sup></p>", "<p>19,999<sup>100,000,000 − 992</sup></p>"],
  ])("transforms '%s' to '%s'", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

describe("L-number formatting", () => {
  function testMatch(input: string): string[] {
    const matches: string[] = []
    let match
    while ((match = l_pRegex.exec(input)) !== null) {
      matches.push(match[2]) // Push the captured number
    }
    return matches
  }

  it("matches basic L-numbers", () => {
    expect(testMatch("L1")).toEqual(["1"])
    expect(testMatch("L42")).toEqual(["42"])
    expect(testMatch("L999")).toEqual(["999"])
  })

  it("matches multiple L-numbers in text", () => {
    expect(testMatch("L1 and L2 and L3")).toEqual(["1", "2", "3"])
    expect(testMatch("L10, L20, L30")).toEqual(["10", "20", "30"])
  })

  it("matches L-numbers at start of text", () => {
    expect(testMatch("L1 is first")).toEqual(["1"])
  })

  it("matches L-numbers after space", () => {
    expect(testMatch("The L1 norm")).toEqual(["1"])
    expect(testMatch("Using L2 regularization")).toEqual(["2"])
  })

  it("doesn't match invalid cases", () => {
    expect(testMatch("L1.5")).toEqual([]) // Decimal
    expect(testMatch("L-1")).toEqual([]) // Negative
    expect(testMatch("LEVEL")).toEqual([]) // Part of word
    expect(testMatch("ILO10")).toEqual([]) // Nonsense
    expect(testMatch("aL1")).toEqual([]) // No space/start
    expect(testMatch("L1a")).toEqual([]) // No word boundary
    expect(testMatch("L")).toEqual([]) // No number
    expect(testMatch("L 1")).toEqual([]) // Space between L and number
  })

  it("handles multiple matches with varying digit counts", () => {
    expect(testMatch("L1 L22 L333")).toEqual(["1", "22", "333"])
  })

  it("matches at line start without space", () => {
    expect(testMatch("L1\nL2")).toEqual(["1", "2"])
  })

  it.each([
    [
      "<p>L1 is the first level</p>",
      '<p>L<sub style="font-variant-numeric: lining-nums;">1</sub> is the first level</p>',
    ],
    [
      "<p>Levels L1, L2, and L3</p>",
      '<p>Levels L<sub style="font-variant-numeric: lining-nums;">1</sub>, L<sub style="font-variant-numeric: lining-nums;">2</sub>, and L<sub style="font-variant-numeric: lining-nums;">3</sub></p>',
    ],
    [
      "<p>L42 is a higher level</p>",
      '<p>L<sub style="font-variant-numeric: lining-nums;">42</sub> is a higher level</p>',
    ],
    ["<code>L1 should not change</code>", "<code>L1 should not change</code>"],
    ["<p>Words like LEVEL should not change</p>", "<p>Words like LEVEL should not change</p>"],
    [
      "<p>L1.5 should not change</p>", // Decimal numbers shouldn't be affected
      "<p>L1.5 should not change</p>",
    ],
  ])("correctly formats L-numbers in %s", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it("handles L-numbers at start of text", () => {
    const input = "<p>L1</p>"
    const expected = '<p>L<sub style="font-variant-numeric: lining-nums;">1</sub></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it("handles L-numbers in nested elements", () => {
    const input = "<p><em>L1</em> and <strong>L2</strong></p>"
    const expected =
      '<p><em>L<sub style="font-variant-numeric: lining-nums;">1</sub></em> and <strong>L<sub style="font-variant-numeric: lining-nums;">2</sub></strong></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

describe("Skip Formatting", () => {
  it.each([
    [
      '<p class="no-formatting">"Hello" and "world"</p>',
      '<p class="no-formatting">"Hello" and "world"</p>',
      "quotes should not be transformed",
    ],
    [
      '<p class="no-formatting">word -- another</p>',
      '<p class="no-formatting">word -- another</p>',
      "dashes should not be transformed",
    ],
  ])("should skip formatting when no-formatting class is present: %s", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  describe("Footnote references", () => {
    // Footnote refs have data-footnote-ref attribute; their number text shouldn't be transformed
    // Note: rehype serializes boolean attributes as `data-footnote-ref=""`
    it.each([
      [
        "skip text inside footnote reference elements",
        '<p>Some text<sup><a href="#fn-1" data-footnote-ref>15</a></sup> Am I right?</p>',
        '<p>Some text<sup><a href="#fn-1" data-footnote-ref="">15</a></sup> Am I right?</p>',
      ],
      [
        "not transform footnote ref number into time pattern",
        // This is the specific bug case: "15" + " Am I" should NOT become "15 a.m. I"
        "<p><sup><a data-footnote-ref>15</a></sup> Am I correct?</p>",
        '<p><sup><a data-footnote-ref="">15</a></sup> Am I correct?</p>',
      ],
      [
        "still transform text outside footnote refs normally",
        '<p>Meet at 3 PM<sup><a href="#fn-1" data-footnote-ref>1</a></sup> for coffee.</p>',
        '<p>Meet at 3 p.m.<sup><a href="#fn-1" data-footnote-ref="">1</a></sup> for coffee.</p>',
      ],
      [
        "handle multiple footnote refs in same paragraph",
        "<p>First<sup><a data-footnote-ref>1</a></sup> and second<sup><a data-footnote-ref>2</a></sup>.</p>",
        // Note: punctuation gets moved into the second link due to rearrangeLinkPunctuation
        '<p>First<sup><a data-footnote-ref="">1</a></sup> and second<sup><a data-footnote-ref="">2.</a></sup></p>',
      ],
    ])("should %s", (_description, input, expected) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })

  describe("toSkip function", () => {
    it.each(SKIP_TAGS)("should skip <%s> elements", (tagName) => {
      const element = h(tagName, {}, []) as Element
      expect(toSkip(element)).toBe(true)
    })

    it.each(SKIP_CLASSES)("should skip elements with class '%s'", (className) => {
      const element = h("p", { className }, []) as Element
      expect(toSkip(element)).toBe(true)
    })

    it("should not skip <svg> elements (removed from skip list)", () => {
      const element = h("svg", {}, []) as Element
      expect(toSkip(element)).toBe(false)
    })

    it("should skip elements with data-footnote-ref attribute", () => {
      const element = h("a", { dataFootnoteRef: true }, []) as Element
      expect(toSkip(element)).toBe(true)
    })

    it("should return false for non-element nodes", () => {
      const textNode = { type: "text", value: "hello" } as unknown as Element
      expect(toSkip(textNode)).toBe(false)
    })
  })
})

describe("Date Range", () => {
  it("should handle end-to-end HTML formatting", () => {
    const input = "<p>Revenue from Jan-Mar exceeded Apr-Jun.</p>"
    const expected = "<p>Revenue from Jan–Mar exceeded Apr–Jun.</p>"
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

describe("collectTransformableElements", () => {
  const el = (tag: string, children: (string | Element)[] = []): Element => h(tag, {}, children)

  const processNode = (c: ElementContent) => {
    if (c.type === "text") return c.value
    if (c.type === "element")
      return [c.tagName, c.children?.map((cc) => (cc.type === "text" ? cc.value : "")) ?? []]
    return ["", []]
  }

  it.each([
    ["single paragraph", el("p", ["text"]), [["p", ["text"]]]],
    ["direct text content", el("div", ["text"]), [["div", ["text"]]]],
    [
      "multiple paragraphs",
      el("div", [el("p", ["p1"]), el("p", ["p2"])]),
      [
        ["p", ["p1"]],
        ["p", ["p2"]],
      ],
    ],
    ["nested paragraphs", el("div", [el("div", [el("p", ["nested"])])]), [["p", ["nested"]]]],
    [
      "mixed content",
      el("div", [el("p", ["p1"]), el("span", ["text"]), el("p", ["p2"])]),
      [
        ["p", ["p1"]],
        ["span", ["text"]],
        ["p", ["p2"]],
      ],
    ],
    [
      "mixed text and elements",
      el("p", ["before ", el("em", ["em"]), " after"]),
      [["p", ["before ", ["em", ["em"]], " after"]]],
    ],
    ["empty element", el("div"), []],
  ])("collects elements from %s", (_, input, expected) => {
    const result = collectTransformableElements(input, toSkip)
    expect(result.map((node) => [node.tagName, node.children.map(processNode)])).toEqual(expected)
  })
})

describe("identifyLinkNode", () => {
  // Helper function to create element nodes with proper typing
  const createNode = (tagName: string, children: Element[] = []): Element =>
    h(tagName, {}, children)

  // Test cases structure: [description, input node, expected result]
  const testCases: [string, Element, Element][] = [
    ["direct link node", createNode("a"), createNode("a")],
    ["nested link node", createNode("em", [createNode("a")]), createNode("a")],
    [
      "deeply nested link node",
      createNode("div", [createNode("em", [createNode("strong", [createNode("a")])])]),
      createNode("a"),
    ],

    [
      "multiple links (should return last)",
      createNode("div", [createNode("a"), createNode("a")]),
      createNode("a"),
    ],
    [
      "complex nested structure",
      createNode("div", [
        createNode("span"),
        createNode("em", [createNode("strong"), createNode("i", [createNode("a")])]),
      ]),
      createNode("a"),
    ],
  ]

  it.each(testCases)("should handle %s", (_, input, expected) => {
    const result = identifyLinkNode(input)
    expect(result?.tagName).toBe(expected.tagName)
  })

  it("should handle non-link node without children", () => {
    const node = createNode("div")
    expect(identifyLinkNode(node)).toBeNull()
  })

  it("should handle empty children array", () => {
    const node = createNode("div")
    node.children = []
    expect(identifyLinkNode(node)).toBeNull()
  })

  it("should handle no link found", () => {
    const node = createNode("div", [createNode("span"), createNode("em"), createNode("strong")])
    expect(identifyLinkNode(node)).toBeNull()
  })
})

describe("moveQuotesBeforeLink", () => {
  it.each([
    // Basic cases
    [{ type: "text", value: 'Text "' }, h("a", {}, "Link"), true, "Text ", '"Link'],
    // Nested elements case
    [
      { type: "text", value: 'Text "' },
      h("a", {}, [h("code", {}, "Link")]),
      true,
      "Text ",
      '"', // Don't move quotes into nested elements
    ],
    // No quotes case
    [{ type: "text", value: "Text " }, h("a", {}, "Link"), false, "Text ", "Link"],
    // Smart quotes
    [{ type: "text", value: 'Text "' }, h("a", {}, "Link"), true, "Text ", '"Link'],
    // Single quotes
    [{ type: "text", value: "Text '" }, h("a", {}, "Link"), true, "Text ", "'Link"],
    // Empty link
    [{ type: "text", value: 'Text "' }, h("a"), true, "Text ", '"'],
    // Multiple nested elements
    [
      { type: "text", value: 'Text "' },
      h("a", {}, [h("em", {}, [h("strong", {}, "Link")])]),
      true,
      "Text ",
      '"',
    ],
  ])(
    "should handle quotes before links correctly",
    (prevNode, linkNode, expectedReturn, expectedPrevValue, expectedFirstTextValue) => {
      const result = moveQuotesBeforeLink(prevNode as ElementContent, linkNode as Element)

      expect(result).toBe(expectedReturn)
      expect(prevNode.value).toBe(expectedPrevValue)

      const firstChild = linkNode.children[0]
      expect(firstChild?.type === "text" ? (firstChild as Text).value : undefined).toBe(
        expectedFirstTextValue,
      )
    },
  )

  it("should handle undefined previous node", () => {
    const linkNode = h("a", {}, "Link")
    const result = moveQuotesBeforeLink(undefined, linkNode)
    expect(result).toBe(false)
  })

  it("should handle non-text previous node", () => {
    const prevNode = h("span")
    const linkNode = h("a", {}, "Link")
    const result = moveQuotesBeforeLink(prevNode as ElementContent, linkNode)
    expect(result).toBe(false)
  })
})

describe("getFirstTextNode", () => {
  it.each([
    // Direct text node
    [h("a", {}, "Simple text"), "Simple text"],
    // Nested text node
    [h("a", {}, [h("em", {}, "Nested text")]), "Nested text"],
    // Multiple children with text first
    [h("a", {}, ["First text", h("em", {}, "Second text")]), "First text"],
    // Deeply nested structure
    [h("div", {}, [h("span", {}, [h("em", {}, "Deep text")])]), "Deep text"],
    // Non-text first child
    [h("a", {}, [h("br"), "After break"]), "After break"],
    // Mixed content
    [h("p", {}, [h("strong", {}, "Bold"), " normal", h("em", {}, "emphasis")]), "Bold"],
  ])("should find first text node in %#", (input, expected) => {
    const result = getFirstTextNode(input)
    expect(result?.type).toBe("text")
    expect(result?.value).toBe(expected)
  })

  it.each([
    // Empty element
    [h("a"), null],
    // Element with empty children array
    [h("a", {}, []), null],
  ])("should handle %s", (input, expected) => {
    const result = getFirstTextNode(input)
    expect(result).toBe(expected)
  })

  it("should handle undefined/null input", () => {
    expect(getFirstTextNode(undefined as unknown as Parent)).toBeNull()
    expect(getFirstTextNode(null as unknown as Parent)).toBeNull()
  })

  it("should handle non-element nodes", () => {
    const textNode = { type: "text", value: "Just text" } as unknown as Text
    expect(getFirstTextNode(textNode as unknown as Parent)?.value).toBe("Just text")
  })
})

describe("replaceFractions", () => {
  it.each([
    [{ type: "text", value: "1/2" }, h("p"), '<span class="fraction">1/2</span>'],
    [{ type: "text", value: "3/4" }, h("p"), '<span class="fraction">3/4</span>'],

    // Fractions with surrounding text
    [
      { type: "text", value: "There are 1/2 left" },
      h("p"),
      'There are <span class="fraction">1/2</span> left',
    ],
    [{ type: "text", value: "Mix 2/3 cups" }, h("p"), 'Mix <span class="fraction">2/3</span> cups'],

    // Edge cases
    // Dates should not be converted
    [{ type: "text", value: "01/01/2024" }, h("p"), "01/01/2024"],
    // URLs should not be converted
    [
      { type: "text", value: "https://example.com/path" },
      h("a", { href: "https://example.com/path" }),
      "https://example.com/path",
    ],
    // Decimal fractions should not be converted
    [{ type: "text", value: "3.5/2" }, h("p"), "3.5/2"],
    // Multiple fractions in one text
    [
      { type: "text", value: "Mix 1/2 and 3/4 cups" },
      h("p"),
      'Mix <span class="fraction">1/2</span> and <span class="fraction">3/4</span> cups',
    ],

    // More complicated fractions
    [
      { type: "text", value: "233/250, 22104/4024" },
      h("p"),
      '<span class="fraction">233/250</span>, <span class="fraction">22104/4024</span>',
    ],

    // Fraction with ordinal suffix
    [
      { type: "text", value: "1/4th" },
      h("p"),
      '<span class="fraction">1/4</span><sup class="ordinal-suffix">th</sup>',
    ],
    [
      { type: "text", value: "1/30th" },
      h("p"),
      '<span class="fraction">1/30</span><sup class="ordinal-suffix">th</sup>',
    ],

    // Skip nodes with fraction class
    [{ type: "text", value: "1/2" }, h("span", { className: ["fraction"] }), "1/2"],

    // Skip code blocks
    [{ type: "text", value: "1/2" }, h("code"), "1/2"],
  ])("should handle fractions correctly", (node, parent, expected) => {
    const parentNode = h(parent.tagName, parent.properties, [...parent.children, node as Text])
    const parentString = hastToHtml(parentNode)

    const processedHtml = testHtmlFormattingImprovement(parentString)

    // If eg class is added, we need to add it to the expected html
    const parentClassInfo = parent.properties.className
      ? ` class="${parent.properties.className}"`
      : ""
    const parentHrefInfo = parent.properties.href ? ` href="${parent.properties.href}"` : ""
    const expectedHtml = `<${parent.tagName}${parentClassInfo}${parentHrefInfo}>${expected}</${parent.tagName}>`
    expect(normalizeNbsp(processedHtml)).toBe(expectedHtml)
  })

  it("should preserve surrounding whitespace", () => {
    const node = { type: "text", value: " 1/2 " } as Text
    const parent = h("p")
    replaceFractions(node, 0, parent, [])
    const processedHtml = testHtmlFormattingImprovement(`<p>${node.value}</p>`)
    expect(normalizeNbsp(processedHtml)).toBe('<p> <span class="fraction">1/2</span> </p>')
  })

  it("should handle multiple fractions in complex text", () => {
    const node = {
      type: "text",
      value: "Mix 1/2 cup of flour with 3/4 cup of water",
    } as Text
    const parent = h("p")
    replaceFractions(node, 0, parent, [])
    const processedHtml = testHtmlFormattingImprovement(`<p>${node.value}</p>`)
    expect(normalizeNbsp(processedHtml)).toBe(
      '<p>Mix <span class="fraction">1/2</span> cup of flour with <span class="fraction">3/4</span> cup of water</p>',
    )
  })

  it("should handle undefined index parameter and use fallback value", () => {
    // This test specifically targets the `index ?? 0` branch in replaceFractions
    // Create a parent with the text node at index 0
    const node = { type: "text", value: "Mix 1/2 cup flour" } as Text
    const parent = h("p", [node])

    // Store the original parent state for comparison
    const originalChildrenCount = parent.children.length
    const originalTextContent = hastToHtml(parent)

    // Call replaceFractions with undefined index - should use fallback 0
    replaceFractions(node, undefined, parent, [])

    // Verify the function processed the fraction correctly despite undefined index
    const result = hastToHtml(parent)

    // Should have converted 1/2 to a fraction span
    expect(result).toContain('<span class="fraction">1/2</span>')
    expect(result).toContain("Mix")
    expect(result).toContain("cup flour")

    // Should have replaced the original text node with multiple nodes
    expect(parent.children.length).toBeGreaterThan(originalChildrenCount)

    // Verify the transformation actually happened
    expect(result).not.toBe(originalTextContent)
  })

  describe("FRACTION_SKIP_TAGS", () => {
    it.each(FRACTION_SKIP_TAGS)("should not convert fractions inside <%s> elements", (tagName) => {
      // Skip 'a' tag test here since it needs href, test separately
      if (tagName === "a") return

      const input = `<${tagName}>1/2</${tagName}>`
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    it("should not convert fractions inside <a> elements (to preserve URLs)", () => {
      const input = '<a href="https://example.com/page/1/2">link with 1/2</a>'
      const processedHtml = testHtmlFormattingImprovement(input)
      // Should NOT convert the 1/2 to a fraction
      expect(processedHtml).not.toContain('<span class="fraction">')
      expect(processedHtml).toContain("1/2")
    })
  })
})

describe("transformElement error conditions", () => {
  it("should not throw when node has no children", () => {
    const nodeWithoutChildren = h("div") as Element
    nodeWithoutChildren.children = undefined as unknown as Element["children"]

    const transform = (text: string) => text.toUpperCase()

    expect(() => {
      transformElement(nodeWithoutChildren, transform, () => false, markerChar)
    }).not.toThrow()
  })

  it("should throw error when transformation alters number of text nodes", () => {
    const node = h("p", "hello world")

    // This transform will split the text, altering the number of fragments
    const transform = (text: string): string =>
      text.replace("hello", `hello${markerChar}extra${markerChar}`)

    expect(() => {
      transformElement(node, transform, () => false, markerChar)
    }).toThrow("Transformation altered the number of text nodes")
  })
})

describe("applyTextTransforms function", () => {
  it("should apply all text transformations", () => {
    const input = "The data are i.i.d. and it's -5x larger than github... So naive!"
    const expected = "The data are IID and it’s −5× larger than GitHub… So naïve!"

    const result = applyTextTransforms(input)
    expect(result).toBe(expected)
  })

  it("should handle empty string", () => {
    const result = applyTextTransforms("")
    expect(result).toBe("")
  })

  it("should handle text with slashes", () => {
    const input = "dog/cat and h/t John"
    const expected = "dog / cat and h/t John"

    const result = applyTextTransforms(input)
    expect(result).toBe(expected)
  })
})

describe("Ordinal Suffixes", () => {
  it.each([
    // Basic ordinal cases
    [
      "<p>1st place</p>",
      '<p><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup> place</p>',
    ],
    [
      "<p>2nd prize</p>",
      '<p><span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup> prize</p>',
    ],
    [
      "<p>3rd time</p>",
      '<p><span class="ordinal-num">3</span><sup class="ordinal-suffix">rd</sup> time</p>',
    ],
    [
      "<p>4th quarter</p>",
      '<p><span class="ordinal-num">4</span><sup class="ordinal-suffix">th</sup> quarter</p>',
    ],

    // Multiple ordinals in one text
    [
      "<p>1st place and 2nd place</p>",
      '<p><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup> place and <span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup> place</p>',
    ],

    // Larger numbers
    [
      "<p>21st century</p>",
      '<p><span class="ordinal-num">21</span><sup class="ordinal-suffix">st</sup> century</p>',
    ],
    [
      "<p>42nd street</p>",
      '<p><span class="ordinal-num">42</span><sup class="ordinal-suffix">nd</sup> street</p>',
    ],
    [
      "<p>103rd floor</p>",
      '<p><span class="ordinal-num">103</span><sup class="ordinal-suffix">rd</sup> floor</p>',
    ],

    // Numbers with commas
    [
      "<p>1,000th visitor</p>",
      '<p><span class="ordinal-num">1,000</span><sup class="ordinal-suffix">th</sup> visitor</p>',
    ],

    // Edge cases
    [
      "<p>11th, 12th, and 13th</p>", // Special cases that always use 'th'
      '<p><span class="ordinal-num">11</span><sup class="ordinal-suffix">th</sup>, <span class="ordinal-num">12</span><sup class="ordinal-suffix">th</sup>, and <span class="ordinal-num">13</span><sup class="ordinal-suffix">th</sup></p>',
    ],

    // Cases that should not be transformed
    ["<pre>1st</pre>", "<pre>1st</pre>"], // Preformatted text
    ["<code>1st place</code>", "<code>1st place</code>"], // Inside code block
  ])("correctly formats ordinal suffixes in %s", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it("handles nested elements correctly", () => {
    const input = "<p><em>1st</em> and <strong>2nd</strong></p>"
    const expected =
      '<p><em><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup></em> and <strong><span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup></strong></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it("respects no-formatting class", () => {
    const input = '<p class="no-formatting">1st place</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(input)
  })

  it("handles ordinals at start and end of text", () => {
    const input = "<p>1st. End with 2nd.</p>"
    const expected =
      '<p><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup>. End with <span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup>.</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })

  it("handles ordinals with surrounding punctuation", () => {
    const input = "<p>(1st) [2nd] {3rd}</p>"
    const expected =
      '<p>(<span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup>) [<span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup>] {<span class="ordinal-num">3</span><sup class="ordinal-suffix">rd</sup>}</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(normalizeNbsp(processedHtml)).toBe(expected)
  })
})

describe("improveFormatting function with options", () => {
  it("should use default options when none provided", () => {
    // This helper always passes some options to rehype; the true "no options" case is covered
    // by the direct transformer invocation test below.
    const input = "<article><p>Test text</p></article>"

    const processedHtml = testHtmlFormattingImprovement(input, true)
    expect(normalizeNbsp(processedHtml)).toBe(input)
  })

  it("should accept custom options and skip first letter when requested", () => {
    const input = "<article><p>Test text</p></article>"

    const processedHtml = testHtmlFormattingImprovement(input, true)
    expect(normalizeNbsp(processedHtml)).toBe(input) // Should not add data-first-letter
  })

  it("should handle undefined options (default parameter branch)", () => {
    // Test that calling improveFormatting() without options uses default behavior
    const transformer = improveFormatting() // Called without options, hits default {} branch

    const tree = {
      type: "root" as const,
      children: [h("p", "Test 1/2 content with -> arrow")],
    }

    const mockFile = new VFile("")
    mockFile.data = {}

    // Transform should work with default options (including first letter processing)
    transformer(tree, mockFile, () => {
      /* noop */
    })

    const paragraph = tree.children[0] as Element
    paragraph.properties = paragraph.properties ?? {}
    const resultHtml = hastToHtml(paragraph)

    // Should have first letter attribute (default behavior)
    expect(paragraph.properties["data-first-letter"]).toBe("T")

    // Should have transformed fraction and arrow
    expect(resultHtml).toContain('<span class="fraction">1/2</span>')
    expect(resultHtml).toContain('<span class="right-arrow">⭢</span>')
  })
})

describe("HTMLFormattingImprovement plugin", () => {
  it("should return correct plugin object with name", () => {
    const plugin = HTMLFormattingImprovement()

    expect(plugin.name).toBe("htmlFormattingImprovement")
    expect(plugin.htmlPlugins).toBeDefined()
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it("should return improveFormatting in htmlPlugins array", () => {
    const plugin = HTMLFormattingImprovement()

    const mockCtx = {} as unknown
    expect(plugin.htmlPlugins).toBeDefined()

    let valueToCheck
    if (plugin.htmlPlugins) {
      valueToCheck = plugin.htmlPlugins(
        mockCtx as Parameters<NonNullable<typeof plugin.htmlPlugins>>[0],
      )
    }
    expect(valueToCheck).toEqual([improveFormatting])
  })

  describe("Unicode Arrow Wrapping", () => {
    // Test each arrow individually
    it.each(arrowsToWrap.map((arrow) => [arrow]))(
      "should wrap %s arrow with monospace styling",
      (arrow) => {
        const input = `<p>Text ${arrow} more text</p>`
        const expected = `<p>Text <span class="monospace-arrow">${arrow}</span> more text</p>`
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      },
    )

    // Test that arrows are NOT wrapped in various contexts
    const ignoreTags = ["code", "pre", "script", "style"]
    it.each(
      ignoreTags.flatMap((tag) => arrowsToWrap.map((arrow) => [tag, arrow] as [string, string])),
    )("should NOT wrap %s arrow inside <%s> tag", (tag, arrow) => {
      const input = `<${tag}>x ${arrow} y</${tag}>`
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(input)
    })

    it.each(arrowsToWrap.map((arrow) => [arrow]))(
      "should NOT wrap %s arrow inside KaTeX blocks",
      (arrow) => {
        const input = `<p><span class="katex">f: X ${arrow} Y</span></p>`
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(input)
      },
    )

    it.each(arrowsToWrap.map((arrow) => [arrow]))(
      "should NOT wrap %s arrow inside nested KaTeX elements",
      (arrow) => {
        const input = `<p><span class="katex"><span class="katex-html"><span class="base">f: X ${arrow} Y</span></span></span></p>`
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(input)
      },
    )

    it.each(arrowsToWrap.map((arrow) => [arrow]))(
      "should wrap %s arrow outside KaTeX but not inside",
      (arrow) => {
        const input = `<p>Consider <span class="katex">f: A ${arrow} B</span> which maps ${arrow} left</p>`
        const expected = `<p>Consider <span class="katex">f: A ${arrow} B</span> which maps <span class="monospace-arrow">${arrow}</span> left</p>`
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(normalizeNbsp(processedHtml)).toBe(expected)
      },
    )

    it("should wrap multiple different arrows in the same paragraph", () => {
      const input = "<p>First → second ← third ↑ fourth ↓</p>"
      const expected =
        '<p>First <span class="monospace-arrow">→</span> second <span class="monospace-arrow">←</span> third <span class="monospace-arrow">↑</span> fourth <span class="monospace-arrow">↓</span></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })

    it("should handle mixed content with KaTeX and regular arrows", () => {
      const input =
        '<p>The mapping <span class="katex">π: C → A</span> shows that → arrows work differently</p>'
      const expected =
        '<p>The mapping <span class="katex">π: C → A</span> shows that <span class="monospace-arrow">→</span> arrows work differently</p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(normalizeNbsp(processedHtml)).toBe(expected)
    })
  })
})

describe("Non-breaking space insertion", () => {
  it.each([
    // After short words (1-2 letters) and before last word (widow prevention)
    ["<p>I love this</p>", `<p>I${NBSP}love${NBSP}this</p>`],
    ["<p>A cat sat on a mat</p>", `<p>A${NBSP}cat sat on${NBSP}a${NBSP}mat</p>`],
    // Before last word (widow prevention)
    ["<p>Hello world</p>", `<p>Hello${NBSP}world</p>`],
    // Between numbers and units
    ["<p>Run 5 km daily</p>", `<p>Run 5${NBSP}km${NBSP}daily</p>`],
    ["<p>It weighs 10 kg</p>", `<p>It${NBSP}weighs 10${NBSP}kg</p>`],
    // After reference abbreviations
    ["<p>See Fig. 3 for details</p>", `<p>See Fig.${NBSP}3 for${NBSP}details</p>`],
    ["<p>Found on p. 42</p>", `<p>Found on${NBSP}p.${NBSP}42</p>`],
  ])("inserts nbsp in %s", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })

  it("does not insert nbsp in code blocks", () => {
    const input = "<pre><code>I love this</code></pre>"
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).not.toContain(NBSP)
  })

  it("does not affect applyTextTransforms (titles, TOC, etc.)", () => {
    const result = applyTextTransforms("I love this thing")
    expect(result).not.toContain(NBSP)
  })
})
