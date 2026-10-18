import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"

import {
  breaksAfterPathSlash,
  breaksInCodeBlock,
  CodeBlockBreaks,
  insertCodeBreaks,
  rehypeCodeBlockBreaks,
  wrapCodeTokens,
} from "./codeBreaks"

/** Where `rule` breaks `text`, marked with `|`. */
const marked = (rule: (text: string, index: number) => boolean, text: string): string =>
  [...text].map((char, i) => (i > 0 && rule(text, i) ? `|${char}` : char)).join("")

describe("breaksAfterPathSlash", () => {
  it.each([
    ["owner/repo", "owner/|repo"],
    ["a/b/c", "a/|b/|c"],
    ["https://x.com/y", "https://x.com/|y"],
    ["/leading", "/leading"],
    ["trailing/", "trailing/"],
    ["a / b", "a / b"],
    ["</analysis>", "</analysis>"],
    ["<br/>", "<br/>"],
  ])("%s → %s", (text, expected) => {
    expect(marked(breaksAfterPathSlash, text)).toBe(expected)
  })
})

describe("breaksInCodeBlock", () => {
  it.each([
    ["num_classes=self.latent_size).float()", "num_classes=|self|.latent_size)|.float()"],
    ["config/markdownlint/.markdownlint.jsonc", "config/|markdownlint/|.markdownlint|.jsonc"],
    ['"{*.{css,scss},.hooks}":', '"{*.{css,|scss},|.hooks}":'],
    ["a == b, c => d", "a == b, c => d"],
    ["x=>y", "x=>y"],
    ["f()", "f()"],
    ["1.5", "1.5"],
    ["a..b", "a..b"],
    ["a.", "a."],
  ])("%s → %s", (text, expected) => {
    expect(marked(breaksInCodeBlock, text)).toBe(expected)
  })
})

describe("insertCodeBreaks", () => {
  it("reads across highlight spans and puts a boundary break in the next node", () => {
    const line = h("span", { dataLine: "" }, [
      h("span", ["x"]),
      h("span", ["="]),
      h("span", ["self.size"]),
    ])
    expect(insertCodeBreaks(line, breaksInCodeBlock)).toBe(2)
    expect(toHtml(line)).toBe(
      '<span data-line=""><span>x</span><span>=</span><span><wbr>self<wbr>.size</span></span>',
    )
  })

  it("leaves a container without break points untouched", () => {
    const code = h("code", ["grep"])
    code.children.push({ type: "comment", value: "note" })
    expect(insertCodeBreaks(code, breaksAfterPathSlash)).toBe(0)
    expect(toHtml(code)).toBe("<code>grep<!--note--></code>")
  })
})

describe("wrapCodeTokens", () => {
  const wrapped = (children: Parameters<typeof h>[2]): string => {
    const line = h("span", { dataLine: "" }, children)
    insertCodeBreaks(line, breaksInCodeBlock)
    wrapCodeTokens(line)
    return toHtml(line)
  }

  it("wraps a later token that breaks inside, splitting the spans it shares", () => {
    expect(wrapped([h("span", ["print(a) "]), h("span", ["print(b)"])])).toBe(
      '<span data-line=""><span>print(<wbr>a) </span><span class="code-token">' +
        "<span>print(<wbr>b)</span></span></span>",
    )
  })

  it("splits a span that holds both a space and a token", () => {
    expect(wrapped([h("span", ["a = b.c"])])).toBe(
      '<span data-line=""><span>a = </span><span class="code-token"><span>b<wbr>.c</span></span></span>',
    )
  })

  it.each([
    ["the line's first token", "    self.layers"],
    ["a token without break points", "a b"],
    ["a token too long for a row", `a ${"x".repeat(60)}.y`],
  ])("leaves %s unwrapped", (_name, text) => {
    const line = h("span", { dataLine: "" }, [h("span", [text])])
    insertCodeBreaks(line, breaksInCodeBlock)
    const withBreaks = toHtml(line)
    wrapCodeTokens(line)
    expect(toHtml(line)).toBe(withBreaks)
  })

  it.each([
    [`a ${"x".repeat(20)}.y`, '"code-token"'],
    [`a ${"x".repeat(40)}.y`, '"code-token code-token-wide"'],
  ])("classes a token by whether it fits a narrow row (%s)", (text, className) => {
    expect(wrapped([text])).toContain(`<span class=${className}>`)
  })

  it("drops empty text and keeps comments and nested elements", () => {
    const line = h("span", { dataLine: "" }, [
      { type: "text", value: "" },
      h("span", ["x ", h("em", ["y.z"])]),
    ])
    line.children.push({ type: "comment", value: "c" })
    insertCodeBreaks(line, breaksInCodeBlock)
    wrapCodeTokens(line)
    expect(toHtml(line)).toBe(
      '<span data-line=""><span>x </span><span class="code-token">' +
        "<span><em>y<wbr>.z</em></span><!--c--></span></span>",
    )
  })
})

describe("rehypeCodeBlockBreaks", () => {
  const lineIn = (wrapper: Element): string => {
    const tree: Root = { type: "root", children: [wrapper] }
    rehypeCodeBlockBreaks(tree)
    return toHtml(tree)
  }

  it("breaks the lines of a code block", () => {
    const block = h("pre", [h("code", [h("span", { dataLine: "" }, ["a/b"])])])
    expect(lineIn(block)).toBe('<pre><code><span data-line="">a/<wbr>b</span></code></pre>')
  })

  it("ignores a data-line outside <pre>", () => {
    const inline = h("code", [h("span", { dataLine: "" }, ["a/b"])])
    expect(lineIn(inline)).toBe('<code><span data-line="">a/b</span></code>')
  })

  it("is exposed as a Quartz HTML plugin", () => {
    const plugins = CodeBlockBreaks().htmlPlugins?.({} as never) ?? []
    expect(plugins).toHaveLength(1)
  })
})
