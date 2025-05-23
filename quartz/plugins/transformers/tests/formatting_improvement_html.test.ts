import { describe, it, expect, test } from "@jest/globals"
import { type Element, type ElementContent, type Parent, type Text } from "hast"
import { toHtml as hastToHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { rehype } from "rehype"

import {
  hyphenReplace,
  niceQuotes,
  massTransformText,
  getTextContent,
  flattenTextNodes,
  improveFormatting,
  spacesAroundSlashes,
  transformElement,
  assertSmartQuotesMatch,
  enDashNumberRange,
  CHARS_TO_MOVE_INTO_LINK_FROM_RIGHT,
  minusReplace,
  l_pRegex,
  collectTransformableElements,
  enDashDateRange,
  identifyLinkNode,
  moveQuotesBeforeLink,
  getFirstTextNode,
  replaceFractions,
  timeTransform,
} from "../formatting_improvement_html"
import { hasClass } from "../utils"

function testHtmlFormattingImprovement(
  inputHTML: string,
  skipFirstLetter = true,
  doNotSetFirstLetterAttribute = false,
) {
  const options = doNotSetFirstLetterAttribute ? {} : { skipFirstLetter }
  if (!inputHTML.trim().startsWith("<")) {
    throw new Error("Input HTML must start with an HTML tag")
  }
  return rehype()
    .data("settings", { fragment: true })
    .use(improveFormatting, options)
    .processSync(inputHTML)
    .toString()
}

describe("HTMLFormattingImprovement", () => {
  describe("Quotes", () => {
    it.each([
      ['"This is a quote", she said.', "“This is a quote”, she said."],
      ['"aren\'t "groups of functions". ', "“aren’t “groups of functions.” "],
      ['"This is a quote," she said.', "“This is a quote”, she said."],
      ['"This is a quote!".', "“This is a quote!”."],
      ['"This is a quote?".', "“This is a quote?”."],
      ['"This is a quote..." he trailed off.', "“This is a quote...” he trailed off."],
      ['She said, "This is a quote."', "She said, “This is a quote.”"],
      ['"Hello." Mary', "“Hello.” Mary"],
      ['"Hello." (Mary)', "“Hello.” (Mary)"],
      ["He said, 'Hi'", "He said, ‘Hi’"],
      ['"I am" so "tired" of "these" "quotes".', "“I am” so “tired” of “these” “quotes.”"],
      ['"world model";', "“world model”;"],
      ['"party"/"wedding."', "“party”/“wedding.”"],
      ['"Hi \'Trout!"', "“Hi ’Trout!”"],
      ["“scope insensitivity”", "“scope insensitivity”"],
      [
        "strategy s's return is good, even as d's return is bad",
        "strategy s’s return is good, even as d’s return is bad",
      ],
      ["He wanted 'power.'", "He wanted ‘power.’"], // Test end of line
      [
        '"how many ways can this function be implemented?".',
        "“how many ways can this function be implemented?”.",
      ],
      ['SSL.")', "SSL.”)"],
      ["can't multiply\"?", "can’t multiply”?"],
      ["I'd", "I’d"],
      ["I don't'nt want to go", "I don’t’nt want to go"],
      ['with "scope insensitivity":', "with “scope insensitivity”:"],
      ['("the best")', "(“the best”)"],
      ['"\'sup"', "“’sup”"], // Apostrophes always point down
      ["'SUP", "’SUP"],
      ["Rock 'n' Roll", "Rock ’n’ Roll"],
      ["I was born in '99", "I was born in ’99"],
      ["'99 tigers weren't a match", "’99 tigers weren’t a match"],
      ["I'm not the best, haven't you heard?", "I’m not the best, haven’t you heard?"],
      ["Hey, 'sup 'this is a single quote'", "Hey, ’sup ‘this is a single quote’"],
      ["'the best',", "‘the best’,"],
      ["'I lost the game.'", "‘I lost the game.’"],
      ["I hate you.'\"", "I hate you.’”"],
      ['"This is a quote"...', "“This is a quote”..."],
      ['He said, "This is a quote"...', "He said, “This is a quote”..."],
      ["The 'function space')", "The ‘function space’)"],
      ["The 'function space'—", "The ‘function space’—"],
      ['"... What is this?"', "“... What is this?”"],
      ['"/"', "“/”"],
      ['"Game"/"Life"', "“Game”/“Life”"],
      ['"Test:".', "“Test:”."],
      ['"Test...".', "“Test...”."],
      ['"To maximize reward…".', "“To maximize reward…”."],
      ['"Test"s', "“Test”s"],
      ['not confident in that plan - "', "not confident in that plan - ”"],
      ["What do you think?']", "What do you think?’]"],
      ["\"anti-'survival incentive' incentive\"", "“anti-‘survival incentive’ incentive”"],
      ["('survival incentive')", "(‘survival incentive’)"],
    ])('should fix quotes in "%s"', (input, expected) => {
      const processedHtml = niceQuotes(input)
      expect(processedHtml).toBe(expected)
    })

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
        '<dl><dd>Multipliers like “2×” are 2× more pleasant than “<span class="no-formatting">2x</span>.” </dd></dl>',
      ],
      [
        '<p>Suppose you tell me, "<code>TurnTrout</code>", we definitely</p>',
        "<p>Suppose you tell me, “<code>TurnTrout</code>”, we definitely</p>",
      ],
      [
        '<div><p>not confident in that plan - "</p><p>"Why not? You were the one who said we should use the AIs in the first place! Now you don’t like this idea?” she asked, anger rising in her voice.</p></div>',
        "<div><p>not confident in that plan—”</p><p>“Why not? You were the one who said we should use the AIs in the first place! Now you don’t like this idea?” she asked, anger rising in her voice.</p></div>",
      ],
      [
        "<div><div></div><div><p><strong>small voice.</strong></p><p><strong>'I will take the Ring’, he</strong> <strong>said, ‘though I do not know the way.’</strong></p></div></div>",
        "<div><div></div><div><p><strong>small voice.</strong></p><p><strong>‘I will take the Ring’, he</strong> <strong>said, ‘though I do not know the way.’</strong></p></div></div>",
      ],
      [
        "<article><blockquote><div>Testestes</div><div><p><strong>small voice.</strong></p><p><strong>'I will take the Ring', he</strong> <strong>said, 'though I do not know the way.'</strong></p></div></blockquote></article>",
        "<article><blockquote><div>Testestes</div><div><p><strong>small voice.</strong></p><p><strong>‘I will take the Ring’, he</strong> <strong>said, ‘though I do not know the way.’</strong></p></div></blockquote></article>",
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
      expect(processedHtml).toBe(expected)
    })

    it.each([['<p><br>"Unicorn"<br></p>', "<p><br>“Unicorn”<br></p>"]])(
      "should handle quotes in DOM",
      (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(input)
        expect(processedHtml).toBe(expected)
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
      expect(processedHtml).toBe(input)
    })

    const mathHTML = `<p><span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord text"><span class="mord">return</span></span><span class="mopen">(</span><span class="mord mathnormal">s</span><span class="mclose">)</span></span></span></span> averages strategy <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">s</span></span></span></span>'s return over the first state being cooperate <code>c</code> and being defect <code>d</code>. <a href="#user-content-fnref-5" data-footnote-backref="" aria-label="Back to reference 6" class="data-footnote-backref internal">↩</a></p>`

    const targetMathHTML =
      '<p><span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mord text"><span class="mord">return</span></span><span class="mopen">(</span><span class="mord mathnormal">s</span><span class="mclose">)</span></span></span></span> averages strategy <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">s</span></span></span></span>’s return over the first state being cooperate <code>c</code> and being defect <code>d</code>. <a href="#user-content-fnref-5" data-footnote-backref="" aria-label="Back to reference 6" class="data-footnote-backref internal">↩</a></p>'

    it("should handle apostrophe right after math mode", () => {
      const processedHtml = testHtmlFormattingImprovement(mathHTML)
      expect(processedHtml).toBe(targetMathHTML)
    })

    const codeBlocks = [
      '<code><span>This is a plain "code block" without a language specified.</span></code>',
      '<figure><code><span>This is a plain "code block" without a language specified.</span></code></figure>',
    ]
    it.each(codeBlocks)("should ignore quotes in code blocks", (input) => {
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(processedHtml).toBe(input)
    })

    const originalHeader =
      '<h3 id="optimal-policy--reinforcement-maximizing-policy"><del>"Optimal policy"</del> → "Reinforcement-maximizing policy"</h3>'
    const targetHeader =
      '<h3 id="optimal-policy--reinforcement-maximizing-policy"><del>“Optimal policy”</del> → “Reinforcement-maximizing policy”</h3>'
    it("should handle quotes in headers", () => {
      const processedHtml = testHtmlFormattingImprovement(originalHeader)
      expect(processedHtml).toBe(targetHeader)
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
      expect(processedHtml).toBe(expected)
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

      // Should not change
      ["‘cat’ / ‘dog’", "‘cat’ / ‘dog’"],
      ["h/t John", "h/t John"],
    ]

    it.each(testCases)("should add spaces around '/' in %s", (input: string, expected: string) => {
      const processedHtml = spacesAroundSlashes(input)
      expect(processedHtml).toBe(expected)
    })

    it.each(testCases)(
      "should add spaces around '/' in an HTML context: %s",
      (input: string, expected: string) => {
        const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
        expect(processedHtml).toBe(`<p>${expected}</p>`)
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
        expect(processedHtml).toBe(expected)
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
        expect(processedHtml).toBe(inputElement)
      })
    }

    it.each([["https://dog"], ["https://dog/cat"]])(
      "should not add spaces around '/' in <a> %s",
      (input: string) => {
        const inputElement = `<p><a href="${input}">${input}</a></p>`
        const processedHtml = testHtmlFormattingImprovement(inputElement)
        expect(processedHtml).toBe(inputElement)
      },
    )
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
      expect(processedHtml).toBe(expected)
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
      expect(processedHtml).toBe(`<p>${expected}</p>`)
    })

    it.each(timeCases)("direct testing of the timeTransform function", (input, expected) => {
      const processedHtml = timeTransform(input)
      expect(processedHtml).toBe(expected)
    })
  })

  describe("Mass transforms", () => {
    it.each([
      ["There are 1 != 2 left.", "There are 1 ≠ 2 left."],
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
      ["5x1", "5×1"],
      ["regex", "RegEx"],
      ["regexpressions", "regexpressions"],
      ["Who are you...?", "Who are you…?"],
      ["Who are you...what do you want?", "Who are you… what do you want?"],
      ["Chateau", "Château"],
      ["chateau", "château"],
      ["github", "GitHub"],
      ["GitHub", "GitHub"],
      ["I went to github", "I went to GitHub"],
      ["voilà", "voilà"],
      ["Voilà", "Voilà"],
      ["and then, voila!", "and then, voilà!"],
    ])("should perform transforms for %s", (input: string, expected: string) => {
      const result = massTransformText(input)
      expect(result).toBe(expected)
    })

    it.each([
      ["I have 3x apples and 5x oranges.", "I have 3× apples and 5× oranges."],
      ["The word 'box' should not be changed.", "The word 'box' should not be changed."],
      ["-5x is negative.", "-5× is negative."], // Negative numbers
      ["3.14x pi is fun.", "3.14× pi is fun."], // Decimals
      ["5*5 area", "5×5 area"], // Asterisk
      ["12345x is a big number.", "12345× is a big number."], // Large numbers
      ["0.001x is small.", "0.001× is small."], // Small numbers
      ["I have 2x apples and 1.5x oranges.", "I have 2× apples and 1.5× oranges."], // Combined cases
      ["This is 3x larger.", "This is 3× larger."], // HTML context
    ])("correctly handles '%s'", (input, expected) => {
      const result = massTransformText(input)
      expect(result).toBe(expected)
    })

    it("doesn't replace 'x' in words", () => {
      const input = "The word 'box' should not be changed."
      const result = massTransformText(input)
      expect(result).toBe(input) // No change expected
    })
  })

  describe("Ampersand replacement", () => {
    it.each([["<p>There I saw him+her.</p>", "<p>There I saw him &#x26; her.</p>"]])(
      "should replace + with & in %s",
      (input: string, expected: string) => {
        const result = testHtmlFormattingImprovement(input)
        expect(result).toBe(expected)
      },
    )
  })

  describe("Hyphens", () => {
    it.each([
      ["This is a - hyphen.", "This is a—hyphen."],
      ["This is an — em dash.", "This is an—em dash."],
      ["word — word", "word—word"],
      ["word— word", "word—word"],
      ["word —word", "word—word"],
      ['"I love dogs." - Me', '"I love dogs." — Me'],
      ["- Me", "— Me"], // Don't delete space after dash at the start of a line
      ["-- Me", "— Me"],
      ["Hi-- what do you think?", "Hi—what do you think?"],
      [
        "—such behaviors still have to be retrodicted",
        "—such behaviors still have to be retrodicted",
      ], // Don't delete space after dash at the start of a line
      ["\n---\n", "\n---\n"], // Retain horizontal rules
      ["emphasis” —", "emphasis”—"], // small quotations should not retain space
      ["- First level\n - Second level", "— First level\n - Second level"], // Don't replace hyphens in lists, first is ok
      ["> - First level", "> - First level"], // Quoted unordered lists should not be changed
      [
        "reward… — [Model-based RL, Desires, Brains, Wireheading](https://www.alignmentforum.org/posts/K5ikTdaNymfWXQHFb/model-based-rl-desires-brains-wireheading#Self_aware_desires_1__wireheading)",
        "reward… — [Model-based RL, Desires, Brains, Wireheading](https://www.alignmentforum.org/posts/K5ikTdaNymfWXQHFb/model-based-rl-desires-brains-wireheading#Self_aware_desires_1__wireheading)",
      ], // Don't condense em dashes right after ellipses
      ["a browser- or OS-specific fashion", "a browser- or OS-specific fashion"], // Retain hyphen in compound words
      ["since--as you know", "since—as you know"], // Replace double+ hyphens in words with em dash
    ])('should replace hyphens in "%s"', (input, expected) => {
      const result = hyphenReplace(input)
      expect(result).toBe(expected)
    })

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
      expect(processedHtml).toBe(expected)
    })

    test("replaces multiple dashes within words", () => {
      expect(hyphenReplace("Since--as you know")).toBe("Since—as you know")
      expect(hyphenReplace("word---another")).toBe("word—another")
    })

    test("handles dashes at the start of a line", () => {
      expect(hyphenReplace("- This is a list item")).toBe("— This is a list item")
      expect(hyphenReplace("--- Indented list item")).toBe("— Indented list item")
      expect(hyphenReplace("Line 1\n- Line 2")).toBe("Line 1\n— Line 2")
    })

    test("removes spaces around em dashes", () => {
      expect(hyphenReplace("word — another")).toBe("word—another")
      expect(hyphenReplace("word—  another")).toBe("word—another")
      expect(hyphenReplace("word  —another")).toBe("word—another")
    })

    test("handles em dashes at the start of a line", () => {
      expect(hyphenReplace("—Start of line")).toBe("— Start of line")
      expect(hyphenReplace("Line 1\n—Line 2")).toBe("Line 1\n— Line 2")
      expect(hyphenReplace("— Already correct")).toBe("— Already correct")
    })

    test("converts number ranges to en dashes", () => {
      expect(hyphenReplace("Pages 1-5")).toBe("Pages 1–5")
      expect(hyphenReplace("2000-2020")).toBe("2000–2020")
      expect(hyphenReplace("2018-2021. Then 1-3")).toBe("2018–2021. Then 1–3")
      expect(hyphenReplace("p.10-15")).toBe("p.10–15")
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
      transformElement(node, capitalize)

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
      ["1-2 and 3-4", "1–2 and 3–4"],
      ["from 5-10 to 15-20", "from 5–10 to 15–20"],
      ["1-2-3", "1–2-3"], // Only replace the first hyphen
      ["a-b", "a-b"], // Don't replace non-numeric ranges
      ["1a-2b", "1a-2b"], // Don't replace if not purely numeric
      ["a1-2b", "a1-2b"], // Don't replace if not purely numeric
      ["p. 206-207)", "p. 206–207)"], // ) should close out a word boundary
      ["Qwen1.5-1.8", "Qwen1.5-1.8"], // Don't replace if there's a decimal
    ]
    it.each([...testCases, ["1 - 2", "1 - 2"]])(
      'should replace hyphens with en dashes in number ranges: "%s"',
      (input, expected) => {
        const result = enDashNumberRange(input)
        expect(result).toBe(expected)
      },
    )

    it.each(testCases)(
      "should replace hyphens with en dashes in number ranges: %s (end-to-end)",
      (input, expected) => {
        const processedHtml = testHtmlFormattingImprovement(`<p>${input}</p>`)
        expect(processedHtml).toBe(`<p>${expected}</p>`)
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
      expect(processedHtml).toBe(expected)
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
      '<p><a href="https://example.com">Link”,</a></p>',
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
  const CHARS_TO_TEST = CHARS_TO_MOVE_INTO_LINK_FROM_RIGHT.filter(
    (char) => !['"', "'"].includes(char),
  )
  const generateLinkScenarios = () => {
    const basicScenarios = CHARS_TO_TEST.map((mark: string) => [
      `<p><a href="https://example.com">Link</a>${mark}</p>`,
      `<p><a href="https://example.com">Link${mark}</a></p>`,
    ])
    return [...basicScenarios, ...specialCases]
  }

  const linkScenarios = generateLinkScenarios()

  it.each(linkScenarios)("correctly handles link punctuation", (input, expected) => {
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })

  describe("Handles footnote links correctly", () => {
    it("should not modify footnote links", () => {
      const input = '<p>Sentence with footnote<a href="#user-content-fn-1">1</a>.</p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(processedHtml).toBe(input)
    })

    it("should modify regular links but not footnote links", () => {
      const input =
        '<p><a href="https://example.com">Link</a>. <a href="#user-content-fn-2">2</a>.</p>'
      const expected =
        '<p><a href="https://example.com">Link.</a> <a href="#user-content-fn-2">2</a>.</p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(processedHtml).toBe(expected)
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
      expect(processedHtml).toBe(expected)
    })
  })

  describe("Handles multiple links in a single string", () => {
    it("processes multiple links correctly", () => {
      const input =
        '<p>Check out <a href="https://example1.com">Link1</a>, and then <a href="https://example2.com">Link2</a>!</p>'
      const expected =
        '<p>Check out <a href="https://example1.com">Link1,</a> and then <a href="https://example2.com">Link2!</a></p>'
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(processedHtml).toBe(expected)
    })
  })

  describe("Doesn't modify non-link text", () => {
    it("leaves regular text unchanged", () => {
      const input = "<p>This is a regular sentence without any links.</p>"
      const processedHtml = testHtmlFormattingImprovement(input)
      expect(processedHtml).toBe(input)
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
    expect(processedHtml).toBe(expected)
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
  it("should set data-first-letter attribute on the first paragraph", () => {
    const input = `
      <h1>Title</h1>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    `
    const expected = `
      <h1>Title</h1>
      <p data-first-letter="F">First paragraph.</p>
      <p>Second paragraph.</p>
    `
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(processedHtml).toBe(expected)
  })

  it("should handle apostrophe as the second character", () => {
    const input = `
      <p>'Twas the night before Christmas.</p>
    `
    const expected = `
      <p data-first-letter="’">’Twas the night before Christmas.</p>
    `
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(processedHtml).toBe(expected)
  })

  it("should not modify when there are no paragraphs", () => {
    const input = `
      <h1>Title</h1>
      <div>Not a paragraph</div>
    `
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(processedHtml).toBe(input)
  })

  it("should only process the first paragraph in the document", () => {
    const input = `
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    `
    const expected = `
      <p data-first-letter="F">First paragraph.</p>
      <p>Second paragraph.</p>
    `
    const processedHtml = testHtmlFormattingImprovement(input, false)
    expect(processedHtml).toBe(expected)
  })

  it("set the attribute when skipFirstLetter is not in options", () => {
    const input = `
      <p>First paragraph.</p>
    `
    const expected = `
      <p data-first-letter="F">First paragraph.</p>
    `
    const processedHtml = testHtmlFormattingImprovement(input, false, true)
    expect(processedHtml).toBe(expected)
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
    expect(processedHtml).toBe(`<p>${expected}</p>`)
  })

  it("should handle multiple sups in complex HTML", () => {
    const input = "<p>First<sup>1</sup> and second <sup>2</sup> and third<sup>3</sup></p>"
    const expected = "<p>First<sup>1</sup> and second<sup>2</sup> and third<sup>3</sup></p>"
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })
})

describe("minusReplace", () => {
  it.each([
    ["The temperature is -5 degrees.", "The temperature is −5 degrees."],
    ["This is a well-known fact.", "This is a well-known fact."],
    ["The value is -3.14.", "The value is −3.14."],
    ["The value is - 3.", "The value is − 3."],
    ["Values are -1, -2, and -3.", "Values are −1, −2, and −3."],
    ["Use the -option flag.", "Use the -option flag."],
    ["(-3)", "(−3)"],
    ['"-3', '"−3'],
  ])("transforms '%s' to '%s'", (input, expected) => {
    expect(minusReplace(input)).toBe(expected)
  })

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
    expect(processedHtml).toBe(expected)
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
    expect(processedHtml).toBe(expected)
  })

  it("handles L-numbers at start of text", () => {
    const input = "<p>L1</p>"
    const expected = '<p>L<sub style="font-variant-numeric: lining-nums;">1</sub></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })

  it("handles L-numbers in nested elements", () => {
    const input = "<p><em>L1</em> and <strong>L2</strong></p>"
    const expected =
      '<p><em>L<sub style="font-variant-numeric: lining-nums;">1</sub></em> and <strong>L<sub style="font-variant-numeric: lining-nums;">2</sub></strong></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
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
    expect(processedHtml).toBe(expected)
  })
})

describe("hasClass", () => {
  test("handles string className", () => {
    const node = {
      type: "element",
      properties: { className: "test-class other-class" },
      tagName: "div",
      children: [],
    } as Element

    expect(hasClass(node, "test-class")).toBe(true)
    expect(hasClass(node, "other-class")).toBe(true)
    expect(hasClass(node, "missing-class")).toBe(false)
  })

  test("handles array className", () => {
    const node = {
      type: "element",
      properties: { className: ["test-class", "other-class"] },
      tagName: "div",
      children: [],
    } as Element

    expect(hasClass(node, "test-class")).toBe(true)
    expect(hasClass(node, "other-class")).toBe(true)
    expect(hasClass(node, "missing-class")).toBe(false)
  })

  test("handles missing properties", () => {
    const node = { type: "element" } as Element
    expect(hasClass(node, "any-class")).toBe(false)
  })

  test("handles null/undefined className", () => {
    const node = {
      type: "element",
      properties: { className: null },
      tagName: "div",
      children: [],
    } as Element

    expect(hasClass(node, "any-class")).toBe(false)
  })
})

describe("Date Range", () => {
  it.each([
    ["Jan-Mar", "Jan–Mar"],
    ["January-March", "January–March"],
    ["Aug-Dec", "Aug–Dec"],
    ["February-April", "February–April"],
    ["May-September", "May–September"],
    ["Oct-Dec 2023", "Oct–Dec 2023"],
    ["January-December", "January–December"],
    // Test cases that should not be modified
    ["Pre-existing", "Pre-existing"],
    ["non-month", "non-month"],
    ["May-be", "May-be"],
    ["March-ing", "March-ing"],
  ])('should handle date ranges in "%s"', (input, expected) => {
    const result = enDashDateRange(input)
    expect(result).toBe(expected)
  })

  it("should handle multiple date ranges in text", () => {
    const input = "Period Jan-Mar and Jul-Sep showed growth"
    const expected = "Period Jan–Mar and Jul–Sep showed growth"
    expect(enDashDateRange(input)).toBe(expected)
  })

  it("should preserve surrounding text", () => {
    const input = "The Jan-Mar quarter (Q1)"
    const expected = "The Jan–Mar quarter (Q1)"
    expect(enDashDateRange(input)).toBe(expected)
  })

  it("should handle end-to-end HTML formatting", () => {
    const input = "<p>Revenue from Jan-Mar exceeded Apr-Jun.</p>"
    const expected = "<p>Revenue from Jan–Mar exceeded Apr–Jun.</p>"
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })
})

describe("collectTransformableElements", () => {
  const el = (tag: string, children: (string | Element)[] = []): Element =>
    ({
      type: "element",
      tagName: tag,
      children: children.map((c) => (typeof c === "string" ? { type: "text", value: c } : c)),
    }) as Element

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
    const result = collectTransformableElements(input)
    expect(result.map((node) => [node.tagName, node.children.map(processNode)])).toEqual(expected)
  })
})

describe("identifyLinkNode", () => {
  // Helper function to create element nodes with proper typing
  const createNode = (tagName: string, children: Element[] = []): Element => ({
    type: "element",
    tagName,
    children,
    properties: {},
  })

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

    // For cases where we expect transformation
    const processedHtml = testHtmlFormattingImprovement(parentString)

    // If eg class is added, we need to add it to the expected html
    const parentClassInfo = parent.properties.className
      ? ` class="${parent.properties.className}"`
      : ""
    const parentHrefInfo = parent.properties.href ? ` href="${parent.properties.href}"` : ""
    const expectedHtml = `<${parent.tagName}${parentClassInfo}${parentHrefInfo}>${expected}</${parent.tagName}>`
    expect(processedHtml).toBe(expectedHtml)
  })

  it("should preserve surrounding whitespace", () => {
    const node = { type: "text", value: " 1/2 " } as Text
    const parent = h("p")
    replaceFractions(node, 0, parent)
    const processedHtml = testHtmlFormattingImprovement(`<p>${node.value}</p>`)
    expect(processedHtml).toBe('<p> <span class="fraction">1/2</span> </p>')
  })

  it("should handle multiple fractions in complex text", () => {
    const node = {
      type: "text",
      value: "Mix 1/2 cup of flour with 3/4 cup of water",
    } as Text
    const parent = h("p")
    replaceFractions(node, 0, parent)
    const processedHtml = testHtmlFormattingImprovement(`<p>${node.value}</p>`)
    expect(processedHtml).toBe(
      '<p>Mix <span class="fraction">1/2</span> cup of flour with <span class="fraction">3/4</span> cup of water</p>',
    )
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
    expect(processedHtml).toBe(expected)
  })

  it("handles nested elements correctly", () => {
    const input = "<p><em>1st</em> and <strong>2nd</strong></p>"
    const expected =
      '<p><em><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup></em> and <strong><span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup></strong></p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })

  it("respects no-formatting class", () => {
    const input = '<p class="no-formatting">1st place</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(input)
  })

  it("handles ordinals at start and end of text", () => {
    const input = "<p>1st. End with 2nd.</p>"
    const expected =
      '<p><span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup>. End with <span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup>.</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })

  it("handles ordinals with surrounding punctuation", () => {
    const input = "<p>(1st) [2nd] {3rd}</p>"
    const expected =
      '<p>(<span class="ordinal-num">1</span><sup class="ordinal-suffix">st</sup>) [<span class="ordinal-num">2</span><sup class="ordinal-suffix">nd</sup>] {<span class="ordinal-num">3</span><sup class="ordinal-suffix">rd</sup>}</p>'
    const processedHtml = testHtmlFormattingImprovement(input)
    expect(processedHtml).toBe(expected)
  })
})
