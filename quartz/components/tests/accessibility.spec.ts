import AxeBuilder from "@axe-core/playwright"
import { test, expect } from "@playwright/test"

// Pages representing different layouts and content types
const TEST_PAGES = [
  { path: "/", name: "Home" },
  { path: "/test-page", name: "Test page (rich content)" },
  { path: "/about", name: "About" },
  { path: "/posts", name: "All posts" },
]

for (const { path, name } of TEST_PAGES) {
  test(`${name} (${path}) passes axe WCAG AA`, async ({ page, browserName }, testInfo) => {
    // Run only on Desktop Chromium to avoid redundant checks across 9 configs
    test.skip(
      browserName !== "chromium" || !testInfo.project.name.includes("Desktop"),
      "Accessibility tests run on Desktop Chromium only",
    )

    await page.goto(path, { waitUntil: "load" })

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".katex") // KaTeX generates complex markup that triggers false positives
      .exclude("#trout-ornament-container") // Decorative SVG
      .analyze()

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      help: v.helpUrl,
    }))

    expect(violations, `axe found ${violations.length} WCAG AA violations`).toEqual([])
  })
}
