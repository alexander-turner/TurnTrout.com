import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "./fixtures"
import { gotoPage, setTheme, takeRegressionScreenshot } from "./visual_utils"

const THEMES = ["light", "dark"] as const

// Per-section fixtures are generated from website_content/test-page.md by
// scripts/split_test_page_sections.py. Each section is its own page, so a
// screenshot of one section is unaffected by edits to (or reordering of) any
// other section. The files are not tracked in git; CI's generate-fixtures job
// (and the local Playwright server) regenerate them, so this directory is
// always present and current when the tests collect.
const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../website_content/fixtures/test-sections",
)
const sectionSlugs = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.replace(/\.md$/, ""))
  .sort()

test.describe("Test page section fixtures", () => {
  for (const slug of sectionSlugs) {
    for (const theme of THEMES) {
      test(`section ${slug} in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
        await gotoPage(page, `http://localhost:8080/test-section-${slug}`)
        await setTheme(page, theme)
        const article = page.locator("article").first()
        await expect(article).toBeVisible()
        await takeRegressionScreenshot(page, testInfo, `test-section-${slug}-${theme}`, {
          elementToScreenshot: article,
        })
      })
    }
  }
})
