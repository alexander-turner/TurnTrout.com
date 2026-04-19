---
title: Prettify your text in-browser
permalink: punctilio
no_dropcap: "true"
hideSubscriptionLinks: true
publish: true
date_published: 2026-02-14
description: Meticulously beautify your text using my "punctilio" library. No installation needed—just one click away.
tags:
  - website
  - open-source
aliases:
  - prettify
  - text-prettify
  - punctilio-demo
date_updated: 2026-04-10
---




Tired of the incomplete smart quote abilities offered by 2024's JavaScript libraries, I created my own. I christened the library "`punctilio`" - the "precise observance of formalities".  As of publication, [`punctilio`](https://github.com/alexander-turner/punctilio) is the best library for prettifying text.

> [!quote]- [A full description of `punctilio`](/open-source)
>
> ![[/open-source#Punctilio for meticulous typography]]

While `punctilio` is easy to install, here's an online demo for fast access!

<div id="punctilio-demo">
<div class="punctilio-mode-selector no-formatting">
<button class="punctilio-mode-btn active" data-mode="plaintext">Plaintext</button>
<button class="punctilio-mode-btn" data-mode="markdown">Markdown</button>
<button class="punctilio-mode-btn" data-mode="html">HTML</button>
</div>

> [!info] Input
> <div class="no-formatting">
> <textarea id="punctilio-input" spellcheck="false" aria-label="Text input for punctilio transformation"></textarea>
> </div>

> [!info] Output
> <div class="punctilio-output-wrapper no-formatting">
> <div class="punctilio-output-content"></div>
> <button id="punctilio-copy-btn" class="clipboard-button" type="button" aria-label="Copy output"></button>
> </div>

> [!abstract] Options
> <ul class="punctilio-options-list">
> <li class="punctilio-option"><label>Punctuation style:
> <select id="opt-punctuation-style">
> <option value="american" selected>American</option>
> <option value="british">British</option>
> <option value="none">None</option>
> </select>
> </label></li>
> <li class="punctilio-option"><label>Dash style:
> <select id="opt-dash-style">
> <option value="american" selected>American</option>
> <option value="british">British</option>
> <option value="none">None</option>
> </select>
> </label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-symbols" checked />Symbols</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-fractions" />Fractions</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-degrees" />Degrees</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-superscript" />Superscript</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-ligatures" />Ligatures</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-nbsp" checked />Non-breaking spaces</label></li>
> </ul>
