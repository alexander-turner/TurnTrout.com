import { test, expect } from "./fixtures"
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
const ALLOWED_PATTERNS: readonly RegExp[] = [
  /umami\.is/i,
  /umami\.dev/i,
  /codecs=hvc1/i,
  /Trying to load from next <source> element/i,
  /mathvariant.*deprecated/i,
]

function isAllowed(text: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(text))
}

for (const slug of PAGES_TO_CHECK) {
  test(`no unexpected console warnings or errors on ${slug}`, async ({ page }) => {
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

    await gotoPage(page, `http://localhost:8080${slug}`)

    expect(offenders, `Unexpected console output on ${slug}:\n${offenders.join("\n")}`).toEqual([])
  })
}
