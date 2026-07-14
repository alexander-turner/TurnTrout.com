import type { Page } from "playwright"

import { COPY_BUTTON_RESET_DELAY_MS } from "../scripts/component_script_utils"
import { expect, test } from "./fixtures"
import { takeRegressionScreenshot } from "./visual_utils"

const PUNCTILIO_URL = "http://localhost:8080/punctilio"
const OUTPUT_CONTENT = ".punctilio-output-content"

/**
 * Pins a visual capture to the demo's fully-rendered ghost output. With an empty
 * input the output is populated client-side: the initial transform is deferred
 * (`queueMicrotask`), so a bare `visible` wait can race it and screenshot the
 * empty box. The output's text — including the `::before` ghost rendered from
 * `data-placeholder` — uses `font-display: swap` faces whose load is triggered
 * on paint, so `document.fonts.ready` inside the screenshot helper can resolve
 * before that face loads (FOUT). Wait for the populated, mode-settled state and
 * force the output font to load before capturing.
 */
const waitForGhostOutputRendered = async (
  page: Page,
  { monospace }: { monospace: boolean },
): Promise<void> => {
  const output = page.locator(OUTPUT_CONTENT)
  await expect(output).toHaveClass(/ghost/)
  await expect(output).toHaveAttribute("data-placeholder", /\S/)
  if (monospace) {
    await expect(output).toHaveClass(/monospace-output/)
  } else {
    await expect(output).not.toHaveClass(/monospace-output/)
  }
  await page.evaluate(async (selector) => {
    const el = document.querySelector(selector)
    if (!el) return
    const style = getComputedStyle(el)
    const family = style.fontFamily
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "")
    if (family) {
      await document.fonts.load(`${style.fontWeight} ${style.fontSize} "${family}"`)
    }
    await document.fonts.ready
  }, OUTPUT_CONTENT)
}

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

  test("input starts empty with ghost placeholder and output shows ghost text", async ({
    page,
  }) => {
    await expect(page.locator("#punctilio-input")).toHaveValue("")
    await expect(page.locator("#punctilio-input")).toHaveAttribute("placeholder", /can't believe/)

    // Output shows ghost text via CSS ::before using data-placeholder attribute
    const output = page.locator(OUTPUT_CONTENT)
    await expect(output).toHaveClass(/ghost/)
    const placeholder = await output.getAttribute("data-placeholder")
    expect(placeholder?.length ?? 0).toBeGreaterThan(0)
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
    await input.fill("Test text")

    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    await expect(input).toHaveValue("Test text")

    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(input).toHaveValue("Test text")
  })
})

test.describe("Diff highlighting", () => {
  test("diff view shows insertions highlighted in green for transformable text", async ({
    page,
  }) => {
    const input = page.locator("#punctilio-input")
    await input.fill('"Hello" (c) 2024')

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

    // Reverts back to copy icon after the reset delay. The button reverts on a
    // `setTimeout(COPY_BUTTON_RESET_DELAY_MS)` that starts once the clipboard
    // write resolves, so the wait must clear the delay plus clipboard latency
    // and background-timer throttling on slow CI engines (e.g. iPad Pro Firefox).
    await expect(async () => {
      const currentHtml = await copyBtn.innerHTML()
      expect(currentHtml).toBe(initialHtml)
    }).toPass({ timeout: COPY_BUTTON_RESET_DELAY_MS + 6000 })
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
    // Fill with text containing quotes
    await page.locator("#punctilio-input").fill('"Hello world"')
    await expect(page.locator(OUTPUT_CONTENT)).toContainText("\u201c") // left double quote present

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

  test("mismatched fence delimiters protect content (CommonMark: unterminated fence)", async ({
    page,
  }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()

    const input = page.locator("#punctilio-input")
    // Per CommonMark, ``` opens a fence only closable by ```, not ~~~.
    // The fence is unterminated, so "hello" is code content and quotes stay straight.
    await input.fill('```\n"hello"\n~~~')

    await expect(page.locator(OUTPUT_CONTENT)).not.toContainText("\u201c")
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

    // Demo should be reinitialized with empty input (ghost placeholder visible)
    await expect(page.locator("#punctilio-input")).toHaveValue("")
    await expect(page.locator("#punctilio-input")).toHaveAttribute("placeholder", /can't believe/)
  })
})

test.describe("Visual regression", () => {
  test("Punctilio demo in plaintext mode (screenshot)", async ({ page }, testInfo) => {
    await page.locator("#punctilio-demo").waitFor({ state: "visible" })
    await waitForGhostOutputRendered(page, { monospace: false })

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-plaintext", {
      elementToScreenshot: page.locator("#punctilio-demo"),
    })
  })

  test("Punctilio demo in HTML mode (screenshot)", async ({ page }, testInfo) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await waitForGhostOutputRendered(page, { monospace: true })

    await takeRegressionScreenshot(page, testInfo, "punctilio-demo-html", {
      elementToScreenshot: page.locator("#punctilio-demo"),
    })
  })

  test("Punctilio demo in Markdown mode (screenshot)", async ({ page }, testInfo) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    await waitForGhostOutputRendered(page, { monospace: true })

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

test.describe("Admonition titles update per mode", () => {
  test("output title says 'Text output' in plaintext mode", async ({ page }) => {
    // Plaintext is the default mode
    const outputAdmonition = page
      .locator(OUTPUT_CONTENT)
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(outputAdmonition.locator(".admonition-title-inner")).toContainText("Text output")
  })

  test("output title says 'Markdown source output' in markdown mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    const outputAdmonition = page
      .locator(OUTPUT_CONTENT)
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(outputAdmonition.locator(".admonition-title-inner")).toContainText(
      "Markdown source output",
    )
  })

  test("output title says 'html source output' in HTML mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    const outputAdmonition = page
      .locator(OUTPUT_CONTENT)
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(outputAdmonition.locator(".admonition-title-inner")).toContainText(
      "Html source output",
    )
    await expect(outputAdmonition.locator(".admonition-title-inner abbr.small-caps")).toBeAttached()
  })

  test("input title says 'Input' in plaintext mode", async ({ page }) => {
    const inputAdmonition = page
      .locator("#punctilio-input")
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(inputAdmonition.locator(".admonition-title-inner")).toHaveText(/^Input$/)
  })

  test("input title changes to 'Input your html code' in HTML mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    const inputAdmonition = page
      .locator("#punctilio-input")
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(inputAdmonition.locator(".admonition-title-inner")).toContainText("Input your")
    await expect(inputAdmonition.locator(".admonition-title-inner")).toContainText("code")
    await expect(inputAdmonition.locator(".admonition-title-inner abbr.small-caps")).toBeAttached()
  })

  test("input title stays 'Input' in markdown mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    const inputAdmonition = page
      .locator("#punctilio-input")
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(inputAdmonition.locator(".admonition-title-inner")).toHaveText(/^Input$/)
  })

  test("input title reverts to 'Input' when switching back from HTML mode", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await page.locator('.punctilio-mode-btn[data-mode="plaintext"]').click()
    const inputAdmonition = page
      .locator("#punctilio-input")
      .locator("xpath=ancestor::*[contains(@class,'admonition')]")
    await expect(inputAdmonition.locator(".admonition-title-inner")).toHaveText(/^Input$/)
  })
})

