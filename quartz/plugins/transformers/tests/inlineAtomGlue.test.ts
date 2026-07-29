import { describe, expect, it } from "@jest/globals"
import { type Element, type Root, type Text } from "hast"
import { h } from "hastscript"

import {
  LEFT_DOUBLE_QUOTE,
  LEFT_SINGLE_QUOTE,
  NBSP,
  RIGHT_DOUBLE_QUOTE,
  RIGHT_GUILLEMET,
  RIGHT_SINGLE_QUOTE,
} from "../../../components/constants"
import {
  glueInlineAtoms,
  glueNodeSequence,
  InlineAtomGlue,
  isGlyphAtom,
  isNowrapSpan,
  splitLastGrapheme,
} from "../inlineAtomGlue"

const emoji = () => h("img", { className: ["emoji"], alt: "😀" })
const favicon = () => h("svg", { className: ["favicon"], "data-domain": "example_com" })
const sprite = () => h("img", { className: ["inline-img"], alt: "chevron sprite" })
const katex = () => h("span", { className: ["katex"] }, ["x"])
const text = (value: string): Text => ({ type: "text", value })
const glueSpan = (...children: (Text | Element)[]): Element => ({
  type: "element",
  tagName: "span",
  properties: { className: "nowrap-span" },
  children,
})

describe("isGlyphAtom", () => {
  it.each([
    ["an emoji img", emoji(), true],
    ["a favicon svg", favicon(), true],
    ["an authored sprite", sprite(), true],
    ["a bare figure image", h("img", { src: "/big.avif" }), false],
    ["a KaTeX span", katex(), false],
    ["a text node", text("hi"), false],
    ["undefined", undefined, false],
  ])("returns %s → %s", (_name, node, expected) => {
    expect(isGlyphAtom(node as Text | Element | undefined)).toBe(expected)
  })
})

describe("isNowrapSpan", () => {
  it.each([
    ["a glue span", glueSpan(text("a")), true],
    ["a plain span", h("span", ["a"]), false],
    ["a text node", text("a"), false],
  ])("returns %s → %s", (_name, node, expected) => {
    expect(isNowrapSpan(node as Text | Element)).toBe(expected)
  })
})

describe("splitLastGrapheme", () => {
  it.each([
    ["Hi(", "Hi", "("],
    // An astral pair and a combining mark are each one grapheme, so neither is
    // cut in half.
    ["Zoe \u{1D538}", "Zoe ", "\u{1D538}"],
    ["cafe\u0301", "caf", "e\u0301"],
    ["", "", ""],
  ])("splits %j", (value, head, last) => {
    expect(splitLastGrapheme(value)).toEqual({ head, last })
  })
})

