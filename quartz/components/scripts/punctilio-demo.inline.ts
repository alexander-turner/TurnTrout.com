import { diffChars } from "diff"
import { transform, type TransformOptions } from "punctilio"
import { rehypePunctilio } from "punctilio/rehype"
import { remarkPunctilio } from "punctilio/remark"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import remarkStringify from "remark-stringify"
import { unified } from "unified"

import { animate, debounce, escapeHtml, svgCheck, svgCopy } from "./component_script_utils"

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

const STORAGE_KEY_INPUT = "punctilio-input"
const STORAGE_KEY_MODE = "punctilio-mode"
const STORAGE_KEY_OPT_PREFIX = "punctilio-opt-"
const OPTION_INPUTS_SELECTOR = ".punctilio-options-list input, .punctilio-options-list select"

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

/** Render transformed Markdown as HTML for the preview panel. */
function renderMarkdownToHtml(text: string, config: TransformOptions): string {
  const result = unified()
    .use(remarkParse)
    .use(remarkPunctilio, config)
    .use(remarkRehype)
    .use(rehypeStringify)
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

/** Render diff changes as HTML spans, showing only additions (green) and unchanged text. */
function renderDiffHtml(changes: ReturnType<typeof diffChars>): string {
  return changes
    .filter((change) => !change.removed)
    .map((change) => {
      const escaped = escapeHtml(change.value).replace(/\n/g, "<br>")
      if (change.added) return `<span class="diff-insert">${escaped}</span>`
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
  const previewSection = document.getElementById("punctilio-preview-section") as HTMLElement | null
  const preview = document.getElementById("punctilio-preview") as HTMLElement | null
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".punctilio-mode-btn")
  const copyBtn = document.getElementById("punctilio-copy-btn") as HTMLButtonElement | null
  const outputHeading = document.getElementById("punctilio-output-heading")

  if (!input || !output) return

  const controller = new AbortController()
  abortController = controller
  const { signal } = controller

  // Restore saved mode and input, or fall back to defaults
  const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as TransformMode | null
  let currentMode: TransformMode = savedMode && savedMode in EXAMPLES ? savedMode : "plaintext"

  const optionInputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    OPTION_INPUTS_SELECTOR,
  )

  // Restore select values from localStorage
  for (const opt of optionInputs) {
    if (!(opt instanceof HTMLSelectElement)) continue
    const saved = localStorage.getItem(STORAGE_KEY_OPT_PREFIX + opt.id)
    if (saved && Array.from(opt.options).some((o) => o.value === saved)) {
      opt.value = saved
    }
  }

  function runTransform() {
    if (!input || !output) return
    const config = getConfig()
    const result = doTransform(input.value, currentMode, config)
    output.value = result

    // Persist input text and mode
    sessionStorage.setItem(STORAGE_KEY_INPUT, input.value)
    localStorage.setItem(STORAGE_KEY_MODE, currentMode)

    // Diff highlighting (always shown)
    if (diffOutput) {
      if (input.value.length + result.length > MAX_DIFF_LENGTH) {
        diffOutput.textContent = result
      } else {
        const segments = diffChars(input.value, result)
        diffOutput.innerHTML = renderDiffHtml(segments)
      }
      diffOutput.style.display = ""
      output.style.display = "none"
    }

    // Update output heading text and monospace styling per mode
    if (outputHeading) {
      if (currentMode === "html") {
        outputHeading.innerHTML = '<abbr class="small-caps">html</abbr>'
      } else if (currentMode === "markdown") {
        outputHeading.textContent = "Markdown"
      } else {
        outputHeading.textContent = "Output"
      }
    }
    const isCodeMode = currentMode === "markdown" || currentMode === "html"
    diffOutput?.classList.toggle("monospace-output", isCodeMode)
    output.classList.toggle("monospace-output", isCodeMode)

    if (!previewSection || !preview) return

    if (currentMode === "html") {
      previewSection.style.display = ""
      preview.innerHTML = result
    } else if (currentMode === "markdown") {
      previewSection.style.display = ""
      preview.innerHTML = renderMarkdownToHtml(input.value, config)
    } else {
      previewSection.style.display = "none"
    }
  }

  const debouncedTransform = debounce(runTransform, 100)

  // Restore saved input or use example text for the current mode
  const savedInput = sessionStorage.getItem(STORAGE_KEY_INPUT)
  input.value = savedInput ?? EXAMPLES[currentMode]

  // Sync mode button active state with restored mode
  for (const b of modeButtons) {
    b.classList.toggle("active", b.dataset.mode === currentMode)
  }

  // Defer initial transform to run after checkbox.inline.js restores checkbox state
  queueMicrotask(runTransform)

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
        currentMode = newMode
        runTransform()
      },
      { signal },
    )
  }

  // Options changes trigger re-transform and persist select values
  for (const opt of optionInputs) {
    opt.addEventListener(
      "change",
      () => {
        if (opt instanceof HTMLSelectElement)
          localStorage.setItem(STORAGE_KEY_OPT_PREFIX + opt.id, opt.value)
        runTransform()
      },
      { signal },
    )
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
})
