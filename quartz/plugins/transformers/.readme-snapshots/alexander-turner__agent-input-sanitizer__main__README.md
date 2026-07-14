# `agent-input-sanitizer`

Most prompt-injection tools run a classifier _over_ the text and hope it
generalizes. This library targets a narrower, verifiable claim: the
specific byte-level channels—invisible Unicode, ANSI escapes, human-hidden
HTML, confusable glyphs, exfil-shaped URLs—that let an attacker smuggle a
payload the operator can't see but the model still reads. Every layer is a
deterministic transform you can unit-test with equality assertions.

```sh
npm install agent-input-sanitizer
```

## Quick start

```js
import { sanitize } from "agent-input-sanitizer";

// Layer 1 (invisible chars + ANSI), zero heavy deps:
const { cleaned, found, warnings } = await sanitize(untrustedText);

// Opt into the HTML layers for web ingress (lazy-loads ~200 ms of deps):
const result = await sanitize(pageSource, { html: true });
```

`sanitize` never throws and never silently drops content—any change comes with
at least one `warnings` entry. `found` names the neutralized category codes
(e.g. `["cf-format", "hidden-html"]`); `cleaned` is the safe text, with
placeholders where hidden HTML was spliced out.

## Entry points

Split into subpaths so the heavy HTML dependency stays opt-in. The **seam**
column marks entry points that inject the agent-specific concern (a callback
you supply) rather than baking it in; `—` means the function is a pure
transform with no such hook, and `fs (direct)` means it does its own file I/O
(Node's filesystem, not an agent harness) instead of taking a callback.

| #   | Import          | Purpose                                                                                                                                                    | Seam                        |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | `/invisible`    | Strip zero-width, bidi, variation-selector and tag chars + ANSI/SGR escapes. Preserves ZWNJ/ZWJ for Arabic/Indic/emoji. Zero deps.                         | —                           |
| 2   | `/html`         | Splice out instructions hidden in comments, `display:none`, off-screen, white-on-white, `hidden`. Leaves a placeholder.                                    | —                           |
| 3   | `/html`         | Detect exfil-shaped URLs (payloads in query/path, embedded creds, `data:`/`javascript:`, off-origin redirects). Reports only.                              | —                           |
| 4   | `/confusables`  | Fold look-alike glyphs in tool-call input (paths, commands) to ASCII, closing a cross-script deny-rule bypass.                                             | `scan`                      |
| 5   | `/instructions` | Scan/auto-clean `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, etc., decoding Unicode-tag + zero-width-binary payloads.                                             | `fs` (direct)               |
| 6   | `/prompt`       | Classify a prompt pass / SGR-note / block on payload-capable invisible/ANSI content.                                                                       | —                           |
| 7   | `/output`       | Run Layers 1–4 over structured tool output, preserving shape. The Layer-5 slot takes a delete-only filter.                                                 | `redact`, `filterInjection` |
| 8   | `/rehydrate`    | Re-anchor a model Edit composed from the _sanitized_ view back onto real bytes; deny anything ambiguous or secret-exposing.                                | `io`                        |
| —   | `/view-map`     | Pure offset/text machinery mapping a file's on-disk bytes ↔ the sanitized view (Layer-1 deletions, Layer-4 redactions). No I/O — consumed by `/rehydrate`. | —                           |

See [`THREAT-MODEL.md`](./THREAT-MODEL.md) for per-vector detail.

### `found` codes

`found` (from `sanitize`/`stripInvisibleWithReport`) is a stable, machine-readable
contract—branch on these codes, not on `warnings` prose, which can be reworded
without notice.

| Code                  | Meaning                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `cf-format`           | Unicode format chars (`Cf`): zero-width space/joiner, bidi overrides, tag chars                         |
| `variation-selectors` | Variation selectors (U+FE00–FE0F, U+E0100–E01EF)                                                        |
| `blank-fillers`       | Blank-rendering fillers not covered by `Cf` (Hangul fillers, Braille blank, zero-width combining marks) |
| `ansi`                | ANSI/SGR escapes and other terminal control sequences                                                   |
| `lone-surrogates`     | Unpaired UTF-16 surrogates                                                                              |
| `html-comments`       | HTML comments spliced out by Layer 2                                                                    |
| `hidden-html`         | Elements hidden via CSS/attribute (`display:none`, `hidden`, etc.) spliced out by Layer 2               |
| `exfil-urls`          | Exfil-shaped URLs detected by Layer 3 (reported, not removed)                                           |

### `FILTER_WARNING` codes (Layer 5)

The Layer-5 `filterInjection` seam is deliberately thin: the injected filter may
only ask for **verbatim span deletions** (`removeSpans`) and may only warn with a
**closed enum code** (`warning`), never free text. Because the filter runs on
attacker-influenced content and its `warning` would otherwise be concatenated
straight into the model-facing context **without** re-passing Layer 1, a
compromised or prompt-injected filter emitting arbitrary text would defeat the
"a compromised filter can only remove bytes, never inject" contract. So the
**library owns the message** for each code, and a filter returning any value
outside this enum makes `sanitizeText` **throw** (fail loud). Branch on the code,
like `found`:

| `FILTER_WARNING` code | Meaning                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `spans-removed`       | The filter removed one or more verbatim spans it flagged as prompt injection            |
| `filter-flagged`      | The filter flagged the output as a possible injection without deleting (content intact) |
| `filter-error`        | The filter reported a non-fatal internal error while scanning (a fatal filter throws)   |

## How this compares

The "sanitize untrusted LLM input" space mostly splits into two camps: ML
classifiers that score a prompt's _intent_ (Lakera Guard, Meta's Prompt
Guard, Rebuff, NeMo Guardrails' input rails), and PII-focused redactors
(Microsoft Presidio). Neither targets the byte-level hiding channel this
library covers, and that gap is exactly where invisible-Unicode and
hidden-HTML payloads live—content a semantic classifier never "sees" as
suspicious because it renders as blank space or doesn't render at all.

|                               | `agent-input-sanitizer`                                                                                                  | Semantic guard/classifier (Lakera, Prompt Guard, Rebuff, NeMo rails)                                       | PII redactor (Presidio)                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **What it catches**           | Payload-capable invisible chars, ANSI/SGR, hidden HTML, confusable glyphs, exfil-shaped URLs                             | Malicious _intent_—jailbreaks, injected instructions, off-topic asks                                       | Names, emails, SSNs, and other PII spans                     |
| **How it decides**            | Deterministic parsing/regex over real tokenizer output—no model call                                                     | ML/LLM classification—probabilistic, needs a threshold and retuning as attacks shift                       | NER + pattern matching                                       |
| **Failure mode**              | Fails open on ambiguous input (see [`THREAT-MODEL.md`](./THREAT-MODEL.md)); false negative over false positive by design | False positives silently mangle or block legitimate prompts; false negatives are invisible until exploited | Under/over-redaction depending on locale and entity coverage |
| **Latency / infra**           | Pure JS, mostly zero-dep (`/html` lazy-loads ~200 ms once)                                                               | Network round-trip to a hosted model, or a local model to host yourself                                    | Local, but heavier NLP pipeline                              |
| **Determinism / testability** | Exact-equality unit tests, no flakiness across runs                                                                      | Same input can classify differently across model versions                                                  | Deterministic per rule, but rule coverage varies             |
| **Reversibility**             | `/rehydrate` re-anchors a model's edit from the sanitized view back onto real bytes, denying anything ambiguous          | N/A—classifiers only pass/block, they don't rewrite-and-reverse                                            | N/A                                                          |
| **Non-JS support**            | Same verdicts via a bundled CLI/worker—Python client included, no reimplementation                                       | Usually a hosted API (language-agnostic) or Python-only SDK                                                | Python-first (spaCy-based)                                   |

In practice these are complementary, not competing: run a semantic guard for
intent, Presidio for PII you must not leak, and this library for the hidden
channel both of those are blind to. If you already run a classifier and are
still getting bitten by zero-width payloads or `display:none` instructions
riding along in RAG context, that's the gap this library closes.

### Examples

```js
import { stripInvisibleWithReport } from "agent-input-sanitizer/invisible";
const { cleaned, found } = stripInvisibleWithReport(text); // found: ["variation-selectors"]

import {
  sanitizeHtml,
  detectExfil,
  checkExfilUrl,
} from "agent-input-sanitizer/html";
sanitizeHtml(pageSource); // { text, removed, warned } | null — text may be unchanged if only reportable (not strippable) tags were found
detectExfil(pageSource); // [{ isImage, reason, target }] or null
checkExfilUrl(oneUrl); // reason string or null
```

The agent-pipeline entry points take plain arguments and inject their
agent-specific seam:

```js
import { normalizeConfusables } from "agent-input-sanitizer/confusables";
normalizeConfusables(
  "Bash",
  { command: "/аpt update" },
  { scan: (t) => myHomoglyphEngine.scan(t) }, // -> { findings: [{ index, char, latinEquivalent }] }
); // null, or { updatedInput, normalized }

import {
  scanInstructionFiles,
  cleanFile,
} from "agent-input-sanitizer/instructions";
const findings = scanInstructionFiles(["CLAUDE.md", "**/SKILL.md"], {
  cwd: projectDir,
});
for (const { file } of findings) cleanFile(`${projectDir}/${file}`);

import { classifyPrompt } from "agent-input-sanitizer/prompt";
classifyPrompt(submittedPrompt); // { action: "pass" | "note" | "block", reason? }

import { sanitizeText } from "agent-input-sanitizer/output";
await sanitizeText(toolText, {
  html: isWebPage,
  exfilScan: isUntrustedIngress,
  redact: async (t) => myRedactor.redact(t), // -> { text, found, note? } | null
  filterInjection: (t) => mySemanticFilter(t), // -> { removeSpans, warning } | null
  //   removeSpans: verbatim spans to delete (delete-only — never replacement text)
  //   warning:     a FILTER_WARNING enum CODE, never free text (see below)
});

import { rehydrateRedacted } from "agent-input-sanitizer/rehydrate";
await rehydrateRedacted("Edit", toolInput, {
  readFile: (p) => fs.readFileSync(p, "utf8"),
  redactMap: (t) => myRedactor.map(t), // -> { text, pairs } | { unmappable }
  redact: (t) => myRedactor.redact(t), // -> string | null
}); // { updatedInput, context } | { deny } | null — a deny never exposes a secret
```

## Limits

The CLI (and the worker that backs the Python client) rejects any single request
larger than `AGENT_SANITIZER_MAX_INPUT_BYTES` UTF-8 bytes — **default 10 MiB** —
with a structured error instead of buffering an unbounded payload. Raise or lower
it by setting that environment variable in the calling process.

## Security

Found a vulnerability? See [`SECURITY.md`](./SECURITY.md) for the private
disclosure channel — it ships in the npm tarball, so it is also available offline
from an installed copy. [`THREAT-MODEL.md`](./THREAT-MODEL.md) covers what each
layer does and does not defend against.

## Non-JS pipelines (Python, etc.)

The JS is the **single source of truth**—non-JS callers drive the same verdicts
through the bundled CLI, so there’s
no second implementation to drift. An `op` field selects the entry point
(default `sanitize`); the self-contained ones—`sanitizeText`, `classifyPrompt`,
`scanInstructionFiles`, `cleanFile`—are all bridged. Entry points with an
injected JS callback have no wire form and stay JS-only. The bridged
`sanitizeText` runs Layers 1–3 only (invisible/ANSI strip, HTML hidden-content
splice, exfil detection): it never redacts secrets (Layer 4) or runs injection
filtering (Layer 5), and the wire protocol's `sgrNote` (Python's
`TextResult.sgr_note`) is always `false`, since the bridge never wires
`sgrCarveOut`.

```sh
echo '{"text":"a​b"}' | npx sanitize-cli           # default op: sanitize
echo '{"op":"classifyPrompt","text":"…"}' | npx sanitize-cli
sanitize-cli --worker                              # newline-delimited, one response/line
```

The [`python/`](./python) client wraps every bridged op (`sanitize`,
`sanitize_text`, `classify_prompt`, `scan_instruction_files`, `clean_file`). The
wheel ships a self-contained, single-file build of the CLI (`src/` and its npm
dependencies bundled into one `.mjs` at release time), so a `pip install` plus
Node.js (>=22) on `PATH` works with no separate JavaScript checkout to clone.
`AGENT_SANITIZER_CLI` is only an override escape hatch (e.g. to point at a
custom/dev build)—a normal install never needs to set it. The first
`html=True` call starts a shared worker, so the ~200 ms HTML module-load is
paid **once per process**; Layer-1 calls stay one-shot. `persist=True/False`
forces the mode and `shutdown_worker()` (also an `atexit` hook) stops it.

```python
from agent_input_sanitizer import sanitize, Sanitizer

sanitize(untrusted_text)          # Layer 1, one-shot
sanitize(page_source, html=True)  # HTML layers, warm worker reused
with Sanitizer() as s:            # own the worker’s lifetime
    s.sanitize(page, html=True)
```
