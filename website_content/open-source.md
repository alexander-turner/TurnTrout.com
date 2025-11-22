---
title: My open source contributions
permalink: open-source
no_dropcap: true
tags:
  - personal
  - open-source
description: "My projects include this website's infrastructure, AI-powered alt text
  generation, and dataset protection utilities."
authors: Alex Turner
hideSubscriptionLinks: false
card_image:
aliases:
  - oss
  - FOSS
  - foss
  - software
  - OSS
date_published: 2025-10-28 10:05:55.881595
date_updated: 2025-11-22 00:21:52.667251
---


# This website

Subtitle: I've made over 4,500 commits. That's over halfway to being over 9,000!

This site is one of my most heartfelt works of art. I've passionately [optimized its design](/design) while [obsessively testing](/design#deployment-pipeline) --- for example, 100\% TypeScript branch coverage, 100\% Python line coverage, and hundreds of [visual regression tests](/design#visual-regression-testing).

I open source my website infrastructure and article edit histories at [`alexander-turner/TurnTrout.com`](https://github.com/alexander-turner/TurnTrout.com). I license the repository under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), which means you can share and adapt the site as long as you provide attribution and distribute any derivative works under the same license.

You can locally serve the site by running:

```bash
SITE_DIR=/tmp/TurnTrout.com
git clone https://github.com/alexander-turner/TurnTrout.com.git "$SITE_DIR" --depth 1
cd "$SITE_DIR"
yes | npm ci
npx quartz build --serve
```

# Automatic alt text generation

Subtitle: Install with `pip install alt-text-llm`.

When I started writing in 2018, I didn't include alt text. Over the years, over 500 un-alt'ed images piled up. These (mostly) aren't simple images of geese or sunsets. Most of my images are technical, from graphs of experimental results to [hand-drawn AI alignment comics](/reframing-impact). Describing these assets was a major slog, so I turned to automation.

To implement [accessibility best practices](https://www.section508.gov/create/alternative-text/), I needed alt text that didn't describe the image so much as _communicate the information the image is supposed to communicate._ None of the scattershot AI projects I found met the bar, so I wrote my own package.

[`alt-text-llm`](https://github.com/alexander-turner/alt-text-llm) is an AI-powered tool for generating and managing alt text in markdown files. Originally developed for this website, `alt-text-llm` streamlines the process of making web content accessible. The package detects assets missing alt text, suggests context-aware descriptions, and provides an interactive reviewing interface in the terminal.

![[https://assets.turntrout.com/static/images/posts/open-source-20251004181740.avif|Generating alt text for maze diagrams from an article.]]
Figure: Generating alt text for maze diagrams from [Understanding and Controlling a Maze-solving Policy Network](/understanding-and-controlling-a-maze-solving-policy-network). `alt-text-llm` displays the surrounding text (above the image), the image itself in the terminal using [`imgcat`](https://github.com/eddieantonio/imgcat), and the LLM-generated alt suggestion. The user interactively edits or approves the text.

![[https://assets.turntrout.com/static/images/posts/open-source-20251004181624.avif|Generating alt text for a meme about discourse around shoggoths.]]
Figure: Generating alt text for my meme from [Against Shoggoth](/against-shoggoth).

In the end, I got the job done for about \$12.50 using Gemini 2.5 Pro. With `alt-text-llm`, I addressed hundreds and hundreds of alt-less images: detecting them; describing them; reviewing them; and lastly applying my finalized alts to the original Markdown files. [`turntrout.com`](https://turntrout.com) is now friendlier to the millions of people who browse the web with the help of screen readers.

If you want to improve accessibility for your content, go ahead and [check out my repository](https://github.com/alexander-turner/alt-text-llm)!

# Protect datasets from scrapers

Subtitle: Install with `pip install easy-dataset-share`.

I helped fund this project.

> [!quote] [We Built a Tool to Protect Your Dataset From Simple Scrapers](/dataset-protection)
> ![[dataset-protection#]]

# Automated setup

Subtitle: One command to set up your shell, editor, and secret management.

My [`.dotfiles`](https://github.com/alexander-turner/.dotfiles) repository provides a comprehensive development environment setup. With this command, I quickly personalize any shell --- even if I'm just visiting with `ssh` for a few hours.

1. Fish shell with autocomplete, syntax highlighting, and the [`tide`](https://github.com/IlanCosman/tide) theme,
2. `neovim` configured with LazyVim, providing a full-fledged IDE with Copilot support,
3. `tmux` with automatic session saving and restoration (`tmux-continuum` and `tmux-restore`),
4. `envchain` for hardware-encrypted secret management via MacOS Secure Enclave or Linux gnome-keyring --- no more plaintext API keys in configuration files,
5. Open source AI tool setup,
6. `autojump` for quick directory navigation,
7. Reversible file deletion by default via `trash-put` instead of `rm`,
8. `git` aliases and other productivity shortcuts, and -- drum roll ---
9. `goosesay`, because every terminal needs more geese.  

```plaintext
  ______________________________________
 / Find out just what any people will   \
 | quietly submit to and you have the   |
 | exact measure of the injustice and   |
 | wrong which will be imposed on them. |
 \ --- Frederick Douglass               /
  --------------------------------------
    \
     \
      \     ___
          .´   ""-⹁
      _.-´)  e  _  '⹁
     '-===.<_.-´ '⹁  \
                   \  \
                    ;  \
                    ;   \          _
                    |    '⹁__..--"" ""-._    _.´)
                   /                     ""-´  _>
                  :                          -´/
                  ;                  .__<   __)
                   \    '._      .__.-'   .-´
                    '⹁_    '-⹁__.-´      /
                       '-⹁__/    ⹁    _.´
                      ____< /'⹁__/_.""
                    .´.----´  | |
                  .´ /        | |
                 ´´-/      ___| ;
                          <_    /
                            `.'´
```

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

# Minor contributions

## SCSS linting rule

I contributed a rule to [stylelint-scss](https://github.com/stylelint-scss/stylelint-scss). I ran into the following issue:

1. I defined a CSS `--property`.
2. I defined the `--property` using the SCSS variable `$var`.
3. In this specific context, [browsers will not interpolate `$var`](https://sass-lang.com/documentation/style-rules/declarations/#custom-properties) which means the final CSS contains the literal "`$var`".

To fix the problem, `$var` must be interpolated into `#{$var}`. My [`custom-property-no-missing-interpolation`](https://github.com/stylelint-scss/stylelint-scss/pull/1195) rule catches and automatically fixes this mistake.
