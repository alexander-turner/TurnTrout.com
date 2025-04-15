/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"

import { locationToStorageKey, isLocalUrl } from "./spa_utils"

interface MockLocation {
  toString: () => string
  origin?: string
}

describe("SPA Utilities", () => {
  describe("locationToStorageKey", () => {
    it.each([
      {
        name: "basic URL",
        location: { toString: () => "http://localhost:8080/path" } as MockLocation,
        expected: "scrollPos:http://localhost:8080/path",
      },
      {
        name: "URL with hash",
        location: { toString: () => "http://localhost:8080/path#section" } as MockLocation,
        expected: "scrollPos:http://localhost:8080/path",
      },
      {
        name: "URL with query parameters",
        location: { toString: () => "http://localhost:8080/path?query=value" } as MockLocation,
        expected: "scrollPos:http://localhost:8080/path?query=value",
      },
    ])("should generate correct storage key for $name", ({ location, expected }) => {
      expect(locationToStorageKey(location as Location)).toBe(expected)
    })
  })

  describe("isLocalUrl", () => {
    // Mock window.location
    const originalLocation = window.location

    beforeAll(() => {
      // Use Object.defineProperty instead of delete for window.location
      const mockLocation = { ...originalLocation, origin: "http://localhost:8080" } as Location
      Object.defineProperty(window, "location", {
        writable: true,
        value: mockLocation,
      })
    })

    afterAll(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      })
    })

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
      { url: "not a url", isLocal: false, description: "malformed URL" },
      { url: "http://", isLocal: false, description: "incomplete URL" },
      { url: "//otherdomain.com/path", isLocal: true, description: "technically local" },
    ])("should return $isLocal for $description: $url", ({ url, isLocal }) => {
      expect(isLocalUrl(url)).toBe(isLocal)
    })
  })
})
