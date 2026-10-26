/**
 * The GitHub REST client the snapshot refresh scripts share. It retries
 * network errors, 5xx answers and rate limits (403 and 429) with backoff, and
 * fails at once on a permanent error such as a 404 or a bad token.
 */
import { retry } from "@octokit/plugin-retry"
import { RequestError } from "@octokit/request-error"
import { Octokit } from "@octokit/rest"

const GitHubWithRetry = Octokit.plugin(retry)
export type GitHub = InstanceType<typeof GitHubWithRetry>
type GitHubOptions = NonNullable<ConstructorParameters<typeof GitHubWithRetry>[0]>

/** The plugin's default permanent statuses, less 403, which GitHub uses for rate limits. */
export const RETRY = { doNotRetry: [400, 401, 404, 410, 422, 451] }

/** A client authenticated with `GITHUB_TOKEN` when set; `options` override the defaults. */
export function gitHubClient(options: GitHubOptions = {}): GitHub {
  return new GitHubWithRetry({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "turntrout.com snapshot refresh",
    retry: RETRY,
    ...options,
  })
}

/** Awaits a GitHub request, or returns undefined when its object does not exist. */
export async function ifFound<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request
  } catch (error) {
    // A commit lookup answers 422, not 404, for a SHA the repo does not hold.
    if (error instanceof RequestError && [404, 422].includes(error.status)) return undefined
    throw error
  }
}
