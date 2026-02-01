import { describe, it, expect } from "@jest/globals"

import { escapeHTML } from "./escape"

describe("escapeHTML", () => {
  it.each([
    ['<script>alert("XSS");</script> & \'test\'', "&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt; &amp; &#039;test&#039;"],
    ["foo & bar", "foo &amp; bar"],
    ["a < b", "a &lt; b"],
    ["a > b", "a &gt; b"],
    ['say "hello"', "say &quot;hello&quot;"],
    ["it's", "it&#039;s"],
    ["Hello World 123", "Hello World 123"],
    ["", ""],
    ["a & b & c", "a &amp; b &amp; c"],
  ])("escapes %j to %j", (input, expected) => {
    expect(escapeHTML(input)).toBe(expected)
  })
})
