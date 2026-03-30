# 'Trout roundup: turntrout.com reaches v1.5

~2,500 commits since the last roundup. This is the most infrastructure-heavy newsletter I've sent — almost entirely site improvements, with one new page. I've been using [Claude Code](https://claude.ai/code) to help build features, fix bugs, and maintain CI. My [claude-automation-template](https://github.com/alexander-turner/claude-automation-template) packages the automation infrastructure into a reusable starting point for any project.

# New page

[Prettify your text in-browser](https://turntrout.com/punctilio). Meticulously beautify your text using my "punctilio" library. No installation needed — just one click away. Includes diff highlighting, a copy button, and an HTML preview panel.

# Footnote popovers

Clicking a footnote reference now opens a popover instead of scrolling to the bottom of the page. Popovers have a close button and toggle on click/tap. This was one of my most-wanted features.

# Automatic BibTeX citations

Articles with `createBibtex: true` in their frontmatter now auto-generate a BibTeX citation block. Enabled across the shard theory sequence and other highly-cited posts.

# Colorful dropcaps

There's now a ~7% chance the dropcap letter at the start of each article renders in a color from the pond palette. The color re-rolls on every SPA navigation — keep clicking around and you'll spot one eventually.

# Mobile search improvements

Search results on mobile and tablet now show inline HTML preview snippets instead of requiring the desktop preview panel. Tables in search previews have scroll indicators when content overflows.

# Accessibility

- Automated WCAG AA accessibility checks run in CI via pa11y.
- Lighthouse now audits all four categories (Performance, Accessibility, Best Practices, SEO) — not just CLS. Upgraded to v12 with color-contrast re-enabled.
- KaTeX patches add ARIA attributes and keyboard navigation for screen readers.
- Smallcaps text now copies to clipboard correctly (as uppercase) instead of copying the visually-small lowercase letters.

# Print stylesheet

turntrout.com now prints beautifully. Comprehensive print stylesheet that forces light-mode visuals, hides interactive elements (navbar, popovers, video players), shows media source URLs as fallback text, and prevents page breaks mid-paragraph. Admonition icons render correctly via `background-image` instead of CSS masks (which browsers ignore in print). Code blocks and Mermaid diagrams preserve their backgrounds with `print-color-adjust: exact`.

The site swaps to light theme via `beforeprint`/`afterprint` events, tested with Playwright.

Before:

![A cluttered print preview for the article 'Humans Provide an Untapped Wealth of Evidence About Alignment.'](https://assets.turntrout.com/static/images/posts/design-03252026-1.avif)

After:

![A clean print preview for the same article, without clutter.](https://assets.turntrout.com/static/images/posts/design-03252026-2.avif)

# Before/after image comparison slider

Interactive image comparison slider using `img-comparison-slider`. Drag to compare before and after — useful for showing site evolution. Includes a `<noscript>` fallback and deferred asset loading. You can see it on [the design page](https://turntrout.com/design).

# Random post button

The navbar now has a "Random post" link. It's an `<a>` tag with an inline script so it works immediately, before any JavaScript bundles load.

# Cross-session scroll persistence

The site remembers your scroll position per-article in localStorage. Navigate away and come back — you're right where you left off.

# Upright punctuation in italics

Punctuation marks `() [] {} " ' "" ''` now render upright even inside italic text, following typographic convention (cf. Bringhurst). I created custom font variants of EB Garamond for this.

# Non-breaking spaces

The punctilio library's nbsp transform now runs across the site. It prevents line breaks between initials and surnames, after single-letter words, and in other typographically awkward positions. Supports full Unicode Latin alphabet.

# Safari / WebKit fixes

Fixed a cluster of Safari-specific SPA bugs: video seek, scroll restoration, checkbox state, orphaned popovers, and popover suppression timing. WebKit tests now run on macOS runners instead of Linux WPE, eliminating a whole class of false failures and letting me remove all `test.skip` / `test.slow` WebKit annotations.

# CI cost reduction (~74%)

Cut CI costs from ~$18.88 to ~$4.75 per push to main:

- **Shard optimization.** Playwright Linux shards: 30→12, macOS: 15→5. Visual testing similarly compressed.
- **Browser gating.** Firefox only on main; PRs run Chromium-only. macOS runners (10x cost) only trigger on main.
- **Per-commit CI labels.** On PRs, expensive tests only run when you add a label (`ci:run-playwright`, `ci:run-visual`, `ci:run-lighthouse`, `ci:full-tests`). One-shot per commit.
- **Removed idle polling.** The old `verify-tests` job wasted ~30 min per push.

Estimated monthly savings: ~$3,400 → ~$880. I wrote a Python script to compute optimal shard counts.

# CI automation

- Consolidated site builds into a reusable workflow. Playwright, visual testing, and site-build-checks each build once and share artifacts.
- Auto-create GitHub issues when deploys fail on main, so Claude Code can self-fix.
- PR preview deployments to Cloudflare Pages.
- Blobless partial clones for faster CI git operations.
- Weekly security vulnerability scanning with Claude — drafts fix PRs automatically.
- Monthly newsletter draft generation workflow using Claude API.
- CI failure notification workflow that comments on PRs when checks fail.
- Template sync workflow — fixes to [claude-automation-template](https://github.com/alexander-turner/claude-automation-template) propagate downstream automatically.

# Other site updates

- **Node.js 24 upgrade.** Code now uses native `RegExp.escape()` and fetch instead of polyfill libraries.

- **Homepage "Start here."** Added a curated entry point section to the landing page.

- **Built-site validation.** New checks for missing favicons, LCP image optimization, and post-rendered typos.

- Updated [Lessons from my 428-day battle against flaky Playwright screenshots](https://turntrout.com/playwright-tips) with macOS runner advice and current best practices.

- Updated [the design page](https://turntrout.com/design) extensively: before/after screenshots, print stylesheet documentation, new sections on self-improving tooling and automated workflows.
