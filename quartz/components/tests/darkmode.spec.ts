import { test, expect, type Page } from "@playwright/test"

import { type Theme } from "../scripts/darkmode"
import { setTheme as utilsSetTheme } from "./visual_utils"

const AUTO_THEME: Theme = "light"
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })
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
    const storedTheme = await this.page.evaluate(() => localStorage.getItem("saved-theme"))
    expect(storedTheme).toBe(expectedTheme)
  }

  async clickToggle(): Promise<void> {
    await this.page.locator("#theme-toggle").click()
  }

  async verifyThemeLabel(expectedTheme: Theme): Promise<void> {
    const label = await this.page.locator("#theme-label").textContent()
    const expectedLabel = expectedTheme.charAt(0).toUpperCase() + expectedTheme.slice(1)
    expect(label).toBe(expectedLabel)
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

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await helper.verifyTheme(scheme)

    // We're in auto mode the whole time
    await helper.verifyThemeLabel("auto")
    await helper.verifyStorage("auto")
  }
})

test.describe("Theme persistence and UI states", () => {
  for (const theme of ["light", "dark", "auto"] as const) {
    test(`persists ${theme} theme across reloads`, async ({ page }) => {
      const helper = new DarkModeHelper(page)
      await helper.setTheme(theme)
      await helper.verifyThemeLabel(theme)

      await page.reload()
      await helper.verifyTheme(theme)
      await helper.verifyStorage(theme)
      await helper.verifyThemeLabel(theme)
    })
  }
})

// Verify that dark mode toggle works w/ both the real button and the helper
for (const useButton of [true, false]) {
  const method = useButton ? "clickToggle" : "setTheme"

  test(`Dark mode icons toggle correctly through states (method: ${method})`, async ({ page }) => {
    const helper = new DarkModeHelper(page)
    const states: Theme[] = ["auto", "light", "dark", "auto"]

    for (const [index, theme] of states.entries()) {
      await helper.verifyTheme(theme)
      await helper.verifyThemeLabel(theme)

      if (index < states.length - 1) {
        if (useButton) {
          await helper.clickToggle()
        } else {
          await helper.setTheme(states[index + 1])
        }
      }
    }
  })
}

/* If detectDarkMode.js isn't working right, the FOUC will happen here */
test("No flash of unstyled content on page load", async ({ page }) => {
  const afterScreenshots = new Map<Theme, Buffer>()
  const minimalHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="/index.css">
        <script id="detect-dark-mode" src="/static/scripts/detectDarkMode.js"></script>
      </head>
      <body>
      </body>
    </html>
  `

  for (const initialTheme of ["light", "dark", "auto"] as const) {
    // Set up initial conditions before loading page
    await page.addInitScript((initialTheme: Theme) => {
      localStorage.clear()
      localStorage.setItem("saved-theme", initialTheme)
    }, initialTheme)
    const themeToSet = initialTheme === "auto" ? AUTO_THEME : initialTheme
    await page.emulateMedia({ colorScheme: themeToSet })

    // Load the minimal page first
    await page.reload()
    await page.setContent(minimalHtml, { waitUntil: "domcontentloaded" })

    // Take first screenshot immediately after script injection
    const firstScreenshot = await page.screenshot()

    // Wait for styles to be applied
    await page.waitForLoadState("networkidle")
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

for (const prefix of ["./shard-theory", "./about", "./design#"]) {
  for (const theme of ["light", "dark", "auto"] as const) {
    test(`Internal navigation preserves theme label (prefix: ${prefix}, theme: ${theme})`, async ({
      page,
    }) => {
      const helper = new DarkModeHelper(page)
      await helper.setTheme(theme)
      await helper.verifyThemeLabel(theme)

      // Navigate to a different internal page
      // NOTE I think it should be fine to not click
      await page.goto(`http://localhost:8080/test-page`)
      await helper.verifyThemeLabel(theme)
      await helper.verifyTheme(theme)
    })
  }
}
