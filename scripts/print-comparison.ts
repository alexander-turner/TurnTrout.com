/**
 * Captures before/after screenshots comparing screen vs print rendering.
 *
 * Usage:
 *   npx tsx scripts/print-comparison.ts [url]
 *
 * Defaults to http://localhost:8080 if no URL provided.
 * Outputs: print-before.png (screen) and print-after.png (print emulation)
 */

import { chromium } from "playwright"

const url = process.argv[2] ?? "http://localhost:8080"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 900, height: 1200 },
    colorScheme: "light",
  })
  const page = await context.newPage()

  await page.goto(url, { waitUntil: "networkidle" })

  // Force light theme and white background
  await page.evaluate(() => {
    document.documentElement.setAttribute("saved-theme", "light")
    document.body.style.backgroundColor = "white"
  })

  // Screen view
  await page.screenshot({ path: "print-before.png", fullPage: true })
  console.log("Saved print-before.png (screen)")

  // Print emulation
  await page.emulateMedia({ media: "print" })
  await page.screenshot({ path: "print-after.png", fullPage: true })
  console.log("Saved print-after.png (print)")

  await browser.close()
}

main()
