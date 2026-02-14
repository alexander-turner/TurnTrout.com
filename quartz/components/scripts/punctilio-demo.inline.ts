import { diffChars } from "diff"
import { transform, type TransformOptions } from "punctilio"
import { rehypePunctilio } from "punctilio/rehype"
import { remarkPunctilio } from "punctilio/remark"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import { unified } from "unified"

import { animate, debounce } from "./component_script_utils"

const svgCopy =
  '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true"><path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path><path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path></svg>'
const svgCheck =
  '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true"><path fill-rule="evenodd" fill="rgb(63, 185, 80)" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>'

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

  // Copy output button — reuses clipboard icon style from code blocks
  if (copyBtn) {
    copyBtn.innerHTML = svgCopy
    copyBtn.addEventListener(
      "click",
      () => {
        if (!output) return
        navigator.clipboard.writeText(output.value).then(
          () => {
            copyBtn.blur()
            copyBtn.innerHTML = svgCheck
            animate(
              2000,
              () => {
                // No per-frame updates needed
              },
              () => {
                copyBtn.innerHTML = svgCopy
                copyBtn.style.borderColor = ""
              },
            )
          },
          (error) => console.error(error),
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
