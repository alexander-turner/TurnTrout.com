# 'Trout roundup: turntrout.com reaches v1.5

This is the most infrastructure-heavy newsletter I've sent. 513 commits since the last roundup, almost entirely site improvements. No new articles this time — just a lot of engineering. I've been using [Claude Code](https://claude.ai/code) to help build features, fix bugs, and maintain CI. My [claude-automation-template](https://github.com/alexander-turner/claude-automation-template) packages the automation infrastructure into a reusable starting point for any project.

# Print stylesheet

turntrout.com now prints beautifully. I added a comprehensive print stylesheet that forces light-mode visuals, hides interactive elements (navbar, popovers, video players), shows media source URLs as fallback text, and prevents page breaks mid-paragraph. Admonition icons render correctly via `background-image` instead of CSS masks (which browsers ignore in print). Code blocks and Mermaid diagrams preserve their backgrounds with `print-color-adjust: exact`.

Dark mode? The site swaps to light theme via `beforeprint`/`afterprint` events, tested with Playwright.

# Before/after image comparison slider

I added an interactive image comparison slider using `img-comparison-slider`. Drag to compare before and after — useful for showing site evolution. Includes a `<noscript>` fallback and deferred asset loading to avoid layout shift. You can see it in action on [the design page](https://turntrout.com/design).

# Random post button

The navbar now has a "Random post" link. Click it, get a random article. It's an `<a>` tag (not a button) with an inline script so it works immediately, before any JavaScript bundles load.

# Cross-session scroll persistence

The site now remembers your scroll position per-article in localStorage. Navigate away and come back — you're right where you left off.

# Safari / WebKit fixes

I fixed a cluster of Safari-specific SPA bugs:

- Video seek now works via a play/pause cycle workaround when autoplay is off
- Scroll restoration uses `requestAnimationFrame` re-apply with a `loadeddata` fallback
- Checkbox state restoration has a polling fallback for Safari's inconsistent timing
- Popovers no longer orphan after SPA navigation
- Mouse-movement tracking replaces time-based buffer for popover suppression

WebKit tests now run on macOS runners instead of Linux WPE, which eliminated a whole class of false failures. This let me remove all `test.skip` and `test.slow` WebKit annotations from Playwright.

# CI cost reduction (~74%)

I cut CI costs from ~$18.88 to ~$4.75 per push to main:

- **Shard optimization.** Playwright Linux shards dropped from 30 to 12, macOS from 15 to 5. Visual testing shards similarly compressed.
- **Browser gating.** Firefox only runs on main; PRs run Chromium-only. macOS runners (10x the cost of Linux) only trigger on pushes to main.
- **Per-commit CI labels.** On PRs, expensive tests only run when you add a label (`ci:run-playwright`, `ci:run-visual`, `ci:run-lighthouse`, `ci:full-tests`). Labels are one-shot per commit — adding a label triggers tests for the current HEAD, and the next push won't re-trigger unless you re-add.
- **Removed idle polling.** The old `verify-tests` job wasted ~30 min of runner time per push doing nothing.

Estimated monthly savings: ~$3,400 down to ~$880. I wrote a Python script to compute optimal shard counts.

# CI workflow consolidation

- Merged `setup-base-env` and `setup-build-env` into a single composite action.
- Consolidated site builds into a reusable workflow so Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards.
- Blobless partial clones across all full-history checkouts for faster CI git operations.
- Auto-create GitHub issues when deploys fail on main, so Claude Code can self-fix.

# Node.js 24 upgrade

Upgraded from Node.js 22 to 24. This let me:

- Replace `escape-string-regexp` with native `RegExp.escape()` (V8 13.6)
- Remove `node-fetch` and `whatwg-fetch` polyfills in favor of native fetch
- Switch test environment from `jest-environment-jsdom` to `jest-fixed-jsdom`

# Automated security scanning

A new weekly GitHub Actions workflow scans for dependency vulnerabilities using GitHub's security APIs and drafts fix PRs automatically with Claude. Already patched 31 of 34 flagged vulnerabilities, including a prototype pollution issue in `jsonpath`.

# Lighthouse improvements

Upgraded to Lighthouse v12. Re-enabled color-contrast auditing — spoiler overlay opacity bumped from 0.5 to 0.65 for compliance, with a text-shadow glow so the overlay text stays readable. Non-blocking KaTeX CSS and font subsetting further improved performance scores.

# Other site updates

- **Smart quotes in meta tags.** The `<meta description>` tag now gets smart quote treatment, matching the rest of the site's typography.

- **Search preview scroll indicators.** Search result previews now show scroll indicators when table content overflows.

- **KaTeX accessibility patches.** Stripped unnecessary CSS classes and added ARIA attributes for screen readers.

- **Subfont fork.** Switched to a [custom fork](https://github.com/alexander-turner/subfont) with debug timing for font subsetting diagnostics.

- Updated [Lessons from my 428-day battle against flaky Playwright screenshots](https://turntrout.com/playwright-tips) with macOS runner advice and current best practices.

- Updated [the design page](https://turntrout.com/design) with before/after comparison screenshots, print stylesheet documentation, and a new section on self-improving tooling and automated workflows.

- Removed full-project type checks from lint-staged for faster pre-commit hooks.
