import { execFileSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "./fixtures"
import { gotoPage, preventMediaPlayback, setTheme, takeRegressionScreenshot } from "./visual_utils"

const THEMES = ["light", "dark"] as const

// Per-section fixtures are generated from website_content/test-page.md by
// scripts/split_test_page_sections.py. Each section is its own page, so a
// screenshot of one section is unaffected by edits to (or reordering of) any
// other section. The files are not tracked in git.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const fixturesDir = path.resolve(repoRoot, "website_content/fixtures/test-sections")

// Playwright collects this spec before the webServer (which regenerates the
// fixtures) starts, so a clean local checkout has no directory to read yet.
// Generate it here. In CI the generate-fixtures job already supplied the files
// via artifact, so a missing directory there is a wiring bug we let surface.
if (!process.env.CI && !existsSync(fixturesDir)) {
  execFileSync("uv", ["run", "python", "scripts/split_test_page_sections.py"], {
    cwd: repoRoot,
    stdio: "inherit",
  })
}

const sectionSlugs = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.replace(/\.md$/, ""))
  .sort()

test.describe("Test page section fixtures", () => {
  for (const slug of sectionSlugs) {
    for (const theme of THEMES) {
      test(`section ${slug} in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
        await preventMediaPlayback(page)
        await gotoPage(page, `http://localhost:8080/test-section-${slug}`)
        // Fail loudly if the fixture page didn't build (404s to "Page Not
        // Found") instead of silently screenshotting the 404 page as a diff.
        // The title is title-cased on render ("Test Section: …"), so match
        // case-insensitively.
        await expect(page).toHaveTitle(/^test section:/i)
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
