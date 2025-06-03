import type OriginalFetchType from "node-fetch"

import { jest } from "@jest/globals"
import { Response as NodeFetchResponse } from "node-fetch"

/**
 * Mocks a single successful fetch request on the provided mock instance.
 * @param fetchMockInstance The jest.MockedFunction instance of node-fetch.
 * @param data The data to respond with (e.g., Buffer for images, string for text).
 * @param status The HTTP status code (default: 200).
 * @param headers Additional headers for the response.
 */
export function mockFetchResolve(
  fetchMockInstance: jest.MockedFunction<typeof OriginalFetchType>,
  data: string | Buffer | null,
  status = 200,
  headers: Record<string, string> = { "Content-Type": "application/octet-stream" },
  statusText?: string,
): void {
  const response = new NodeFetchResponse(data, { status, headers, statusText: statusText ?? "" })
  fetchMockInstance.mockResolvedValueOnce(response)
}

/**
 * Mocks a fetch request that throws a network error on the provided mock instance.
 * @param fetchMockInstance The jest.MockedFunction instance of node-fetch.
 * @param error The error to throw (default: new Error("Network error")).
 */
export function mockFetchNetworkError(
  fetchMockInstance: jest.MockedFunction<typeof OriginalFetchType>,
  error: Error = new Error("Network error"),
): void {
  fetchMockInstance.mockRejectedValueOnce(error)
}
