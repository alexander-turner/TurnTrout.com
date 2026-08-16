# `agent-sanitizer`

Most prompt-injection tools run a classifier _over_ the text and hope it
generalizes. This library targets a narrower, verifiable claim: the
specific byte-level channels—invisible Unicode, ANSI escapes, human-hidden
HTML, confusable glyphs and look-alike hosts, exfil-shaped URLs—that let an
attacker smuggle a payload the operator can't see but the model still reads.
Every layer is a
deterministic transform you can unit-test with equality assertions.

**As a library:**

```sh
npm install agent-sanitizer
```

**As a Claude Code plugin:**

Enter one at a time:

```
/plugin marketplace add AlexanderMattTurner/agent-sanitizer
```

```
/plugin install agent-sanitizer@agent-sanitizer
```

Finally, navigate: `/plugin` → Marketplaces → `agent-sanitizer` → Enable auto-update.

[What installing entails](#what-installing-entails) covers the footprint of each
path and how a failure looks; [Using it with Claude
Code](#using-it-with-claude-code) covers each hook and hand-wiring.

## Quick start

```js
import { sanitize } from "agent-sanitizer";

// Layer 1 (invisible chars + ANSI), zero heavy deps:
const { cleaned, found, warnings, notes } = await sanitize(untrustedText);

// Opt into the HTML layers for web ingress (lazy-loads ~200 ms of deps):
const result = await sanitize(pageSource, { html: true });

// Layer 3 alone: flag exfil-shaped URLs without splicing anything (for text
// that must stay byte-faithful, e.g. a PR diff). Implied by `html: true`.
const scanned = await sanitize(diffText, { exfilScan: true });
```

`sanitize` never throws and never silently drops content—any change comes with
at least one `warnings` or `notes` entry. `found` names the neutralized category
codes (e.g. `["cf-format", "hidden-html"]`); `cleaned` is the safe text, with
placeholders where hidden HTML was spliced out. See [warnings vs
notes](#warnings-vs-notes) for which findings land where.

## Entry points

Split into subpaths so the heavy HTML dependency stays opt-in. **Seam** names
the callback you inject for the agent-specific concern; `—` is a pure transform,
`fs (direct)` does its own file I/O instead of taking one.

| #   | Import          | Purpose                                                                                                                                                                                  | Seam                        |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | `/invisible`    | Strip zero-width, bidi, variation-selector and tag chars + ANSI/SGR escapes. Preserves ZWNJ/ZWJ for Arabic/Indic/emoji. Zero deps.                                                       | —                           |
| 2   | `/html`         | Splice out HTML comments and elements hidden via `display:none`, off-screen, white-on-white, `hidden`. Each splice leaves a keyed, round-trippable placeholder.                          | —                           |
| 3   | `/html`         | Detect exfil-shaped URLs (payloads in query/path, embedded creds, `data:`/`javascript:`, off-origin redirects) and confusable HOSTS (`аpple.com`). Reports only — never rewrites.        | —                           |
| 4   | `/confusables`  | Fold look-alike glyphs in tool-call input (paths, commands) to ASCII, closing a cross-script deny-rule bypass. Gated per token, so non-Latin prose passes through unfolded.              | `scan` (optional)           |
| 5   | `/instructions` | Scan/auto-clean `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, etc., decoding Unicode-tag + zero-width-binary payloads.                                                                           | `fs` (direct)               |
| 6   | `/prompt`       | Classify a prompt pass / note / block on payload-capable invisible/ANSI content (inert escapes get the note).                                                                            | —                           |
| 7   | `/output`       | Run Layers 1–4 over structured tool output, preserving shape. The Layer-5 slot takes a delete-only filter.                                                                               | `redact`, `filterInjection` |
| 8   | `/rehydrate`    | Re-anchor a model Edit or whole-file Write composed from the _sanitized_ view back onto real bytes; gate MultiEdit on a verified view==disk; deny anything ambiguous or secret-exposing. | `io`                        |
| —   | `/view-map`     | Pure offset/text machinery mapping a file's on-disk bytes ↔ the sanitized view (Layer-1 deletions, Layer-4 redactions). No I/O — consumed by `/rehydrate`.                               | —                           |

See [`THREAT-MODEL.md`](./THREAT-MODEL.md) for per-vector detail.

### `found` codes

`found` (from `sanitize`/`stripInvisibleWithReport`) is a stable, machine-readable
contract—branch on these codes, not on `warnings` prose, which can be reworded
without notice.

| Code                  | Meaning                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `cf-format`           | Unicode format chars (`Cf`): zero-width space/joiner, bidi overrides, tag chars                              |
| `variation-selectors` | Variation selectors (U+FE00–FE0F, U+E0100–E01EF)                                                             |
| `blank-fillers`       | Blank-rendering fillers not covered by `Cf` (Hangul fillers, Braille blank, zero-width combining marks)      |
| `ansi`                | ANSI/SGR escapes and other terminal control sequences                                                        |
| `lone-surrogates`     | Unpaired UTF-16 surrogates                                                                                   |
| `html-comments`       | HTML comments (incl. bogus `<!…>`/`<?…?>` forms) spliced out by Layer 2, recoverable via `splices`           |
| `hidden-html`         | Elements hidden via CSS/attribute (`display:none`, `hidden`, etc.) spliced out by Layer 2                    |
| `exfil-urls`          | Exfil-shaped URLs detected by Layer 3 (reported, not removed)                                                |
| `confusable-host`     | URL hosts that are look-alikes of an ASCII name (`аpple.com`), detected by Layer 3 (reported, not rewritten) |

### warnings vs notes

Findings come back at two volumes, on `sanitize` and on `/output` alike:

- **`warnings`** — injection-shaped. Something was hidden from a human reader,
  something a payload would have used was removed, or a secret was redacted.
  This is the set to surface.
- **`notes`** — it happened, and here is how to look at it, but nothing about it
  is attack-shaped: a preserved `<script>` on a fetched page, a plain link whose
  URL merely looks exfil-shaped, or (in `/output`, under `sgrCarveOut`) an
  incidental strip of pasted terminal colour or a stray soft hyphen.

The tier changes nothing about what is removed—the same bytes are stripped,
spliced and redacted either way, and a note is still reported. It exists so the
banner keeps meaning something. A caller that ignores `notes` is exactly as loud
as before the split. `/output` also returns `sgrNote: true` when a result is
note-only, so a caller can pick the quiet line without inspecting the arrays.
[`THREAT-MODEL.md`](./THREAT-MODEL.md#severity-warnings-vs-notes) lists which
finding lands at which tier and why.

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

Every span is matched against the **original** text and the deletions applied in
a single ordered pass, so the bytes a filter can remove are exactly the bytes its
spans matched in the input — an earlier deletion can never manufacture a match
for a later span (overlapping spans resolve first-match-wins).

## Secret redaction

Secrets in tool output are redacted **locally**, before the model ever sees
them. The engine is an injected seam — the plugin wires
[`detect-secrets`](https://github.com/Yelp/detect-secrets), running entirely
on-machine; the library bundles no engine. The model reads stable `[REDACTED…]`
placeholders instead of the values. The write path closes the loop: Edits
composed against the redacted view are re-anchored onto the real bytes, and
placeholders in new content resolve back to the real secrets — disk → tool
input only, never into the model's view. Anything ambiguous is denied rather
than guessed, the redactor's own map is verified against the file before any
splice, and a write that would persist placeholder text over a real secret
asks instead of passing through even when the hook's own machinery fails
mid-session. The whole layer is opt-in — its denies and asks are friction, so it
engages only when asked for: set `AGENT_SANITIZER_SECRETS_ENABLED=1` in the
environment Claude Code runs the hooks with; unset, no redactor runs and no
placeholders exist.
Per-vector detail in [`THREAT-MODEL.md`](./THREAT-MODEL.md).

## What installing entails

Installing the plugin puts five hooks on every session, and this is what they
buy you:

1. Your `CLAUDE.md`, `AGENTS.md` and the context markdown under `.claude/` are
   scanned for hidden-Unicode payloads and auto-cleaned where possible. Session
   start covers what Claude Code loads at launch — the project root's own
   instruction files, the `CLAUDE.md` chain above it, and the root `.claude/`
   context subdirectories (rules, skills, agents), never bulk data parked there
   (`worktrees/`, caches, transcripts). Everything else Claude Code loads — a
   subdirectory's `CLAUDE.md`, a path-scoped rule, an `@import`, your
   user-global `~/.claude/CLAUDE.md` and global rules — is scanned from the
   bytes the load event carries, at the moment it loads, so startup costs no
   tree walk at all. Only files inside the project are rewritten: one shared
   with every other project on the machine is reported, not edited.
2. Prompts carrying payload-capable invisible or ANSI characters are blocked
   before they reach the model; pasted terminal color passes with a note.
3. Look-alike glyphs in tool inputs are folded to ASCII, so a Cyrillic `а` can't
   walk a command past a deny rule.
4. Tool output has invisible characters and terminal escapes stripped, hidden
   HTML spliced out with a placeholder, and exfil-shaped URLs flagged.
5. With `AGENT_SANITIZER_SECRETS_ENABLED=1` set, secrets in tool output are
   redacted locally by `detect-secrets` — the engine ships with the plugin and
   provisions itself on first run, no further setup from you.
6. Edits the model composes against the redacted view are re-anchored onto the
   real bytes on disk, and anything ambiguous is denied rather than guessed.
7. The costs are a few seconds on the first secret-shaped output, ~200 ms on the
   first web page, and the occasional over-redaction of credential-shaped text —
   `AGENT_SANITIZER_OUTPUT_DISABLED=1` opts out of the rewrites.

Failure is loud by design. Installed as Claude Code hooks the layers fail
**open**: a hook that could not run lets the action through rather than halting
your session on its own breakage — but it says so, in a warning the model and
the transcript both carry. Set `AGENT_SANITIZER_FAIL_OPEN=0` and the same
failures block instead: suppressed tool output
(`[output sanitizer unavailable — original output suppressed]`), blocked
prompts, permission asks whose reason names the cause. One carve-out to the
open default, with secrets enabled: a write-shaped call carrying `[REDACTED…]` placeholder text asks
instead of passing through when the hook itself is broken, since letting it
through would overwrite the real secret with the placeholder. Either way, a plugin that
never loaded at all is invisible — Claude Code reads a crashed hook as "no
objection" — so confirm with `/plugin` rather than reading a quiet session as a
working one. Neither posture touches what a sanitizer that RAN decided (see
`plugin/README.md`).

## Using it with Claude Code

The plugin installed above puts five hooks on the tool stream: tool input, tool
output, user prompts, a session-start scan of the instruction files that load at
launch, and a per-file scan of every instruction file loaded after that. It
needs only `python3` on PATH, for Layer 4 — the plugin ships the engine itself
(see [What installing entails](#what-installing-entails)).

```
/plugin marketplace add AlexanderMattTurner/agent-sanitizer
/plugin install agent-sanitizer@agent-sanitizer
/agent-sanitizer:enable-auto-update
```

Claude Code auto-updates Anthropic's own marketplaces by default and nobody
else's, so that install pins you to the release you added and later detector
fixes never arrive. Claude Code ships no slash command for the toggle, so the
plugin ships one — `/agent-sanitizer:enable-auto-update` writes the same bit the
`/plugin` picker's **Enable auto-update** does, and refuses loudly rather than
guessing if the marketplace was never added. To pull a release by hand instead:

```
/plugin marketplace update agent-sanitizer
/plugin update agent-sanitizer@agent-sanitizer
```

`plugin/README.md` has the managed-settings form for enabling it fleet-wide.

To wire them yourself instead, one entry dispatches every mode on `--hook=`:

```jsonc
// settings.json — one entry per event; PreToolUse/PostToolUse also take "matcher": "*"
{
  "type": "command",
  "command": "node ./node_modules/agent-sanitizer/claude-hooks/plugin-hooks.mjs --hook=sanitize-output",
}
```

| Event                | `--hook=`                  |
| -------------------- | -------------------------- |
| `UserPromptSubmit`   | `sanitize-user-prompt`     |
| `PreToolUse`         | `pretooluse-sanitize`      |
| `PostToolUse`        | `sanitize-output`          |
| `SessionStart`       | `scan-invisible-chars`     |
| `InstructionsLoaded` | `scan-loaded-instructions` |

**Wire all five.** The instruction-file scan is split across two of them: `SessionStart` covers the files that load at launch, and `InstructionsLoaded` covers every one a subdirectory loads later. A host that wires the first without the second leaves a nested `CLAUDE.md` scanned by nothing, and the one-time PreToolUse coverage notice is the only thing that says so.

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

The exported set is **curated, not a wildcard**: exactly the subpaths below and
nothing else. Anything unlisted is refused by the exports map with
`ERR_PACKAGE_PATH_NOT_EXPORTED`, so it never becomes a surface this package owes
compatibility on. `lib/hook-io` in particular is exported because it must be
_shared_ rather than copied: it owns the lazy-module registry and the CLI-slot
singleton, and two copies in one bundle double-fire the inlined CLIs.

<!-- exports-table: rows are asserted to equal package.json's ./claude-hooks* exports by test/claude-hooks-exports.test.mjs -->

| Subpath                                 | What it is                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `claude-hooks`                          | The `--hook=` CLI dispatcher every hook is spawned through                                 |
| `claude-hooks/pretooluse-sanitize`      | PreToolUse orchestrator: invisible-char gate, confusable folding, stego strip, rehydration |
| `claude-hooks/sanitize-output`          | PostToolUse pipeline: Layers 1–4 over tool output, plus the host-extension bag             |
| `claude-hooks/sanitize-user-prompt`     | UserPromptSubmit verdict on payload-capable invisible/ANSI content                         |
| `claude-hooks/scan-invisible-chars`     | SessionStart scan of the instruction files that load at launch                             |
| `claude-hooks/scan-loaded-instructions` | InstructionsLoaded scan of each instruction file as Claude Code loads it                   |
| `claude-hooks/lib/hook-io`              | Shared hook I/O: the lazy-module registry, the CLI slot, deadlines, the hookgate marker    |
| `claude-hooks/lib/control-plane`        | Bridge to `agent-control-plane-core` and the shared judge-CLI transport                    |
| `claude-hooks/lib/authored-content`     | Stego + terminal-control stripping of the fields the MODEL authors                         |
| `claude-hooks/lib/env-config`           | The env-bound secret vocabulary the Layer-4 pre-gate and the redactor client share         |
| `claude-hooks/lib/invisible-alert`      | Cross-hook alert state for uncleanable invisible-char injection in instruction files       |
| `claude-hooks/lib/redactor-client`      | Client for the long-lived `agent-secret-redactor-daemon` (Layer 4's transport)             |
| `claude-hooks/lib/reveal`               | The Layer-2 sidecar that lets the model re-read what the HTML splice removed               |
| `claude-hooks/lib/secret-annotate`      | The cheap deterministic Layer-4 pre-gate checks around the daemon call                     |
| `claude-hooks/lib/trace`                | The opt-in structured trace channel every layer announces itself on                        |

Only `plugin-hooks` itself is unexported under its own name — it is reachable as
the bare `claude-hooks` entry above.

Importing one runs no CLI and reads no stdin. Same stability posture as the
`_AGENT_SANITIZER_*` variables below: reachable and typed, but the supported
surface is the `--hook=` CLI, so these move between minor versions.

**`sanitize-output` takes a host-extension bag** — an optional last argument on
`sanitizeText`, `sanitizeValue`, `evaluateToolOutput`, `judgeSanitizeOutput`, and
`cliMain`, so a composer that wraps `cliMain` gets the hook's exact CLI wiring
plus its own policy:

| Field        | Runs                                                     | Does                                                                                 |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `postText`   | once per string **value** leaf, after Layers 1–4         | returns `{cleaned?, warning?}`; `cleaned` replaces the model-facing text             |
| `redactNote` | on the pre-redaction text of a leaf that tripped Layer 4 | returns a note appended to that leaf's redaction warning                             |
| `audit`      | once per judged event carrying a tool response           | is handed the output the model will actually see, and the `session_id` it belongs to |
| `trace`      | on every exit, in place of the package's trace channel   | receives the engagement announcement (see the trace sink below)                      |

Omit the bag and every seam is inert — the verdicts are byte-identical to this
module alone. A callback that throws is **not** caught: it lands in the CLI's
failure catch, so a broken extension gets the caller's failure posture — the
warning-and-pass-through default, or suppression under
`AGENT_SANITIZER_FAIL_OPEN=0`. Wire `emitFailClosed` yourself if a host must
suppress regardless of the environment. `postText` deliberately does not run on
object field NAMES: a callback sees only the string and the tool, so it cannot
tell a schema key from content, and rewriting a key can collapse two fields into
one name — which this hook answers with that same failure path.

Beyond the credential-shaped names it infers, the env-bound redaction set unions
`_AGENT_SANITIZER_EXTRA_SECRET_VARS` — a comma-separated list of `[A-Z0-9_]`
variable names whose values a deployment forwards under names of its own
choosing. A malformed entry throws rather than being dropped.

**Layer 4 needs the Python engine.** The plugin ships it and provisions it at
SessionStart; a hand-wired npm install does not, so install it yourself —
`pip install 'agent-sanitizer[secrets]'`, version-matched to the npm package.
Without it `sanitize-output` fails: secret-shaped output reaches the model
unredacted with a warning attached, or is suppressed under
`AGENT_SANITIZER_FAIL_OPEN=0`. Layers 1–3 still run.

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
`scan-invisible-chars`, `scan-loaded-instructions` and `pretooluse-sanitize`,
the extension bag's `trace` on
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

**A host's own remedy can replace the packaged one in every failure reason**
(the fail-closed verdicts and the fail-open warning alike). Deep call sites (`lib/control-plane`'s missing-package throw) take no
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
consuming hook's failure catch, never at configure time.

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

|                               | `agent-sanitizer`                                                                                                                   | Semantic guard/classifier (Lakera, Prompt Guard, Rebuff, NeMo rails)                                       | PII redactor (Presidio)                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **What it catches**           | Payload-capable invisible chars, ANSI/SGR, hidden HTML, confusable glyphs and look-alike hosts, exfil-shaped URLs                   | Malicious _intent_—jailbreaks, injected instructions, off-topic asks                                       | Names, emails, SSNs, and other PII spans                     |
| **How it decides**            | Deterministic parsing/regex over real tokenizer output—no model call                                                                | ML/LLM classification—probabilistic, needs a threshold and retuning as attacks shift                       | NER + pattern matching                                       |
| **Failure mode**              | Fails open on ambiguous input (see [`THREAT-MODEL.md`](./THREAT-MODEL.md)); false negative over false positive by design            | False positives silently mangle or block legitimate prompts; false negatives are invisible until exploited | Under/over-redaction depending on locale and entity coverage |
| **Latency / infra**           | Pure JS, mostly zero-dep (`/html` lazy-loads ~200 ms once)                                                                          | Network round-trip to a hosted model, or a local model to host yourself                                    | Local, but heavier NLP pipeline                              |
| **Determinism / testability** | Exact-equality unit tests, no flakiness across runs                                                                                 | Same input can classify differently across model versions                                                  | Deterministic per rule, but rule coverage varies             |
| **Reversibility**             | `/rehydrate` re-anchors a model's Edit or whole-file Write from the sanitized view back onto real bytes, denying anything ambiguous | N/A—classifiers only pass/block, they don't rewrite-and-reverse                                            | N/A                                                          |
| **Non-JS support**            | Same verdicts via a bundled CLI/worker—Python client included, no reimplementation                                                  | Usually a hosted API (language-agnostic) or Python-only SDK                                                | Python-first (spaCy-based)                                   |

These are complementary: a semantic guard for intent, Presidio for PII, and this
for the hidden channel both are blind to.

## Examples

```js
import { stripInvisibleWithReport } from "agent-sanitizer/invisible";
const { cleaned, found } = stripInvisibleWithReport(text); // found: ["variation-selectors"]

import {
  sanitizeHtml,
  detectExfil,
  checkExfilUrl,
  detectConfusableHosts,
} from "agent-sanitizer/html";
sanitizeHtml(pageSource); // { text, removed, warned } | null — text may be unchanged if only reportable (not strippable) tags were found
detectExfil(pageSource); // [{ isImage, reason, target }] or null
checkExfilUrl(oneUrl); // reason string or null
detectConfusableHosts(pageSource); // [{ severity, description }] or null
```

The agent-pipeline entry points take plain arguments and inject their
agent-specific seam:

```js
import { normalizeConfusables } from "agent-sanitizer/confusables";
normalizeConfusables("Bash", { command: "/аpt update" }); // null, or { updatedInput, normalized }
normalizeConfusables(
  "Bash",
  { command: "/аpt update" },
  { scan: (t) => myHomoglyphEngine.scan(t) }, // override the default namespace-guard engine
);

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
filtering (Layer 5), and—since the bridge never wires `sgrCarveOut`—Layer 1's
findings are never downgraded, so `notes` carries only the Layer-2/3 tiers and
`sgrNote` is `true` only when those were the whole story.

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
