/**
 * @jest-environment jest-fixed-jsdom
 * @jest-environment-options {"url": "http://localhost:8080"}
 */

import { describe, it, expect } from "@jest/globals"

import { isLocalUrl } from "./spa_utils"

describe("SPA Utilities", () => {
  describe("isLocalUrl", () => {
    it.each([
      { url: "http://localhost:8080/path", isLocal: true, description: "exact origin match" },
      { url: "http://localhost:8080/another/path#hash", isLocal: true, description: "with hash" },
      {
        url: "//localhost:8080/path",
        isLocal: true,
        description: "protocol-relative with matching host",
      },
      { url: "https://example.com", isLocal: false, description: "different domain" },
      {
        url: "http://otherdomain.com/path",
        isLocal: false,
        description: "different domain with path",
      },
      { url: "ftp://server.com", isLocal: false, description: "different protocol" },
      { url: "not a url", isLocal: true, description: "relative path resolves to same origin" },
      { url: "http://", isLocal: false, description: "incomplete URL" },
    ])("should return $isLocal for $description: $url", ({ url, isLocal }) => {
      expect(isLocalUrl(url)).toBe(isLocal)
    })
  })
})
