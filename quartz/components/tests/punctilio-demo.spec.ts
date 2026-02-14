import { test, expect, type Page } from "@playwright/test"

import { takeRegressionScreenshot } from "./visual_utils"

const PUNCTILIO_URL = "http://localhost:8080/punctilio"

// Visual regression tests don't need assertions
/* eslint-disable playwright/expect-expect */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: {},
        writable: true,
      })
    }
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.resolve(),
      writable: true,
    })
  })

  await page.goto(PUNCTILIO_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Punctilio demo page loads correctly", () => {
  test("demo container and core elements are present", async ({ page }) => {
    await expect(page.locator("#punctilio-demo")).toBeVisible()
    await expect(page.locator("#punctilio-input")).toBeVisible()
    await expect(page.locator("#punctilio-output")).toBeAttached()
    await expect(page.locator("#punctilio-diff")).toBeAttached()
    await expect(page.locator("#punctilio-copy-btn")).toBeVisible()
    await expect(page.locator("#punctilio-diff-toggle")).toBeChecked()
  })

  test("input is pre-filled with example text and output is non-empty", async ({ page }) => {
    const inputValue = await page.locator("#punctilio-input").inputValue()
    expect(inputValue.length).toBeGreaterThan(0)

    // Diff view is shown by default (output textarea is hidden)
    const diffHtml = await page.locator("#punctilio-diff").innerHTML()
    expect(diffHtml.length).toBeGreaterThan(0)
  })
})

test.describe("Mode switching", () => {
  for (const mode of ["plaintext", "markdown", "html"] as const) {
    test(`switching to ${mode} mode updates input text`, async ({ page }) => {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await btn.click()
      await expect(btn).toHaveClass(/active/)

      const inputValue = await page.locator("#punctilio-input").inputValue()
      expect(inputValue.length).toBeGreaterThan(0)
    })
  }

  test("only one mode button is active at a time", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    const activeButtons = page.locator(".punctilio-mode-btn.active")
    await expect(activeButtons).toHaveCount(1)
    await expect(activeButtons).toHaveAttribute("data-mode", "markdown")
  })
})

test.describe("Diff highlighting", () => {
  test("diff view shows insertions highlighted in green", async ({ page }) => {
    // Default diff view should show diff-insert spans for transformed characters
    const diffInserts = page.locator("#punctilio-diff .diff-insert")
    await expect(diffInserts.first()).toBeAttached()
  })

  test("toggling diff off shows the raw output textarea", async ({ page }) => {
    const diffToggle = page.locator("#punctilio-diff-toggle")
    const outputTextarea = page.locator("#punctilio-output")
    const diffDiv = page.locator("#punctilio-diff")

    // Diff is on by default
    await expect(diffDiv).toBeVisible()
    await expect(outputTextarea).toBeHidden()

    // Toggle diff off
    await diffToggle.uncheck()
    await expect(outputTextarea).toBeVisible()
    await expect(diffDiv).toBeHidden()
  })
})

test.describe("Copy output button", () => {
  test("copy button shows SVG copy icon and swaps to checkmark on click", async ({ page }) => {
    const copyBtn = page.locator("#punctilio-copy-btn")
    await expect(copyBtn).toBeVisible()

    // Initially shows the copy icon SVG
    const initialSvg = copyBtn.locator("svg")
    await expect(initialSvg).toBeAttached()
    const initialHtml = await copyBtn.innerHTML()

    await copyBtn.click()

    // After clicking, SVG changes to the checkmark (green fill)
    await expect(copyBtn.locator('svg path[fill="rgb(63, 185, 80)"]')).toBeAttached()

    // Reverts back to copy icon after timeout
    await expect(async () => {
      const currentHtml = await copyBtn.innerHTML()
      expect(currentHtml).toBe(initialHtml)
    }).toPass({ timeout: 4000 })
  })
})

test.describe("HTML mode rendered preview", () => {
  test("HTML preview is hidden in plaintext mode", async ({ page }) => {
    await expect(page.locator("#punctilio-html-preview")).toBeHidden()
  })

  test("HTML preview shows rendered output in HTML mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const preview = page.locator("#punctilio-html-preview")
    await expect(preview).toBeVisible()

    // Should contain rendered HTML elements (e.g. <p> tags from the HTML example)
    const paragraphs = preview.locator("p")
    await expect(paragraphs.first()).toBeAttached()
  })

  test("HTML preview is hidden when switching back to plaintext", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(page.locator("#punctilio-html-preview")).toBeVisible()

    await page.locator('.punctilio-mode-btn[data-mode="plaintext"]').click()
    await expect(page.locator("#punctilio-html-preview")).toBeHidden()
  })
})

test.describe("Live transform", () => {
  test("typing custom text updates the output", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    await input.fill("")
    await input.pressSequentially('"Hello"', { delay: 30 })

    // Auto-retrying assertion waits for debounced transform
    await expect(page.locator("#punctilio-diff")).toContainText("\u201c") // left double quote
  })
})

test.describe("Options panel", () => {
  async function openOptions(page: Page): Promise<void> {
    const details = page.locator(".punctilio-options")
    if (!(await details.getAttribute("open"))) {
      await details.locator("summary").click()
    }
  }

  test("options panel toggles open and closed", async ({ page }) => {
    const details = page.locator(".punctilio-options")
    await expect(details).not.toHaveAttribute("open", "")

    await details.locator("summary").click()
    await expect(details).toHaveAttribute("open", "")
  })

  test("changing punctuation style to 'none' disables smart quotes", async ({ page }) => {
    await openOptions(page)

    // Set punctuation style to "none"
    await page.locator("#opt-punctuation-style").selectOption("none")

    // Auto-retrying assertion waits for re-transform
    await expect(page.locator("#punctilio-output")).not.toHaveValue(/\u201c/) // no left double quote
  })
})