test.describe("Ghost placeholder text per mode", () => {
  for (const [mode, pattern] of [
    ["plaintext", /can't believe it ---/],
    ["markdown", /can't \*believe\*/],
    ["html", /She said "I can't <em>believe<\/em>/],
  ] as const) {
    test(`ghost placeholder matches ${mode} syntax`, async ({ page }) => {
      await page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`).click()
      await expect(page.locator("#punctilio-input")).toHaveAttribute("placeholder", pattern)
    })
  }

  test("ghost class is removed when user types", async ({ page }) => {
    const output = page.locator(OUTPUT_CONTENT)
    await expect(output).toHaveClass(/ghost/)

    await page.locator("#punctilio-input").fill('"Hello"')
    await expect(output).not.toHaveClass(/ghost/)
  })

  test("ghost class returns when input is cleared", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    const output = page.locator(OUTPUT_CONTENT)

    await input.fill('"Hello"')
    await expect(output).not.toHaveClass(/ghost/)

    await input.fill("")
    await expect(output).toHaveClass(/ghost/)
  })
})

test.describe("Input styling", () => {
  test("input has main body font", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    await expect(input).toHaveCSS("font-family", /EBGaramond/)
  })
})

test.describe("Options panel labels", () => {
  test("style options have colons after labels", async ({ page }) => {
    // Check that the label text for select-based options includes a colon
    const punctuationLabel = page.locator("label:has(#opt-punctuation-style)")
    await expect(punctuationLabel).toContainText("Punctuation style:")

    const dashLabel = page.locator("label:has(#opt-dash-style)")
    await expect(dashLabel).toContainText("Dash style:")
  })
})

test.describe("Output monospace styling", () => {
  test("output has monospace class in markdown and html modes, not plaintext", async ({ page }) => {
    const output = page.locator(OUTPUT_CONTENT)

    // Plaintext: no monospace
    await expect(output).not.toHaveClass(/monospace-output/)

    // Markdown: monospace
    await page.locator('.punctilio-mode-btn[data-mode="markdown"]').click()
    await expect(output).toHaveClass(/monospace-output/)

    // HTML: monospace
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()
    await expect(output).toHaveClass(/monospace-output/)

    // Back to plaintext: no monospace
    await page.locator('.punctilio-mode-btn[data-mode="plaintext"]').click()
    await expect(output).not.toHaveClass(/monospace-output/)
  })
})

test.describe("Mode button navigation", () => {
  test("clicking the already-active mode does not clear input", async ({ page }) => {
    const input = page.locator("#punctilio-input")
    await input.fill("Some text")

    const btn = page.locator('.punctilio-mode-btn[data-mode="plaintext"]')
    await expect(btn).toHaveClass(/active/)

    await btn.click()
    await expect(input).toHaveValue("Some text")
  })

  test("inactive mode buttons do not have active class", async ({ page }) => {
    await page.locator('.punctilio-mode-btn[data-mode="html"]').click()

    for (const mode of ["plaintext", "markdown"]) {
      const btn = page.locator(`.punctilio-mode-btn[data-mode="${mode}"]`)
      await expect(btn).not.toHaveClass(/active/)
    }
  })
})
