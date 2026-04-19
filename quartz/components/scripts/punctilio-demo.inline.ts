import { diffChars, diffLines, type Change } from "diff"
import { transform, type TransformOptions } from "punctilio"
import { rehypePunctilio } from "punctilio/rehype"
import { remarkPunctilio } from "punctilio/remark"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import { unified } from "unified"

import { debounce, escapeHtml, setupCopyButton } from "./component_script_utils"

// Safety cap for two-level diff (line-diff then char-diff on changed lines).
// Scales with edit size rather than input size, so we can afford a high ceiling.
const MAX_DIFF_LENGTH = 200_000

// Beyond this input length, the unified md/html pipelines take long enough
// (>100ms) that we yield a paint frame so the "computing" affordance shows
// before the blocking transform starts.
const COMPUTING_AFFORDANCE_THRESHOLD = 10_000

const STORAGE_KEY_INPUT = "punctilio-input"
const STORAGE_KEY_MODE = "punctilio-mode"
const STORAGE_KEY_OPT_PREFIX = "punctilio-opt-"
const OPTION_INPUTS_SELECTOR = ".punctilio-options-list input, .punctilio-options-list select"

type TransformMode = "plaintext" | "markdown" | "html"

/** Mode-specific example text shown as ghost placeholders when the input is empty. */
const GHOST_INPUTS: Record<TransformMode, string> = {
  plaintext: `She said "I can't believe it --- we got the work done..."`,
  markdown: `She said "I can't *believe* it --- we got the work **done**..."`,
  html: `<p>She said "I can't <em>believe</em> it --- we got the work <b>done</b>..."</p>`,
}

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

function doTransform(text: string, mode: TransformMode, config: TransformOptions): string {
  // Skip punctilio's internal idempotency check (runs the whole transform
  // twice). It's a library self-test, not a correctness requirement here, and
  // the remark/rehype plugins already default it off.
  const fastConfig: TransformOptions = { ...config, checkIdempotency: false }
  switch (mode) {
    case "plaintext":
      return transform(text, fastConfig)
    case "markdown":
      return transformMarkdownText(text, fastConfig)
    case "html":
      return transformHtmlText(text, fastConfig)
    default: {
      const exhaustive: never = mode
      throw new Error(`Unknown mode: ${exhaustive}`)
    }
  }
}

// ─── Inline diff highlighting ────────────────────────────────────────

function escapeForOutput(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>")
}

/** Render char-level changes, keeping only additions (green) and unchanged text. */
function renderCharDiff(changes: readonly Change[]): string {
  let html = ""
  for (const change of changes) {
    if (change.removed) continue
    const escaped = escapeForOutput(change.value)
    html += change.added ? `<span class="diff-insert">${escaped}</span>` : escaped
  }
  return html
}

/**
 * Two-level diff: line-level first, then char-level on changed line pairs only.
 * Keeps char-granular highlighting while scaling with the size of changes, not
 * the whole input, so long mostly-unchanged inputs stay responsive.
 */
function renderDiffHtml(sourceText: string, resultText: string): string {
  const lineChanges = diffLines(sourceText, resultText)
  let html = ""
  for (let i = 0; i < lineChanges.length; i++) {
    const change = lineChanges[i]
    if (!change.added && !change.removed) {
      html += escapeForOutput(change.value)
      continue
    }
    const next = lineChanges[i + 1]
    if (change.removed && next?.added) {
      html += renderCharDiff(diffChars(change.value, next.value))
      i++
      continue
    }
    if (change.added) {
      html += `<span class="diff-insert">${escapeForOutput(change.value)}</span>`
    }
    // A pure removal with no paired addition contributes nothing to the output.
  }
  return html
}

// ─── Main nav handler ────────────────────────────────────────────────

