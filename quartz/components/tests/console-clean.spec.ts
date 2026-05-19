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

// Umami is a third-party analytics script loaded from `cloud.umami.is`. It can
// fail to load when CI lacks outbound network, when the user has an ad-blocker,
// or during transient CDN hiccups — none of which represent a real site bug.
const ALLOWED_PATTERNS: readonly RegExp[] = [/umami\.is/i, /umami\.dev/i]

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
      if (isAllowed(text)) return
      offenders.push(`[${type}] ${text}`)
    })

    page.on("pageerror", (err) => {
      if (isAllowed(err.message)) return
      offenders.push(`[pageerror] ${err.message}`)
    })

    await gotoPage(page, `http://localhost:8080${slug}`)

    expect(offenders, `Unexpected console output on ${slug}:\n${offenders.join("\n")}`).toEqual([])
  })
}
