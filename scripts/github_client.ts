/**
 * The GitHub REST client the snapshot refresh scripts share. It retries
 * network errors and 5xx answers with backoff, waits out a rate limit a few
 * times, and fails at once on a permanent error such as a 404 or a bad token.
 */
import { retry } from "@octokit/plugin-retry"
import { throttling } from "@octokit/plugin-throttling"
import { RequestError } from "@octokit/request-error"
import { Octokit } from "@octokit/rest"

const GitHubWithPlugins = Octokit.plugin(retry, throttling)
export type GitHub = InstanceType<typeof GitHubWithPlugins>
export type GitHubOptions = NonNullable<ConstructorParameters<typeof GitHubWithPlugins>[0]>

/** Rate-limit waits one request may take before it fails. */
export const RATE_LIMIT_RETRIES = 2

const retryUnderLimit = (_after: number, _options: unknown, _octokit: unknown, count: number) =>
  count < RATE_LIMIT_RETRIES

/** How the client handles GitHub's primary and secondary rate limits. */
export const THROTTLE = { onRateLimit: retryUnderLimit, onSecondaryRateLimit: retryUnderLimit }

/** A client authenticated with `GITHUB_TOKEN` when set; `options` override the defaults. */
export function gitHubClient(options: GitHubOptions = {}): GitHub {
  return new GitHubWithPlugins({
    auth: process.env.GITHUB_TOKEN,
    userAgent: "turntrout.com snapshot refresh",
    throttle: THROTTLE,
    ...options,
  })
}

/**
 * Statuses GitHub answers for an object that does not exist: 404, or 422 when
 * a commit lookup names a SHA the repo does not hold.
 */
const MISSING_STATUSES: ReadonlySet<number> = new Set([404, 422])

/** Awaits a GitHub request, or returns undefined when its object does not exist. */
export async function ifFound<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request
  } catch (error) {
    if (error instanceof RequestError && MISSING_STATUSES.has(error.status)) return undefined
    throw error
  }
}