describe("glueNodeSequence", () => {
  it.each([
    ["an emoji", emoji()],
    ["a favicon", favicon()],
    ["a sprite", sprite()],
  ])("glues %s to its preceding character", (_name, atom) => {
    expect(glueNodeSequence([text("Hi("), atom])).toEqual([text("Hi"), glueSpan(text("("), atom)])
  })

  it("converts a word's trailing space to a non-breaking space", () => {
    expect(glueNodeSequence([text("Hi "), emoji()])).toEqual([
      text("Hi"),
      glueSpan(text(NBSP), emoji()),
    ])
  })

  it("drops a text node that becomes empty after pulling its only character", () => {
    expect(glueNodeSequence([text("("), emoji()])).toEqual([glueSpan(text("("), emoji())])
  })

  it.each([" ", "\n", "\t", "  "])("leaves an atom after whitespace %j breakable", (space) => {
    const nodes = [text(space), emoji()]
    expect(glueNodeSequence(nodes)).toEqual(nodes)
  })

  it.each([
    ["a newline", "Hi\n"],
    ["a tab", "Hi\t"],
  ])("collapses %s after a word into a non-breaking space", (_name, value) => {
    expect(glueNodeSequence([text(value), emoji()])).toEqual([
      text("Hi"),
      glueSpan(text(NBSP), emoji()),
    ])
  })

  it.each([
    ["an astral character", "Zoe \u{1D538}", "Zoe ", "\u{1D538}"],
    ["a combining mark", "cafe\u0301", "caf", "e\u0301"],
  ])("keeps %s whole when gluing", (_name, value, head, last) => {
    expect(glueNodeSequence([text(value), sprite()])).toEqual([
      text(head),
      glueSpan(text(last), sprite()),
    ])
  })

  it("leaves a leading atom (no preceding glyph) bare", () => {
    expect(glueNodeSequence([emoji(), text(" Hi")])).toEqual([emoji(), text(" Hi")])
  })

  it("leaves an atom preceding another atom bare", () => {
    expect(glueNodeSequence([emoji(), emoji()])).toEqual([emoji(), emoji()])
  })

  it.each([
    ['"', 'Say "', '" loudly'],
    ["'", "Say '", "' loudly"],
    [RIGHT_DOUBLE_QUOTE, `Say ${LEFT_DOUBLE_QUOTE}`, `${RIGHT_DOUBLE_QUOTE} loudly`],
    [RIGHT_SINGLE_QUOTE, `Say ${LEFT_SINGLE_QUOTE}`, `${RIGHT_SINGLE_QUOTE} loudly`],
    [RIGHT_GUILLEMET, "Say «", `${RIGHT_GUILLEMET} loudly`],
  ])("pulls a closing %s into the glue span", (_closer, before, after) => {
    expect(glueNodeSequence([text(before), emoji(), text(after)])).toEqual([
      text("Say "),
      glueSpan(text(before.slice(-1)), emoji(), text(after.slice(0, 1))),
      text(after.slice(1)),
    ])
  })

  it("wraps a bare atom when a closing quote follows it", () => {
    expect(glueNodeSequence([emoji(), text('" loudly')])).toEqual([
      glueSpan(emoji(), text('"')),
      text(" loudly"),
    ])
  })

  it("gives inline math a trailing quote without adopting a preceding word", () => {
    expect(glueNodeSequence([text("Say "), katex(), text('" loudly')])).toEqual([
      text("Say "),
      glueSpan(katex(), text('"')),
      text(" loudly"),
    ])
  })

  it("pulls a run of nested closing quotes and drops the emptied text node", () => {
    expect(glueNodeSequence([emoji(), text(`${RIGHT_SINGLE_QUOTE}"`)])).toEqual([
      glueSpan(emoji(), text(`${RIGHT_SINGLE_QUOTE}"`)),
    ])
  })

  it("appends a closing quote to an existing glue span", () => {
    expect(glueNodeSequence([glueSpan(text("xt"), favicon()), text('" rest')])).toEqual([
      glueSpan(text("xt"), favicon(), text('"')),
      text(" rest"),
    ])
  })

  it("leaves a closing quote that follows no atom alone", () => {
    const nodes = [text("Hi"), text('" there')]
    expect(glueNodeSequence(nodes)).toEqual(nodes)
  })

  it("leaves text after an atom alone when it opens with a non-quote", () => {
    expect(glueNodeSequence([emoji(), text(") loudly")])).toEqual([emoji(), text(") loudly")])
  })

  it("leaves atom-free nodes untouched", () => {
    const nodes = [text("no atoms here")]
    expect(glueNodeSequence(nodes)).toEqual(nodes)
  })
})

describe("glueInlineAtoms", () => {
  const treeOf = (...children: (Text | Element)[]): Root => ({
    type: "root",
    children: [h("p", children)],
  })

  it("glues a sprite and its trailing quote inside a paragraph", () => {
    const tree = treeOf(text('the chevron "'), sprite(), text('" moves'))
    glueInlineAtoms(tree)
    expect(tree.children[0]).toEqual(
      h("p", [text("the chevron "), glueSpan(text('"'), sprite(), text('"')), text(" moves")]),
    )
  })

  it("descends into inline wrappers", () => {
    const tree = treeOf(h("em", [text("look "), emoji()]))
    glueInlineAtoms(tree)
    expect(tree.children[0]).toEqual(
      h("p", [h("em", [text("look"), glueSpan(text(NBSP), emoji())])]),
    )
  })

  it("leaves an existing glue span's children alone", () => {
    const span = glueSpan(text("xt"), favicon())
    const tree = treeOf(span)
    glueInlineAtoms(tree)
    expect(tree.children[0]).toEqual(h("p", [glueSpan(text("xt"), favicon())]))
  })

  it("is idempotent", () => {
    const tree = treeOf(text('the chevron "'), sprite(), text('" moves'))
    glueInlineAtoms(tree)
    const once = structuredClone(tree)
    glueInlineAtoms(tree)
    expect(tree).toEqual(once)
  })
})

describe("InlineAtomGlue", () => {
  it("registers a single html plugin", () => {
    const plugin = InlineAtomGlue()
    expect(plugin.name).toBe("InlineAtomGlue")
    const plugins = plugin.htmlPlugins?.({} as never) ?? []
    expect(plugins).toHaveLength(1)

    const tree = { type: "root", children: [h("p", [text("Hi "), emoji()])] } as Root
    ;(plugins[0] as () => (t: Root) => void)()(tree)
    expect(tree.children[0]).toEqual(h("p", [text("Hi"), glueSpan(text(NBSP), emoji())]))
  })
})
