import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import { addClassesOnce } from "./hast"

describe("addClassesOnce", () => {
  // hastscript's h() normalizes className to an array, but hast permits the
  // space-separated string form too, so build that case by direct assignment.
  function anchorWithClassString(className: string) {
    const node = h("a")
    node.properties.className = className
    return node
  }

  it.each([
    ["no existing classes", h("a"), ["external", "annotated"]],
    ["an existing class array", h("a", { className: ["external"] }), ["external", "annotated"]],
    [
      "a space-separated class string",
      anchorWithClassString("external internal"),
      ["external", "internal", "annotated"],
    ],
    [
      "duplicates already present",
      h("a", { className: ["external", "annotated"] }),
      ["external", "annotated"],
    ],
  ])("adds classes once given %s", (_desc, node, expected) => {
    addClassesOnce(node, ["external", "annotated"])
    expect(node.properties.className).toEqual(expected)
  })

  it("stringifies numeric class entries", () => {
    const node = h("a")
    node.properties.className = [1]
    addClassesOnce(node, ["annotated"])
    expect(node.properties.className).toEqual(["1", "annotated"])
  })
})
