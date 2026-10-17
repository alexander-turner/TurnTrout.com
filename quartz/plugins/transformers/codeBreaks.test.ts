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
      '<span data-line=""><span>x</span><span>=</span>' + "<span><wbr>self<wbr>.size</span></span>",
    )
  })

  it("leaves a container without break points untouched", () => {
    const code = h("code", ["grep"])
    code.children.push({ type: "comment", value: "note" })
    expect(insertCodeBreaks(code, breaksAfterPathSlash)).toBe(0)
    expect(toHtml(code)).toBe("<code>grep<!--note--></code>")
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
