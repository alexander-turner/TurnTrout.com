import { diffChars } from "diff"
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

Inline math like $E = mc^2$ is preserved.

See the [documentation](https://example.com/it's-fine) for more.

(c) 2024 Acme Corp. 2x faster than before!`

const EXAMPLE_HTML = `<p>"It's a beautiful thing..." -- George Orwell, 1984</p>

<p>She said, "Don't you think it's <em>wonderful</em>?"</p>

<p>The temperature was 72F -- perfect for a 5'10" man.</p>

<p>(c) 2024 Acme Corp. 2x faster!</p>

<pre><code>x = "don't transform this"</code></pre>`

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "KBD", "VAR", "SAMP"])

// Unicode Private Use Area character — used as separator for cross-element
// text handling. The punctilio transform() treats this character as transparent
// in its regex patterns, allowing proper quote pairing across element boundaries.
const SEPARATOR = "\uE000"

// Maximum combined input+output length for character-level diff.
// Beyond this, show plain output to avoid excessive memory use.
const MAX_DIFF_LENGTH = 10_000

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

// ─── Markdown mode ───────────────────────────────────────────────────

/**
 * Protect Markdown syntax (code blocks, inline code, links, math, HTML
 * blocks, URLs) from being transformed, run the transform on the
 * remaining text, then restore the protected content.
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

  // Protect YAML front matter at start of text
  result = result.replace(/^---\n[\s\S]*?\n---/m, protect)
  // Protect fenced code blocks (``` or ~~~, with optional language)
  // Use backreference to ensure opening and closing delimiters match
  result = result.replace(/(?<fence>```|~~~)[\s\S]*?\k<fence>/g, protect)
  // Protect math display blocks ($$...$$)
  result = result.replace(/\$\$[\s\S]*?\$\$/g, protect)
  // Protect inline math ($...$) — requires non-space after opening and before closing $
  result = result.replace(/\$(?!\s)[^$\n]+(?<!\s)\$/g, protect)
  // Protect inline code — double backtick first, then single
  result = result.replace(/``[^`]+``/g, protect)
  result = result.replace(/`[^`\n]+`/g, protect)
  // Protect HTML blocks (<tag>...</tag> spanning lines)
  result = result.replace(/^<(?<tag>[a-zA-Z][\w-]*)(?:\s[^>]*)?>[\s\S]*?<\/\k<tag>>/gm, protect)
  // Protect self-closing HTML tags
  result = result.replace(/<[a-zA-Z][\w-]*(?:\s[^>]*)?\s*\/>/g, protect)
  // Protect image/link URLs: ![alt](url) or [text](url)
  result = result.replace(/!?\[[^\]]*\]\([^)]*\)/g, protect)
  // Protect reference-style link definitions: [id]: url
  result = result.replace(/^\[[^\]]+\]:\s+\S+.*$/gm, protect)
  // Protect autolinks: <http://...> or <email@example.com>
  result = result.replace(/<(?:https?:\/\/[^\s>]+|[^\s>]+@[^\s>]+)>/g, protect)
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

// ─── HTML mode with cross-element text handling ──────────────────────

/**
 * Recursively collect all text nodes from a DOM subtree, skipping
 * elements in SKIP_TAGS. This allows text spanning multiple inline
 * elements (e.g., <em>, <strong>) to be transformed as a unit.
 */
function flattenDomTextNodes(node: Node): Text[] {
  const result: Text[] = []
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      result.push(child as Text)
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      if (!SKIP_TAGS.has(el.tagName)) {
        result.push(...flattenDomTextNodes(el))
      }
    }
  }
  return result
}

/**
 * Find elements that directly contain non-whitespace text nodes.
 * When found, the element is collected (its inline descendants'
 * text will be included via flattenDomTextNodes). Otherwise,
 * recurse into children to find deeper elements with text.
 */
function collectTransformableElements(node: Element): Element[] {
  if (SKIP_TAGS.has(node.tagName)) return []

  const hasDirectText = Array.from(node.childNodes).some(
    (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim().length > 0,
  )

  if (hasDirectText) return [node]

  const results: Element[] = []
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      results.push(...collectTransformableElements(child as Element))
    }
  }
  return results
}

/**
 * Apply the transform to an element's text using the separator technique
 * from punctilio's rehype plugin. This correctly handles text spanning
 * multiple HTML elements (e.g., quotes wrapping <em> or <strong> tags).
 *
 * Approach:
 * 1. Flatten all text nodes from the element (descending into inline children)
 * 2. Append a separator after each text node's content and concatenate
 * 3. Transform the concatenated text (separator is transparent to the regexes)
 * 4. Split by separator and assign fragments back to original text nodes
 */
function transformElementDom(node: Element, config: TransformOptions): void {
  const textNodes = flattenDomTextNodes(node)
  if (textNodes.length === 0) return

  const markedContent = textNodes.map((n) => (n.textContent ?? "") + SEPARATOR).join("")
  const transformed = transform(markedContent, { ...config, separator: SEPARATOR })
  const fragments = transformed.split(SEPARATOR).slice(0, -1)

  // Safety: if the transform consumed separators, bail out
  if (fragments.length !== textNodes.length) return

  for (let i = 0; i < textNodes.length; i++) {
    textNodes[i].textContent = fragments[i]
  }
}

/**
 * Parse HTML with DOMParser, walk the tree applying the separator-based
 * transform to each element's text content, then serialize back.
 *
 * This correctly handles cross-element text — e.g., in
 *   <p>"Hello <em>world</em>"</p>
 * the opening and closing quotes are in separate text nodes but will
 * be transformed as a unit, producing proper smart quote pairing.
 */
function transformHtmlText(html: string, config: TransformOptions): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html")

  const processed = new WeakSet<Element>()
  const elements = collectTransformableElements(doc.body)

  for (const el of elements) {
    if (processed.has(el)) continue
    transformElementDom(el, config)
    processed.add(el)
    // Mark descendants to prevent double-processing
    for (const desc of el.querySelectorAll("*")) {
      processed.add(desc)
    }
  }

  return doc.body.innerHTML
}

/**
 * Sanitize HTML for the rendered preview by stripping event handlers
 * and javascript: URLs.
 */
function sanitizeHtmlForPreview(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html")
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of Array.from(el.attributes)) {
      const val = attr.value.trim().toLowerCase()
      if (
        attr.name.startsWith("on") ||
        ((attr.name === "href" || attr.name === "src") &&
          (val.startsWith("javascript:") || val.startsWith("data:")))
      ) {
        el.removeAttribute(attr.name)
      }
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
    default: {
      const exhaustive: never = mode
      throw new Error(`Unknown mode: ${exhaustive}`)
    }
  }
}

const EXAMPLES: Record<TransformMode, string> = {
  plaintext: EXAMPLE_PLAINTEXT,
  markdown: EXAMPLE_MARKDOWN,
  html: EXAMPLE_HTML,
}

// ─── Inline diff highlighting ────────────────────────────────────────

/** Render diff changes as HTML spans with appropriate classes. */
function renderDiffHtml(changes: ReturnType<typeof diffChars>): string {
  return changes
    .map((change) => {
      const escaped = change.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
      if (change.added) return `<span class="diff-insert">${escaped}</span>`
      if (change.removed) return `<span class="diff-delete">${escaped}</span>`
      return escaped
    })
    .join("")
}

// ─── Main nav handler ────────────────────────────────────────────────

let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  abortController?.abort()

  const container = document.getElementById("punctilio-demo")
  if (!container) return

  const input = document.getElementById("punctilio-input") as HTMLTextAreaElement | null
  const output = document.getElementById("punctilio-output") as HTMLTextAreaElement | null
  const diffOutput = document.getElementById("punctilio-diff") as HTMLElement | null
  const htmlPreview = document.getElementById("punctilio-html-preview") as HTMLElement | null
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".punctilio-mode-btn")
  const copyBtn = document.getElementById("punctilio-copy-btn") as HTMLButtonElement | null
  const diffToggle = document.getElementById("punctilio-diff-toggle") as HTMLInputElement | null

  if (!input || !output) return

  const controller = new AbortController()
  abortController = controller
  const { signal } = controller

  let currentMode: TransformMode = "plaintext"

  function runTransform() {
    if (!input || !output) return
    const config = getConfig()
    const result = doTransform(input.value, currentMode, config)
    output.value = result

    // Diff highlighting
    if (diffOutput) {
      const showDiff = diffToggle?.checked ?? true
      if (showDiff) {
        if (input.value.length + result.length > MAX_DIFF_LENGTH) {
          diffOutput.textContent = result
        } else {
          const segments = diffChars(input.value, result)
          diffOutput.innerHTML = renderDiffHtml(segments)
        }
        diffOutput.style.display = ""
        output.style.display = "none"
      } else {
        diffOutput.style.display = "none"
        output.style.display = ""
      }
    }

    // HTML rendered preview
    if (htmlPreview) {
      if (currentMode === "html") {
        htmlPreview.style.display = ""
        htmlPreview.innerHTML = sanitizeHtmlForPreview(result)
      } else {
        htmlPreview.style.display = "none"
      }
    }
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

  // Copy output button
  if (copyBtn) {
    copyBtn.addEventListener(
      "click",
      () => {
        if (!output) return
        navigator.clipboard.writeText(output.value).then(
          () => {
            const original = copyBtn.textContent
            copyBtn.textContent = "Copied!"
            setTimeout(() => {
              copyBtn.textContent = original
            }, 1500)
          },
          () => {
            copyBtn.textContent = "Failed"
            setTimeout(() => {
              copyBtn.textContent = "Copy"
            }, 1500)
          },
        )
      },
      { signal },
    )
  }

  // Diff toggle
  if (diffToggle) {
    diffToggle.addEventListener("change", runTransform, { signal })
  }
})
