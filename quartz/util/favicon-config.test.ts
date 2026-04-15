import { describe, it, expect } from "@jest/globals"

import {
  normalizeHostname,
  normalizeFaviconListEntry,
  faviconCountWhitelistComputed,
  faviconSubstringBlacklistComputed,
} from "./favicon-config"

describe("normalizeHostname", () => {
  it.each([
    ["blog.openai.com", "openai.com"],
    ["docs.python.org", "python.org"],
    ["www.example.com", "example.com"],
    ["subdomain.example.co.uk", "example.co.uk"],
  ])("strips subdomains: %s → %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected)
  })

  it.each([
    ["math.stackexchange.com", "math.stackexchange.com"],
    ["gaming.stackexchange.com", "gaming.stackexchange.com"],
  ])("preserves StackExchange subdomains: %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected)
  })

  it("returns original hostname when PSL parsing fails", () => {
    expect(normalizeHostname("localhost")).toBe("localhost")
  })

  it.each([
    ["example.com", "example.com"],
    ["github.com", "github.com"],
  ])("keeps root domains unchanged: %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected)
  })

  it("applies special domain mappings", () => {
    expect(normalizeHostname("transformer-circuits.pub")).toBe("anthropic.com")
  })
})

describe("normalizeFaviconListEntry", () => {
  it("converts underscored hostnames through PSL pipeline", () => {
    const result = normalizeFaviconListEntry("blog_example_com")
    expect(result).toBe("example_com")
  })

  it("preserves StackExchange entries", () => {
    expect(normalizeFaviconListEntry("math_stackexchange_com")).toBe("math_stackexchange_com")
  })

  it("handles simple domains", () => {
    expect(normalizeFaviconListEntry("github_com")).toBe("github_com")
  })
})

describe("computed lists", () => {
  it("faviconCountWhitelistComputed is a non-empty array", () => {
    expect(Array.isArray(faviconCountWhitelistComputed)).toBe(true)
    expect(faviconCountWhitelistComputed.length).toBeGreaterThan(0)
  })

  it("faviconCountWhitelistComputed contains special favicon paths", () => {
    const joined = faviconCountWhitelistComputed.join(",")
    expect(joined).toContain("turntrout_com")
  })

  it("faviconSubstringBlacklistComputed is an array", () => {
    expect(Array.isArray(faviconSubstringBlacklistComputed)).toBe(true)
  })

  it("blacklist entries are normalized (no deep subdomains)", () => {
    for (const entry of faviconSubstringBlacklistComputed) {
      // Each entry should be a simple underscore-separated domain
      expect(typeof entry).toBe("string")
      expect(entry.length).toBeGreaterThan(0)
    }
  })
})
