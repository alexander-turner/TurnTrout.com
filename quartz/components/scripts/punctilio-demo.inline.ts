import { transform, type TransformOptions } from "punctilio"

import { debounce } from "./component_script_utils"

const EXAMPLE_PLAINTEXT = `"It's a beautiful thing..." -- George Orwell, 1984

She said, "Don't you think it's wonderful?"

The temperature was 72F -- perfect for a 5'10" man.

(c) 2024 Acme Corp. All rights reserved. (r)

2x + 3 != 5

Section 8.3 -- see pp. 12-15 for more details.`

const EXAMPLE_MARKDOWN = `# "Hello, World!"

This is a *beautiful* thing -- really, it is.

She said, "I've been working on \`transform()\` for months."

The building was 5'10" tall. That's >= 170cm.

\`\`\`python
x = "don't transform this"
print(x)
\`\`\`

See the [documentation](https://example.com/it's-fine) for more.

(c) 2024 Acme Corp. 2x faster than before!`

const EXAMPLE_HTML = `<p>"It's a beautiful thing..." -- George Orwell, 1984</p>

<p>She said, "Don't you think it's <em>wonderful</em>?"</p>

<p>The temperature was 72F -- perfect for a 5'10" man.</p>

<p>(c) 2024 Acme Corp. 2x faster!</p>

<pre><code>x = "don't transform this"</code></pre>`

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"])

type TransformMode = "plaintext" | "markdown" | "html"

function getConfig(): TransformOptions {
  return {
    punctuationStyle:
      (document.querySelector<HTMLSelectElement>("#opt-punctuation-style")?.value as
        | "american"
        | "british"
        | "none") ?? "american",
    dashStyle:
      (document.querySelector<HTMLSelectElement>("#opt-dash-style")?.value as
        | "american"
        | "british"
        | "none") ?? "american",
    symbols: document.querySelector<HTMLInputElement>("#opt-symbols")?.checked ?? true,
    fractions: document.querySelector<HTMLInputElement>("#opt-fractions")?.checked ?? false,
    degrees: document.querySelector<HTMLInputElement>("#opt-degrees")?.checked ?? false,
    superscript: document.querySelector<HTMLInputElement>("#opt-superscript")?.checked ?? false,
    ligatures: document.querySelector<HTMLInputElement>("#opt-ligatures")?.checked ?? false,
    nbsp: document.querySelector<HTMLInputElement>("#opt-nbsp")?.checked ?? true,
  }
}

/**
 * Protect markdown syntax (code blocks, inline code, link/image URLs)
 * from being transformed, run the transform on the remaining text,
 * then restore the protected content.
 */
function transformMarkdownText(text: string, config: TransformOptions): string {
  const placeholders: string[] = []
  const MARKER = "\uF8FF" // Private-use character unlikely to appear in input

  function protect(match: string): string {
    const idx = placeholders.length
    placeholders.push(match)
    return `${MARKER}${idx}${MARKER}`
  }

  let result = text

  // Protect fenced code blocks (``` ... ```)
  result = result.replace(/```[\s\S]*?```/g, protect)
  // Protect inline code (`...`)
  result = result.replace(/`[^`\n]+`/g, protect)
  // Protect image/link URLs: ![alt](url) or [text](url)
  result = result.replace(/!?\[[^\]]*\]\([^)]+\)/g, protect)
  // Protect reference-style link definitions: [id]: url
  result = result.replace(/^\[[^\]]+\]:\s+\S+.*$/gm, protect)
  // Protect raw URLs (http/https)
  result = result.replace(/https?:\/\/\S+/g, protect)

  result = transform(result, config)

  // Restore placeholders
  result = result.replace(new RegExp(`${MARKER}(?<idx>\\d+)${MARKER}`, "g"), (...args) => {
    const groups = args[args.length - 1] as { idx: string }
    return placeholders[parseInt(groups.idx)]
  })

  return result
}

function hasSkippedAncestor(element: Element | null): boolean {
  let current = element
  while (current) {
    if (SKIP_TAGS.has(current.tagName)) return true
    current = current.parentElement
  }
  return false
}

/**
 * Parse HTML with DOMParser, walk text nodes (skipping elements with
 * code/script/style/pre ancestors), apply transform() to each text node,
 * then serialize back.
 */
function transformHtmlText(html: string, config: TransformOptions): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html")

  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)

  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  for (const textNode of textNodes) {
    if (hasSkippedAncestor(textNode.parentElement)) continue
    if (textNode.textContent) {
      textNode.textContent = transform(textNode.textContent, config)
    }
  }

  return doc.body.innerHTML
}

function doTransform(text: string, mode: TransformMode, config: TransformOptions): string {
  switch (mode) {
    case "plaintext":
      return transform(text, config)
    case "markdown":
      return transformMarkdownText(text, config)
    case "html":
      return transformHtmlText(text, config)
  }
}

const EXAMPLES: Record<TransformMode, string> = {
  plaintext: EXAMPLE_PLAINTEXT,
  markdown: EXAMPLE_MARKDOWN,
  html: EXAMPLE_HTML,
}

let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  abortController?.abort()

  const container = document.getElementById("punctilio-demo")
  if (!container) return

  const input = document.getElementById("punctilio-input") as HTMLTextAreaElement | null
  const output = document.getElementById("punctilio-output") as HTMLTextAreaElement | null
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".punctilio-mode-btn")

  if (!input || !output) return

  const controller = new AbortController()
  abortController = controller
  const { signal } = controller

  let currentMode: TransformMode = "plaintext"

  function runTransform() {
    if (!input || !output) return
    const config = getConfig()
    output.value = doTransform(input.value, currentMode, config)
  }

  const debouncedTransform = debounce(runTransform, 100)

  // Set initial example text and transform
  input.value = EXAMPLES[currentMode]
  runTransform()

  // Live transform on input
  input.addEventListener("input", debouncedTransform, { signal })

  // Mode switching
  for (const btn of modeButtons) {
    btn.addEventListener(
      "click",
      () => {
        for (const b of modeButtons) b.classList.remove("active")
        btn.classList.add("active")
        const newMode = (btn.dataset.mode ?? "plaintext") as TransformMode
        if (newMode !== currentMode) {
          currentMode = newMode
          input.value = EXAMPLES[currentMode]
        }
        runTransform()
      },
      { signal },
    )
  }

  // Options changes trigger re-transform
  const optionInputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    ".punctilio-options input, .punctilio-options select",
  )
  for (const opt of optionInputs) {
    opt.addEventListener("change", runTransform, { signal })
  }
})
