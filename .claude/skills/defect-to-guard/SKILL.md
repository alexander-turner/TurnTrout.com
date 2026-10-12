---
name: defect-to-guard
description: Turn a defect class into a well-designed guard PROPOSAL, and — once a human promotes it — a well-built guard. Activate when writing a `## Proposed guards` entry after fixing a bug, and when a human has explicitly approved implementing a lint, pre-commit hook, CI check, assertion, or ratchet. Never activate to ship a guard inside a fix PR. Covers naming the defect CLASS rather than the instance, checking whether an existing guard should have fired, preferring a check that iterates the SSOT over a per-case assertion, the inert-feature class that only a behavior-driving smoke test can catch, the benefit-versus-cost arithmetic the proposal must show, guard rent, dogfooding a new lint against the real tree, and the watched-surface question.
---

# From one defect to a standing invariant

## Ask the class question on every defect

**On every defect you find or fix, ask: "could a GENERIC CI check have caught this whole CLASS without anticipating this specific error?"** — and when the answer is yes, the output is a `## Proposed guards` entry in the PR body, never a guard shipped in the same PR. The reflex:

1. **Name the _class_** the bug belongs to — a documented-but-unrouted subcommand, a parsed-but-undeclared flag, a referenced-but-undocumented env var, a feature whose code is written but never wired onto the live path, a portability divergence, a swallowed error.
2. **Find whether a guard for that class already exists** and, if so, **why it didn't fire — a gap in the existing guard is itself the bug**.
3. **If none exists, prefer a check that iterates the SSOT and asserts the second copy**, so it covers every future member for free and never names the instance. A generic guard is an SSOT-completeness check, not a per-case assertion.
4. **Pick the cheapest mechanism that can express the class, in this order: a type the compiler already tracks, then an AST rule, then a line or regex lint.** The order tracks the false-positive rate. A type follows the value, so it never guesses at a shape; an AST rule sees structure, so it skips a match inside a string literal, a comment or a fixture; a text lint matches characters, so every legitimate use of those characters earns a disable comment, and each one hides the next real finding on its line. Reach for a line lint only when the class has no syntax to bind to — a banned word in prose, a path convention — and say in the proposal why.

**Show the mechanism, never just name it:** the proposal carries the smallest snippet a reader can check — the signature that changes and the one line that now fails. "A provenance type" is a label; the four lines below are the thing, and a reviewer can judge them in ten seconds.

```js
/** @typedef {string & {__checked: "rewrite"}} Checked */
/** Throws when the anchor misses. @returns {Checked} */
export function patchAnchored(src, anchor) {
  return /** @type {Checked} */ (applyAt(src, anchor));
}
export function writeGenerated(path, /** @type {Checked} */ content) {}
writeGenerated(p, src.replace(a, b)); // type error: .replace returns plain string
```

The hardest class is the **inert-feature** bug — code written and unit-tested but never reached on the live path. A source-text or unit check passes green while the feature is dead, so the only honest catch is a **behavior-driving smoke test that exercises the real path and asserts the observable outcome** (see the [`writing-tests`](../writing-tests/SKILL.md) skill).

When a class genuinely resists a cheap generic guard, say so — don't fabricate a hollow per-instance check that only re-tests the one bug you already fixed.

## A guard is an economic object — show the arithmetic in the proposal

Weigh both sides before proposing one, and state both.

- **Benefit:** (defects of that class actually reaching this repo per year) × (cost of one escaping to the default branch) × (fraction the guard catches).
- **Cost:** latency on _every_ commit, push and PR forever; false positives, each of which trains sessions to route around the check; maintenance when the code it inspects moves; and one more entry in the overseer's working set.

Most proposed guards fail this arithmetic — the class fires once, the guard runs 10,000 times. A guard is worth shipping when the defect class is _recurring, severe, and cheaply detectable_ (secret leaks, fail-open enforcement, broken required-check wiring); not to commemorate a one-off bug the fix's own regression test already pins.

