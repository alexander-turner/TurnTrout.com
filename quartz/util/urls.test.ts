import { describe, expect, it } from "@jest/globals"

import { canonicalizeUrl } from "./urls"

describe("canonicalizeUrl", () => {
  it.each([
    ["https://example.com/", "https://example.com"],
    ["https://example.com", "https://example.com"],
    ["http://Example.com/Path/", "https://example.com/Path"],
    ["https://EXAMPLE.com/a?q=1", "https://example.com/a?q=1"],
    ["https://example.com/a/?q=1", "https://example.com/a?q=1"],
    ["https://example.com/a#frag", "https://example.com/a"],
    ["https://example.com/a/#frag", "https://example.com/a"],
    ["https://example.com:8080/a/", "https://example.com:8080/a"],
    ["http://example.com/keep?x=1&y=2#z", "https://example.com/keep?x=1&y=2"],
    ["https://user:pw@example.com/a", "https://example.com/a"],
    // WHATWG normalization (the writer mirrors this with the same ada parser):
    ["http://example.com:80/a", "https://example.com/a"],
    ["https://example.com:443/a", "https://example.com/a"],
    ["https://example.com/a b", "https://example.com/a%20b"],
    ["https://example.com/café", "https://example.com/caf%C3%A9"],
    ["https://exämple.com/a", "https://xn--exmple-cua.com/a"],
    ["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
    ["https://example.com/a;p=1", "https://example.com/a;p=1"],
    ["https://example.com/a?", "https://example.com/a"],
  ])("canonicalizes %j to %j", (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected)
  })

  it("throws on an unparsable URL", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow()
  })
})
