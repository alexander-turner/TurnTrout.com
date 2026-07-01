/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import fc from "fast-check"

import { decodeHtmlEntities } from "../tweetCard"

// Deterministic runs: a fixed seed keeps CI reproducible (zero-flakiness policy).
fc.configureGlobal({ seed: 20260701, numRuns: 500 })

/**
 * Twitter's syndication API HTML-escapes exactly `&`, `<`, and `>` in tweet
 * text. Reproduce that here so the round-trip mirrors the encoded strings real
 * snapshots store.
 */
function twitterEncode(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

describe("decodeHtmlEntities (property)", () => {
  it("never throws on arbitrary unicode", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 300 }), (text) => {
        expect(() => decodeHtmlEntities(text)).not.toThrow()
      }),
    )
  })

  it("inverts Twitter's HTML-escaping for any input", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 300 }), (text) => {
        expect(decodeHtmlEntities(twitterEncode(text))).toBe(text)
      }),
    )
  })

  it("is the identity on text containing no entity references", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 300 }).filter((s) => !s.includes("&")),
        (text) => {
          expect(decodeHtmlEntities(text)).toBe(text)
        },
      ),
    )
  })
})