**The blocking surface is an oversight instrument only while a human knows every entry and what it certifies.** Treat that set as budgeted: adding a blocking check means naming which one it replaces, or arguing why the set should grow. Eligibility tracks what a check certifies — product or security **behavior** qualifies; process idiom stays advisory.

**Guard rent.** Every blocking check must be able to cite a real defect it caught pre-merge within the last 8 weeks. **Writing the citation is the job of the session whose PR the check blocked**, at the moment it blocks — you are the only one who will ever know. Uncited means demote to advisory in a prune PR; advisory and uncited 8 more weeks means delete. Security-boundary checks are exempt from deletion, not from citation.

**A guard that ships with a grandfathered baseline owes a paydown PR — a separate one, opened with it.** A ratchet's grandfathered counts are debt the guard took on, not a fact about the tree: the check blocks new growth and is satisfied forever while every pre-existing site stays put, so a lint can run 10,000 times, stay green, and never once cause a violation to be fixed. The paydown PR is separate because the two diffs want opposite review — the guard is a few lines read closely, the paydown a wide mechanical sweep skimmed for shape. It need not empty the baseline; it must strictly shrink it and state the count before and after. **A baseline that cannot be reduced at all is evidence the guard is mis-specified** — it is flagging an idiom the tree deliberately uses, and the honest response is to narrow the detector or drop it.

## Write the lint — only in a human-promoted implementation PR

Most guards here live as repo-local pre-commit hooks: a `.github/scripts/check-*.py` script registered under `repo: local` in `.pre-commit-config.yaml`, scoped with `files:`/`types:`, with a per-line `# allow-<slug>: <reason>` opt-out. When the class is general enough to ship to every consumer of this template, it belongs upstream in `ci-truth-serum` instead. **Write the lint only after a human has promoted the proposal, in its own implementation PR** — in the fix PR itself, the deliverable is the proposal entry.

Two hard gates on doing it well:

1. **Dogfood against the real tree before committing** — a lint that fires on hundreds of legitimate existing call sites is flagging an idiom, not a defect, so narrow the scope (directory, file type, context) until the only hits are genuine, then bring each into compliance.
2. **Scope to where the failure actually bites** — the same construct can be a bug in runtime tooling and a non-issue under a CI job's `timeout-minutes` backstop, so a `files:` scope is often what turns a noisy check into a precise one.

If after honest dogfooding the class cannot be separated from legitimate use with acceptable false positives, say so and **DON'T** ship the lint — a hollow or noisy guard gets disabled and teaches nothing.

## Every guard needs a WATCHED SURFACE

**Before calling a check done, ask "when this goes red, WHO SEES IT?"** A required PR check blocks a merge and gets read; a `schedule`, `workflow_dispatch`, or post-merge run has no PR surface at all — its red lands in an Actions tab nobody opens, so the check is decorative. Route the failure to a human (`./.github/actions/notify-ntfy`, or the shared notifier's `workflow_run` list), or say why nobody needs to know. Ask it of the fix you just shipped too, not only of new checks.

**Then ask it about DURATION: "if this stayed broken for a month, what would tell me?"** A cron whose failures notify nobody is silent for exactly as long as it stays broken, and a month of that looks identical to a healthy quiet month.

The strictly worse twin is the **vacuous green**: a check that fails to fetch its input, degrades to a placeholder, and reports success. No surface saves that, so pair the question with "what does this do when its input is missing?" and make the answer fail closed.

## Examples

**Input:** you just fixed a workflow whose decide gate omitted a script the gated job runs, so the job skipped exactly when that script changed.

**Output:** a `## Proposed guards` entry naming the class ("a gated job whose trigger paths omit a real dependency"), noting that `check-path-gate-deps` already covers it and asking why it did not fire — a gap in the existing guard, not a new one. No lint ships in the fix PR.

**Input:** a one-off typo in a test fixture that no generic check could express.

**Output:** no proposal at all — say the class resists a cheap generic guard, and let the fix's own regression test stand.
