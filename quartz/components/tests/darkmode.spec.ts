import type { Page } from "@playwright/test"

import { savedThemeKey } from "../constants"
import { type Theme } from "../scripts/darkmode"
import { test, expect } from "./fixtures"
import { gotoPage, setTheme as utilsSetTheme } from "./visual_utils"

// False negative because the helpers call expect
/* eslint-disable playwright/expect-expect */

// Test constants
const AUTO_THEME: Theme = "light"
const THEME_SCHEMES = ["light", "dark"] as const
const ALL_THEMES = ["light", "dark", "auto"] as const
const NAVIGATION_PREFIXES = ["./shard-theory", "./about", "./design#"]

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")
  await page.emulateMedia({ colorScheme: AUTO_THEME })
})

class DarkModeHelper {
  page: Page

  constructor(page: Page) {
    this.page = page
  }

  async getTheme(): Promise<string> {
    const theme = await this.page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    )
    return theme || AUTO_THEME
  }

  async setTheme(theme: Theme): Promise<void> {
    await utilsSetTheme(this.page, theme)
  }

  async verifyTheme(expectedTheme: Theme): Promise<void> {
    const actualTheme =
      expectedTheme === "auto"
        ? await this.page.evaluate(() =>
            window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
          )
        : expectedTheme

    await expect(this.page.locator(":root")).toHaveAttribute("data-theme", actualTheme)
    await expect(this.page.locator("#day-icon")).toBeVisible({ visible: actualTheme === "light" })
    await expect(this.page.locator("#night-icon")).toBeVisible({ visible: actualTheme === "dark" })
  }

  async verifyStorage(expectedTheme: Theme): Promise<void> {
    // Wait inside the browser context for setupDarkMode() to write to
    // localStorage after a reload (avoids Safari timing flake).
    await this.page.waitForFunction(
      ({ key, expected }) => localStorage.getItem(key) === expected,
      { key: savedThemeKey, expected: expectedTheme },
      { timeout: 5_000 },
    )
  }

  async clickToggle(): Promise<void> {
    await this.page.locator("#theme-toggle").click()
  }

  async verifyThemeLabel(expectedTheme: Theme): Promise<void> {
    const expectedLabel = expectedTheme.charAt(0).toUpperCase() + expectedTheme.slice(1)

    // The theme label text is displayed via CSS ::after pseudo-element
    // We need to read the CSS custom property value instead of textContent
    const labelContent = await this.page.evaluate(() => {
      const computedStyle = getComputedStyle(document.documentElement)
      return computedStyle.getPropertyValue("--theme-label-content").replace(/"/g, "")
    })

    expect(labelContent).toBe(expectedLabel)
  }
}

test("Dark mode toggle changes icon's visual state", async ({ page }) => {
  const helper = new DarkModeHelper(page)
  await helper.verifyTheme(AUTO_THEME)
  const initialSpan = page.locator("#darkmode-span")
  const initialIcon = await initialSpan.screenshot()

  await helper.clickToggle()
  await expect(async () => {
    expect(await initialSpan.screenshot()).not.toEqual(initialIcon)
  }).toPass()
})

test("System preference changes are reflected in auto mode", async ({ page }) => {
  const helper = new DarkModeHelper(page)
  await helper.setTheme("auto")
  await helper.verifyThemeLabel("auto")

  for (const scheme of THEME_SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme })
    await helper.verifyTheme(scheme)

    // We're in auto mode the whole time
    await helper.verifyThemeLabel("auto")
    await helper.verifyStorage("auto")
  }
})

test.describe("Theme persistence and UI states", () => {
  ALL_THEMES.forEach((theme) => {
    test(`persists ${theme} theme across reloads`, async ({ page }, testInfo) => {
      test.slow(testInfo.project.name.includes("Safari"), "WebKit page loads are slow in CI")

      const helper = new DarkModeHelper(page)
      await helper.setTheme(theme)
      await helper.verifyThemeLabel(theme)

      // Navigate to a genuinely different page so that init scripts re-run
      // in all browsers including Safari/WebKit.  Same-URL goto() in Safari
      // may be treated as a soft refresh and skip re-running JS init scripts,
      // leaving data-theme unset.
      await gotoPage(page, "http://localhost:8080/about")
      await helper.verifyTheme(theme)
      await helper.verifyStorage(theme)
      await helper.verifyThemeLabel(theme)
    })
  })
})

