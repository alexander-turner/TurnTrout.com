import type { Request } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The set of pages covered mirrors `.github/lighthouse-full-config.json`'s
// urls, so anything that fails the Lighthouse `errors-in-console` audit
// also fails here — plus warnings, which Lighthouse can't check.
const PAGES_TO_CHECK: readonly string[] = [
  "/",
  "/design",
  "/about",
  "/research",
  "/test-page",
  "/posts",
]

// PLAYWRIGHT_BASE_URL lets CI rerun this spec against the deployed CF Pages
// preview URL. Localhost catches code-side bugs; the preview run catches
// edge-only failures (CF Speed Brain, CSP, CORS misconfigs, Page Functions)
// that the local dev server can't reproduce.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080"
const ENV_LABEL = process.env.PLAYWRIGHT_BASE_URL ? "PREVIEW" : "LOCAL"

// This spec asserts console cleanliness of the page as users receive it, so
// every asset request must hit the real CDN.
test.use({ stubCdnAssets: false })

// Known-benign console output we don't want to fail on.
//   - umami.{is,dev}: third-party analytics; can fail to load when CI lacks
//     outbound network, when the user has an ad-blocker, or during transient
//     CDN hiccups.
//   - HEVC <source> fallback in Firefox: <video> elements declare a
//     codecs=hvc1 source for Safari/Chromium plus an H.264 fallback. Firefox
//     can't decode hvc1, warns about it, then falls through to the next
//     <source>. The video plays correctly; the warning is the fallback
//     mechanism working as intended.
//   - MathML mathvariant deprecation: Firefox warns that `mathvariant` on
//     MathML elements is deprecated. KaTeX still emits it, and Firefox's
//     own chrome://global/...videocontrols.js trips the warning too —
//     neither is actionable from our code.
//   - "was preloaded … but not used": icons preloaded via <link rel=preload>
//     for admonition types that don't appear on a given page. Harmless.
//   - palform.app: the third-party feedback-form embed (on /about) ships its
//     own bundled PouchDB, which logs a `db.type() is deprecated` warning. It's
//     external code we don't control, so we don't fail our console check on it.
//   - request timeouts: this spec deliberately fetches real CDN assets, so a
//     degraded network path between the CI runner and the CDN surfaces as
//     WebKit "request timed out" errors. A timeout is never a code-side
//     signal — a broken URL fails deterministically with a 404, which still
//     fails this test. Matched against the exact WebKit message text so only
//     the timeout variant is tolerated.
const ALLOWED_PATTERNS: readonly RegExp[] = [
  /umami\.is/i,
  /umami\.dev/i,
  /codecs=hvc1/i,
  /Trying to load from next <source> element/i,
  /mathvariant.*deprecated/i,
  /was preloaded using link preload but not used/i,
  /palform\.app/i,
  /^Failed to preconnect to \S+ Error: The request timed out\.$/,
  /^Failed to load resource: The request timed out\.$/,
]

function isAllowed(text: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(text))
}

const NETWORK_QUIET_WINDOW_MS = 500
const NETWORK_SETTLE_DEADLINE_MS = 15_000
const POLL_INTERVAL_MS = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Waits for the in-flight request set to stay empty for a quiet window, up
 * to the deadline. Like `networkidle` (which the linter bans), the quiet
 * window keeps a momentary zero between dependent requests (a stylesheet
 * finishing triggers a font request) from counting as settled.
 *
 * @returns URLs of requests still pending at the deadline.
 */
async function waitForNetworkSettle(
  inflightRequests: ReadonlySet<Request>,
): Promise<readonly string[]> {
  const deadline = Date.now() + NETWORK_SETTLE_DEADLINE_MS
  let settled = false
  while (!settled && Date.now() < deadline) {
    if (inflightRequests.size === 0) {
      await sleep(NETWORK_QUIET_WINDOW_MS)
      settled = inflightRequests.size === 0
    } else {
      await sleep(POLL_INTERVAL_MS)
    }
  }
  return [...inflightRequests].map((req) => req.url())
}

for (const slug of PAGES_TO_CHECK) {
  test(`no unexpected console output on ${ENV_LABEL} ${slug}`, async ({ page }) => {
    const offenders: string[] = []

    page.on("console", (msg) => {
      const type = msg.type()
      if (type !== "error" && type !== "warning") return
      const text = msg.text()
      // WebKit/Safari's "Failed to load resource" console messages don't
      // include the URL in the text; they put it in `msg.location().url`
      // instead. Match against both so the allowlist covers all engines.
      const locationUrl = msg.location()?.url ?? ""
      if (isAllowed(text) || isAllowed(locationUrl)) return
      offenders.push(`[${type}] ${text}${locationUrl ? ` (${locationUrl})` : ""}`)
    })

    page.on("pageerror", (err) => {
      if (isAllowed(err.message)) return
      offenders.push(`[pageerror] ${err.message}`)
    })

    // Sub-resource requests (fonts, images, analytics) can emit console
    // errors after the `load` event, so requests that started should
    // settle before `offenders` is read.
    const inflightRequests = new Set<Request>()
    page.on("request", (req) => inflightRequests.add(req))
    page.on("requestfinished", (req) => inflightRequests.delete(req))
    page.on("requestfailed", (req) => inflightRequests.delete(req))

    await gotoPage(page, `${BASE_URL}${slug}`)
    const stragglers = await waitForNetworkSettle(inflightRequests)

    // Requests to this site's own server are deterministic and must settle
    // by the deadline. A request still pending against another origin is
    // stalled on the public network: the only console output it can still
    // produce is the allowlisted timeout error (a bad asset URL 404s
    // quickly, so it settles in time and fails the offender check), so it
    // must not gate the offender read.
    const ownServerStragglers = stragglers.filter((url) => url.startsWith(BASE_URL))
    expect(
      ownServerStragglers,
      `Same-origin requests still in flight after ${NETWORK_SETTLE_DEADLINE_MS}ms on ${ENV_LABEL} ${slug}:\n${ownServerStragglers.join("\n")}`,
    ).toEqual([])

    expect(
      offenders,
      `Unexpected console output on ${ENV_LABEL} ${slug}:\n${offenders.join("\n")}`,
    ).toEqual([])
  })
}
