# Self-Critique Prompt for PR Review

Use this prompt when launching the critique sub-agent in Step 2.

The loop’s goal is to reach a fixed point—a pass that finds **nothing** worth changing. Hunt for easy wins first; they’re cheaper to apply and unlock further simplifications on the next pass.

Fill in the **Threat model** line before you send the prompt. A finding outside it does not restart the loop (see `CLAUDE.md` → Self-Critique Loop).

## Prompt

> **Threat model:** <what this change defends against, and what it leaves out>
>
> Review the code changes for this PR and provide a critical, specific assessment. Read what’s actually there, not what the author probably meant. Cite file/line for every issue. Sort findings by category so they can be applied in order—compression first, since deletions often invalidate other comments.
>
> **Compression (delete first):**
>
> - Dead code, unused imports, unused variables, commented-out blocks
> - Comments that explain WHAT the code does instead of WHY
> - Backwards-compatibility shims, feature flags, or `// removed` markers that can just be deleted
> - Premature abstractions, helpers with one caller, hypothetical-future hooks
> - Try/except blocks with no real recovery—let it crash
>
> **Readability (easy wins):**
>
> - Sloppy or misleading names—propose the new name
> - Deeply nested conditionals—un-nest, combine related checks, use guard-clause early returns
> - Long functions that hide their structure
>
> **Code reuse:**
>
> - Duplicated logic across files or near-identical blocks—extract a helper, name the helper
> - New utility that duplicates an existing one in the codebase—point to the existing one
> - Inline constants repeated in multiple places—pull into a single source of truth
>
> **Tests (easy wins):**
>
> - Near-identical tests that differ only in inputs/expected outputs—collapse with parametrization (`pytest.mark.parametrize`, `it.each`, table-driven tests)
> - Repeated setup/teardown across tests—extract a shared fixture
> - Loose assertions (`assert result is not None`, regex matches on full structures)—replace with exact-equality comparisons
> - Missing edge cases (empty input, boundary values, error paths)
> - Tests that were weakened, skipped, or deleted without justification
>
> **Correctness:**
>
> - Logic errors, off-by-ones, unhandled edge cases
> - Security: OWASP top 10, injection, missing authn/authz, secrets in code
> - Race conditions, resource leaks, unbounded growth
> - Swallowed errors or warnings logged where a throw is required
>
> **Scope:**
>
> - Features, refactors, or files touched beyond what the task asked for
> - Configuration churn unrelated to the change
>
> **Out of scope:** list each real case that the threat model leaves out, with the code its fix would add. The author decides on these; do not mix them into the categories above. If the threat model leaves out an input that the code's own callers, configs or CI already produce, report that as a Correctness finding.
>
> For every issue, give a one-line statement of the problem and a concrete fix. If you find nothing in a category, say so explicitly—silence is ambiguous.
