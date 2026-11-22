/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, describe, expect, it } from "@jest/globals"

import { includeDropcapInSelection, initDropcapCopy } from "./dropcap-copy"

function getSelection(): Selection {
  const selection = window.getSelection()
  if (!selection) throw new Error("No selection")
  return selection
}

function render(paragraphHtml: string, useDropcap = true): HTMLParagraphElement {
  document.body.innerHTML =
    `<article data-use-dropcap="${useDropcap}"><p>${paragraphHtml}</p>` +
    "<p>Second paragraph.</p></article>"
  return document.querySelector("article > p") as HTMLParagraphElement
}

function firstText(element: Element): Text {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Text).data.trim()) return node as Text
  }
  throw new Error("no text")
}

function select(start: Node, startOffset: number, end: Node, endOffset: number): Selection {
  const range = document.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

afterEach(() => {
  getSelection().removeAllRanges()
  document.body.innerHTML = ""
})

describe("includeDropcapInSelection", () => {
  it.each([
    ["a plain first letter", "When I decided", 1, "When I decided"],
    ["leading punctuation", "“Hello,” she said", 2, "“Hello,” she said"],
    ["a one-letter first word and its space", "I use this page", 2, "I use this page"],
    ["a first letter inside an inline element", "<em>Once</em> upon a time", 1, "Once"],
    ["whitespace before the first text", "\n<em>Once</em> upon", 1, "Once"],
  ])("widens a selection starting after %s", (_label, html, offset, expected) => {
    const paragraph = render(html)
    const text = firstText(paragraph)
    const selection = select(text, offset, text, text.length)
    includeDropcapInSelection(selection)
    expect(selection.toString()).toBe(expected)
  })

  it.each([
    ["at the start of the paragraph", 0],
    ["two letters in", 2],
  ])("leaves a selection starting %s unchanged", (_label, offset) => {
    const text = firstText(render("When I decided"))
    const selection = select(text, offset, text, text.length)
    const before = selection.toString()
    includeDropcapInSelection(selection)
    expect(selection.toString()).toBe(before)
  })

  it("leaves a selection starting in a later paragraph unchanged", () => {
    render("When I decided")
    const second = firstText(document.querySelectorAll("article > p")[1])
    const selection = select(second, 1, second, second.length)
    includeDropcapInSelection(selection)
    expect(selection.toString()).toBe("econd paragraph.")
  })

  it("leaves the selection alone when the article has no drop cap", () => {
    const text = firstText(render("When I decided", false))
    const selection = select(text, 1, text, text.length)
    includeDropcapInSelection(selection)
    expect(selection.toString()).toBe("hen I decided")
  })

  it.each([
    ["has no text", "<img alt=''>"],
    ["has no letter", "123 456"],
  ])("leaves the selection alone when the drop-cap paragraph %s", (_label, html) => {
    render(html)
    const other = firstText(document.querySelectorAll("article > p")[1])
    const selection = select(other, 1, other, other.length)
    includeDropcapInSelection(selection)
    expect(selection.toString()).toBe("econd paragraph.")
  })

  it.each([
    ["empty", () => getSelection()],
    [
      "collapsed",
      () => {
        const text = firstText(render("When"))
        return select(text, 1, text, 1)
      },
    ],
  ])("ignores an %s selection", (_label, makeSelection) => {
    render("When I decided")
    const selection = makeSelection()
    expect(() => includeDropcapInSelection(selection)).not.toThrow()
    expect(selection.toString()).toBe("")
  })
})

it("ignores a missing selection", () => {
  render("When I decided")
  expect(() => includeDropcapInSelection(null)).not.toThrow()
})

describe("initDropcapCopy", () => {
  it.each(["copy", "cut"])("widens the selection on %s", (type) => {
    initDropcapCopy()
    const text = firstText(render("When I decided"))
    select(text, 1, text, text.length)
    document.dispatchEvent(new UIEvent(type, { bubbles: true, cancelable: true }))
    expect(getSelection().toString()).toBe("When I decided")
  })
})