let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  abortController?.abort()

  const container = document.getElementById("punctilio-demo")
  if (!container) return

  const input = document.getElementById("punctilio-input") as HTMLTextAreaElement | null
  const outputContent = container.querySelector(".punctilio-output-content") as HTMLElement | null
  const modeButtons = container.querySelectorAll<HTMLButtonElement>(".punctilio-mode-btn")
  const copyBtn = document.getElementById("punctilio-copy-btn") as HTMLButtonElement | null
  const outputTitleInner = outputContent
    ?.closest(".admonition")
    ?.querySelector(".admonition-title-inner") as HTMLElement | null
  const inputTitleInner = input
    ?.closest(".admonition")
    ?.querySelector(".admonition-title-inner") as HTMLElement | null

  if (!input || !outputContent) return

  let lastResult = ""

  const controller = new AbortController()
  abortController = controller
  const { signal } = controller

  // Restore saved mode and input, or fall back to defaults
  const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as TransformMode | null
  let currentMode: TransformMode = savedMode && savedMode in GHOST_INPUTS ? savedMode : "plaintext"

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

  async function runTransform() {
    if (!input || !outputContent) return
    const config = getConfig()
    const mode = currentMode
    const inputValue = input.value
    const isEmpty = inputValue === ""

    // When the input is empty, show transformed ghost text in the output
    const sourceText = isEmpty ? GHOST_INPUTS[mode] : inputValue

    // Long inputs can block the main thread for hundreds of ms in md/html
    // mode. Yield one paint frame so the dimmed "computing" affordance shows,
    // then bail if a newer transform is already pending.
    if (sourceText.length > COMPUTING_AFFORDANCE_THRESHOLD) {
      outputContent.classList.add("computing")
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      if (input.value !== inputValue || currentMode !== mode) return
    }

    const result = doTransform(sourceText, mode, config)
    outputContent.classList.remove("computing")
    lastResult = isEmpty ? "" : result

    if (isEmpty) {
      outputContent.textContent = ""
      outputContent.dataset.placeholder = result
    } else {
      delete outputContent.dataset.placeholder
      if (sourceText.length + result.length > MAX_DIFF_LENGTH) {
        outputContent.textContent = result
      } else {
        outputContent.innerHTML = renderDiffHtml(sourceText, result)
      }
    }
    outputContent.classList.toggle("ghost", isEmpty)

    // Persist input text and mode
    sessionStorage.setItem(STORAGE_KEY_INPUT, input.value)
    localStorage.setItem(STORAGE_KEY_MODE, currentMode)

    // Update admonition titles to reflect the active mode
    if (outputTitleInner) {
      const icon = outputTitleInner.querySelector(".admonition-icon")
      if (currentMode === "html") {
        outputTitleInner.innerHTML = '<abbr class="small-caps">Html</abbr> source output'
      } else if (currentMode === "markdown") {
        outputTitleInner.textContent = "Markdown source output"
      } else {
        outputTitleInner.textContent = "Text output"
      }
      if (icon) outputTitleInner.prepend(icon)
    }
    if (inputTitleInner) {
      const icon = inputTitleInner.querySelector(".admonition-icon")
      if (currentMode === "html") {
        inputTitleInner.innerHTML = 'Input your <abbr class="small-caps">html</abbr> code'
      } else {
        inputTitleInner.textContent = "Input"
      }
      if (icon) inputTitleInner.prepend(icon)
    }
    const isCodeMode = currentMode === "markdown" || currentMode === "html"
    outputContent.classList.toggle("monospace-output", isCodeMode)

    input.placeholder = GHOST_INPUTS[currentMode]
  }

  const debouncedTransform = debounce(runTransform, 100)

  // Restore saved input; leave empty when none so the ghost placeholder shows
  const savedInput = sessionStorage.getItem(STORAGE_KEY_INPUT)
  input.value = savedInput ?? ""

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

  // Copy output button — reuses shared clipboard button setup from code blocks
  if (copyBtn) {
    setupCopyButton(copyBtn, () => lastResult, { signal })
  }
})
