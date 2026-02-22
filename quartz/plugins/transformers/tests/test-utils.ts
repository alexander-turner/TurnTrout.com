import type { Element, Parent, Root } from "hast"
import type OriginalFetchType from "node-fetch"

import { jest } from "@jest/globals"
import { Response as NodeFetchResponse } from "node-fetch"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { visit } from "unist-util-visit"

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
  cancellableBody = false,
): void {
  const response = new NodeFetchResponse(data, { status, headers, statusText: statusText ?? "" })

  if (cancellableBody) {
    const originalBody = response.body
    const cancel = jest.fn()
    const newBody = Object.assign(originalBody ?? {}, { cancel })
    Object.defineProperty(response, "body", { value: newBody, writable: true })
  }

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

/**
 * Recursively removes 'position' properties from AST nodes for testing purposes.
 * This helps in comparing AST nodes without considering their position information.
 *
 * @param obj - The object to process, typically a HAST (HTML Abstract Syntax Tree) node
 * @returns A new object with all 'position' properties removed, preserving the rest of the structure
 */
export function removePositions(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removePositions)
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "position") {
        newObj[key] = removePositions(value)
      }
    }
    return newObj
  }
  return obj
}

/**
 * Creates a rehype processor function for testing transformer plugins.
 * Processes HTML input through rehype pipeline with a custom visitor function.
 *
 * @param modifyNode - The visitor function to apply to each element in the tree
 * @returns An async function that processes HTML strings and returns the stringified result
 */
export function createRehypeProcessor(
  modifyNode: (node: Element, index: number | undefined, parent: Parent | undefined) => void,
) {
  return async function process(input: string): Promise<string> {
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(() => (tree: Root) => {
        visit(tree, "element", modifyNode)
      })
      .use(rehypeStringify)
      .process(input)
    return result.toString()
  }
}
