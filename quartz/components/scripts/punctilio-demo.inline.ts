import { diffChars } from "diff"
import { transform, type TransformOptions } from "punctilio"
import { rehypePunctilio } from "punctilio/rehype"
import { remarkPunctilio } from "punctilio/remark"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import { unified } from "unified"

import { debounce, escapeHtml } from "./component_script_utils"

const EXAMPLE_PLAINTEXT = `She said, "It's a 'beautiful' thing..."

The temperature was 72F -- perfect for Mr. Smith.

(c) 2024 Acme Corp. 2x + 3 != 5`

const EXAMPLE_MARKDOWN = `She said, "It's *beautiful*" -- really.

\`\`\`python
x = "don't transform this"
\`\`\`

Inline math like $E = mc^2$ is preserved.

(c) 2024 Acme Corp. 2x faster!`

const EXAMPLE_HTML = `<p>She said, "Don't you think it's <em>wonderful</em>?"</p>

<p>(c) 2024 Acme Corp. 2x faster!</p>

<pre><code>x = "don't transform this"</code></pre>`

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
 * Transform Markdown using punctilio's remark plugin pipeline.
 * Handles code blocks, inline code, and other Markdown syntax
 * automatically via the MDAST-based remarkPunctilio transformer.
 */
function transformMarkdownText(text: string, config: TransformOptions): string {
  const result = unified()
    .use(remarkParse)
    .use(remarkPunctilio, config)
    .use(remarkStringify)
    .processSync(text)
  return String(result)
}

// ─── HTML mode ───────────────────────────────────────────────────────

/**
 * Transform HTML using punctilio's rehype plugin pipeline.
 * Handles cross-element text (e.g., quotes spanning <em> tags),
 * skip tags (code, pre, kbd, etc.), and separator-based text joining
 * automatically via rehypePunctilio.
 */
function transformHtmlText(html: string, config: TransformOptions): string {
  const result = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypePunctilio, config)
    .use(rehypeStringify)
    .processSync(html)
  return String(result)
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
      const escaped = escapeHtml(change.value).replace(/\n/g, "<br>")
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
