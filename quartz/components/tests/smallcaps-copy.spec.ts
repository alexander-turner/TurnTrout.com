import { test, expect } from "./fixtures"

test.describe("Smallcaps copy behavior", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(err))
    await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })
  })

  test("smallcaps elements have data-original-text attribute", async ({ page }) => {
    const hasAttribute = await page.evaluate(() => {
      const abbrs = document.querySelectorAll("article abbr.small-caps")
      return (
        abbrs.length > 0 && Array.from(abbrs).every((el) => el.hasAttribute("data-original-text"))
      )
    })
    expect(hasAttribute).toBe(true)
  })

  test("copying smallcaps text restores original casing via data-original-text", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      return new Promise<{ clipboardText: string; originalText: string }>((resolve, reject) => {
        // Find the first smallcaps element in the article
        const abbr = document.querySelector("article abbr.small-caps") as HTMLElement
        if (!abbr) return reject(new Error("No small-caps element found"))

        const originalText = abbr.getAttribute("data-original-text") ?? ""

        // Add a listener that runs after the smallcaps copy handler
        document.addEventListener(
          "copy",
          (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData("text/plain") ?? ""
            resolve({ clipboardText: text, originalText })
          },
          { once: true },
        )

        // Select the element's contents
        const range = document.createRange()
        range.selectNodeContents(abbr)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)

        // Trigger copy
        document.execCommand("copy")
      })
    })

    expect(result.originalText).toBeTruthy()
    expect(result.clipboardText).toBe(result.originalText)
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
        // Find the paragraph containing "NATO"
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
