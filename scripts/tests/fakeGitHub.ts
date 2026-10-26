import { jest } from "@jest/globals"

import { gitHubClient, type GitHubOptions } from "../github_client"

/** A route's answer with a status or headers other than a plain 200. */
export class Reply {
  constructor(
    readonly status: number,
    readonly body: unknown = "",
    readonly headers: Readonly<Record<string, string>> = {},
  ) {}
}

/**
 * A GitHub client whose requests `route` answers instead of the network: a
 * string as text, a `Reply` as given, anything else as JSON. Records every URL
 * it served. Retries run without delay and rate limiting is off unless
 * `options` turn it back on.
 */
export function fakeGitHub(route: (url: URL) => unknown, options: GitHubOptions = {}) {
  const urls: string[] = []
  const fetch = jest.fn((input: string | URL | Request) => {
    const url = new URL(String(input))
    urls.push(url.toString())
    const answer = route(url)
    const reply = answer instanceof Reply ? answer : new Reply(200, answer)
    const text = typeof reply.body === "string"
    const response = new Response(text ? (reply.body as string) : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": text ? "text/plain" : "application/json", ...reply.headers },
    })
    // A real fetch sets the URL it answered, which pagination reads.
    Object.defineProperty(response, "url", { value: url.toString() })
    return Promise.resolve(response)
  })
  const github = gitHubClient({
    request: { fetch },
    retry: { retryAfterBaseValue: 0 },
    throttle: { enabled: false },
    ...options,
  })
  return { github, urls, fetch }
}
