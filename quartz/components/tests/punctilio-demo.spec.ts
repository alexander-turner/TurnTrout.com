import { test, expect } from "@playwright/test"

import { takeRegressionScreenshot } from "./visual_utils"

const PUNCTILIO_URL = "http://localhost:8080/punctilio"
const OUTPUT_CONTENT = ".punctilio-output-content"

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

    // Clear saved mode so tests start fresh in plaintext mode
    localStorage.removeItem("punctilio-mode")
  })

  await page.goto(PUNCTILIO_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Punctilio demo page loads correctly", () => {
  test("demo container and core elements are present", async ({ page }) => {
    await expect(page.locator("#punctilio-demo")).toBeVisible()
    await expect(page.locator("#punctilio-input")).toBeVisible()
    await expect(page.locator(OUTPUT_CONTENT)).toBeAttached()
    await expect(page.locator("#punctilio-copy-btn")).toBeAttached()
  })

  test("input is pre-filled with example text and output is non-empty", async ({ page }) => {
    const inputValue = await page.locator("#punctilio-input").inputValue()
    expect(inputValue.length).toBeGreaterThan(0)

    const outputHtml = await page.locator(OUTPUT_CONTENT).innerHTML()
    expect(outputHtml.length).toBeGreaterThan(0)
  })
})

test.describe("Mode switching", () => {
  for (const mode of ["plaintext", "markdown", "html"] as const) {
    test(`switching to ${mode} mode activates button`, async ({ page }) => {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await btn.click()
      await expect(btn).toHaveClass(/active/)
    })
  }

  test("only one mode button is active at a time", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    const activeButtons = page.locator(".punctilio-mode-btn.active")
    await expect(activeButtons).toHaveCount(1)
    await expect(activeButtons).toHaveAttribute("data-mode", "markdown")
  })

  test("input text persists across mode switches", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    const originalValue = await input.inputValue()

    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    await expect(input).toHaveValue(originalValue)

    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(input).toHaveValue(originalValue)
  })
})

test.describe("Diff highlighting", () => {
  test("diff view shows insertions highlighted in green", async ({ page }) => {
    // Default diff view should show diff-insert spans for transformed characters
    const diffInserts = page.locator(`${OUTPUT_CONTENT} .diff-insert`)
    await expect(diffInserts.first()).toBeAttached()
  })

  test("output content is visible", async ({ page }) => {
    await expect(page.locator(OUTPUT_CONTENT)).toBeVisible()
  })
})

test.describe("Copy output button", () => {
  test("copy button shows SVG copy icon and swaps to checkmark on click", async ({ page }) => {
    const copyBtn = page.locator("#punctilio-copy-btn")

    // Hover to reveal the button
    await page.locator(".punctilio-output-wrapper").hover()
    await expect(copyBtn).toHaveCSS("opacity", "1")

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

test.describe("Live transform", () => {
  test("typing custom text updates the output", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    await input.fill("")
    await input.pressSequentially('"Hello"', { delay: 30 })

    // Auto-retrying assertion waits for debounced transform
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201c") // left double quote
  })
})

test.describe("Options panel", () => {
  test("changing punctuation style to 'none' disables smart quotes", async ({ page }) => {
    // Expand the collapsed options admonition (Markdown-generated admonition)
    await page.locator("#punctilio-demo .admonition.abstract").click()

    // Set punctuation style to "none"
    await page.locator("#opt-punctuation-style").selectOption("none")

    // Auto-retrying assertion waits for re-transform
    await expect(page.locator(OUTPUT_CONTENT)).not.toContainText("\u201c") // no left double quote
  })
})

test.describe("Cross-element HTML transform", () => {
  test("smart quotes pair correctly across inline element boundaries", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('<p>"Hello <em>world</em>"</p>')

    // The diff view should contain properly paired smart quotes
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201c") // left double quote
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201d") // right double quote
  })
})

test.describe("Markdown protection", () => {
  test("inline math is preserved in markdown mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('The formula $E = mc^2$ is "famous".')

    // Math should be preserved, but quotes should be transformed
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("$E = mc^2$")
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201c") // left double quote
  })

  test("fenced code blocks with ~~~ are preserved", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    await input.fill('~~~\nx = "don\'t change"\n~~~')

    // Code block content should be preserved verbatim
    await expect(page.locator(OUTPUT_CONTENT)).toContainText('"don\'t change"')
  })

  test("mismatched fence delimiters are not treated as a code block", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    // ``` opening with ~~~ "closing" — these don't match, so the quotes inside
    // should be transformed (not protected as a code block)
    await input.fill('```\n"hello"\n~~~')

    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201c") // left double quote
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

  test("Punctilio demo in HTML mode (lostpixel)", async ({ page }, testInfo) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(page.locator(OUTPUT_CONTENT)).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-html", {
      elementToScreenshot: page.locator("#punctilio-demo"),
    })
  })

  test("Punctilio demo in Markdown mode (lostpixel)", async ({ page }, testInfo) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    await expect(page.locator(OUTPUT_CONTENT)).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-markdown", {
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

  test("clipboard button appears on hover of output wrapper", async ({ page }) => {
    const copyBtn = page.locator("#punctilio-copy-btn")
    await expect(copyBtn).toHaveCSS("opacity", "0")

    // Hover over the output wrapper to reveal the button
    await page.locator(".punctilio-output-wrapper").hover()
    await expect(copyBtn).toHaveCSS("opacity", "1")
  })
})

test.describe("Mode button navigation", () => {
  test("clicking the already-active mode does not clear input", async ({ page }) => {
    const btn = page.locator('.punctilio-mode-btn[data-mode="plaintext"]')
    await expect(btn).toHaveClass(/active/)

    const inputBefore = await page.locator("#punctilio-input").inputValue()
    await btn.click()
    const inputAfter = page.locator("#punctilio-input")

    await expect(inputAfter).toHaveValue(inputBefore)
  })

  test("inactive mode buttons do not have active class", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    for (const mode of ["plaintext", "markdown"]) {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await expect(btn).not.toHaveClass(/active/)
    }
  })
})
