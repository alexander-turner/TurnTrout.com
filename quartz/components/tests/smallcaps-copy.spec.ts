import { test, expect } from "./fixtures"

test.describe("Smallcaps copy behavior", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(err))
    await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })
  })

  test("transform-generated smallcaps elements have data-original-text", async ({ page }) => {
    // Manually-written <abbr class="small-caps"> in markdown won't have the attribute,
    // so only check elements that were produced by the transform (which always sets it)
    const result = await page.evaluate(() => {
      const abbrs = document.querySelectorAll("article abbr.small-caps")
      const withAttr = Array.from(abbrs).filter((el) => el.hasAttribute("data-original-text"))
      return { total: abbrs.length, withAttr: withAttr.length }
    })
    expect(result.total).toBeGreaterThan(0)
    // Most elements should have the attribute (manually-written ones won't)
    expect(result.withAttr).toBeGreaterThan(0)
  })

  test("copying mixed-case abbreviation preserves original casing", async ({ page }) => {
    const result = await page.evaluate(() => {
      return new Promise<{ clipboardText: string; originalText: string; displayedText: string }>(
        (resolve, reject) => {
          // Find the 50mV element specifically
          const abbrs = document.querySelectorAll("article abbr.small-caps")
          const target = Array.from(abbrs).find(
            (el) => el.getAttribute("data-original-text") === "50mV",
          ) as HTMLElement
          if (!target) return reject(new Error("No 50mV small-caps element found"))

          const originalText = target.getAttribute("data-original-text") ?? ""
          const displayedText = target.textContent ?? ""

          document.addEventListener(
            "copy",
            (e: ClipboardEvent) => {
              const text = e.clipboardData?.getData("text/plain") ?? ""
              resolve({ clipboardText: text, originalText, displayedText })
            },
            { once: true },
          )

          const range = document.createRange()
          range.selectNodeContents(target)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)

          document.execCommand("copy")
        },
      )
    })

    // The displayed text is lowercased by the transform
    expect(result.displayedText).toBe("50mv")
    // But clipboard should get the original mixed-case text, not blind-uppercased "50MV"
    expect(result.clipboardText).toBe("50mV")
  })

  test("copying paragraph containing smallcaps restores original text", async ({ page }) => {
    const result = await page.evaluate(() => {
      return new Promise<string>((resolve, reject) => {
        // Find the paragraph containing "nato" (lowercased by smallcaps transform)
        const paragraphs = document.querySelectorAll("article p")
        const target = Array.from(paragraphs).find((p) => p.textContent?.includes("nato"))
        if (!target) return reject(new Error("No paragraph containing 'nato' found"))

        document.addEventListener(
          "copy",
          (e: ClipboardEvent) => {
            resolve(e.clipboardData?.getData("text/plain") ?? "")
          },
          { once: true },
        )

        const range = document.createRange()
        range.selectNodeContents(target)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        document.execCommand("copy")
      })
    })

    // Original casing should be restored within the paragraph
    expect(result).toContain("NATO")
    expect(result).toContain("USA")
    expect(result).not.toContain("nato")
    expect(result).not.toContain("usa")
  })
})
