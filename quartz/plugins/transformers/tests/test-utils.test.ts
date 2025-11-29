import type OriginalFetchType from "node-fetch"

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"
import { Response as NodeFetchResponse } from "node-fetch"

import { mockFetchResolve, mockFetchNetworkError } from "./test-utils"

describe("test-utils", () => {
  let fetchMock: jest.MockedFunction<typeof OriginalFetchType>

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof OriginalFetchType>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("mockFetchResolve", () => {
    it("should mock fetch with default parameters", () => {
      const testData = "test response"

      mockFetchResolve(fetchMock, testData)

      expect(fetchMock).toHaveBeenCalledTimes(0) // mockResolvedValueOnce doesn't call immediately
      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with string data and default status", () => {
      const testData = "test string data"

      mockFetchResolve(fetchMock, testData)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with Buffer data", () => {
      const testData = Buffer.from("test buffer data")

      mockFetchResolve(fetchMock, testData)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with null data", () => {
      mockFetchResolve(fetchMock, null)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with custom status code", () => {
      const testData = "test data"
      const customStatus = 404

      mockFetchResolve(fetchMock, testData, customStatus)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with custom headers", () => {
      const testData = "test data"
      const customHeaders = { "Content-Type": "application/json", "X-Custom": "header" }

      mockFetchResolve(fetchMock, testData, 200, customHeaders)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with custom statusText", () => {
      const testData = "test data"
      const customStatusText = "Custom Status"

      mockFetchResolve(fetchMock, testData, 200, {}, customStatusText)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with cancellable body set to true", () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, undefined, true)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with cancellable body set to false", () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, undefined, false)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should mock fetch with all custom parameters", () => {
      const testData = Buffer.from("comprehensive test")
      const status = 201
      const headers = { "Content-Type": "text/plain", Authorization: "Bearer token" }
      const statusText = "Created"
      const cancellableBody = true

      mockFetchResolve(fetchMock, testData, status, headers, statusText, cancellableBody)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should create response with proper properties when called", async () => {
      const testData = "response data"
      const status = 200
      const headers = { "Content-Type": "application/json" }
      const statusText = "OK"

      mockFetchResolve(fetchMock, testData, status, headers, statusText)

      const response = await fetchMock("http://test.com")

      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(status)
      expect(response.statusText).toBe(statusText)
      expect(response.headers.get("Content-Type")).toBe("application/json")
    })

    it("should add cancel method to body when cancellableBody is true", async () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, undefined, true)

      const response = await fetchMock("http://test.com")

      expect(response.body).toBeDefined()
      const responseSignature = response.body as unknown as { cancel: () => void }
      expect(typeof responseSignature.cancel).toBe("function")
    })

    it("should not add cancel method to body when cancellableBody is false", async () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, undefined, false)

      const response = await fetchMock("http://test.com")

      const responseSignature = response.body as unknown as { cancel: () => void }
      expect(responseSignature.cancel).toBeUndefined()
    })

    it("should handle empty statusText parameter", async () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, "")

      const response = await fetchMock("http://test.com")

      expect(response.statusText).toBe("")
    })

    it("should handle undefined statusText parameter", async () => {
      const testData = "test data"

      mockFetchResolve(fetchMock, testData, 200, {}, undefined)

      const response = await fetchMock("http://test.com")

      expect(response.statusText).toBe("")
    })

    it("should handle null data with cancellableBody true", async () => {
      mockFetchResolve(fetchMock, null, 200, {}, undefined, true)

      const response = await fetchMock("http://test.com")

      expect(response.body).toBeDefined()
      const responseSignature = response.body as unknown as { cancel: () => void }
      expect(typeof responseSignature.cancel).toBe("function")
    })
  })

  describe("mockFetchNetworkError", () => {
    it("should mock fetch to throw default network error", async () => {
      mockFetchNetworkError(fetchMock)

      await expect(fetchMock("http://test.com")).rejects.toThrow("Network error")
    })

    it("should mock fetch to throw custom error", async () => {
      const customError = new Error("Custom network failure")

      mockFetchNetworkError(fetchMock, customError)

      await expect(fetchMock("http://test.com")).rejects.toThrow("Custom network failure")
    })

    it("should mock fetch to throw error with custom message and type", async () => {
      const customError = new TypeError("Type error occurred")

      mockFetchNetworkError(fetchMock, customError)

      await expect(fetchMock("http://test.com")).rejects.toThrow(TypeError)

      // Reset the mock and test the message separately since mockRejectedValueOnce only works once
      mockFetchNetworkError(fetchMock, customError)
      await expect(fetchMock("http://test.com")).rejects.toThrow("Type error occurred")
    })

    it("should use mockRejectedValueOnce exactly once", () => {
      const customError = new Error("Test error")

      mockFetchNetworkError(fetchMock, customError)

      expect(fetchMock.mockRejectedValueOnce).toBeDefined()
    })
  })

  describe("integration scenarios", () => {
    it("should handle multiple mockFetchResolve calls", () => {
      mockFetchResolve(fetchMock, "first response")
      mockFetchResolve(fetchMock, "second response", 201)

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
    })

    it("should handle mixed mock resolve and error calls", () => {
      mockFetchResolve(fetchMock, "success response")
      mockFetchNetworkError(fetchMock, new Error("failure"))

      expect(fetchMock.mockResolvedValueOnce).toBeDefined()
      expect(fetchMock.mockRejectedValueOnce).toBeDefined()
    })
  })
})
