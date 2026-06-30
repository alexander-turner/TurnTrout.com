---
title: My open source contributions
permalink: open-source
no_dropcap: true
tags:
  - personal
  - open-source
description: "My projects include this website's infrastructure, AI-powered alt text generation, and dataset protection utilities."
authors:
  - Alex Turner
hideSubscriptionLinks: false
card_image:
aliases:
  - oss
  - FOSS
  - foss
  - software
  - OSS
date_published: 2025-10-28
date_updated: 2026-06-30
---

# Punctilio for meticulous typography

<span class="populate-markdown-punctilio"></span>

# This website

Subtitle: I've made <span class="populate-commit-count"></span> commits. That's over halfway to being over 9,000!

This site is one of my most heartfelt works of art. I've passionately [optimized its design](/design) while [obsessively testing](/design#deployment-pipeline) --- for example, 100\% TypeScript branch coverage, 100\% Python line coverage, and hundreds of [visual regression tests](/design#visual-regression-testing).

I open source my website infrastructure and article edit histories at [`alexander-turner/TurnTrout.com`](https://github.com/alexander-turner/TurnTrout.com). I license the repository under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), which means you can share and adapt the site as long as you provide attribution and distribute any derivative works under the same license.

You can locally serve the site by running:

```bash
SITE_DIR=/tmp/TurnTrout.com
git clone https://github.com/alexander-turner/TurnTrout.com.git "$SITE_DIR" --depth 1
cd "$SITE_DIR"
yes | pnpm install --frozen-lockfile
pnpm dev
```

# Automatic alt text generation

Subtitle: Install with `pip install alt-text-llm`.

When I started writing in 2018, I didn't include alt text. Over the years, over 500 un-alt'ed images piled up. These (mostly) aren't simple images of geese or sunsets. Most of my images are technical, from graphs of experimental results to [hand-drawn AI alignment comics](/reframing-impact). Describing these assets was a major slog, so I turned to automation.

To implement [accessibility best practices](https://www.section508.gov/create/alternative-text/), I needed alt text that didn't describe the image so much as _communicate the information the image is supposed to communicate._ None of the scattershot AI projects I found met the bar, so I wrote my own package.

[`alt-text-llm`](https://github.com/alexander-turner/alt-text-llm) is an AI-powered tool for generating and managing alt text in Markdown files. Originally developed for this website, `alt-text-llm` streamlines the process of making web content accessible. The package detects assets missing alt text, suggests context-aware descriptions, and provides an interactive reviewing interface in the terminal.

![[https://assets.turntrout.com/static/images/posts/open-source-20251122162738.avif|A labeled diagram of the labeling pipeline.]]

Figure: Generating alt text for maze diagrams from [Understanding and Controlling a Maze-solving Policy Network](/understanding-and-controlling-a-maze-solving-policy-network). `alt-text-llm` displays the surrounding text (above the image), the image itself in the terminal using [`imgcat`](https://github.com/eddieantonio/imgcat), and the LLM-generated alt suggestion. The user interactively edits or approves the text.

In the end, I generated over 550 high-quality alt-text suggestions for about \$12.50 using Gemini 2.5 Pro. With `alt-text-llm`, I addressed hundreds and hundreds of alt-less images: detecting them; describing them; reviewing them; and lastly applying my finalized alts to the original Markdown files. [`turntrout.com`](https://turntrout.com) is now friendlier to the millions of people who browse the web with the help of screen readers.

If you want to improve accessibility for your content, go ahead and [check out my repository](https://github.com/alexander-turner/alt-text-llm)!

# Protect datasets from scrapers

Subtitle: Install with `pip install easy-dataset-share`.

I helped fund this project. Here's the introduction to an article I wrote:

> [!quote] [@title](/dataset-protection)
> ![[dataset-protection#]]

# Automated setup

Subtitle: One command to set up your shell, editor, and secret management.

My [`.dotfiles`](https://github.com/alexander-turner/.dotfiles) repository provides comprehensive development environment setup. With this command, I quickly personalize any shell --- even if I'm just visiting with `ssh` for a few hours.

1. Fish shell with autocomplete, syntax highlighting, and the [`tide`](https://github.com/IlanCosman/tide) theme,
2. `neovim` via LazyVim, providing a full IDE experience,
3. `tmux` with automatic session saving and restoration,
4. `envchain` for hardware-encrypted secret management via MacOS Secure Enclave or Linux gnome-keyring --- no more plaintext API keys in configuration files,
5. Open source AI tool setup,
6. `autojump` for quick directory navigation,
7. Reversible file deletion by default via `trash-put` instead of `rm`,
8. `git` aliases and other productivity shortcuts, and -- drum roll ---
9. `goosesay`, because every terminal needs more geese.

<span class="populate-markdown-goose-terminal"></span>

Each time I open the `fish` shell, a rainbow goose blurts out an interesting phrase. I spent several hours to achieve this modern luxury.

```fish
if status is-interactive
    fortune 5% computers 5% linuxcookie 2% startrek 88% wisdom | cowsay -f ~/.dotfiles/apps/goose.cow | lolcat -S 6
end
```

The way this works is that:

1. I sample a saying by calling the `fortune` command,
2. I pipe the saying into `goosesay` (my variant of the cow in the original [`cowsay`](https://en.wikipedia.org/wiki/Cowsay)),
3. The `lolcat` command splays the text 'cross the rainbow.

## Faster font subsetting

[`@turntrout/subfont`](https://www.npmjs.com/package/@turntrout/subfont) is a hard fork of [`Munter/subfont`](https://github.com/Munter/subfont), which shrinks fonts to only contain the characters necessary for the content.

The original `subfont` traced font usage from scratch on every page. That took almost two hours per deploy. My fork groups pages by their CSS and only traces one representative per group, extracting just the text from the rest (for my site: 382 -> 5 CSS traces). Those remaining traces run in parallel across worker threads.

# Claude Code automation template

[`alexander-turner/claude-automation-template`](https://github.com/alexander-turner/claude-automation-template) packages my automation workflows into a reusable starting point for any project using Claude Code. The template is designed so that adopting repos get improvements automatically via the sync workflow --- fix a bug in the template, and every downstream project picks it up.

# Sandbox your coding agent

<span class="populate-markdown-claude-guard"></span>

# Make your CI confess

<span class="populate-markdown-ci-truth-serum"></span>

# Sanitize untrusted text before your agent sees it

<span class="populate-markdown-agent-input-sanitizer"></span>

# Pull requests on other projects

## Mermaid diagrams now generate unique element IDs

My site [uses Mermaid diagrams](/design#mermaid-diagrams) for compact, searchable, and dynamically styled graphics. However,  [the `a11y` accessibility checker](/design#accessibility) revealed a "bigly" problem. When a page contains multiple diagrams, some element IDs collide (like those for arrowhead markers and node containers). Thus, calling `url(#arrowhead)` in the third diagram might bind to a marker defined in the first. Arrowheads vanish, click handlers fire on the wrong diagram, and CSS styles corrupt.

The issue had been reported repeatedly since 2020 ([#1,318](https://github.com/mermaid-js/mermaid/issues/1318), [#3,267](https://github.com/mermaid-js/mermaid/issues/3267), [#3,433](https://github.com/mermaid-js/mermaid/issues/3433), [#4,346](https://github.com/mermaid-js/mermaid/issues/4346)) with no comprehensive fix in sight. In February 2026, I aimed Claude Code at this problem. My [PR 7,410](https://github.com/mermaid-js/mermaid/pull/7410)  prefixed every element ID with its diagram's unique SVG container ID, making collisions impossible. I also ensured that all future diagram types generate unique IDs across diagrams.

## Jest `--collect-only` flag

Jest lacked a way to enumerate test cases without running them, unlike `pytest --collect-only`. [PR 16,006](https://github.com/jestjs/jest/pull/16006) and [PR 16,259](https://github.com/jestjs/jest/pull/16259) fixed that.

## KaTeX TypeScript cleanup

KaTeX's TypeScript codebase carried dozens of escape-hatch `as any` casts left over from its earlier Flow-to-TypeScript migration. Each one silenced a type error instead of fixing it, so the compiler couldn't catch bugs in those spots. [PR 4,171](https://github.com/KaTeX/KaTeX/pull/4171) replaced these with proper checks and tighter type definitions, then enables a lint rule so new `any` casts can't sneak back in.

## SCSS linting rule

I contributed a rule to [stylelint-scss](https://github.com/stylelint-scss/stylelint-scss). I ran into the following issue:

1. I defined a CSS `--property`.
2. I defined the `--property` using the SCSS variable `$var`.
3. In this specific context, [browsers will not interpolate `$var`](https://sass-lang.com/documentation/style-rules/declarations/#custom-properties) which means the final CSS contains the literal "`$var`".

To fix the problem, `$var` must be interpolated into `#{$var}`. My [`custom-property-no-missing-interpolation`](https://github.com/stylelint-scss/stylelint-scss/pull/1195) rule catches and automatically fixes this mistake.
