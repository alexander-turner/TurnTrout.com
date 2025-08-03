import type { Text, InlineCode, Code, Link, Emphasis } from "mdast"

import { describe, expect, it } from "@jest/globals"

import { customToString } from "./toc"

// Helper to create nodes with proper types
const createNode = <T extends { type: string }>(type: T["type"], props: Omit<T, "type">): T =>
  ({
    type,
    ...props,
  }) as T

describe("customToString", () => {
  it.each([
    ["text", createNode<Text>("text", { value: "Hello world" }), "Hello world"],
    ["inlineCode", createNode<InlineCode>("inlineCode", { value: "const x = 1" }), "`const x = 1`"],
    [
      "code",
      createNode<Code>("code", { value: "function test() {}", lang: "js" }),
      "`function test() {}`",
    ],
    [
      "link",
      createNode<Link>("link", {
        url: "https://example.com",
        children: [createNode<Text>("text", { value: "Link text" })],
      }),
      "Link text",
    ],
    [
      "emphasis",
      createNode<Emphasis>("emphasis", {
        children: [createNode<Text>("text", { value: "emphasized text" })],
      }),
      "emphasized text",
    ],
  ])("handles %s nodes", (_, node, expected) => {
    expect(customToString(node)).toBe(expected)
  })
})