// Verify that dark mode toggle works w/ both the real button and the helper
test("Dark mode icons toggle correctly through states using clickToggle", async ({ page }) => {
  const helper = new DarkModeHelper(page)
  const states: Theme[] = ["auto", "light", "dark", "auto"]

  // Iterate through transitions
  for (let i = 0; i < states.length - 1; i++) {
    const currentState = states[i]
    await helper.verifyTheme(currentState)
    await helper.verifyThemeLabel(currentState)
    await helper.clickToggle()
  }

  // Verify the final state
  const finalState = states[states.length - 1]
  await helper.verifyTheme(finalState)
  await helper.verifyThemeLabel(finalState)
})

test("Dark mode icons toggle correctly through states using setTheme", async ({ page }) => {
  const helper = new DarkModeHelper(page)
  const states: Theme[] = ["auto", "light", "dark", "auto"]

  // Iterate through transitions
  for (let i = 0; i < states.length - 1; i++) {
    const currentState = states[i]
    const nextState = states[i + 1]
    await helper.verifyTheme(currentState)
    await helper.verifyThemeLabel(currentState)
    await helper.setTheme(nextState)
  }

  // Verify the final state
  const finalState = states[states.length - 1]
  await helper.verifyTheme(finalState)
  await helper.verifyThemeLabel(finalState)
})

/* If detectInitialState.js isn't working right, the FOUC will happen here */
test("No flash of unstyled content on page load", async ({ page }) => {
  const afterScreenshots = new Map<Theme, Buffer>()
  const minimalHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="/index.css">
        <script id="detect-initial-state" src="/static/scripts/detectInitialState.js"></script>
      </head>
      <body>
      </body>
    </html>
  `

  for (const initialTheme of ["light", "dark", "auto"] as const) {
    // Set up initial conditions before loading page
    await page.addInitScript(
      ({ initialTheme, key }: { initialTheme: Theme; key: string }) => {
        localStorage.clear()
        localStorage.setItem(key, initialTheme)
      },
      { initialTheme, key: savedThemeKey },
    )
    // eslint-disable-next-line playwright/no-conditional-in-test
    const themeToSet = initialTheme === "auto" ? AUTO_THEME : initialTheme
    await page.emulateMedia({ colorScheme: themeToSet })

    await page.setContent(minimalHtml, { waitUntil: "domcontentloaded" })

    // Take first screenshot immediately after script injection
    const firstScreenshot = await page.screenshot()

    // Wait for styles to be applied
    await page.waitForLoadState("load")
    const afterLoadScreenshot = await page.screenshot()
    afterScreenshots.set(initialTheme, afterLoadScreenshot)

    // Compare screenshots - they should be identical if no FOUC occurred
    expect(Buffer.from(firstScreenshot).toString("base64")).toEqual(
      Buffer.from(afterLoadScreenshot).toString("base64"),
    )

    // Verify root theme is set correctly
    const helper = new DarkModeHelper(page)
    const currentTheme = (await helper.getTheme()) as Theme
    expect(currentTheme).toBe(themeToSet)
  }

  // Verify different themes produce different visual states
  expect(afterScreenshots.size).toBe(3)
  expect(afterScreenshots.get("light")).not.toEqual(afterScreenshots.get("dark"))
  expect(afterScreenshots.get(AUTO_THEME)).toEqual(afterScreenshots.get("auto"))
  expect(afterScreenshots.get("dark")).not.toEqual(afterScreenshots.get("auto"))
})

NAVIGATION_PREFIXES.forEach((prefix) => {
  ALL_THEMES.forEach((theme) => {
    test(`Internal navigation preserves theme label (prefix: ${prefix}, theme: ${theme})`, async ({
      page,
    }) => {
      const helper = new DarkModeHelper(page)
      await helper.setTheme(theme)
      await helper.verifyThemeLabel(theme)

      // Confirm localStorage is set before navigating — WebKit on Linux
      // can occasionally drop localStorage if we navigate too quickly.
      await helper.verifyStorage(theme)

      // Navigate to a genuinely different page (using the prefix) so that
      // init scripts re-run in all browsers including Safari/WebKit.
      // Same-URL goto() in Safari may be treated as a soft refresh and skip
      // re-running JS init scripts, leaving --theme-label-content unset.
      const targetPath = prefix.replace(/^\.\//, "").replace(/#.*$/, "")
      await gotoPage(page, `http://localhost:8080/${targetPath}`)

      // Verify localStorage survived navigation, then wait for the init
      // script to apply the label (CSS custom property may lag on Safari).
      await helper.verifyStorage(theme)
      await expect(async () => {
        await helper.verifyThemeLabel(theme)
      }).toPass({ timeout: 15_000 })
      await helper.verifyTheme(theme)
    })
  })
})