test.describe("Cross-element HTML transform", () => {
  test("smart quotes pair correctly across inline element boundaries", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('<p>"Hello <em>world</em>"</p>')

    // The diff view should contain properly paired smart quotes
    await expect(page.locator("#punctilio-diff")).toContainText("\u201c") // left double quote
    await expect(page.locator("#punctilio-diff")).toContainText("\u201d") // right double quote
  })
})

test.describe("Markdown protection", () => {
  test("inline math is preserved in markdown mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('The formula $E = mc^2$ is "famous".')

    // Math should be preserved, but quotes should be transformed
    await expect(page.locator("#punctilio-diff")).toContainText("$E = mc^2$")
    await expect(page.locator("#punctilio-diff")).toContainText("\u201c") // left double quote
  })

  test("fenced code blocks with ~~~ are preserved", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('~~~\nx = "don\'t change"\n~~~')

    // Code block content should be preserved verbatim
    await expect(page.locator("#punctilio-diff")).toContainText('"don\'t change"')
  })

  test("mismatched fence delimiters are not treated as a code block", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    // ``` opening with ~~~ "closing" — these don't match, so the quotes inside
    // should be transformed (not protected as a code block)
    await input.fill('```\n"hello"\n~~~')

    await expect(page.locator("#punctilio-diff")).toContainText("\u201c") // left double quote
  })
})

test.describe("HTML preview sanitization", () => {
  test("strips data: URIs from href attributes in preview", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('<p><a href="data:text/html,<script>alert(1)</script>">click</a></p>')

    const preview = page.locator("#punctilio-html-preview")
    await expect(preview).toBeVisible()

    // The data: URI should be stripped from the rendered preview
    const link = preview.locator("a")
    await expect(link).toBeAttached()
    await expect(link).not.toHaveAttribute("href")
  })

  test("strips javascript: URIs from href attributes in preview", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('<p><a href="javascript:alert(1)">click</a></p>')

    const preview = page.locator("#punctilio-html-preview")
    await expect(preview).toBeVisible()

    const link = preview.locator("a")
    await expect(link).toBeAttached()
    await expect(link).not.toHaveAttribute("href")
  })

  test("strips event handler attributes in preview", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('<p onmouseover="alert(1)">hover me</p>')

    const preview = page.locator("#punctilio-html-preview")
    await expect(preview).toBeVisible()

    const para = preview.locator("p")
    await expect(para).toBeAttached()
    await expect(para).not.toHaveAttribute("onmouseover")
  })
})

test.describe("SPA navigation", () => {
  test("demo reinitializes after SPA navigation back", async ({ page }) => {
    // Navigate away using SPA
    await page.evaluate(() => window.spaNavigate(new URL("/about", window.location.origin)))
    await page.waitForURL("**/about")

    // Navigate back
    await page.goBack()
    await page.waitForURL("**/punctilio")
    await expect(page.locator("#punctilio-demo")).toBeVisible()

    // Demo should be reinitialized with example text
    const inputValue = await page.locator("#punctilio-input").inputValue()
    expect(inputValue.length).toBeGreaterThan(0)
  })
})

test.describe("Visual regression", () => {
  test("Punctilio demo in plaintext mode (lostpixel)", async ({ page }, testInfo) => {
    await page.locator("#punctilio-demo").waitFor({ state: "visible" })

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-plaintext", {
      elementToScreenshot: page.locator("#punctilio-demo"),
    })
  })

  test("Punctilio demo in HTML mode with preview (lostpixel)", async ({ page }, testInfo) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(page.locator("#punctilio-html-preview")).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-html", {
      elementToScreenshot: page.locator("#punctilio-demo"),
    })
  })
})

test.describe("Clipboard button interaction", () => {
  test("clipboard button uses SVG icon matching code block style", async ({ page }) => {
    const copyBtn = page.locator("#punctilio-copy-btn")
    await expect(copyBtn).toHaveClass(/clipboard-button/)

    // Should contain an SVG element
    const svg = copyBtn.locator("svg")
    await expect(svg).toBeAttached()
    await expect(svg).toHaveAttribute("height", "16")
    await expect(svg).toHaveAttribute("width", "16")
  })

  test("clipboard button is visible without hovering", async ({ page }) => {
    const copyBtn = page.locator("#punctilio-copy-btn")
    await expect(copyBtn).toBeVisible()
    await expect(copyBtn).toHaveCSS("opacity", "1")
  })
})

test.describe("Mode button navigation", () => {
  const modes = ["plaintext", "markdown", "html"] as const

  test("cycling through all modes updates input each time", async ({ page }) => {
    const previousValues = new Set<string>()

    for (const mode of modes) {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await btn.click()
      await expect(btn).toHaveClass(/active/)

      const inputValue = await page.locator("#punctilio-input").inputValue()
      expect(inputValue.length).toBeGreaterThan(0)
      // Each mode has distinct example text
      expect(previousValues.has(inputValue)).toBe(false)
      previousValues.add(inputValue)
    }
  })

  test("clicking the already-active mode does not clear input", async ({ page }) => {
    const btn = page.locator('.punctilio-mode-btn[data-mode="plaintext"]')
    await expect(btn).toHaveClass(/active/)

    const inputBefore = await page.locator("#punctilio-input").inputValue()
    await btn.click()
    const inputAfter = await page.locator("#punctilio-input").inputValue()

    expect(inputAfter).toBe(inputBefore)
  })

  test("inactive mode buttons do not have active class", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    for (const mode of ["plaintext", "markdown"]) {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await expect(btn).not.toHaveClass(/active/)
    }
  })
})
