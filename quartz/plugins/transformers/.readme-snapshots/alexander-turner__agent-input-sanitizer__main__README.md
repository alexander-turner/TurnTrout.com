# `agent-sanitizer`

Most prompt-injection tools run a classifier _over_ the text and hope it
generalizes. This library targets a narrower, verifiable claim: the
specific byte-level channels—invisible Unicode, ANSI escapes, human-hidden
HTML, confusable glyphs, exfil-shaped URLs—that let an attacker smuggle a
payload the operator can't see but the model still reads. Every layer is a
deterministic transform you can unit-test with equality assertions.

**As a library:**

```sh
npm install agent-sanitizer
```

**As a Claude Code plugin:**

```
/plugin marketplace add AlexanderMattTurner/agent-sanitizer
/plugin install agent-sanitizer@agent-sanitizer
```

See [Using it with Claude Code](#using-it-with-claude-code) for what each hook
covers and how to wire the hooks by hand instead.

## Quick start

```js
import { sanitize } from "agent-sanitizer";

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

Split into subpaths so the heavy HTML dependency stays opt-in. **Seam** names
the callback you inject for the agent-specific concern; `—` is a pure transform,
`fs (direct)` does its own file I/O instead of taking one.

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

The Layer-5 `filterInjection` seam is deliberately thin: the filter may only
request **verbatim span deletions** (`removeSpans`) and warn with a **closed
enum code**, never free text. Its warning reaches the model-facing context
without re-passing Layer 1, so a prompt-injected filter emitting arbitrary text
would defeat the "can only remove bytes, never inject" contract. The library
owns each message, and any value outside the enum makes `sanitizeText` **throw**:

| `FILTER_WARNING` code | Meaning                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `spans-removed`       | The filter removed one or more verbatim spans it flagged as prompt injection            |
| `filter-flagged`      | The filter flagged the output as a possible injection without deleting (content intact) |
| `filter-error`        | The filter reported a non-fatal internal error while scanning (a fatal filter throws)   |

## Using it with Claude Code

The plugin installed above puts four hooks on the tool stream: tool input, tool
output, user prompts, and a session-start scan of the instruction files. It
needs only `python3` on PATH, for Layer 4.

```
/plugin marketplace add AlexanderMattTurner/agent-sanitizer
/plugin install agent-sanitizer@agent-sanitizer
```

To wire them yourself instead, one entry dispatches all four modes on `--hook=`:

```jsonc
// settings.json — one entry per event; PreToolUse/PostToolUse also take "matcher": "*"
{
  "type": "command",
  "command": "node ./node_modules/agent-sanitizer/claude-hooks/plugin-hooks.mjs --hook=sanitize-output",
}
```

| Event              | `--hook=`              |
| ------------------ | ---------------------- |
| `UserPromptSubmit` | `sanitize-user-prompt` |
| `PreToolUse`       | `pretooluse-sanitize`  |
| `PostToolUse`      | `sanitize-output`      |
| `SessionStart`     | `scan-invisible-chars` |

`require.resolve("agent-sanitizer/claude-hooks")` gives the path without
hardcoding a layout. Importing the module rather than spawning it is a no-op.

**To compose the hooks instead of spawning them**, each module is a subpath of
its own, typed, with the pieces exported individually:

```js
import {
  sanitizeText,
  evaluateToolOutput,
} from "agent-sanitizer/claude-hooks/sanitize-output";
import {
  lazyImport,
  makeDeadline,
} from "agent-sanitizer/claude-hooks/lib/hook-io";
```

The exported set is deliberately small — the four hooks
(`sanitize-output`, `pretooluse-sanitize`, `sanitize-user-prompt`,
`scan-invisible-chars`) plus `lib/hook-io` and `lib/control-plane`. Everything
else under `claude-hooks/` stays internal and is refused by the exports map, so
it never becomes a surface this package owes compatibility on. `lib/hook-io` is
exported because it must be _shared_ rather than copied: it owns the
lazy-module registry and the CLI-slot singleton, and two copies in one bundle
double-fire the inlined CLIs.

Importing one runs no CLI and reads no stdin. Same stability posture as the
`_AGENT_SANITIZER_*` variables below: reachable and typed, but the supported
surface is the `--hook=` CLI, so these move between minor versions.

**`sanitize-output` takes a host-extension bag** — an optional last argument on
`sanitizeText`, `sanitizeValue`, `evaluateToolOutput`, `judgeSanitizeOutput`, and
`cliMain`, so a composer that wraps `cliMain` gets the hook's exact fail-closed
CLI wiring plus its own policy:

| Field        | Runs                                                     | Does                                                                                 |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `postText`   | once per string **value** leaf, after Layers 1–4         | returns `{cleaned?, warning?}`; `cleaned` replaces the model-facing text             |
| `redactNote` | on the pre-redaction text of a leaf that tripped Layer 4 | returns a note appended to that leaf's redaction warning                             |
| `audit`      | once per judged event carrying a tool response           | is handed the output the model will actually see, and the `session_id` it belongs to |
| `trace`      | on every exit, in place of the package's trace channel   | receives the engagement announcement (see the trace sink below)                      |

Omit the bag and every seam is inert — the verdicts are byte-identical to this
module alone. A callback that throws is **not** caught: it lands in the CLI's
fail-closed catch and the tool output is suppressed, so a broken extension can
never degrade into showing unvetted output. `postText` deliberately does not run
on object field NAMES: a callback sees only the string and the tool, so it cannot
tell a schema key from content, and rewriting a key can collapse two fields into
one name — which this hook turns into whole-output suppression.

Beyond the credential-shaped names it infers, the env-bound redaction set unions
`_AGENT_SANITIZER_EXTRA_SECRET_VARS` — a comma-separated list of `[A-Z0-9_]`
variable names whose values a deployment forwards under names of its own
choosing. A malformed entry throws rather than being dropped.

**Layer 4 needs the Python engine** — `pip install 'agent-sanitizer[secrets]'`,
version-matched to the npm package. Without it `sanitize-output` fails closed:
secret-shaped output is suppressed, not shown unvetted. Layers 1–3 still run.

**Layer 5 (second-model injection filtering) is not included.** These hooks
never supply the `/output` seam's `filterInjection` callback, so nothing here
calls a model or leaves the machine.

**Every hook's trace sink is injectable.** Each one announces that it engaged —
that is what makes a layer that stopped running loud rather than silent — and by
default that announcement goes to `_AGENT_SANITIZER_TRACE` /
`_AGENT_SANITIZER_TRACE_FILE`. A host that already runs a trace channel under
its own variables passes its own sink instead, so the announcement lands where
its detector actually reads:

```js
import { cliMain } from "agent-sanitizer/claude-hooks/scan-invisible-chars";
await cliMain({ trace: (event, fields) => myChannel.emit(event, fields) });
```

The sink rides each hook's options bag — `cliMain({trace})` on
`scan-invisible-chars` and `pretooluse-sanitize`, the extension bag's `trace` on
`sanitize-output`, `main(read, write, {trace})` on `sanitize-user-prompt`. It
receives the same `TraceEvent` names the default emits, and it **replaces** the
default rather than running alongside it — the package channel goes silent, so
there is one announcement to detect, not two. It may throw freely: each hook
binds the sink it is given through `bestEffortTrace`, so an announcement can
never be the thing that breaks a hook.

**A host's own cold-start marker can replace the derived one.** The hooks wait
out an in-flight dependency install by polling a marker file whose path they
derive from `CLAUDE_PROJECT_DIR`; a host whose setup script already writes one
calls `configureHookgateMarker(path)` (from `lib/hook-io`) before importing any
hook module, and every consumer waits on that path instead. `lib/control-plane`
resolves the marker at module scope, so a call that lands after that import
warns on stderr — it cannot steer the wait that already started.

**A host's own remedy can replace the packaged one in every fail-closed
reason.** Deep call sites (`lib/control-plane`'s missing-package throw) take no
remedy argument, so by default they can only say `pnpm install`. A host whose
install has one entry point calls `configureMissingPackageRemedy(text)` (from
`lib/hook-io`) — typically at its bundle entry — and every remedy-less
`missingPackageMessage`/`missingPackageError` states that text instead. An
explicit per-call remedy (including a per-gate `MESSAGES.remedy`) still wins,
and `null` restores the packaged wording. Keep it to a sentence: past ~260
characters it overruns the 300-char message budget.

**A host's own secret registry can drive the env-bound redaction set.**
`configureEnvConfigSource({ minSecretLen, extraVars })` (from `lib/env-config`)
replaces the placeholder floor and unions extra `[A-Z0-9_]` variable names into
`envBoundSecretVars()`, so a host that already declares its forwarded
credentials (and their length floor) in a registry of its own feeds the packaged
helpers from it instead of forking the module. Unset fields keep the package
derivation; `null` restores it entirely. A malformed source — a non-object, a
key the seam does not read, a bad field — throws on first use, inside the
consuming hook's fail-closed catch, never at configure time.

Hook internals are tuned by `_AGENT_SANITIZER_*` variables (redactor daemon
path/socket/timeouts, sanitize budget, trace channel, Layer-2 reveal dir). The
leading underscore marks them unstable — the supported surface is the `--hook=`
CLI above.

## How this compares

The space splits into ML classifiers that score a prompt's _intent_ (Lakera
Guard, Meta's Prompt Guard, Rebuff, NeMo Guardrails) and PII redactors
(Presidio). Neither targets the byte-level hiding channel — content a semantic
classifier never "sees" as suspicious because it renders as blank space or
doesn't render at all.

|                               | `agent-sanitizer`                                                                                                        | Semantic guard/classifier (Lakera, Prompt Guard, Rebuff, NeMo rails)                                       | PII redactor (Presidio)                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **What it catches**           | Payload-capable invisible chars, ANSI/SGR, hidden HTML, confusable glyphs, exfil-shaped URLs                             | Malicious _intent_—jailbreaks, injected instructions, off-topic asks                                       | Names, emails, SSNs, and other PII spans                     |
| **How it decides**            | Deterministic parsing/regex over real tokenizer output—no model call                                                     | ML/LLM classification—probabilistic, needs a threshold and retuning as attacks shift                       | NER + pattern matching                                       |
| **Failure mode**              | Fails open on ambiguous input (see [`THREAT-MODEL.md`](./THREAT-MODEL.md)); false negative over false positive by design | False positives silently mangle or block legitimate prompts; false negatives are invisible until exploited | Under/over-redaction depending on locale and entity coverage |
| **Latency / infra**           | Pure JS, mostly zero-dep (`/html` lazy-loads ~200 ms once)                                                               | Network round-trip to a hosted model, or a local model to host yourself                                    | Local, but heavier NLP pipeline                              |
| **Determinism / testability** | Exact-equality unit tests, no flakiness across runs                                                                      | Same input can classify differently across model versions                                                  | Deterministic per rule, but rule coverage varies             |
| **Reversibility**             | `/rehydrate` re-anchors a model's edit from the sanitized view back onto real bytes, denying anything ambiguous          | N/A—classifiers only pass/block, they don't rewrite-and-reverse                                            | N/A                                                          |
| **Non-JS support**            | Same verdicts via a bundled CLI/worker—Python client included, no reimplementation                                       | Usually a hosted API (language-agnostic) or Python-only SDK                                                | Python-first (spaCy-based)                                   |

These are complementary: a semantic guard for intent, Presidio for PII, and this
for the hidden channel both are blind to.

## Examples

```js
import { stripInvisibleWithReport } from "agent-sanitizer/invisible";
const { cleaned, found } = stripInvisibleWithReport(text); // found: ["variation-selectors"]

import { sanitizeHtml, detectExfil, checkExfilUrl } from "agent-sanitizer/html";
sanitizeHtml(pageSource); // { text, removed, warned } | null — text may be unchanged if only reportable (not strippable) tags were found
detectExfil(pageSource); // [{ isImage, reason, target }] or null
checkExfilUrl(oneUrl); // reason string or null
```

The agent-pipeline entry points take plain arguments and inject their
agent-specific seam:

```js
import { normalizeConfusables } from "agent-sanitizer/confusables";
normalizeConfusables(
  "Bash",
  { command: "/аpt update" },
  { scan: (t) => myHomoglyphEngine.scan(t) }, // -> { findings: [{ index, char, latinEquivalent }] }
); // null, or { updatedInput, normalized }

import { scanInstructionFiles, cleanFile } from "agent-sanitizer/instructions";
const findings = scanInstructionFiles(["CLAUDE.md", "**/SKILL.md"], {
  cwd: projectDir,
});
for (const { file } of findings) cleanFile(`${projectDir}/${file}`);

import { classifyPrompt } from "agent-sanitizer/prompt";
classifyPrompt(submittedPrompt); // { action: "pass" | "note" | "block", reason? }

import { sanitizeText } from "agent-sanitizer/output";
await sanitizeText(toolText, {
  html: isWebPage,
  exfilScan: isUntrustedIngress,
  redact: async (t) => myRedactor.redact(t), // -> { text, found, note? } | null
  filterInjection: (t) => mySemanticFilter(t), // -> { removeSpans, warning } | null
  //   removeSpans: verbatim spans to delete (delete-only — never replacement text)
  //   warning:     a FILTER_WARNING enum CODE, never free text (see below)
});

import { rehydrateRedacted } from "agent-sanitizer/rehydrate";
await rehydrateRedacted("Edit", toolInput, {
  readFile: (p) => fs.readFileSync(p, "utf8"),
  redactMap: (t) => myRedactor.map(t), // -> { text, pairs } | { unmappable }
  redact: (t) => myRedactor.redact(t), // -> string | null
}); // { updatedInput, context } | { deny } | null — a deny never exposes a secret
```

Ask whether a variable NAME holds a credential — don't render the noun list into
a pattern of your own. Sharing the words but not the rule re-derives the same
bugs: matching only when the noun ENDS the name misses `DEPLOY_TOKEN_ORG`, a
case-sensitive match misses npm's lower-case `npm_config__authToken` channel, and
one alternation of the nouns backtracks polynomially on a long name.

`scope` is the choice that is genuinely yours: `trailing` for a redactor, which
must not mangle text a human reads; `any-segment` for an env scrub, where an
unstripped credential leaks silently but an over-stripped one breaks loudly.

```js
import { credentialNameMatcher } from "agent-sanitizer/credential-names-matcher";
const holds = credentialNameMatcher({ scope: "any-segment" }); // build once
holds("TEMPLATE_SYNC_TOKEN_ORG"); // true
holds("AWS_ACCESS_KEY_ID"); // false — an identifier, not a secret
```

```python
from agent_sanitizer.secrets import credential_name_matcher
holds = credential_name_matcher(scope="any-segment")
```

The vocabulary stays published as data for a consumer that needs the words rather
than the predicate (a generated config, an alternation for a different matcher).
Each noun's `uses` marks where it is valid: `env-name` inspects a variable NAME
only, `field-value` also redacts what follows `noun = ` (too broad for `key` and
`pat`, which stay name-only).

```js
import { createRequire } from "node:module";
createRequire(import.meta.url)("agent-sanitizer/credential-names").nouns;
// [{ parts: ["api", "key"], uses: ["env-name", "field-value"] }, …]
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

The JS is the **single source of truth** — non-JS callers drive the same
verdicts through the bundled CLI, so no second implementation can drift. An `op`
field selects the entry point (default `sanitize`); the self-contained ones —
`sanitizeText`, `classifyPrompt`, `scanInstructionFiles`, `cleanFile` — are
bridged, while entry points taking a JS callback have no wire form. Bridged
`sanitizeText` runs Layers 1–3 only: no secret redaction (Layer 4), no injection
filtering (Layer 5), and `sgrNote` is always `false` since the bridge never
wires `sgrCarveOut`.

```sh
echo '{"text":"a​b"}' | npx sanitize-cli           # default op: sanitize
echo '{"op":"classifyPrompt","text":"…"}' | npx sanitize-cli
sanitize-cli --worker                              # newline-delimited, one response/line
```

The [`python/`](./python) client wraps every bridged op. The wheel ships a
single-file build of the CLI, so `pip install` plus Node.js (>=22) on `PATH`
needs no JavaScript checkout; `AGENT_SANITIZER_CLI` is an override escape hatch
a normal install never sets. The first `html=True` call starts a shared worker,
paying the ~200 ms HTML module-load **once per process**; Layer-1 calls stay
one-shot. `persist=True/False` forces the mode; `shutdown_worker()` (also an
`atexit` hook) stops it.

```python
from agent_sanitizer import sanitize, Sanitizer

sanitize(untrusted_text)          # Layer 1, one-shot
sanitize(page_source, html=True)  # HTML layers, warm worker reused
with Sanitizer() as s:            # own the worker’s lifetime
    s.sanitize(page, html=True)
```
